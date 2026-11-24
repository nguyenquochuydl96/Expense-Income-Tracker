import { BudgetTransferRecord, CheckTienSheetData, SheetTabType, TransactionRecord } from '../types/finance';
import { parseDateString } from '../utils/csvParser';
import { RowSignature, generateTxId } from '../utils/syncStateUtils';
import { SpreadsheetMetadata } from './googleSheetsService';

export const STORAGE_KEY_WEB_APP_URL = 'heomeo_apps_script_url_v1';
export const STORAGE_KEY_WEB_APP_KEY = 'heomeo_apps_script_key_v1';
export const STORAGE_KEY_CONNECTION_MODE = 'heomeo_connection_mode_v1'; // 'webapp' | 'oauth'

// Never hardcode a personal Web App deployment URL in public source code.
// Users configure their own deployed Apps Script Web App URL once in SheetSyncPanel.
export const DEFAULT_WEB_APP_URL = '';

export interface AppsScriptWalletPayload {
  heo: {
    cash: number;
    bank: number;
    ewallet: number;
    receivable: number;
  };
  meo: {
    cash: number;
    bank: number;
    ewallet: number;
    receivable: number;
  };
}

export function isAppsScriptUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return clean.includes('script.google.com') && (clean.includes('/macros/s/') || clean.includes('/exec'));
}

export function getStoredWebAppUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEB_APP_URL);
    if (saved && isAppsScriptUrl(saved)) return saved;
  } catch {
    // ignore
  }
  return '';
}

export function saveStoredWebAppUrl(url: string) {
  try {
    const clean = url.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY_WEB_APP_URL, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_WEB_APP_URL);
    }
  } catch {
    // ignore
  }
}

export function getStoredWebAppKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY_WEB_APP_KEY);
    if (key && key.trim()) return key.trim();
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredWebAppKey(key: string) {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY_WEB_APP_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_WEB_APP_KEY);
    }
  } catch {
    // ignore
  }
}

export function getConnectionMode(): 'webapp' | 'oauth' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONNECTION_MODE);
    if (saved === 'oauth' || saved === 'webapp') return saved;
  } catch {
    // ignore
  }
  return 'webapp';
}

export function setConnectionMode(mode: 'webapp' | 'oauth') {
  try {
    localStorage.setItem(STORAGE_KEY_CONNECTION_MODE, mode);
  } catch {
    // ignore
  }
}

/**
 * Universal caller for Google Apps Script Web App
 * All requests containing apiKey (including ping, syncAll, getMetadata) are sent via POST body
 * to prevent leaking secrets in GET query strings. Uses text/plain body to prevent CORS preflight OPTIONS issues in browsers.
 */
const APPS_SCRIPT_TIMEOUT_MS = 25000;

async function callAppsScriptApi(webAppUrl: string, payload: any): Promise<any> {
  const cleanUrl = webAppUrl.trim();
  const storedKey = getStoredWebAppKey();
  if (storedKey && !payload.apiKey) {
    payload.apiKey = storedKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);

  try {
    // POST with text/plain to avoid preflight OPTIONS block and keep secrets out of URLs
    const res = await fetch(cleanUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Apps Script trả về lỗi (${res.status}): ${errText.slice(0, 100)}`);
    }

    const json = await res.json();
    if (json.success === false) {
      const err: Error & { conflict?: boolean; code?: string } = new Error(
        json.error || 'Thao tác trên Google Sheet thất bại'
      );
      if (json.conflict) err.conflict = true;
      if (json.code) err.code = json.code;
      throw err;
    }
    return json;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Kết nối Google Apps Script quá thời gian (25 giây). Vui lòng kiểm tra mạng và thử lại.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface AppsScriptSyncResult {
  metadata: SpreadsheetMetadata;
  expenses: TransactionRecord[];
  income: TransactionRecord[];
  budgetTransfers: BudgetTransferRecord[];
  checkTien?: CheckTienSheetData | null;
}

export async function appsScriptPing(webAppUrl: string, apiKey?: string): Promise<{ success: boolean; title?: string }> {
  return await callAppsScriptApi(webAppUrl, { action: 'ping', apiKey });
}

export async function appsScriptSyncAll(webAppUrl: string, apiKey?: string): Promise<AppsScriptSyncResult> {
  const res = await callAppsScriptApi(webAppUrl, { action: 'syncAll', apiKey });

  const rawMeta = res.metadata || {};
  const metadata: SpreadsheetMetadata = {
    spreadsheetId: webAppUrl,
    title: rawMeta.title || 'Expense & Income Tracker',
    sheetNames: rawMeta.sheetNames || ['Expenses', 'Income', 'Monthly Overview', 'Budget Transfers'],
    expensesTab: rawMeta.expensesTab || 'Expenses',
    incomeTab: rawMeta.incomeTab || 'Income',
    checkTienTab: rawMeta.checkTienTab || null,
    summaryTab: rawMeta.summaryTab || null,
    budgetTransfersTab: rawMeta.budgetTransfersTab || 'Budget Transfers',
  };

  const expenses: TransactionRecord[] = (res.expenses || [])
    .filter((r: any) => {
      const amt = Number(r.amount) || 0;
      const be = Number(r.beCorp) || 0;
      const cr = Number(r.credit) || 0;
      const item = (r.purchaseItem || '').trim();
      const cat = (r.category || '').trim();
      const note = (r.note || '').trim();
      return amt !== 0 || be !== 0 || cr !== 0 || (item !== '' && item !== '(Không ghi nội dung)') || cat !== '' || note !== '';
    })
    .map((r: any, idx: number) => {
      const parsedDate = parseDateString(r.purchaseDate);
      const rawTxId = (r.txId || r.id || '').trim();
      const txId = rawTxId || generateTxId('exp');
      return {
        id: txId,
        txId,
        rowIndex: r.rowIndex || idx + 2,
        sheetType: 'Expenses' as SheetTabType,
        purchaseDate: r.purchaseDate || '',
        isoDate: parsedDate.isoDate,
        monthKey: parsedDate.monthKey,
        category: r.category || '',
        purchaseItem: r.purchaseItem || '',
        amount: Number(r.amount) || 0,
        beCorp: Number(r.beCorp) || 0,
        credit: Number(r.credit) || 0,
        note: r.note || '',
        source: 'google_sheet',
        syncedToSheet: true,
      };
    });

  const income: TransactionRecord[] = (res.income || [])
    .filter((r: any) => {
      const amt = Number(r.amount) || 0;
      const item = (r.purchaseItem || '').trim();
      const cat = (r.category || '').trim();
      const note = (r.note || '').trim();
      return amt !== 0 || (item !== '' && item !== '(Không ghi nội dung)') || cat !== '' || note !== '';
    })
    .map((r: any, idx: number) => {
      const parsedDate = parseDateString(r.purchaseDate);
      const rawTxId = (r.txId || r.id || '').trim();
      const txId = rawTxId || generateTxId('inc');
      return {
        id: txId,
        txId,
        rowIndex: r.rowIndex || idx + 2,
        sheetType: 'Income' as SheetTabType,
        purchaseDate: r.purchaseDate || '',
        isoDate: parsedDate.isoDate,
        monthKey: parsedDate.monthKey,
        category: r.category || '',
        purchaseItem: r.purchaseItem || '',
        amount: Number(r.amount) || 0,
        beCorp: 0,
        credit: 0,
        note: r.note || '',
        source: 'google_sheet',
        syncedToSheet: true,
      };
    });

  const budgetTransfers: BudgetTransferRecord[] = (res.budgetTransfers || []).map((t: any, idx: number) => {
    const parsedDate = parseDateString(t.date);
    const rawTxId = (t.txId || t.id || '').trim();
    const txId = rawTxId || generateTxId('bt');
    return {
      id: txId,
      txId,
      rowIndex: t.rowIndex || idx + 2,
      date: t.date || '',
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      fromCategory: t.fromCategory || '',
      toCategory: t.toCategory || '',
      amount: Number(t.amount) || 0,
      description: t.description || '',
      source: 'google_sheet',
      syncedToSheet: true,
    };
  });

  const checkTien: CheckTienSheetData | null =
    res.checkTien && typeof res.checkTien === 'object' && res.checkTien.sheetName
      ? {
          sheetName: res.checkTien.sheetName,
          formattedRows: Array.isArray(res.checkTien.formattedRows) ? res.checkTien.formattedRows : [],
          formulaRows: Array.isArray(res.checkTien.formulaRows) ? res.checkTien.formulaRows : [],
          detectedSummary: Array.isArray(res.checkTien.detectedSummary) ? res.checkTien.detectedSummary : [],
        }
      : null;

  return { metadata, expenses, income, budgetTransfers, checkTien };
}

export async function appsScriptAppendTransaction(
  webAppUrl: string,
  tabName: string,
  record: {
    sheetType?: SheetTabType;
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
    txId?: string;
  },
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number; txId?: string; deduplicated?: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendTransaction',
    tabName,
    record,
    txId: record.txId,
    apiKey,
  });
}

export async function appsScriptUpdateTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  record: {
    sheetType?: SheetTabType;
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
    txId?: string;
  },
  apiKey?: string,
  txId?: string,
  expectedSignature?: RowSignature
): Promise<{ success: boolean; rowIndex?: number; txId?: string }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'updateTransaction',
    tabName,
    rowIndex,
    record,
    apiKey,
    txId: txId || record.txId,
    expectedSignature,
  });
}

export async function appsScriptDeleteTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  apiKey?: string,
  txId?: string,
  expectedSignature?: RowSignature
): Promise<{ success: boolean; rowIndex?: number }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'deleteTransaction',
    tabName,
    rowIndex,
    apiKey,
    txId,
    expectedSignature,
  });
}

export async function appsScriptMoveTransaction(
  webAppUrl: string,
  params: {
    fromTab: string;
    toTab: string;
    rowIndex: number;
    txId?: string;
    record: {
      sheetType?: SheetTabType;
      purchaseDate: string;
      category: string;
      purchaseItem: string;
      amount: number;
      beCorp: number;
      credit: number;
      note?: string;
      txId?: string;
    };
    expectedSignature?: RowSignature;
  },
  apiKey?: string
): Promise<{
  success: boolean;
  rowIndex?: number;
  deletedRowIndex?: number;
  txId?: string;
  deduplicated?: boolean;
}> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'moveTransaction',
    fromTab: params.fromTab,
    toTab: params.toTab,
    rowIndex: params.rowIndex,
    txId: params.txId || params.record.txId,
    record: params.record,
    expectedSignature: params.expectedSignature,
    apiKey,
  });
}

export async function appsScriptAppendTransfer(
  webAppUrl: string,
  transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
    txId?: string;
  },
  apiKey?: string,
  tabName = 'Budget Transfers'
): Promise<{ success: boolean; rowIndex?: number; txId?: string; deduplicated?: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendBudgetTransfer',
    tabName,
    transfer,
    txId: transfer.txId,
    apiKey,
  });
}

export async function appsScriptUpdateCheckTienWallets(
  webAppUrl: string,
  wallets: AppsScriptWalletPayload,
  tabName?: string | null,
  apiKey?: string
): Promise<{ success: boolean; updated?: boolean; tabName?: string; message?: string }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'updateCheckTienWallets',
    tabName: tabName || undefined,
    wallets,
    apiKey,
  });
}

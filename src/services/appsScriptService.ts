import { BudgetTransferRecord, SheetTabType, TransactionRecord } from '../types/finance';
import { parseDateString } from '../utils/csvParser';
import { SpreadsheetMetadata } from './googleSheetsService';

export const STORAGE_KEY_WEB_APP_URL = 'heomeo_apps_script_url_v1';
export const STORAGE_KEY_WEB_APP_KEY = 'heomeo_apps_script_key_v1';
export const STORAGE_KEY_CONNECTION_MODE = 'heomeo_connection_mode_v1'; // 'webapp' | 'oauth'

export const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwp6bORyNAXWePm2R7akA-VMLDdKPr421g0r-0Nb203wPJYM2f1lY5AriJQ4KBTTFcUyQ/exec';

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
  return DEFAULT_WEB_APP_URL;
}

export function saveStoredWebAppUrl(url: string) {
  try {
    localStorage.setItem(STORAGE_KEY_WEB_APP_URL, url.trim());
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
    localStorage.setItem(STORAGE_KEY_WEB_APP_KEY, key.trim());
  } catch {
    // ignore
  }
}

export function getConnectionMode(): 'webapp' | 'oauth' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONNECTION_MODE);
    if (saved === 'oauth' || saved === 'webapp') return saved;
    // Default to 'webapp' if web app url exists
    if (getStoredWebAppUrl()) return 'webapp';
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
async function callAppsScriptApi(webAppUrl: string, payload: any): Promise<any> {
  const cleanUrl = webAppUrl.trim();
  const storedKey = getStoredWebAppKey();
  if (storedKey && !payload.apiKey) {
    payload.apiKey = storedKey;
  }

  // POST with text/plain to avoid preflight OPTIONS block and keep secrets out of URLs
  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Apps Script trả về lỗi (${res.status}): ${errText.slice(0, 100)}`);
  }

  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error || 'Thao tác trên Google Sheet thất bại');
  }
  return json;
}

export interface AppsScriptSyncResult {
  metadata: SpreadsheetMetadata;
  expenses: TransactionRecord[];
  income: TransactionRecord[];
  budgetTransfers: BudgetTransferRecord[];
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
    const txId = r.txId || r.id || `exp-${r.rowIndex || idx + 2}-${r.purchaseDate}`;
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
    const txId = r.txId || r.id || `inc-${r.rowIndex || idx + 2}-${r.purchaseDate}`;
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
    const txId = t.txId || t.id || `bt-${t.rowIndex || idx + 2}-${t.date}`;
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

  return { metadata, expenses, income, budgetTransfers };
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
): Promise<{ success: boolean; rowIndex?: number; txId?: string }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendTransaction',
    tabName,
    record,
    apiKey,
  });
}

export async function appsScriptUpdateTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  record: {
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
  txId?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'updateTransaction',
    tabName,
    rowIndex,
    record,
    apiKey,
    txId: txId || record.txId,
  });
}

export async function appsScriptDeleteTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  apiKey?: string,
  txId?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'deleteTransaction',
    tabName,
    rowIndex,
    apiKey,
    txId,
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
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number; txId?: string }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendBudgetTransfer',
    tabName: 'Budget Transfers',
    transfer,
    apiKey,
  });
}

import { CheckTienSheetData, SheetTabType, TransactionRecord } from '../types/finance';
import { formatNumberForSheet, parseDateString, parseSheetNumber } from '../utils/csvParser';

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
  expensesTab: string;
  incomeTab: string;
  checkTienTab: string | null;
  summaryTab: string | null;
}

export interface SummarySheetData {
  sheetName: string;
  formattedRows: string[][];
  formulaRows: string[][];
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function findMatchingTab(sheetNames: string[], candidates: string[], fallback: string): string {
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  for (const candidate of lowerCandidates) {
    const exact = sheetNames.find((name) => name.trim().toLowerCase() === candidate);
    if (exact) return exact;
  }
  for (const candidate of lowerCandidates) {
    const partial = sheetNames.find((name) => name.toLowerCase().includes(candidate));
    if (partial) return partial;
  }
  return fallback;
}

export async function fetchSpreadsheetMetadata(
  spreadsheetIdOrUrl: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${msg})`);
    }
    throw new Error(`Không thể kết nối Google Sheet: ${msg}`);
  }

  const data = await res.json();
  const sheetNames: string[] = (data.sheets || []).map((s: any) => s.properties?.title || '');

  const expensesTab = findMatchingTab(sheetNames, ['expenses', 'chi tiêu', 'chi tieu', 'expense'], sheetNames[0] || 'Expenses');
  const incomeTab = findMatchingTab(sheetNames, ['income', 'thu nhập', 'thu nhap', 'thu'], 'Income');
  const checkTienMatch = findMatchingTab(sheetNames, ['check tiền', 'check tien', 'đối soát', 'reconcile', 'check'], '');
  const summaryMatch = findMatchingTab(sheetNames, ['summary', 'tổng hợp', 'tong hop', 'báo cáo', 'overview'], '');

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || 'Expense & Income Tracker',
    sheetNames,
    expensesTab,
    incomeTab,
    checkTienTab: checkTienMatch || null,
    summaryTab: summaryMatch || null,
  };
}

export async function fetchTabTransactions(
  spreadsheetId: string,
  tabName: string,
  sheetType: SheetTabType,
  accessToken: string
): Promise<TransactionRecord[]> {
  const range = `${tabName}!A1:G5000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    if (res.status === 400 || res.status === 404) {
      return [];
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Không đọc được bảng ${tabName}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) return [];

  const records: TransactionRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = (row[0] || '').trim();
    const rawCategory = (row[1] || '').trim();
    const rawItem = (row[2] || '').trim();
    const rawAmount = (row[3] || '').trim();
    const rawBeCorp = (row[4] || '').trim();
    const rawCredit = (row[5] || '').trim();
    const rawNote = (row[6] || '').trim();

    if (!rawDate && !rawCategory && !rawItem && !rawAmount) continue;
    if (rawDate.toLowerCase() === 'purchase date' || rawDate.toLowerCase() === 'date') continue;

    const parsedDate = parseDateString(rawDate);
    const amount = parseSheetNumber(rawAmount);
    const beCorp = parseSheetNumber(rawBeCorp);
    const credit = parseSheetNumber(rawCredit);

    if (!rawItem && amount === 0 && beCorp === 0 && credit === 0 && !rawNote) {
      continue;
    }

    records.push({
      id: `sheet-${sheetType}-${i + 1}`,
      rowIndex: i + 1,
      sheetType,
      purchaseDate: rawDate || parsedDate.displayDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: rawCategory || (sheetType === 'Income' ? 'Thu nhập' : 'Khác'),
      purchaseItem: rawItem || '(Không ghi nội dung)',
      amount,
      beCorp,
      credit,
      note: rawNote || undefined,
      source: 'google_sheet',
      syncedToSheet: true,
    });
  }

  return records;
}

export async function fetchCheckTienSheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<CheckTienSheetData | null> {
  const range = `${tabName}!A1:M120`;
  const [formattedRes, formulaRes] = await Promise.all([
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  if (!formattedRes.ok) return null;

  const formattedData = await formattedRes.json();
  const formulaData = formulaRes.ok ? await formulaRes.json() : { values: [] };

  const formattedRows: string[][] = formattedData.values || [];
  const formulaRows: string[][] = formulaData.values || [];

  const detectedSummary: { label: string; value: string; formula?: string }[] = [];

  for (let r = 0; r < formattedRows.length; r++) {
    const row = formattedRows[r] || [];
    const fRow = formulaRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      const formula = (fRow[c] || '').toString().trim();
      if (formula.startsWith('=')) {
        const leftLabel = c > 0 ? (row[c - 1] || '').trim() : '';
        const topLabel = r > 0 && formattedRows[r - 1] ? (formattedRows[r - 1][c] || '').trim() : '';
        const label = leftLabel || topLabel || `Ô ${String.fromCharCode(65 + c)}${r + 1}`;
        if (cell) {
          detectedSummary.push({ label, value: cell, formula });
        }
      }
    }
  }

  return {
    sheetName: tabName,
    formattedRows,
    formulaRows,
    detectedSummary,
  };
}

export async function fetchSummarySheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<SummarySheetData | null> {
  const range = `${tabName}!A1:Z100`;
  const [formattedRes, formulaRes] = await Promise.all([
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  if (!formattedRes.ok) return null;

  const formattedData = await formattedRes.json();
  const formulaData = formulaRes.ok ? await formulaRes.json() : { values: [] };

  return {
    sheetName: tabName,
    formattedRows: formattedData.values || [],
    formulaRows: formulaData.values || [],
  };
}

export async function appendTransactionToSheet(
  spreadsheetId: string,
  tabName: string,
  record: {
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
  },
  accessToken: string
): Promise<void> {
  const rowValues = [
    record.purchaseDate,
    record.category,
    record.purchaseItem,
    formatNumberForSheet(record.amount, true),
    record.beCorp !== 0 ? formatNumberForSheet(record.beCorp, false) : '',
    record.credit !== 0 ? formatNumberForSheet(record.credit, false) : '',
  ];
  if (record.note && record.note.trim()) {
    rowValues.push(record.note.trim());
  }

  const range = `${tabName}!A:F`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${msg})`);
    }
    throw new Error(`Không thể ghi dòng mới vào bảng ${tabName}: ${msg}`);
  }
}

import { BudgetTransferRecord, CheckTienSheetData, SheetTabType, TransactionRecord } from '../types/finance';
import { formatNumberForSheet, parseDateString, parseSheetNumber } from '../utils/csvParser';

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
  expensesTab: string;
  incomeTab: string;
  checkTienTab: string | null;
  summaryTab: string | null;
  budgetTransfersTab: string | null;
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

  const expensesTab = findMatchingTab(
    sheetNames,
    ['expenditure', 'expenses', 'chi tiêu', 'chi tieu', 'expense', 'chi'],
    sheetNames[0] || 'Expenditure'
  );
  const incomeTab = findMatchingTab(
    sheetNames,
    ['income', 'thu nhập', 'thu nhap', 'thu', 'lương', 'salary', 'incomes', 'sheet income'],
    sheetNames.find((s) => /income|thu|lương/i.test(s)) || (sheetNames.length > 1 ? sheetNames[1] : 'Income')
  );
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
    budgetTransfersTab: sheetNames.find((n) => /budget transfer|transfer/i.test(n)) || null,
  };
}

export async function fetchTabTransactions(
  spreadsheetId: string,
  tabName: string,
  sheetType: SheetTabType,
  accessToken: string
): Promise<TransactionRecord[]> {
  const safeTab = `'${tabName.replace(/'/g, "''")}'`;
  const range = `${safeTab}!A1:Z5000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.warn(`[fetchTabTransactions] Error reading ${tabName} (${res.status}):`, errBody);
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${errBody?.error?.message || ''})`);
    }
    if (res.status === 400 || res.status === 404) {
      return [];
    }
    throw new Error(errBody?.error?.message || `Không đọc được bảng ${tabName}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) return [];

  // Intelligent header and column detection separated by sheetType
  const header = (rows[0] || []).map((c) => (c || '').trim().toLowerCase());

  let dateIdx = -1;
  let categoryIdx = -1;
  let itemIdx = -1;
  let amountIdx = -1;
  let beCorpIdx = -1;
  let creditIdx = -1;
  let noteIdx = -1;

  if (sheetType === 'Expenses') {
    for (let c = 0; c < header.length; c++) {
      const h = header[c];
      if (dateIdx === -1 && /date|ngày|time|thời gian/i.test(h) && !/month|tháng/i.test(h)) dateIdx = c;
      else if (beCorpIdx === -1 && /be corp|becorp|be\s*corp/i.test(h)) beCorpIdx = c;
      else if (creditIdx === -1 && /credit|thẻ|tín dụng/i.test(h)) creditIdx = c;
      else if (amountIdx === -1 && /amount|số tiền|tiền|giá trị|thực nhận/i.test(h)) amountIdx = c;
      else if (categoryIdx === -1 && /category|hạng mục|danh mục|loại/i.test(h)) categoryIdx = c;
      else if (itemIdx === -1 && /item|nội dung|khoản|mô tả|tên|chi tiết/i.test(h)) itemIdx = c;
      else if (noteIdx === -1 && /note|ghi chú|bảng/i.test(h)) noteIdx = c;
    }
    if (dateIdx === -1) dateIdx = 0;
    if (categoryIdx === -1) categoryIdx = 1;
    if (itemIdx === -1) itemIdx = 2;
    if (amountIdx === -1) amountIdx = 3;
    if (beCorpIdx === -1) beCorpIdx = 4;
    if (creditIdx === -1) creditIdx = 5;
    if (noteIdx === -1) noteIdx = 6;
  } else {
    // sheetType === 'Income'
    // Header format: Date (0), Income Source (1), Description (2), Income Amount (3), Month (4)
    for (let c = 0; c < header.length; c++) {
      const h = header[c];
      if (dateIdx === -1 && /date|ngày|time|thời gian/i.test(h) && !/month|tháng/i.test(h)) dateIdx = c;
      else if (amountIdx === -1 && /income amount|amount|số tiền|tiền|giá trị|thực nhận/i.test(h)) amountIdx = c;
      else if (categoryIdx === -1 && /source|income source|nguồn|category|danh mục|hạng mục|loại/i.test(h)) categoryIdx = c;
      else if (itemIdx === -1 && /desc|description|item|mô tả|nội dung|khoản|chi tiết/i.test(h)) itemIdx = c;
      else if (noteIdx === -1 && /note|ghi chú/i.test(h)) noteIdx = c;
    }
    if (dateIdx === -1) dateIdx = 0;
    if (categoryIdx === -1) categoryIdx = 1;
    if (itemIdx === -1) itemIdx = 2;
    if (amountIdx === -1) amountIdx = 3;
  }

  const records: TransactionRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = dateIdx < row.length ? (row[dateIdx] || '').trim() : '';
    const rawCategory = categoryIdx !== -1 && categoryIdx < row.length ? (row[categoryIdx] || '').trim() : '';
    const rawItem = itemIdx !== -1 && itemIdx < row.length ? (row[itemIdx] || '').trim() : '';
    const rawAmount = amountIdx !== -1 && amountIdx < row.length ? (row[amountIdx] || '').trim() : '';
    const rawBeCorp = beCorpIdx !== -1 && beCorpIdx < row.length ? (row[beCorpIdx] || '').trim() : '';
    const rawCredit = creditIdx !== -1 && creditIdx < row.length ? (row[creditIdx] || '').trim() : '';
    const rawNote = noteIdx !== -1 && noteIdx < row.length ? (row[noteIdx] || '').trim() : '';

    if (!rawDate && !rawCategory && !rawItem && !rawAmount) continue;
    if (rawDate.toLowerCase() === 'purchase date' || rawDate.toLowerCase() === 'date') continue;

    const parsedDate = parseDateString(rawDate);
    const amount = parseSheetNumber(rawAmount);
    const beCorp = parseSheetNumber(rawBeCorp);
    const credit = parseSheetNumber(rawCredit);

    if (!rawItem && amount === 0 && beCorp === 0 && credit === 0 && !rawNote && !rawCategory) {
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
      purchaseItem: rawItem || (sheetType === 'Income' ? rawCategory || 'Khoản thu' : '(Không ghi nội dung)'),
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
  const range = `'${tabName.replace(/'/g, "''")}'!A1:M120`;
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
    sheetType?: SheetTabType;
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
  const isIncome = record.sheetType === 'Income' || tabName.toLowerCase().includes('income');

  let rowValues: string[];
  let range: string;

  if (isIncome) {
    // Income tab columns: Date (A), Income Source (B), Description (C), Income Amount (D), Month (E)
    rowValues = [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      formatNumberForSheet(record.amount, true),
      '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)'
    ];
    range = `'${tabName.replace(/'/g, "''")}'!A:E`;
  } else {
    // Expenses tab columns: Date (A), Category (B), Purchase Item (C), Amount (D), BE Corp (E), Credit (F), Note (G)
    rowValues = [
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
    range = `'${tabName.replace(/'/g, "''")}'!A:G`;
  }
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

export async function fetchBudgetTransfersSheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<BudgetTransferRecord[]> {
  const range = `'${tabName.replace(/'/g, "''")}'!A2:F`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      return [];
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Không thể đọc bảng ${tabName}: ${errBody?.error?.message || res.status}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const records: BudgetTransferRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[0]?.trim();
    const rawFrom = row[1]?.trim() || '';
    const rawTo = row[2]?.trim() || '';
    const rawAmount = row[3];
    const rawDesc = row[4]?.trim() || '';

    if (!rawDate && !rawFrom && !rawTo && !rawAmount) continue;

    const amount = parseSheetNumber(rawAmount);
    const parsedDate = parseDateString(rawDate);

    records.push({
      id: `bt-${i + 2}-${rawDate || 'undated'}`,
      rowIndex: i + 2,
      date: rawDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      fromCategory: rawFrom,
      toCategory: rawTo,
      amount,
      description: rawDesc,
      source: 'google_sheet',
      syncedToSheet: true,
    });
  }

  return records;
}

export async function appendBudgetTransferToSheet(
  spreadsheetId: string,
  tabName: string,
  transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
  },
  accessToken: string
): Promise<void> {
  const rowValues = [
    transfer.date,
    transfer.fromCategory,
    transfer.toCategory,
    formatNumberForSheet(transfer.amount, true),
    transfer.description,
    '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)'
  ];
  const range = `'${tabName.replace(/'/g, "''")}'!A:F`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

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

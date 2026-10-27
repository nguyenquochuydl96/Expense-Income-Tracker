import { ItemSuggestion, TransactionRecord } from '../types/finance';

/**
 * Parses a number formatted like "6,548,000", "-4,100,000", "193,600", or "79000"
 */
export function parseSheetNumber(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const cleaned = raw.toString().replace(/,/g, '').replace(/\s+/g, '').replace(/₫|đ|VND/gi, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a number with thousand commas to match the user's Google Sheet ("48,000")
 */
export function formatNumberForSheet(val: number, showZero = false): string {
  if (!val && !showZero) return '';
  return Math.round(val).toLocaleString('en-US');
}

/**
 * Formats a VND currency value for UI display
 */
export function formatCurrency(val: number, showSign = false): string {
  const absFormatted = Math.abs(Math.round(val)).toLocaleString('en-US');
  if (val < 0) return `-${absFormatted} ₫`;
  if (val > 0 && showSign) return `+${absFormatted} ₫`;
  return `${absFormatted} ₫`;
}

/**
 * Converts YYYY-MM-DD input value into M/D/YYYY string matching the Google Sheet ("10/25/2026" or "4/1/2026")
 */
export function isoToSheetDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year}`;
}

/**
 * Parses M/D/YYYY (as used throughout the attached sheet: 4/1/2026 -> 4/30/2026 -> 10/25/2026)
 * into isoDate (YYYY-MM-DD), monthKey (YYYY-MM), and displayDate (M/D/YYYY).
 */
const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function parseDateString(rawDate: string): {
  isoDate: string;
  monthKey: string;
  displayDate: string;
  year: number;
  month: number;
  day: number;
} {
  const trimmed = (rawDate || '').trim();

  // 1. Match English Month Name (e.g. "April 2026", "October 2026", "October")
  const engMatch = trimmed.match(/^([a-zA-Z]+)(?:[\s,/-]+(\d{4}))?$/);
  if (engMatch && ENGLISH_MONTHS[engMatch[1].toLowerCase()]) {
    const m = ENGLISH_MONTHS[engMatch[1].toLowerCase()];
    const y = engMatch[2] ? parseInt(engMatch[2], 10) : 2026;
    const mm = String(m).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 2. Match Vietnamese Month (e.g. "Tháng 10/2026", "Tháng 4", "T10/2026", "T4")
  const vnMatch = trimmed.match(/^t(?:háng)?\s*(\d{1,2})(?:[\/\s-]+(\d{4}))?$/i);
  if (vnMatch) {
    const m = parseInt(vnMatch[1], 10);
    const y = vnMatch[2] ? parseInt(vnMatch[2], 10) : 2026;
    const mm = String(Math.max(1, Math.min(12, m))).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 3. Match M/D/YYYY or M/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    let m = parseInt(slashParts[0], 10);
    let d = parseInt(slashParts[1], 10);
    let y = parseInt(slashParts[2], 10);
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    const dd = String(Math.max(1, Math.min(31, d || 1))).padStart(2, '0');
    const yyyy = y || 2026;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      monthKey: `${yyyy}-${mm}`,
      displayDate: `${m}/${d}/${yyyy}`,
      year: yyyy,
      month: m,
      day: d,
    };
  }

  if (slashParts.length === 2) {
    let m = parseInt(slashParts[0], 10);
    let y = parseInt(slashParts[1], 10);
    if (m > 100 && y <= 12) {
      const temp = m;
      m = y;
      y = temp;
    }
    if (y < 100) y += 2000;
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 4. Match YYYY-MM-DD or YYYY-MM
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const y = parseInt(dashParts[0], 10) || 2026;
    const m = parseInt(dashParts[1], 10) || 10;
    const d = parseInt(dashParts[2], 10) || 1;
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-${dd}`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/${d}/${y}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (dashParts.length === 2 && dashParts[0].length === 4) {
    const y = parseInt(dashParts[0], 10) || 2026;
    const m = parseInt(dashParts[1], 10) || 10;
    const mm = String(m).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  return {
    isoDate: '2026-10-25',
    monthKey: '2026-10',
    displayDate: '10/25/2026',
    year: 2026,
    month: 10,
    day: 25,
  };
}

export function parseRawCsvToGrid(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function parseAttachedExpenseCsv(csvText: string): TransactionRecord[] {
  const rows = parseRawCsvToGrid(csvText);
  const records: TransactionRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = (row[0] || '').trim();
    const rawCategory = (row[1] || '').trim();
    const rawItem = (row[2] || '').trim().replace(/\s*\n\s*/g, ' — ');
    const rawAmount = (row[3] || '').trim();
    const rawBeCorp = (row[4] || '').trim();
    const rawCredit = (row[5] || '').trim();
    const rawNote = (row[6] || '').trim();

    if (!rawDate && !rawCategory && !rawItem && !rawAmount) continue;
    if (rawDate.toLowerCase() === 'purchase date') continue;

    const amount = parseSheetNumber(rawAmount);
    const beCorp = parseSheetNumber(rawBeCorp);
    const credit = parseSheetNumber(rawCredit);

    // Filter out trailing empty template rows at the end of the sheet (e.g. 10/25/2026 with no amount)
    if (amount === 0 && beCorp === 0 && credit === 0 && !rawNote) {
      continue;
    }

    const parsedDate = parseDateString(rawDate);

    records.push({
      id: `csv-Expenses-${i + 1}`,
      rowIndex: i + 1,
      sheetType: 'Expenses',
      purchaseDate: rawDate || parsedDate.displayDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: rawCategory || 'Khác',
      purchaseItem: rawItem || rawCategory || 'Giao dịch',
      amount,
      beCorp,
      credit,
      note: rawNote || undefined,
      source: 'attached_csv',
      syncedToSheet: true,
    });
  }

  return records;
}

/**
 * Builds frequency-sorted item suggestions from historical transactions
 * so typing "Cafe", "Cơm", "Bún", "Pate", "Cát mèo", etc. auto-fills category & typical amount.
 */
export function buildItemSuggestions(records: TransactionRecord[]): ItemSuggestion[] {
  const map = new Map<
    string,
    {
      item: string;
      category: string;
      lastAmount: number;
      count: number;
      beCorpCount: number;
      creditCount: number;
    }
  >();

  for (const rec of records) {
    if (!rec.purchaseItem || rec.purchaseItem.startsWith('(')) continue;
    const key = rec.purchaseItem.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (rec.amount > 0) existing.lastAmount = rec.amount;
      if (rec.beCorp > 0) existing.beCorpCount += 1;
      if (rec.credit > 0) existing.creditCount += 1;
    } else {
      map.set(key, {
        item: rec.purchaseItem.trim(),
        category: rec.category,
        lastAmount: rec.amount > 0 ? rec.amount : 0,
        count: 1,
        beCorpCount: rec.beCorp > 0 ? 1 : 0,
        creditCount: rec.credit > 0 ? 1 : 0,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      item: entry.item,
      category: entry.category,
      lastAmount: entry.lastAmount,
      count: entry.count,
      typicalBeCorp: entry.beCorpCount > entry.count / 2,
      typicalCredit: entry.creditCount > entry.count / 2,
    }));
}

export function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'ALL') return 'Tất cả các tháng (T4 – T10/2026)';
  const [year, month] = monthKey.split('-');
  return `Tháng ${parseInt(month, 10)}/${year}`;
}

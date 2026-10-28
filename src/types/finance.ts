export type SheetTabType = 'Expenses' | 'Income';

export interface TransactionRecord {
  id: string;
  rowIndex?: number;
  sheetType: SheetTabType;
  purchaseDate: string; // M/D/YYYY format as in Google Sheet, e.g. "10/25/2026"
  isoDate: string; // YYYY-MM-DD for sorting and cycle filtering
  monthKey: string; // YYYY-MM, e.g. "2026-10"
  category: string;
  purchaseItem: string;
  amount: number;
  beCorp: number;
  credit: number;
  note?: string;
  source: 'attached_csv' | 'google_sheet' | 'local_new';
  syncedToSheet?: boolean;
  syncing?: boolean; // true while background sync is in progress
}

export interface CheckTienSheetData {
  sheetName: string;
  formattedRows: string[][];
  formulaRows: string[][];
  detectedSummary?: {
    label: string;
    value: string;
    formula?: string;
  }[];
}

export interface BillingCycleConfig {
  beCorpCycleType: 'monthly' | 'custom_day' | 'custom_range';
  beCorpStartDay: number; // e.g., 1 or 26
  beCorpStartDate: string; // YYYY-MM-DD
  beCorpEndDate: string; // YYYY-MM-DD
  beCorpBudget: number;
  creditCycleType: 'statement_day' | 'monthly' | 'custom_range';
  creditStatementDay: number; // e.g., 15 or 20 or 25
  creditStartDate: string; // YYYY-MM-DD
  creditEndDate: string; // YYYY-MM-DD
  creditLimit: number;
}

export interface RealWorldAccount {
  id: string;
  name: string;
  owner: 'Heo' | 'Mèo' | 'Chung';
  type: 'bank' | 'cash' | 'ewallet' | 'receivable';
  balance: number;
  includedInReconcile: boolean;
  note?: string;
}

export interface ItemSuggestion {
  item: string;
  category: string;
  lastAmount: number;
  count: number;
  typicalBeCorp: boolean;
  typicalCredit: boolean;
}

export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Thuê nhà',
  'Hóa/Mỹ phẩm',
  'Thú cưng',
  'Giải trí Heo',
  'Giải trí Mèo',
  'Điện thoại/Xăng xe',
  'Tiết kiệm',
  'Quà tặng/Cưới hỏi',
  'Shopping',
  'Sức khỏe',
  'Du lịch',
  'Khác',
] as const;

export const INCOME_CATEGORIES = [
  'Lương Yes4All',
  'Lương BE',
  'Công đoàn Yes4All',
  'Công đoàn BE',
  'Chứng khoán',
  'Bán hàng',
  'Lương Heo',
  'Lương Mèo',
  'Khác',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Ăn uống': '#0D9488',         // Teal 600
  'Tiết kiệm': '#2563EB',       // Blue 600
  'Thuê nhà': '#4F46E5',        // Indigo 600
  'Quà tặng/Cưới hỏi': '#E11D48', // Rose 600
  'Giải trí Heo': '#D97706',    // Amber 600
  'Giải trí Mèo': '#9333EA',    // Purple 600
  'Hóa/Mỹ phẩm': '#DB2777',     // Pink 600
  'Thú cưng': '#EA580C',        // Orange 600
  'Shopping': '#0284C7',        // Sky 600
  'Điện thoại/Xăng xe': '#475569', // Slate 600
  'Du lịch': '#059669',         // Emerald 600
  'Sức khỏe': '#16A34A',        // Green 600
  'Khác': '#64748B',            // Slate 500
};

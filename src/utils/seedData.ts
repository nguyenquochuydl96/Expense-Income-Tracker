import { TransactionRecord, BudgetTransferRecord } from '../types/finance';

/**
 * Synthetic demo Income records used ONLY before connecting a live Google Sheet.
 * Contains zero real personal financial data. Automatically replaced on first sync.
 */
export const SEED_INCOME_RECORDS: TransactionRecord[] = [
  {
    id: 'demo-income-1',
    sheetType: 'Income',
    purchaseDate: '10/1/2026',
    isoDate: '2026-10-01',
    monthKey: '2026-10',
    category: 'Lương Heo',
    purchaseItem: 'Thu nhập mẫu 1 (Demo)',
    amount: 15000000,
    beCorp: 0,
    credit: 0,
    source: 'attached_csv',
    syncedToSheet: true,
  },
  {
    id: 'demo-income-2',
    sheetType: 'Income',
    purchaseDate: '10/1/2026',
    isoDate: '2026-10-01',
    monthKey: '2026-10',
    category: 'Lương Mèo',
    purchaseItem: 'Thu nhập mẫu 2 (Demo)',
    amount: 15000000,
    beCorp: 0,
    credit: 0,
    source: 'attached_csv',
    syncedToSheet: true,
  },
];

/**
 * Synthetic demo Budget Transfer records used ONLY before connecting a live Google Sheet.
 * Contains zero real personal financial data.
 */
export const SEED_BUDGET_TRANSFERS: BudgetTransferRecord[] = [
  {
    id: 'demo-bt-1',
    rowIndex: 2,
    date: '10/5/2026',
    isoDate: '2026-10-05',
    monthKey: '2026-10',
    fromCategory: 'Thu nhập riêng',
    toCategory: 'Du lịch',
    amount: 500000,
    description: 'Chuyển quỹ mẫu (Demo)',
    source: 'seed',
    syncedToSheet: true,
  },
];

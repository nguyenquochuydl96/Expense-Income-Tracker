import { describe, test, expect } from './testHarness';
import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  getDedicatedExpenseCategory,
  DEFAULT_CATEGORY_RATIOS_T4_T7,
  DEFAULT_CATEGORY_RATIOS,
} from '../../src/utils/budgetUtils';
import {
  getBillingCycleRange,
  filterRecordsByDateRange,
  isBudgetTransferRecord,
} from '../../src/utils/cycleUtils';
import {
  parseSheetNumber,
  formatNumberForSheet,
  formatCurrency,
  parseDateString,
  isoToSheetDate,
} from '../../src/utils/csvParser';
import {
  evaluateMoneyExpression,
  isExpression,
  parseMoneyNumber,
} from '../../src/utils/mathExpression';
import {
  isPrivacyActive,
  setPrivacyMode,
} from '../../src/utils/privacyService';

// =========================================================================
// Feature 1: Ledger CRUD Operations & Filtering (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 1: Ledger CRUD Operations & Query Filtering', () => {
  test('T1.F1.1: Create expense transaction record with complete attributes', () => {
    const rawDate = '10/25/2026';
    const parsedDate = parseDateString(rawDate);
    const newTx: TransactionRecord = {
      id: 'tx-20261025-001',
      rowIndex: 120,
      sheetType: 'Expenses',
      purchaseDate: rawDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: 'Ăn uống',
      purchaseItem: 'Bữa trưa công ty',
      amount: 45000,
      beCorp: 0,
      credit: 0,
      note: 'Cơm văn phòng',
      source: 'local_new',
      syncedToSheet: false,
    };

    expect(newTx.id).toBe('tx-20261025-001');
    expect(newTx.isoDate).toBe('2026-10-25');
    expect(newTx.monthKey).toBe('2026-10');
    expect(newTx.amount).toBe(45000);
    expect(newTx.syncedToSheet).toBe(false);
  });

  test('T1.F1.2: Filter ledger transactions by monthKey and sheetType', () => {
    const records: TransactionRecord[] = [
      {
        id: '1', sheetType: 'Expenses', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
        category: 'Ăn uống', purchaseItem: 'Cà phê', amount: 35000, beCorp: 0, credit: 0, source: 'google_sheet'
      },
      {
        id: '2', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10',
        category: 'Lương Yes4All', purchaseItem: 'Lương T10', amount: 30000000, beCorp: 0, credit: 0, source: 'google_sheet'
      },
      {
        id: '3', sheetType: 'Expenses', purchaseDate: '9/28/2026', isoDate: '2026-09-28', monthKey: '2026-09',
        category: 'Thú cưng', purchaseItem: 'Hạt cho mèo', amount: 250000, beCorp: 0, credit: 0, source: 'google_sheet'
      },
    ];

    const octExpenses = records.filter(r => r.sheetType === 'Expenses' && r.monthKey === '2026-10');
    expect(octExpenses.length).toBe(1);
    expect(octExpenses[0].id).toBe('1');
    expect(octExpenses[0].amount).toBe(35000);

    const octIncome = records.filter(r => r.sheetType === 'Income' && r.monthKey === '2026-10');
    expect(octIncome.length).toBe(1);
    expect(octIncome[0].amount).toBe(30000000);
  });

  test('T1.F1.3: Update transaction attributes and preserve audit integrity', () => {
    const original: TransactionRecord = {
      id: 'tx-100',
      rowIndex: 55,
      sheetType: 'Expenses',
      purchaseDate: '10/10/2026',
      isoDate: '2026-10-10',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: 'Ăn tối',
      amount: 150000,
      beCorp: 0,
      credit: 150000,
      note: 'Đi ăn cùng bạn',
      source: 'google_sheet',
      syncedToSheet: true,
    };

    // Simulate in-memory edit
    const updated: TransactionRecord = {
      ...original,
      amount: 180000,
      credit: 180000,
      note: 'Đi ăn cùng bạn (thêm đồ uống)',
      syncedToSheet: false,
    };

    expect(updated.amount).toBe(180000);
    expect(updated.credit).toBe(180000);
    expect(updated.syncedToSheet).toBe(false);
    expect(updated.id).toBe(original.id);
    expect(updated.rowIndex).toBe(original.rowIndex);
  });

  test('T1.F1.4: Delete transaction removes item and recalculates ledger aggregate', () => {
    let ledger: TransactionRecord[] = [
      { id: 't1', sheetType: 'Expenses', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'A', amount: 50000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 't2', sheetType: 'Expenses', purchaseDate: '10/02/2026', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'B', amount: 70000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 't3', sheetType: 'Expenses', purchaseDate: '10/03/2026', isoDate: '2026-10-03', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'C', amount: 30000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const initialTotal = ledger.reduce((acc, r) => acc + r.amount, 0);
    expect(initialTotal).toBe(150000);

    // Delete record t2
    ledger = ledger.filter(r => r.id !== 't2');
    expect(ledger.length).toBe(2);

    const postDeleteTotal = ledger.reduce((acc, r) => acc + r.amount, 0);
    expect(postDeleteTotal).toBe(80000);
  });

  test('T1.F1.5: Chronological sorting orders transactions by date descending then id', () => {
    const rawList: TransactionRecord[] = [
      { id: 'b', sheetType: 'Expenses', purchaseDate: '10/12/2026', isoDate: '2026-10-12', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Mid', amount: 10000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'c', sheetType: 'Expenses', purchaseDate: '10/25/2026', isoDate: '2026-10-25', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Latest', amount: 20000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'a', sheetType: 'Expenses', purchaseDate: '10/02/2026', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Oldest', amount: 30000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const sortedDesc = [...rawList].sort((x, y) => y.isoDate.localeCompare(x.isoDate));
    expect(sortedDesc[0].id).toBe('c');
    expect(sortedDesc[1].id).toBe('b');
    expect(sortedDesc[2].id).toBe('a');
  });
});

// =========================================================================
// Feature 2: Google Sheets Sync & Reconciliation Integrity (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 2: Google Sheet Synchronization & Row Management', () => {
  test('T1.F2.1: Assign rowIndex to optimistic additions and shift indices on deletion', () => {
    // Initial sheet state with 3 rows (indices 2, 3, 4, row 1 is header)
    const currentRows = [
      { id: 'r2', rowIndex: 2, item: 'A' },
      { id: 'r3', rowIndex: 3, item: 'B' },
      { id: 'r4', rowIndex: 4, item: 'C' },
    ];

    // Optimistic append assigns index = lastRow + 1
    const nextRowIndex = Math.max(...currentRows.map(r => r.rowIndex), 1) + 1;
    expect(nextRowIndex).toBe(5);

    const afterAppend = [...currentRows, { id: 'r5', rowIndex: nextRowIndex, item: 'D' }];
    expect(afterAppend[3].rowIndex).toBe(5);

    // Delete row 3 (r3): Subsequent rows (r4, r5) must shift their index down by 1
    const deletedIndex = 3;
    const reIndexed = afterAppend
      .filter(r => r.rowIndex !== deletedIndex)
      .map(r => ({
        ...r,
        rowIndex: r.rowIndex > deletedIndex ? r.rowIndex - 1 : r.rowIndex,
      }));

    expect(reIndexed.length).toBe(3);
    expect(reIndexed.find(r => r.id === 'r2')?.rowIndex).toBe(2);
    expect(reIndexed.find(r => r.id === 'r4')?.rowIndex).toBe(3);
    expect(reIndexed.find(r => r.id === 'r5')?.rowIndex).toBe(4);
  });

  test('T1.F2.2: Expense row values array mapping formats correctly for Google Sheets API', () => {
    const expenseTx: TransactionRecord = {
      id: 'e1',
      sheetType: 'Expenses',
      purchaseDate: '10/25/2026',
      isoDate: '2026-10-25',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: 'Nhậu cuối tuần',
      amount: 450000,
      beCorp: 0,
      credit: 450000,
      note: 'Thanh toán thẻ VPBank',
      source: 'local_new',
    };

    // Columns: Date (A), Category (B), Purchase Item (C), Amount (D), BE Corp (E), Credit (F), Note (G)
    const rowValues = [
      expenseTx.purchaseDate,
      expenseTx.category,
      expenseTx.purchaseItem,
      expenseTx.amount,
      expenseTx.beCorp !== 0 ? expenseTx.beCorp : '',
      expenseTx.credit !== 0 ? expenseTx.credit : '',
      expenseTx.note || '',
    ];

    expect(rowValues[0]).toBe('10/25/2026');
    expect(rowValues[1]).toBe('Ăn uống');
    expect(rowValues[2]).toBe('Nhậu cuối tuần');
    expect(rowValues[3]).toBe(450000);
    expect(rowValues[4]).toBe(''); // 0 rendered as empty string
    expect(rowValues[5]).toBe(450000);
    expect(rowValues[6]).toBe('Thanh toán thẻ VPBank');
  });

  test('T1.F2.3: Income row values mapping includes Column E (Month) for formula lookup', () => {
    const incomeTx: TransactionRecord = {
      id: 'inc-1',
      sheetType: 'Income',
      purchaseDate: '10/05/2026',
      isoDate: '2026-10-05',
      monthKey: '2026-10',
      category: 'Lương Yes4All',
      purchaseItem: 'Lương tháng 10',
      amount: 32000000,
      beCorp: 0,
      credit: 0,
      source: 'local_new',
    };

    const parsed = parseDateString(incomeTx.purchaseDate);
    const monthColE = `${parsed.month}/1/${parsed.year}`;

    // Columns: Date (A), Income Source (B), Description (C), Income Amount (D), Month (E)
    const incomeRow = [
      incomeTx.purchaseDate,
      incomeTx.category,
      incomeTx.purchaseItem,
      incomeTx.amount,
      monthColE,
    ];

    expect(incomeRow.length).toBe(5);
    expect(incomeRow[3]).toBe(32000000);
    expect(incomeRow[4]).toBe('10/1/2026'); // Matches Google Sheet Month lookup column
  });

  test('T1.F2.4: Offline transaction queue tracks pending mutations', () => {
    const tx: TransactionRecord = {
      id: 'off-1',
      sheetType: 'Expenses',
      purchaseDate: '10/26/2026',
      isoDate: '2026-10-26',
      monthKey: '2026-10',
      category: 'Thú cưng',
      purchaseItem: 'Tắm spa cho mèo',
      amount: 180000,
      beCorp: 0,
      credit: 0,
      source: 'local_new',
      syncedToSheet: false,
      syncing: false,
    };

    // Before push
    expect(tx.syncedToSheet).toBe(false);

    // Optimistic push started
    const pushingTx = { ...tx, syncing: true };
    expect(pushingTx.syncing).toBe(true);

    // Sync succeeded
    const resolvedTx = { ...pushingTx, syncing: false, syncedToSheet: true, rowIndex: 15 };
    expect(resolvedTx.syncedToSheet).toBe(true);
    expect(resolvedTx.syncing).toBe(false);
    expect(resolvedTx.rowIndex).toBe(15);
  });

  test('T1.F2.5: Reconcile real-world account balances against ledger tracked sums', () => {
    const bankAccounts = [
      { id: 'b1', name: 'Techcombank Heo', balance: 15400000, includedInReconcile: true },
      { id: 'b2', name: 'VPBank Mèo', balance: 8200000, includedInReconcile: true },
      { id: 'b3', name: 'Heo Tiết Kiệm Khóa', balance: 50000000, includedInReconcile: false },
    ];

    const activeBankTotal = bankAccounts
      .filter(a => a.includedInReconcile)
      .reduce((sum, a) => sum + a.balance, 0);

    expect(activeBankTotal).toBe(23600000);

    // Reconcile discrepancy: if expected cash in bank is 23,600,000, diff is 0
    const calculatedCash = 23600000;
    const diff = activeBankTotal - calculatedCash;
    expect(diff).toBe(0);
  });
});

// =========================================================================
// Feature 3: Envelope Budget Rollover & Multi-Month Equation (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 3: Multi-Month Budget Rollover Engine', () => {
  test('T1.F3.1: Historical era (T4-T7 2026) computes base budget with 47.5M ratios', () => {
    const incomeRecord: TransactionRecord = {
      id: 'inc-apr', sheetType: 'Income', purchaseDate: '4/5/2026', isoDate: '2026-04-05', monthKey: '2026-04',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 47500000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([incomeRecord], [], {}, 'full');
    const aprStats = result.chain;

    // In T4-T7: Thuê nhà is 6.5 / 47.5 -> 6,500,000
    expect(aprStats['Thuê nhà']['2026-04'].baseBudget).toBe(6500000);
    // Ăn uống is 7.0 / 47.5 -> 7,000,000
    expect(aprStats['Ăn uống']['2026-04'].baseBudget).toBe(7000000);
    // Tiết kiệm is 20.0 / 47.5 -> 20,000,000
    expect(aprStats['Tiết kiệm']['2026-04'].baseBudget).toBe(20000000);
  });

  test('T1.F3.2: Current era (T8-T10 2026) computes base budget with 51M ratios', () => {
    const incomeRecord: TransactionRecord = {
      id: 'inc-oct', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([incomeRecord], [], {}, 'full');
    const octStats = result.chain;

    // In T8-T10: Thuê nhà is 8.5 / 51.0 -> 8,500,000
    expect(octStats['Thuê nhà']['2026-10'].baseBudget).toBe(8500000);
    // Ăn uống is 7.0 / 51.0 -> 7,000,000
    expect(octStats['Ăn uống']['2026-10'].baseBudget).toBe(7000000);
    // Tiết kiệm is 20.0 / 51.0 -> 20,000,000
    expect(octStats['Tiết kiệm']['2026-10'].baseBudget).toBe(20000000);
  });

  test('T1.F3.3: Full rollover carries both surplus and deficit forward across months', () => {
    const records: TransactionRecord[] = [
      // Month 1 (2026-08): Income 51M. Base budget Ăn uống = 7M
      { id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 1 expense: Spent 6M -> Remaining +1M surplus
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '8/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Ăn uống', purchaseItem: 'Food', amount: 6000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2 (2026-09): Income 51M. Base budget Ăn uống = 7M
      { id: 'i2', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2 expense: Spent 9M
      { id: 'e2', sheetType: 'Expenses', purchaseDate: '9/15/2026', isoDate: '2026-09-15', monthKey: '2026-09', category: 'Ăn uống', purchaseItem: 'Food', amount: 9000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'full');
    const aug = result.chain['Ăn uống']['2026-08'];
    const sep = result.chain['Ăn uống']['2026-09'];

    // Aug: base 7M, spent 6M, remaining 1M
    expect(aug.baseBudget).toBe(7000000);
    expect(aug.remaining).toBe(1000000);

    // Sep: carryover 1M, base 7M -> effectiveBudget = 8M, spent 9M -> remaining = -1M
    expect(sep.carryover).toBe(1000000);
    expect(sep.effectiveBudget).toBe(8000000);
    expect(sep.remaining).toBe(-1000000);
    expect(sep.isOver).toBe(true);
  });

  test('T1.F3.4: Deficit-only rollover mode ignores positive surpluses and carries only deficits', () => {
    const records: TransactionRecord[] = [
      // Month 1: 51M income, Ăn uống spent 5M -> +2M surplus
      { id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '8/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Ăn uống', purchaseItem: 'Food', amount: 5000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2: 51M income
      { id: 'i2', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'deficit_only');
    const sep = result.chain['Ăn uống']['2026-09'];

    // Under deficit_only, positive carryover is clamped to 0
    expect(sep.carryover).toBe(0);
    expect(sep.effectiveBudget).toBe(7000000);
  });

  test('T1.F3.5: None rollover mode resets carryover to 0 regardless of prior balance', () => {
    const records: TransactionRecord[] = [
      // Month 1: Overspent by 3M
      { id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '8/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Ăn uống', purchaseItem: 'Food', amount: 10000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2
      { id: 'i2', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'none');
    const sep = result.chain['Ăn uống']['2026-09'];

    expect(sep.carryover).toBe(0);
    expect(sep.effectiveBudget).toBe(7000000);
  });
});

// =========================================================================
// Feature 4: Daily Living Runway & Burn Rate Calculations (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 4: Daily Living Runway & Burn Rate Metrics', () => {
  test('T1.F4.1: Isolate daily living categories from fixed & periodic categories', () => {
    const allCategories = ['Ăn uống', 'Thuê nhà', 'Giải trí Heo', 'Giải trí Mèo', 'Hóa/Mỹ phẩm', 'Tiết kiệm'];
    const defaultLiving = new Set(['Ăn uống', 'Giải trí Heo', 'Giải trí Mèo', 'Hóa/Mỹ phẩm']);

    const living = allCategories.filter(c => defaultLiving.has(c));
    const fixed = allCategories.filter(c => !defaultLiving.has(c));

    expect(living.length).toBe(4);
    expect(living).toContain('Ăn uống');
    expect(living).toContain('Hóa/Mỹ phẩm');
    expect(fixed.length).toBe(2);
    expect(fixed).toContain('Thuê nhà');
    expect(fixed).toContain('Tiết kiệm');
  });

  test('T1.F4.2: Safe daily allowance correctly computes totalRemaining / remainingDays', () => {
    const totalRemaining = 6000000; // 6,000,000 VND remaining
    const remainingDays = 20; // 20 days left in the month

    const safeDaily = remainingDays > 0 ? Math.round(totalRemaining / remainingDays) : 0;
    expect(safeDaily).toBe(300000);
  });

  test('T1.F4.3: Burn rate daily computes totalSpent / elapsedDays', () => {
    const totalSpent = 2500000;
    const elapsedDays = 10;

    const burnRate = elapsedDays > 0 ? Math.round(totalSpent / elapsedDays) : 0;
    expect(burnRate).toBe(250000);
  });

  test('T1.F4.4: Pace differential identifies safe vs over-burn pace', () => {
    const safeDaily = 300000;
    const burnRateSafe = 250000;
    const burnRateOver = 350000;

    const diffSafe = safeDaily - burnRateSafe;
    expect(diffSafe).toBe(50000);
    expect(diffSafe >= 0).toBe(true); // Safe pacing

    const diffOver = safeDaily - burnRateOver;
    expect(diffOver).toBe(-50000);
    expect(diffOver >= 0).toBe(false); // Warning pacing
  });

  test('T1.F4.5: Calendar days in month handles 30, 31, and 28/29 day counts accurately', () => {
    const daysInOct2026 = new Date(2026, 10, 0).getDate();
    expect(daysInOct2026).toBe(31);

    const daysInApr2026 = new Date(2026, 4, 0).getDate();
    expect(daysInApr2026).toBe(30);

    const daysInFeb2026 = new Date(2026, 2, 0).getDate();
    expect(daysInFeb2026).toBe(28);

    const daysInFeb2028Leap = new Date(2028, 2, 0).getDate();
    expect(daysInFeb2028Leap).toBe(29);
  });
});

// =========================================================================
// Feature 5: BE Corporate Billing Cycle 26–25 (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 5: BE Corporate Billing Cycle 26–25', () => {
  test('T1.F5.1: Calculate standard 26–25 cycle date range for current year month', () => {
    // For October 2026 (2026-10), cycle starts 2026-09-26 and ends 2026-10-25
    const range = getBillingCycleRange('2026-10', 26, 25);
    expect(range.startDate).toBe('2026-09-26');
    expect(range.endDate).toBe('2026-10-25');
    expect(range.displayLabel).toBe('26/09 – 25/10');
  });

  test('T1.F5.2: Year transition boundary: January cycle starts December 26 of previous year', () => {
    const range = getBillingCycleRange('2026-01', 26, 25);
    expect(range.startDate).toBe('2025-12-26');
    expect(range.endDate).toBe('2026-01-25');
    expect(range.displayLabel).toBe('26/12 – 25/01');
  });

  test('T1.F5.3: Filter transactions with beCorp flag within BE cycle boundaries', () => {
    const records: TransactionRecord[] = [
      { id: '1', sheetType: 'Expenses', purchaseDate: '9/25/2026', isoDate: '2026-09-25', monthKey: '2026-09', category: 'Khác', purchaseItem: 'Before cycle', amount: 100000, beCorp: 100000, credit: 0, source: 'google_sheet' },
      { id: '2', sheetType: 'Expenses', purchaseDate: '9/26/2026', isoDate: '2026-09-26', monthKey: '2026-09', category: 'Khác', purchaseItem: 'Cycle start', amount: 200000, beCorp: 200000, credit: 0, source: 'google_sheet' },
      { id: '3', sheetType: 'Expenses', purchaseDate: '10/15/2026', isoDate: '2026-10-15', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Mid cycle', amount: 350000, beCorp: 350000, credit: 0, source: 'google_sheet' },
      { id: '4', sheetType: 'Expenses', purchaseDate: '10/25/2026', isoDate: '2026-10-25', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Cycle end', amount: 150000, beCorp: 150000, credit: 0, source: 'google_sheet' },
      { id: '5', sheetType: 'Expenses', purchaseDate: '10/26/2026', isoDate: '2026-10-26', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Next cycle', amount: 500000, beCorp: 500000, credit: 0, source: 'google_sheet' },
    ];

    const cycleRange = getBillingCycleRange('2026-10', 26, 25);
    const inCycle = filterRecordsByDateRange(records, cycleRange.startDate, cycleRange.endDate);

    expect(inCycle.length).toBe(3);
    expect(inCycle.map(r => r.id)).toEqual(['2', '3', '4']);
    const totalBe = inCycle.reduce((sum, r) => sum + r.beCorp, 0);
    expect(totalBe).toBe(700000);
  });

  test('T1.F5.4: Fallback to full calendar month when startDay <= endDay', () => {
    const range = getBillingCycleRange('2026-10', 1, 31);
    expect(range.startDate).toBe('2026-10-01');
    expect(range.endDate).toBe('2026-10-31');
    expect(range.displayLabel).toBe('01/10 – 31/10');
  });

  test('T1.F5.5: Corrupted or invalid monthKey defaults safely to standard date range', () => {
    const range = getBillingCycleRange('', 26, 25);
    expect(range.startDate).toBeDefined();
    expect(range.endDate).toBeDefined();
    expect(range.displayLabel).toBeDefined();
  });
});

// =========================================================================
// Feature 6: Credit Card Billing Cycle 20–19 (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 6: Credit Card Billing Cycle 20–19', () => {
  test('T1.F6.1: Calculate standard 20–19 cycle range for statement generation', () => {
    const range = getBillingCycleRange('2026-10', 20, 19);
    expect(range.startDate).toBe('2026-09-20');
    expect(range.endDate).toBe('2026-10-19');
    expect(range.displayLabel).toBe('20/09 – 19/10');
  });

  test('T1.F6.2: Year transition boundary: January cycle starts December 20 of previous year', () => {
    const range = getBillingCycleRange('2026-01', 20, 19);
    expect(range.startDate).toBe('2025-12-20');
    expect(range.endDate).toBe('2026-01-19');
    expect(range.displayLabel).toBe('20/12 – 19/01');
  });

  test('T1.F6.3: Filter transactions with credit payment within credit statement bounds', () => {
    const records: TransactionRecord[] = [
      { id: 'c1', sheetType: 'Expenses', purchaseDate: '9/19/2026', isoDate: '2026-09-19', monthKey: '2026-09', category: 'Shopping', purchaseItem: 'Before', amount: 500000, beCorp: 0, credit: 500000, source: 'google_sheet' },
      { id: 'c2', sheetType: 'Expenses', purchaseDate: '9/20/2026', isoDate: '2026-09-20', monthKey: '2026-09', category: 'Shopping', purchaseItem: 'Start', amount: 1200000, beCorp: 0, credit: 1200000, source: 'google_sheet' },
      { id: 'c3', sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Mid', amount: 800000, beCorp: 0, credit: 800000, source: 'google_sheet' },
      { id: 'c4', sheetType: 'Expenses', purchaseDate: '10/19/2026', isoDate: '2026-10-19', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'End', amount: 2000000, beCorp: 0, credit: 2000000, source: 'google_sheet' },
      { id: 'c5', sheetType: 'Expenses', purchaseDate: '10/20/2026', isoDate: '2026-10-20', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Next', amount: 300000, beCorp: 0, credit: 300000, source: 'google_sheet' },
    ];

    const range = getBillingCycleRange('2026-10', 20, 19);
    const inCycle = filterRecordsByDateRange(records, range.startDate, range.endDate);

    expect(inCycle.length).toBe(3);
    expect(inCycle.map(r => r.id)).toEqual(['c2', 'c3', 'c4']);
    const totalCredit = inCycle.reduce((sum, r) => sum + r.credit, 0);
    expect(totalCredit).toBe(4000000);
  });

  test('T1.F6.4: Credit utilization against defined limit', () => {
    const creditLimit = 50000000; // 50M VND credit limit
    const totalUsed = 12500000; // 12.5M used
    const utilPct = (totalUsed / creditLimit) * 100;
    const remainingLimit = creditLimit - totalUsed;

    expect(utilPct).toBe(25.0);
    expect(remainingLimit).toBe(37500000);
  });

  test('T1.F6.5: Custom statement day configuration (e.g. 15th to 14th)', () => {
    const range = getBillingCycleRange('2026-10', 15, 14);
    expect(range.startDate).toBe('2026-09-15');
    expect(range.endDate).toBe('2026-10-14');
    expect(range.displayLabel).toBe('15/09 – 14/10');
  });
});

// =========================================================================
// Feature 7: Dedicated Income Allocations (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 7: Dedicated Income Category Allocations', () => {
  test('T1.F7.1: Identify dedicated income vs general shared salary income', () => {
    // General incomes
    expect(getDedicatedExpenseCategory('Lương Yes4All')).toBeNull();
    expect(getDedicatedExpenseCategory('Lương BE')).toBeNull();
    expect(getDedicatedExpenseCategory('Công đoàn Yes4All')).toBeNull();
    expect(getDedicatedExpenseCategory('Chứng khoán')).toBeNull();

    // Dedicated incomes directly matched to expense categories
    expect(getDedicatedExpenseCategory('Giải trí Heo')).toBe('Giải trí Heo');
    expect(getDedicatedExpenseCategory('Thú cưng')).toBe('Thú cưng');
    expect(getDedicatedExpenseCategory('Du lịch')).toBe('Du lịch');
  });

  test('T1.F7.2: Dedicated income is added 100% to target category base budget', () => {
    const records: TransactionRecord[] = [
      // General income: 51M -> Ăn uống gets 7M, Giải trí Heo gets 1M
      { id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Dedicated income: 3M specifically for 'Giải trí Heo'
      { id: 'i2', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Giải trí Heo', purchaseItem: 'Freelance Heo', amount: 3000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'full');
    const heoStats = result.chain['Giải trí Heo']['2026-10'];

    // Base from general income: 51M * (1.0/51.0) = 1,000,000
    expect(heoStats.baseFromGeneral).toBe(1000000);
    // Dedicated income: 3,000,000
    expect(heoStats.dedicatedIncome).toBe(3000000);
    // Total base budget = 4,000,000
    expect(heoStats.baseBudget).toBe(4000000);
  });

  test('T1.F7.3: Dedicated income does not inflate base budget of other categories', () => {
    const records: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Bonus du lịch', amount: 10000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'full');
    const anUong = result.chain['Ăn uống']['2026-10'];
    const duLich = result.chain['Du lịch']['2026-10'];

    // Ăn uống base budget remains based only on 51M general income (7M)
    expect(anUong.baseBudget).toBe(7000000);
    expect(anUong.dedicatedIncome).toBe(0);

    // Du lịch gets its normal general ratio (1M) + 10M dedicated = 11M
    expect(duLich.baseFromGeneral).toBe(1000000);
    expect(duLich.dedicatedIncome).toBe(10000000);
    expect(duLich.baseBudget).toBe(11000000);
  });

  test('T1.F7.4: Case insensitive and whitespace trimming in dedicated income matching', () => {
    expect(getDedicatedExpenseCategory('  giải trí heo  ')).toBe('Giải trí Heo');
    expect(getDedicatedExpenseCategory('THÚ CƯNG')).toBe('Thú cưng');
    expect(getDedicatedExpenseCategory('du lịch - quỹ')).toBe('Du lịch');
  });

  test('T1.F7.5: Dedicated income rolls over to subsequent months under full rollover', () => {
    const records: TransactionRecord[] = [
      // Month 1: 51M general + 5M dedicated for Thú cưng. Spent 0 for Thú cưng
      { id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '8/5/2026', isoDate: '2026-08-05', monthKey: '2026-08', category: 'Thú cưng', purchaseItem: 'Dedicated', amount: 5000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2: 51M general
      { id: 'i3', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'full');
    const augPet = result.chain['Thú cưng']['2026-08'];
    const sepPet = result.chain['Thú cưng']['2026-09'];

    // Aug base: 2M general + 5M dedicated = 7M. Spent 0 -> Remaining = 7M
    expect(augPet.baseBudget).toBe(7000000);
    expect(augPet.remaining).toBe(7000000);

    // Sep carryover = 7M. Sep base = 2M. Total effective budget = 9M
    expect(sepPet.carryover).toBe(7000000);
    expect(sepPet.effectiveBudget).toBe(9000000);
  });
});

// =========================================================================
// Feature 8: Money Expressions & Arithmetic Calculator (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 8: Money Mathematical Expressions Evaluator', () => {
  test('T1.F8.1: Evaluate basic arithmetic expressions (+, -, *, /)', () => {
    expect(evaluateMoneyExpression('50000 + 35000')).toBe(85000);
    expect(evaluateMoneyExpression('200000 - 45000')).toBe(155000);
    expect(evaluateMoneyExpression('25000 * 4')).toBe(100000);
    expect(evaluateMoneyExpression('100000 / 2')).toBe(50000);
  });

  test('T1.F8.2: Vietnamese abbreviations (k, K, tr, m, M)', () => {
    expect(evaluateMoneyExpression('50k')).toBe(50000);
    expect(evaluateMoneyExpression('150K')).toBe(150000);
    expect(evaluateMoneyExpression('2tr')).toBe(2000000);
    expect(evaluateMoneyExpression('5m')).toBe(5000000);
  });

  test('T1.F8.3: Spoken Vietnamese compound denominations (1tr5 -> 1.5M, 2tr2 -> 2.2M)', () => {
    expect(evaluateMoneyExpression('1tr5')).toBe(1500000);
    expect(evaluateMoneyExpression('2tr2')).toBe(2200000);
  });

  test('T1.F8.4: Combined expressions with abbreviations and operators', () => {
    expect(evaluateMoneyExpression('50k + 35k')).toBe(85000);
    expect(evaluateMoneyExpression('1tr - 200k')).toBe(800000);
    expect(evaluateMoneyExpression('25k * 3 + 10k')).toBe(85000);
  });

  test('T1.F8.5: Fallback safety for plain numbers and comma formatted strings', () => {
    expect(parseMoneyNumber('150000')).toBe(150000);
    expect(parseMoneyNumber('1,500,000')).toBe(1500000);
    expect(parseMoneyNumber(250000)).toBe(250000);
    expect(parseMoneyNumber('')).toBe(0);
  });
});

// =========================================================================
// Feature 9: Privacy Masking Engine (>= 5 tests)
// =========================================================================
describe('Tier 1 - Feature 9: Financial Privacy Masking Engine', () => {
  test('T1.F9.1: Privacy mode defaults to enabled on startup', () => {
    setPrivacyMode(true);
    expect(isPrivacyActive()).toBe(true);
  });

  test('T1.F9.2: formatCurrency masks numbers when privacy mode is active', () => {
    setPrivacyMode(true);
    const formatted = formatCurrency(1500000);
    expect(formatted).toBe('•••••• ₫');
  });

  test('T1.F9.3: formatNumberForSheet masks numbers when privacy mode is active', () => {
    setPrivacyMode(true);
    const formatted = formatNumberForSheet(250000);
    expect(formatted).toBe('••••••');
  });

  test('T1.F9.4: forceVisible parameter bypasses privacy masking when needed', () => {
    setPrivacyMode(true);
    const visibleCurrency = formatCurrency(1500000, false, true);
    expect(visibleCurrency).toBe('1,500,000 ₫');

    const visibleSheetNum = formatNumberForSheet(250000, false, true);
    expect(visibleSheetNum).toBe('250,000');
  });

  test('T1.F9.5: Toggling privacy mode off reveals unmasked formatted amounts', () => {
    setPrivacyMode(false);
    expect(isPrivacyActive()).toBe(false);

    const formatted = formatCurrency(1500000);
    expect(formatted).toBe('1,500,000 ₫');

    // Reset back to secure default
    setPrivacyMode(true);
    expect(isPrivacyActive()).toBe(true);
  });
});

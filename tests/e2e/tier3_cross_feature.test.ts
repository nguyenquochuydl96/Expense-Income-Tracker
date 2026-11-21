import { describe, test, expect } from './testHarness';
import { TransactionRecord, BudgetTransferRecord } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  getDedicatedExpenseCategory,
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
} from '../../src/utils/csvParser';
import {
  evaluateMoneyExpression,
  parseMoneyNumber,
} from '../../src/utils/mathExpression';
import {
  isPrivacyActive,
  setPrivacyMode,
} from '../../src/utils/privacyService';

// =========================================================================
// Pairwise 1: Virtual Transfers + Multi-Month Rollover Chaining
// =========================================================================
describe('Tier 3 - Pairwise 1: Virtual Transfers + Multi-Month Rollover', () => {
  test('T3.P1.1: Virtual transfer moves budget between categories while preserving total net sum', () => {
    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    // Transfer 1,000,000 VND from "Tiết kiệm" to "Ăn uống"
    const transfer: BudgetTransferRecord = {
      id: 'bt-1',
      date: '10/15/2026',
      isoDate: '2026-10-15',
      monthKey: '2026-10',
      fromCategory: 'Tiết kiệm',
      toCategory: 'Ăn uống',
      amount: 1000000,
      description: 'Chuyển thêm tiền ăn liên hoan',
      source: 'local_new',
    };

    const result = computeMultiMonthRollover([income], [transfer], {}, 'full');
    const anUong = result.chain['Ăn uống']['2026-10'];
    const tietKiem = result.chain['Tiết kiệm']['2026-10'];

    // Ăn uống: base 7M + netTransfer (+1M) = effectiveBudget 8M
    expect(anUong.baseBudget).toBe(7000000);
    expect(anUong.transferIn).toBe(1000000);
    expect(anUong.transferOut).toBe(0);
    expect(anUong.netTransfer).toBe(1000000);
    expect(anUong.effectiveBudget).toBe(8000000);

    // Tiết kiệm: base 20M + netTransfer (-1M) = effectiveBudget 19M
    expect(tietKiem.baseBudget).toBe(20000000);
    expect(tietKiem.transferIn).toBe(0);
    expect(tietKiem.transferOut).toBe(1000000);
    expect(tietKiem.netTransfer).toBe(-1000000);
    expect(tietKiem.effectiveBudget).toBe(19000000);

    // Total net sum across both categories remains 27,000,000 VND
    expect(anUong.effectiveBudget + tietKiem.effectiveBudget).toBe(27000000);
  });

  test('T3.P1.2: Transfer in Month 1 cascades into Month 2 carryover balances', () => {
    const incomeM1: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };
    const incomeM2: TransactionRecord = {
      id: 'i2', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    // Month 1 transfer: 500k from "Giải trí Heo" to "Giải trí Mèo"
    const transfer: BudgetTransferRecord = {
      id: 'bt-aug',
      date: '8/10/2026',
      isoDate: '2026-08-10',
      monthKey: '2026-08',
      fromCategory: 'Giải trí Heo',
      toCategory: 'Giải trí Mèo',
      amount: 500000,
      description: 'Heo nhường ngân sách cho Mèo',
      source: 'local_new',
    };

    const result = computeMultiMonthRollover([incomeM1, incomeM2], [transfer], {}, 'full');

    // In August (M1):
    // Heo base = 1M, netTransfer = -500k -> effective = 500k. Spent = 0 -> remaining = 500k
    const heoAug = result.chain['Giải trí Heo']['2026-08'];
    expect(heoAug.effectiveBudget).toBe(500000);
    expect(heoAug.remaining).toBe(500000);

    // Mèo base = 1M, netTransfer = +500k -> effective = 1.5M. Spent = 0 -> remaining = 1.5M
    const meoAug = result.chain['Giải trí Mèo']['2026-08'];
    expect(meoAug.effectiveBudget).toBe(1500000);
    expect(meoAug.remaining).toBe(1500000);

    // In September (M2):
    // Heo carries over 500k + base 1M = 1.5M
    const heoSep = result.chain['Giải trí Heo']['2026-09'];
    expect(heoSep.carryover).toBe(500000);
    expect(heoSep.effectiveBudget).toBe(1500000);

    // Mèo carries over 1.5M + base 1M = 2.5M
    const meoSep = result.chain['Giải trí Mèo']['2026-09'];
    expect(meoSep.carryover).toBe(1500000);
    expect(meoSep.effectiveBudget).toBe(2500000);
  });

  test('T3.P1.3: Legacy [Transfer] expense item recognized and excluded from expense totals', () => {
    const legacyTransferItem: TransactionRecord = {
      id: 'leg-1',
      sheetType: 'Expenses',
      purchaseDate: '10/10/2026',
      isoDate: '2026-10-10',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: '[Transfer] Chuyển qua quỹ Thú cưng',
      amount: 400000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    const normalExpense: TransactionRecord = {
      id: 'norm-1',
      sheetType: 'Expenses',
      purchaseDate: '10/12/2026',
      isoDate: '2026-10-12',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: 'Đi chợ BigC',
      amount: 650000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    expect(isBudgetTransferRecord(legacyTransferItem)).toBe(true);
    expect(isBudgetTransferRecord(normalExpense)).toBe(false);

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([income, legacyTransferItem, normalExpense]);
    const anUong = result.chain['Ăn uống']['2026-10'];

    // In budgetUtils: legacy transfer item goes to monthlyTransfersOut (netTransfer = -400k)
    // and is NOT counted as an expense!
    expect(anUong.transferOut).toBe(400000);
    expect(anUong.netTransfer).toBe(-400000);
    expect(anUong.spent).toBe(650000); // Only BigC expense
    expect(anUong.txCount).toBe(1); // 1 real transaction, not 2
  });
});

// =========================================================================
// Pairwise 2: Offline Edits + Sync Reconciliation
// =========================================================================
describe('Tier 3 - Pairwise 2: Offline Edits + Sync Queue Reconciliation', () => {
  test('T3.P2.1: Local newly added records coexist with synchronized records in calculations', () => {
    const syncRecord: TransactionRecord = {
      id: 's-1', rowIndex: 10, sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10',
      category: 'Ăn uống', purchaseItem: 'Cơm trưa', amount: 50000, beCorp: 0, credit: 0, source: 'google_sheet', syncedToSheet: true
    };
    const localRecord: TransactionRecord = {
      id: 'l-1', sheetType: 'Expenses', purchaseDate: '10/06/2026', isoDate: '2026-10-06', monthKey: '2026-10',
      category: 'Ăn uống', purchaseItem: 'Bánh ngọt', amount: 45000, beCorp: 0, credit: 0, source: 'local_new', syncedToSheet: false
    };

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([income, syncRecord, localRecord]);
    const anUong = result.chain['Ăn uống']['2026-10'];

    expect(anUong.spent).toBe(95000);
    expect(anUong.txCount).toBe(2);
  });

  test('T3.P2.2: Deletion re-indexing maintains row target accuracy for pending sync tasks', () => {
    // Current sync ledger: row 20, 21, 22
    let rows = [
      { id: 'tx-20', rowIndex: 20, syncedToSheet: true },
      { id: 'tx-21', rowIndex: 21, syncedToSheet: true },
      { id: 'tx-22', rowIndex: 22, syncedToSheet: false, pendingEdit: true },
    ];

    // Delete row 20
    const deletedRowIndex = 20;
    rows = rows
      .filter(r => r.rowIndex !== deletedRowIndex)
      .map(r => ({
        ...r,
        rowIndex: r.rowIndex > deletedRowIndex ? r.rowIndex - 1 : r.rowIndex,
      }));

    // tx-21 is now rowIndex 20
    expect(rows.find(r => r.id === 'tx-21')?.rowIndex).toBe(20);
    // Pending tx-22 is now rowIndex 21 (ready for accurate Google Sheet update target)
    expect(rows.find(r => r.id === 'tx-22')?.rowIndex).toBe(21);
  });

  test('T3.P2.3: Batch sync status transitions smoothly from pending -> syncing -> synced', () => {
    interface QueueItem {
      id: string;
      status: 'pending' | 'syncing' | 'synced' | 'failed';
    }

    const queue: QueueItem[] = [
      { id: 'q1', status: 'pending' },
      { id: 'q2', status: 'pending' },
    ];

    // Mark batch as syncing
    const inFlight = queue.map(item => ({ ...item, status: 'syncing' as const }));
    expect(inFlight.every(i => i.status === 'syncing')).toBe(true);

    // Sync successfully completes
    const completed = inFlight.map(item => ({ ...item, status: 'synced' as const }));
    expect(completed.every(i => i.status === 'synced')).toBe(true);
  });
});

// =========================================================================
// Pairwise 3: Privacy Mode + Table Formatting & Ledger Visibility
// =========================================================================
describe('Tier 3 - Pairwise 3: Privacy Mode + Table Formatting & Masking', () => {
  test('T3.P3.1: Global privacy toggle synchronously controls both formatCurrency and formatNumberForSheet', () => {
    setPrivacyMode(true);
    expect(formatCurrency(2500000)).toBe('•••••• ₫');
    expect(formatNumberForSheet(2500000)).toBe('••••••');

    setPrivacyMode(false);
    expect(formatCurrency(2500000)).toBe('2,500,000 ₫');
    expect(formatNumberForSheet(2500000)).toBe('2,500,000');

    // Reset back
    setPrivacyMode(true);
  });

  test('T3.P3.2: Sensitive financial audit views can force visibility while privacy mode is active', () => {
    setPrivacyMode(true);

    // Regular table cell rendering
    const regularCell = formatCurrency(500000);
    expect(regularCell).toBe('•••••• ₫');

    // Confirmation dialog or audit reconciliation view using forceVisible = true
    const auditCell = formatCurrency(500000, false, true);
    expect(auditCell).toBe('500000 ₫'.replace('500000', '500,000'));
  });

  test('T3.P3.3: Sign indicators (+/-) preserved accurately in formatCurrency and formatNumberForSheet', () => {
    setPrivacyMode(false);

    expect(formatCurrency(350000, true)).toBe('+350,000 ₫');
    expect(formatCurrency(-150000, true)).toBe('-150,000 ₫');
    expect(formatNumberForSheet(350000, false, false, true)).toBe('+350,000');
    expect(formatNumberForSheet(-150000, false, false, true)).toBe('-150,000');

    setPrivacyMode(true);
  });
});

// =========================================================================
// Pairwise 4: Billing Cycles (BE & Credit) + Living Runway Pacing
// =========================================================================
describe('Tier 3 - Pairwise 4: Billing Cycles + Living Runway Pacing', () => {
  test('T3.P4.1: BE Corporate travel expense excluded from daily living runway burn rate', () => {
    const nowIso = '2026-10-15';
    const records: TransactionRecord[] = [
      // Personal living expenses in October
      { id: '1', sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Cơm', amount: 50000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: '2', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Cơm', amount: 50000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // BE Corporate travel booking (reimbursable business expense)
      { id: '3', sheetType: 'Expenses', purchaseDate: '10/12/2026', isoDate: '2026-10-12', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Vé máy bay công tác', amount: 4500000, beCorp: 4500000, credit: 0, source: 'google_sheet' },
    ];

    // Filter living items: default living categories are Ăn uống, Giải trí Heo, Giải trí Mèo, Hóa/Mỹ phẩm
    const livingSet = new Set(['Ăn uống', 'Giải trí Heo', 'Giải trí Mèo', 'Hóa/Mỹ phẩm']);
    const livingExpenses = records.filter(r => livingSet.has(r.category));
    const totalLivingSpent = livingExpenses.reduce((s, r) => s + r.amount, 0);

    expect(totalLivingSpent).toBe(100000); // 100,000 VND only! Not 4,600,000!

    // BE cycle totals correctly include the 4.5M reimbursable ticket
    const beCycleRange = getBillingCycleRange('2026-10', 26, 25);
    const beCycleItems = filterRecordsByDateRange(records, beCycleRange.startDate, beCycleRange.endDate);
    const totalBeCorp = beCycleItems.reduce((s, r) => s + r.beCorp, 0);

    expect(totalBeCorp).toBe(4500000);
  });

  test('T3.P4.2: Credit card purchases on statement day 20th transition to subsequent cycle liability', () => {
    // Statement day 20: October statement covers 2026-09-20 to 2026-10-19
    const octStatementRange = getBillingCycleRange('2026-10', 20, 19);
    // November statement covers 2026-10-20 to 2026-11-19
    const novStatementRange = getBillingCycleRange('2026-11', 20, 19);

    const purchaseOnOct19: TransactionRecord = {
      id: 'p1', sheetType: 'Expenses', purchaseDate: '10/19/2026', isoDate: '2026-10-19', monthKey: '2026-10',
      category: 'Shopping', purchaseItem: 'A', amount: 1000000, beCorp: 0, credit: 1000000, source: 'google_sheet'
    };
    const purchaseOnOct20: TransactionRecord = {
      id: 'p2', sheetType: 'Expenses', purchaseDate: '10/20/2026', isoDate: '2026-10-20', monthKey: '2026-10',
      category: 'Shopping', purchaseItem: 'B', amount: 1500000, beCorp: 0, credit: 1500000, source: 'google_sheet'
    };

    const octPurchases = filterRecordsByDateRange([purchaseOnOct19, purchaseOnOct20], octStatementRange.startDate, octStatementRange.endDate);
    const novPurchases = filterRecordsByDateRange([purchaseOnOct19, purchaseOnOct20], novStatementRange.startDate, novStatementRange.endDate);

    expect(octPurchases.length).toBe(1);
    expect(octPurchases[0].id).toBe('p1');

    expect(novPurchases.length).toBe(1);
    expect(novPurchases[0].id).toBe('p2');
  });
});

// =========================================================================
// Pairwise 5: Dedicated Income + Rollover Modes
// =========================================================================
describe('Tier 3 - Pairwise 5: Dedicated Income + Rollover Modes', () => {
  test('T3.P5.1: Dedicated income interacts with deficit_only rollover mode', () => {
    const records: TransactionRecord[] = [
      // Month 1: 51M general + 5M dedicated to Thú cưng. Spent 2M -> Remaining +5M surplus
      { id: 'i1', sheetType: 'Income', purchaseDate: '8/1/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '8/5/2026', isoDate: '2026-08-05', monthKey: '2026-08', category: 'Thú cưng', purchaseItem: 'Bonus Mèo', amount: 5000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '8/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Thú cưng', purchaseItem: 'Vaccine', amount: 2000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2: 51M general
      { id: 'i3', sheetType: 'Income', purchaseDate: '9/1/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const result = computeMultiMonthRollover(records, [], {}, 'deficit_only');
    const augPet = result.chain['Thú cưng']['2026-08'];
    const sepPet = result.chain['Thú cưng']['2026-09'];

    // In Aug: base = 2M general + 5M dedicated = 7M. Spent = 2M -> Remaining = 5M
    expect(augPet.effectiveBudget).toBe(7000000);
    expect(augPet.remaining).toBe(5000000);

    // In Sep under deficit_only: carryover clamped to 0 because surplus > 0
    expect(sepPet.carryover).toBe(0);
    expect(sepPet.effectiveBudget).toBe(2000000); // 2M general only
  });

  test('T3.P5.2: Month with only dedicated income (0 general income) leaves proportional categories at 0', () => {
    const dedicatedOnlyRecord: TransactionRecord = {
      id: 'i-ded', sheetType: 'Income', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10',
      category: 'Giải trí Heo', purchaseItem: 'Thưởng Heo', amount: 4000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([dedicatedOnlyRecord], [], {}, 'full');
    const heo = result.chain['Giải trí Heo']['2026-10'];
    const anUong = result.chain['Ăn uống']['2026-10'];

    // Heo gets 100% of the 4M dedicated income
    expect(heo.dedicatedIncome).toBe(4000000);
    expect(heo.baseFromGeneral).toBe(0);
    expect(heo.baseBudget).toBe(4000000);

    // General income categories receive 0 base budget
    expect(anUong.baseBudget).toBe(0);
    expect(anUong.dedicatedIncome).toBe(0);
  });
});

// =========================================================================
// Pairwise 6: Calculator Inputs + Transaction Ingestion
// =========================================================================
describe('Tier 3 - Pairwise 6: Calculator Expressions + Ledger Validation', () => {
  test('T3.P6.1: Evaluated calculator expression stored as clean integer amount in ledger', () => {
    const rawInput = '1tr2 + 350k - 50k';
    const evaluatedAmount = parseMoneyNumber(rawInput);
    expect(evaluatedAmount).toBe(1500000);

    const tx: TransactionRecord = {
      id: 'calc-1',
      sheetType: 'Expenses',
      purchaseDate: '10/25/2026',
      isoDate: '2026-10-25',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: 'Tiệc liên hoan',
      amount: evaluatedAmount,
      beCorp: 0,
      credit: 0,
      source: 'local_new',
    };

    expect(Number.isInteger(tx.amount)).toBe(true);
    expect(tx.amount).toBe(1500000);
  });

  test('T3.P6.2: Calculator expression with negative offset produces valid negative refund amount', () => {
    const refundInput = '200k - 500k';
    const evalRefund = evaluateMoneyExpression(refundInput);
    expect(evalRefund).toBe(-300000);

    const refundTx: TransactionRecord = {
      id: 'ref-1',
      sheetType: 'Expenses',
      purchaseDate: '10/26/2026',
      isoDate: '2026-10-26',
      monthKey: '2026-10',
      category: 'Shopping',
      purchaseItem: 'Hoàn trả hàng',
      amount: evalRefund!,
      beCorp: 0,
      credit: evalRefund!,
      source: 'local_new',
    };

    expect(refundTx.amount).toBe(-300000);
    expect(refundTx.credit).toBe(-300000);
  });
});

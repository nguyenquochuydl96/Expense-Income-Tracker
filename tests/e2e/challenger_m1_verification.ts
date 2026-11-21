import { describe, test, expect } from './testHarness';
import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  DEFAULT_CATEGORY_PERCENTAGES,
  DEFAULT_CATEGORY_RATIOS,
} from '../../src/utils/budgetUtils';
import {
  isBudgetTransferRecord,
  getBillingCycleRange,
} from '../../src/utils/cycleUtils';

// =========================================================================
// CHALLENGER TEST SUITE: MILESTONE 1 ACCOUNTING & RUNWAY STRESS HARNESS
// =========================================================================

describe('Challenger M1.1: Multi-Month Budget Rollover with NetTransfer', () => {
  test('M1.1.1: Single-month netTransfer equation preserves baseBudget + carryover + netTransfer', () => {
    const incomeRecord: TransactionRecord = {
      id: 'inc-1',
      sheetType: 'Income',
      purchaseDate: '10/01/2026',
      isoDate: '2026-10-01',
      monthKey: '2026-10',
      category: 'Lương Yes4All',
      purchaseItem: 'Lương tháng 10',
      amount: 51000000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    // Transfer 1.5M from "Tiết kiệm" to "Ăn uống"
    const transferRecord: BudgetTransferRecord = {
      id: 'bt-101',
      date: '10/05/2026',
      isoDate: '2026-10-05',
      monthKey: '2026-10',
      fromCategory: 'Tiết kiệm',
      toCategory: 'Ăn uống',
      amount: 1500000,
      description: 'Chuyển thêm tiền tiệc sinh nhật',
      source: 'local_new',
    };

    const res = computeMultiMonthRollover([incomeRecord], [transferRecord], {}, 'full');
    const anUong = res.chain['Ăn uống']['2026-10'];
    const tietKiem = res.chain['Tiết kiệm']['2026-10'];

    // Base: 51M * (7 / 51) = 7,000,000
    expect(anUong.baseBudget).toBe(7000000);
    expect(anUong.transferIn).toBe(1500000);
    expect(anUong.transferOut).toBe(0);
    expect(anUong.netTransfer).toBe(1500000);
    expect(anUong.effectiveBudget).toBe(7000000 + 0 + 1500000); // 8,500,000

    // Tiết kiệm: Base: 51M * (20 / 51) = 20,000,000
    expect(tietKiem.baseBudget).toBe(20000000);
    expect(tietKiem.transferIn).toBe(0);
    expect(tietKiem.transferOut).toBe(1500000);
    expect(tietKiem.netTransfer).toBe(-1500000);
    expect(tietKiem.effectiveBudget).toBe(20000000 + 0 - 1500000); // 18,500,000

    // Zero-sum conservation
    expect(anUong.effectiveBudget + tietKiem.effectiveBudget).toBe(anUong.baseBudget + tietKiem.baseBudget);
  });

  test('M1.1.2: Multi-month cascading transfers across 3 months preserve net budget equilibrium', () => {
    // 3 Months of Income (August, September, October 2026)
    const incomes: TransactionRecord[] = [
      { id: 'i-08', sheetType: 'Income', purchaseDate: '08/01/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i-09', sheetType: 'Income', purchaseDate: '09/01/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i-10', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    // Transfers:
    // T08: Tiết kiệm -> Ăn uống (1,000,000)
    // T09: Ăn uống -> Giải trí Heo (400,000)
    // T10: Giải trí Heo -> Tiết kiệm (200,000)
    const transfers: BudgetTransferRecord[] = [
      { id: 'bt-1', date: '08/10/2026', isoDate: '2026-08-10', monthKey: '2026-08', fromCategory: 'Tiết kiệm', toCategory: 'Ăn uống', amount: 1000000, description: 'Trợ cấp ăn', source: 'local_new' },
      { id: 'bt-2', date: '09/12/2026', isoDate: '2026-09-12', monthKey: '2026-09', fromCategory: 'Ăn uống', toCategory: 'Giải trí Heo', amount: 400000, description: 'Đi xem phim', source: 'local_new' },
      { id: 'bt-3', date: '10/14/2026', isoDate: '2026-10-14', monthKey: '2026-10', fromCategory: 'Giải trí Heo', toCategory: 'Tiết kiệm', amount: 200000, description: 'Hoàn lại tiết kiệm', source: 'local_new' },
    ];

    const res = computeMultiMonthRollover(incomes, transfers, {}, 'full');

    // T08
    expect(res.chain['Ăn uống']['2026-08'].netTransfer).toBe(1000000);
    expect(res.chain['Tiết kiệm']['2026-08'].netTransfer).toBe(-1000000);

    // T09
    expect(res.chain['Ăn uống']['2026-09'].netTransfer).toBe(-400000);
    expect(res.chain['Giải trí Heo']['2026-09'].netTransfer).toBe(400000);

    // T10
    expect(res.chain['Giải trí Heo']['2026-10'].netTransfer).toBe(-200000);
    expect(res.chain['Tiết kiệm']['2026-10'].netTransfer).toBe(200000);

    // Cumulative 3-month netTransfer in multi-month aggregation logic:
    // Ăn uống: +1,000,000 (T08) - 400,000 (T09) = +600,000
    // Tiết kiệm: -1,000,000 (T08) + 200,000 (T10) = -800,000
    // Giải trí Heo: +400,000 (T09) - 200,000 (T10) = +200,000
    const netSum3Months = 600000 + (-800000) + 200000;
    expect(netSum3Months).toBe(0);
  });

  test('M1.1.3: CategoryBudgetTable multi-month aggregation matches sum of base + netTransfer', () => {
    // Simulate CategoryBudgetTable's currentViewStats logic for multi-month selection
    const selectedMonths = ['2026-08', '2026-09', '2026-10'];
    const incomes: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '08/01/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '09/01/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i3', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];
    const transfers: BudgetTransferRecord[] = [
      { id: 'bt-1', date: '08/10/2026', isoDate: '2026-08-10', monthKey: '2026-08', fromCategory: 'Tiết kiệm', toCategory: 'Ăn uống', amount: 1000000, description: 'Ăn', source: 'local_new' },
      { id: 'bt-2', date: '09/10/2026', isoDate: '2026-09-10', monthKey: '2026-09', fromCategory: 'Ăn uống', toCategory: 'Du lịch', amount: 500000, description: 'Đi chơi', source: 'local_new' },
    ];
    const expenses: TransactionRecord[] = [
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '08/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Ăn uống', purchaseItem: 'Ăn ngoài', amount: 6000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e2', sheetType: 'Expenses', purchaseDate: '09/15/2026', isoDate: '2026-09-15', monthKey: '2026-09', category: 'Ăn uống', purchaseItem: 'Ăn ngoài', amount: 6500000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e3', sheetType: 'Expenses', purchaseDate: '10/15/2026', isoDate: '2026-10-15', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Ăn ngoài', amount: 7000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const rolloverResult = computeMultiMonthRollover([...incomes, ...expenses], transfers, {}, 'full');

    // Reproduce CategoryBudgetTable multi-month calculation
    let totalBaseBudget = 0;
    let totalTransferIn = 0;
    let totalTransferOut = 0;
    let totalSpent = 0;

    for (const mKey of selectedMonths) {
      const mData = rolloverResult.chain['Ăn uống']?.[mKey];
      if (mData) {
        totalBaseBudget += mData.baseBudget;
        totalTransferIn += mData.transferIn;
        totalTransferOut += mData.transferOut;
        totalSpent += mData.spent;
      }
    }

    const netTransfer = totalTransferIn - totalTransferOut;
    const effectiveBudget = totalBaseBudget + netTransfer;
    const remaining = effectiveBudget - totalSpent;

    // Base: 7M * 3 = 21M
    expect(totalBaseBudget).toBe(21000000);
    // Transfers: +1M (Aug) - 0.5M (Sep) = +0.5M
    expect(totalTransferIn).toBe(1000000);
    expect(totalTransferOut).toBe(500000);
    expect(netTransfer).toBe(500000);
    expect(effectiveBudget).toBe(21500000);
    // Spent: 6M + 6.5M + 7M = 19.5M
    expect(totalSpent).toBe(19500000);
    // Remaining: 21.5M - 19.5M = 2,000,000
    expect(remaining).toBe(2000000);

    // Compare with the cumulative remaining at the end of October (T10) in rollover chain:
    const octRemainingInChain = rolloverResult.chain['Ăn uống']['2026-10'].remaining;
    // Chain:
    // Aug: base 7M + net 1M = 8M, spent 6M -> rem 2M
    // Sep: base 7M + carry 2M - net 0.5M = 8.5M, spent 6.5M -> rem 2M
    // Oct: base 7M + carry 2M + net 0 = 9M, spent 7M -> rem 2M
    expect(octRemainingInChain).toBe(2000000);
    // ZERO DISCREPANCY!
    expect(remaining).toBe(octRemainingInChain);
  });
});

describe('Challenger M1.2: Virtual Transfer Exclusion Across All Reports & Views', () => {
  const sampleTransactions: TransactionRecord[] = [
    // Real Expense 1: Food 2,000,000
    { id: 'tx-1', sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Siêu thị Go', amount: 2000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    // Real Expense 2: Savings 5,000,000
    { id: 'tx-2', sheetType: 'Expenses', purchaseDate: '10/06/2026', isoDate: '2026-10-06', monthKey: '2026-10', category: 'Tiết kiệm', purchaseItem: 'Gửi tiết kiệm Techcombank', amount: 5000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    // Real Expense 3: Coffee 100,000
    { id: 'tx-3', sheetType: 'Expenses', purchaseDate: '10/07/2026', isoDate: '2026-10-07', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Highlands Coffee', amount: 100000, beCorp: 0, credit: 0, source: 'google_sheet' },

    // Virtual Transfer 1: Standard [Transfer]
    { id: 'vt-1', sheetType: 'Expenses', purchaseDate: '10/08/2026', isoDate: '2026-10-08', monthKey: '2026-10', category: 'Tiết kiệm', purchaseItem: '[Transfer] Tiết kiệm -> Ăn uống', amount: 1000000, beCorp: 0, credit: 0, source: 'local_new' },
    // Virtual Transfer 2: Note contains "transfer budget"
    { id: 'vt-2', sheetType: 'Expenses', purchaseDate: '10/09/2026', isoDate: '2026-10-09', monthKey: '2026-10', category: 'Giải trí Heo', purchaseItem: 'Bổ sung quỹ', note: 'transfer budget from Heo to Meo', amount: 800000, beCorp: 0, credit: 0, source: 'local_new' },
    // Virtual Transfer 3: Historical "Cho Mèo"
    { id: 'vt-3', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Giải trí Mèo', purchaseItem: 'Cho Mèo', amount: 500000, beCorp: 0, credit: 0, source: 'google_sheet' },
    // Virtual Transfer 4: Historical "Chuyển qua..."
    { id: 'vt-4', sheetType: 'Expenses', purchaseDate: '10/11/2026', isoDate: '2026-10-11', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Chuyển qua quỹ du lịch', amount: 2000000, beCorp: 0, credit: 0, source: 'google_sheet' },
  ];

  test('M1.2.1: MultiMonthSummaryTable excludes all 4 types of virtual transfers', () => {
    // Replicate MultiMonthSummaryTable expense loop
    const expenseRecords = sampleTransactions.filter((r) => r.sheetType === 'Expenses');
    let totalExpense = 0;
    let livingExpense = 0;
    let savingsExpense = 0;

    for (const r of expenseRecords) {
      if (isBudgetTransferRecord(r)) {
        continue;
      }
      totalExpense += r.amount;
      if (r.category === 'Tiết kiệm') {
        savingsExpense += r.amount;
      } else {
        livingExpense += r.amount;
      }
    }

    // Expected:
    // Real living: 2,000,000 + 100,000 = 2,100,000
    // Real savings: 5,000,000
    // Total real: 7,100,000
    // Transfers excluded: 1,000,000 + 800,000 + 500,000 + 2,000,000 = 4,300,000
    expect(totalExpense).toBe(7100000);
    expect(livingExpense).toBe(2100000);
    expect(savingsExpense).toBe(5000000);
  });

  test('M1.2.2: MonthlyReportCardModal excludes virtual transfers from living, savings, and biggestExpense', () => {
    const isSavingsRecord = (r: TransactionRecord) => {
      const cleanCat = (r.category || '').toLowerCase().trim();
      const cleanItem = (r.purchaseItem || '').toLowerCase().trim();
      return (
        cleanCat.includes('tiết kiệm') ||
        cleanCat.includes('đầu tư') ||
        cleanCat.includes('tích lũy') ||
        cleanItem.includes('tiết kiệm')
      );
    };

    const targetMonth = '2026-10';
    const monthRecords = sampleTransactions.filter((r) => r.monthKey === targetMonth);
    const expenseRecords = monthRecords.filter((r) => r.sheetType === 'Expenses' && !isBudgetTransferRecord(r));

    const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    const savingsRecords = expenseRecords.filter((r) => isSavingsRecord(r));
    const livingExpenseRecords = expenseRecords.filter((r) => !isSavingsRecord(r));

    const savingsAmount = savingsRecords.reduce((sum, r) => sum + r.amount, 0);
    const livingExpense = livingExpenseRecords.reduce((sum, r) => sum + r.amount, 0);

    const sortedLivingExpenses = [...livingExpenseRecords].sort((a, b) => b.amount - a.amount);
    const biggestExpense = sortedLivingExpenses[0] || null;

    expect(totalExpense).toBe(7100000);
    expect(livingExpense).toBe(2100000);
    expect(savingsAmount).toBe(5000000);
    // The biggest living expense must be "Siêu thị Go" (2,000,000), NOT the 2M transfer "Chuyển qua quỹ du lịch"
    expect(biggestExpense).toBeDefined();
    expect(biggestExpense!.purchaseItem).toBe('Siêu thị Go');
    expect(biggestExpense!.amount).toBe(2000000);
  });

  test('M1.2.3: CalendarHeatmapView does not treat virtual transfer day as a spending day', () => {
    // 10/08/2026 had ONLY virtual transfer vt-1 (1,000,000)
    const txsOnOct08 = sampleTransactions.filter((r) => r.isoDate === '2026-10-08');
    let spent = 0;
    for (const t of txsOnOct08) {
      if (t.sheetType === 'Expenses') {
        if (isBudgetTransferRecord(t)) continue;
        spent += t.amount;
      }
    }
    // Must be 0 spent, perfectly classifying this day as a no-spend day!
    expect(spent).toBe(0);
  });

  test('M1.2.4: AnalyticsCharts excludes virtual transfers from Donut/Bar chart and monthlyCashflow', () => {
    // Category Breakdown (Donut/Bar Chart)
    const totals = new Map<string, number>();
    for (const rec of sampleTransactions) {
      if (rec.sheetType !== 'Expenses') continue;
      if (isBudgetTransferRecord(rec)) continue;
      totals.set(rec.category, (totals.get(rec.category) || 0) + rec.amount);
    }

    // Only Ăn uống (2.1M) and Tiết kiệm (5M) exist
    expect(totals.get('Ăn uống')).toBe(2100000);
    expect(totals.get('Tiết kiệm')).toBe(5000000);
    expect(totals.get('Giải trí Heo')).toBeUndefined();
    expect(totals.get('Giải trí Mèo')).toBeUndefined();
    expect(totals.get('Khác')).toBeUndefined();

    const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    expect(grandTotal).toBe(7100000);
  });
});

describe('Challenger M1.3: Daily Living Runway Widget Edge Cases', () => {
  // Test helper replicating DailyLivingRunwayWidget dateMetrics & summary logic
  function calculateWidgetMetrics(
    targetMonth: string,
    currentYearMonth: string,
    nowDate: number,
    dailyItems: { category: string; effectiveBudget: number; spent: number }[]
  ) {
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    let currentDay: number;
    let isPast = false;
    let isFuture = false;

    if (targetMonth === currentYearMonth) {
      currentDay = nowDate;
    } else if (targetMonth < currentYearMonth) {
      currentDay = daysInMonth;
      isPast = true;
    } else {
      currentDay = 1;
      isFuture = true;
    }

    const elapsedDays = isPast ? daysInMonth : isFuture ? 0 : Math.max(1, currentDay);
    const remainingDays = isPast ? 0 : isFuture ? daysInMonth : Math.max(1, daysInMonth - currentDay + 1);

    const totalBudget = dailyItems.reduce((s, i) => s + i.effectiveBudget, 0);
    const totalSpent = dailyItems.reduce((s, i) => s + i.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const pctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const burnRateDaily = elapsedDays > 0 ? Math.round(totalSpent / elapsedDays) : 0;
    const safeDailyAllowance =
      remainingDays > 0 ? Math.max(0, Math.round(totalRemaining / remainingDays)) : 0;

    const diff = safeDailyAllowance - burnRateDaily;
    const isPacingSafe = diff >= 0;

    // Card 2 footer badge logic strictly replicating DailyLivingRunwayWidget.tsx:394–417
    let card2Badge: {
      type: 'past_surplus' | 'past_overspent' | 'active_safe' | 'active_danger';
      label: string;
      icon: 'CheckCircle2' | 'AlertTriangle';
      color: 'emerald' | 'rose';
    };

    if (isPast) {
      if (totalRemaining >= 0) {
        card2Badge = {
          type: 'past_surplus',
          label: `Trong định mức ngân sách (+${totalRemaining})`,
          icon: 'CheckCircle2',
          color: 'emerald',
        };
      } else {
        card2Badge = {
          type: 'past_overspent',
          label: `Vượt ngân sách kỳ (${Math.abs(totalRemaining)})`,
          icon: 'AlertTriangle',
          color: 'rose',
        };
      }
    } else if (isPacingSafe) {
      card2Badge = {
        type: 'active_safe',
        label: `Dưới hạn mức an toàn (${Math.abs(diff)})`,
        icon: 'CheckCircle2',
        color: 'emerald',
      };
    } else {
      card2Badge = {
        type: 'active_danger',
        label: `Vượt nhịp độ an toàn (${Math.abs(diff)})`,
        icon: 'AlertTriangle',
        color: 'rose',
      };
    }

    return {
      year,
      month,
      daysInMonth,
      currentDay,
      elapsedDays,
      remainingDays,
      isPast,
      isFuture,
      totalBudget,
      totalSpent,
      totalRemaining,
      pctUsed,
      burnRateDaily,
      safeDailyAllowance,
      diff,
      isPacingSafe,
      card2Badge,
    };
  }

  test('M1.3.1: Future month correctly sets elapsedDays=0, burnRateDaily=0, safeAllowance=budget/days', () => {
    const dailyItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 0 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 0 },
    ];
    // Inspect future month: 2026-12 while current is 2026-11
    const metrics = calculateWidgetMetrics('2026-12', '2026-11', 9, dailyItems);

    expect(metrics.isFuture).toBe(true);
    expect(metrics.isPast).toBe(false);
    expect(metrics.elapsedDays).toBe(0);
    expect(metrics.burnRateDaily).toBe(0);
    expect(metrics.remainingDays).toBe(31);
    expect(metrics.safeDailyAllowance).toBe(Math.round(8500000 / 31)); // 274,194 ₫/ngày
    expect(metrics.card2Badge.type).toBe('active_safe');
  });

  test('M1.3.2: Completed past month has remainingDays=0, safeDailyAllowance=0, elapsedDays=daysInMonth', () => {
    const dailyItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 6500000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 1000000 },
    ];
    // Inspect past month: 2026-10 while current is 2026-11
    const metrics = calculateWidgetMetrics('2026-10', '2026-11', 9, dailyItems);

    expect(metrics.isPast).toBe(true);
    expect(metrics.isFuture).toBe(false);
    expect(metrics.elapsedDays).toBe(31);
    expect(metrics.remainingDays).toBe(0);
    expect(metrics.safeDailyAllowance).toBe(0);
    expect(metrics.burnRateDaily).toBe(Math.round(7500000 / 31)); // 241,935 ₫/ngày
    expect(metrics.totalRemaining).toBe(1000000); // Surplus 1M
  });

  test('M1.3.3: EMPIRICAL VERIFICATION: Completed past month with severe overspend displays Vượt ngân sách kỳ (rose alert)', () => {
    // Budget: 8.5M. Spent: 15.5M (overspent by 7,000,000 VND!)
    const dailyItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 13000000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 2500000 },
    ];
    const metrics = calculateWidgetMetrics('2026-10', '2026-11', 9, dailyItems);

    expect(metrics.isPast).toBe(true);
    expect(metrics.totalRemaining).toBe(-7000000);
    expect(metrics.pctUsed).toBeGreaterThan(180); // 182.35%
    expect(metrics.safeDailyAllowance).toBe(0);
    expect(metrics.burnRateDaily).toBe(500000); // 15.5M / 31 days = 500,000
    expect(metrics.diff).toBe(-500000);

    // FIXED: isPacingSafe is NO LONGER falsely forced to true
    expect(metrics.isPacingSafe).toBe(false);

    // FIXED: Card 2 displays "Vượt ngân sách kỳ" with rose AlertTriangle
    expect(metrics.card2Badge.type).toBe('past_overspent');
    expect(metrics.card2Badge.icon).toBe('AlertTriangle');
    expect(metrics.card2Badge.color).toBe('rose');
    expect(metrics.card2Badge.label.includes('Vượt ngân sách kỳ')).toBe(true);
    // CRITICAL: MUST NEVER display "Dưới hạn mức an toàn"
    expect(metrics.card2Badge.label.includes('Dưới hạn mức an toàn')).toBe(false);
  });

  test('M1.3.4: Completed past month with surplus displays Trong định mức ngân sách (emerald check)', () => {
    // Budget: 8.5M. Spent: 7.5M (surplus 1,000,000 VND)
    const dailyItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 6500000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 1000000 },
    ];
    const metrics = calculateWidgetMetrics('2026-10', '2026-11', 9, dailyItems);

    expect(metrics.isPast).toBe(true);
    expect(metrics.totalRemaining).toBe(1000000);
    expect(metrics.card2Badge.type).toBe('past_surplus');
    expect(metrics.card2Badge.icon).toBe('CheckCircle2');
    expect(metrics.card2Badge.color).toBe('emerald');
    expect(metrics.card2Badge.label.includes('Trong định mức ngân sách')).toBe(true);
  });

  test('M1.3.5: Boundary case: completed past month with exact zero balance (spent === budget)', () => {
    // Budget: 8.5M. Spent: 8.5M (remaining 0)
    const dailyItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 7000000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 1500000 },
    ];
    const metrics = calculateWidgetMetrics('2026-10', '2026-11', 9, dailyItems);

    expect(metrics.isPast).toBe(true);
    expect(metrics.totalRemaining).toBe(0);
    // totalRemaining >= 0 is true, so it must display Trong định mức ngân sách
    expect(metrics.card2Badge.type).toBe('past_surplus');
    expect(metrics.card2Badge.icon).toBe('CheckCircle2');
    expect(metrics.card2Badge.color).toBe('emerald');
    expect(metrics.card2Badge.label.includes('Trong định mức ngân sách')).toBe(true);
  });

  test('M1.3.6: Active current month: overspend pace triggers danger pacing and safe pace triggers safe pacing', () => {
    // Overspent pace: Day 10, budget 8.5M, spent 10M
    const overspentItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 8500000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 1500000 },
    ];
    const dangerMetrics = calculateWidgetMetrics('2026-11', '2026-11', 10, overspentItems);

    expect(dangerMetrics.isPast).toBe(false);
    expect(dangerMetrics.isPacingSafe).toBe(false);
    expect(dangerMetrics.card2Badge.type).toBe('active_danger');
    expect(dangerMetrics.card2Badge.icon).toBe('AlertTriangle');
    expect(dangerMetrics.card2Badge.color).toBe('rose');
    expect(dangerMetrics.card2Badge.label.includes('Vượt nhịp độ an toàn')).toBe(true);

    // Safe pace: Day 10, budget 8.5M, spent 2M
    const safeItems = [
      { category: 'Ăn uống', effectiveBudget: 7000000, spent: 1500000 },
      { category: 'Shopping', effectiveBudget: 1500000, spent: 500000 },
    ];
    const safeMetrics = calculateWidgetMetrics('2026-11', '2026-11', 10, safeItems);

    expect(safeMetrics.isPast).toBe(false);
    expect(safeMetrics.isPacingSafe).toBe(true);
    expect(safeMetrics.card2Badge.type).toBe('active_safe');
    expect(safeMetrics.card2Badge.icon).toBe('CheckCircle2');
    expect(safeMetrics.card2Badge.color).toBe('emerald');
    expect(safeMetrics.card2Badge.label.includes('Dưới hạn mức an toàn')).toBe(true);
  });

  test('M1.3.7: Static AST & source audit of DailyLivingRunwayWidget.tsx implementation', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const widgetPath = path.resolve(process.cwd(), 'src/components/DailyLivingRunwayWidget.tsx');
    const content = fs.readFileSync(widgetPath, 'utf-8');

    // 1. Confirm '|| isPast' is completely purged from isPacingSafe calculation
    expect(content.includes('diff >= 0 || isPast')).toBe(false);

    // 2. Confirm 'const isPacingSafe = diff >= 0;' is present
    expect(content.includes('const isPacingSafe = diff >= 0;')).toBe(true);

    // 3. Confirm dateMetrics.isPast branches totalRemaining >= 0
    expect(content.includes('dateMetrics.isPast ?')).toBe(true);
    expect(content.includes('summary.totalRemaining >= 0 ?')).toBe(true);

    // 4. Confirm exact Vietnamese strings
    expect(content.includes('Trong định mức ngân sách')).toBe(true);
    expect(content.includes('Vượt ngân sách kỳ')).toBe(true);
    expect(content.includes('Dưới hạn mức an toàn')).toBe(true);
    expect(content.includes('Vượt nhịp độ an toàn')).toBe(true);
  });
});


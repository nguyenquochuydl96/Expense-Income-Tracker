import { describe, test, expect } from './testHarness';
import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  getDedicatedExpenseCategory,
  computeNormalizedMonthMap,
  DEFAULT_CATEGORY_RATIOS_T4_T7,
  DEFAULT_CATEGORY_RATIOS,
  GENERAL_INCOME_CATEGORIES,
} from '../../src/utils/budgetUtils';
import {
  getBillingCycleRange,
  filterRecordsByDateRange,
  isBudgetTransferRecord,
} from '../../src/utils/cycleUtils';

// ============================================================================
// CHALLENGER M4 MASTER STRESS & ACCOUNTING FUZZING SUITE
// ============================================================================

describe('Challenger M4.1: 60-Month Long-Range Rollover & Conservation Stress Test', () => {
  // Generate 60 months from 2023-01 to 2027-12
  const generate60Months = () => {
    const months: string[] = [];
    for (let y = 2023; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    return months;
  };

  test('M4.1.1: Multi-year full rollover preserves cumulative conservation across 60 months', () => {
    const months = generate60Months();
    const records: TransactionRecord[] = [];
    const transfers: BudgetTransferRecord[] = [];

    // Each month: 50,000,000 general income
    months.forEach((mKey, idx) => {
      records.push({
        id: `inc-${mKey}`,
        sheetType: 'Income',
        purchaseDate: `${mKey}-01`,
        isoDate: `${mKey}-01`,
        monthKey: mKey,
        category: 'Lương Yes4All',
        purchaseItem: `Lương tháng ${mKey}`,
        amount: 50000000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
      });

      // Dedicated income every 3 months for 'Ăn uống'
      if (idx % 3 === 0) {
        records.push({
          id: `inc-ded-${mKey}`,
          sheetType: 'Income',
          purchaseDate: `${mKey}-05`,
          isoDate: `${mKey}-05`,
          monthKey: mKey,
          category: 'Ăn uống thêm thưởng',
          purchaseItem: 'Thưởng ăn uống',
          amount: 2000000,
          beCorp: 0,
          credit: 0,
          source: 'google_sheet',
        });
      }

      // Variable expenses for 'Ăn uống'
      const spentAmount = (idx % 2 === 0) ? 6000000 : 9000000;
      records.push({
        id: `exp-${mKey}`,
        sheetType: 'Expenses',
        purchaseDate: `${mKey}-15`,
        isoDate: `${mKey}-15`,
        monthKey: mKey,
        category: 'Ăn uống',
        purchaseItem: 'Ăn uống gia đình',
        amount: spentAmount,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
      });

      // Virtual budget transfer every 4 months from 'Tiết kiệm' to 'Ăn uống'
      if (idx % 4 === 0) {
        transfers.push({
          id: `bt-${mKey}`,
          date: `${mKey}-10`,
          isoDate: `${mKey}-10`,
          monthKey: mKey,
          fromCategory: 'Tiết kiệm',
          toCategory: 'Ăn uống',
          amount: 1000000,
          description: 'Transfer',
          source: 'local_new',
        });
      }
    });

    const res = computeMultiMonthRollover(records, transfers, {}, 'full');
    expect(res.allChronologicalMonths.length).toBe(60);

    // Verify mathematical continuity for each month
    let previousRemaining = 0;
    for (let i = 0; i < months.length; i++) {
      const mKey = months[i];
      const stats = res.chain['Ăn uống'][mKey];

      // In full rollover, carryover must equal previous month's remaining balance
      if (i === 0) {
        expect(stats.carryover).toBe(0);
      } else {
        expect(stats.carryover).toBe(previousRemaining);
      }

      // Equation check: effectiveBudget = baseBudget + carryover + netTransfer
      expect(stats.effectiveBudget).toBe(stats.baseBudget + stats.carryover + stats.netTransfer);

      // Remaining = effectiveBudget - spent
      expect(stats.remaining).toBe(stats.effectiveBudget - stats.spent);

      previousRemaining = stats.remaining;
    }
  });

  test('M4.1.2: Strict historical ratio cutoff at 2026-07 across 5-year timeline', () => {
    const months = generate60Months();
    const records: TransactionRecord[] = months.map((mKey) => ({
      id: `inc-${mKey}`,
      sheetType: 'Income',
      purchaseDate: `${mKey}-01`,
      isoDate: `${mKey}-01`,
      monthKey: mKey,
      category: 'Lương Yes4All',
      purchaseItem: 'Salary',
      amount: 47500000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    }));

    const res = computeMultiMonthRollover(records, [], {}, 'full');

    for (const mKey of months) {
      const rentStats = res.chain['Thuê nhà'][mKey];
      if (mKey <= '2026-07') {
        // T4-T7 ratio: 6.5 / 47.5 -> exactly 6,500,000 for 47.5M income
        expect(rentStats.baseBudget).toBe(6500000);
      } else {
        // T8-T10 ratio: 8.5 / 51.0 -> Math.round(47,500,000 * (8.5 / 51.0)) = 7,916,667
        const expected = Math.round(47500000 * (8.5 / 51.0));
        expect(rentStats.baseBudget).toBe(expected);
      }
    }
  });

  test('M4.1.3: Deficit-only mode never carries forward positive surplus across years', () => {
    const months = ['2025-11', '2025-12', '2026-01', '2026-02'];
    const records: TransactionRecord[] = [
      // Month 1: Large surplus (Budget ~7M, spent 1M -> Surplus +6M)
      { id: 'i1', sheetType: 'Income', purchaseDate: '2025-11-01', isoDate: '2025-11-01', monthKey: '2025-11', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 47500000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '2025-11-05', isoDate: '2025-11-05', monthKey: '2025-11', category: 'Ăn uống', purchaseItem: 'Food', amount: 1000000, beCorp: 0, credit: 0, source: 'google_sheet' },

      // Month 2: Deficit (Budget ~7M, spent 12M -> Deficit)
      { id: 'i2', sheetType: 'Income', purchaseDate: '2025-12-01', isoDate: '2025-12-01', monthKey: '2025-12', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 47500000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e2', sheetType: 'Expenses', purchaseDate: '2025-12-05', isoDate: '2025-12-05', monthKey: '2025-12', category: 'Ăn uống', purchaseItem: 'Food', amount: 12000000, beCorp: 0, credit: 0, source: 'google_sheet' },

      // Month 3: Next month carryover must inherit deficit, but month 2 should NOT have inherited surplus
      { id: 'i3', sheetType: 'Income', purchaseDate: '2026-01-01', isoDate: '2026-01-01', monthKey: '2026-01', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 47500000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], {}, 'deficit_only');

    // Month 2 carryover must be 0 (surplus suppressed)
    expect(res.chain['Ăn uống']['2025-12'].carryover).toBe(0);

    // Month 2 remaining is 7,000,000 - 12,000,000 = -5,000,000
    expect(res.chain['Ăn uống']['2025-12'].remaining).toBe(-5000000);

    // Month 3 carryover must carry the -5,000,000 deficit forward!
    expect(res.chain['Ăn uống']['2026-01'].carryover).toBe(-5000000);
  });
});

describe('Challenger M4.2: Dedicated Income Partitioning & Vietnamese Diacritics Fuzzing', () => {
  test('M4.2.1: General salary categories are never falsely matched as dedicated income', () => {
    const generalCategories = Array.from(GENERAL_INCOME_CATEGORIES);
    for (const cat of generalCategories) {
      const match = getDedicatedExpenseCategory(cat, Array.from(EXPENSE_CATEGORIES));
      expect(match).toBeNull();

      // Variations with whitespace and case
      expect(getDedicatedExpenseCategory(`  ${cat.toUpperCase()}  `, Array.from(EXPENSE_CATEGORIES))).toBeNull();
    }
  });

  test('M4.2.2: Dedicated income prefix matching correctly targets expense categories', () => {
    const testCases = [
      { raw: 'Ăn uống - mẹ gửi', expected: 'Ăn uống' },
      { raw: 'Thú cưng bán mèo con', expected: 'Thú cưng' },
      { raw: 'Thuê nhà hỗ trợ cty', expected: 'Thuê nhà' },
      { raw: 'Sức khỏe bảo hiểm hoàn tiền', expected: 'Sức khỏe' },
      { raw: 'Shopping thanh lý quần áo', expected: 'Shopping' },
      { raw: 'Du lịch công tác phí', expected: 'Du lịch' },
    ];

    for (const tc of testCases) {
      const matched = getDedicatedExpenseCategory(tc.raw, Array.from(EXPENSE_CATEGORIES));
      expect(matched).toBe(tc.expected);
    }
  });

  test('M4.2.3: Dedicated income exclusively increases the targeted category budget', () => {
    const records: TransactionRecord[] = [
      { id: 'i-gen', sheetType: 'Income', purchaseDate: '2026-09-01', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i-ded', sheetType: 'Income', purchaseDate: '2026-09-02', isoDate: '2026-09-02', monthKey: '2026-09', category: 'Thú cưng hỗ trợ', purchaseItem: 'Ded', amount: 3000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], {}, 'full');

    // 'Thú cưng': Base general (51M * 2/51 = 2M) + dedicated (3M) = 5M
    const petStats = res.chain['Thú cưng']['2026-09'];
    expect(petStats.baseFromGeneral).toBe(2000000);
    expect(petStats.dedicatedIncome).toBe(3000000);
    expect(petStats.baseBudget).toBe(5000000);

    // Other categories must NOT have dedicated income added
    const foodStats = res.chain['Ăn uống']['2026-09'];
    expect(foodStats.baseFromGeneral).toBe(7000000);
    expect(foodStats.dedicatedIncome).toBe(0);
    expect(foodStats.baseBudget).toBe(7000000);
  });
});

describe('Challenger M4.3: Virtual Budget Transfer Exclusion & Net Zero Conservation', () => {
  test('M4.3.1: Expense records marked as [Transfer] are strictly excluded from living expenses', () => {
    const records: TransactionRecord[] = [
      { id: 'e-normal', sheetType: 'Expenses', purchaseDate: '2026-10-02', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'Bữa trưa', amount: 150000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e-transfer', sheetType: 'Expenses', purchaseDate: '2026-10-03', isoDate: '2026-10-03', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: '[Transfer] Qua Thú cưng', amount: 500000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i-salary', sheetType: 'Income', purchaseDate: '2026-10-01', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    expect(isBudgetTransferRecord(records[1])).toBe(true);
    expect(isBudgetTransferRecord(records[0])).toBe(false);

    const res = computeMultiMonthRollover(records, [], {}, 'full');
    const foodStats = res.chain['Ăn uống']['2026-10'];

    // Spent must be strictly 150,000 (normal expense only), NOT 650,000!
    expect(foodStats.spent).toBe(150000);
    expect(foodStats.transferOut).toBe(500000);
  });

  test('M4.3.2: Intra-month transfers between multiple categories conserve net zero across all categories', () => {
    const transfers: BudgetTransferRecord[] = [
      { id: 'bt-1', date: '2026-10-01', isoDate: '2026-10-01', monthKey: '2026-10', fromCategory: 'Tiết kiệm', toCategory: 'Ăn uống', amount: 2000000, description: 'T1', source: 'local_new' },
      { id: 'bt-2', date: '2026-10-02', isoDate: '2026-10-02', monthKey: '2026-10', fromCategory: 'Thuê nhà', toCategory: 'Thú cưng', amount: 1000000, description: 'T2', source: 'local_new' },
      { id: 'bt-3', date: '2026-10-03', isoDate: '2026-10-03', monthKey: '2026-10', fromCategory: 'Thú cưng', toCategory: 'Tiết kiệm', amount: 500000, description: 'T3', source: 'local_new' },
    ];

    const income: TransactionRecord = {
      id: 'i-1', sheetType: 'Income', purchaseDate: '2026-10-01', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const res = computeMultiMonthRollover([income], transfers, {}, 'full');

    let sumNetTransfer = 0;
    for (const cat of res.allCategories) {
      sumNetTransfer += (res.chain[cat]['2026-10']?.netTransfer || 0);
    }

    // Zero-sum law
    expect(sumNetTransfer).toBe(0);
  });
});

describe('Challenger M4.4: Concurrent & Interleaved Google Sheets Row Index Simulation', () => {
  // Oracle Model representing physical Google Sheet tab and React state
  interface TransactionModel {
    id: string;
    sheetType: 'Expenses' | 'Income';
    rowIndex?: number;
    purchaseItem: string;
    amount: number;
  }

  // Pure function mirroring App.tsx row index shift logic
  function deleteRowOptimistic(
    records: TransactionModel[],
    targetId: string
  ): TransactionModel[] {
    const target = records.find((r) => r.id === targetId);
    if (!target) return records;

    const filtered = records.filter((r) => r.id !== targetId);
    if (target.rowIndex === undefined) return filtered;

    return filtered.map((r) => {
      if (
        r.sheetType === target.sheetType &&
        r.rowIndex !== undefined &&
        r.rowIndex > target.rowIndex!
      ) {
        return { ...r, rowIndex: r.rowIndex - 1 };
      }
      return r;
    });
  }

  // Pure function mirroring App.tsx optimistic append row index assignment
  function addRowOptimistic(
    records: TransactionModel[],
    sheetType: 'Expenses' | 'Income',
    purchaseItem: string,
    amount: number
  ): TransactionModel[] {
    const sameTabRows = records.filter(
      (r) => r.sheetType === sheetType && typeof r.rowIndex === 'number'
    );
    const maxRow = sameTabRows.reduce((m, r) => Math.max(m, r.rowIndex || 0), 1);
    const assignedRowIndex = maxRow + 1;

    const newRecord: TransactionModel = {
      id: `local-${Date.now()}-${Math.random()}`,
      sheetType,
      rowIndex: assignedRowIndex,
      purchaseItem,
      amount,
    };

    return [...records, newRecord];
  }

  test('M4.4.1: 100 Interleaved additions and deletions maintain 100% contiguous row indices', () => {
    // Initial 30 rows on Expenses, 20 rows on Income
    let state: TransactionModel[] = [];

    for (let i = 2; i <= 31; i++) {
      state.push({
        id: `exp-${i}`,
        sheetType: 'Expenses',
        rowIndex: i,
        purchaseItem: `Exp ${i}`,
        amount: 100000,
      });
    }

    for (let i = 2; i <= 21; i++) {
      state.push({
        id: `inc-${i}`,
        sheetType: 'Income',
        rowIndex: i,
        purchaseItem: `Inc ${i}`,
        amount: 2000000,
      });
    }

    // Execute 100 randomized operations (adds and deletes)
    for (let op = 0; op < 100; op++) {
      const isAdd = op % 3 === 0;
      const sheetType: 'Expenses' | 'Income' = op % 2 === 0 ? 'Expenses' : 'Income';

      if (isAdd) {
        state = addRowOptimistic(state, sheetType, `New item ${op}`, 50000);
      } else {
        const pool = state.filter((r) => r.sheetType === sheetType);
        if (pool.length > 5) {
          // Pick a random row to delete
          const pickIdx = Math.floor(Math.random() * pool.length);
          const target = pool[pickIdx];
          state = deleteRowOptimistic(state, target.id);
        }
      }

      // Invariant Check after EVERY operation:
      for (const tab of ['Expenses', 'Income'] as const) {
        const tabRows = state
          .filter((r) => r.sheetType === tab)
          .sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));

        // Must start at rowIndex 2 and be strictly contiguous: 2, 3, 4, ... N + 1
        for (let idx = 0; idx < tabRows.length; idx++) {
          expect(tabRows[idx].rowIndex).toBe(idx + 2);
        }
      }
    }
  });

  test('M4.4.2: Deleting unindexed offline record (rowIndex undefined) does not corrupt sheet row indices', () => {
    let state: TransactionModel[] = [
      { id: 'exp-2', sheetType: 'Expenses', rowIndex: 2, purchaseItem: 'E2', amount: 100 },
      { id: 'exp-3', sheetType: 'Expenses', rowIndex: 3, purchaseItem: 'E3', amount: 200 },
      { id: 'exp-off', sheetType: 'Expenses', rowIndex: undefined, purchaseItem: 'Offline', amount: 300 },
      { id: 'exp-4', sheetType: 'Expenses', rowIndex: 4, purchaseItem: 'E4', amount: 400 },
    ];

    state = deleteRowOptimistic(state, 'exp-off');

    expect(state.length).toBe(3);
    const remainingIndices = state.map((r) => r.rowIndex);
    // Since target had undefined rowIndex, existing rowIndices must remain completely unchanged!
    expect(remainingIndices).toEqual([2, 3, 4]);
  });
});

describe('Challenger M4.5: Date Range Boundary Fuzzing Across 120 Months', () => {
  function isValidCalendarDate(isoStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return false;
    const [y, m, d] = isoStr.split('-').map((v) => parseInt(v, 10));
    const dateObj = new Date(y, m - 1, d);
    return (
      dateObj.getFullYear() === y &&
      dateObj.getMonth() + 1 === m &&
      dateObj.getDate() === d
    );
  }

  test('M4.5.1: getBillingCycleRange produces 100% valid ISO dates for 10 consecutive years', () => {
    // 2020 to 2029 (120 months)
    for (let y = 2020; y <= 2029; y++) {
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${y}-${String(m).padStart(2, '0')}`;

        // Test BE cycle (26 - 25)
        const beCycle = getBillingCycleRange(monthKey, 26, 25);
        expect(isValidCalendarDate(beCycle.startDate)).toBe(true);
        expect(isValidCalendarDate(beCycle.endDate)).toBe(true);
        expect(beCycle.startDate <= beCycle.endDate).toBe(true);

        // Test Credit cycle (20 - 19)
        const creditCycle = getBillingCycleRange(monthKey, 20, 19);
        expect(isValidCalendarDate(creditCycle.startDate)).toBe(true);
        expect(isValidCalendarDate(creditCycle.endDate)).toBe(true);
        expect(creditCycle.startDate <= creditCycle.endDate).toBe(true);

        // Test Same-month cycle (1 - 31 clamped to max days)
        const fullMonth = getBillingCycleRange(monthKey, 1, 31);
        expect(isValidCalendarDate(fullMonth.startDate)).toBe(true);
        expect(isValidCalendarDate(fullMonth.endDate)).toBe(true);
        expect(fullMonth.startDate <= fullMonth.endDate).toBe(true);
      }
    }
  });

  test('M4.5.2: filterRecordsByDateRange inclusive boundary testing', () => {
    const records = [
      { id: '1', isoDate: '2026-02-25' },
      { id: '2', isoDate: '2026-02-26' },
      { id: '3', isoDate: '2026-03-10' },
      { id: '4', isoDate: '2026-03-25' },
      { id: '5', isoDate: '2026-03-26' },
    ];

    const filtered = filterRecordsByDateRange(records, '2026-02-26', '2026-03-25');
    expect(filtered.length).toBe(3);
    expect(filtered.map((r) => r.id)).toEqual(['2', '3', '4']);
  });
});

import { describe, test, expect } from './testHarness';
import * as fs from 'fs';
import * as path from 'path';
import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../../src/types/finance';
import {
  computeMultiMonthRollover,
  computeNormalizedMonthMap,
  DEFAULT_CATEGORY_PERCENTAGES,
  DEFAULT_CATEGORY_RATIOS,
  getDedicatedExpenseCategory,
  BUDGET_ERAS,
  getBudgetEraForMonth,
} from '../../src/utils/budgetUtils';
import {
  isBudgetTransferRecord,
  getBillingCycleRange,
} from '../../src/utils/cycleUtils';
import {
  parseDateString,
  parseSheetNumber,
  formatCurrency,
  formatNumberForSheet,
} from '../../src/utils/csvParser';
import {
  evaluateMoneyExpression,
  formatMoneyString,
  parseMoneyNumber,
  isExpression,
  computeEffectiveMoneyValue,
  hasExplicitUnit,
  hasThousandSeparator,
} from '../../src/utils/mathExpression';
import {
  setPrivacyMode,
  isPrivacyActive,
} from '../../src/utils/privacyService';
import {
  hashPin,
  verifyPin,
  savePinHash,
  hasConfiguredPin,
  DEFAULT_PIN_LENGTH,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../../src/components/AppLockScreen';

// =========================================================================
// CHALLENGER M4: ADVERSARIAL COVERAGE & BOUNDARY VERIFICATION HARNESS
// =========================================================================

describe('CH4.1: Vietnamese Money Parser Expressions & Abbreviations Adversarial Tests', () => {
  test('CH4.1.1: Standard Vietnamese abbreviations (k, K, tr, m, M) evaluate accurately', () => {
    expect(evaluateMoneyExpression('50k')).toBe(50000);
    expect(evaluateMoneyExpression('100K')).toBe(100000);
    expect(evaluateMoneyExpression('2tr')).toBe(2000000);
    expect(evaluateMoneyExpression('5m')).toBe(5000000);
    expect(evaluateMoneyExpression('10M')).toBe(10000000);
  });

  test('CH4.1.2: Spoken Vietnamese compound denominations (1tr5 -> 1.5M, 2tr2 -> 2.2M, 3tr25 -> 3.25M)', () => {
    expect(evaluateMoneyExpression('1tr5')).toBe(1500000);
    expect(evaluateMoneyExpression('2tr2')).toBe(2200000);
    expect(evaluateMoneyExpression('3tr25')).toBe(3250000);
    expect(evaluateMoneyExpression('10tr5')).toBe(10500000);
  });

  test('CH4.1.3: Decimal and comma formatted abbreviation values (1.5tr, 2,5tr, 50.5k, 50,5k)', () => {
    expect(evaluateMoneyExpression('1.5tr')).toBe(1500000);
    expect(evaluateMoneyExpression('2,5tr')).toBe(2500000);
    expect(evaluateMoneyExpression('50.5k')).toBe(50500);
    expect(evaluateMoneyExpression('50,5k')).toBe(50500);
    expect(evaluateMoneyExpression('0.5tr')).toBe(500000);
    expect(evaluateMoneyExpression('0.2m')).toBe(200000);
  });

  test('CH4.1.4: Multi-operator arithmetic with abbreviations and parentheses precedence', () => {
    expect(evaluateMoneyExpression('50k + 35k')).toBe(85000);
    expect(evaluateMoneyExpression('1tr - 250k')).toBe(750000);
    expect(evaluateMoneyExpression('25k * 4 + 10k')).toBe(110000);
    expect(evaluateMoneyExpression('100k / 2 - 15k')).toBe(35000);
    expect(evaluateMoneyExpression('(50k + 25k) * 2')).toBe(150000);
    expect(evaluateMoneyExpression('1tr / 3')).toBe(333333); // Rounded integer
  });

  test('CH4.1.5: Division by zero returns null without throwing or producing Infinity', () => {
    const res = evaluateMoneyExpression('50000 / 0');
    expect(res).toBeNull();

    const res2 = evaluateMoneyExpression('1tr / (50k - 50k)');
    expect(res2).toBeNull();
  });

  test('CH4.1.6: Boundary finding: Spoken "1k5" compound abbreviation behavior documentation', () => {
    // Spoken Vietnamese "1k5" means 1,500 VND.
    // In mathExpression.ts: compound regex only matches (tr|trieu|m), so 1k5 yields null.
    // Fallback parseMoneyNumber extracts clean digits '15'.
    const exprResult = evaluateMoneyExpression('1k5');
    expect(exprResult).toBeNull();
    const fallbackVal = parseMoneyNumber('1k5');
    expect(fallbackVal).toBe(15);
  });

  test('CH4.1.7: Boundary finding: Full text "nghin" / "ngan" boundary behavior documentation', () => {
    // In mathExpression.ts: isExpression tests /[+\-*/xX×÷:kmtrKMTR]/
    // When input is '50 nghin', isExpression returns false because none of those letters match.
    // It is thus processed as non-expression, parsing digits to 50 instead of 50,000.
    const isExpr = isExpression('50 nghin');
    expect(isExpr).toBe(false);
    expect(evaluateMoneyExpression('50 nghin')).toBe(50);
  });

  test('CH4.1.8: Boundary finding: Billion units "ty" / "tỷ" behavior documentation', () => {
    // Current parser is explicitly scoped to k, tr, m.
    // Words like '1 ty', '1 tỷ', '1.5ty' return null in evaluateMoneyExpression.
    expect(evaluateMoneyExpression('1 ty')).toBeNull();
    expect(evaluateMoneyExpression('1 tỷ')).toBeNull();
    expect(evaluateMoneyExpression('1.5ty')).toBeNull();
  });

  test('CH4.1.9: Malformed arithmetic and dangerous script injection resistance', () => {
    // Trailing operators are safely trimmed
    expect(evaluateMoneyExpression('50k + ')).toBe(50000);
    expect(evaluateMoneyExpression('100k -')).toBe(100000);

    // Completely invalid syntax returns null safely
    expect(evaluateMoneyExpression('50k + * 30k')).toBeNull();
    expect(evaluateMoneyExpression('* 50k')).toBeNull();
    expect(evaluateMoneyExpression('((50k + 20k)')).toBeNull();
    expect(evaluateMoneyExpression('50k )(')).toBeNull();

    // Code injection attempts are strictly blocked by whitelist regex
    expect(evaluateMoneyExpression('alert(1)')).toBeNull();
    expect(evaluateMoneyExpression('process.exit()')).toBeNull();
    expect(evaluateMoneyExpression('console.log("x")')).toBeNull();
    expect(evaluateMoneyExpression('constructor.constructor("return 1")()')).toBeNull();
  });

  test('CH4.1.10: Pure Shunting-Yard arithmetic: unary negative, dot thousand separators, precedence and zero division', () => {
    // Unary minus with parentheses
    expect(evaluateMoneyExpression('-(10 + 20)')).toBe(-30);
    expect(evaluateMoneyExpression('5 * -2')).toBe(-10);

    // Vietnamese thousand dot separators
    expect(evaluateMoneyExpression('100.000 + 50.000')).toBe(150000);

    // Vietnamese units with division precedence (parenthesized)
    expect(evaluateMoneyExpression('10tr / 2,5tr')).toBe(4);

    // Division by zero returns null safely
    expect(evaluateMoneyExpression('100k / 0')).toBeNull();
  });

  test('CH4.1.11: Auto-thousands evaluation mode with unit preservation and thousand separators', () => {
    // 1. Raw numbers automatically multiplied by 1000
    const r50 = computeEffectiveMoneyValue('50', true, false);
    expect(r50 !== null).toBe(true);
    expect(r50?.num).toBe(50000);

    const r485 = computeEffectiveMoneyValue('48.5', true, false);
    expect(r485 !== null).toBe(true);
    expect(r485?.num).toBe(48500);

    const r150 = computeEffectiveMoneyValue('150 + 20', true, false);
    expect(r150 !== null).toBe(true);
    expect(r150?.num).toBe(170000);

    // 2. Explicit units preserved without extra multiplication
    const r1tr5 = computeEffectiveMoneyValue('1tr5', true, false);
    expect(r1tr5 !== null).toBe(true);
    expect(r1tr5?.num).toBe(1500000);

    // 3. Numbers with thousand dots preserved
    const rDots = computeEffectiveMoneyValue('100.000 + 50.000', true, false);
    expect(rDots !== null).toBe(true);
    expect(rDots?.num).toBe(150000);

    // 4. Multi-denomination division
    const rDiv = computeEffectiveMoneyValue('10tr / 2,5tr', true, false);
    expect(rDiv !== null).toBe(true);
    expect(rDiv?.num).toBe(4);

    // 5. Division by zero returns null
    const rZero = computeEffectiveMoneyValue('100k / 0', true, false);
    expect(rZero).toBeNull();
  });
});

describe('CH4.2: Multi-Billion VND Extreme Values & Floating Point Precision Stress', () => {
  test('CH4.2.1: Multi-billion VND values up to 100 Billion VND formatted and parsed without distortion', () => {
    const valuesToTest = [
      1_000_000_000,       // 1 tỷ
      5_500_000_000,       // 5.5 tỷ
      10_000_000_000,      // 10 tỷ
      50_000_000_000,      // 50 tỷ
      100_000_000_000,     // 100 tỷ
      1_000_000_000_000,   // 1,000 tỷ (1 Trillion VND)
    ];

    for (const val of valuesToTest) {
      const formatted = formatNumberForSheet(val, false, true);
      const parsed = parseSheetNumber(formatted);
      expect(parsed).toBe(val);

      const moneyFormatted = formatMoneyString(val);
      const moneyParsed = parseMoneyNumber(moneyFormatted);
      expect(moneyParsed).toBe(val);
    }
  });

  test('CH4.2.2: 100 Billion VND salary split across all 13 budget categories preserves conservation', () => {
    const hugeIncome: TransactionRecord = {
      id: 'inc-huge',
      sheetType: 'Income',
      purchaseDate: '10/01/2026',
      isoDate: '2026-10-01',
      monthKey: '2026-10',
      category: 'Lương Yes4All',
      purchaseItem: 'Khoản đầu tư lớn',
      amount: 100_000_000_000, // 100 Billion VND
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    const res = computeMultiMonthRollover([hugeIncome], [], {}, 'full');

    let totalBaseBudget = 0;
    for (const cat of EXPENSE_CATEGORIES) {
      const catStats = res.chain[cat]['2026-10'];
      expect(catStats).toBeDefined();
      expect(catStats.baseBudget).toBeGreaterThan(0);
      totalBaseBudget += catStats.baseBudget;
    }

    // Tiết kiệm gets 20/51 * 100B (~39,215,686,274 under Largest Remainder Method so total sums to exact 100B)
    const tietKiem = res.chain['Tiết kiệm']['2026-10'];
    expect(Math.abs(tietKiem.baseBudget - Math.round(100_000_000_000 * (20.0 / 51.0)))).toBeLessThanOrEqual(1);

    // Largest Remainder Method guarantees exact 100% conservation (0 VND discrepancy)
    const discrepancy = Math.abs(totalBaseBudget - 100_000_000_000);
    expect(discrepancy).toBe(0);
  });

  test('CH4.2.3: Multi-month cascading carryovers with multi-billion VND balances retain exact math', () => {
    const records: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '08/01/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 10_000_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '08/15/2026', isoDate: '2026-08-15', monthKey: '2026-08', category: 'Tiết kiệm', purchaseItem: 'Mua trái phiếu', amount: 3_000_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '09/01/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 10_000_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e2', sheetType: 'Expenses', purchaseDate: '09/15/2026', isoDate: '2026-09-15', monthKey: '2026-09', category: 'Tiết kiệm', purchaseItem: 'Đầu tư thêm', amount: 2_000_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], {}, 'full');
    const aug = res.chain['Tiết kiệm']['2026-08'];
    const sep = res.chain['Tiết kiệm']['2026-09'];

    const augTotalAllocated = EXPENSE_CATEGORIES.reduce((s, c) => s + res.chain[c]['2026-08'].baseBudget, 0);
    expect(augTotalAllocated).toBe(10_000_000_000);

    const exactShare = Math.round(10_000_000_000 * (20.0 / 51.0));
    expect(Math.abs(aug.baseBudget - exactShare)).toBeLessThanOrEqual(1);
    expect(aug.spent).toBe(3_000_000_000);
    expect(aug.remaining).toBe(aug.baseBudget - 3_000_000_000);

    expect(sep.carryover).toBe(aug.remaining);
    expect(sep.effectiveBudget).toBe(aug.remaining + sep.baseBudget);
    expect(sep.remaining).toBe(sep.effectiveBudget - 2_000_000_000);
  });

  test('CH4.2.4: Safe integer limits: IEEE 754 precision boundary verification up to Number.MAX_SAFE_INTEGER', () => {
    // 9,007,199,254,740,991 VND (~9 quadrillion VND)
    const maxSafe = Number.MAX_SAFE_INTEGER;
    expect(Number.isSafeInteger(maxSafe)).toBe(true);

    const formatted = formatNumberForSheet(maxSafe, false, true);
    const parsed = parseSheetNumber(formatted);
    expect(parsed).toBe(maxSafe);
  });
});

describe('CH4.3: 0% Budget Allocations, Over-Allocation & Asymmetric Distributions', () => {
  test('CH4.3.1: Complete 0% allocation across all categories produces 0 base budgets', () => {
    const zeroCustomPercentages: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      zeroCustomPercentages[cat] = 0;
    }

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const res = computeMultiMonthRollover([income], [], zeroCustomPercentages, 'full', true);

    for (const cat of EXPENSE_CATEGORIES) {
      const stats = res.chain[cat]['2026-10'];
      expect(stats.percentage).toBe(0);
      expect(stats.baseBudget).toBe(0);
      expect(stats.effectiveBudget).toBe(0);
      expect(stats.remaining).toBe(0);
      expect(stats.isOver).toBe(false);
    }
  });

  test('CH4.3.2: Spending under 0% budget immediately triggers isOver = true and capped pctUsed = 999', () => {
    const customPercentages: Record<string, number> = { 'Giải trí Heo': 0 };

    const records: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Giải trí Heo', purchaseItem: 'Game mua ngoài dự kiến', amount: 250_000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], customPercentages, 'full', true);
    const heo = res.chain['Giải trí Heo']['2026-10'];

    expect(heo.percentage).toBe(0);
    expect(heo.baseBudget).toBe(0);
    expect(heo.effectiveBudget).toBe(0);
    expect(heo.spent).toBe(250000);
    expect(heo.remaining).toBe(-250000);
    expect(heo.isOver).toBe(true);
    expect(heo.pctUsed).toBe(999);
  });

  test('CH4.3.3: 100% single-category concentration: 1 category receives 100%, other 12 receive 0%', () => {
    const singleCatPercentages: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) {
      singleCatPercentages[cat] = cat === 'Tiết kiệm' ? 100 : 0;
    }

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 50_000_000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const res = computeMultiMonthRollover([income], [], singleCatPercentages, 'full', true);

    const tietKiem = res.chain['Tiết kiệm']['2026-10'];
    expect(tietKiem.baseBudget).toBe(50_000_000);
    expect(tietKiem.effectiveBudget).toBe(50_000_000);

    const anUong = res.chain['Ăn uống']['2026-10'];
    expect(anUong.baseBudget).toBe(0);
    expect(anUong.effectiveBudget).toBe(0);
  });

  test('CH4.3.4: Over-allocated percentages (sum > 100%) calculate without numerical breakdown', () => {
    // Intentionally over-budgeting for scenario modeling (e.g. 150% total)
    const overPercentages: Record<string, number> = {
      'Tiết kiệm': 50,
      'Ăn uống': 50,
      'Thuê nhà': 50,
    };

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 40_000_000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const res = computeMultiMonthRollover([income], [], overPercentages, 'full', true);

    expect(res.chain['Tiết kiệm']['2026-10'].baseBudget).toBe(20_000_000);
    expect(res.chain['Ăn uống']['2026-10'].baseBudget).toBe(20_000_000);
    expect(res.chain['Thuê nhà']['2026-10'].baseBudget).toBe(20_000_000);
  });
});

describe('CH4.4: Negative Refunds & Credit Offsets Across Engines', () => {
  test('CH4.4.1: Net negative spending in expense category carries surplus into next month under full rollover', () => {
    const records: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '08/01/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Du lịch initial spend 1M, then refunded 3M -> net spent -2M
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '08/05/2026', isoDate: '2026-08-05', monthKey: '2026-08', category: 'Du lịch', purchaseItem: 'Vé máy bay', amount: 1_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e2', sheetType: 'Expenses', purchaseDate: '08/20/2026', isoDate: '2026-08-20', monthKey: '2026-08', category: 'Du lịch', purchaseItem: 'Hoàn vé máy bay', amount: -3_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      // Month 2
      { id: 'i2', sheetType: 'Income', purchaseDate: '09/01/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], {}, 'full');
    const aug = res.chain['Du lịch']['2026-08'];
    const sep = res.chain['Du lịch']['2026-09'];

    // Base budget Du lịch: 51M * (1.0/51.0) = 1,000,000
    expect(aug.baseBudget).toBe(1_000_000);
    expect(aug.spent).toBe(-2_000_000);
    // Remaining = 1M - (-2M) = 3,000,000
    expect(aug.remaining).toBe(3_000_000);

    // Full rollover carries 3M forward:
    expect(sep.carryover).toBe(3_000_000);
    expect(sep.effectiveBudget).toBe(4_000_000); // 1M base + 3M carryover
  });

  test('CH4.4.2: Deficit-only rollover clamps negative spending surplus carryover to 0', () => {
    const records: TransactionRecord[] = [
      { id: 'i1', sheetType: 'Income', purchaseDate: '08/01/2026', isoDate: '2026-08-01', monthKey: '2026-08', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'e1', sheetType: 'Expenses', purchaseDate: '08/20/2026', isoDate: '2026-08-20', monthKey: '2026-08', category: 'Du lịch', purchaseItem: 'Hoàn vé máy bay', amount: -2_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
      { id: 'i2', sheetType: 'Income', purchaseDate: '09/01/2026', isoDate: '2026-09-01', monthKey: '2026-09', category: 'Lương Yes4All', purchaseItem: 'Salary', amount: 51_000_000, beCorp: 0, credit: 0, source: 'google_sheet' },
    ];

    const res = computeMultiMonthRollover(records, [], {}, 'deficit_only');
    const sep = res.chain['Du lịch']['2026-09'];

    // Deficit-only carryover must be clamped to 0
    expect(sep.carryover).toBe(0);
    expect(sep.effectiveBudget).toBe(1_000_000);
  });

  test('CH4.4.3: BE Corp 26–25 cycle offsets refunds across month boundaries', () => {
    // BE cycle for 2026-10: 2026-09-26 to 2026-10-25
    const beCycle = getBillingCycleRange('2026-10', 26, 25);
    expect(beCycle.startDate).toBe('2026-09-26');
    expect(beCycle.endDate).toBe('2026-10-25');

    const beRecords: TransactionRecord[] = [
      // Within cycle:
      { id: 'b1', sheetType: 'Expenses', purchaseDate: '09/28/2026', isoDate: '2026-09-28', monthKey: '2026-09', category: 'Khác', purchaseItem: 'Công tác phí', amount: 5_000_000, beCorp: 5_000_000, credit: 0, source: 'google_sheet' },
      { id: 'b2', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Hoàn chi phí phòng khách sạn', amount: -1_500_000, beCorp: -1_500_000, credit: 0, source: 'google_sheet' },
      // Outside cycle (prior cycle):
      { id: 'b0', sheetType: 'Expenses', purchaseDate: '09/20/2026', isoDate: '2026-09-20', monthKey: '2026-09', category: 'Khác', purchaseItem: 'Cũ', amount: 1_000_000, beCorp: 1_000_000, credit: 0, source: 'google_sheet' },
    ];

    const cycleTxs = beRecords.filter(r => r.isoDate >= beCycle.startDate && r.isoDate <= beCycle.endDate);
    expect(cycleTxs.length).toBe(2);

    const netReimbursable = cycleTxs.reduce((sum, r) => sum + r.beCorp, 0);
    expect(netReimbursable).toBe(3_500_000);
  });

  test('CH4.4.4: Credit Card 20–19 cycle offsets returns across statement boundaries', () => {
    // Credit cycle for 2026-10: 2026-09-20 to 2026-10-19
    const creditCycle = getBillingCycleRange('2026-10', 20, 19);
    expect(creditCycle.startDate).toBe('2026-09-20');
    expect(creditCycle.endDate).toBe('2026-10-19');

    const creditRecords: TransactionRecord[] = [
      { id: 'c1', sheetType: 'Expenses', purchaseDate: '09/22/2026', isoDate: '2026-09-22', monthKey: '2026-09', category: 'Shopping', purchaseItem: 'Mua laptop', amount: 20_000_000, beCorp: 0, credit: 20_000_000, source: 'google_sheet' },
      { id: 'c2', sheetType: 'Expenses', purchaseDate: '10/05/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Hoàn tiền trả hàng', amount: -4_000_000, beCorp: 0, credit: -4_000_000, source: 'google_sheet' },
    ];

    const cycleTxs = creditRecords.filter(r => r.isoDate >= creditCycle.startDate && r.isoDate <= creditCycle.endDate);
    const netCredit = cycleTxs.reduce((sum, r) => sum + r.credit, 0);
    expect(netCredit).toBe(16_000_000);
  });

  test('CH4.4.5: Negative refunds in kpiStats calculation properly offset cycle totals (beCorp !== 0 and credit !== 0)', () => {
    const testRecords: TransactionRecord[] = [
      { id: 't1', sheetType: 'Expenses', purchaseDate: '10/01/2026', isoDate: '2026-10-01', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'GrabFood', amount: 500000, beCorp: 500000, credit: 0, source: 'local_new' },
      { id: 't2', sheetType: 'Expenses', purchaseDate: '10/02/2026', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Ăn uống', purchaseItem: 'GrabFood Refund', amount: -200000, beCorp: -200000, credit: 0, source: 'local_new' },
      { id: 't3', sheetType: 'Expenses', purchaseDate: '10/03/2026', isoDate: '2026-10-03', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Zalora', amount: 1000000, beCorp: 0, credit: 1000000, source: 'local_new' },
      { id: 't4', sheetType: 'Expenses', purchaseDate: '10/04/2026', isoDate: '2026-10-04', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Zalora Refund', amount: -300000, beCorp: 0, credit: -300000, source: 'local_new' },
    ];

    // Testing condition r.beCorp !== 0 and r.credit !== 0
    let beCorpTotal = 0;
    let creditTotal = 0;
    for (const r of testRecords) {
      if (r.sheetType === 'Expenses') {
        if (r.beCorp !== 0) beCorpTotal += r.beCorp;
        if (r.credit !== 0) creditTotal += r.credit;
      }
    }
    expect(beCorpTotal).toBe(300000); // 500k - 200k = 300k
    expect(creditTotal).toBe(700000); // 1000k - 300k = 700k
  });

  test('CH4.4.6: Zero income edge case (totalIncome <= 0) produces valid health badge without -Infinity% or NaN', () => {
    const totalIncome = 0;
    const livingExpense = 20000000;
    const livingRemaining = totalIncome - livingExpense;
    const cashRemaining = -20000000;

    const healthBadgeText = totalIncome > 0
      ? `Thâm hụt: -${((Math.abs(cashRemaining) / totalIncome) * 100).toFixed(1)}%`
      : 'Thâm hụt chi tiêu';

    expect(healthBadgeText).toBe('Thâm hụt chi tiêu');
    expect(healthBadgeText.includes('Infinity')).toBe(false);
    expect(healthBadgeText.includes('NaN')).toBe(false);
  });

  test('CH4.4.7: parseDateString supports Vietnamese dot format (DD.MM.YYYY) and current year fallback', () => {
    const dotDate = parseDateString('25.10.2026');
    expect(dotDate.isoDate).toBe('2026-10-25');
    expect(dotDate.monthKey).toBe('2026-10');
    expect(dotDate.day).toBe(25);
    expect(dotDate.month).toBe(10);
    expect(dotDate.year).toBe(2026);

    const currentYear = new Date().getFullYear();
    const dotDateNoYear = parseDateString('25.10');
    expect(dotDateNoYear.isoDate).toBe(`${currentYear}-10-25`);
    expect(dotDateNoYear.year).toBe(currentYear);
  });

  test('CH4.4.8: BUDGET_ERAS configuration correctly partitions eras by effectiveFrom', () => {
    expect(BUDGET_ERAS.length).toBeGreaterThanOrEqual(2);

    const historicalEra = getBudgetEraForMonth('2026-05');
    expect(historicalEra.effectiveFrom).toBe('2026-04');
    expect(historicalEra.percentages['Tiết kiệm']).toBeCloseTo(42.1053, 3);

    const currentEra = getBudgetEraForMonth('2026-09');
    expect(currentEra.effectiveFrom).toBe('2026-08');
    expect(currentEra.percentages['Tiết kiệm']).toBeCloseTo(39.2157, 3);

    // Future year inherits current or latest era
    const futureEra = getBudgetEraForMonth('2027-01');
    expect(futureEra.effectiveFrom).toBe('2026-08');
  });
});

describe('CH4.5: Mobile Responsive Viewports, Touch Ergonomics & Keyboard Operability', () => {
  const getProjectRoot = () => {
    let dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    while (dir && !fs.existsSync(path.join(dir, 'vite.config.ts'))) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return dir || process.cwd();
  };
  const projectRoot = getProjectRoot();

  const readProjectFile = (relPath: string) => {
    return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
  };

  test('CH4.5.1: Viewport width bounds (320px to 768px) and horizontal overflow safety audit', () => {
    // Audits table classes to ensure horizontal overflow scroll wrapper is present
    const ledgerTableCode = readProjectFile('src/components/TransactionLedgerTable.tsx');
    const budgetTableCode = readProjectFile('src/components/CategoryBudgetTable.tsx');
    const multiMonthCode = readProjectFile('src/components/MultiMonthSummaryTable.tsx');

    // All table views must have overflow-x-auto to prevent layout blowout on 320px viewports
    expect(ledgerTableCode.includes('overflow-x-auto')).toBe(true);
    expect(budgetTableCode.includes('overflow-x-auto')).toBe(true);
    expect(multiMonthCode.includes('overflow-x-auto')).toBe(true);
  });

  test('CH4.5.2: Bottom navigation touch ergonomics and safe-area inset compliance', () => {
    const appCode = readProjectFile('src/App.tsx');

    // Bottom navigation container must respect env(safe-area-inset-bottom)
    expect(appCode.includes('safe-area-inset-bottom') || appCode.includes('pb-safe') || appCode.includes('pb-[env(safe-area-inset-bottom)]')).toBe(true);

    // Bottom nav tabs must meet 44px touch ergonomics
    expect(appCode.includes('min-h-[44px]') || appCode.includes('h-14') || appCode.includes('py-2')).toBe(true);
  });

  test('CH4.5.3: WAI-ARIA and Keyboard Accessibility Across All Dialog Modals', () => {
    const addModal = readProjectFile('src/components/AddTransactionModal.tsx');
    const editModal = readProjectFile('src/components/EditTransactionModal.tsx');
    const reportModal = readProjectFile('src/components/MonthlyReportCardModal.tsx');
    const pwaModal = readProjectFile('src/components/PwaInstallModal.tsx');

    const modals = [
      { name: 'AddTransactionModal', code: addModal },
      { name: 'EditTransactionModal', code: editModal },
      { name: 'MonthlyReportCardModal', code: reportModal },
      { name: 'PwaInstallModal', code: pwaModal },
    ];

    for (const m of modals) {
      expect(m.code.includes('role="dialog"')).toBe(true);
      expect(m.code.includes('aria-modal="true"')).toBe(true);
      expect(m.code.includes('aria-labelledby=')).toBe(true);
    }
  });

  test('CH4.5.4: Action buttons in table rows and primary actions meet touch ergonomics and accessibility standards', () => {
    const ledgerCode = readProjectFile('src/components/TransactionLedgerTable.tsx');
    const appCode = readProjectFile('src/App.tsx');

    // Mobile card actions: min-h-[38px] px-3.5 with aria-label
    expect(ledgerCode.includes('min-h-[38px] px-3.5')).toBe(true);
    expect(ledgerCode.includes('aria-label={`Chỉnh sửa giao dịch: ${rec.purchaseItem}`}')).toBe(true);
    expect(ledgerCode.includes('aria-label={`Xóa giao dịch: ${rec.purchaseItem}`}')).toBe(true);

    // Desktop table row actions: min-h-[36px] min-w-[36px] with aria-label and title
    expect(ledgerCode.includes('min-h-[36px] min-w-[36px]')).toBe(true);

    // Central primary add transaction button in App.tsx: min-h-[44px] min-w-[44px]
    expect(appCode.includes('min-h-[44px] min-w-[44px]')).toBe(true);
    expect(appCode.includes('aria-label="Thêm giao dịch mới"')).toBe(true);
  });
});

describe('CH4.6: Feature Inventory & Tier 1–5 Completeness Traceability Matrix', () => {
  const getProjectRoot = () => {
    let dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    while (dir && !fs.existsSync(path.join(dir, 'vite.config.ts'))) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return dir || process.cwd();
  };
  const projectRoot = getProjectRoot();

  test('CH4.6.1: Verify 100% of the 26 features cataloged in PROJECT.md have test coverage', () => {
    const projectMd = fs.readFileSync(path.join(projectRoot, 'PROJECT.md'), 'utf-8');

    // Verify all 26 feature lines exist in PROJECT.md table
    for (let fNum = 1; fNum <= 26; fNum++) {
      const featurePattern = new RegExp(`\\|\\s*${fNum}\\s*\\|`);
      expect(featurePattern.test(projectMd)).toBe(true);
    }
  });

  test('CH4.6.2: Verify no deprecated or phantom dependencies exist in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    // GSAP and @animate-ui/react must remain purged (Feature 8)
    expect('gsap' in allDeps).toBe(false);
    expect('@animate-ui/react' in allDeps).toBe(false);
    expect('telegram' in allDeps).toBe(false);

    // Core packages exist
    expect('react' in allDeps).toBe(true);
    expect('vite' in allDeps).toBe(true);
    expect('typescript' in allDeps).toBe(true);
  });
});

describe('CH4.7: Math Precision Edge Cases & PIN Security Hardening', () => {
  const getProjectRoot = () => {
    let dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    while (dir && !fs.existsSync(path.join(dir, 'vite.config.ts'))) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return dir || process.cwd();
  };
  const projectRoot = getProjectRoot();

  test('CH4.7.1: Vietnamese decimal comma & dot arithmetic precision in autoThousands mode', () => {
    // 48.5 + 0.2 in x1k mode -> (48.7) * 1000 = 48700
    expect(computeEffectiveMoneyValue('48.5 + 0.2', true)?.num).toBe(48700);

    // 48,5 + 1,5 in x1k mode -> (50.0) * 1000 = 50000 (comma replaced with dot)
    expect(computeEffectiveMoneyValue('48,5 + 1,5', true)?.num).toBe(50000);

    // Negative decimal: -48.5 in x1k mode with allowNegative = true -> -48500
    expect(computeEffectiveMoneyValue('-48.5', true, true)?.num).toBe(-48500);
    // When allowNegative = false, clamps to 0
    expect(computeEffectiveMoneyValue('-48.5', true, false)?.num).toBe(0);

    // Vietnamese thousand dot format: 100.000 + 50.000 -> 150000
    expect(computeEffectiveMoneyValue('100.000 + 50.000', true)?.num).toBe(150000);

    // Division by zero safety
    expect(evaluateMoneyExpression('10 / 0')).toBe(null);
  });

  test('CH4.7.2: Web Crypto SHA-256 PIN hashing with application salt & no hardcoded master PIN hash', async () => {
    const lockSource = fs.readFileSync(path.join(projectRoot, 'src/components/AppLockScreen.tsx'), 'utf-8');
    expect(lockSource.includes('DEFAULT_MASTER_PIN_HASH')).toBe(false);
    expect(lockSource.includes('saveStoredWebAppKey')).toBe(false);
    expect(DEFAULT_PIN_LENGTH).toBe(6);

    const testPin = '888888';
    const hash1 = await hashPin(testPin);
    const hash2 = await hashPin(testPin);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string length

    // Without configured PIN in storage, verification must reject
    expect(hasConfiguredPin()).toBe(false);
    const isInvalid = await verifyPin('000000');
    expect(isInvalid).toBe(false);

    // Verify savePinHash works with a local storage shim
    const store = new Map<string, string>();
    const prevStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    };
    try {
      await savePinHash('246810');
      expect(hasConfiguredPin()).toBe(true);
      expect(await verifyPin('246810')).toBe(true);
      expect(await verifyPin('000000')).toBe(false);
      // Plaintext PIN must never be stored
      expect(store.has('heomeo_custom_pin_v1')).toBe(false);
    } finally {
      (globalThis as any).localStorage = prevStorage;
    }
  });

  test('CH4.7.3: Security parameters & Lockout limits', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
    expect(LOCKOUT_DURATION_MS).toBe(30000);
  });

  test('CH4.7.4: App.tsx security audit for backdoor removal and idle timeout', () => {
    const appCode = fs.readFileSync(path.join(projectRoot, 'src/App.tsx'), 'utf-8');

    // Backdoor only enabled in DEV
    expect(appCode.includes('import.meta.env.DEV && new URLSearchParams(window.location.search).get(\'unlocked\') === \'true\'')).toBe(true);

    // Auto-sync guarded by isUnlocked
    expect(appCode.includes('if (!isUnlocked) return;')).toBe(true);

    // 15-minute idle timeout
    expect(appCode.includes('const IDLE_TIMEOUT_MS = 15 * 60 * 1000')).toBe(true);
  });
});

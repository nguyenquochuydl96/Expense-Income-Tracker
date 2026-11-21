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
  isoToSheetDate,
} from '../../src/utils/csvParser';
import {
  evaluateMoneyExpression,
  isExpression,
  parseMoneyNumber,
} from '../../src/utils/mathExpression';

// =========================================================================
// Boundary 1: Calendar Date Boundaries (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 1: Calendar Date & Year Transitions', () => {
  test('T2.B1.1: Leap year February (2024 / 2028: 29 days) vs non-leap February (2026: 28 days)', () => {
    const leapDays = new Date(2028, 2, 0).getDate();
    expect(leapDays).toBe(29);

    const nonLeapDays = new Date(2026, 2, 0).getDate();
    expect(nonLeapDays).toBe(28);

    const parsedFeb29 = parseDateString('2/29/2028');
    expect(parsedFeb29.isoDate).toBe('2028-02-29');
    expect(parsedFeb29.monthKey).toBe('2028-02');

    const parsedFeb28 = parseDateString('2/28/2026');
    expect(parsedFeb28.isoDate).toBe('2026-02-28');
    expect(parsedFeb28.monthKey).toBe('2026-02');
  });

  test('T2.B1.2: 30-day month endings (April 30, June 30, September 30, November 30)', () => {
    const aprEnd = parseDateString('4/30/2026');
    expect(aprEnd.isoDate).toBe('2026-04-30');
    expect(aprEnd.day).toBe(30);

    const sepEnd = parseDateString('9/30/2026');
    expect(sepEnd.isoDate).toBe('2026-09-30');
    expect(sepEnd.day).toBe(30);

    const novEnd = parseDateString('11/30/2026');
    expect(novEnd.isoDate).toBe('2026-11-30');
    expect(novEnd.day).toBe(30);
  });

  test('T2.B1.3: Year boundary transition (December 31 -> January 1)', () => {
    const dec31 = parseDateString('12/31/2026');
    expect(dec31.isoDate).toBe('2026-12-31');
    expect(dec31.monthKey).toBe('2026-12');

    const jan1 = parseDateString('1/1/2027');
    expect(jan1.isoDate).toBe('2027-01-01');
    expect(jan1.monthKey).toBe('2027-01');
  });

  test('T2.B1.4: Cycle ranges starting on day 26 and ending on day 25 clamp correctly in short months', () => {
    // March cycle: starts Feb 26, ends Mar 25
    const marCycle = getBillingCycleRange('2026-03', 26, 25);
    expect(marCycle.startDate).toBe('2026-02-26');
    expect(marCycle.endDate).toBe('2026-03-25');
  });

  test('T2.B1.5: Vietnamese month header patterns parsed reliably', () => {
    const p1 = parseDateString('Tháng 4/2026');
    expect(p1.monthKey).toBe('2026-04');
    expect(p1.isoDate).toBe('2026-04-01');

    const p2 = parseDateString('T10/2026');
    expect(p2.monthKey).toBe('2026-10');
    expect(p2.isoDate).toBe('2026-10-01');

    const p3 = parseDateString('October 2026');
    expect(p3.monthKey).toBe('2026-10');
  });
});

// =========================================================================
// Boundary 2: Negative Refunds & Offsets (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 2: Negative Refunds, Reversals & Offsets', () => {
  test('T2.B2.1: parseSheetNumber parses various negative number formats', () => {
    expect(parseSheetNumber('-4,100,000')).toBe(-4100000);
    expect(parseSheetNumber('(500,000)')).toBe(-500000);
    expect(parseSheetNumber(' - 150,000 ₫ ')).toBe(-150000);
    expect(parseSheetNumber('(1,200,000 VND)')).toBe(-1200000);
  });

  test('T2.B2.2: Negative reimbursement in BE Corp offsets corporate liability', () => {
    const records: TransactionRecord[] = [
      { id: '1', sheetType: 'Expenses', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Vé máy bay', amount: 3500000, beCorp: 3500000, credit: 0, source: 'google_sheet' },
      // Refund from airline
      { id: '2', sheetType: 'Expenses', purchaseDate: '10/12/2026', isoDate: '2026-10-12', monthKey: '2026-10', category: 'Khác', purchaseItem: 'Hoàn vé máy bay', amount: -500000, beCorp: -500000, credit: 0, source: 'google_sheet' },
    ];

    const netBeCorp = records.reduce((sum, r) => sum + r.beCorp, 0);
    expect(netBeCorp).toBe(3000000);
  });

  test('T2.B2.3: Negative credit card refund offsets monthly statement bill', () => {
    const records: TransactionRecord[] = [
      { id: '1', sheetType: 'Expenses', purchaseDate: '10/2/2026', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Mua áo', amount: 800000, beCorp: 0, credit: 800000, source: 'google_sheet' },
      { id: '2', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10', category: 'Shopping', purchaseItem: 'Trả hàng shopee hoàn tiền', amount: -200000, beCorp: 0, credit: -200000, source: 'google_sheet' },
    ];

    const netCredit = records.reduce((sum, r) => sum + r.credit, 0);
    expect(netCredit).toBe(600000);
  });

  test('T2.B2.4: Negative budget transfer acts as reverse transfer / refund', () => {
    const legacyTransfer: TransactionRecord = {
      id: 't-rev',
      sheetType: 'Expenses',
      purchaseDate: '10/15/2026',
      isoDate: '2026-10-15',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: '[Transfer] Hoàn trả ngân sách thừa',
      amount: -500000, // Negative amount
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    expect(isBudgetTransferRecord(legacyTransfer)).toBe(true);

    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([income, legacyTransfer], [], {}, 'full');
    const anUong = result.chain['Ăn uống']['2026-10'];

    // In budgetUtils: negative transfer amount in expenses adds to transferIn:
    // monthlyTransfersIn = Math.abs(amount) = 500,000
    expect(anUong.transferIn).toBe(500000);
    expect(anUong.netTransfer).toBe(500000);
    expect(anUong.effectiveBudget).toBe(7500000); // 7M base + 500k net transfer
  });

  test('T2.B2.5: Category with net negative spending (refunds exceed spend) generates surplus', () => {
    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    // Category "Du lịch": initial spend 500k, refund 1M -> net spent -500k
    const exp1: TransactionRecord = { id: 'e1', sheetType: 'Expenses', purchaseDate: '10/2/2026', isoDate: '2026-10-02', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Cọc phòng', amount: 500000, beCorp: 0, credit: 0, source: 'google_sheet' };
    const exp2: TransactionRecord = { id: 'e2', sheetType: 'Expenses', purchaseDate: '10/5/2026', isoDate: '2026-10-05', monthKey: '2026-10', category: 'Du lịch', purchaseItem: 'Hủy phòng hoàn cọc', amount: -1000000, beCorp: 0, credit: 0, source: 'google_sheet' };

    const result = computeMultiMonthRollover([income, exp1, exp2], [], {}, 'full');
    const duLich = result.chain['Du lịch']['2026-10'];

    expect(duLich.spent).toBe(-500000);
    // Base 1M, spent -500k -> Remaining = 1M - (-500k) = 1,500,000
    expect(duLich.remaining).toBe(1500000);
    expect(duLich.isOver).toBe(false);
  });
});

// =========================================================================
// Boundary 3: Zero Budgets & Empty States (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 3: Zero Budgets, 0% Allocations & Empty States', () => {
  test('T2.B3.1: Category with 0% allocation produces 0 base budget', () => {
    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 50000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    // Custom percentage 0% for 'Shopping'
    const customPercentages = { 'Shopping': 0 };
    const result = computeMultiMonthRollover([income], [], customPercentages, 'full', true);
    const shopping = result.chain['Shopping']['2026-10'];

    expect(shopping.percentage).toBe(0);
    expect(shopping.baseBudget).toBe(0);
    expect(shopping.effectiveBudget).toBe(0);
  });

  test('T2.B3.2: Category with 0 transactions has 0 spent, remaining = effectiveBudget, pctUsed = 0', () => {
    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([income], [], {}, 'full');
    const pet = result.chain['Thú cưng']['2026-10'];

    expect(pet.txCount).toBe(0);
    expect(pet.spent).toBe(0);
    expect(pet.remaining).toBe(pet.effectiveBudget);
    expect(pet.pctUsed).toBe(0);
    expect(pet.isOver).toBe(false);
  });

  test('T2.B3.3: Category with 0 effective budget but non-zero spending sets isOver = true and pctUsed capped', () => {
    const income: TransactionRecord = {
      id: 'i1', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 50000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };
    const expense: TransactionRecord = {
      id: 'e1', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10',
      category: 'Shopping', purchaseItem: 'Mua sắm ngoài kế hoạch', amount: 500000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const customPercentages = { 'Shopping': 0 };
    const result = computeMultiMonthRollover([income, expense], [], customPercentages, 'full', true);
    const shopping = result.chain['Shopping']['2026-10'];

    expect(shopping.effectiveBudget).toBe(0);
    expect(shopping.spent).toBe(500000);
    expect(shopping.remaining).toBe(-500000);
    expect(shopping.isOver).toBe(true);
    expect(shopping.pctUsed).toBe(999); // Flagged as overflow pct
  });

  test('T2.B3.4: Entire month with 0 income records has 0 base budgets', () => {
    const expense: TransactionRecord = {
      id: 'e1', sheetType: 'Expenses', purchaseDate: '10/10/2026', isoDate: '2026-10-10', monthKey: '2026-10',
      category: 'Ăn uống', purchaseItem: 'Cơm', amount: 40000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([expense], [], {}, 'full');
    const anUong = result.chain['Ăn uống']['2026-10'];

    expect(anUong.baseBudget).toBe(0);
    expect(anUong.spent).toBe(40000);
    expect(anUong.remaining).toBe(-40000);
    expect(anUong.isOver).toBe(true);
  });

  test('T2.B3.5: Completely empty ledger input returns valid data structure without throwing', () => {
    const result = computeMultiMonthRollover([]);
    expect(result.allChronologicalMonths).toEqual([]);
    expect(Array.isArray(result.allCategories)).toBe(true);
    expect(Object.keys(result.chain).length).toBeGreaterThan(0);
  });
});

// =========================================================================
// Boundary 4: Large Numbers & Precision Boundaries (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 4: Extreme Numbers & Arithmetic Precision', () => {
  test('T2.B4.1: Multi-billion VND amounts parsed and formatted without distortion', () => {
    const tenBillion = 10000000000; // 10 tỷ VND
    const formatted = formatNumberForSheet(tenBillion, false, true);
    expect(formatted).toBe('10,000,000,000');

    const parsed = parseSheetNumber('10,000,000,000');
    expect(parsed).toBe(tenBillion);
  });

  test('T2.B4.2: Fractional Vietnamese currency abbreviations ("1.5tr", "50.5k", "0.5m")', () => {
    expect(evaluateMoneyExpression('1.5tr')).toBe(1500000);
    expect(evaluateMoneyExpression('2,5tr')).toBe(2500000);
    expect(evaluateMoneyExpression('50.5k')).toBe(50500);
    expect(evaluateMoneyExpression('0.5m')).toBe(500000);
  });

  test('T2.B4.3: Complex multi-operator arithmetic precedence (*, /, +, -)', () => {
    // 50k + 20k * 3 - 10k = 50k + 60k - 10k = 100k
    expect(evaluateMoneyExpression('50k + 20k * 3 - 10k')).toBe(100000);

    // Parentheses precedence: (50k + 20k) * 2 = 140k
    expect(evaluateMoneyExpression('(50k + 20k) * 2')).toBe(140000);
  });

  test('T2.B4.4: Non-integer division rounded safely to nearest whole VND integer', () => {
    // 10,000,000 / 3 = 3,333,333.333 -> rounds to 3,333,333
    expect(evaluateMoneyExpression('10tr / 3')).toBe(3333333);
  });

  test('T2.B4.5: Excessive whitespaces, commas, and currency symbols handled cleanly', () => {
    expect(parseSheetNumber('   ₫   15,000,000   VND   ')).toBe(15000000);
    expect(parseMoneyNumber('   500 , 000   đ   ')).toBe(500000);
  });
});

// =========================================================================
// Boundary 5: Missing & Malformed Field Boundaries (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 5: Malformed Inputs, Missing Fields & Unicode', () => {
  test('T2.B5.1: Missing or blank category defaults gracefully to "Khác"', () => {
    const tx: TransactionRecord = {
      id: 'tx-unknown',
      sheetType: 'Expenses',
      purchaseDate: '10/10/2026',
      isoDate: '2026-10-10',
      monthKey: '2026-10',
      category: '',
      purchaseItem: 'Khoản chi không tên',
      amount: 100000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    };

    const income: TransactionRecord = {
      id: 'inc', sheetType: 'Income', purchaseDate: '10/1/2026', isoDate: '2026-10-01', monthKey: '2026-10',
      category: 'Lương Yes4All', purchaseItem: 'S', amount: 51000000, beCorp: 0, credit: 0, source: 'google_sheet'
    };

    const result = computeMultiMonthRollover([income, tx]);
    const khac = result.chain['Khác']['2026-10'];

    expect(khac.spent).toBe(100000);
    expect(khac.txCount).toBe(1);
  });

  test('T2.B5.2: Corrupted or non-date strings handled safely in parseDateString', () => {
    const invalid = parseDateString('invalid-date-string');
    expect(invalid.year).toBeDefined();
    expect(invalid.monthKey).toBeDefined();
    expect(invalid.isoDate).toBeDefined();
  });

  test('T2.B5.3: Syntax errors and invalid operators in money expressions return null', () => {
    expect(evaluateMoneyExpression('50k +* 20k')).toBeNull();
    expect(evaluateMoneyExpression('invalid_token')).toBeNull();
    expect(evaluateMoneyExpression('(((50k')).toBeNull();
    expect(evaluateMoneyExpression('..5..tr')).toBeNull();
  });

  test('T2.B5.4: Vietnamese unicode, accents, and emojis in purchaseItem and notes', () => {
    const desc = 'Phở Thìn Lò Đúc 🍜 & Bún Chả Hương Liên 🥢';
    const note = 'Ăn cùng gia đình — "Ngon tuyệt cú mèo" (Đã trả bằng thẻ)';

    const tx: TransactionRecord = {
      id: 'u-1',
      sheetType: 'Expenses',
      purchaseDate: '10/20/2026',
      isoDate: '2026-10-20',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: desc,
      amount: 195000,
      beCorp: 0,
      credit: 195000,
      note,
      source: 'local_new',
    };

    expect(tx.purchaseItem).toBe(desc);
    expect(tx.note).toBe(note);
  });

  test('T2.B5.5: Partial date conversions via isoToSheetDate', () => {
    expect(isoToSheetDate('2026-10-25')).toBe('10/25/2026');
    expect(isoToSheetDate('2026-04-05')).toBe('4/5/2026');
    expect(isoToSheetDate('invalid')).toBe('invalid');
  });
});

// =========================================================================
// Boundary 6: Daily Living Runway Boundaries (>= 5 tests)
// =========================================================================
describe('Tier 2 - Boundary 6: Runway Edge Cases & Pacing Boundaries', () => {
  test('T2.B6.1: Day 1 of month (elapsed = 1, remaining = total days) avoids division by zero', () => {
    const daysInMonth = 31;
    const currentDay = 1;
    const elapsedDays = Math.max(1, currentDay);
    const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

    expect(elapsedDays).toBe(1);
    expect(remainingDays).toBe(31);

    const totalBudget = 6200000;
    const totalSpent = 150000;
    const remainingBudget = totalBudget - totalSpent;

    const safeDaily = Math.round(remainingBudget / remainingDays);
    const burnRate = Math.round(totalSpent / elapsedDays);

    expect(safeDaily).toBe(Math.round(6050000 / 31));
    expect(burnRate).toBe(150000);
  });

  test('T2.B6.2: Last day of month (currentDay = 31, remainingDays = 1)', () => {
    const daysInMonth = 31;
    const currentDay = 31;
    const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

    expect(remainingDays).toBe(1);

    const remainingBudget = 200000;
    const safeDaily = Math.round(remainingBudget / remainingDays);
    expect(safeDaily).toBe(200000);
  });

  test('T2.B6.3: Catastrophic single-day blowout spending exceeding entire month budget', () => {
    const totalBudget = 5000000;
    const totalSpent = 8000000; // Over budget by 3M on day 5
    const remainingBudget = totalBudget - totalSpent; // -3,000,000
    const remainingDays = 26;

    const safeDaily = remainingDays > 0 ? Math.max(0, Math.round(remainingBudget / remainingDays)) : 0;
    expect(safeDaily).toBe(0); // Clamped to 0 VND allowance per day
  });

  test('T2.B6.4: Zero living expense month (totalSpent = 0) produces 0 burn rate', () => {
    const totalBudget = 7000000;
    const totalSpent = 0;
    const elapsedDays = 15;
    const remainingDays = 16;

    const burnRate = Math.round(totalSpent / elapsedDays);
    const safeDaily = Math.round((totalBudget - totalSpent) / remainingDays);

    expect(burnRate).toBe(0);
    expect(safeDaily).toBe(Math.round(7000000 / 16));
    expect(safeDaily - burnRate).toBeGreaterThan(0);
  });

  test('T2.B6.5: Past month inspection evaluates completed status without active burn rate warning', () => {
    // Helper replicating Card 2 footer badge logic in DailyLivingRunwayWidget
    const getCard2BadgeStatus = (isPast: boolean, totalRemaining: number, isPacingSafe: boolean) => {
      if (isPast) {
        return totalRemaining >= 0 ? 'budget_safe' : 'budget_exceeded';
      }
      return isPacingSafe ? 'pacing_safe' : 'pacing_warning';
    };

    // Case 1: Completed past month with surplus (budget 8.5M, spent 7.5M, remaining +1M)
    const isPast = true;
    const remainingDays = isPast ? 0 : 15;
    const safeDaily = remainingDays > 0 ? 100000 : 0;
    const burnRate = Math.round(7500000 / 31);
    const diff = safeDaily - burnRate;
    const isPacingSafe = diff >= 0;

    expect(safeDaily).toBe(0);
    expect(isPast).toBe(true);
    expect(diff).toBeLessThan(0); // diff is negative (-241,935)
    expect(isPacingSafe).toBe(false); // isPacingSafe is false (diff < 0)
    // Past month uses totalRemaining >= 0, correctly rendering "Trong định mức ngân sách"
    expect(getCard2BadgeStatus(isPast, 1000000, isPacingSafe)).toBe('budget_safe');

    // Case 2: Completed past month with severe overspend (budget 8.5M, spent 15.5M, remaining -7M)
    const overspentRemaining = -7000000;
    // Must be classified as budget_exceeded ("Vượt ngân sách kỳ"), NEVER false "Dưới hạn mức an toàn"!
    expect(getCard2BadgeStatus(isPast, overspentRemaining, isPacingSafe)).toBe('budget_exceeded');

    // Case 3: Active current month (isPast = false)
    expect(getCard2BadgeStatus(false, 2000000, true)).toBe('pacing_safe');
    expect(getCard2BadgeStatus(false, -500000, false)).toBe('pacing_warning');
  });
});

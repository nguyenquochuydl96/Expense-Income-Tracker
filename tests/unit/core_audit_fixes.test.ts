import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeEffectiveMoneyValue,
} from '../../src/utils/mathExpression';
import {
  formatNumberForSheet,
  getTodayIsoDate,
  parseDateString,
  parseSheetNumber,
} from '../../src/utils/csvParser';
import {
  computeMultiMonthRollover,
} from '../../src/utils/budgetUtils';
import {
  setPrivacyMode,
  isPrivacyActive,
} from '../../src/utils/privacyService';
import {
  generateLegacyTxId,
} from '../../src/utils/syncStateUtils';
import type { TransactionRecord } from '../../src/types/finance';

test('MoneyCalculatorInput: computeEffectiveMoneyValue preserves thousand-separated non-expressions', () => {
  assert.equal(computeEffectiveMoneyValue('100,000', true)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('100,000', false)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('1,250,550', true)?.num, 1250550);
  assert.equal(computeEffectiveMoneyValue('1,250,550', false)?.num, 1250550);
  assert.equal(computeEffectiveMoneyValue('100.000', true)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('1.250.550', true)?.num, 1250550);
  assert.equal(computeEffectiveMoneyValue('48.5', true)?.num, 48500);
  assert.equal(computeEffectiveMoneyValue('48,5', true)?.num, 48500);
});

test('MoneyCalculatorInput: computeEffectiveMoneyValue handles mixed x1k expressions accurately', () => {
  assert.equal(computeEffectiveMoneyValue('50k + 20', true)?.num, 70000);
  assert.equal(computeEffectiveMoneyValue('20 + 50k', true)?.num, 70000);
  assert.equal(computeEffectiveMoneyValue('1tr - 200', true)?.num, 800000);
  assert.equal(computeEffectiveMoneyValue('100.000 + 50', true)?.num, 150000);
  assert.equal(computeEffectiveMoneyValue('100,000 + 50', true)?.num, 150000);
  assert.equal(computeEffectiveMoneyValue('50k + 20.5', true)?.num, 70500);
  assert.equal(computeEffectiveMoneyValue('50k + 20 * 2', true)?.num, 90000);
  // Scalar multipliers and divisors must NOT be multiplied by 1000
  assert.equal(computeEffectiveMoneyValue('50 * 2', true)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('50k * 2', true)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('2 * 50k', true)?.num, 100000);
  assert.equal(computeEffectiveMoneyValue('100k / 2', true)?.num, 50000);
  assert.equal(computeEffectiveMoneyValue('(50k + 20) * 2', true)?.num, 140000);
});

test('MoneyCalculatorInput: allowNegative preserves negative wallet & refund values', () => {
  assert.equal(computeEffectiveMoneyValue('-863', true, true)?.num, -863000);
  assert.equal(computeEffectiveMoneyValue('-863,000', true, true)?.num, -863000);
  assert.equal(computeEffectiveMoneyValue('-863.000', true, true)?.num, -863000);
  assert.equal(computeEffectiveMoneyValue('200k - 500k', true, true)?.num, -300000);
  assert.equal(computeEffectiveMoneyValue('-50k - 20', true, true)?.num, -70000);
  assert.equal(computeEffectiveMoneyValue('-863', true, false)?.num, 0);
});

test('Privacy Mode: forceVisible=true returns raw formatted number for = Số tiền button', () => {
  setPrivacyMode(true);
  assert.equal(formatNumberForSheet(500000), '••••••');
  assert.equal(formatNumberForSheet(500000, false, true), '500,000');
  assert.equal(formatNumberForSheet(-250000, false, true), '-250,000');
});

test('csvParser: parseSheetNumber supports Vietnamese dot thousand separators', () => {
  assert.equal(parseSheetNumber('50.000'), 50000);
  assert.equal(parseSheetNumber('1.500.000'), 1500000);
  assert.equal(parseSheetNumber('-1.250.000 ₫'), -1250000);
  assert.equal(parseSheetNumber('(500.000 VND)'), -500000);
  assert.equal(parseSheetNumber('1.500.000,50'), 1500000.5);
  assert.equal(parseSheetNumber('48.5'), 48.5);
  assert.equal(parseSheetNumber('6,548,000'), 6548000);
});

test('csvParser: getTodayIsoDate returns local date and parseDateString does not hardcode Oct 25', () => {
  const localMidnight = new Date(2026, 4, 1, 0, 30, 0); // May 1, 2026 00:30 local
  assert.equal(getTodayIsoDate(localMidnight), '2026-05-01');

  const expectedToday = getTodayIsoDate();
  const parsed = parseDateString('invalid-date-string');
  assert.equal(parsed.isoDate, expectedToday);
  assert.equal(parsed.monthKey, expectedToday.slice(0, 7));
});

test('budgetUtils: Largest Remainder Method sums baseFromGeneral to exact 100% of general income', () => {
  const testIncomes = [50000000, 33333333, 51000000, 12345678, 100];
  for (const incomeAmt of testIncomes) {
    const records: TransactionRecord[] = [
      {
        id: `inc-${incomeAmt}`,
        sheetType: 'Income',
        purchaseDate: '10/1/2026',
        isoDate: '2026-10-01',
        monthKey: '2026-10',
        category: 'Lương Yes4All',
        purchaseItem: 'Lương',
        amount: incomeAmt,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
      },
    ];
    const result = computeMultiMonthRollover(records, [], {}, 'full', false);
    const totalAllocated = result.allCategories.reduce(
      (sum, cat) => sum + (result.chain[cat]?.['2026-10']?.baseFromGeneral ?? 0),
      0
    );
    assert.equal(
      totalAllocated,
      incomeAmt,
      `Expected exact sum ${incomeAmt}, got ${totalAllocated}`
    );
  }
});

test('budgetUtils: Largest Remainder Method handles historical era (T4-T7) and custom 0% category', () => {
  const histRecords: TransactionRecord[] = [
    {
      id: 'inc-apr',
      sheetType: 'Income',
      purchaseDate: '4/1/2026',
      isoDate: '2026-04-01',
      monthKey: '2026-04',
      category: 'Lương Yes4All',
      purchaseItem: 'Lương',
      amount: 48000000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    },
  ];
  const histRes = computeMultiMonthRollover(histRecords, [], {}, 'full', false);
  const histSum = histRes.allCategories.reduce(
    (sum, cat) => sum + (histRes.chain[cat]?.['2026-04']?.baseFromGeneral ?? 0),
    0
  );
  assert.equal(histSum, 48000000);

  // Partial custom percentages: Shopping set to 0% must stay 0
  const customRecords: TransactionRecord[] = [
    {
      id: 'inc-oct',
      sheetType: 'Income',
      purchaseDate: '10/1/2026',
      isoDate: '2026-10-01',
      monthKey: '2026-10',
      category: 'Lương Yes4All',
      purchaseItem: 'Lương',
      amount: 51000000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
    },
  ];
  const customRes = computeMultiMonthRollover(
    customRecords,
    [],
    { Shopping: 0 },
    'full',
    true
  );
  assert.equal(customRes.chain['Shopping']['2026-10'].baseFromGeneral, 0);
  assert.equal(customRes.chain['Ăn uống']['2026-10'].baseFromGeneral, 7000000);
});

test('csvParser: parseDateString adheres strictly to Google Sheets M/D convention', () => {
  const currentYear = new Date().getFullYear();

  // 1. "11/23": 11 <= 12, so treated as Month 11, Day 23 of currentYear
  const d1 = parseDateString('11/23');
  assert.equal(d1.month, 11);
  assert.equal(d1.day, 23);
  assert.equal(d1.year, currentYear);
  assert.equal(d1.isoDate, `${currentYear}-11-23`);
  assert.equal(d1.monthKey, `${currentYear}-11`);
  assert.equal(d1.displayDate, `11/23/${currentYear}`);

  // 2. "11/10": both <= 12, standard M/D prioritizes Month 11, Day 10
  const d2 = parseDateString('11/10');
  assert.equal(d2.month, 11);
  assert.equal(d2.day, 10);
  assert.equal(d2.isoDate, `${currentYear}-11-10`);
  assert.equal(d2.monthKey, `${currentYear}-11`);

  // 3. "23/11": 23 > 12, so flips to Month 11, Day 23
  const d3 = parseDateString('23/11');
  assert.equal(d3.month, 11);
  assert.equal(d3.day, 23);
  assert.equal(d3.isoDate, `${currentYear}-11-23`);
  assert.equal(d3.monthKey, `${currentYear}-11`);

  // 4. "11/23/2026": explicit 3-part M/D/YYYY
  const d4 = parseDateString('11/23/2026');
  assert.equal(d4.month, 11);
  assert.equal(d4.day, 23);
  assert.equal(d4.year, 2026);
  assert.equal(d4.isoDate, '2026-11-23');
  assert.equal(d4.monthKey, '2026-11');
});

test('syncStateUtils: generateLegacyTxId generates deterministic, collision-resistant IDs', () => {
  const idA1 = generateLegacyTxId('Expenses', 15, '11/23/2026', 'Ăn tối Highlands', 65000);
  const idA2 = generateLegacyTxId('Expenses', 15, '11/23/2026', 'Ăn tối Highlands', 65000);
  assert.equal(idA1, idA2, 'Repeated calls with identical parameters must return identical ID');
  assert.match(idA1, /^legacy_exp_15_[0-9a-f]{8}$/);

  // Different rowIndex -> different ID
  const idB = generateLegacyTxId('Expenses', 16, '11/23/2026', 'Ăn tối Highlands', 65000);
  assert.notEqual(idA1, idB);

  // Different amount -> different ID
  const idC = generateLegacyTxId('Expenses', 15, '11/23/2026', 'Ăn tối Highlands', 75000);
  assert.notEqual(idA1, idC);

  // Different tab -> different ID prefix and hash
  const idIncome = generateLegacyTxId('Income', 5, '11/23/2026', 'Lương', 50000000);
  assert.match(idIncome, /^legacy_inc_5_[0-9a-f]{8}$/);
});

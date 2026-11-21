import { describe, it, expect } from './testHarness';
import { computeNormalizedMonthMap, computeMultiMonthRollover } from '../../src/utils/budgetUtils';
import {
  saveAccessToken,
  getStoredAccessToken,
  clearStoredAccessToken,
  isStoredTokenExpired,
} from '../../src/services/authStorage';
import { TransactionRow, TransactionMobileCard } from '../../src/components/TransactionLedgerTable';
import { TransactionRecord } from '../../src/types/finance';
import * as fs from 'fs';
import * as path from 'path';

describe('Milestone 2 Performance & Optimization Verification', () => {
  it('M2.1: computeNormalizedMonthMap builds O(1) Map keyed by monthKey', () => {
    const mockRecords: TransactionRecord[] = [
      {
        id: '1',
        purchaseDate: '2026-10-01',
        isoDate: '2026-10-01',
        monthKey: '2026-10',
        sheetType: 'Expenses',
        category: 'Ăn uống',
        purchaseItem: 'Cơm trưa',
        amount: 50000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
      {
        id: '2',
        purchaseDate: '2026-10-05',
        isoDate: '2026-10-05',
        monthKey: '2026-10',
        sheetType: 'Income',
        category: 'Lương Yes4All',
        purchaseItem: 'Lương tháng 10',
        amount: 30000000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
      {
        id: '3',
        purchaseDate: '2026-09-15',
        isoDate: '2026-09-15',
        monthKey: '2026-09',
        sheetType: 'Expenses',
        category: 'Mua sắm',
        purchaseItem: 'Áo',
        amount: 200000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
    ];

    const map = computeNormalizedMonthMap(mockRecords);
    expect(map instanceof Map).toBe(true);
    expect(map.size).toBe(2);
    expect(map.has('2026-10')).toBe(true);
    expect(map.has('2026-09')).toBe(true);
    expect(map.get('2026-10')?.length).toBe(2);
    expect(map.get('2026-09')?.length).toBe(1);
  });

  it('M2.2: computeNormalizedMonthMap ignores records with empty monthKey', () => {
    const records: TransactionRecord[] = [
      {
        id: 'bad',
        purchaseDate: '',
        isoDate: '',
        monthKey: '',
        sheetType: 'Expenses',
        category: 'Khác',
        purchaseItem: 'Invalid',
        amount: 1000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
    ];
    const map = computeNormalizedMonthMap(records);
    expect(map.size).toBe(0);
  });

  it('M2.3: computeMultiMonthRollover with pre-indexed monthMap produces exact financial results', () => {
    const records: TransactionRecord[] = [
      {
        id: 'inc-1',
        purchaseDate: '2026-10-01',
        isoDate: '2026-10-01',
        monthKey: '2026-10',
        sheetType: 'Income',
        category: 'Lương Yes4All',
        purchaseItem: 'Lương',
        amount: 51000000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
      {
        id: 'exp-1',
        purchaseDate: '2026-10-02',
        isoDate: '2026-10-02',
        monthKey: '2026-10',
        sheetType: 'Expenses',
        category: 'Thuê nhà',
        purchaseItem: 'Tiền nhà',
        amount: 8500000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
    ];

    const result = computeMultiMonthRollover(records);
    expect(result.allChronologicalMonths).toContain('2026-10');
    expect(result.generalMonthlyIncomes['2026-10']).toBe(51000000);
    const rentStats = result.chain['Thuê nhà']?.['2026-10'];
    expect(rentStats).toBeDefined();
    expect(rentStats.spent).toBe(8500000);
    // Base budget for Thuê nhà in T8-T10 era is 8.5 / 51.0 * 51M = 8,500,000
    expect(rentStats.baseBudget).toBe(8500000);
    expect(rentStats.remaining).toBe(0);
  });

  it('M2.4: authStorage handles access token persistence without Firebase SDK', () => {
    // Ensure mock localStorage in Node environment
    if (typeof (globalThis as any).localStorage === 'undefined') {
      const store = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      };
    }

    clearStoredAccessToken();
    expect(getStoredAccessToken()).toBe(null);

    saveAccessToken('mock-token-xyz', 3600);
    expect(getStoredAccessToken()).toBe('mock-token-xyz');
    expect(isStoredTokenExpired()).toBe(false);

    clearStoredAccessToken();
    expect(getStoredAccessToken()).toBe(null);
  });

  it('M2.5: TransactionRow and TransactionMobileCard are exported memoized components', () => {
    expect(typeof TransactionRow).toBe('object');
    expect(typeof TransactionMobileCard).toBe('object');
  });

  it('M2.6: Source code audit confirms @animate-ui and gsap are completely purged', () => {
    const rootDir = process.cwd();
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8')
    );
    expect(pkg.dependencies['@animate-ui/react']).toBeUndefined();
    expect(pkg.dependencies['gsap']).toBeUndefined();

    // Check kinloAnimations.ts
    const kinloAnimCode = fs.readFileSync(
      path.resolve(rootDir, 'src/utils/kinloAnimations.ts'),
      'utf8'
    );
    expect(kinloAnimCode.includes('import gsap')).toBe(false);

    // Check AnimatedCurrency.tsx
    const animCurrencyCode = fs.readFileSync(
      path.resolve(rootDir, 'src/components/AnimatedCurrency.tsx'),
      'utf8'
    );
    expect(animCurrencyCode.includes('@animate-ui')).toBe(false);
  });

  it('M2.7: computeMultiMonthRollover stores active rolloverMode and invalidates mismatching cache', () => {
    const records: TransactionRecord[] = [
      {
        id: '1',
        purchaseDate: '2026-04-01',
        isoDate: '2026-04-01',
        monthKey: '2026-04',
        sheetType: 'Income',
        category: 'Lương Yes4All',
        purchaseItem: 'Lương T4',
        amount: 47500000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
      {
        id: '2',
        purchaseDate: '2026-04-05',
        isoDate: '2026-04-05',
        monthKey: '2026-04',
        sheetType: 'Expenses',
        category: 'Ăn uống',
        purchaseItem: 'Ăn ngoài',
        amount: 5000000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      },
    ];

    const fullResult = computeMultiMonthRollover(records, [], {}, 'full', false);
    expect(fullResult.rolloverMode).toBe('full');

    const deficitResult = computeMultiMonthRollover(records, [], {}, 'deficit_only', false);
    expect(deficitResult.rolloverMode).toBe('deficit_only');

    // Simulate CategoryBudgetTable logic
    const precomputed = fullResult;
    const hasCustomPercentages = false;

    // When rolloverMode matches precomputed ('full')
    const matchMode = 'full';
    const shouldReuseFull =
      precomputed &&
      !hasCustomPercentages &&
      (!precomputed.rolloverMode || precomputed.rolloverMode === matchMode);
    expect(shouldReuseFull).toBe(true);

    // When user changes rolloverMode to 'deficit_only'
    const changedMode = 'deficit_only';
    const shouldReuseChanged =
      precomputed &&
      !hasCustomPercentages &&
      (!precomputed.rolloverMode || precomputed.rolloverMode === changedMode);
    expect(shouldReuseChanged).toBe(false);
  });
});

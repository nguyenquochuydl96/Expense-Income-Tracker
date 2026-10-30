import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../types/finance';
import { isBudgetTransferRecord } from './cycleUtils';

export const SAVED_CATEGORY_PERCENTAGES_KEY = 'heomeo_category_percentages_v1';
export const SAVED_ROLLOVER_MODE_KEY = 'heomeo_rollover_mode_v1';

export type RolloverMode = 'full' | 'deficit_only' | 'none';

// T4-T7 base percentages matching Google Sheet (sum = 100%)
export const DEFAULT_CATEGORY_PERCENTAGES_T4_T7: Record<string, number> = {
  'Tiết kiệm': 42.1053,
  'Thuê nhà': 13.6842,
  'Ăn uống': 14.7368,
  'Quà tặng/Cưới hỏi': 7.3684,
  'Hóa/Mỹ phẩm': 6.3158,
  'Thú cưng': 4.2105,
  'Giải trí Heo': 2.1053,
  'Giải trí Mèo': 2.1053,
  'Shopping': 2.1053,
  'Điện thoại/Xăng xe': 2.1053,
  'Sức khỏe': 1.0526,
  'Du lịch': 1.0526,
  'Khác': 1.0526,
};

// Current phase (T8-T10) base percentages matching Google Sheet (sum = 100%)
export const DEFAULT_CATEGORY_PERCENTAGES: Record<string, number> = {
  'Tiết kiệm': 39.2157,
  'Thuê nhà': 16.6667,
  'Ăn uống': 13.7255,
  'Quà tặng/Cưới hỏi': 7.8431,
  'Hóa/Mỹ phẩm': 4.9020,
  'Thú cưng': 3.9216,
  'Shopping': 2.9412,
  'Điện thoại/Xăng xe': 1.9608,
  'Giải trí Heo': 1.9608,
  'Giải trí Mèo': 1.9608,
  'Du lịch': 1.9608,
  'Sức khỏe': 1.9608,
  'Khác': 0.9804,
};

// Exact ratios matching Google Sheet 'Source data validation'!C1:C14 (denominator 47,500,000) for April-July 2026
export const DEFAULT_CATEGORY_RATIOS_T4_T7: Record<string, number> = {
  'Thuê nhà': 6.5 / 47.5,
  'Thú cưng': 2.0 / 47.5,
  'Hóa/Mỹ phẩm': 3.0 / 47.5,
  'Ăn uống': 7.0 / 47.5,
  'Sức khỏe': 0.5 / 47.5,
  'Tiết kiệm': 20.0 / 47.5,
  'Điện thoại/Xăng xe': 1.0 / 47.5,
  'Shopping': 1.0 / 47.5,
  'Du lịch': 0.5 / 47.5,
  'Quà tặng/Cưới hỏi': 3.5 / 47.5,
  'Giải trí Heo': 1.0 / 47.5,
  'Giải trí Mèo': 1.0 / 47.5,
  'Khác': 0.5 / 47.5,
};

// Exact ratios matching Google Sheet 'Source data validation'!F1:F14 (denominator 51,000,000) for August-October 2026
export const DEFAULT_CATEGORY_RATIOS: Record<string, number> = {
  'Thuê nhà': 8.5 / 51.0,
  'Thú cưng': 2.0 / 51.0,
  'Hóa/Mỹ phẩm': 2.5 / 51.0,
  'Ăn uống': 7.0 / 51.0,
  'Sức khỏe': 1.0 / 51.0,
  'Tiết kiệm': 20.0 / 51.0,
  'Điện thoại/Xăng xe': 1.0 / 51.0,
  'Shopping': 1.5 / 51.0,
  'Du lịch': 1.0 / 51.0,
  'Quà tặng/Cưới hỏi': 4.0 / 51.0,
  'Giải trí Heo': 1.0 / 51.0,
  'Giải trí Mèo': 1.0 / 51.0,
  'Khác': 0.5 / 51.0,
};

export interface CategoryMonthBudgetStats {
  category: string;
  monthKey: string;
  percentage: number;
  baseBudget: number;
  baseFromGeneral: number;
  dedicatedIncome: number;
  transferIn: number;
  transferOut: number;
  netTransfer: number;
  carryover: number;
  effectiveBudget: number;
  spent: number;
  remaining: number;
  txCount: number;
  pctUsed: number;
  isOver: boolean;
}

export interface MultiMonthRolloverResult {
  chain: Record<string, Record<string, CategoryMonthBudgetStats>>;
  allChronologicalMonths: string[];
  allCategories: string[];
  generalMonthlyIncomes: Record<string, number>;
  totalMonthlyIncomes: Record<string, number>;
  monthlyCategoryExpenses: Record<string, Record<string, { total: number; count: number }>>;
  monthlyTransfersIn: Record<string, Record<string, number>>;
  monthlyTransfersOut: Record<string, Record<string, number>>;
}

/**
 * Calculates complete multi-month rollover chain across all categories and months
 * Synchronized 100% with Google Sheet "Monthly Overview" logic
 */
export function computeMultiMonthRollover(
  allRecords: TransactionRecord[],
  budgetTransfers: BudgetTransferRecord[] = [],
  customPercentages: Record<string, number> = {},
  rolloverMode: RolloverMode = 'full',
  hasCustomPercentages: boolean = false
): MultiMonthRolloverResult {
  // 1. Determine all chronological months
  const mSet = new Set<string>();
  for (const r of allRecords) {
    if (r.monthKey && r.monthKey.includes('-')) {
      mSet.add(r.monthKey);
    }
  }
  const allChronologicalMonths = Array.from(mSet).sort((a, b) => a.localeCompare(b));

  // 2. Determine all categories
  const cSet = new Set<string>(EXPENSE_CATEGORIES);
  for (const r of allRecords) {
    if (r.sheetType === 'Expenses' && r.category) {
      cSet.add(r.category);
    }
  }
  const allCategories = Array.from(cSet);

  // 3. Monthly Incomes
  const generalMonthlyIncomes: Record<string, number> = {};
  const totalMonthlyIncomes: Record<string, number> = {};

  for (const mKey of allChronologicalMonths) {
    let sum = 0;
    const mIncomes = allRecords.filter((r) => r.sheetType === 'Income' && r.monthKey === mKey);
    for (const r of mIncomes) {
      sum += r.amount;
    }
    generalMonthlyIncomes[mKey] = sum;
    totalMonthlyIncomes[mKey] = sum;
  }

  // 4. Monthly Transfers
  const monthlyTransfersIn: Record<string, Record<string, number>> = {};
  const monthlyTransfersOut: Record<string, Record<string, number>> = {};
  const monthlyCategoryExpenses: Record<string, Record<string, { total: number; count: number }>> = {};

  for (const mKey of allChronologicalMonths) {
    monthlyCategoryExpenses[mKey] = {};
    monthlyTransfersIn[mKey] = {};
    monthlyTransfersOut[mKey] = {};
  }

  if (budgetTransfers && budgetTransfers.length > 0) {
    for (const bt of budgetTransfers) {
      if (!bt.monthKey) continue;
      if (!monthlyTransfersIn[bt.monthKey]) monthlyTransfersIn[bt.monthKey] = {};
      if (!monthlyTransfersOut[bt.monthKey]) monthlyTransfersOut[bt.monthKey] = {};

      const toCat = (bt.toCategory || '').trim();
      const fromCat = (bt.fromCategory || '').trim();

      if (toCat && toCat !== 'Thu nhập riêng') {
        monthlyTransfersIn[bt.monthKey][toCat] = (monthlyTransfersIn[bt.monthKey][toCat] || 0) + bt.amount;
      }
      if (fromCat && fromCat !== 'Thu nhập riêng') {
        monthlyTransfersOut[bt.monthKey][fromCat] = (monthlyTransfersOut[bt.monthKey][fromCat] || 0) + bt.amount;
      }
    }
  }

  // Expenses & legacy transfers
  for (const r of allRecords) {
    if (r.sheetType === 'Expenses' && r.monthKey) {
      const cat = r.category || 'Khác';

      if (isBudgetTransferRecord(r)) {
        if (r.amount > 0) {
          monthlyTransfersOut[r.monthKey][cat] = (monthlyTransfersOut[r.monthKey][cat] || 0) + r.amount;
        } else if (r.amount < 0) {
          monthlyTransfersIn[r.monthKey][cat] = (monthlyTransfersIn[r.monthKey][cat] || 0) + Math.abs(r.amount);
        }
      } else {
        if (!monthlyCategoryExpenses[r.monthKey][cat]) {
          monthlyCategoryExpenses[r.monthKey][cat] = { total: 0, count: 0 };
        }
        monthlyCategoryExpenses[r.monthKey][cat].total += r.amount;
        monthlyCategoryExpenses[r.monthKey][cat].count += 1;
      }
    }
  }

  // 5. Chain rollover
  const chain: Record<string, Record<string, CategoryMonthBudgetStats>> = {};

  for (const cat of allCategories) {
    chain[cat] = {};
    let cumulativeBalance = 0;

    for (let i = 0; i < allChronologicalMonths.length; i++) {
      const mKey = allChronologicalMonths[i];
      const mGeneralIncome = generalMonthlyIncomes[mKey] || 0;

      let ratio: number;
      let pct: number;

      // Historical months (T4-T7) are locked historical eras synchronized to Google Sheet Section 2 (R20:R23)
      // They MUST NEVER be retroactively modified by Phase 2 or custom percentages!
      if (mKey <= '2026-07') {
        ratio = DEFAULT_CATEGORY_RATIOS_T4_T7[cat] ?? 0;
        pct = DEFAULT_CATEGORY_PERCENTAGES_T4_T7[cat] ?? (ratio * 100);
      } else {
        if (hasCustomPercentages && customPercentages[cat] !== undefined) {
          pct = customPercentages[cat];
          ratio = pct / 100;
        } else {
          ratio = DEFAULT_CATEGORY_RATIOS[cat] ?? 0;
          pct = DEFAULT_CATEGORY_PERCENTAGES[cat] ?? (ratio * 100);
        }
      }

      // Base budget calculation:
      // Uses exact formula ratio matching Google Sheet (=SUMIFS(...) * XLOOKUP(...))
      const baseFromGeneral = Math.round(mGeneralIncome * ratio);
      const baseBudget = baseFromGeneral;

      const transferIn = monthlyTransfersIn[mKey]?.[cat] || 0;
      const transferOut = monthlyTransfersOut[mKey]?.[cat] || 0;
      const netTransfer = transferIn - transferOut;

      let carryover = 0;
      if (rolloverMode === 'full') {
        carryover = cumulativeBalance;
      } else if (rolloverMode === 'deficit_only') {
        carryover = Math.min(0, cumulativeBalance);
      } else {
        carryover = 0;
      }

      const effectiveBudget = baseBudget + carryover + netTransfer;
      const spent = monthlyCategoryExpenses[mKey]?.[cat]?.total || 0;
      const count = monthlyCategoryExpenses[mKey]?.[cat]?.count || 0;
      const remaining = effectiveBudget - spent;
      const pctUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : spent > 0 ? 999 : 0;
      const isOver = remaining < 0;

      chain[cat][mKey] = {
        category: cat,
        monthKey: mKey,
        percentage: pct,
        baseBudget,
        baseFromGeneral,
        dedicatedIncome: 0,
        transferIn,
        transferOut,
        netTransfer,
        carryover,
        effectiveBudget,
        spent,
        remaining,
        txCount: count,
        pctUsed,
        isOver,
      };

      cumulativeBalance = remaining;
    }
  }

  return {
    chain,
    allChronologicalMonths,
    allCategories,
    generalMonthlyIncomes,
    totalMonthlyIncomes,
    monthlyCategoryExpenses,
    monthlyTransfersIn,
    monthlyTransfersOut,
  };
}

import React, { useMemo, useState } from 'react';
import { TransactionRecord, EXPENSE_CATEGORIES, BudgetTransferRecord } from '../types/finance';
import { isBudgetTransferRecord } from '../utils/cycleUtils';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { DailyLivingRunwayWidget } from './DailyLivingRunwayWidget';
import {
  ArrowLeftRight,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Edit3,
  RotateCcw,
  BarChart3,
  Table as TableIcon,
  Check,
  Percent,
  ArrowRight,
  History,
  Layers,
} from 'lucide-react';

const SAVED_CATEGORY_PERCENTAGES_KEY = 'heomeo_category_percentages_v1';
const SAVED_ROLLOVER_MODE_KEY = 'heomeo_rollover_mode_v1';

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

interface CategoryBudgetTableProps {
  recordsInPeriod: TransactionRecord[];
  allRecords: TransactionRecord[];
  totalIncome: number; // Budget tổng của kỳ đang chọn
  selectedMonth: string;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onShowCharts?: () => void;
  showChartsButton?: boolean;
  onOpenTransfer?: () => void;
  budgetTransfers?: BudgetTransferRecord[];
}

export const CategoryBudgetTable: React.FC<CategoryBudgetTableProps> = ({
  recordsInPeriod,
  allRecords,
  totalIncome,
  selectedMonth,
  selectedCategory,
  onSelectCategory,
  onShowCharts,
  showChartsButton = false,
  onOpenTransfer,
  budgetTransfers = [],
}) => {
  // Category percentage allocation map
  const [percentages, setPercentages] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY);
      if (saved) {
        return { ...DEFAULT_CATEGORY_PERCENTAGES, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORY_PERCENTAGES;
  });

  // Rollover mode: full (carryover surplus & deficit), deficit_only (deduct overspending only), or none
  const [rolloverMode, setRolloverMode] = useState<RolloverMode>(() => {
    try {
      const saved = localStorage.getItem(SAVED_ROLLOVER_MODE_KEY) as RolloverMode;
      if (saved && ['full', 'deficit_only', 'none'].includes(saved)) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'full';
  });

  const [viewTab, setViewTab] = useState<'month_detail' | 'multi_month_matrix'>('month_detail');
  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [tempPercentages, setTempPercentages] = useState<Record<string, number>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'over_budget' | 'under_budget'>('all');

  // Sorted list of all chronological months present in the dataset (e.g. 2026-04 to 2026-10)
  const allChronologicalMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRecords) {
      if (r.monthKey && r.monthKey.includes('-')) {
        set.add(r.monthKey);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRecords]);

  // List of all categories to track
  const allCategories = useMemo(() => {
    const set = new Set<string>(EXPENSE_CATEGORIES);
    for (const r of allRecords) {
      if (r.sheetType === 'Expenses' && r.category) {
        set.add(r.category);
      }
    }
    return Array.from(set);
  }, [allRecords]);

  // Compute multi-month rollover chain for all months and all categories
  const multiMonthRolloverData = useMemo(() => {
    // 1. Calculate monthly incomes: separated into general income and dedicated category income
    const generalMonthlyIncomes: Record<string, number> = {};
    const dedicatedMonthlyIncomes: Record<string, Record<string, number>> = {};
    const totalMonthlyIncomes: Record<string, number> = {};
    const expenseCatSet = new Set<string>(EXPENSE_CATEGORIES);

    for (const mKey of allChronologicalMonths) {
      dedicatedMonthlyIncomes[mKey] = {};
      let genSum = 0;
      let totSum = 0;

      const monthIncomes = allRecords.filter(
        (r) => r.sheetType === 'Income' && r.monthKey === mKey
      );

      for (const r of monthIncomes) {
        totSum += r.amount;
        // In Google Sheet Monthly Overview (Section 2), all rows in Income tab are allocated by category %
        // Dedicated top-ups/transfers are handled via 'Budget Transfers' tab
        genSum += r.amount;
      }

      generalMonthlyIncomes[mKey] = genSum;
      totalMonthlyIncomes[mKey] = totSum;
    }

    // 2. Calculate monthly expenses per category & budget transfers
    const monthlyCategoryExpenses: Record<string, Record<string, { total: number; count: number }>> = {};
    const monthlyTransfersIn: Record<string, Record<string, number>> = {};
    const monthlyTransfersOut: Record<string, Record<string, number>> = {};

    for (const mKey of allChronologicalMonths) {
      monthlyCategoryExpenses[mKey] = {};
      monthlyTransfersIn[mKey] = {};
      monthlyTransfersOut[mKey] = {};
    }

    // Process dedicated budgetTransfers (from Google Sheet 'Budget Transfers' tab)
    if (budgetTransfers && budgetTransfers.length > 0) {
      for (const bt of budgetTransfers) {
        if (!bt.monthKey) continue;
        if (!monthlyTransfersIn[bt.monthKey]) monthlyTransfersIn[bt.monthKey] = {};
        if (!monthlyTransfersOut[bt.monthKey]) monthlyTransfersOut[bt.monthKey] = {};

        const toCat = (bt.toCategory || '').trim();
        const fromCat = (bt.fromCategory || '').trim();

        if (toCat && toCat !== 'Thu nhập riêng') {
          monthlyTransfersIn[bt.monthKey][toCat] =
            (monthlyTransfersIn[bt.monthKey][toCat] || 0) + bt.amount;
        }
        if (fromCat && fromCat !== 'Thu nhập riêng') {
          monthlyTransfersOut[bt.monthKey][fromCat] =
            (monthlyTransfersOut[bt.monthKey][fromCat] || 0) + bt.amount;
        }
      }
    }

    for (const r of allRecords) {
      if (r.sheetType === 'Expenses' && r.monthKey) {
        const cat = r.category || 'Khác';

        if (isBudgetTransferRecord(r)) {
          // Legacy transfers in Expenses if any
          if (r.amount > 0) {
            monthlyTransfersOut[r.monthKey][cat] =
              (monthlyTransfersOut[r.monthKey][cat] || 0) + r.amount;
          } else if (r.amount < 0) {
            monthlyTransfersIn[r.monthKey][cat] =
              (monthlyTransfersIn[r.monthKey][cat] || 0) + Math.abs(r.amount);
          }
        } else {
          // Real spending
          if (!monthlyCategoryExpenses[r.monthKey][cat]) {
            monthlyCategoryExpenses[r.monthKey][cat] = { total: 0, count: 0 };
          }
          monthlyCategoryExpenses[r.monthKey][cat].total += r.amount;
          monthlyCategoryExpenses[r.monthKey][cat].count += 1;
        }
      }
    }

    // 3. Chain rollover chronologically
    // map: category -> monthKey -> { baseBudget, carryover, effectiveBudget, spent, remaining, txCount }
    const chain: Record<
      string,
      Record<
        string,
        {
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
        }
      >
    > = {};

    for (const cat of allCategories) {
      chain[cat] = {};
      let cumulativeBalance = 0;

      for (let i = 0; i < allChronologicalMonths.length; i++) {
        const mKey = allChronologicalMonths[i];
        const mGeneralIncome = generalMonthlyIncomes[mKey] || 0;
        const dedicatedForCat = dedicatedMonthlyIncomes[mKey]?.[cat] || 0;

        const defaultPct =
          mKey <= '2026-07'
            ? (DEFAULT_CATEGORY_PERCENTAGES_T4_T7[cat] ?? 0)
            : (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0);
        let hasCustom = false;
        try {
          hasCustom = Boolean(localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY));
        } catch {
          // ignore
        }
        const pct = hasCustom ? (percentages[cat] ?? defaultPct) : defaultPct;

        // Base budget = (General Income * %) + Dedicated Category Income
        const baseFromGeneral = Math.round((mGeneralIncome * pct) / 100);
        const baseBudget = baseFromGeneral + dedicatedForCat;

        const transferIn = monthlyTransfersIn[mKey]?.[cat] || 0;
        const transferOut = monthlyTransfersOut[mKey]?.[cat] || 0;
        const netTransfer = transferIn - transferOut;

        let carryover = 0;
        if (rolloverMode === 'full') {
          carryover = cumulativeBalance;
        } else if (rolloverMode === 'deficit_only') {
          carryover = Math.min(0, cumulativeBalance); // only carry over negative (bội chi)
        } else {
          carryover = 0;
        }

        // Effective budget = Base budget + Carryover + Net budget transfer
        const effectiveBudget = baseBudget + carryover + netTransfer;
        const spent = monthlyCategoryExpenses[mKey]?.[cat]?.total || 0;
        const count = monthlyCategoryExpenses[mKey]?.[cat]?.count || 0;
        const remaining = effectiveBudget - spent;

        chain[cat][mKey] = {
          baseBudget,
          baseFromGeneral,
          dedicatedIncome: dedicatedForCat,
          transferIn,
          transferOut,
          netTransfer,
          carryover,
          effectiveBudget,
          spent,
          remaining,
          txCount: count,
        };

        cumulativeBalance = remaining;
      }
    }

    return {
      chain,
      monthlyIncomes: totalMonthlyIncomes,
      generalMonthlyIncomes,
      dedicatedMonthlyIncomes,
      monthlyCategoryExpenses,
    };
  }, [allChronologicalMonths, allRecords, allCategories, percentages, rolloverMode, budgetTransfers]);

  // Previous month key for the selectedMonth
  const prevMonthKey = useMemo(() => {
    if (selectedMonth === 'ALL') return null;
    const idx = allChronologicalMonths.indexOf(selectedMonth);
    return idx > 0 ? allChronologicalMonths[idx - 1] : null;
  }, [allChronologicalMonths, selectedMonth]);

  const prevMonthLabel = useMemo(() => {
    if (!prevMonthKey) return null;
    const parts = prevMonthKey.split('-');
    return `T${parseInt(parts[1], 10)}/${parts[0].slice(2)}`;
  }, [prevMonthKey]);

  // Current view stats for the selectedMonth
  const currentViewStats = useMemo(() => {
    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : allChronologicalMonths[allChronologicalMonths.length - 1];

    const items = allCategories.map((cat) => {
      const defaultPct =
        targetMonth && targetMonth <= '2026-07'
          ? (DEFAULT_CATEGORY_PERCENTAGES_T4_T7[cat] ?? 0)
          : (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0);
      let hasCustom = false;
      try {
        hasCustom = Boolean(localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY));
      } catch {
        // ignore
      }
      const pct = hasCustom ? (percentages[cat] ?? defaultPct) : defaultPct;
      const mData = targetMonth ? multiMonthRolloverData.chain[cat]?.[targetMonth] : undefined;

      const baseBudget = mData?.baseBudget ?? Math.round((totalIncome * pct) / 100);
      const dedicatedIncome = mData?.dedicatedIncome ?? 0;
      const transferIn = mData?.transferIn ?? 0;
      const transferOut = mData?.transferOut ?? 0;
      const netTransfer = mData?.netTransfer ?? 0;
      const carryover = mData?.carryover ?? 0;
      const effectiveBudget = mData?.effectiveBudget ?? baseBudget;
      const spent = mData?.spent ?? 0;
      const remaining = effectiveBudget - spent;
      const pctUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : spent > 0 ? 999 : 0;
      const isOver = remaining < 0;
      const count = mData?.txCount ?? 0;

      return {
        category: cat,
        percentage: pct,
        baseBudget,
        dedicatedIncome,
        transferIn,
        transferOut,
        netTransfer,
        carryover,
        effectiveBudget,
        spent,
        remaining,
        pctUsed,
        isOver,
        txCount: count,
      };
    });

    items.sort((a, b) => b.spent - a.spent);

    const totalBaseBudget = items.reduce((s, i) => s + i.baseBudget, 0);
    const totalDedicatedIncome = items.reduce((s, i) => s + (i.dedicatedIncome || 0), 0);
    const totalCarryover = items.reduce((s, i) => s + i.carryover, 0);
    const totalEffectiveBudget = items.reduce((s, i) => s + i.effectiveBudget, 0);
    const totalSpent = items.reduce((s, i) => s + i.spent, 0);
    const totalRemaining = totalEffectiveBudget - totalSpent;
    const overallPctUsed = totalEffectiveBudget > 0 ? (totalSpent / totalEffectiveBudget) * 100 : 0;

    return {
      items,
      totalBaseBudget,
      totalDedicatedIncome,
      totalCarryover,
      totalEffectiveBudget,
      totalSpent,
      totalRemaining,
      overallPctUsed,
      sumPercentages: items.reduce((s, i) => s + i.percentage, 0),
    };
  }, [selectedMonth, allChronologicalMonths, allCategories, percentages, multiMonthRolloverData, totalIncome]);

  // Filtered items based on filterMode & selectedCategory
  const displayedItems = useMemo(() => {
    let items = currentViewStats.items;
    if (selectedCategory !== 'ALL') {
      items = items.filter((i) => i.category === selectedCategory);
    }
    if (filterMode === 'over_budget') {
      return items.filter((i) => i.isOver && i.spent > 0);
    }
    if (filterMode === 'under_budget') {
      return items.filter((i) => !i.isOver && i.spent > 0);
    }
    return items;
  }, [currentViewStats.items, filterMode, selectedCategory]);

  // Itemized transactions when filtering by a specific category
  const categoryTransactions = useMemo(() => {
    if (selectedCategory === 'ALL') return [];
    return recordsInPeriod
      .filter((r) => r.category === selectedCategory && r.sheetType === 'Expenses')
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [recordsInPeriod, selectedCategory]);

  // Relevant budget transfers affecting this category in this month
  const categoryTransfers = useMemo(() => {
    if (selectedCategory === 'ALL' || !budgetTransfers) return [];
    return budgetTransfers
      .filter((bt) => {
        const matchesCategory = bt.toCategory === selectedCategory || bt.fromCategory === selectedCategory;
        if (!matchesCategory) return false;
        if (selectedMonth === 'ALL') return true;
        return bt.monthKey === selectedMonth;
      })
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [budgetTransfers, selectedCategory, selectedMonth]);

  // Handlers for editing percentages
  const handleStartEdit = () => {
    setTempPercentages({ ...percentages });
    setIsEditingBudgets(true);
  };

  const currentTempSum = useMemo(() => {
    return Object.values(tempPercentages).reduce((s, v) => s + (Number(v) || 0), 0);
  }, [tempPercentages]);

  const handleSaveBudgets = () => {
    setPercentages(tempPercentages);
    try {
      localStorage.setItem(SAVED_CATEGORY_PERCENTAGES_KEY, JSON.stringify(tempPercentages));
    } catch {
      // ignore
    }
    setIsEditingBudgets(false);
  };

  const handleResetBudgets = () => {
    setPercentages(DEFAULT_CATEGORY_PERCENTAGES);
    try {
      localStorage.removeItem(SAVED_CATEGORY_PERCENTAGES_KEY);
    } catch {
      // ignore
    }
    setIsEditingBudgets(false);
  };

  const handleRolloverModeChange = (mode: RolloverMode) => {
    setRolloverMode(mode);
    try {
      localStorage.setItem(SAVED_ROLLOVER_MODE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const monthLabel = useMemo(() => {
    if (selectedMonth === 'ALL') return 'tất cả các tháng';
    const parts = selectedMonth.split('-');
    return `tháng ${parseInt(parts[1], 10)}/${parts[0]}`;
  }, [selectedMonth]);

  return (
    <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 overflow-hidden transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Ngân sách &amp; Chi tiêu theo Hạng mục
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Budget tổng = Income ({formatCurrency(totalIncome)})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <History className="w-3 h-3" />
                <span>
                  {rolloverMode === 'full'
                    ? 'Lũy kế liên tục (Dư & Bội chi)'
                    : rolloverMode === 'deficit_only'
                    ? 'Cấn trừ Bội chi tháng trước'
                    : 'Không lũy kế'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động cấn trừ bội chi / thặng dư từ tháng trước sang tháng này theo đúng chu kỳ lũy kế trong {monthLabel}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewTab('month_detail')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewTab === 'month_detail'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chi tiết tháng
            </button>
            <button
              type="button"
              onClick={() => setViewTab('multi_month_matrix')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewTab === 'multi_month_matrix'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-indigo-700'
              }`}
            >
              Ma trận Đa tháng ({allChronologicalMonths.length}T)
            </button>
          </div>

          {/* Rollover Mode Selector */}
          <div className="flex items-center text-xs border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => handleRolloverModeChange('full')}
              className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                rolloverMode === 'full'
                  ? 'bg-teal-50 text-teal-800 font-bold border-r border-teal-200'
                  : 'text-slate-600 hover:text-slate-900 border-r border-slate-100'
              }`}
              title="Cấn trừ toàn bộ số dư (+ dư / - bội chi) từ tháng trước sang tháng sau"
            >
              Lũy kế đầy đủ
            </button>
            <button
              type="button"
              onClick={() => handleRolloverModeChange('deficit_only')}
              className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                rolloverMode === 'deficit_only'
                  ? 'bg-amber-50 text-amber-800 font-bold border-r border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 border-r border-slate-100'
              }`}
              title="Chỉ cấn trừ khi tháng trước bị BỘI CHI (âm tiền), không cộng dồn tiền dư"
            >
              Chỉ trừ bội chi
            </button>
            <button
              type="button"
              onClick={() => handleRolloverModeChange('none')}
              className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                rolloverMode === 'none'
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Không cấn trừ qua các tháng (tính độc lập từng tháng)"
            >
              Độc lập
            </button>
          </div>

          {/* Edit Percentages button */}
          {!isEditingBudgets ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Chỉnh % Budget</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs px-2 py-1 rounded font-bold ${
                  Math.abs(currentTempSum - 100) < 0.1
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
                title="Tổng các tỷ lệ phải bằng 100%"
              >
                Tổng: {currentTempSum.toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
              <button
                type="button"
                onClick={handleResetBudgets}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Khôi phục mặc định"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showChartsButton && onShowCharts && (
            <button
              type="button"
              onClick={onShowCharts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Xem biểu đồ</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Category Notice Banner */}
      {selectedCategory !== 'ALL' && (
        <div className="mb-4 px-3.5 py-2.5 bg-sky-50 border border-sky-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
            <span>
              Đang lọc riêng danh mục: <strong className="font-bold text-sky-950">{selectedCategory}</strong>
              {' · '}
              <strong>{categoryTransactions.length}</strong> giao dịch trong kỳ
              {' · '}
              Tổng chi: <strong className="font-mono-tabular font-bold">{formatCurrency(categoryTransactions.reduce((s, r) => s + r.amount, 0))}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectCategory('ALL')}
            className="px-2.5 py-1 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-100 border border-sky-300 rounded-md shadow-2xs transition-colors cursor-pointer"
          >
            ✕ Hiện tất cả 13 danh mục
          </button>
        </div>
      )}

      {/* VIEW TAB 1: CHI TIẾT THÁNG (KÈM CẤN TRỪ LŨY KẾ) */}
      {viewTab === 'month_detail' && (
        <>
          {/* Smart Living Runway Forecast Widget */}
          <DailyLivingRunwayWidget
            selectedMonth={selectedMonth}
            items={currentViewStats.items}
            onSelectCategory={onSelectCategory}
            selectedCategory={selectedCategory}
          />

          <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-xs font-bold text-slate-700">
                <th className="py-2.5 px-3">Hạng mục tiêu dùng</th>
                <th className="py-2.5 px-3 text-center w-24">Tỷ lệ %</th>
                <th className="py-2.5 px-3 text-right">Định mức tháng</th>
                <th className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Lũy kế ({prevMonthLabel || 'T trước'})</span>
                    <History className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900 bg-sky-50/50">
                  Ngân sách khả dụng
                </th>
                <th className="py-2.5 px-3 text-right">Đã chi tiêu</th>
                <th className="py-2.5 px-3 text-right">Còn lại chuyển tiếp</th>
                <th className="py-2.5 px-3 text-center w-36">Tiến độ chi tiêu</th>
                <th className="py-2.5 px-3 text-center">Giao dịch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-tabular">
              {displayedItems.map((item) => {
                const isSelected = selectedCategory === item.category;
                const isOver = item.remaining < 0;

                return (
                  <tr
                    key={item.category}
                    onClick={() => onSelectCategory(isSelected ? 'ALL' : item.category)}
                    className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/60' : ''
                    }`}
                  >
                    {/* Category Name & Badge */}
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={item.category} compact />
                        {isSelected && (
                          <span className="text-[10px] text-sky-700 font-semibold bg-sky-100 px-1.5 py-0.5 rounded">
                            Đang lọc
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Percentage Allocation */}
                    <td className="py-2.5 px-3 text-center">
                      {isEditingBudgets ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            className="w-14 px-1 py-0.5 text-center text-xs border border-teal-300 rounded focus:outline-teal-600 font-mono-tabular bg-white"
                            value={tempPercentages[item.category] ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setTempPercentages((prev) => ({ ...prev, [item.category]: val }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-slate-400 text-xs">%</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          {item.percentage.toFixed(1)}%
                        </span>
                      )}
                    </td>

                    {/* Định mức tháng (Base Budget = Income * % + Dedicated) */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-semibold text-slate-700">{formatCurrency(item.baseBudget)}</div>
                      {item.dedicatedIncome > 0 && (
                        <div className="text-[10px] text-teal-700 font-medium whitespace-nowrap" title={`Bao gồm +${formatCurrency(item.dedicatedIncome)} thu nhập dành riêng`}>
                          (+{formatCurrency(item.dedicatedIncome)} thu riêng)
                        </div>
                      )}
                    </td>

                    {/* Lũy kế tháng trước chuyển sang (Carryover) */}
                    <td className="py-2.5 px-3 text-right">
                      {item.carryover < 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Bội chi từ tháng trước cấn trừ vào tháng này">
                          <span>-{formatCurrency(Math.abs(item.carryover))}</span>
                        </span>
                      ) : item.carryover > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50" title="Số dư tháng trước cộng dồn vào ngân sách tháng này">
                          <span>+{formatCurrency(item.carryover)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">0</span>
                      )}
                    </td>

                    {/* Ngân sách thực dụng khả dụng (Effective Budget = Base + Carryover + Transfer) */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-sky-50/40">
                      <div>{formatCurrency(item.effectiveBudget)}</div>
                      {item.netTransfer !== 0 && (
                        <div
                          className={`text-[10px] font-medium whitespace-nowrap ${
                            item.netTransfer > 0 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                          title={`Điều chuyển ngân sách: ${item.netTransfer > 0 ? '+' : ''}${formatCurrency(item.netTransfer)}`}
                        >
                          {item.netTransfer > 0
                            ? `(+ ${formatCurrency(item.netTransfer)} nhận)`
                            : `(- ${formatCurrency(Math.abs(item.netTransfer))} chuyển)`}
                        </div>
                      )}
                    </td>

                    {/* Đã chi tiêu */}
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                      {formatCurrency(item.spent)}
                    </td>

                    {/* Còn lại (Remaining) */}
                    <td className="py-2.5 px-3 text-right">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <TrendingDown className="w-3 h-3 shrink-0" />
                          <span>Bội chi -{formatCurrency(Math.abs(item.remaining))}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>Còn lại {formatCurrency(item.remaining)}</span>
                        </span>
                      )}
                    </td>

                    {/* Progress Bar & Percentage */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver
                                ? 'bg-rose-500'
                                : item.pctUsed > 80
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.pctUsed))}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-bold w-12 text-right shrink-0 ${
                            isOver
                              ? 'text-rose-700'
                              : item.pctUsed > 80
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {item.effectiveBudget > 0 ? `${item.pctUsed.toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </td>

                    {/* Transaction Count */}
                    <td className="py-2.5 px-3 text-center text-slate-500 text-[11px] font-sans">
                      {item.txCount > 0 ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {item.txCount} gd
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Total Row */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50/90 font-bold text-xs font-mono-tabular">
                <td className="py-3 px-3 font-sans text-slate-900">
                  Tổng cộng ngân sách
                </td>
                <td className="py-3 px-3 text-center text-slate-800">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                    {currentViewStats.sumPercentages.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-slate-700">
                  {formatCurrency(currentViewStats.totalBaseBudget)}
                </td>
                <td className="py-3 px-3 text-right">
                  {currentViewStats.totalCarryover < 0 ? (
                    <span className="text-rose-700 font-bold">
                      -{formatCurrency(Math.abs(currentViewStats.totalCarryover))}
                    </span>
                  ) : currentViewStats.totalCarryover > 0 ? (
                    <span className="text-emerald-700 font-bold">
                      +{formatCurrency(currentViewStats.totalCarryover)}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 bg-sky-50/60 font-extrabold">
                  {formatCurrency(currentViewStats.totalEffectiveBudget)}
                </td>
                <td className="py-3 px-3 text-right text-slate-900">
                  {formatCurrency(currentViewStats.totalSpent)}
                </td>
                <td className="py-3 px-3 text-right">
                  {currentViewStats.totalRemaining < 0 ? (
                    <span className="text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded border border-rose-300 font-bold">
                      Vượt -{formatCurrency(Math.abs(currentViewStats.totalRemaining))}
                    </span>
                  ) : (
                    <span className="text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded border border-emerald-300 font-bold">
                      Dư {formatCurrency(currentViewStats.totalRemaining)}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          currentViewStats.overallPctUsed > 100
                            ? 'bg-rose-500'
                            : currentViewStats.overallPctUsed > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, currentViewStats.overallPctUsed)}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-extrabold w-12 text-right shrink-0 ${
                        currentViewStats.overallPctUsed > 100 ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {currentViewStats.overallPctUsed.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center text-slate-600 font-sans text-xs">
                  {recordsInPeriod.filter((r) => r.sheetType === 'Expenses').length} gd
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Drill-down transactions for selected category */}
          {selectedCategory !== 'ALL' && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              {/* Category Transfers Card (Bổ sung / Điều chuyển quỹ trong kỳ) */}
              {categoryTransfers.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <div className="text-xs font-bold text-indigo-950 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Điều chuyển / Bổ sung quỹ trong kỳ ({categoryTransfers.length} khoản):</span>
                    </span>
                    <span className="text-[11px] font-normal text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200/50">
                      Đã ghi vào Google Sheet "Budget Transfers"
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono-tabular">
                    {categoryTransfers.map((bt) => {
                      const isReceiving = bt.toCategory === selectedCategory;
                      return (
                        <div
                          key={bt.id}
                          className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-indigo-100 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isReceiving
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {isReceiving ? '+ Nhận' : '- Chuyển'}
                            </span>
                            <span className="font-semibold text-slate-800">{bt.date}</span>
                            <span className="text-slate-600 font-sans">
                              {bt.description || (isReceiving ? `Nhận từ ${bt.fromCategory}` : `Chuyển sang ${bt.toCategory}`)}
                            </span>
                          </div>
                          <div className={`font-bold ${isReceiving ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isReceiving ? '+' : '-'}{formatCurrency(bt.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Chi tiết giao dịch phát sinh trong kỳ của:</span>
                  <span className="text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded font-extrabold">{selectedCategory}</span>
                  <span className="text-slate-500 font-normal">({categoryTransactions.length} giao dịch)</span>
                </h4>
                <div className="text-xs font-semibold text-slate-700 font-mono-tabular">
                  Tổng chi: <strong className="text-slate-900">{formatCurrency(categoryTransactions.reduce((s, r) => s + r.amount, 0))}</strong>
                </div>
              </div>

              {categoryTransactions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg">
                  Chưa có khoản chi nào trong kỳ cho danh mục này.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-lg shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Ngày</th>
                        <th className="py-2 px-3">Nội dung chi tiêu</th>
                        <th className="py-2 px-3 text-right">Số tiền</th>
                        <th className="py-2 px-3 text-right">BE Corp</th>
                        <th className="py-2 px-3 text-right">Credit</th>
                        <th className="py-2 px-3">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono-tabular">
                      {categoryTransactions.map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{tx.purchaseDate}</td>
                          <td className="py-2 px-3 font-sans text-slate-900 font-medium">{tx.purchaseItem}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCurrency(tx.amount)}</td>
                          <td className="py-2 px-3 text-right text-amber-700">{tx.beCorp > 0 ? formatCurrency(tx.beCorp) : '—'}</td>
                          <td className="py-2 px-3 text-right text-purple-700">{tx.credit > 0 ? formatCurrency(tx.credit) : '—'}</td>
                          <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">{tx.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {/* VIEW TAB 2: MA TRẬN LŨY KẾ ĐA THÁNG (CẤN TRỪ LIÊN TỤC QUA CÁC THÁNG) */}
      {viewTab === 'multi_month_matrix' && (
        <div className="overflow-x-auto -mx-5 px-5">
          <div className="mb-3 p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Ma trận cấn trừ đa tháng:</strong> Hiển thị chuỗi lũy kế số dư của từng hạng mục tiêu dùng từ {allChronologicalMonths[0]} đến {allChronologicalMonths[allChronologicalMonths.length - 1]}. Nếu tháng trước bị bội chi (-), ngân sách khả dụng của tháng kế tiếp sẽ tự động bị khấu trừ phần bội chi đó.
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-xs font-bold text-slate-700">
                <th className="py-2.5 px-3 sticky left-0 bg-slate-50 z-10 w-44 shadow-xs">
                  Hạng mục tiêu dùng
                </th>
                <th className="py-2.5 px-2 text-center w-16">Tỷ lệ</th>
                {allChronologicalMonths.map((mKey) => {
                  const [y, m] = mKey.split('-');
                  const label = `T${parseInt(m, 10)}/${y.slice(2)}`;
                  const isCurrent = selectedMonth === mKey;
                  return (
                    <th
                      key={mKey}
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        isCurrent
                          ? 'bg-sky-100/90 text-sky-900 font-bold border-b-2 border-sky-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {label} (Khả dụng / Đã chi)
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-tabular">
              {allCategories.map((cat) => {
                const pct = percentages[cat] ?? 0;
                return (
                  <tr key={cat} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-sans sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                      <CategoryBadge category={cat} compact />
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-600 text-[11px]">
                      {pct.toFixed(1)}%
                    </td>
                    {allChronologicalMonths.map((mKey) => {
                      const mData = multiMonthRolloverData.chain[cat]?.[mKey];
                      if (!mData) return <td key={mKey} className="py-2.5 px-3 text-right text-slate-300">—</td>;

                      const isCurrent = selectedMonth === mKey;
                      const isOver = mData.remaining < 0;

                      return (
                        <td
                          key={mKey}
                          className={`py-2.5 px-3 text-right whitespace-nowrap ${
                            isCurrent ? 'bg-sky-50/40' : ''
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[11px] font-semibold text-slate-800">
                              {formatNumberForSheet(mData.spent)} / {formatNumberForSheet(mData.effectiveBudget)}
                            </div>
                            <div className="text-[10px]">
                              {isOver ? (
                                <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">
                                  Bội chi -{formatNumberForSheet(Math.abs(mData.remaining))}
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium bg-emerald-50 px-1 rounded">
                                  Dư +{formatNumberForSheet(mData.remaining)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

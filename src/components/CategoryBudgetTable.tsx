import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TransactionRecord, EXPENSE_CATEGORIES, BudgetTransferRecord } from '../types/finance';
import { isBudgetTransferRecord } from '../utils/cycleUtils';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { DailyLivingRunwayWidget } from './DailyLivingRunwayWidget';
import {
  computeMultiMonthRollover,
  SAVED_CATEGORY_PERCENTAGES_KEY,
  SAVED_ROLLOVER_MODE_KEY,
  RolloverMode,
  DEFAULT_CATEGORY_PERCENTAGES_T4_T7,
  DEFAULT_CATEGORY_PERCENTAGES,
} from '../utils/budgetUtils';

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

export {
  SAVED_CATEGORY_PERCENTAGES_KEY,
  SAVED_ROLLOVER_MODE_KEY,
  DEFAULT_CATEGORY_PERCENTAGES_T4_T7,
  DEFAULT_CATEGORY_PERCENTAGES,
  computeMultiMonthRollover,
};
export type { RolloverMode };

interface CategoryBudgetTableProps {
  recordsInPeriod: TransactionRecord[];
  allRecords: TransactionRecord[];
  totalIncome: number; // Budget tổng của kỳ đang chọn
  selectedMonth: string;
  selectedMonths?: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedCategories?: string[];
  onSelectCategories?: (cats: string[]) => void;
  onToggleCategory?: (cat: string) => void;
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
  selectedMonths,
  selectedCategory,
  onSelectCategory,
  selectedCategories,
  onSelectCategories,
  onToggleCategory,
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
        const parsed = JSON.parse(saved);
        // Self-heal: If saved matches DEFAULT_CATEGORY_PERCENTAGES within minor delta, clean it up
        // so it defaults cleanly to standard Google Sheets formulas with 0 VND difference
        const isIdenticalToDefault = Object.entries(DEFAULT_CATEGORY_PERCENTAGES).every(
          ([k, v]) => Math.abs((parsed[k] ?? 0) - v) < 0.05
        );
        if (isIdenticalToDefault) {
          localStorage.removeItem(SAVED_CATEGORY_PERCENTAGES_KEY);
          return DEFAULT_CATEGORY_PERCENTAGES;
        }
        return { ...DEFAULT_CATEGORY_PERCENTAGES, ...parsed };
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

  const hasCustomPercentages = useMemo(() => {
    try {
      return Boolean(localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY));
    } catch {
      return false;
    }
  }, [percentages]);

  // Compute multi-month rollover chain for all months and all categories
  const multiMonthRolloverData = useMemo(() => {
    return computeMultiMonthRollover(
      allRecords,
      budgetTransfers,
      percentages,
      rolloverMode,
      hasCustomPercentages
    );
  }, [allRecords, budgetTransfers, percentages, rolloverMode, hasCustomPercentages]);

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

  const isMultiMonth = useMemo(() => {
    return Boolean(selectedMonths && selectedMonths.length > 1);
  }, [selectedMonths]);

  // Current view stats for the selectedMonth
  const currentViewStats = useMemo(() => {
    if (isMultiMonth && selectedMonths && selectedMonths.length > 1) {
      const items = allCategories.map((cat) => {
        let totalBaseBudget = 0;
        let totalDedicated = 0;
        let totalTransferIn = 0;
        let totalTransferOut = 0;
        let totalSpent = 0;
        let totalTxCount = 0;

        for (const mKey of selectedMonths) {
          const mData = multiMonthRolloverData.chain[cat]?.[mKey];
          if (mData) {
            totalBaseBudget += mData.baseBudget;
            totalDedicated += mData.dedicatedIncome;
            totalTransferIn += mData.transferIn;
            totalTransferOut += mData.transferOut;
            totalSpent += mData.spent;
            totalTxCount += mData.txCount;
          }
        }

        const defaultPct = DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0;
        const pct = percentages[cat] ?? defaultPct;
        const effectiveBudget = totalBaseBudget > 0 ? totalBaseBudget : Math.round((totalIncome * pct) / 100);
        const remaining = effectiveBudget - totalSpent;
        const pctUsed = effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : totalSpent > 0 ? 999 : 0;
        const isOver = remaining < 0;

        return {
          category: cat,
          percentage: pct,
          baseBudget: effectiveBudget,
          dedicatedIncome: totalDedicated,
          transferIn: totalTransferIn,
          transferOut: totalTransferOut,
          netTransfer: totalTransferIn - totalTransferOut,
          carryover: 0,
          effectiveBudget,
          spent: totalSpent,
          remaining,
          pctUsed,
          isOver,
          txCount: totalTxCount,
        };
      });

      items.sort((a, b) => b.spent - a.spent);

      const totalBaseBudget = items.reduce((s, i) => s + i.baseBudget, 0);
      const totalDedicatedIncome = items.reduce((s, i) => s + (i.dedicatedIncome || 0), 0);
      const totalCarryover = 0;
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
    }

    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : allChronologicalMonths[allChronologicalMonths.length - 1];

    const items = allCategories.map((cat) => {
      const mData = targetMonth ? multiMonthRolloverData.chain[cat]?.[targetMonth] : undefined;
      const defaultPct =
        targetMonth && targetMonth <= '2026-07'
          ? (DEFAULT_CATEGORY_PERCENTAGES_T4_T7[cat] ?? 0)
          : (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0);
      const pct = mData ? mData.percentage : defaultPct;

      const baseBudget = mData?.baseBudget ?? Math.round((totalIncome * pct) / 100);
      const dedicatedIncome = mData?.dedicatedIncome ?? 0;
      const transferIn = mData?.transferIn ?? 0;
      const transferOut = mData?.transferOut ?? 0;
      const netTransfer = mData?.netTransfer ?? 0;
      const carryover = mData?.carryover ?? 0;
      const effectiveBudget = mData?.effectiveBudget ?? baseBudget;
      const spent = mData?.spent ?? 0;
      const remaining = mData?.remaining ?? (effectiveBudget - spent);
      const pctUsed = mData?.pctUsed ?? (effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : spent > 0 ? 999 : 0);
      const isOver = mData?.isOver ?? (remaining < 0);
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
  }, [selectedMonth, selectedMonths, isMultiMonth, allChronologicalMonths, allCategories, percentages, multiMonthRolloverData, totalIncome]);

  // Active categories for filtering
  const activeCategories = useMemo(() => {
    if (selectedCategories && selectedCategories.length > 0) {
      if (selectedCategories.includes('ALL') || (allCategories.length > 0 && selectedCategories.length >= allCategories.length)) {
        return [];
      }
      return selectedCategories;
    }
    if (selectedCategory && selectedCategory !== 'ALL') {
      return [selectedCategory];
    }
    return [];
  }, [selectedCategories, selectedCategory, allCategories]);

  const hasCategoryFilter = activeCategories.length > 0;

  // Filtered items based on filterMode & activeCategories
  const displayedItems = useMemo(() => {
    let items = currentViewStats.items;
    if (activeCategories.length > 0) {
      items = items.filter((i) => activeCategories.includes(i.category));
    }
    if (filterMode === 'over_budget') {
      return items.filter((i) => i.isOver && i.spent > 0);
    }
    if (filterMode === 'under_budget') {
      return items.filter((i) => !i.isOver && i.spent > 0);
    }
    return items;
  }, [currentViewStats.items, filterMode, activeCategories]);

  // Itemized transactions when filtering by category
  const categoryTransactions = useMemo(() => {
    if (activeCategories.length === 0) return [];
    return recordsInPeriod
      .filter((r) => activeCategories.includes(r.category) && r.sheetType === 'Expenses')
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [recordsInPeriod, activeCategories]);

  // Relevant budget transfers affecting this category in this month
  const categoryTransfers = useMemo(() => {
    if (activeCategories.length === 0 || !budgetTransfers) return [];
    return budgetTransfers
      .filter((bt) => {
        const matchesCategory = activeCategories.includes(bt.toCategory) || activeCategories.includes(bt.fromCategory);
        if (!matchesCategory) return false;
        if (selectedMonth === 'ALL') return true;
        return bt.monthKey === selectedMonth;
      })
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [budgetTransfers, activeCategories, selectedMonth]);

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
    if (isMultiMonth && selectedMonths) {
      const sorted = [...selectedMonths].sort();
      const labels = sorted.map((mk) => `T${parseInt(mk.split('-')[1], 10)}`);
      return `${selectedMonths.length} tháng đã chọn (${labels.join(', ')})`;
    }
    if (selectedMonth === 'ALL') return 'tất cả các tháng';
    const parts = selectedMonth.split('-');
    return `tháng ${parseInt(parts[1], 10)}/${parts[0]}`;
  }, [selectedMonth, isMultiMonth, selectedMonths]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 overflow-hidden transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Ngân sách &amp; Chi tiêu theo Hạng mục
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Budget tổng = Income ({formatCurrency(totalIncome)})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tự động cấn trừ bội chi / thặng dư từ tháng trước sang tháng này theo đúng chu kỳ lũy kế trong {monthLabel}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Tab Switcher */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-lg text-xs border border-slate-300/60 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setViewTab('month_detail')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewTab === 'month_detail'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
            >
              Chi tiết tháng
            </button>
            <button
              type="button"
              onClick={() => setViewTab('multi_month_matrix')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewTab === 'multi_month_matrix'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
            >
              Ma trận Đa tháng ({allChronologicalMonths.length}T)
            </button>
          </div>

          {/* Rollover Mode Selector */}
          <div className="flex items-center text-xs border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-xs">
            <button
              type="button"
              onClick={() => handleRolloverModeChange('full')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                rolloverMode === 'full'
                  ? 'bg-teal-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-r border-slate-100 dark:border-slate-700'
              }`}
              title="Cấn trừ toàn bộ số dư (+ dư / - bội chi) từ tháng trước sang tháng sau liên tục"
            >
              Lũy kế đầy đủ
            </button>
            <button
              type="button"
              onClick={() => handleRolloverModeChange('deficit_only')}
              className={`px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                rolloverMode === 'deficit_only'
                  ? 'bg-amber-500 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-r border-slate-100 dark:border-slate-700'
              }`}
              title="Chỉ cấn trừ khi tháng trước bị BỘI CHI (âm tiền), không cộng dồn tiền dư"
            >
              Chỉ trừ bội chi
            </button>
            <button
              type="button"
              onClick={() => handleRolloverModeChange('none')}
              className={`px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                rolloverMode === 'none'
                  ? 'bg-slate-700 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Chỉnh % Budget</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs px-2 py-1 rounded font-bold ${
                  Math.abs(currentTempSum - 100) < 0.1
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                }`}
                title="Tổng các tỷ lệ phải bằng 100%"
              >
                Tổng: {currentTempSum.toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
              <button
                type="button"
                onClick={handleResetBudgets}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Xem biểu đồ</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner when not in 'full' rollover mode */}
      {rolloverMode !== 'full' && (
        <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <div className="font-bold text-amber-950 dark:text-amber-100">
                Bạn đang xem ở chế độ "{rolloverMode === 'none' ? 'Độc lập (Không lũy kế)' : 'Chỉ trừ bội chi'}":
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300">
                Chế độ này không cộng dồn tiền dư từ tháng trước (Giải trí Heo không được cộng +2.68M dư từ T9 và Tiết kiệm không cấn trừ nợ T9).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRolloverModeChange('full')}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            ✓ Bấm để bật "Lũy kế đầy đủ"
          </button>
        </div>
      )}

      {/* Selected Category Notice Banner */}
      {hasCategoryFilter && (
        <div className="mb-4 px-3.5 py-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900 dark:text-sky-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
            <span>
              Đang lọc riêng danh mục:{' '}
              <strong className="font-bold text-sky-950 dark:text-sky-100">
                {activeCategories.length === 1
                  ? activeCategories[0]
                  : `${activeCategories.length} danh mục (${activeCategories.join(', ')})`}
              </strong>
              {' · '}
              <strong>{categoryTransactions.length}</strong> giao dịch trong kỳ
              {' · '}
              Tổng chi:{' '}
              <strong className="font-mono-tabular font-bold">
                {formatCurrency(categoryTransactions.reduce((s, r) => s + r.amount, 0))}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCategory('ALL');
              if (onSelectCategories) onSelectCategories([]);
            }}
            className="px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-sky-700 rounded-md shadow-2xs transition-colors cursor-pointer"
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
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300">
                <th className="py-2.5 px-3">Hạng mục tiêu dùng</th>
                <th className="py-2.5 px-3 text-center w-24">Tỷ lệ %</th>
                <th className="py-2.5 px-3 text-right">Định mức tháng</th>
                <th className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Lũy kế ({prevMonthLabel || 'T trước'})</span>
                    <History className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 bg-sky-50/50 dark:bg-sky-950/40">
                  Ngân sách khả dụng
                </th>
                <th className="py-2.5 px-3 text-right">Đã chi tiêu</th>
                <th className="py-2.5 px-3 text-right">Còn lại chuyển tiếp</th>
                <th className="py-2.5 px-3 text-center w-36">Tiến độ chi tiêu</th>
                <th className="py-2.5 px-3 text-center">Giao dịch</th>
              </tr>
            </thead>
            <motion.tbody
              key={`${selectedMonth}-${activeCategories.join(',')}`}
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.035,
                  },
                },
              }}
              className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-tabular"
            >
              {displayedItems.map((item) => {
                const isSelected = activeCategories.includes(item.category);
                const isOver = item.remaining < 0;

                return (
                  <motion.tr
                    key={item.category}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
                    }}
                    onClick={() => {
                      if (onToggleCategory) {
                        onToggleCategory(item.category);
                      } else {
                        onSelectCategory(isSelected ? 'ALL' : item.category);
                      }
                    }}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/60 dark:bg-sky-950/40' : ''
                    }`}
                  >
                    {/* Category Name & Badge */}
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={item.category} compact />
                        {isSelected && (
                          <span className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold bg-sky-100 dark:bg-sky-950 px-1.5 py-0.5 rounded">
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
                            className="w-14 px-1 py-0.5 text-center text-xs border border-teal-300 dark:border-teal-500 rounded focus:outline-teal-600 font-mono-tabular bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.percentage.toFixed(1)}%
                        </span>
                      )}
                    </td>

                    {/* Định mức tháng (Base Budget = Income * % + Dedicated) */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(item.baseBudget)}</div>
                      {item.dedicatedIncome > 0 && (
                        <div className="text-[10px] text-teal-700 dark:text-teal-400 font-medium whitespace-nowrap" title={`Bao gồm ${formatCurrency(item.dedicatedIncome, true)} thu nhập dành riêng`}>
                          ({formatCurrency(item.dedicatedIncome, true)} thu riêng)
                        </div>
                      )}
                    </td>

                    {/* Lũy kế tháng trước chuyển sang (Carryover) */}
                    <td className="py-2.5 px-3 text-right">
                      {item.carryover < 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/60" title="Bội chi từ tháng trước cấn trừ vào tháng này">
                          <span>{formatCurrency(item.carryover)}</span>
                        </span>
                      ) : item.carryover > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-900/60" title="Số dư tháng trước cộng dồn vào ngân sách tháng này">
                          <span>{formatCurrency(item.carryover, true)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-mono">0</span>
                      )}
                    </td>

                    {/* Ngân sách thực dụng khả dụng (Effective Budget = Base + Carryover + Transfer) */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 bg-sky-50/40 dark:bg-sky-950/30">
                      <div>{formatCurrency(item.effectiveBudget)}</div>
                      {item.netTransfer !== 0 && (
                        <div
                          className={`text-[10px] font-medium whitespace-nowrap ${
                            item.netTransfer > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                          }`}
                          title={`Điều chuyển ngân sách: ${formatCurrency(item.netTransfer, true)}`}
                        >
                          {item.netTransfer > 0
                            ? `(${formatCurrency(item.netTransfer, true)} nhận)`
                            : `(${formatCurrency(item.netTransfer)} chuyển)`}
                        </div>
                      )}
                    </td>

                    {/* Đã chi tiêu */}
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(item.spent)}
                    </td>

                    {/* Còn lại (Remaining) */}
                    <td className="py-2.5 px-3 text-right">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                          <TrendingDown className="w-3 h-3 shrink-0" />
                          <span>Bội chi {formatCurrency(item.remaining)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-900/60">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>Còn lại {formatCurrency(item.remaining)}</span>
                        </span>
                      )}
                    </td>

                    {/* Progress Bar & Percentage */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver
                                ? 'bg-rose-500'
                                : item.pctUsed > 80
                                ? 'bg-amber-500'
                                : 'theme-progress-fill'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.pctUsed))}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-bold w-12 text-right shrink-0 ${
                            isOver
                              ? 'text-rose-700 dark:text-rose-400'
                              : item.pctUsed > 80
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.effectiveBudget > 0 ? `${item.pctUsed.toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </td>

                    {/* Transaction Count */}
                    <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 text-[11px] font-sans">
                      {item.txCount > 0 ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                          {item.txCount} gd
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>

            {/* Footer Total Row */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-850 font-bold text-xs font-mono-tabular">
                <td className="py-3 px-3 font-sans text-slate-900 dark:text-slate-100">
                  Tổng cộng ngân sách
                </td>
                <td className="py-3 px-3 text-center text-slate-800 dark:text-slate-200">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300">
                    {currentViewStats.sumPercentages.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                  {formatCurrency(currentViewStats.totalBaseBudget)}
                </td>
                <td className="py-3 px-3 text-right">
                  {currentViewStats.totalCarryover < 0 ? (
                    <span className="text-rose-700 dark:text-rose-400 font-bold">
                      {formatCurrency(currentViewStats.totalCarryover)}
                    </span>
                  ) : currentViewStats.totalCarryover > 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatCurrency(currentViewStats.totalCarryover, true)}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">0</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 dark:text-slate-100 bg-sky-50/60 dark:bg-sky-950/40 font-extrabold">
                  {formatCurrency(currentViewStats.totalEffectiveBudget)}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(currentViewStats.totalSpent)}
                </td>
                <td className="py-3 px-3 text-right">
                  {currentViewStats.totalRemaining < 0 ? (
                    <span className="text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/70 px-2.5 py-1 rounded border border-rose-300 dark:border-rose-800 font-bold">
                      Vượt {formatCurrency(currentViewStats.totalRemaining)}
                    </span>
                  ) : (
                    <span className="text-emerald-800 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-950/70 px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-800 font-bold">
                      Dư {formatCurrency(currentViewStats.totalRemaining)}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          currentViewStats.overallPctUsed > 100
                            ? 'bg-rose-500'
                            : currentViewStats.overallPctUsed > 80
                            ? 'bg-amber-500'
                            : 'theme-progress-fill'
                        }`}
                        style={{ width: `${Math.min(100, currentViewStats.overallPctUsed)}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-extrabold w-12 text-right shrink-0 ${
                        currentViewStats.overallPctUsed > 100 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {currentViewStats.overallPctUsed.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 font-sans text-xs">
                  {recordsInPeriod.filter((r) => r.sheetType === 'Expenses').length} gd
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Drill-down transactions for selected category */}
          {hasCategoryFilter && (
            <div className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-4">
              {/* Category Transfers Card (Bổ sung / Điều chuyển quỹ trong kỳ) */}
              {categoryTransfers.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                  <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Điều chuyển / Bổ sung quỹ trong kỳ ({categoryTransfers.length} khoản):</span>
                    </span>
                    <span className="text-[11px] font-normal text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-700">
                      Đã ghi nhận điều chuyển
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono-tabular">
                    {categoryTransfers.map((bt) => {
                      const isReceiving = activeCategories.includes(bt.toCategory);
                      return (
                        <div
                          key={bt.id}
                          className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isReceiving
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {isReceiving ? '+ Nhận' : '- Chuyển'}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{bt.date}</span>
                            <span className="text-slate-600 dark:text-slate-400 font-sans">
                              {bt.description || (isReceiving ? `Nhận từ ${bt.fromCategory}` : `Chuyển sang ${bt.toCategory}`)}
                            </span>
                          </div>
                          <div className={`font-bold ${isReceiving ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {isReceiving ? formatCurrency(bt.amount, true) : formatCurrency(-bt.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>Chi tiết giao dịch phát sinh trong kỳ của:</span>
                  <span className="text-sky-700 dark:text-sky-300 bg-sky-100/80 dark:bg-sky-950/60 px-2 py-0.5 rounded font-extrabold">
                    {activeCategories.length === 1 ? activeCategories[0] : `${activeCategories.length} danh mục`}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">({categoryTransactions.length} giao dịch)</span>
                </h4>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono-tabular">
                  Tổng chi: <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(categoryTransactions.reduce((s, r) => s + r.amount, 0))}</strong>
                </div>
              </div>

              {categoryTransactions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  Chưa có khoản chi nào trong kỳ cho danh mục này.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Ngày</th>
                        <th className="py-2 px-3">Nội dung chi tiêu</th>
                        <th className="py-2 px-3 text-right">Số tiền</th>
                        <th className="py-2 px-3 text-right text-amber-700 dark:text-amber-400">BE Corp</th>
                        <th className="py-2 px-3 text-right text-purple-700 dark:text-purple-400">Credit</th>
                        <th className="py-2 px-3">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-tabular">
                      {categoryTransactions.map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{tx.purchaseDate}</td>
                          <td className="py-2 px-3 font-sans text-slate-900 dark:text-slate-100 font-medium">{tx.purchaseItem}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tx.amount)}</td>
                          <td className="py-2 px-3 text-right text-amber-700 dark:text-amber-400">{tx.beCorp > 0 ? formatCurrency(tx.beCorp) : '—'}</td>
                          <td className="py-2 px-3 text-right text-purple-700 dark:text-purple-400">{tx.credit > 0 ? formatCurrency(tx.credit) : '—'}</td>
                          <td className="py-2 px-3 font-sans text-slate-500 dark:text-slate-400 text-[11px]">{tx.note || '—'}</td>
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
          <div className="mb-3 p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/80 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Ma trận cấn trừ đa tháng:</strong> Hiển thị chuỗi lũy kế số dư của từng hạng mục tiêu dùng từ {allChronologicalMonths[0]} đến {allChronologicalMonths[allChronologicalMonths.length - 1]}. Nếu tháng trước bị bội chi (-), ngân sách khả dụng của tháng kế tiếp sẽ tự động bị khấu trừ phần bội chi đó.
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300">
                <th className="py-2.5 px-3 sticky left-0 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 z-10 w-44 shadow-xs">
                  Hạng mục tiêu dùng
                </th>
                <th className="py-2.5 px-2 text-center w-16 text-slate-700 dark:text-slate-300">Tỷ lệ</th>
                {allChronologicalMonths.map((mKey) => {
                  const [y, m] = mKey.split('-');
                  const label = `T${parseInt(m, 10)}/${y.slice(2)}`;
                  const isCurrent =
                    selectedMonths && selectedMonths.length > 0
                      ? selectedMonths.includes(mKey)
                      : selectedMonth === mKey;
                  return (
                    <th
                      key={mKey}
                      className={`py-2.5 px-3 text-right whitespace-nowrap ${
                        isCurrent
                          ? 'bg-sky-100/90 dark:bg-sky-950/70 text-sky-900 dark:text-sky-300 font-bold border-b-2 border-sky-600'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {label} (Khả dụng / Đã chi)
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-tabular">
              {allCategories.map((cat) => {
                const pct = percentages[cat] ?? 0;
                return (
                  <tr key={cat} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-sans sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                      <CategoryBadge category={cat} compact />
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                      {pct.toFixed(1)}%
                    </td>
                    {allChronologicalMonths.map((mKey) => {
                      const mData = multiMonthRolloverData.chain[cat]?.[mKey];
                      if (!mData) return <td key={mKey} className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-600">—</td>;

                      const isCurrent =
                        selectedMonths && selectedMonths.length > 0
                          ? selectedMonths.includes(mKey)
                          : selectedMonth === mKey;
                      const isOver = mData.remaining < 0;

                      return (
                        <td
                          key={mKey}
                          className={`py-2.5 px-3 text-right whitespace-nowrap ${
                            isCurrent ? 'bg-sky-50/40 dark:bg-sky-950/30' : ''
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              {formatNumberForSheet(mData.spent)} / {formatNumberForSheet(mData.effectiveBudget)}
                            </div>
                            <div className="text-[10px]">
                              {isOver ? (
                                <span className="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-1 rounded">
                                  Bội chi -{formatNumberForSheet(Math.abs(mData.remaining))}
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
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

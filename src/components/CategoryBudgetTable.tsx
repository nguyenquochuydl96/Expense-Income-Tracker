import React, { useMemo, useState } from 'react';
import { TransactionRecord, EXPENSE_CATEGORIES } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import {
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Edit3,
  RotateCcw,
  BarChart3,
  PieChart,
  Check,
  Percent,
} from 'lucide-react';

const SAVED_CATEGORY_PERCENTAGES_KEY = 'heomeo_category_percentages_v1';

// Default percentage allocation of Total Income (% Budget, total = 100%)
export const DEFAULT_CATEGORY_PERCENTAGES: Record<string, number> = {
  'Tiết kiệm': 38.0,
  'Thuê nhà': 16.5,
  'Ăn uống': 15.0,
  'Thú cưng': 7.0,
  'Hóa/Mỹ phẩm': 5.5,
  'Giải trí Heo': 5.0,
  'Quà tặng/Cưới hỏi': 4.0,
  'Giải trí Mèo': 3.0,
  'Điện thoại/Xăng xe': 2.0,
  'Shopping': 2.0,
  'Sức khỏe': 1.0,
  'Du lịch': 1.0,
  'Khác': 0.0,
};

interface CategoryBudgetTableProps {
  recordsInPeriod: TransactionRecord[];
  totalIncome: number; // Budget tổng = Income của tháng đó
  selectedMonth: string;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onShowCharts?: () => void;
  showChartsButton?: boolean;
}

export const CategoryBudgetTable: React.FC<CategoryBudgetTableProps> = ({
  recordsInPeriod,
  totalIncome,
  selectedMonth,
  selectedCategory,
  onSelectCategory,
  onShowCharts,
  showChartsButton = false,
}) => {
  // Category percentage allocation map (% of Total Budget/Income)
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

  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [tempPercentages, setTempPercentages] = useState<Record<string, number>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'over_budget' | 'under_budget'>('all');

  // Compute spent for each category in this period
  const categoryStats = useMemo(() => {
    const expenseRecords = recordsInPeriod.filter((r) => r.sheetType === 'Expenses');
    const spentMap: Record<string, { total: number; count: number }> = {};

    for (const r of expenseRecords) {
      const cat = r.category || 'Khác';
      if (!spentMap[cat]) spentMap[cat] = { total: 0, count: 0 };
      spentMap[cat].total += r.amount;
      spentMap[cat].count += 1;
    }

    // List all standard categories + any other category found in transactions
    const allCatNames = Array.from(
      new Set([...EXPENSE_CATEGORIES, ...Object.keys(spentMap)])
    );

    const items = allCatNames.map((cat) => {
      const spent = spentMap[cat]?.total || 0;
      const count = spentMap[cat]?.count || 0;
      const pct = percentages[cat] ?? 0;
      // Budget = Total Income * (% / 100)
      const budget = Math.round((totalIncome * pct) / 100);
      const remaining = budget - spent;
      const pctUsed = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
      const isOver = remaining < 0;

      return {
        category: cat,
        percentage: pct,
        budget,
        spent,
        remaining,
        pctUsed,
        isOver,
        txCount: count,
      };
    });

    // Sort by spent descending
    items.sort((a, b) => b.spent - a.spent);

    const sumPercentages = items.reduce((sum, item) => sum + item.percentage, 0);
    // Total budget is strictly equal to totalIncome if percentages sum to 100%
    const totalBudget = totalIncome > 0 ? totalIncome : items.reduce((sum, item) => sum + item.budget, 0);
    const totalSpent = items.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallPctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      items,
      sumPercentages,
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPctUsed,
    };
  }, [recordsInPeriod, percentages, totalIncome]);

  // Filtered items based on tab
  const displayedItems = useMemo(() => {
    if (filterMode === 'over_budget') {
      return categoryStats.items.filter((i) => i.isOver && i.spent > 0);
    }
    if (filterMode === 'under_budget') {
      return categoryStats.items.filter((i) => !i.isOver && i.spent > 0);
    }
    return categoryStats.items;
  }, [categoryStats.items, filterMode]);

  // Edit mode handlers
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
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                Phân bổ theo %
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Budget tổng bằng đúng Thu nhập ({formatCurrency(totalIncome)}), chia % định mức cho từng hạng mục trong {monthLabel}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Filters */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({categoryStats.items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('over_budget')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'over_budget'
                  ? 'bg-white text-rose-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Bội chi ({categoryStats.items.filter((i) => i.isOver && i.spent > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('under_budget')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMode === 'under_budget'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Trong hạn mức
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

      {/* Main Budget vs Actual Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-3">Hạng mục tiêu dùng</th>
              <th className="py-2.5 px-3 text-center w-28">Tỷ lệ % Budget</th>
              <th className="py-2.5 px-3 text-right">Ngân sách (Budget)</th>
              <th className="py-2.5 px-3 text-right">Đã chi tiêu</th>
              <th className="py-2.5 px-3 text-right">Còn lại (Remaining)</th>
              <th className="py-2.5 px-3 text-center w-44">Tiến độ (% Used)</th>
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
                          className="w-16 px-1.5 py-0.5 text-center text-xs border border-teal-300 rounded focus:outline-teal-600 font-mono-tabular bg-white"
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

                  {/* Budget Amount (Calculated from Total Income * %) */}
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                    {formatCurrency(item.budget)}
                  </td>

                  {/* Đã chi tiêu */}
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
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
                          style={{ width: `${Math.min(100, item.pctUsed)}%` }}
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
                        {item.budget > 0 ? `${item.pctUsed.toFixed(0)}%` : '—'}
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
                Tổng cộng ngân sách chi tiêu (= Thu nhập)
              </td>
              <td className="py-3 px-3 text-center text-slate-800">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                  {categoryStats.sumPercentages.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-3 text-right text-slate-900">
                {formatCurrency(categoryStats.totalBudget)}
              </td>
              <td className="py-3 px-3 text-right text-slate-900">
                {formatCurrency(categoryStats.totalSpent)}
              </td>
              <td className="py-3 px-3 text-right">
                {categoryStats.totalRemaining < 0 ? (
                  <span className="text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded border border-rose-300 font-bold">
                    Vượt -{formatCurrency(Math.abs(categoryStats.totalRemaining))}
                  </span>
                ) : (
                  <span className="text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded border border-emerald-300 font-bold">
                    Dư {formatCurrency(categoryStats.totalRemaining)}
                  </span>
                )}
              </td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        categoryStats.overallPctUsed > 100
                          ? 'bg-rose-500'
                          : categoryStats.overallPctUsed > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, categoryStats.overallPctUsed)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-extrabold w-12 text-right shrink-0 ${
                      categoryStats.overallPctUsed > 100 ? 'text-rose-700' : 'text-slate-800'
                    }`}
                  >
                    {categoryStats.overallPctUsed.toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="py-3 px-3 text-center text-slate-600 font-sans text-xs">
                {recordsInPeriod.filter((r) => r.sheetType === 'Expenses').length} gd
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};

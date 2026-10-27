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
  Table as TableIcon,
  Check,
} from 'lucide-react';

const SAVED_CATEGORY_BUDGETS_KEY = 'heomeo_category_budgets_v1';

export const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  'Ăn uống': 8500000,
  'Thuê nhà': 9000000,
  'Thú cưng': 4000000,
  'Tiết kiệm': 20000000,
  'Hóa/Mỹ phẩm': 3000000,
  'Giải trí Heo': 3000000,
  'Giải trí Mèo': 1500000,
  'Quà tặng/Cưới hỏi': 2500000,
  'Điện thoại/Xăng xe': 1000000,
  'Shopping': 1000000,
  'Sức khỏe': 500000,
  'Du lịch': 1000000,
  'Khác': 500000,
};

interface CategoryBudgetTableProps {
  recordsInPeriod: TransactionRecord[];
  selectedMonth: string;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onShowCharts?: () => void;
  showChartsButton?: boolean;
}

export const CategoryBudgetTable: React.FC<CategoryBudgetTableProps> = ({
  recordsInPeriod,
  selectedMonth,
  selectedCategory,
  onSelectCategory,
  onShowCharts,
  showChartsButton = false,
}) => {
  // Category budget map state
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_BUDGETS_KEY);
      if (saved) {
        return { ...DEFAULT_CATEGORY_BUDGETS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORY_BUDGETS;
  });

  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>({});
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
      const budget = budgets[cat] ?? 0;
      const remaining = budget - spent;
      const pctUsed = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
      const isOver = remaining < 0;

      return {
        category: cat,
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

    const totalBudget = items.reduce((sum, item) => sum + item.budget, 0);
    const totalSpent = items.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallPctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      items,
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPctUsed,
    };
  }, [recordsInPeriod, budgets]);

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

  // Save edited budgets
  const handleStartEdit = () => {
    setTempBudgets({ ...budgets });
    setIsEditingBudgets(true);
  };

  const handleSaveBudgets = () => {
    setBudgets(tempBudgets);
    try {
      localStorage.setItem(SAVED_CATEGORY_BUDGETS_KEY, JSON.stringify(tempBudgets));
    } catch {
      // ignore
    }
    setIsEditingBudgets(false);
  };

  const handleResetBudgets = () => {
    setBudgets(DEFAULT_CATEGORY_BUDGETS);
    try {
      localStorage.removeItem(SAVED_CATEGORY_BUDGETS_KEY);
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Ngân sách &amp; Chi tiêu theo Hạng mục
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Budget · Đã chi · Còn lại
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi chi tiết hạn mức ngân sách và số dư còn lại của từng khoản chi tiêu trong {monthLabel}
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

          {/* Edit Budgets button */}
          {!isEditingBudgets ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Chỉnh Budget</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
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
              <th className="py-2.5 px-3 text-right">Ngân sách (Budget)</th>
              <th className="py-2.5 px-3 text-right">Đã chi tiêu</th>
              <th className="py-2.5 px-3 text-right">Còn lại (Remaining)</th>
              <th className="py-2.5 px-3 text-center w-48">Tiến độ chi tiêu (% Used)</th>
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

                  {/* Budget (Ngân sách) */}
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                    {isEditingBudgets ? (
                      <input
                        type="number"
                        className="w-28 px-2 py-1 text-right text-xs border border-teal-300 rounded focus:outline-teal-600 font-mono-tabular bg-white"
                        value={tempBudgets[item.category] ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setTempBudgets((prev) => ({ ...prev, [item.category]: val }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      formatCurrency(item.budget)
                    )}
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
                        <span>Bội chi {formatCurrency(Math.abs(item.remaining))}</span>
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
                Tổng cộng ngân sách chi tiêu
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
                    Vượt {formatCurrency(Math.abs(categoryStats.totalRemaining))}
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

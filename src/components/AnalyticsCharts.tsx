import React, { useMemo, useState } from 'react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency } from '../utils/csvParser';
import { usePrivacyMode } from '../utils/privacyService';

interface AnalyticsChartsProps {
  expensesInPeriod: TransactionRecord[];
  allRecords: TransactionRecord[];
  selectedMonth: string;
  selectedMonths?: string[];
  onSelectMonth: (monthKey: string) => void;
  onToggleMonth?: (monthKey: string) => void;
  selectedCategoryFilter: string;
  onSelectCategoryFilter: (category: string) => void;
  selectedCategories?: string[];
  onToggleCategoryFilter?: (category: string) => void;
  monthlyBaseIncome: number;
  isPrivate?: boolean;
}

// Coral / Salmon shades matching the reference image donut chart
const DONUT_CORAL_SHADES = [
  '#F87171', // Coral primary
  '#FB7185', // Rose
  '#F43F5E', // Crimson coral
  '#FB923C', // Warm orange coral
  '#FDA4AF', // Soft pink
  '#FECDD3', // Light blush
  '#FCA5A5', // Soft salmon
  '#FEE2E2', // Pale peach
];

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = React.memo(({
  expensesInPeriod,
  allRecords,
  selectedMonth,
  selectedMonths,
  onSelectMonth,
  onToggleMonth,
  selectedCategoryFilter,
  onSelectCategoryFilter,
  selectedCategories,
  onToggleCategoryFilter,
  monthlyBaseIncome,
  isPrivate: propIsPrivate,
}) => {
  const { isPrivate: hookIsPrivate } = usePrivacyMode();
  const _effectiveIsPrivate = propIsPrivate !== undefined ? propIsPrivate : hookIsPrivate;
  const [excludeSavingsInPie, setExcludeSavingsInPie] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'categories' | 'monthly'>('categories');

  const isMultiCategory = !!(selectedCategories && selectedCategories.length > 0);
  const hasCategoryFilter = isMultiCategory || selectedCategoryFilter !== 'ALL';

  const isCategorySelected = (cat: string) => {
    if (isMultiCategory && selectedCategories) {
      return selectedCategories.includes(cat);
    }
    return selectedCategoryFilter === cat;
  };

  // 1. Category breakdown for Horizontal Bar Chart & Donut Chart
  const categoryStats = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number; beCorp: number; credit: number }>();

    for (const rec of expensesInPeriod) {
      if (rec.sheetType !== 'Expenses') continue;
      if (excludeSavingsInPie && rec.category === 'Tiết kiệm') continue;

      const cur = totals.get(rec.category) || { amount: 0, count: 0, beCorp: 0, credit: 0 };
      cur.amount += rec.amount;
      cur.count += 1;
      cur.beCorp += rec.beCorp;
      cur.credit += rec.credit;
      totals.set(rec.category, cur);
    }

    const positiveItems = Array.from(totals.entries())
      .map(([category, data], idx) => ({
        category,
        amount: Math.max(0, data.amount),
        count: data.count,
        beCorp: data.beCorp,
        credit: data.credit,
        color: DONUT_CORAL_SHADES[idx % DONUT_CORAL_SHADES.length],
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const grandTotal = positiveItems.reduce((acc, item) => acc + item.amount, 0);

    let cumulativeAngle = 0;
    const slices = positiveItems.map((item, idx) => {
      const percentage = grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0;
      const angle = grandTotal > 0 ? (item.amount / grandTotal) * 360 : 0;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;
      return {
        ...item,
        percentage,
        startAngle,
        endAngle,
        color: DONUT_CORAL_SHADES[idx % DONUT_CORAL_SHADES.length],
      };
    });

    return { slices, grandTotal, topItems: slices.slice(0, 6) };
  }, [expensesInPeriod, excludeSavingsInPie]);

  // Max value for horizontal bars
  const maxCategoryAmount = useMemo(() => {
    if (categoryStats.topItems.length === 0) return 1000000;
    return Math.max(...categoryStats.topItems.map((c) => c.amount)) * 1.15;
  }, [categoryStats.topItems]);

  // 2. Monthly Cashflow data for alternative Bar Chart view
  const monthlyCashflow = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        income: number;
        livingExpense: number;
        savingsExpense: number;
        totalExpense: number;
        beCorp: number;
        credit: number;
      }
    >();

    for (const rec of allRecords) {
      if (!rec.monthKey || !rec.monthKey.includes('-')) continue;
      const existing = map.get(rec.monthKey) || {
        monthKey: rec.monthKey,
        label: `T${parseInt(rec.monthKey.split('-')[1], 10)}/${rec.monthKey.split('-')[0].slice(2)}`,
        income: 0,
        livingExpense: 0,
        savingsExpense: 0,
        totalExpense: 0,
        beCorp: 0,
        credit: 0,
      };

      if (rec.sheetType === 'Income') {
        existing.income += rec.amount;
      } else {
        existing.totalExpense += rec.amount;
        if (rec.category === 'Tiết kiệm') {
          existing.savingsExpense += rec.amount;
        } else {
          existing.livingExpense += rec.amount;
        }
        existing.beCorp += rec.beCorp;
        existing.credit += rec.credit;
      }

      map.set(rec.monthKey, existing);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return sorted.map((m) => ({
      ...m,
      effectiveIncome: m.income > 0 ? m.income : monthlyBaseIncome,
      hasSheetIncome: m.income > 0,
    }));
  }, [allRecords, monthlyBaseIncome]);

  // Helper to draw SVG donut arc
  const describeArc = (
    x: number,
    y: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number
  ) => {
    const clampedEnd = endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle;
    const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy + r * Math.sin(angleInRadians),
      };
    };

    const startOuter = polarToCartesian(x, y, outerR, clampedEnd);
    const endOuter = polarToCartesian(x, y, outerR, startAngle);
    const startInner = polarToCartesian(x, y, innerR, clampedEnd);
    const endInner = polarToCartesian(x, y, innerR, startAngle);
    const largeArcFlag = clampedEnd - startAngle <= 180 ? '0' : '1';

    return [
      'M',
      startOuter.x,
      startOuter.y,
      'A',
      outerR,
      outerR,
      0,
      largeArcFlag,
      0,
      endOuter.x,
      endOuter.y,
      'L',
      endInner.x,
      endInner.y,
      'A',
      innerR,
      innerR,
      0,
      largeArcFlag,
      1,
      startInner.x,
      startInner.y,
      'Z',
    ].join(' ');
  };

  // Helper to calculate text position on donut segment
  const getLabelPosition = (
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const midAngle = startAngle + (endAngle - startAngle) / 2;
    const angleInRadians = ((midAngle - 90) * Math.PI) / 180.0;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ═══════ LEFT CHART: HORIZONTAL BAR CHART (Matching Xero Reference) ═══════ */}
      <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Top chi tiêu theo danh mục
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-300/60 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setActiveChartTab('categories')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  activeChartTab === 'categories'
                    ? 'bg-white dark:bg-sky-600 text-sky-900 dark:text-white font-bold shadow-2xs border border-slate-200/80 dark:border-sky-500'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                Top danh mục
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('monthly')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  activeChartTab === 'monthly'
                    ? 'bg-white dark:bg-sky-600 text-sky-900 dark:text-white font-bold shadow-2xs border border-slate-200/80 dark:border-sky-500'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                Dòng tiền tháng
              </button>
            </div>
          </div>

          {activeChartTab === 'categories' ? (
            /* Horizontal Bar Chart (Cyan bars like the reference image) */
            <div className="space-y-3.5 pt-1">
              {categoryStats.topItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Không có dữ liệu chi tiêu trong kỳ này
                </div>
              ) : (
                categoryStats.topItems.map((item) => {
                  const widthPercent = Math.min(100, Math.max(8, (item.amount / maxCategoryAmount) * 100));
                  const isSelected = isCategorySelected(item.category);

                  return (
                    <div
                      key={item.category}
                      onClick={() => {
                        if (onToggleCategoryFilter) {
                          onToggleCategoryFilter(item.category);
                        } else {
                          onSelectCategoryFilter(selectedCategoryFilter === item.category ? 'ALL' : item.category);
                        }
                      }}
                      className={`group flex items-center gap-3 cursor-pointer py-0.5 transition-opacity ${
                        hasCategoryFilter && !isSelected ? 'opacity-40' : ''
                      }`}
                    >
                      {/* Category Label (Right aligned on Y-axis) */}
                      <div className="w-32 sm:w-36 text-right shrink-0">
                        <span
                          className={`text-xs truncate block ${
                            isSelected
                              ? 'font-bold text-sky-800 dark:text-sky-400'
                              : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white font-medium'
                          }`}
                          title={item.category}
                        >
                          {item.category}
                        </span>
                      </div>

                      {/* Bar Container */}
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-sm h-7 relative flex items-center overflow-hidden">
                        <div
                          className={`h-full rounded-r-sm transition-all duration-300 flex items-center justify-end pr-2.5 ${
                            isSelected
                              ? 'bg-sky-500 shadow-sm'
                              : 'bg-cyan-400 group-hover:bg-cyan-500'
                          }`}
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: isSelected ? '#0284C7' : '#38BDF8',
                          }}
                        >
                          {/* Value on Bar */}
                          <span className="text-[11px] font-bold font-mono-tabular text-slate-800 whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* X-Axis Ticks */}
              {categoryStats.topItems.length > 0 && (
                <div className="flex items-center justify-between pl-36 sm:pl-40 pt-2 text-[10px] font-mono-tabular text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                  <span>0</span>
                  <span>{formatCurrency(maxCategoryAmount * 0.25)}</span>
                  <span>{formatCurrency(maxCategoryAmount * 0.5)}</span>
                  <span>{formatCurrency(maxCategoryAmount * 0.75)}</span>
                  <span>{formatCurrency(maxCategoryAmount)}</span>
                </div>
              )}
            </div>
          ) : (
            /* Monthly Cashflow Bar Chart */
            <div className="pt-2">
              <div className="grid grid-cols-7 gap-2 items-end h-44 pt-4 px-2 border-b border-slate-100 dark:border-slate-800">
                {monthlyCashflow.map((m) => {
                  const isSelected =
                    selectedMonths && selectedMonths.length > 0
                      ? selectedMonths.includes(m.monthKey)
                      : selectedMonth === m.monthKey;
                  const maxVal = Math.max(1, ...monthlyCashflow.map((x) => Math.max(x.effectiveIncome, x.totalExpense)));
                  const incomeH = Math.max(4, Math.round((m.effectiveIncome / maxVal) * 120));
                  const expenseH = Math.max(4, Math.round((m.totalExpense / maxVal) * 120));

                  return (
                    <div
                      key={m.monthKey}
                      onClick={() => {
                        if (onToggleMonth) {
                          onToggleMonth(m.monthKey);
                        } else {
                          onSelectMonth(selectedMonth === m.monthKey ? 'ALL' : m.monthKey);
                        }
                      }}
                      className={`flex flex-col items-center cursor-pointer rounded-t p-1 transition-colors ${
                        isSelected ? 'bg-sky-50 dark:bg-sky-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                      title={`Nhấp để chọn / bỏ chọn ${m.label} vào bộ lọc`}
                    >
                      <div className="flex items-end justify-center gap-1 w-full h-32">
                        <div
                          className="w-3 bg-emerald-500 rounded-t-xs"
                          style={{ height: `${incomeH}px` }}
                          title={`Thu nhập: ${formatCurrency(m.effectiveIncome)}`}
                        />
                        <div
                          className="w-3 bg-rose-500 rounded-t-xs"
                          style={{ height: `${expenseH}px` }}
                          title={`Chi tiêu: ${formatCurrency(m.totalExpense)}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono-tabular mt-1.5 text-slate-600 dark:text-slate-400 font-medium">
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Category Filter Indicator */}
        {hasCategoryFilter && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>
              Đang lọc:{' '}
              <strong className="text-sky-800 dark:text-sky-400">
                {isMultiCategory && selectedCategories
                  ? selectedCategories.length === 1
                  ? selectedCategories[0]
                  : `${selectedCategories.length} danh mục (${selectedCategories.join(', ')})`
                  : selectedCategoryFilter}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectCategoryFilter('ALL')}
              className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 font-semibold cursor-pointer"
            >
              Bỏ lọc danh mục
            </button>
          </div>
        )}
      </section>

      {/* ═══════ RIGHT CHART: DONUT CHART (Coral/Salmon Palette like Reference) ═══════ */}
      <section className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Tỷ trọng chi tiêu
            </h2>
            <button
              type="button"
              onClick={() => setExcludeSavingsInPie((prev) => !prev)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                excludeSavingsInPie
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {excludeSavingsInPie ? 'Ẩn TK' : 'Gồm TK'}
            </button>
          </div>

          {categoryStats.slices.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Không có dữ liệu trong kỳ đã chọn
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Donut SVG with percentages in segments */}
              <div className="sm:col-span-7 flex justify-center relative">
                <svg viewBox="0 0 220 220" className="w-48 h-48 overflow-visible">
                  {categoryStats.slices.map((slice) => {
                    const isSelected = isCategorySelected(slice.category);
                    const isHovered = hoveredCategory === slice.category;
                    const outerRadius = isSelected || isHovered ? 98 : 92;
                    const innerRadius = 52;
                    const labelPos = getLabelPosition(110, 110, 72, slice.startAngle, slice.endAngle);
                    const showLabel = slice.percentage >= 8;

                    return (
                      <g key={slice.category}>
                        <path
                          d={describeArc(110, 110, outerRadius, innerRadius, slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          className="cursor-pointer transition-all duration-200"
                          style={{
                            opacity:
                              (hasCategoryFilter && !isSelected) ||
                              (hoveredCategory && !isHovered)
                                ? 0.35
                                : 1,
                          }}
                          onMouseEnter={() => setHoveredCategory(slice.category)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          onClick={() => {
                            if (onToggleCategoryFilter) {
                              onToggleCategoryFilter(slice.category);
                            } else {
                              onSelectCategoryFilter(
                                selectedCategoryFilter === slice.category ? 'ALL' : slice.category
                              );
                            }
                          }}
                        />
                        {/* Percentage Label on Slice (Matching reference image) */}
                        {showLabel && (
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="text-[11px] font-bold font-mono-tabular fill-slate-800 pointer-events-none"
                            style={{ textShadow: '0 0 3px rgba(255,255,255,0.8)' }}
                          >
                            {slice.percentage.toFixed(1)}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Legend with colored dots (Matching reference image) */}
              <div className="sm:col-span-5 space-y-2 max-h-48 overflow-y-auto pr-1">
                {categoryStats.slices.slice(0, 6).map((slice) => {
                  const isSelected = selectedCategoryFilter === slice.category;
                  return (
                    <button
                      key={slice.category}
                      type="button"
                      onClick={() =>
                        onSelectCategoryFilter(isSelected ? 'ALL' : slice.category)
                      }
                      onMouseEnter={() => setHoveredCategory(slice.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`w-full flex items-center gap-2 text-left text-xs transition-colors py-0.5 rounded ${
                        isSelected ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="truncate text-xs">{slice.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Total Note */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
          <span>Tổng chi danh mục:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(categoryStats.grandTotal)}</span>
        </div>
      </section>
    </div>
  );
});

AnalyticsCharts.displayName = 'AnalyticsCharts';

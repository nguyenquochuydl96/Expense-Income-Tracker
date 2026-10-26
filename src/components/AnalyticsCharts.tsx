import React, { useMemo, useState } from 'react';
import { CATEGORY_COLORS, TransactionRecord } from '../types/finance';
import { formatCurrency } from '../utils/csvParser';

interface AnalyticsChartsProps {
  expensesInPeriod: TransactionRecord[];
  allRecords: TransactionRecord[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  selectedCategoryFilter: string;
  onSelectCategoryFilter: (category: string) => void;
  monthlyBaseIncome: number;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  expensesInPeriod,
  allRecords,
  selectedMonth,
  onSelectMonth,
  selectedCategoryFilter,
  onSelectCategoryFilter,
  monthlyBaseIncome,
}) => {
  const [excludeSavingsInPie, setExcludeSavingsInPie] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // 1. Category breakdown for Pie/Donut Chart
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
      .map(([category, data]) => ({
        category,
        amount: Math.max(0, data.amount),
        netAmount: data.amount,
        count: data.count,
        beCorp: data.beCorp,
        credit: data.credit,
        color: CATEGORY_COLORS[category] || '#64748B',
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const grandTotal = positiveItems.reduce((acc, item) => acc + item.amount, 0);

    let cumulativeAngle = 0;
    const slices = positiveItems.map((item) => {
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
      };
    });

    return { slices, grandTotal };
  }, [expensesInPeriod, excludeSavingsInPie]);

  // 2. Monthly Cashflow data for Bar Chart
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

  const maxBarValue = useMemo(() => {
    let max = 10_000_000;
    for (const m of monthlyCashflow) {
      max = Math.max(max, m.effectiveIncome, m.totalExpense, m.livingExpense);
    }
    return max * 1.08;
  }, [monthlyCashflow]);

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

  const activeSlice = useMemo(() => {
    if (hoveredCategory) {
      return categoryStats.slices.find((s) => s.category === hoveredCategory) || null;
    }
    if (selectedCategoryFilter && selectedCategoryFilter !== 'ALL') {
      return categoryStats.slices.find((s) => s.category === selectedCategoryFilter) || null;
    }
    return null;
  }, [hoveredCategory, selectedCategoryFilter, categoryStats.slices]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Pie / Donut Chart: Category Allocation */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Phân bổ chi tiêu theo danh mục</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhấp vào danh mục để lọc bảng giao dịch chi tiết bên dưới
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExcludeSavingsInPie((prev) => !prev)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                excludeSavingsInPie
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {excludeSavingsInPie ? 'Đang ẩn Tiết kiệm' : 'Gồm cả Tiết kiệm'}
            </button>
          </div>

          {categoryStats.slices.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Không có dữ liệu chi tiêu dương trong kỳ đã chọn.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* SVG Donut */}
              <div className="sm:col-span-6 flex justify-center relative">
                <svg viewBox="0 0 220 220" className="w-48 h-48 overflow-visible">
                  {categoryStats.slices.map((slice) => {
                    const isSelected = selectedCategoryFilter === slice.category;
                    const isHovered = hoveredCategory === slice.category;
                    const outerRadius = isSelected || isHovered ? 96 : 90;
                    return (
                      <path
                        key={slice.category}
                        d={describeArc(110, 110, outerRadius, 58, slice.startAngle, slice.endAngle)}
                        fill={slice.color}
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                        className="cursor-pointer transition-opacity duration-150"
                        style={{
                          opacity:
                            (selectedCategoryFilter !== 'ALL' && !isSelected) ||
                            (hoveredCategory && !isHovered)
                              ? 0.45
                              : 1,
                        }}
                        onMouseEnter={() => setHoveredCategory(slice.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={() =>
                          onSelectCategoryFilter(
                            selectedCategoryFilter === slice.category ? 'ALL' : slice.category
                          )
                        }
                      />
                    );
                  })}
                </svg>
                {/* Center readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
                  <span className="text-[11px] text-slate-500 truncate max-w-[110px]">
                    {activeSlice ? activeSlice.category : 'Tổng chi danh mục'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 font-mono-tabular mt-0.5">
                    {formatCurrency(activeSlice ? activeSlice.amount : categoryStats.grandTotal)}
                  </span>
                  {activeSlice && (
                    <span className="text-[11px] font-medium text-teal-700 font-mono-tabular">
                      {activeSlice.percentage.toFixed(1)}% · {activeSlice.count} khoản
                    </span>
                  )}
                </div>
              </div>

              {/* Legend list */}
              <div className="sm:col-span-6 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {categoryStats.slices.map((slice) => {
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
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="truncate">{slice.category}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono-tabular">
                        <span className={isSelected ? 'text-slate-300' : 'text-slate-400'}>
                          {slice.percentage.toFixed(1)}%
                        </span>
                        <span className="font-medium">{formatCurrency(slice.amount)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedCategoryFilter !== 'ALL' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Đang lọc theo danh mục: <strong className="text-slate-900">{selectedCategoryFilter}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectCategoryFilter('ALL')}
              className="text-teal-700 hover:underline font-medium"
            >
              Bỏ lọc danh mục
            </button>
          </div>
        )}
      </section>

      {/* 2. Bar Chart: Monthly Cashflow */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Biểu đồ dòng tiền theo tháng (T4/2026 – T10/2026)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh Thu nhập, Chi sinh hoạt và Tiết kiệm giữa các tháng · Nhấp vào cột để xem tháng đó
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-xs" />
                Thu nhập
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 bg-rose-600 inline-block rounded-xs" />
                Chi sinh hoạt
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 bg-blue-600 inline-block rounded-xs" />
                Tiết kiệm
              </span>
            </div>
          </div>

          {/* Bar Chart Canvas */}
          <div className="mt-6 relative">
            <div className="grid grid-cols-7 gap-3 items-end h-52 pt-6 px-2 border-b border-slate-200">
              {monthlyCashflow.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                const incomeH = Math.max(2, Math.round((m.effectiveIncome / maxBarValue) * 165));
                const livingH = Math.max(2, Math.round((Math.max(0, m.livingExpense) / maxBarValue) * 165));
                const savingsH = Math.max(
                  0,
                  Math.round((Math.max(0, m.savingsExpense) / maxBarValue) * 165)
                );

                return (
                  <div
                    key={m.monthKey}
                    onClick={() =>
                      onSelectMonth(selectedMonth === m.monthKey ? 'ALL' : m.monthKey)
                    }
                    onMouseEnter={() => setHoveredMonth(m.monthKey)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className={`group flex flex-col items-center cursor-pointer rounded-t-lg pt-2 px-1 transition-colors ${
                      isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-end justify-center gap-1.5 w-full h-44">
                      {/* Income Bar */}
                      {m.effectiveIncome > 0 && (
                        <div
                          className="w-3 sm:w-4 bg-emerald-600 rounded-t-xs transition-opacity group-hover:opacity-90"
                          style={{ height: `${incomeH}px` }}
                          title={`Thu nhập ${m.label}: ${formatCurrency(m.effectiveIncome)}`}
                        />
                      )}
                      {/* Stacked Expense Bar (Living + Savings) */}
                      <div className="flex flex-col justify-end w-3 sm:w-4 h-full">
                        {savingsH > 0 && (
                          <div
                            className="w-full bg-blue-600 rounded-t-xs"
                            style={{ height: `${savingsH}px` }}
                            title={`Tiết kiệm ${m.label}: ${formatCurrency(m.savingsExpense)}`}
                          />
                        )}
                        <div
                          className={`w-full bg-rose-600 ${savingsH === 0 ? 'rounded-t-xs' : ''}`}
                          style={{ height: `${livingH}px` }}
                          title={`Chi sinh hoạt ${m.label}: ${formatCurrency(m.livingExpense)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis Labels */}
            <div className="grid grid-cols-7 gap-3 pt-2 px-2 text-center">
              {monthlyCashflow.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() =>
                      onSelectMonth(selectedMonth === m.monthKey ? 'ALL' : m.monthKey)
                    }
                    className={`text-xs font-mono-tabular py-1 rounded transition-colors ${
                      isSelected
                        ? 'font-bold text-teal-800 bg-teal-50'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hovered or Active Month Detail Strip */}
        {(() => {
          const targetKey =
            hoveredMonth || (selectedMonth !== 'ALL' ? selectedMonth : monthlyCashflow[monthlyCashflow.length - 1]?.monthKey);
          const detail = monthlyCashflow.find((m) => m.monthKey === targetKey);
          if (!detail) return null;

          return (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-mono-tabular">
              <span className="font-sans font-semibold text-slate-900">
                Chi tiết {detail.label}:
              </span>
              <span>
                Tổng chi: <strong className="text-slate-900">{formatCurrency(detail.totalExpense)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Sinh hoạt: <strong className="text-rose-700">{formatCurrency(detail.livingExpense)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tiết kiệm: <strong className="text-blue-700">{formatCurrency(detail.savingsExpense)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                BE Corp: <strong className="text-amber-700">{formatCurrency(detail.beCorp)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Credit: <strong className="text-indigo-700">{formatCurrency(detail.credit)}</strong>
              </span>
            </div>
          );
        })()}
      </section>
    </div>
  );
};

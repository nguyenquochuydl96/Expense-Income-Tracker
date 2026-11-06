import React, { useMemo, useState, useEffect, useRef } from 'react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { getBillingCycleRange } from '../utils/cycleUtils';
import { usePrivacyMode } from '../utils/privacyService';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';

export type SummaryTimeRangePreset = '3m' | '6m' | '12m' | 'all' | 'custom';

interface MultiMonthSummaryTableProps {
  allRecords: TransactionRecord[];
  availableMonths: string[];
  selectedMonth: string;
  selectedMonths?: string[];
  onSelectMonth: (monthKey: string) => void;
  onToggleMonth?: (monthKey: string) => void;
  monthlyBaseIncome?: number;
  beCorpStartDay?: number;
  beCorpEndDay?: number;
  creditStartDay?: number;
  creditEndDay?: number;
  isPrivate?: boolean;
}

export const MultiMonthSummaryTable: React.FC<MultiMonthSummaryTableProps> = React.memo(({
  allRecords,
  availableMonths,
  selectedMonth,
  selectedMonths,
  onSelectMonth,
  onToggleMonth,
  monthlyBaseIncome,
  beCorpStartDay = 26,
  beCorpEndDay = 25,
  creditStartDay = 20,
  creditEndDay = 19,
  isPrivate: propIsPrivate,
}) => {
  const { isPrivate: hookIsPrivate } = usePrivacyMode();
  // Ensure both hook and prop changes trigger re-render
  const _effectiveIsPrivate = propIsPrivate !== undefined ? propIsPrivate : hookIsPrivate;
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isMonthSelected = (mKey: string) => {
    if (selectedMonths && selectedMonths.length > 0) {
      return selectedMonths.includes(mKey);
    }
    return selectedMonth === mKey;
  };

  // Time-range selector state: Default to '3m' (3 tháng gần nhất)
  const [rangePreset, setRangePreset] = useState<SummaryTimeRangePreset>('3m');
  
  // Chronological order of all available months (e.g. T4 -> T11)
  const sortedMonths = useMemo(() => {
    return [...availableMonths].sort((a, b) => a.localeCompare(b));
  }, [availableMonths]);

  // Window ending index (inclusive) for sliding window in preset modes
  // Defaults to the latest month in the dataset
  const [windowEndIndex, setWindowEndIndex] = useState<number>(() =>
    Math.max(0, sortedMonths.length - 1)
  );

  // Custom range start/end months
  const [customStartMonth, setCustomStartMonth] = useState<string>(
    () => sortedMonths[Math.max(0, sortedMonths.length - 3)] || sortedMonths[0] || ''
  );
  const [customEndMonth, setCustomEndMonth] = useState<string>(
    () => sortedMonths[sortedMonths.length - 1] || ''
  );

  // Sync window when new months are loaded
  useEffect(() => {
    if (sortedMonths.length > 0) {
      setWindowEndIndex((prev) => {
        // If it was at the end or out of bounds, snap to latest month
        if (prev >= sortedMonths.length - 1 || prev <= 0) {
          return sortedMonths.length - 1;
        }
        return Math.min(prev, sortedMonths.length - 1);
      });
      if (!customStartMonth || !sortedMonths.includes(customStartMonth)) {
        setCustomStartMonth(sortedMonths[Math.max(0, sortedMonths.length - 3)] || sortedMonths[0]);
      }
      if (!customEndMonth || !sortedMonths.includes(customEndMonth)) {
        setCustomEndMonth(sortedMonths[sortedMonths.length - 1]);
      }
    }
  }, [sortedMonths]);

  // If user selects a specific month from the main Dashboard dropdown, ensure it is within view
  const prevSelectedMonthRef = useRef<string>(selectedMonth);
  useEffect(() => {
    if (
      selectedMonth !== 'ALL' &&
      selectedMonth !== prevSelectedMonthRef.current &&
      sortedMonths.length > 0
    ) {
      prevSelectedMonthRef.current = selectedMonth;
      const targetIdx = sortedMonths.indexOf(selectedMonth);
      if (targetIdx !== -1 && (rangePreset === '3m' || rangePreset === '6m' || rangePreset === '12m')) {
        const windowSize = rangePreset === '3m' ? 3 : rangePreset === '6m' ? 6 : 12;
        const currentStart = Math.max(0, windowEndIndex - windowSize + 1);
        const currentEnd = windowEndIndex;

        // If selected month is outside the currently visible window, shift window to include it
        if (targetIdx > currentEnd) {
          setWindowEndIndex(targetIdx);
        } else if (targetIdx < currentStart) {
          setWindowEndIndex(Math.min(sortedMonths.length - 1, targetIdx + windowSize - 1));
        }
      }
    }
  }, [selectedMonth, sortedMonths, rangePreset, windowEndIndex]);

  // Compute stats for ALL months first so cumulative cash flow is calculated accurately
  const allMonthlyData = useMemo(() => {
    let runningCumulative = 0;
    return sortedMonths.map((mKey) => {
      const [y, m] = mKey.split('-');
      const label = `T${parseInt(m, 10)}/${y.slice(2)}`;

      const mRecords = allRecords.filter((r) => r.monthKey === mKey);

      // Income strictly from Sheet Income records for this specific month
      const sheetIncome = mRecords
        .filter((r) => r.sheetType === 'Income')
        .reduce((sum, r) => sum + r.amount, 0);
      const income = sheetIncome;

      // Expenses
      const expenseRecords = mRecords.filter((r) => r.sheetType === 'Expenses');
      let totalExpense = 0;
      let livingExpense = 0;
      let savingsExpense = 0;

      for (const r of expenseRecords) {
        totalExpense += r.amount;
        if (r.category === 'Tiết kiệm') {
          savingsExpense += r.amount;
        } else {
          livingExpense += r.amount;
        }
      }

      const remaining = income - totalExpense;
      runningCumulative += remaining;
      const pctUsed = income > 0 ? (totalExpense / income) * 100 : 0;

      // Cycle-aware BE Corp & Credit
      const beRange = getBillingCycleRange(mKey, beCorpStartDay, beCorpEndDay);
      const creditRange = getBillingCycleRange(mKey, creditStartDay, creditEndDay);

      const beCorpTotal = allRecords
        .filter(
          (r) =>
            r.sheetType === 'Expenses' &&
            r.beCorp !== 0 &&
            r.isoDate >= beRange.startDate &&
            r.isoDate <= beRange.endDate
        )
        .reduce((sum, r) => sum + r.beCorp, 0);

      const creditTotal = allRecords
        .filter(
          (r) =>
            r.sheetType === 'Expenses' &&
            r.credit !== 0 &&
            r.isoDate >= creditRange.startDate &&
            r.isoDate <= creditRange.endDate
        )
        .reduce((sum, r) => sum + r.credit, 0);

      return {
        mKey,
        label,
        budget: income,
        livingExpense,
        savingsExpense,
        totalExpense,
        remaining,
        cumulativeRemaining: runningCumulative,
        pctUsed,
        beCorpTotal,
        creditTotal,
        beRangeLabel: beRange.displayLabel,
        creditRangeLabel: creditRange.displayLabel,
      };
    });
  }, [
    sortedMonths,
    allRecords,
    beCorpStartDay,
    beCorpEndDay,
    creditStartDay,
    creditEndDay,
  ]);

  // Window bounds calculation
  const windowSize = rangePreset === '3m' ? 3 : rangePreset === '6m' ? 6 : 12;
  const clampedEndIndex = Math.min(Math.max(0, windowEndIndex), Math.max(0, allMonthlyData.length - 1));
  const clampedStartIndex = Math.max(0, clampedEndIndex - windowSize + 1);

  // Filter visible months based on selected time range
  const visibleMonthlyData = useMemo(() => {
    if (allMonthlyData.length === 0) return [];

    if (rangePreset === 'all') {
      return allMonthlyData;
    }

    if (rangePreset === 'custom') {
      return allMonthlyData.filter((m) => {
        if (customStartMonth && m.mKey < customStartMonth) return false;
        if (customEndMonth && m.mKey > customEndMonth) return false;
        return true;
      });
    }

    return allMonthlyData.slice(clampedStartIndex, clampedEndIndex + 1);
  }, [allMonthlyData, rangePreset, clampedStartIndex, clampedEndIndex, customStartMonth, customEndMonth]);

  // Navigation handlers for shifting the time window
  const canGoPrev = clampedStartIndex > 0;
  const canGoNext = clampedEndIndex < allMonthlyData.length - 1;

  const handlePrevWindow = () => {
    if (!canGoPrev) return;
    setWindowEndIndex((prev) => Math.max(windowSize - 1, prev - 1));
  };

  const handleNextWindow = () => {
    if (!canGoNext) return;
    setWindowEndIndex((prev) => Math.min(allMonthlyData.length - 1, prev + 1));
  };

  const handleResetToLatest = () => {
    setWindowEndIndex(allMonthlyData.length - 1);
  };

  // Range label for display
  const currentRangeLabel = useMemo(() => {
    if (visibleMonthlyData.length === 0) return '';
    const first = visibleMonthlyData[0].label;
    const last = visibleMonthlyData[visibleMonthlyData.length - 1].label;
    if (first === last) return first;
    return `${first} – ${last}`;
  }, [visibleMonthlyData]);

  // Aggregate stats (Total & Average across visible months)
  const totals = useMemo(() => {
    const count = Math.max(1, visibleMonthlyData.length);
    const sumBudget = visibleMonthlyData.reduce((s, m) => s + m.budget, 0);
    const sumLiving = visibleMonthlyData.reduce((s, m) => s + m.livingExpense, 0);
    const sumSavings = visibleMonthlyData.reduce((s, m) => s + m.savingsExpense, 0);
    const sumExpense = visibleMonthlyData.reduce((s, m) => s + m.totalExpense, 0);
    const sumRemaining = visibleMonthlyData.reduce((s, m) => s + m.remaining, 0);
    const sumBeCorp = visibleMonthlyData.reduce((s, m) => s + m.beCorpTotal, 0);
    const sumCredit = visibleMonthlyData.reduce((s, m) => s + m.creditTotal, 0);

    const lastItem = visibleMonthlyData[visibleMonthlyData.length - 1];
    const finalCumulativeRemaining = lastItem ? lastItem.cumulativeRemaining : sumRemaining;

    return {
      total: {
        budget: sumBudget,
        living: sumLiving,
        savings: sumSavings,
        expense: sumExpense,
        remaining: sumRemaining,
        cumulativeRemaining: finalCumulativeRemaining,
        beCorp: sumBeCorp,
        credit: sumCredit,
      },
      avg: {
        budget: sumBudget / count,
        living: sumLiving / count,
        savings: sumSavings / count,
        expense: sumExpense / count,
        remaining: sumRemaining / count,
        beCorp: sumBeCorp / count,
        credit: sumCredit / count,
      },
    };
  }, [visibleMonthlyData]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl theme-badge-accent flex items-center justify-center shrink-0 shadow-2xs font-bold">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Bảng tổng hợp ngân sách đa tháng (Multi–Month Summary)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold theme-badge-accent">
                {visibleMonthlyData.length === allMonthlyData.length
                  ? `${allMonthlyData.length} tháng`
                  : `${visibleMonthlyData.length} / ${allMonthlyData.length} tháng`}
              </span>
              {currentRangeLabel && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold theme-badge-accent font-mono-tabular">
                  {currentRangeLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Đối chiếu đồng thời Thu nhập, Chi tiêu &amp; Số dư còn lại qua các tháng · Nhấp vào cột tháng để lọc Dashboard
            </p>
          </div>
        </div>

        {/* Right Controls: Time Range Presets + Shift Arrows + Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800/90 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                setRangePreset('3m');
                setWindowEndIndex(allMonthlyData.length - 1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                rangePreset === '3m'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
              title="Xem 3 tháng gần nhất (Mặc định)"
            >
              3 tháng gần nhất
            </button>
            <button
              type="button"
              onClick={() => {
                setRangePreset('6m');
                setWindowEndIndex(allMonthlyData.length - 1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                rangePreset === '6m'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
              title="Xem 6 tháng"
            >
              6 tháng
            </button>
            <button
              type="button"
              onClick={() => {
                setRangePreset('12m');
                setWindowEndIndex(allMonthlyData.length - 1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                rangePreset === '12m'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
              title="Xem 12 tháng"
            >
              12 tháng
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                rangePreset === 'all'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
              title={`Xem toàn bộ ${allMonthlyData.length} tháng`}
            >
              Tất cả ({allMonthlyData.length})
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('custom')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                rangePreset === 'custom'
                  ? 'theme-preset-btn-active'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
              }`}
              title="Tùy chọn khoảng tháng xem"
            >
              Tùy chỉnh...
            </button>
          </div>

          {/* Sliding Window Navigator for 3M / 6M / 12M presets */}
          {(rangePreset === '3m' || rangePreset === '6m' || rangePreset === '12m') &&
            allMonthlyData.length > windowSize && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 p-0.5 rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevWindow}
                  disabled={!canGoPrev}
                  className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Xem các tháng cũ hơn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {canGoNext && (
                  <button
                    type="button"
                    onClick={handleResetToLatest}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer"
                    title="Trở về các tháng mới nhất"
                  >
                    Mới nhất
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextWindow}
                  disabled={!canGoNext}
                  className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Xem các tháng mới hơn"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          {/* Collapse / Expand Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Thu gọn</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Mở rộng ({visibleMonthlyData.length} tháng)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Range Sub-bar */}
      {rangePreset === 'custom' && isExpanded && (
        <div className="px-5 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-indigo-950 dark:text-indigo-300">Chọn khoảng tháng:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Từ tháng:</span>
            <select
              value={customStartMonth}
              onChange={(e) => setCustomStartMonth(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-semibold text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer text-xs"
            >
              {allMonthlyData.map((m) => (
                <option key={m.mKey} value={m.mKey}>
                  {m.label} ({m.mKey})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Đến tháng:</span>
            <select
              value={customEndMonth}
              onChange={(e) => setCustomEndMonth(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-semibold text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer text-xs"
            >
              {allMonthlyData.map((m) => (
                <option key={m.mKey} value={m.mKey}>
                  {m.label} ({m.mKey})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setRangePreset('3m');
              setWindowEndIndex(allMonthlyData.length - 1);
            }}
            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900 font-bold ml-auto cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt về 3 tháng gần nhất</span>
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <th className="py-2.5 px-4 sticky left-0 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 z-10 w-44 shadow-xs">
                  Chỉ số tài chính
                </th>
                {visibleMonthlyData.map((m) => {
                  const isCurrent = isMonthSelected(m.mKey);
                  return (
                    <th
                      key={m.mKey}
                      onClick={() => {
                        if (onToggleMonth) {
                          onToggleMonth(m.mKey);
                        } else {
                          onSelectMonth(m.mKey);
                        }
                      }}
                      className={`py-2.5 px-3 text-right cursor-pointer transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'theme-selected-month-header'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                      title={`Nhấp để chọn / bỏ chọn ${m.label} vào bộ lọc`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{m.label}</span>
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--theme-accent)' }} />}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-l border-slate-200 dark:border-slate-800">
                  Trung bình
                </th>
                <th className="py-2.5 px-4 text-right bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-bold">
                  Tổng cộng
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono-tabular">
              {/* Row 1: Thu nhập (Sheet Income) */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-4 font-sans font-medium text-emerald-900 dark:text-emerald-400 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Tổng thu nhập
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2.5 px-3 text-right ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/50 dark:bg-sky-950/30 font-semibold text-emerald-800 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {formatNumberForSheet(m.budget)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-800 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.budget)}
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-50 dark:bg-slate-800/80 font-bold text-emerald-800 dark:text-emerald-400">
                  {formatNumberForSheet(totals.total.budget)}
                </td>
              </tr>

              {/* Row 2: Chi sinh hoạt */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-4 font-sans text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap pl-7 text-[11px] shadow-xs">
                  • Chi sinh hoạt
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-slate-600 dark:text-slate-400 ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/30 dark:bg-sky-950/20 font-medium' : ''
                    }`}
                  >
                    {formatNumberForSheet(m.livingExpense)}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.living)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                  {formatNumberForSheet(totals.total.living)}
                </td>
              </tr>

              {/* Row 3: Tiết kiệm */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-4 font-sans text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap pl-7 text-[11px] shadow-xs">
                  • Tiết kiệm / Đầu tư
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-blue-700 dark:text-blue-400 ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/30 dark:bg-sky-950/20 font-medium' : ''
                    }`}
                  >
                    {m.savingsExpense > 0 ? formatNumberForSheet(m.savingsExpense) : '—'}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 text-blue-700 dark:text-blue-400 border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.savings)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 dark:bg-slate-800/80 text-blue-800 dark:text-blue-300 font-medium">
                  {formatNumberForSheet(totals.total.savings)}
                </td>
              </tr>

              {/* Row 4: Tổng chi tiêu */}
              <tr className="bg-slate-50/40 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors font-semibold">
                <td className="py-2.5 px-4 font-sans font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-slate-50/80 dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Tổng chi tiêu
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2.5 px-3 text-right text-rose-700 dark:text-rose-400 font-bold ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50 dark:bg-sky-950/40 font-extrabold' : ''
                    }`}
                  >
                    {formatNumberForSheet(m.totalExpense)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-bold border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.expense)}
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-100 dark:bg-slate-800 text-rose-800 dark:text-rose-300 font-extrabold">
                  {formatNumberForSheet(totals.total.expense)}
                </td>
              </tr>

              {/* Row 5: Còn lại / Remaining (Highlighted like Sheet Summary) */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors font-bold">
                <td className="py-2.5 px-4 font-sans font-extrabold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Còn lại (Remaining)
                </td>
                {visibleMonthlyData.map((m) => {
                  const isPositive = m.remaining >= 0;
                  return (
                    <td
                      key={m.mKey}
                      className={`py-2.5 px-3 text-right ${
                        isMonthSelected(m.mKey) ? 'bg-sky-50 dark:bg-sky-950/30' : ''
                      }`}
                    >
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                        }`}
                      >
                        {formatCurrency(m.remaining, true)}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right bg-slate-50 dark:bg-slate-800/80 border-l border-slate-200 dark:border-slate-800">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      totals.avg.remaining >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(totals.avg.remaining, true)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-50 dark:bg-slate-800/80">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-extrabold ${
                      totals.total.remaining >= 0
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {formatCurrency(totals.total.remaining, true)}
                  </span>
                </td>
              </tr>

              {/* Row 5b: Lũy kế số dư chuyển tiếp (Cumulative Cash Flow) */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors bg-indigo-50/20 dark:bg-indigo-950/10 text-xs">
                <td className="py-2 px-4 font-sans font-semibold text-indigo-900 dark:text-indigo-300 sticky left-0 bg-indigo-50/40 dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Lũy kế số dư chuyển tiếp
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right font-semibold ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/60 dark:bg-sky-950/30 font-bold' : ''
                    }`}
                  >
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                        m.cumulativeRemaining >= 0
                          ? 'text-indigo-900 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/50'
                          : 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50'
                      }`}
                    >
                      {formatCurrency(m.cumulativeRemaining, true)}
                    </span>
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 font-mono-tabular text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-800">
                  —
                </td>
                <td className="py-2 px-4 text-right bg-indigo-100/60 dark:bg-indigo-950/50 font-mono-tabular font-extrabold text-indigo-950 dark:text-indigo-200">
                  {formatCurrency(totals.total.cumulativeRemaining, true)}
                </td>
              </tr>

              {/* Row 6: Tỷ lệ chi / Thu nhập */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-[11px]">
                <td className="py-2 px-4 font-sans text-slate-500 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Tỷ lệ chi / Thu nhập
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/30 dark:bg-sky-950/20' : ''
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        m.pctUsed > 100
                          ? 'text-rose-700 dark:text-rose-400'
                          : m.pctUsed > 80
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {m.pctUsed.toFixed(0)}%
                    </span>
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
                  {totals.avg.budget > 0 ? `${((totals.avg.expense / totals.avg.budget) * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-200">
                  {totals.total.budget > 0 ? `${((totals.total.expense / totals.total.budget) * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>

              {/* Row 7: BE Corp Cycle */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-4 font-sans text-amber-800 dark:text-amber-400 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Ví BE Corp (Chu kỳ {beCorpStartDay}–{beCorpEndDay})
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-amber-800 dark:text-amber-400 ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/30 dark:bg-sky-950/20 font-semibold' : ''
                    }`}
                    title={`Chu kỳ ${m.beRangeLabel}`}
                  >
                    {m.beCorpTotal > 0 ? (
                      <span className="bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded text-[11px] text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/50">
                        {formatNumberForSheet(m.beCorpTotal)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">0</span>
                    )}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 text-amber-800 dark:text-amber-400 font-semibold border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.beCorp)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 dark:bg-slate-800/80 text-amber-900 dark:text-amber-300 font-bold">
                  {formatNumberForSheet(totals.total.beCorp)}
                </td>
              </tr>

              {/* Row 8: Credit Card Statement Cycle */}
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-4 font-sans text-indigo-800 dark:text-indigo-400 font-medium sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap shadow-xs">
                  Thẻ Credit (Sao kê {creditStartDay}–{creditEndDay})
                </td>
                {visibleMonthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-indigo-800 dark:text-indigo-400 ${
                      isMonthSelected(m.mKey) ? 'bg-sky-50/30 dark:bg-sky-950/20 font-semibold' : ''
                    }`}
                    title={`Sao kê ${m.creditRangeLabel}`}
                  >
                    {m.creditTotal > 0 ? (
                      <span className="bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded text-[11px] text-indigo-900 dark:text-indigo-200 border border-indigo-200/50 dark:border-indigo-800/50">
                        {formatNumberForSheet(m.creditTotal)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">0</span>
                    )}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 dark:bg-slate-800/80 text-indigo-800 dark:text-indigo-400 font-semibold border-l border-slate-200 dark:border-slate-800">
                  {formatNumberForSheet(totals.avg.credit)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 dark:bg-slate-800/80 text-indigo-900 dark:text-indigo-300 font-bold">
                  {formatNumberForSheet(totals.total.credit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
});

MultiMonthSummaryTable.displayName = 'MultiMonthSummaryTable';

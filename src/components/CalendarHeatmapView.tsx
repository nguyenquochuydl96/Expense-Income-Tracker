import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Leaf,
  Sparkles,
  TrendingUp,
  X,
  Plus,
  CreditCard,
  Building2,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { NewTransactionPayload } from './AddTransactionModal';

interface CalendarHeatmapViewProps {
  records: TransactionRecord[];
  allRecords: TransactionRecord[];
  selectedMonth: string;
  onOpenAddModalWithPreset?: (preset: Partial<NewTransactionPayload>) => void;
  onSelectTransaction?: (tx: TransactionRecord) => void;
}

interface DayData {
  dayNum: number;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  totalSpent: number;
  totalIncome: number;
  transactions: TransactionRecord[];
}

export const CalendarHeatmapView: React.FC<CalendarHeatmapViewProps> = ({
  records,
  allRecords,
  selectedMonth,
  onOpenAddModalWithPreset,
  onSelectTransaction,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  // Fallback target month if 'ALL' is selected
  const activeMonthKey = useMemo(() => {
    if (selectedMonth && selectedMonth !== 'ALL' && selectedMonth.includes('-')) {
      return selectedMonth;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const [yearStr, monthStr] = activeMonthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Month navigation
  const monthLabel = useMemo(() => {
    return `Tháng ${month}/${year}`;
  }, [month, year]);

  // Calendar matrix calculation
  const { days, stats, paddingDays } = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const daysInMonth = new Date(year, month, 0).getDate();
    // In JS: getDay() 0 is Sun, 1 is Mon... Convert to Mon = 0, Sun = 6
    const firstDayJs = new Date(year, month - 1, 1).getDay();
    const firstDayIndex = (firstDayJs + 6) % 7; // Monday = 0, Sunday = 6

    // Map records for this month by isoDate
    const mapByDate = new Map<string, TransactionRecord[]>();
    for (const r of allRecords) {
      if (r.isoDate && r.isoDate.startsWith(activeMonthKey)) {
        const list = mapByDate.get(r.isoDate) || [];
        list.push(r);
        mapByDate.set(r.isoDate, list);
      }
    }

    const dayList: DayData[] = [];
    let noSpendCount = 0;
    let spendingDaysCount = 0;
    let peakDayNum = 1;
    let peakDayAmount = 0;
    let totalMonthSpent = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dayDate = new Date(year, month - 1, d);
      const dayOfWeek = (dayDate.getDay() + 6) % 7;

      const txs = mapByDate.get(dateStr) || [];
      let spent = 0;
      let income = 0;

      for (const t of txs) {
        if (t.sheetType === 'Expenses') {
          spent += t.amount;
        } else {
          income += t.amount;
        }
      }

      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;
      const isFuture = dateStr > todayStr;

      if (!isFuture) {
        if (spent === 0) {
          noSpendCount += 1;
        } else {
          spendingDaysCount += 1;
          totalMonthSpent += spent;
          if (spent > peakDayAmount) {
            peakDayAmount = spent;
            peakDayNum = d;
          }
        }
      }

      dayList.push({
        dayNum: d,
        dateStr,
        dayOfWeek,
        isToday,
        isPast,
        isFuture,
        totalSpent: spent,
        totalIncome: income,
        transactions: txs,
      });
    }

    const avgDailySpent = spendingDaysCount > 0 ? Math.round(totalMonthSpent / spendingDaysCount) : 0;

    return {
      days: dayList,
      paddingDays: firstDayIndex,
      stats: {
        noSpendCount,
        spendingDaysCount,
        peakDayNum,
        peakDayAmount,
        totalMonthSpent,
        avgDailySpent,
      },
    };
  }, [year, month, activeMonthKey, allRecords]);

  // Color gradient badge for heat level
  const getDayHeatStyle = (d: DayData) => {
    if (d.isFuture && d.transactions.length === 0) {
      return 'bg-slate-50/60 text-slate-400 border-slate-200/60 hover:bg-slate-100';
    }
    if (d.totalSpent === 0) {
      return 'bg-emerald-50/80 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100/90 shadow-2xs';
    }
    if (d.totalSpent < 300000) {
      return 'bg-sky-50 text-sky-900 border-sky-200/80 hover:bg-sky-100/90 shadow-2xs';
    }
    if (d.totalSpent <= 1000000) {
      return 'bg-amber-50 text-amber-950 border-amber-200/90 hover:bg-amber-100/90 shadow-2xs';
    }
    return 'bg-rose-50 text-rose-950 border-rose-300 font-bold hover:bg-rose-100 shadow-xs';
  };

  const getHeatDot = (d: DayData) => {
    if (d.isFuture && d.transactions.length === 0) return null;
    if (d.totalSpent === 0) {
      return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Ngày không tiêu tiền" />;
    }
    if (d.totalSpent < 300000) {
      return <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />;
    }
    if (d.totalSpent <= 1000000) {
      return <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />;
    }
    return <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block animate-pulse" />;
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 shadow-2xs">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                Lịch chi tiêu trực quan (Calendar Heatmap)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-800 border border-teal-200">
                {monthLabel}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Leaf className="w-3 h-3 text-emerald-600" />
                <span>{stats.noSpendCount} ngày không tiêu</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nhấp vào ngày bất kỳ để xem nhanh chi tiết từng món chi tiêu hoặc thêm giao dịch mới
            </p>
          </div>
        </div>

        {/* Right Toggle */}
        <div className="flex items-center gap-2">
          {stats.peakDayAmount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Đỉnh chi: Ngày {stats.peakDayNum} ({formatCurrency(stats.peakDayAmount)})
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Thu gọn</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Mở lịch tháng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-bold text-slate-500 mb-2">
            <div>T2</div>
            <div>T3</div>
            <div>T4</div>
            <div>T5</div>
            <div>T6</div>
            <div className="text-indigo-600">T7</div>
            <div className="text-rose-600">CN</div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty padding cells for start of month */}
            {Array.from({ length: paddingDays }).map((_, idx) => (
              <div key={`pad-${idx}`} className="h-16 sm:h-20 rounded-xl bg-slate-50/30 border border-dashed border-slate-100" />
            ))}

            {/* Days of month */}
            {days.map((d) => {
              const isSelected = selectedDay?.dateStr === d.dateStr;
              return (
                <div
                  key={d.dateStr}
                  onClick={() => setSelectedDay(d)}
                  className={`h-16 sm:h-20 rounded-xl p-1.5 sm:p-2 border transition-all cursor-pointer flex flex-col justify-between relative group ${getDayHeatStyle(
                    d
                  )} ${isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.02] z-10' : ''} ${
                    d.isToday ? 'ring-2 ring-teal-500' : ''
                  }`}
                >
                  {/* Top row: day number + dot */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono-tabular ${
                        d.isToday
                          ? 'w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center -ml-0.5 -mt-0.5 text-[11px]'
                          : d.dayOfWeek >= 5
                          ? 'text-indigo-900 font-extrabold'
                          : ''
                      }`}
                    >
                      {d.dayNum}
                    </span>
                    {getHeatDot(d)}
                  </div>

                  {/* Middle / Bottom info */}
                  <div className="text-right">
                    {d.totalSpent > 0 ? (
                      <div>
                        <div className="text-[10px] sm:text-xs font-bold font-mono-tabular truncate">
                          {formatCurrency(d.totalSpent)}
                        </div>
                        <div className="text-[9px] text-slate-500 hidden sm:block">
                          {d.transactions.filter((t) => t.sheetType === 'Expenses').length} khoản
                        </div>
                      </div>
                    ) : d.totalIncome > 0 ? (
                      <div className="text-[10px] font-bold text-emerald-700 font-mono-tabular truncate">
                        {formatCurrency(d.totalIncome, true)}
                      </div>
                    ) : !d.isFuture ? (
                      <div className="text-[10px] text-emerald-700/80 font-semibold flex items-center justify-end gap-0.5">
                        <Leaf className="w-2.5 h-2.5 text-emerald-600" />
                        <span className="hidden sm:inline">{formatCurrency(0)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700 text-xs">Mức độ chi tiêu:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-50 border border-emerald-300" />
                <span className="text-[11px]">0 ₫ (Không tiêu)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-100 border border-sky-300" />
                <span className="text-[11px]">&lt; 300k</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
                <span className="text-[11px]">300k – 1M</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-200 border border-rose-400" />
                <span className="text-[11px] font-semibold text-rose-900">&gt; 1M (Chi nhiều)</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono-tabular">
              TB ngày chi: <strong>{formatCurrency(stats.avgDailySpent)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Selected Day Detail Popover / Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 relative space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Ngày {selectedDay.dayNum}/{month}/{year}</span>
                  {selectedDay.isToday && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800">
                      Hôm nay
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng chi:{' '}
                  <strong className="text-rose-700 font-mono-tabular">
                    {formatCurrency(selectedDay.totalSpent)}
                  </strong>
                  {selectedDay.totalIncome > 0 && (
                    <>
                      {' · '}Thu:{' '}
                      <strong className="text-emerald-700 font-mono-tabular">
                        {formatCurrency(selectedDay.totalIncome, true)}
                      </strong>
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of transactions */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
              {selectedDay.transactions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-lg">
                    🍃
                  </div>
                  <div className="font-bold text-slate-700">Ngày không phát sinh chi tiêu</div>
                  <p className="text-[11px] text-slate-400">
                    Tuyệt vời! Bạn không có giao dịch nào ghi nhận trong ngày này.
                  </p>
                </div>
              ) : (
                selectedDay.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => onSelectTransaction?.(tx)}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <CategoryBadge category={tx.category} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {tx.purchaseItem || tx.category}
                        </div>
                        {tx.note && (
                          <div className="text-[10px] text-slate-500 truncate">{tx.note}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {tx.beCorp > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              BE: {formatNumberForSheet(tx.beCorp)}
                            </span>
                          )}
                          {tx.credit > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                              Thẻ tín dụng
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold font-mono-tabular ${
                          tx.sheetType === 'Income' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(tx.amount, tx.sheetType === 'Income')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer action */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenAddModalWithPreset?.({
                    isoDate: selectedDay.dateStr,
                    purchaseDate: `${month}/${selectedDay.dayNum}/${year}`,
                    sheetType: 'Expenses',
                  });
                  setSelectedDay(null);
                }}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-indigo-950 hover:bg-indigo-900 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Thêm giao dịch ngày {selectedDay.dayNum}/{month}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

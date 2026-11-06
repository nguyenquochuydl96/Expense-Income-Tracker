import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PieChart, ShieldCheck, AlertCircle } from 'lucide-react';
import { AnimatedCurrency } from './AnimatedCurrency';

export interface CashflowSegmentedBarProps {
  income: number;
  livingExpense: number;
  savings: number;
  beCorp: number;
  credit: number;
  netBalance: number;
  totalExpense: number;
  onFilterCategory?: (category: string) => void;
  className?: string;
}

export interface CashflowSegment {
  key: string;
  label: string;
  shortLabel: string;
  amount: number;
  colorClass: string;
  bgHex: string;
  textHex: string;
  percentage: number;
}

export const CashflowSegmentedBar: React.FC<CashflowSegmentedBarProps> = ({
  income,
  livingExpense,
  savings,
  beCorp,
  credit,
  netBalance,
  totalExpense,
  onFilterCategory,
  className = '',
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Compute baseline for proportions: base is income, or total outlays if higher
  const positiveNet = Math.max(0, netBalance);
  const totalOutflows = livingExpense + savings + beCorp + credit;
  const denominator = Math.max(income, totalOutflows, 1);

  const rawSegments = [
    {
      key: 'living',
      label: 'Sinh hoạt & Cá nhân',
      shortLabel: 'Sinh hoạt',
      amount: livingExpense,
      colorClass: 'bg-rose-500 hover:bg-rose-400',
      bgHex: '#F43F5E',
      textHex: 'text-rose-600 dark:text-rose-400',
    },
    {
      key: 'savings',
      label: 'Tiết kiệm & Dự phòng',
      shortLabel: 'Tiết kiệm',
      amount: savings,
      colorClass: 'bg-emerald-500 hover:bg-emerald-400',
      bgHex: '#10B981',
      textHex: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'becorp',
      label: 'Ví BE Corp (Công ty)',
      shortLabel: 'BE Corp',
      amount: beCorp,
      colorClass: 'bg-amber-500 hover:bg-amber-400',
      bgHex: '#F59E0B',
      textHex: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'credit',
      label: 'Thanh toán Thẻ tín dụng',
      shortLabel: 'Credit',
      amount: credit,
      colorClass: 'bg-indigo-500 hover:bg-indigo-400',
      bgHex: '#6366F1',
      textHex: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      key: 'remaining',
      label: 'Dư khả dụng còn lại',
      shortLabel: 'Dư khả dụng',
      amount: positiveNet,
      colorClass: 'bg-sky-500 hover:bg-sky-400',
      bgHex: '#0EA5E9',
      textHex: 'text-sky-600 dark:text-sky-400',
    },
  ];

  // Filter out slices with <= 0 so bar looks clean
  const segments: CashflowSegment[] = rawSegments
    .filter((s) => s.amount > 0)
    .map((s) => ({
      ...s,
      percentage: Math.max(2, Math.round((s.amount / denominator) * 100)),
    }));

  const spentRatio = income > 0 ? Math.round((totalExpense / income) * 100) : 0;
  const isWarning = spentRatio > 80 && spentRatio <= 100;
  const isDeficit = spentRatio > 100;

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all ${className}`}
    >
      {/* Top Header: Title & Total Baseline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-500/20">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Phân bổ dòng tiền (Cash Flow Ratio)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tỷ trọng dòng tiền thực tế theo nguồn thu và các quỹ chi trả
            </p>
          </div>
        </div>

        {/* Health / Spending Runway Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {income > 0 && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isDeficit
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20'
                  : isWarning
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
              }`}
            >
              {isDeficit ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span>
                {isDeficit
                  ? `Bội chi (${spentRatio}% thu nhập)`
                  : isWarning
                    ? `Chi ${spentRatio}% (Tiệm cận trần)`
                    : `Chi an toàn (${spentRatio}% thu nhập)`}
              </span>
            </div>
          )}

          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Tổng nguồn thu
            </div>
            <div className="text-sm sm:text-base font-extrabold font-mono-tabular text-slate-900 dark:text-white">
              <AnimatedCurrency value={income} />
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Bar */}
      <div className="relative mb-3.5">
        <div className="h-3 sm:h-3.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 p-[2px] border border-slate-200/70 dark:border-slate-700/60 shadow-inner">
          {segments.length > 0 ? (
            segments.map((seg, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === segments.length - 1;
              const isDimmed = hoveredKey !== null && hoveredKey !== seg.key;
              const isHighlighted = hoveredKey === seg.key;

              return (
                <motion.div
                  key={seg.key}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    width: `${seg.percentage}%`,
                    backgroundColor: seg.bgHex,
                  }}
                  animate={{
                    opacity: isDimmed ? 0.35 : 1,
                    scaleY: isHighlighted ? 1.25 : 1,
                  }}
                  transition={{ duration: 0.18 }}
                  className={`h-full relative cursor-pointer transition-all ${
                    isFirst ? 'rounded-l-full' : ''
                  } ${isLast ? 'rounded-r-full' : ''} ${!isLast ? 'border-r border-white/20' : ''}`}
                  title={`${seg.label}: ${seg.percentage}%`}
                />
              );
            })
          ) : (
            <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          )}
        </div>
      </div>

      {/* Legend & Detail Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
        {rawSegments.map((seg) => {
          const isDimmed = hoveredKey !== null && hoveredKey !== seg.key;
          const isHighlighted = hoveredKey === seg.key;
          const percent = denominator > 0 ? Math.round((seg.amount / denominator) * 100) : 0;

          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isHighlighted
                  ? 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-xs scale-[1.02]'
                  : isDimmed
                    ? 'opacity-40 border-transparent bg-transparent'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: seg.bgHex }}
                  />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {seg.shortLabel}
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400">
                  {percent}%
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono-tabular text-slate-900 dark:text-white truncate">
                <AnimatedCurrency value={seg.amount} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

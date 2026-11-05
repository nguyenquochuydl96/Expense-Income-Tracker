import React from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AnimatedCurrency } from './AnimatedCurrency';
import { CashflowSegmentedBar } from './CashflowSegmentedBar';

export interface KinloCashflowCardProps {
  income: number;
  totalExpense: number;
  netBalance: number;
  livingExpense: number;
  savingsExpense: number;
  beCorpCycleTotal: number;
  creditCycleTotal: number;
  incomeCount: number;
  expenseCount: number;
  periodLabel: string;
  onViewLedger?: () => void;
  className?: string;
}

export const KinloCashflowCard: React.FC<KinloCashflowCardProps> = ({
  income,
  totalExpense,
  netBalance,
  livingExpense,
  savingsExpense,
  beCorpCycleTotal,
  creditCycleTotal,
  incomeCount,
  expenseCount,
  periodLabel,
  onViewLedger,
  className = '',
}) => {
  const expenseRatio = income > 0 ? (totalExpense / income) * 100 : 0;
  const isHealthy = netBalance >= 0;

  return (
    <div
      data-lift
      data-card-entrance
      className={`kinlo-card p-5 sm:p-6 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[var(--accent-text)] font-mono-tabular">
                Cashflow &amp; Budget
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-0.5">
              Dòng tiền &amp; Ngân sách gia đình
            </h3>
            <p className="text-xs text-[var(--muted)] font-medium">
              Tổng thu, chi tiêu sinh hoạt và dòng tiền thực tế · {periodLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isHealthy
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800'
              }`}
            >
              {isHealthy ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Dư an toàn ({expenseRatio.toFixed(0)}% thu nhập)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Chi vượt thu ({expenseRatio.toFixed(0)}%)</span>
                </>
              )}
            </span>

            {onViewLedger && (
              <button
                type="button"
                onClick={onViewLedger}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--card-2)] transition-colors cursor-pointer"
                title="Xem chi tiết sổ giao dịch"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 3 Main KPI Metrics (Kinlo Horizontal Stat Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 p-4 rounded-2xl bg-[var(--card-2)] border border-[var(--line)] mb-5">
          {/* Stat 1: Tổng thu nhập */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Tổng thu nhập</span>
              </span>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-mono-tabular tracking-tight">
              <AnimatedCurrency value={income} />
            </div>
            <div className="text-[11px] text-[var(--muted)] font-mono-tabular">
              {incomeCount} khoản thu nhận
            </div>
          </div>

          {/* Stat 2: Tổng chi tiêu */}
          <div className="space-y-1 sm:border-l sm:border-[var(--line)] sm:pl-4">
            <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Tổng chi tiêu</span>
              </span>
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-mono-tabular tracking-tight">
              <AnimatedCurrency value={totalExpense} />
            </div>
            <div className="text-[11px] text-[var(--muted)] font-mono-tabular">
              {expenseCount} giao dịch chi
            </div>
          </div>

          {/* Stat 3: Số dư khả dụng (Net) */}
          <div className="space-y-1 sm:border-l sm:border-[var(--line)] sm:pl-4">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--accent-text)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                <span>Số dư khả dụng</span>
              </span>
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold font-mono-tabular tracking-tight ${
                isHealthy ? 'text-[var(--ink)]' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <AnimatedCurrency value={netBalance} />
            </div>
            <div className="text-[11px] text-[var(--muted)] font-mono-tabular">
              {isHealthy ? 'Thu nhập − Chi an toàn' : 'Cần cắt giảm chi tiêu'}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Full-Width Segmented Cashflow Ratio Bar */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2 flex items-center justify-between">
          <span>Tỷ lệ phân bổ chi trả thực tế</span>
          <span className="font-mono-tabular">100% dòng tiền</span>
        </div>
        <CashflowSegmentedBar
          income={income}
          livingExpense={livingExpense}
          savings={savingsExpense}
          beCorp={beCorpCycleTotal}
          credit={creditCycleTotal}
          netBalance={netBalance}
          totalExpense={totalExpense}
        />
      </div>
    </div>
  );
};

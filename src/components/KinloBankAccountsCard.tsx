import React from 'react';
import { motion } from 'motion/react';
import { CreditCard, Wallet, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatedCurrency } from './AnimatedCurrency';

export interface KinloBankAccountsCardProps {
  beCorpAmount: number;
  creditAmount: number;
  beCorpCount: number;
  creditCount: number;
  beRangeLabel: string;
  creditRangeLabel: string;
  dailySafeSpend?: number;
  onReconcileClick?: () => void;
  className?: string;
}

export const KinloBankAccountsCard: React.FC<KinloBankAccountsCardProps> = ({
  beCorpAmount,
  creditAmount,
  beCorpCount,
  creditCount,
  beRangeLabel,
  creditRangeLabel,
  dailySafeSpend = 0,
  onReconcileClick,
  className = '',
}) => {
  const totalCardSpend = beCorpAmount + creditAmount;
  const bePct = totalCardSpend > 0 ? (beCorpAmount / totalCardSpend) * 100 : 50;
  const creditPct = totalCardSpend > 0 ? (creditAmount / totalCardSpend) * 100 : 50;

  return (
    <div
      data-lift
      data-card-entrance
      className={`kinlo-card-night p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden group ${className}`}
    >
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Top Title & Quick Link */}
      <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-teal-200/90 font-mono-tabular">
              In the bank &amp; cards
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
            Thẻ &amp; Ví ngân hàng
          </h3>
          <p className="text-[11px] text-teal-100/70 font-medium">
            Dư nợ chu kỳ BE Corp và sao kê Thẻ tín dụng
          </p>
        </div>

        {onReconcileClick && (
          <button
            type="button"
            onClick={onReconcileClick}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/15 flex items-center gap-1 text-xs font-semibold group/btn"
            title="Đến màn hình Check tiền & Đối soát"
          >
            <span className="hidden sm:inline text-[11px]">Đối soát</span>
            <ArrowUpRight className="w-4 h-4 text-teal-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* Big Headline Total Card & Wallet Spend */}
      <div className="relative z-10 mb-4">
        <div className="text-[11px] text-teal-100/70 font-medium uppercase tracking-wider mb-1">
          Tổng chi tiêu thẻ &amp; ví chu kỳ
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono-tabular tracking-tight">
          <AnimatedCurrency value={totalCardSpend} />
        </div>

        {/* Kinlo Segmented Mini Ratio Bar */}
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex p-0.5 gap-0.5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-xs"
              initial={{ width: 0 }}
              animate={{ width: `${bePct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              title={`Ví BE Corp: ${bePct.toFixed(0)}%`}
            />
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400 shadow-xs"
              initial={{ width: 0 }}
              animate={{ width: `${creditPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              title={`Thẻ tín dụng: ${creditPct.toFixed(0)}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-teal-100/80 font-mono-tabular mt-1.5 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>BE Corp ({bePct.toFixed(0)}%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Credit ({creditPct.toFixed(0)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Account Rows (Kinlo Bank Row Style) */}
      <div className="relative z-10 space-y-2.5 mb-4">
        {/* Row 1: Ví BE Corp */}
        <div
          data-lift
          onClick={onReconcileClick}
          className="p-3 sm:p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer flex items-center justify-between gap-3 group/row"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate">Ví BE Corp</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  •••• 2625
                </span>
              </div>
              <div className="text-[11px] text-teal-100/60 font-mono-tabular truncate mt-0.5">
                Chu kỳ: {beRangeLabel} {beCorpCount > 0 && `· ${beCorpCount} giao dịch`}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm sm:text-base font-bold text-white font-mono-tabular group-hover/row:text-amber-300 transition-colors">
              <AnimatedCurrency value={beCorpAmount} />
            </div>
            <span className="text-[10px] text-amber-200/70 font-medium">Chi tiêu chu kỳ</span>
          </div>
        </div>

        {/* Row 2: Thẻ tín dụng Credit */}
        <div
          data-lift
          onClick={onReconcileClick}
          className="p-3 sm:p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sky-400/40 transition-all cursor-pointer flex items-center justify-between gap-3 group/row"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate">Thẻ tín dụng</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  •••• 2019
                </span>
              </div>
              <div className="text-[11px] text-teal-100/60 font-mono-tabular truncate mt-0.5">
                Sao kê: {creditRangeLabel} {creditCount > 0 && `· ${creditCount} giao dịch`}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm sm:text-base font-bold text-white font-mono-tabular group-hover/row:text-sky-300 transition-colors">
              <AnimatedCurrency value={creditAmount} />
            </div>
            <span className="text-[10px] text-sky-200/70 font-medium">Dư nợ sao kê</span>
          </div>
        </div>
      </div>

      {/* Bottom Mini Status Chips (Kinlo Card Foot) */}
      <div className="relative z-10 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-teal-100/80">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-300 shrink-0" />
          <span>Đối soát định kỳ với Google Sheet</span>
        </div>

        {dailySafeSpend > 0 && (
          <div className="flex items-center gap-1 font-mono-tabular text-emerald-300 font-semibold">
            <Sparkles className="w-3 h-3 text-emerald-300" />
            <span>Hạn mức: {dailySafeSpend.toLocaleString('vi-VN')} ₫/ngày</span>
          </div>
        )}
      </div>
    </div>
  );
};

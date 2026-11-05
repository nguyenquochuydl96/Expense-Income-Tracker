import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { CalendarRange, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatedCurrency } from './AnimatedCurrency';

export interface RealisticBankCardProps {
  variant: 'credit' | 'becorp';
  cardholderName?: string;
  cardNumberMasked?: string;
  cycleLabel: string;
  amount: number;
  transactionCount?: number;
  onClick?: () => void;
  className?: string;
}

export const RealisticBankCard: React.FC<RealisticBankCardProps> = ({
  variant,
  cardholderName = 'HEO & MÈO',
  cardNumberMasked,
  cycleLabel,
  amount,
  transactionCount = 0,
  onClick,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 3D Tilt Motion Values
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), {
    damping: 20,
    stiffness: 260,
  });
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), {
    damping: 20,
    stiffness: 260,
  });

  const glareX = useTransform(x, [0, 1], ['0%', '100%']);
  const glareY = useTransform(y, [0, 1], ['0%', '100%']);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    x.set(px);
    y.set(py);
  };

  const isCredit = variant === 'credit';
  const defaultCardNumber = isCredit ? '••••  ••••  ••••  2019' : '••••  ••••  ••••  2625';
  const displayCardNumber = cardNumberMasked || defaultCardNumber;
  const cardTitle = isCredit ? 'THẺ TÍN DỤNG' : 'VÍ BE CORP';
  const networkBadge = isCredit ? 'PLATINUM CREDIT' : 'CORPORATE CARD';

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ perspective: 1000 }}
    >
      <motion.div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') setIsHovered(true);
        }}
        onPointerLeave={() => {
          setIsHovered(false);
          x.set(0.5);
          y.set(0.5);
        }}
        onClick={onClick}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.985 }}
        className={`group relative w-full aspect-[1.586/1] min-h-[195px] sm:min-h-[210px] rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden cursor-pointer transition-shadow duration-300 ${
          isCredit
            ? 'bg-gradient-to-br from-[#1E2433] via-[#0F1420] to-[#141A28] border border-white/15 shadow-[0_16px_36px_-8px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] text-white'
            : 'bg-gradient-to-br from-[#321F10] via-[#1F1309] to-[#26170B] border border-amber-500/25 shadow-[0_16px_36px_-8px_rgba(180,83,9,0.35)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] text-white'
        }`}
      >
        {/* Subtle Metallic Brushed Line Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(
              115deg,
              rgba(255, 255, 255, 0.05) 0px,
              rgba(255, 255, 255, 0.05) 1px,
              transparent 1px,
              transparent 4px
            )`,
          }}
        />

        {/* Ambient Radial Foil Glare */}
        <div
          className={`absolute -right-16 -top-16 w-56 h-56 rounded-full blur-2xl pointer-events-none ${
            isCredit ? 'bg-cyan-500/10' : 'bg-amber-500/15'
          }`}
        />

        {/* Dynamic Specular Sheen (follows mouse) */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: `radial-gradient(circle 240px at ${glareX} ${glareY}, rgba(255,255,255,0.18), transparent 70%)`,
            }}
          />
        )}

        {/* Card Header: Chip + Contactless + Network Badge */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Realistic EMV Gold Chip */}
            <div className="relative w-10 h-7.5 sm:w-11 sm:h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1px] shadow-sm shrink-0 border border-amber-500/50">
              <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 relative overflow-hidden flex items-center justify-center">
                {/* Circuit contact trace cuts */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-800/60" />
                <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-800/60" />
                <div className="absolute inset-y-0 right-1/3 w-[1px] bg-amber-800/60" />
                <div className="w-3.5 h-3.5 rounded-sm border border-amber-800/70" />
              </div>
            </div>

            {/* Contactless Waves SVG */}
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 sm:w-5 sm:h-5 text-white/70"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8.5 16.5a5 5 0 0 1 0-9" />
              <path d="M12 19a8.5 8.5 0 0 1 0-14" />
              <path d="M15.5 21.5a12 12 0 0 1 0-19" />
            </svg>
          </div>

          {/* Network / Type Badge */}
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full backdrop-blur-md border ${
                isCredit
                  ? 'bg-white/10 text-slate-200 border-white/20'
                  : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
              }`}
            >
              {networkBadge}
            </span>
          </div>
        </div>

        {/* Card Middle: Balance & Billing Cycle Info */}
        <div className="relative z-10 my-auto py-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-white/70 flex items-center gap-1">
              <span>{cardTitle}</span>
              <span className="text-white/40">·</span>
              <span className="text-[10px] text-white/60 lowercase">
                {transactionCount > 0 ? `${transactionCount} gd` : 'kỳ hiện tại'}
              </span>
            </span>

            {/* Cycle range pill */}
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-md bg-black/25 text-white/80 border border-white/10">
              <CalendarRange className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/60 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-none">{cycleLabel}</span>
            </div>
          </div>

          <div className="text-xl sm:text-2xl lg:text-[26px] font-extrabold font-mono-tabular tracking-tight text-white drop-shadow-sm truncate">
            <AnimatedCurrency value={amount} />
          </div>
        </div>

        {/* Card Footer: Embossed Number, Cardholder Name & Quick Action */}
        <div className="relative z-10 pt-1 border-t border-white/10 flex items-end justify-between gap-2">
          <div className="space-y-0.5">
            {/* Embossed masked card digits */}
            <div className="text-xs sm:text-sm font-mono tracking-widest text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              {displayCardNumber}
            </div>
            {/* Cardholder name */}
            <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-white/60 font-mono truncate max-w-[150px] sm:max-w-[200px]">
              {cardholderName}
            </div>
          </div>

          {/* Quick Reconcile / Action Pill */}
          <div className="group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 backdrop-blur-xs">
            <span>{isCredit ? 'Đối soát thẻ' : 'Chi tiết ví'}</span>
            <ArrowUpRight className="w-3 h-3 text-white/70" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

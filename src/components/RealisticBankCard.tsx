import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { CalendarRange, ArrowUpRight } from 'lucide-react';
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

  const rotateX = useSpring(useTransform(y, [0, 1], [7, -7]), {
    damping: 22,
    stiffness: 280,
  });
  const rotateY = useSpring(useTransform(x, [0, 1], [-7, 7]), {
    damping: 22,
    stiffness: 280,
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
  const defaultCardNumber = isCredit ? '••••  ••••  2019' : '••••  ••••  2625';
  const displayCardNumber = cardNumberMasked || defaultCardNumber;
  const cardTitle = isCredit ? 'Thẻ tín dụng' : 'Ví BE Corp';
  const networkBadge = isCredit ? 'PLATINUM' : 'CORPORATE';

  return (
    <div
      className={`relative select-none h-full ${className}`}
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
        className={`group relative w-full h-full min-h-[160px] sm:min-h-[175px] rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between overflow-hidden cursor-pointer transition-shadow duration-300 ${
          isCredit
            ? 'bg-gradient-to-br from-[#1E2433] via-[#0F1420] to-[#141A28] border border-white/15 shadow-[0_12px_28px_-6px_rgba(15,23,42,0.45)] dark:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.7)] text-white'
            : 'bg-gradient-to-br from-[#321F10] via-[#1F1309] to-[#26170B] border border-amber-500/25 shadow-[0_12px_28px_-6px_rgba(180,83,9,0.35)] dark:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.7)] text-white'
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
          className={`absolute -right-12 -top-12 w-44 h-44 rounded-full blur-2xl pointer-events-none ${
            isCredit ? 'bg-cyan-500/10' : 'bg-amber-500/15'
          }`}
        />

        {/* Dynamic Specular Sheen (follows mouse) */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: `radial-gradient(circle 200px at ${glareX} ${glareY}, rgba(255,255,255,0.18), transparent 70%)`,
            }}
          />
        )}

        {/* Card Header: Chip + Contactless + Network Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Realistic EMV Gold Chip */}
            <div className="relative w-8 h-6 sm:w-9 sm:h-6.5 rounded-sm bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1px] shadow-2xs shrink-0 border border-amber-500/50">
              <div className="w-full h-full rounded-[2px] bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-amber-800/60" />
                <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-800/60" />
                <div className="absolute inset-y-0 right-1/3 w-[1px] bg-amber-800/60" />
                <div className="w-2.5 h-2.5 rounded-2xs border border-amber-800/70" />
              </div>
            </div>

            {/* Contactless Waves SVG */}
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 text-white/70"
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
          <span
            className={`text-[8px] sm:text-[9px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full backdrop-blur-md border ${
              isCredit
                ? 'bg-white/10 text-slate-200 border-white/20'
                : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
            }`}
          >
            {networkBadge}
          </span>
        </div>

        {/* Card Middle: Balance & Billing Cycle Info */}
        <div className="relative z-10 py-1 my-auto">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-white/70 truncate flex items-center gap-1">
              <span>{cardTitle}</span>
              {transactionCount > 0 && (
                <span className="text-white/50 text-[9px]">({transactionCount} gd)</span>
              )}
            </span>

            {/* Cycle range pill */}
            <div className="flex items-center gap-1 text-[9px] font-mono-tabular px-1.5 py-0.5 rounded-md bg-black/30 text-white/80 border border-white/10 shrink-0">
              <CalendarRange className="w-2.5 h-2.5 text-white/60 shrink-0" />
              <span className="truncate max-w-[95px] sm:max-w-none">{cycleLabel}</span>
            </div>
          </div>

          <div className="text-lg sm:text-xl lg:text-2xl font-extrabold font-mono-tabular tracking-tight text-white drop-shadow-xs truncate">
            <AnimatedCurrency value={amount} />
          </div>
        </div>

        {/* Card Footer: Embossed Number, Cardholder Name & Quick Action */}
        <div className="relative z-10 pt-1 border-t border-white/10 flex items-center justify-between gap-1.5">
          <div className="space-y-0.5 min-w-0">
            {/* Embossed masked card digits */}
            <div className="text-[10px] sm:text-[11px] font-mono tracking-wider text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] truncate">
              {displayCardNumber}
            </div>
            {/* Cardholder name */}
            <div className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase text-white/60 font-mono truncate">
              {cardholderName}
            </div>
          </div>

          {/* Quick Action Pill */}
          <div className="group-hover:translate-x-0.5 transition-transform shrink-0 flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 backdrop-blur-xs">
            <span>{isCredit ? 'Đối soát' : 'Chi tiết'}</span>
            <ArrowUpRight className="w-2.5 h-2.5 text-white/70" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

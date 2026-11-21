import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { usePrivacyMode } from '../utils/privacyService';
import { formatCurrency } from '../utils/csvParser';

export interface AnimatedCurrencyProps {
  value: number;
  className?: string;
  showSign?: boolean;
  currencySuffix?: string;
  animate?: boolean;
}

const AnimatedCurrencySpring: React.FC<{
  value: number;
  className: string;
  showSign: boolean;
  currencySuffix: string;
}> = ({ value, className, showSign, currencySuffix }) => {
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { stiffness: 240, damping: 25, mass: 0.4 });

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  const display = useTransform(spring, (latest) => {
    const isNegative = latest < 0;
    const absVal = Math.round(Math.abs(latest));
    const signPrefix = showSign && latest > 0 ? '+' : isNegative ? '-' : '';
    return `${signPrefix}${absVal.toLocaleString('en-US')}${currencySuffix}`;
  });

  return (
    <motion.span className={`inline-flex items-center font-mono-tabular tracking-tight ${className}`}>
      {display}
    </motion.span>
  );
};

export const AnimatedCurrency: React.FC<AnimatedCurrencyProps> = ({
  value,
  className = '',
  showSign = false,
  currencySuffix = ' ₫',
  animate = true,
}) => {
  const { isPrivate } = usePrivacyMode();

  if (isPrivate) {
    return <span className={className}>••••••{currencySuffix}</span>;
  }

  if (!animate) {
    return <span className={className}>{formatCurrency(value, showSign)}</span>;
  }

  return (
    <AnimatedCurrencySpring
      value={value}
      className={className}
      showSign={showSign}
      currencySuffix={currencySuffix}
    />
  );
};

import React from 'react';
import { SlidingNumber } from '@animate-ui/react/primitives/texts/sliding-number';
import { usePrivacyMode } from '../utils/privacyService';
import { formatCurrency } from '../utils/csvParser';

export interface AnimatedCurrencyProps {
  value: number;
  className?: string;
  showSign?: boolean;
  currencySuffix?: string;
  animate?: boolean;
}

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

  const isNegative = value < 0;
  const absValue = Math.round(Math.abs(value));
  const signPrefix = showSign && value > 0 ? '+' : isNegative ? '-' : '';

  return (
    <span className={`inline-flex items-center font-mono-tabular tracking-tight ${className}`}>
      {signPrefix && <span>{signPrefix}</span>}
      <SlidingNumber
        number={absValue}
        thousandSeparator=","
        transition={{ stiffness: 240, damping: 25, mass: 0.4 }}
      />
      <span>{currencySuffix}</span>
    </span>
  );
};

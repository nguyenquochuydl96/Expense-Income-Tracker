import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calculator, Check, X, Delete, ArrowRight, CornerDownLeft } from 'lucide-react';
import {
  evaluateMoneyExpression,
  isExpression,
  formatMoneyString,
  parseMoneyNumber,
} from '../utils/mathExpression';

export interface MoneyCalculatorInputProps {
  value: string | number;
  onChange: (formattedStr: string, numericVal: number) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  theme?: 'slate' | 'rose' | 'sky' | 'teal' | 'emerald' | 'purple' | 'amber' | 'indigo';
  disabled?: boolean;
  required?: boolean;
  title?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
  id?: string;
  name?: string;
}

const THEME_STYLES = {
  slate: {
    border: 'border-slate-300 focus:border-slate-600 focus:ring-slate-500/20',
    btn: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    primary: 'bg-slate-800 hover:bg-slate-900 text-white',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  rose: {
    border: 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20',
    btn: 'text-rose-500 hover:text-rose-700 hover:bg-rose-50',
    primary: 'bg-rose-600 hover:bg-rose-700 text-white',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  sky: {
    border: 'border-sky-300 focus:border-sky-500 focus:ring-sky-500/20',
    btn: 'text-sky-500 hover:text-sky-700 hover:bg-sky-50',
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  teal: {
    border: 'border-teal-300 focus:border-teal-500 focus:ring-teal-500/20',
    btn: 'text-teal-600 hover:text-teal-800 hover:bg-teal-50',
    primary: 'bg-teal-700 hover:bg-teal-800 text-white',
    badge: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  emerald: {
    border: 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20',
    btn: 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50',
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  purple: {
    border: 'border-purple-300 focus:border-purple-500 focus:ring-purple-500/20',
    btn: 'text-purple-600 hover:text-purple-800 hover:bg-purple-50',
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  amber: {
    border: 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20',
    btn: 'text-amber-600 hover:text-amber-800 hover:bg-amber-50',
    primary: 'bg-amber-600 hover:bg-amber-700 text-white',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  indigo: {
    border: 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/20',
    btn: 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
};

export const MoneyCalculatorInput: React.FC<MoneyCalculatorInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = '',
  inputClassName = '',
  size = 'md',
  theme = 'slate',
  disabled = false,
  required = false,
  title,
  autoFocus = false,
  allowNegative = false,
  id,
  name,
}) => {
  const [text, setText] = useState<string>(() => {
    if (typeof value === 'number') {
      return value === 0 ? '' : formatMoneyString(value);
    }
    return value || '';
  });

  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);
  const [calcExpr, setCalcExpr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes if not actively typing an expression
  useEffect(() => {
    const formatted = typeof value === 'number' ? (value === 0 ? '' : formatMoneyString(value)) : value || '';
    if (!isExpression(text) || text === '') {
      setText(formatted);
    }
  }, [value]);

  const styleTheme = THEME_STYLES[theme] || THEME_STYLES.slate;

  // Live evaluation of the current input text
  const liveResult = useMemo(() => {
    if (!isExpression(text)) return null;
    return evaluateMoneyExpression(text);
  }, [text]);

  // Handle typing inside input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (!isExpression(raw)) {
      // Just normal number entry
      const num = parseMoneyNumber(raw);
      if (raw.trim() === '' || raw.trim() === '-') {
        onChange(raw, 0);
      } else {
        const formatted = (allowNegative && raw.trim().startsWith('-') ? '-' : '') + (num !== 0 ? formatMoneyString(Math.abs(num)) : '0');
        onChange(formatted, num);
      }
    }
  };

  // Evaluate on Enter or '=' or blur
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '=') {
      e.preventDefault();
      const evaluated = evaluateMoneyExpression(text);
      if (evaluated !== null) {
        const formatted = formatMoneyString(evaluated);
        setText(formatted);
        onChange(formatted, evaluated);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (isExpression(text)) {
        e.preventDefault();
        const evaluated = evaluateMoneyExpression(text);
        if (evaluated !== null) {
          const formatted = formatMoneyString(evaluated);
          setText(formatted);
          onChange(formatted, evaluated);
        }
      }
    }
  };

  const handleBlur = () => {
    if (isExpression(text)) {
      const evaluated = evaluateMoneyExpression(text);
      if (evaluated !== null) {
        const formatted = formatMoneyString(evaluated);
        setText(formatted);
        onChange(formatted, evaluated);
      } else {
        const num = parseMoneyNumber(text);
        const formatted = num !== 0 ? formatMoneyString(num) : '';
        setText(formatted);
        onChange(formatted, num);
      }
    } else {
      const num = parseMoneyNumber(text);
      const isNeg = allowNegative && text.trim().startsWith('-');
      const formatted = (isNeg ? '-' : '') + (num !== 0 ? formatMoneyString(Math.abs(num)) : '');
      setText(formatted);
      onChange(formatted, num);
    }
  };

  // Calculator Popover Methods
  const openCalculator = () => {
    if (disabled) return;
    const initial = text.trim() || (typeof value === 'number' && value !== 0 ? formatMoneyString(value) : '');
    setCalcExpr(initial);
    setIsCalcOpen(true);
  };

  const closeCalculator = () => {
    setIsCalcOpen(false);
  };

  // Calc live preview
  const calcResult = useMemo(() => {
    if (!calcExpr.trim()) return 0;
    const res = evaluateMoneyExpression(calcExpr);
    return res !== null ? res : parseMoneyNumber(calcExpr);
  }, [calcExpr]);

  const handleCalcAppend = (token: string) => {
    setCalcExpr((prev) => {
      if (token === 'C') return '';
      if (token === 'DEL') return prev.slice(0, -1);
      if (token === '=') {
        const evaluated = evaluateMoneyExpression(prev);
        return evaluated !== null ? formatMoneyString(evaluated) : prev;
      }
      // If adding an operator to empty expression
      if (['+', '-', '*', '/'].includes(token) && !prev.trim()) {
        const currentVal = parseMoneyNumber(text) || 0;
        return `${formatMoneyString(currentVal)} ${token} `;
      }
      if (['+', '-', '*', '/'].includes(token)) {
        return `${prev.trim()} ${token} `;
      }
      return prev + token;
    });
  };

  const handleQuickAdd = (amount: number) => {
    setCalcExpr((prev) => {
      const evaluated = evaluateMoneyExpression(prev);
      const current = evaluated !== null ? evaluated : (parseMoneyNumber(prev) || 0);
      const next = current + amount;
      return formatMoneyString(next);
    });
  };

  const handleApplyCalc = () => {
    const finalNum = calcResult;
    const formatted = formatMoneyString(finalNum);
    setText(formatted);
    onChange(formatted, finalNum);
    setIsCalcOpen(false);
  };

  // Keyboard shortcut listener for popup calculator
  useEffect(() => {
    if (!isCalcOpen) return;

    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsCalcOpen(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyCalc();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleCalcAppend('DEL');
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCalcAppend('C');
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleCalcAppend(e.key);
      } else if (['+', '-', '*', '/', '(', ')', '.'].includes(e.key)) {
        e.preventDefault();
        handleCalcAppend(e.key);
      } else if (e.key === '=') {
        e.preventDefault();
        handleCalcAppend('=');
      }
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isCalcOpen, calcResult, calcExpr]);

  // Size styling variants
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs font-mono-tabular',
    sm: 'px-2.5 py-1.5 text-xs font-mono-tabular',
    md: 'px-3 py-2 text-sm font-mono-tabular',
    lg: 'px-3.5 py-2.5 text-base font-mono-tabular font-bold',
  }[size];

  const calcBtnSize = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-1.5',
    lg: 'p-2',
  }[size];

  const calcIconSize = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4 h-4',
  }[size];

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* Input Box with Calculator Button */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          title={title}
          autoFocus={autoFocus}
          className={`w-full pr-8 rounded-lg border bg-white text-slate-900 transition-colors focus:outline-none focus:ring-1 ${styleTheme.border} ${sizeClasses} ${inputClassName}`}
        />

        {/* Small Calculator Icon Button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openCalculator}
          title="Mở máy tính cộng trừ tiền (Calculator)"
          className={`absolute right-1 rounded-md transition-colors ${styleTheme.btn} ${calcBtnSize} cursor-pointer`}
        >
          <Calculator className={calcIconSize} />
        </button>
      </div>

      {/* Floating Live Expression Preview Badge */}
      {liveResult !== null && (
        <div
          onClick={() => {
            const formatted = formatMoneyString(liveResult);
            setText(formatted);
            onChange(formatted, liveResult);
          }}
          className={`absolute left-0 -bottom-6 z-20 flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono-tabular font-semibold rounded-md border shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-100 ${styleTheme.badge}`}
          title="Bấm vào đây hoặc nhấn Enter để áp dụng kết quả"
        >
          <span>🧮 = {formatMoneyString(liveResult)} ₫</span>
          <CornerDownLeft className="w-2.5 h-2.5 opacity-60" />
        </div>
      )}

      {/* INTERACTIVE CALCULATOR MODAL OVERLAY */}
      {isCalcOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={closeCalculator}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-xs sm:max-w-sm shadow-2xl overflow-hidden p-4 space-y-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Calculator Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${styleTheme.badge}`}>
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Máy tính cộng trừ tiền</h4>
                  <p className="text-[10px] text-slate-400">Hỗ trợ phép tính &amp; phím tắt k, tr</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCalculator}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Display Screen */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1 text-right font-mono-tabular shadow-inner">
              <div className="text-xs text-slate-400 truncate min-h-[1.25rem]">
                {calcExpr || '0'}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-teal-400 tracking-tight">
                = {formatMoneyString(calcResult)} ₫
              </div>
            </div>

            {/* Quick Add Chips */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Cộng nhanh (+):
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '+10k', val: 10000 },
                  { label: '+20k', val: 20000 },
                  { label: '+50k', val: 50000 },
                  { label: '+100k', val: 100000 },
                  { label: '+200k', val: 200000 },
                  { label: '+500k', val: 500000 },
                  { label: '+1tr', val: 1000000 },
                  { label: '+2tr', val: 2000000 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleQuickAdd(chip.val)}
                    className="py-1 px-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold font-mono-tabular">
              {/* Row 1 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('C')}
                className="py-2.5 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 active:bg-rose-300 transition-colors cursor-pointer"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('DEL')}
                className="py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('(')}
                className="py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('/')}
                className="py-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('7')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('8')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('9')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('*')}
                className="py-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('4')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('5')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('6')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('-')}
                className="py-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('1')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('2')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('3')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('+')}
                className="py-2.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('0')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('000')}
                className="py-2.5 rounded-xl bg-slate-50 text-slate-800 hover:bg-slate-150 active:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer text-[11px]"
              >
                000
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend(')')}
                className="py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer"
              >
                )
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('=')}
                className="py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 transition-colors cursor-pointer text-sm"
              >
                =
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeCalculator}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyCalc}
                className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ${styleTheme.primary}`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Áp dụng ({formatMoneyString(calcResult)} ₫)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

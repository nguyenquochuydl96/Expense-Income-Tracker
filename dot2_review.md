# Báo Cáo Kiểm Tra & Nghiệm Thu Đợt 2 (dot2_review.md)

**Nhiệm vụ:**
1. Nâng cấp bộ nhập tiền `MoneyCalculatorInput.tsx` tự động thêm 3 số 0 (`autoThousands = true` mặc định), cơ chế hiển thị tinh gọn (`value % 100 === 0` hiển thị chia 1.000, số lẻ tự tắt), nút gạt nhanh `×1k`, hậu tố `,000 ₫`, và thực thi nghiêm ngặt prop `allowNegative={false}`.
2. Nâng cấp `src/utils/mathExpression.ts` thay thế hoàn toàn `new Function(...)` / `eval` bằng thuật toán Shunting-Yard thuần (hỗ trợ `+ - * / ( )`, số âm unary, bọc ngoặc đơn vị tiếng Việt, dấu chấm hàng nghìn VN, an toàn chia cho 0 trả về `null`).
3. Vá toàn bộ lỗi kế toán và UI mức P0–P1:
   - `src/App.tsx`: Hoàn tiền âm trong chu kỳ BE Corp và sao kê Thẻ (`!== 0`), đồng bộ state React `rolloverMode` & `customPercentages`, cộng dồn đa tháng trong `categoryKpiStats`, xóa bỏ hardcode cá nhân thay bằng `CACHE_SCHEMA_VERSION`, tôn trọng Privacy Mode trong modal xóa.
   - `src/components/MonthlyReportCardModal.tsx`: Chặn chia cho 0 (`-Infinity%` / `NaN%`) khi `totalIncome <= 0`, cắt rút gọn nhãn `biggestExpenseLabel` bằng `maxWidth` trên Canvas PNG, bọc `try/catch` Clipboard.
   - `src/components/DailyLivingRunwayWidget.tsx`: Xử lý đúng trạng thái tháng đã qua `dateMetrics.isPast`, hoàn thiện Dark Mode cho thẻ danh mục con và dải chi tiêu định kỳ.
   - `src/utils/budgetUtils.ts` & `src/utils/csvParser.ts`: Thêm `bt.monthKey` vào `mSet`, tách kỷ nguyên `BUDGET_ERAS` có `effectiveFrom`, hỗ trợ định dạng `DD.MM.YYYY` và `new Date().getFullYear()`.

---

## 1. Toàn Bộ Mã Nguồn Các File & Đoạn Mã Đã Sửa

### 1.1. `src/utils/mathExpression.ts`
Toàn bộ mã nguồn phân giải biểu thức toán học thuần Shunting-Yard (100% không dùng `eval` / `new Function`):

```typescript
/**
 * Safe Mathematical Expression Evaluator for Money Inputs
 * Pure Shunting-Yard Algorithm Implementation (Zero eval / new Function)
 * Supports Vietnamese money abbreviations (k, K, tr, m, M, nghin, trieu)
 * and basic arithmetic (+, -, *, /) with unary negation and parenthesization
 */

export function isExpression(input: string): boolean {
  if (!input) return false;
  return /[+\-*/xX×÷:kmtrKMTR]/.test(input);
}

/**
 * Checks whether the input string has an explicit Vietnamese currency unit
 * like 'k', 'tr', 'm', 'nghin', 'trieu'
 */
export function hasExplicitUnit(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return (
    /\b(k|nghin|nghìn|ngan|ngàn|tr|trieu|triệu|m)\b/i.test(input) ||
    /(\d+)\s*(tr|trieu|triệu|m|k|nghin|nghìn|ngan|ngàn)\b/i.test(input) ||
    /(\d+)\s*(tr|trieu|m)\s*(\d+)\b/i.test(input)
  );
}

/**
 * Checks whether the input string contains thousand separators (e.g., 100.000 or 100,000)
 */
export function hasThousandSeparator(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return (
    /(?<=\d)\.(?=\d{3}(?:\.|\b|[+\-*/()xX×÷:\s]))/.test(input) ||
    /(?<=\d),(?=\d{3}(?:,|\b|[+\-*/()xX×÷:\s]))/.test(input)
  );
}

/**
 * Pre-processes Vietnamese currency abbreviations and formatting
 * Wrapping all replacements in parentheses to ensure correct mathematical precedence
 */
export function preprocessExpression(expr: string): string | null {
  if (!expr || typeof expr !== 'string') return null;
  let s = expr.trim();
  if (!s) return null;

  // Trim any trailing operators/spaces (e.g., '50k + ' -> '50k')
  s = s.replace(/[+\-*/xX×÷:\s]+$/, '');
  if (!s) return null;

  // 1. Spoken Vietnamese format: e.g. 1tr5 -> (1.5*1000000), 2tr2 -> (2.2*1000000)
  s = s.replace(/(\d+)\s*(tr|trieu|m)\s*(\d+)\b/gi, '($1.$3*1000000)');

  // 2. Million (tr, trieu, m) e.g., '1.5tr', '1,5tr', '2tr', '2m'
  s = s.replace(/(\d+),(\d+)\s*(tr|trieu|m)\b/gi, '($1.$2*1000000)');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(tr|trieu|m)\b/gi, '($1*1000000)');

  // 3. Thousand (k, K, nghin, ngan) e.g., '50k', '50.5k', '50,5k'
  s = s.replace(/(\d+),(\d+)\s*(k|nghin|ngan)\b/gi, '($1.$2*1000)');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(k|nghin|ngan)\b/gi, '($1*1000)');

  // 4. Remove Vietnamese thousand separator dots (e.g., 100.000 + 50.000 -> 100000 + 50000)
  s = s.replace(/(?<=\d)\.(?=\d{3}(?:\.|\b|[+\-*/()xX×÷:\s]))/g, '');

  // 5. Remove thousand separator commas (e.g., 50,000 -> 50000)
  s = s.replace(/(?<=\d),(?=\d{3}(?:,|\b|[+\-*/()xX×÷:\s]))/g, '');
  s = s.replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/,/g, '');

  // 6. Normalize multiplication and division symbols
  s = s.replace(/[xX×]/g, '*');
  s = s.replace(/[÷:]/g, '/');

  return s;
}

/**
 * Tokenizes the preprocessed expression into numbers, operators, and parentheses
 */
function tokenize(s: string): (number | string)[] | null {
  const tokens: (number | string)[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')' || c === '+' || c === '*' || c === '/') {
      tokens.push(c);
      i++;
      continue;
    }
    if (c === '-') {
      const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      if (
        prev === null ||
        prev === '(' ||
        prev === '+' ||
        prev === '-' ||
        prev === '*' ||
        prev === '/' ||
        prev === 'u-'
      ) {
        tokens.push('u-');
      } else {
        tokens.push('-');
      }
      i++;
      continue;
    }
    if (/\d/.test(c) || c === '.') {
      let numStr = '';
      let hasDot = false;
      while (i < s.length && (/\d/.test(s[i]) || s[i] === '.')) {
        if (s[i] === '.') {
          if (hasDot) return null; // Invalid double dot
          hasDot = true;
        }
        numStr += s[i];
        i++;
      }
      const val = parseFloat(numStr);
      if (isNaN(val)) return null;
      tokens.push(val);
      continue;
    }
    // Any unrecognized character immediately returns null
    return null;
  }
  return tokens;
}

/**
 * Pure Shunting-Yard Evaluator
 * Evaluates expressions with +, -, *, /, (, ), and unary negation
 * Returns rounded integer or null if invalid or division by zero
 */
export function evaluateMoneyExpression(expr: string): number | null {
  if (!expr || typeof expr !== 'string') return null;
  let s = expr.trim();
  if (!s) return null;

  // Trim trailing operators/spaces
  s = s.replace(/[+\-*/xX×÷:\s]+$/, '');
  if (!s) return null;

  // If already just a plain or comma-formatted number, parse it
  if (!isExpression(s)) {
    const cleanDigits = s.replace(/[^0-9-]/g, '');
    if (!cleanDigits || cleanDigits === '-') return null;
    const n = parseInt(cleanDigits, 10);
    return Number.isFinite(n) ? n : null;
  }

  const prep = preprocessExpression(s);
  if (!prep) return null;

  const tokens = tokenize(prep);
  if (!tokens || tokens.length === 0) return null;

  const output: (number | string)[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };
  const assoc: Record<string, 'L' | 'R'> = { '+': 'L', '-': 'L', '*': 'L', '/': 'L', 'u-': 'R' };

  for (const t of tokens) {
    if (typeof t === 'number') {
      output.push(t);
    } else if (t === 'u-') {
      ops.push(t);
    } else if (t in prec) {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        ((assoc[t] === 'L' && prec[ops[ops.length - 1]] >= prec[t]) ||
          (assoc[t] === 'R' && prec[ops[ops.length - 1]] > prec[t]))
      ) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    } else if (t === '(') {
      ops.push(t);
    } else if (t === ')') {
      let found = false;
      while (ops.length > 0) {
        const top = ops.pop()!;
        if (top === '(') {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) return null; // Mismatched parentheses
    }
  }

  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top === '(' || top === ')') return null; // Mismatched parentheses
    output.push(top);
  }

  // RPN evaluation stack
  const stack: number[] = [];
  for (const t of output) {
    if (typeof t === 'number') {
      stack.push(t);
    } else if (t === 'u-') {
      if (stack.length < 1) return null;
      stack.push(-stack.pop()!);
    } else {
      if (stack.length < 2) return null;
      const b = stack.pop()!;
      const a = stack.pop()!;
      if (t === '+') stack.push(a + b);
      else if (t === '-') stack.push(a - b);
      else if (t === '*') stack.push(a * b);
      else if (t === '/') {
        if (b === 0) return null; // Safe division by zero
        stack.push(a / b);
      }
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) return null;
  return Math.round(stack[0]);
}

export function formatMoneyString(val: number): string {
  if (!Number.isFinite(val)) return '0';
  return val.toLocaleString('en-US');
}

export function parseMoneyNumber(val: string | number): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const evalResult = evaluateMoneyExpression(val);
  if (evalResult !== null) return evalResult;
  const clean = val.replace(/[^0-9-]/g, '');
  if (!clean || clean === '-') return 0;
  const n = parseInt(clean, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes the effective numeric and formatted value for an input string,
 * taking into account the autoThousands multiplier mode and allowNegative constraint.
 */
export function computeEffectiveMoneyValue(
  rawText: string,
  isAutoThousands: boolean,
  allowNegative: boolean = false
): { num: number; formatted: string } | null {
  const text = (rawText || '').trim();
  if (!text || text === '-') {
    return { num: 0, formatted: '' };
  }

  let evaluated: number | null = null;
  if (isExpression(text)) {
    evaluated = evaluateMoneyExpression(text);
  } else {
    // Normal numeric entry (handles decimals like 48.5 or 48,5)
    const normalized = text.replace(/,/g, '.');
    const parsedFloat = parseFloat(normalized);
    if (!isNaN(parsedFloat) && Number.isFinite(parsedFloat)) {
      evaluated = parsedFloat;
    } else {
      const cleanDigits = text.replace(/[^0-9-]/g, '');
      const parsedInt = cleanDigits && cleanDigits !== '-' ? parseInt(cleanDigits, 10) : null;
      if (parsedInt !== null && Number.isFinite(parsedInt)) {
        evaluated = parsedInt;
      }
    }
  }

  if (evaluated === null || !Number.isFinite(evaluated)) {
    return null;
  }

  let finalNum = evaluated;
  const hasUnit = hasExplicitUnit(text);
  const hasSeparators = hasThousandSeparator(text);

  // If autoThousands is ON and user did not specify explicit units or thousand separators:
  if (isAutoThousands && !hasUnit && !hasSeparators) {
    finalNum = Math.round(evaluated * 1000);
  } else {
    finalNum = Math.round(evaluated);
  }

  if (!allowNegative && finalNum < 0) {
    finalNum = 0;
  }

  const isNeg = allowNegative && finalNum < 0;
  const formatted = (isNeg ? '-' : '') + formatMoneyString(Math.abs(finalNum));
  return { num: finalNum, formatted };
}
```

---

### 1.2. `src/components/MoneyCalculatorInput.tsx`
Toàn bộ mã nguồn component ô nhập tiền kèm hậu tố mờ `,000 ₫`, nút gạt `×1k`, conciseness display và popup máy tính:

```typescript
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calculator, Check, X, Delete, CornerDownLeft } from 'lucide-react';
import {
  evaluateMoneyExpression,
  isExpression,
  formatMoneyString,
  parseMoneyNumber,
  hasExplicitUnit,
  hasThousandSeparator,
  computeEffectiveMoneyValue,
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
  autoThousands?: boolean;
  id?: string;
  name?: string;
}

const THEME_STYLES = {
  slate: {
    border: 'border-slate-300 dark:border-slate-700 focus:border-slate-600 focus:ring-slate-500/20',
    btn: 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
    primary: 'bg-slate-800 hover:bg-slate-900 text-white',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
  rose: {
    border: 'border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-rose-500/20',
    btn: 'text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60',
    primary: 'bg-rose-600 hover:bg-rose-700 text-white',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  sky: {
    border: 'border-sky-300 dark:border-sky-800 focus:border-sky-500 focus:ring-sky-500/20',
    btn: 'text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/60',
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    badge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  teal: {
    border: 'border-teal-300 dark:border-teal-800 focus:border-teal-500 focus:ring-teal-500/20',
    btn: 'text-teal-600 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60',
    primary: 'bg-teal-700 hover:bg-teal-800 text-white',
    badge: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  },
  emerald: {
    border: 'border-emerald-300 dark:border-emerald-800 focus:border-emerald-500 focus:ring-emerald-500/20',
    btn: 'text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60',
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  purple: {
    border: 'border-purple-300 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20',
    btn: 'text-purple-600 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/60',
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-800 focus:border-amber-500 focus:ring-amber-500/20',
    btn: 'text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60',
    primary: 'bg-amber-600 hover:bg-amber-700 text-white',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  indigo: {
    border: 'border-indigo-300 dark:border-indigo-800 focus:border-indigo-500 focus:ring-indigo-500/20',
    btn: 'text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
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
  autoThousands = true,
  id,
  name,
}) => {
  // Determine if x1k mode should be active
  const [isAutoThousands, setIsAutoThousands] = useState<boolean>(() => {
    if (!autoThousands) return false;
    const num = parseMoneyNumber(value);
    if (num === 0) return true;
    return Math.abs(num) % 100 === 0;
  });

  // Display text in the input
  const [text, setText] = useState<string>(() => {
    const num = parseMoneyNumber(value);
    if (num === 0) return typeof value === 'string' ? value : '';
    if (autoThousands && Math.abs(num) % 100 === 0) {
      return String(num / 1000);
    }
    return formatMoneyString(num);
  });

  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);
  const [calcExpr, setCalcExpr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmittedNumRef = useRef<number | null>(null);

  // Sync external value changes if not actively emitted by this component
  useEffect(() => {
    const num = parseMoneyNumber(value);
    if (lastEmittedNumRef.current !== null && lastEmittedNumRef.current === num) {
      return;
    }
    if (autoThousands) {
      if (num === 0) {
        setIsAutoThousands(true);
        setText(typeof value === 'string' ? value : '');
      } else if (Math.abs(num) % 100 === 0) {
        setIsAutoThousands(true);
        setText(String(num / 1000));
      } else {
        setIsAutoThousands(false);
        setText(formatMoneyString(num));
      }
    } else {
      setIsAutoThousands(false);
      setText(num === 0 ? (typeof value === 'string' ? value : '') : formatMoneyString(num));
    }
  }, [value, autoThousands]);

  const styleTheme = THEME_STYLES[theme] || THEME_STYLES.slate;

  // Toggle x1k mode
  const toggleAutoThousands = () => {
    const nextAuto = !isAutoThousands;
    setIsAutoThousands(nextAuto);
    const effective = computeEffectiveMoneyValue(text, nextAuto, allowNegative);
    if (effective !== null) {
      lastEmittedNumRef.current = effective.num;
      onChange(effective.formatted, effective.num);
    }
  };

  // Live evaluation of the current input text
  const liveEffective = useMemo(() => {
    if (!text.trim() || text.trim() === '-') return null;
    return computeEffectiveMoneyValue(text, isAutoThousands, allowNegative);
  }, [text, isAutoThousands, allowNegative]);

  // Handle typing inside input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    const effective = computeEffectiveMoneyValue(raw, isAutoThousands, allowNegative);
    if (effective !== null) {
      lastEmittedNumRef.current = effective.num;
      onChange(effective.formatted, effective.num);
    } else {
      if (raw.trim() === '' || raw.trim() === '-') {
        lastEmittedNumRef.current = 0;
        onChange(raw, 0);
      }
    }
  };

  // Commit on Enter, '=', or blur
  const handleCommit = () => {
    const effective = computeEffectiveMoneyValue(text, isAutoThousands, allowNegative);
    if (effective !== null) {
      // If user typed an expression, commit evaluated text into the field
      if (isAutoThousands && !hasExplicitUnit(text) && !hasThousandSeparator(text)) {
        setText(String(effective.num / 1000));
      } else {
        setText(effective.formatted);
      }
      lastEmittedNumRef.current = effective.num;
      onChange(effective.formatted, effective.num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '=') {
      e.preventDefault();
      handleCommit();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  const handleBlur = () => {
    handleCommit();
  };

  // Calculator Popover Methods
  const openCalculator = () => {
    if (disabled) return;
    const effective = computeEffectiveMoneyValue(text, isAutoThousands, allowNegative);
    const initial = effective !== null && effective.num !== 0 ? formatMoneyString(effective.num) : '';
    setCalcExpr(initial);
    setIsCalcOpen(true);
  };

  const closeCalculator = () => {
    setIsCalcOpen(false);
  };

  // Calc live preview inside modal
  const calcResult = useMemo(() => {
    if (!calcExpr.trim()) return 0;
    const res = evaluateMoneyExpression(calcExpr);
    let n = res !== null ? res : parseMoneyNumber(calcExpr);
    if (!allowNegative && n < 0) {
      n = 0;
    }
    return n;
  }, [calcExpr, allowNegative]);

  const handleCalcAppend = (token: string) => {
    setCalcExpr((prev) => {
      if (token === 'C') return '';
      if (token === 'DEL') return prev.slice(0, -1);
      if (token === '=') {
        const evaluated = evaluateMoneyExpression(prev);
        let n = evaluated !== null ? evaluated : parseMoneyNumber(prev);
        if (!allowNegative && n < 0) n = 0;
        return formatMoneyString(n);
      }
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
      const current = evaluated !== null ? evaluated : parseMoneyNumber(prev) || 0;
      let next = current + amount;
      if (!allowNegative && next < 0) next = 0;
      return formatMoneyString(next);
    });
  };

  const handleApplyCalc = () => {
    let finalNum = calcResult;
    if (!allowNegative && finalNum < 0) {
      finalNum = 0;
    }
    const formatted = formatMoneyString(finalNum);
    if (isAutoThousands && Math.abs(finalNum) % 100 === 0) {
      setText(String(finalNum / 1000));
    } else {
      setText(formatted);
    }
    lastEmittedNumRef.current = finalNum;
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
      {/* Input Box with x1k Toggle and Calculator Button */}
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
          className={`w-full pr-24 rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 transition-colors focus:outline-none focus:ring-1 ${styleTheme.border} ${sizeClasses} ${inputClassName}`}
        />

        {/* Right-aligned action buttons and x1k suffix */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {/* Faint ,000 d suffix */}
          {isAutoThousands &&
            !hasExplicitUnit(text) &&
            !hasThousandSeparator(text) &&
            text.trim() !== '' &&
            text.trim() !== '-' && (
              <span className="text-[11px] font-mono-tabular font-medium text-slate-400 dark:text-slate-500 select-none pointer-events-none pr-0.5">
                ,000 ₫
              </span>
            )}

          {/* Quick toggle x1k button */}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={toggleAutoThousands}
            title={
              isAutoThousands
                ? 'Đang bật nhân nghìn (×1k). Bấm để tắt.'
                : 'Đang tắt nhân nghìn (×1k). Bấm để bật.'
            }
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer select-none ${
              isAutoThousands
                ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            ×1k
          </button>

          {/* Small Calculator Icon Button */}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={openCalculator}
            title="Mở máy tính cộng trừ tiền (Calculator)"
            className={`rounded-md transition-colors ${styleTheme.btn} ${calcBtnSize} cursor-pointer`}
          >
            <Calculator className={calcIconSize} />
          </button>
        </div>
      </div>

      {/* Floating Live Expression Preview Badge */}
      {liveEffective !== null && isExpression(text) && (
        <div
          onClick={handleCommit}
          className={`absolute left-0 -bottom-6 z-20 flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono-tabular font-semibold rounded-md border shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-100 ${styleTheme.badge}`}
          title="Bấm vào đây hoặc nhấn Enter để áp dụng kết quả"
        >
          <span>🧮 = {liveEffective.formatted} ₫</span>
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xs sm:max-w-sm shadow-2xl overflow-hidden p-4 space-y-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Calculator Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${styleTheme.badge}`}>
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Máy tính cộng trừ tiền</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Hỗ trợ phép tính &amp; phím tắt k, tr</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCalculator}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
                    className="py-1 px-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 rounded-lg transition-colors cursor-pointer"
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
                className="py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60 active:bg-rose-300 transition-colors cursor-pointer"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('DEL')}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('(')}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 transition-colors cursor-pointer"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('/')}
                className="py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('7')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('8')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('9')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('*')}
                className="py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('4')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('5')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('6')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('-')}
                className="py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('1')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('2')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('3')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('+')}
                className="py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 active:bg-amber-300 transition-colors cursor-pointer text-sm"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleCalcAppend('0')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend('000')}
                className="py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer text-[11px]"
              >
                000
              </button>
              <button
                type="button"
                onClick={() => handleCalcAppend(')')}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 transition-colors cursor-pointer"
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
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeCalculator}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
```

---

### 1.3. `src/utils/budgetUtils.ts`
Toàn bộ mã nguồn động cơ Rollover đa tháng, phân bổ ngân sách theo kỷ nguyên `BUDGET_ERAS` (`T4-T7` và `T8+`), và bảo toàn tính toàn vẹn khi chuyển tiếp tháng:

```typescript
import { TransactionRecord, BudgetTransferRecord, EXPENSE_CATEGORIES } from '../types/finance';
import { isBudgetTransferRecord } from './cycleUtils';

export const SAVED_CATEGORY_PERCENTAGES_KEY = 'heomeo_category_percentages_v1';
export const SAVED_ROLLOVER_MODE_KEY = 'heomeo_rollover_mode_v1';

export type RolloverMode = 'full' | 'deficit_only' | 'none';

// T4-T7 base percentages matching Google Sheet (sum = 100%)
export const DEFAULT_CATEGORY_PERCENTAGES_T4_T7: Record<string, number> = {
  'Tiết kiệm': 42.1053,
  'Thuê nhà': 13.6842,
  'Ăn uống': 14.7368,
  'Quà tặng/Cưới hỏi': 7.3684,
  'Hóa/Mỹ phẩm': 6.3158,
  'Thú cưng': 4.2105,
  'Giải trí Heo': 2.1053,
  'Giải trí Mèo': 2.1053,
  'Shopping': 2.1053,
  'Điện thoại/Xăng xe': 2.1053,
  'Sức khỏe': 1.0526,
  'Du lịch': 1.0526,
  'Khác': 1.0526,
};

// Current phase (T8-T10) base percentages matching Google Sheet (sum = 100%)
export const DEFAULT_CATEGORY_PERCENTAGES: Record<string, number> = {
  'Tiết kiệm': 39.2157,
  'Thuê nhà': 16.6667,
  'Ăn uống': 13.7255,
  'Quà tặng/Cưới hỏi': 7.8431,
  'Hóa/Mỹ phẩm': 4.9020,
  'Thú cưng': 3.9216,
  'Shopping': 2.9412,
  'Điện thoại/Xăng xe': 1.9608,
  'Giải trí Heo': 1.9608,
  'Giải trí Mèo': 1.9608,
  'Du lịch': 1.9608,
  'Sức khỏe': 1.9608,
  'Khác': 0.9804,
};

// Exact ratios matching Google Sheet 'Source data validation'!C1:C14 (denominator 47,500,000) for April-July 2026
export const DEFAULT_CATEGORY_RATIOS_T4_T7: Record<string, number> = {
  'Thuê nhà': 6.5 / 47.5,
  'Thú cưng': 2.0 / 47.5,
  'Hóa/Mỹ phẩm': 3.0 / 47.5,
  'Ăn uống': 7.0 / 47.5,
  'Sức khỏe': 0.5 / 47.5,
  'Tiết kiệm': 20.0 / 47.5,
  'Điện thoại/Xăng xe': 1.0 / 47.5,
  'Shopping': 1.0 / 47.5,
  'Du lịch': 0.5 / 47.5,
  'Quà tặng/Cưới hỏi': 3.5 / 47.5,
  'Giải trí Heo': 1.0 / 47.5,
  'Giải trí Mèo': 1.0 / 47.5,
  'Khác': 0.5 / 47.5,
};

// Exact ratios matching Google Sheet 'Source data validation'!F1:F14 (denominator 51,000,000) for August-October 2026
export const DEFAULT_CATEGORY_RATIOS: Record<string, number> = {
  'Thuê nhà': 8.5 / 51.0,
  'Thú cưng': 2.0 / 51.0,
  'Hóa/Mỹ phẩm': 2.5 / 51.0,
  'Ăn uống': 7.0 / 51.0,
  'Sức khỏe': 1.0 / 51.0,
  'Tiết kiệm': 20.0 / 51.0,
  'Điện thoại/Xăng xe': 1.0 / 51.0,
  'Shopping': 1.5 / 51.0,
  'Du lịch': 1.0 / 51.0,
  'Quà tặng/Cưới hỏi': 4.0 / 51.0,
  'Giải trí Heo': 1.0 / 51.0,
  'Giải trí Mèo': 1.0 / 51.0,
  'Khác': 0.5 / 51.0,
};

export interface BudgetEraConfig {
  effectiveFrom: string; // ISO monthKey 'YYYY-MM'
  name: string;
  percentages: Record<string, number>;
  ratios: Record<string, number>;
}

export const BUDGET_ERAS: BudgetEraConfig[] = [
  {
    effectiveFrom: '2026-08',
    name: 'Current Era (T8/2026+)',
    percentages: DEFAULT_CATEGORY_PERCENTAGES,
    ratios: DEFAULT_CATEGORY_RATIOS,
  },
  {
    effectiveFrom: '2026-04',
    name: 'Historical Era (T4-T7/2026)',
    percentages: DEFAULT_CATEGORY_PERCENTAGES_T4_T7,
    ratios: DEFAULT_CATEGORY_RATIOS_T4_T7,
  },
];

export function getBudgetEraForMonth(mKey: string): BudgetEraConfig {
  for (const era of BUDGET_ERAS) {
    if (mKey >= era.effectiveFrom) {
      return era;
    }
  }
  return BUDGET_ERAS[BUDGET_ERAS.length - 1];
}

// General income categories (salary / shared household income split by %):
export const GENERAL_INCOME_CATEGORIES = new Set([
  'lương yes4all',
  'lương be',
  'công đoàn yes4all',
  'công đoàn be',
  'lương heo',
  'lương mèo',
  'chứng khoán',
  'bán hàng',
  'khác',
  'thu nhập chung',
]);

/**
 * Determines whether an income category is dedicated to a specific expense category.
 * Returns the matching expense category name if dedicated, or null if it's general shared income.
 */
export function getDedicatedExpenseCategory(
  rawCategory: string | undefined,
  allCategories: string[] = Array.from(EXPENSE_CATEGORIES)
): string | null {
  if (!rawCategory) return null;
  const clean = rawCategory.trim().toLowerCase();
  if (GENERAL_INCOME_CATEGORIES.has(clean)) return null;

  for (const cat of allCategories) {
    if (cat === 'Khác') continue;
    if (cat.toLowerCase() === clean || clean.startsWith(cat.toLowerCase())) {
      return cat;
    }
  }
  return null;
}

export interface CategoryMonthBudgetStats {
  category: string;
  monthKey: string;
  percentage: number;
  baseBudget: number;
  baseFromGeneral: number;
  dedicatedIncome: number;
  transferIn: number;
  transferOut: number;
  netTransfer: number;
  carryover: number;
  effectiveBudget: number;
  spent: number;
  remaining: number;
  txCount: number;
  pctUsed: number;
  isOver: boolean;
}

export interface MultiMonthRolloverResult {
  chain: Record<string, Record<string, CategoryMonthBudgetStats>>;
  allChronologicalMonths: string[];
  allCategories: string[];
  generalMonthlyIncomes: Record<string, number>;
  totalMonthlyIncomes: Record<string, number>;
  dedicatedMonthlyIncomes?: Record<string, Record<string, number>>;
  monthlyCategoryExpenses: Record<string, Record<string, { total: number; count: number }>>;
  monthlyTransfersIn: Record<string, Record<string, number>>;
  monthlyTransfersOut: Record<string, Record<string, number>>;
  rolloverMode?: RolloverMode;
}

/**
 * Pre-indexes all records into an O(1) month lookup map: Map<string, TransactionRecord[]>.
 * Eliminates repeated O(M*N) array filter scans across months.
 */
export function computeNormalizedMonthMap(
  records: TransactionRecord[]
): Map<string, TransactionRecord[]> {
  const map = new Map<string, TransactionRecord[]>();
  for (const r of records) {
    const mKey = r.monthKey;
    if (!mKey) continue;
    let list = map.get(mKey);
    if (!list) {
      list = [];
      map.set(mKey, list);
    }
    list.push(r);
  }
  return map;
}

/**
 * Calculates complete multi-month rollover chain across all categories and months
 * Synchronized 100% with Google Sheet "Monthly Overview" logic
 */
export function computeMultiMonthRollover(
  allRecords: TransactionRecord[],
  budgetTransfers: BudgetTransferRecord[] = [],
  customPercentages: Record<string, number> = {},
  rolloverMode: RolloverMode = 'full',
  hasCustomPercentages: boolean = false
): MultiMonthRolloverResult {
  const monthMap = computeNormalizedMonthMap(allRecords);

  // 1. Determine all chronological months
  const mSet = new Set<string>();
  for (const mKey of monthMap.keys()) {
    if (mKey.includes('-')) {
      mSet.add(mKey);
    }
  }
  if (budgetTransfers && budgetTransfers.length > 0) {
    for (const bt of budgetTransfers) {
      if (bt.monthKey && bt.monthKey.includes('-')) {
        mSet.add(bt.monthKey);
      }
    }
  }
  const allChronologicalMonths = Array.from(mSet).sort((a, b) => a.localeCompare(b));

  // 2. Determine all categories
  const cSet = new Set<string>(EXPENSE_CATEGORIES);
  for (const r of allRecords) {
    if (r.sheetType === 'Expenses' && r.category) {
      cSet.add(r.category);
    }
  }
  const allCategories = Array.from(cSet);

  // 3. Monthly Incomes: Partition into General Income vs Dedicated Category Income
  const generalMonthlyIncomes: Record<string, number> = {};
  const totalMonthlyIncomes: Record<string, number> = {};
  const dedicatedMonthlyIncomes: Record<string, Record<string, number>> = {};

  for (const mKey of allChronologicalMonths) {
    let generalSum = 0;
    let totalSum = 0;
    dedicatedMonthlyIncomes[mKey] = {};

    const mRecords = monthMap.get(mKey) || [];
    for (const r of mRecords) {
      if (r.sheetType !== 'Income') continue;
      totalSum += r.amount;
      const rawCat = (r.category || '').trim();

      // Check if income is designated specifically for an expense category
      const matchedExpenseCat = getDedicatedExpenseCategory(rawCat, allCategories);

      if (matchedExpenseCat) {
        // Dedicated 100% directly to this category's budget
        dedicatedMonthlyIncomes[mKey][matchedExpenseCat] =
          (dedicatedMonthlyIncomes[mKey][matchedExpenseCat] || 0) + r.amount;
      } else {
        // General household salary/income to be split according to percentages
        generalSum += r.amount;
      }
    }
    generalMonthlyIncomes[mKey] = generalSum;
    totalMonthlyIncomes[mKey] = totalSum;
  }

  // 4. Monthly Transfers
  const monthlyTransfersIn: Record<string, Record<string, number>> = {};
  const monthlyTransfersOut: Record<string, Record<string, number>> = {};
  const monthlyCategoryExpenses: Record<string, Record<string, { total: number; count: number }>> = {};

  for (const mKey of allChronologicalMonths) {
    monthlyCategoryExpenses[mKey] = {};
    monthlyTransfersIn[mKey] = {};
    monthlyTransfersOut[mKey] = {};
  }

  if (budgetTransfers && budgetTransfers.length > 0) {
    for (const bt of budgetTransfers) {
      if (!bt.monthKey) continue;
      if (!monthlyTransfersIn[bt.monthKey]) monthlyTransfersIn[bt.monthKey] = {};
      if (!monthlyTransfersOut[bt.monthKey]) monthlyTransfersOut[bt.monthKey] = {};

      const toCat = (bt.toCategory || '').trim();
      const fromCat = (bt.fromCategory || '').trim();

      if (toCat && toCat !== 'Thu nhập riêng') {
        monthlyTransfersIn[bt.monthKey][toCat] = (monthlyTransfersIn[bt.monthKey][toCat] || 0) + bt.amount;
      }
      if (fromCat && fromCat !== 'Thu nhập riêng') {
        monthlyTransfersOut[bt.monthKey][fromCat] = (monthlyTransfersOut[bt.monthKey][fromCat] || 0) + bt.amount;
      }
    }
  }

  // Expenses & legacy transfers
  for (const r of allRecords) {
    if (r.sheetType === 'Expenses' && r.monthKey) {
      const cat = r.category || 'Khác';

      if (!monthlyCategoryExpenses[r.monthKey]) monthlyCategoryExpenses[r.monthKey] = {};
      if (!monthlyTransfersIn[r.monthKey]) monthlyTransfersIn[r.monthKey] = {};
      if (!monthlyTransfersOut[r.monthKey]) monthlyTransfersOut[r.monthKey] = {};

      if (isBudgetTransferRecord(r)) {
        if (r.amount > 0) {
          monthlyTransfersOut[r.monthKey][cat] = (monthlyTransfersOut[r.monthKey][cat] || 0) + r.amount;
        } else if (r.amount < 0) {
          monthlyTransfersIn[r.monthKey][cat] = (monthlyTransfersIn[r.monthKey][cat] || 0) + Math.abs(r.amount);
        }
      } else {
        if (!monthlyCategoryExpenses[r.monthKey][cat]) {
          monthlyCategoryExpenses[r.monthKey][cat] = { total: 0, count: 0 };
        }
        monthlyCategoryExpenses[r.monthKey][cat].total += r.amount;
        monthlyCategoryExpenses[r.monthKey][cat].count += 1;
      }
    }
  }

  // 5. Chain rollover
  const chain: Record<string, Record<string, CategoryMonthBudgetStats>> = {};

  for (const cat of allCategories) {
    chain[cat] = {};
    let cumulativeBalance = 0;

    for (let i = 0; i < allChronologicalMonths.length; i++) {
      const mKey = allChronologicalMonths[i];
      const mGeneralIncome = generalMonthlyIncomes[mKey] || 0;

      let ratio: number;
      let pct: number;

      // Era determination via BUDGET_ERAS
      const era = getBudgetEraForMonth(mKey);

      // Historical months (T4-T7) are locked historical eras synchronized to Google Sheet Section 2 (R20:R23)
      // They MUST NEVER be retroactively modified by Phase 2 or custom percentages!
      if (mKey <= '2026-07') {
        ratio = era.ratios[cat] ?? 0;
        pct = era.percentages[cat] ?? (ratio * 100);
      } else {
        if (hasCustomPercentages && customPercentages[cat] !== undefined) {
          pct = customPercentages[cat];
          ratio = pct / 100;
        } else {
          ratio = era.ratios[cat] ?? 0;
          pct = era.percentages[cat] ?? (ratio * 100);
        }
      }

      // Base budget calculation:
      // Uses exact formula ratio matching Google Sheet (=SUMIFS(...) * XLOOKUP(...)) for general income,
      // PLUS 100% of any dedicated income designated specifically for this category!
      const baseFromGeneral = Math.round(mGeneralIncome * ratio);
      const dedicatedIncome = dedicatedMonthlyIncomes[mKey]?.[cat] || 0;
      const baseBudget = baseFromGeneral + dedicatedIncome;

      const transferIn = monthlyTransfersIn[mKey]?.[cat] || 0;
      const transferOut = monthlyTransfersOut[mKey]?.[cat] || 0;
      const netTransfer = transferIn - transferOut;

      let carryover = 0;
      if (rolloverMode === 'full') {
        carryover = cumulativeBalance;
      } else if (rolloverMode === 'deficit_only') {
        carryover = Math.min(0, cumulativeBalance);
      } else {
        carryover = 0;
      }

      const effectiveBudget = baseBudget + carryover + netTransfer;
      const spent = monthlyCategoryExpenses[mKey]?.[cat]?.total || 0;
      const count = monthlyCategoryExpenses[mKey]?.[cat]?.count || 0;
      const remaining = effectiveBudget - spent;
      const pctUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : spent > 0 ? 999 : 0;
      const isOver = remaining < 0;

      chain[cat][mKey] = {
        category: cat,
        monthKey: mKey,
        percentage: pct,
        baseBudget,
        baseFromGeneral,
        dedicatedIncome,
        transferIn,
        transferOut,
        netTransfer,
        carryover,
        effectiveBudget,
        spent,
        remaining,
        txCount: count,
        pctUsed,
        isOver,
      };

      cumulativeBalance = remaining;
    }
  }

  return {
    chain,
    allChronologicalMonths,
    allCategories,
    generalMonthlyIncomes,
    totalMonthlyIncomes,
    dedicatedMonthlyIncomes,
    monthlyCategoryExpenses,
    monthlyTransfersIn,
    monthlyTransfersOut,
    rolloverMode,
  };
}
```

---

### 1.4. `src/components/DailyLivingRunwayWidget.tsx`
Toàn bộ mã nguồn widget dự báo hạn mức tiêu hằng ngày, xử lý đúng `dateMetrics.isPast` (cả ở chế độ mở rộng lẫn thanh thu gọn) và Dark Mode hoàn thiện:

```typescript
import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Flame,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wallet,
  Check,
  X,
} from 'lucide-react';
import { formatCurrency } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { usePrivacyMode } from '../utils/privacyService';

export interface DailyCategoryStat {
  category: string;
  effectiveBudget: number;
  spent: number;
  remaining: number;
  percentage: number;
  txCount: number;
}

export interface DailyLivingRunwayWidgetProps {
  selectedMonth: string;
  items: DailyCategoryStat[];
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
  isPrivate?: boolean;
}

const STORAGE_KEY_LIVING_CATS = 'heomeo_daily_living_categories_v1';
const STORAGE_KEY_COLLAPSED = 'heomeo_runway_collapsed_v1';

// Mặc định 4 danh mục phát sinh thường nhật hàng ngày (sắp xếp theo alphabet)
const DEFAULT_LIVING_CATEGORIES = [
  'Ăn uống',
  'Giải trí Heo',
  'Giải trí Mèo',
  'Hóa/Mỹ phẩm',
];

export const DailyLivingRunwayWidget: React.FC<DailyLivingRunwayWidgetProps> = React.memo(({
  selectedMonth,
  items,
  onSelectCategory,
  selectedCategory = 'ALL',
  isPrivate: propIsPrivate,
}) => {
  const { isPrivate: hookIsPrivate } = usePrivacyMode();
  const _effectiveIsPrivate = propIsPrivate !== undefined ? propIsPrivate : hookIsPrivate;
  // State: Danh sách danh mục được chọn làm "Hằng ngày"
  const [livingCategories, setLivingCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LIVING_CATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_LIVING_CATEGORIES;
  });

  // State: Thu gọn / mở rộng widget
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  // State: Modal cấu hình danh mục hằng ngày
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempLivingCats, setTempLivingCats] = useState<string[]>(livingCategories);

  // Sync livingCategories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LIVING_CATS, JSON.stringify(livingCategories));
    } catch {
      // ignore
    }
  }, [livingCategories]);

  // Sync collapsed state to localStorage
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Tính toán thông tin ngày tháng trong kỳ
  const dateMetrics = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : currentYearMonth;
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    let currentDay: number;
    let isPast = false;
    let isFuture = false;

    if (targetMonth === currentYearMonth) {
      currentDay = now.getDate();
    } else if (targetMonth < currentYearMonth) {
      currentDay = daysInMonth;
      isPast = true;
    } else {
      currentDay = 1;
      isFuture = true;
    }

    const elapsedDays = isPast ? daysInMonth : isFuture ? 0 : Math.max(1, currentDay);
    const remainingDays = isPast ? 0 : isFuture ? daysInMonth : Math.max(1, daysInMonth - currentDay + 1);

    return {
      year,
      month,
      daysInMonth,
      currentDay,
      elapsedDays,
      remainingDays,
      isPast,
      isFuture,
      isCurrentMonth: targetMonth === currentYearMonth,
    };
  }, [selectedMonth]);

  // Phân tách items thành: Nhóm Hằng ngày vs Nhóm Định kỳ / Đột xuất (sắp xếp theo alphabet từ trái sang phải)
  const { dailyItems, periodicItems } = useMemo(() => {
    const livingSet = new Set(livingCategories);
    const daily: DailyCategoryStat[] = [];
    const periodic: DailyCategoryStat[] = [];

    items.forEach((item) => {
      if (livingSet.has(item.category)) {
        daily.push(item);
      } else {
        periodic.push(item);
      }
    });

    // Sắp xếp thứ tự từ trái sang phải theo alphabet tiếng Việt
    daily.sort((a, b) => a.category.localeCompare(b.category, 'vi'));
    periodic.sort((a, b) => a.category.localeCompare(b.category, 'vi'));

    return { dailyItems: daily, periodicItems: periodic };
  }, [items, livingCategories]);

  // Tính toán tổng hợp cho nhóm Hằng ngày
  const summary = useMemo(() => {
    const totalBudget = dailyItems.reduce((s, i) => s + i.effectiveBudget, 0);
    const totalSpent = dailyItems.reduce((s, i) => s + i.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const pctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const { elapsedDays, remainingDays } = dateMetrics;

    const burnRateDaily = elapsedDays > 0 ? Math.round(totalSpent / elapsedDays) : 0;
    const safeDailyAllowance =
      remainingDays > 0 ? Math.max(0, Math.round(totalRemaining / remainingDays)) : 0;

    const diff = safeDailyAllowance - burnRateDaily;
    const isPacingSafe = diff >= 0;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      pctUsed,
      burnRateDaily,
      safeDailyAllowance,
      diff,
      isPacingSafe,
    };
  }, [dailyItems, dateMetrics]);

  // Smart Pacing Calculation (Chỉ áp dụng cho các hạng mục chi tiêu thường nhật / daily transactions)
  const pacingStats = useMemo(() => {
    const { elapsedDays, daysInMonth, isPast, isFuture } = dateMetrics;
    if (isPast || isFuture || daysInMonth <= 0) return null;

    const monthElapsedPct = (elapsedDays / daysInMonth) * 100;
    const livingSet = new Set(livingCategories);

    const isExcludedFromPacing = (catName: string) => {
      const clean = catName.trim().toLowerCase();
      return (
        clean === 'thuê nhà' ||
        clean.startsWith('tiết kiệm') ||
        clean.includes('đầu tư')
      );
    };

    const fastBurners = items
      .filter((cat) => {
        // 1. Loại bỏ hoàn toàn các hạng mục chi tiêu cố định / chuyển khoản 1 lần trong tháng (Thuê nhà, Tiết kiệm)
        if (isExcludedFromPacing(cat.category)) return false;

        // 2. Không xét các hạng mục không có ngân sách hoặc phát sinh quá nhỏ (<= 200k)
        if (cat.effectiveBudget <= 0 || cat.spent <= 200000) return false;

        // 3. Chỉ xét các dạng chi tiêu thường nhật (daily transactions):
        // - Nằm trong nhóm sinh hoạt thường nhật đã cấu hình (livingSet)
        // - Hoặc có nhiều hơn 1 giao dịch phát sinh trong tháng (txCount > 1)
        const isDailySpending = livingSet.has(cat.category) || cat.txCount > 1;
        if (!isDailySpending && cat.spent <= cat.effectiveBudget) {
          return false;
        }

        const spentPct = (cat.spent / cat.effectiveBudget) * 100;
        const ratio = spentPct / Math.max(1, monthElapsedPct);
        return ratio >= 1.25;
      })
      .map((cat) => {
        const spentPct = (cat.spent / cat.effectiveBudget) * 100;
        const ratio = spentPct / Math.max(1, monthElapsedPct);
        return {
          category: cat.category,
          spent: cat.spent,
          budget: cat.effectiveBudget,
          spentPct,
          ratio,
        };
      })
      .sort((a, b) => b.ratio - a.ratio);

    return {
      monthElapsedPct,
      fastBurners,
      isPacingSafe: fastBurners.length === 0,
    };
  }, [items, dateMetrics, livingCategories]);

  // Handlers modal setting
  const openSettings = () => {
    setTempLivingCats([...livingCategories]);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (tempLivingCats.length === 0) {
      setLivingCategories(['Ăn uống']);
    } else {
      setLivingCategories([...tempLivingCats]);
    }
    setIsSettingsOpen(false);
  };

  const handleResetDefaultSettings = () => {
    setTempLivingCats(DEFAULT_LIVING_CATEGORIES);
  };

  const toggleCategoryInTemp = (cat: string) => {
    if (tempLivingCats.includes(cat)) {
      setTempLivingCats(tempLivingCats.filter((c) => c !== cat));
    } else {
      setTempLivingCats([...tempLivingCats, cat]);
    }
  };

  return (
    <div className="mb-5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-all">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-2xs">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <span>Dự Báo Chi Tiêu Hằng Ngày &amp; Hạn Mức An Toàn</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {dailyItems.length} danh mục thường nhật
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {dateMetrics.isPast ? (
                  `Tháng ${dateMetrics.month}/${dateMetrics.year} đã kết thúc (${dateMetrics.daysInMonth} ngày).`
                ) : dateMetrics.isFuture ? (
                  `Tháng ${dateMetrics.month}/${dateMetrics.year} chưa bắt đầu (${dateMetrics.daysInMonth} ngày).`
                ) : (
                  <>
                    Hôm nay ngày <strong>{dateMetrics.currentDay}/{dateMetrics.month}</strong> · Đã qua <strong>{dateMetrics.elapsedDays}/{dateMetrics.daysInMonth}</strong> ngày · Còn lại <strong>{dateMetrics.remainingDays}</strong> ngày
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
            title="Tùy chọn danh mục tính vào chi tiêu hằng ngày"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Chọn danh mục</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
          >
            {isCollapsed ? (
              <>
                <span>Mở rộng</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content (when expanded) */}
      {!isCollapsed ? (
        <div className="pt-4 space-y-4">
          {/* Hero 3 Cards Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Safe Daily Allowance */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-teal-200/60 dark:border-teal-700/40 shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-teal-800 dark:text-teal-300 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Hạn mức an toàn hôm nay:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {dateMetrics.isPast ? 'Đã kết thúc' : dateMetrics.remainingDays > 0 ? `${dateMetrics.remainingDays} ngày tới` : 'Hết kỳ'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-300 font-mono-tabular tracking-tight my-0.5">
                {dateMetrics.isPast ? (
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Đã chốt sổ kỳ này</span>
                ) : (
                  <>
                    {formatCurrency(summary.safeDailyAllowance)}
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400"> /ngày</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Ngân sách còn: {formatCurrency(summary.totalRemaining)}</span>
                <span className="text-[10px] text-slate-400">cả nhà</span>
              </div>
            </div>

            {/* Card 2: Actual Burn Rate */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tốc độ tiêu thực tế:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {dateMetrics.elapsedDays} ngày qua
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-mono-tabular tracking-tight my-0.5">
                {formatCurrency(summary.burnRateDaily)}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400"> /ngày</span>
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                {dateMetrics.isPast ? (
                  summary.totalRemaining >= 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Trong định mức ngân sách (+{formatCurrency(summary.totalRemaining)})</span>
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>Vượt ngân sách kỳ ({formatCurrency(Math.abs(summary.totalRemaining))})</span>
                    </span>
                  )
                ) : summary.isPacingSafe ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Dưới hạn mức an toàn ({formatCurrency(Math.abs(summary.diff))})</span>
                  </span>
                ) : (
                  <span className="text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    <span>Vượt nhịp độ an toàn ({formatCurrency(Math.abs(summary.diff))})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Combined Living Budget Progress */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Tiến độ quỹ thường nhật:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {summary.pctUsed.toFixed(1)}%
                </span>
              </div>
              <div className="space-y-1.5 my-1">
                <div className="w-full bg-slate-200/80 dark:bg-slate-700/70 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all theme-progress-fill"
                    style={{ width: `${Math.min(100, summary.pctUsed)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                  <span>Đã chi: {formatCurrency(summary.totalSpent)}</span>
                  <span>Tổng quỹ: {formatCurrency(summary.totalBudget)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                Gồm: {dailyItems.map((i) => i.category).join(', ')}
              </div>
            </div>
          </div>

          {/* Smart Budget Pacing Alert Box */}
          {pacingStats && (
            <div
              className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 text-xs transition-colors shadow-2xs ${
                pacingStats.fastBurners.length > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-200'
              }`}
            >
              {pacingStats.fastBurners.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-bold text-xs sm:text-sm ${
                      pacingStats.fastBurners.length > 0
                        ? 'text-amber-950 dark:text-amber-100'
                        : 'text-emerald-950 dark:text-emerald-100'
                    }`}
                  >
                    {pacingStats.fastBurners.length > 0
                      ? '⚡ Cảnh báo nhịp độ chi tiêu thường nhật:'
                      : '🛡️ Nhịp độ chi tiêu sinh hoạt an toàn:'}
                  </span>
                  <span
                    className={`text-[11px] font-bold font-mono-tabular px-2 py-0.5 rounded-full border ${
                      pacingStats.fastBurners.length > 0
                        ? 'bg-amber-200/70 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300/50 dark:border-amber-700/60'
                        : 'bg-emerald-200/70 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300/50 dark:border-emerald-700/60'
                    }`}
                  >
                    Tháng đã qua {pacingStats.monthElapsedPct.toFixed(0)}% thời gian
                  </span>
                </div>
                <p
                  className={`text-xs mt-1.5 leading-relaxed font-medium ${
                    pacingStats.fastBurners.length > 0
                      ? 'text-amber-900 dark:text-amber-100/90'
                      : 'text-emerald-900 dark:text-emerald-100/90'
                  }`}
                >
                  {pacingStats.fastBurners.length > 0 ? (
                    <>
                      Có <strong>{pacingStats.fastBurners.length}</strong> danh mục sinh hoạt đang chi tiêu vượt tốc độ của tháng:{' '}
                      {pacingStats.fastBurners.map((b, idx) => (
                        <span
                          key={b.category}
                          className="inline-block mr-2 font-bold text-amber-950 dark:text-amber-200 underline decoration-amber-400 dark:decoration-amber-500 decoration-1 underline-offset-2"
                        >
                          {b.category} ({b.spentPct.toFixed(0)}% ngân sách, nhanh {b.ratio.toFixed(1)}x)
                          {idx < pacingStats.fastBurners.length - 1 ? ',' : '.'}
                        </span>
                      ))}
                      Bạn nên lưu ý cân đối các ngày còn lại để không hụt ngân sách sinh hoạt cuối tháng.
                    </>
                  ) : (
                    'Mọi danh mục sinh hoạt thường nhật đều đang chi tiêu dưới tốc độ ngày của tháng. Hai bạn đang kiểm soát chi tiêu rất tốt, tiếp tục phát huy nhé!'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Grid of Individual Daily Living Categories */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Chi tiết từng quỹ sinh hoạt hằng ngày:</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Bấm vào thẻ để lọc danh sách chi tiêu bên dưới
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {dailyItems.map((item) => {
                const { elapsedDays, remainingDays, daysInMonth, currentDay } = dateMetrics;
                const burnRate = elapsedDays > 0 ? Math.round(item.spent / elapsedDays) : 0;
                const safeDaily =
                  remainingDays > 0 ? Math.max(0, Math.round(item.remaining / remainingDays)) : 0;

                // Trạng thái dự báo
                let statusBadge: {
                  type: 'danger' | 'warning' | 'safe' | 'unspent';
                  label: string;
                  runwayText: string;
                };

                if (item.remaining <= 0) {
                  statusBadge = {
                    type: 'danger',
                    label: 'Đã bội chi',
                    runwayText: `Âm ${formatCurrency(Math.abs(item.remaining))}`,
                  };
                } else if (dateMetrics.isPast) {
                  statusBadge = {
                    type: 'safe',
                    label: 'Tháng đã kết thúc',
                    runwayText: `Còn dư: +${formatCurrency(item.remaining)}`,
                  };
                } else if (dateMetrics.isFuture) {
                  statusBadge = {
                    type: 'unspent',
                    label: 'Chưa bắt đầu',
                    runwayText: `Ngân sách: ${formatCurrency(item.effectiveBudget)}`,
                  };
                } else if (burnRate <= 0) {
                  statusBadge = {
                    type: 'unspent',
                    label: 'Chưa phát sinh',
                    runwayText: 'Còn nguyên ngân sách',
                  };
                } else if (burnRate > safeDaily && safeDaily > 0) {
                  const daysLeftAtBurn = item.remaining / burnRate;
                  const burnoutDay = Math.min(daysInMonth, Math.floor(currentDay + daysLeftAtBurn));
                  statusBadge = {
                    type: 'warning',
                    label: 'Nguy cơ cạn sớm',
                    runwayText: `Dự kiến cạn ngày ${burnoutDay}/${dateMetrics.month}`,
                  };
                } else {
                  statusBadge = {
                    type: 'safe',
                    label: 'An toàn đến cuối tháng',
                    runwayText: `Thặng dư dự kiến: +${formatCurrency(
                      Math.max(0, item.remaining - burnRate * remainingDays)
                    )}`,
                  };
                }

                const isSelected = selectedCategory === item.category;

                return (
                  <div
                    key={item.category}
                    onClick={() => onSelectCategory && onSelectCategory(isSelected ? 'ALL' : item.category)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-500 shadow-sm ring-2 ring-teal-400/30'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div>
                      {/* Top: Category Badge & Status */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <CategoryBadge category={item.category} />
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                            statusBadge.type === 'danger'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : statusBadge.type === 'warning'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : statusBadge.type === 'safe'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Remaining vs Safe daily */}
                      <div className="space-y-1 font-mono-tabular">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Còn lại:</span>
                          <span
                            className={`text-sm font-bold ${
                              item.remaining < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {formatCurrency(item.remaining)}
                          </span>
                        </div>
                        {!dateMetrics.isPast && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] text-teal-700 dark:text-teal-300 font-medium">Tiêu tối đa:</span>
                            <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
                              {formatCurrency(safeDaily)}
                              <span className="text-[10px] font-normal">/ngày</span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between text-slate-400 dark:text-slate-500 text-[10px]">
                          <span>Tốc độ đã qua:</span>
                          <span>{formatCurrency(burnRate)}/ngày</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Forecast Note */}
                    <div
                      className={`mt-2 pt-1.5 border-t text-[10px] font-medium leading-tight ${
                        statusBadge.type === 'danger'
                          ? 'border-rose-100 text-rose-700'
                          : statusBadge.type === 'warning'
                          ? 'border-amber-100 text-amber-700'
                          : statusBadge.type === 'safe'
                          ? 'border-emerald-100 text-emerald-700'
                          : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      {statusBadge.runwayText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-daily Categories Strip (Khoản Định kỳ & Sự kiện đột xuất) */}
          {periodicItems.length > 0 && (
            <div className="pt-2 border-t border-indigo-100/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                <Wallet className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>Các khoản Định kỳ &amp; Sự kiện đột xuất (không chia theo ngày):</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {periodicItems.map((item) => {
                  const isSelected = selectedCategory === item.category;
                  const isFinished = item.spent > 0 && item.remaining >= 0 && item.spent >= item.effectiveBudget * 0.9;
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => onSelectCategory && onSelectCategory(isSelected ? 'ALL' : item.category)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700 font-bold'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-2xs'
                      }`}
                    >
                      <span className="font-sans font-medium text-slate-800 dark:text-slate-200">{item.category}:</span>
                      {isFinished ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">Đã chi trả</span>
                      ) : (
                        <span className={item.remaining < 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                          Còn {formatCurrency(item.remaining)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Collapsed compact view: just 1 line summary */
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
          {dateMetrics.isPast ? (
            <div className="flex items-center gap-2">
              <span className="text-teal-800 dark:text-teal-200 font-semibold">🏁 Kết quả kỳ:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                {summary.totalRemaining >= 0
                  ? `Dư ${formatCurrency(summary.totalRemaining)}`
                  : `Bội chi ${formatCurrency(Math.abs(summary.totalRemaining))}`}
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                (Đã chi {formatCurrency(summary.totalSpent)} / {formatCurrency(summary.totalBudget)})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-teal-800 dark:text-teal-200 font-semibold">⚡ Hạn mức hôm nay:</span>
              <span className="font-black text-teal-700 dark:text-teal-300 text-sm">
                {formatCurrency(summary.safeDailyAllowance)} / ngày
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                (Còn lại {formatCurrency(summary.totalRemaining)} cho {dailyItems.length} quỹ thường nhật)
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[11px]">
            {dateMetrics.isPast ? (
              summary.totalRemaining >= 0 ? (
                <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 font-medium">
                  ✓ Hoàn thành trong ngân sách
                </span>
              ) : (
                <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/80 font-semibold">
                  ⚠️ Vượt ngân sách
                </span>
              )
            ) : summary.isPacingSafe ? (
              <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 font-medium">
                🟢 Nhịp độ an toàn
              </span>
            ) : (
              <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/80 font-semibold">
                ⚠️ Cần giảm tốc độ chi
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (Tùy chọn danh mục tính vào chi tiêu hằng ngày) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Cấu hình Danh mục Chi Tiêu Hằng Ngày
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chọn các quỹ bạn muốn chia hạn mức và tính tốc độ tiêu mỗi ngày
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checkbox list (sắp xếp theo alphabet) */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {[...items].sort((a, b) => a.category.localeCompare(b.category, 'vi')).map((item) => {
                const isChecked = tempLivingCats.includes(item.category);
                return (
                  <label
                    key={item.category}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 font-semibold'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategoryInTemp(item.category)}
                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <CategoryBadge category={item.category} />
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                      Ngân sách: {formatCurrency(item.effectiveBudget)}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={handleResetDefaultSettings}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mặc định</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng ({tempLivingCats.length} mục)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DailyLivingRunwayWidget.displayName = 'DailyLivingRunwayWidget';
```

---

### 1.5. `src/components/MonthlyReportCardModal.tsx`
Các đoạn cốt lõi đã được nâng cấp trong `src/components/MonthlyReportCardModal.tsx`:
- **Chặn chia cho 0**: Khi `totalIncome <= 0`, `healthBadgeText` và `healthDesc` hiển thị nhãn thân thiện thay vì `-Infinity%` hay `NaN`.
- **Rút gọn nhãn món chi lớn nhất**: Giới hạn bề rộng `maxWidth` và thêm `...` khi vẽ Canvas PNG tránh tràn đè lên cột tiền.
- **Bọc an toàn Clipboard**: Thêm `try / catch` quanh `navigator.clipboard.writeText`.

```typescript
// Trích đoạn xử lý chia cho 0 và healthBadgeText:
} else {
  // livingRemaining < 0
  healthStars = '⚠️';
  healthTitle = 'Chi tiêu sinh hoạt vượt thu nhập';
  healthDesc = `Chi tiêu sinh hoạt (${formatCurrency(livingExpense)}) đã vượt thu nhập ${formatCurrency(Math.abs(livingRemaining))} (chưa tính khoản tiết kiệm ${formatCurrency(savingsAmount)}). Cần rà soát cắt giảm chi tiêu tháng tới!`;
  healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  healthBadgeText = totalIncome > 0
    ? `Thâm hụt sinh hoạt: ${((Math.abs(livingRemaining) / totalIncome) * 100).toFixed(1)}%`
    : 'Thâm hụt sinh hoạt';
}
} else {
  // No savings recorded
  if (cashRemaining >= 0) {
    if (totalIncome <= 0) {
      healthStars = '⭐';
      healthTitle = 'Chưa ghi nhận thu nhập';
      healthDesc = 'Tháng này chưa phát sinh bản ghi thu nhập nào.';
      healthBadge = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      healthBadgeText = 'Chưa có thu nhập';
    } else if (cashSavingsRate >= 30) {
      // ...
    }
  } else {
    healthStars = '⚠️';
    healthTitle = 'Thâm hụt ngân sách';
    healthDesc = `Chi tiêu vượt thu nhập ${formatCurrency(Math.abs(cashRemaining))}. Cần hãm phanh chi tiêu tháng tới!`;
    healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    healthBadgeText = totalIncome > 0
      ? `Thâm hụt: -${((Math.abs(cashRemaining) / totalIncome) * 100).toFixed(1)}%`
      : 'Thâm hụt chi tiêu';
  }
}

// Trích đoạn Canvas PNG rút gọn biggestExpenseLabel bằng maxWidth:
if (biggestExpense) {
  const amtStr = formatCurrency(biggestExpense.amount);
  ctx.fillStyle = '#F43F5E';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const amtW = ctx.measureText(amtStr).width;
  ctx.fillText(amtStr, width - 54 - amtW, curY + 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  const maxLabelW = width - 54 - amtW - 20 - 54;
  let displayLabel = biggestExpenseLabel || 'Khoản chi lớn';
  if (ctx.measureText(displayLabel).width > maxLabelW) {
    while (displayLabel.length > 3 && ctx.measureText(displayLabel + '...').width > maxLabelW) {
      displayLabel = displayLabel.slice(0, -1);
    }
    displayLabel += '...';
  }
  ctx.fillText(displayLabel, 54, curY + 48);
} else {
  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Không có chi tiêu', 54, curY + 48);
}

// Trích đoạn Clipboard an toàn:
const handleCopySummary = async () => {
  try {
    const lines = [ /* ... */ ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  } catch (err) {
    console.warn('Failed to copy summary to clipboard:', err);
  }
};
```

---

### 1.6. Các Đoạn Đã Sửa Trong `src/App.tsx`

#### (a) Khởi tạo State Rollover & Quản lý Cache bằng Versioning
```typescript
const CACHE_SCHEMA_VERSION = 'hm_cache_v2';
const CACHE_VERSION_KEY = 'hm_cache_version';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (typeof window !== 'undefined' && (window as any).__initialTab) || 'dashboard');
  const [attachedRecords, setAttachedRecords] = useState<TransactionRecord[]>([]);

  // Category percentage allocation & rollover mode state
  const [rolloverMode, setRolloverMode] = useState<RolloverMode>(() => {
    try {
      const saved = localStorage.getItem(SAVED_ROLLOVER_MODE_KEY) as RolloverMode;
      if (saved && ['full', 'deficit_only', 'none'].includes(saved)) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'full';
  });

  const [customPercentages, setCustomPercentages] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORY_PERCENTAGES;
  });

  const [sheetRecords, setSheetRecords] = useState<TransactionRecord[] | null>(() => {
    try {
      // Invalidate old cache version if version changed (no hardcoded personal keywords)
      if (localStorage.getItem(CACHE_VERSION_KEY) !== CACHE_SCHEMA_VERSION) {
        localStorage.removeItem(CACHE_KEY_RECORDS);
        localStorage.removeItem(CACHE_KEY_TRANSFERS);
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_SCHEMA_VERSION);
        return null;
      }
      const cached = localStorage.getItem(CACHE_KEY_RECORDS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return null;
  });
```

#### (b) Xử lý Hoàn tiền âm trong `kpiStats` (`r.beCorp !== 0` và `r.credit !== 0`)
```typescript
    if (isAllMonthsSelected) {
      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (r.beCorp !== 0) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (r.credit !== 0) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    } else {
      // Filter by respective cycle dates across each selected month
      const beRanges = selectedMonths.map((m) => getBillingCycleRange(m, beCorpStartDay, beCorpEndDay));
      const creditRanges = selectedMonths.map((m) => getBillingCycleRange(m, creditStartDay, creditEndDay));

      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (
            r.beCorp !== 0 &&
            beRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (
            r.credit !== 0 &&
            creditRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    }
```

#### (c) `memoizedRolloverResult` và Cộng dồn Đa tháng trong `categoryKpiStats`
```typescript
  // Memoized complete multi-month rollover chain across all categories and months
  const memoizedRolloverResult = useMemo(() => {
    const isIdenticalToDefault = Object.entries(DEFAULT_CATEGORY_PERCENTAGES).every(
      ([k, v]) => Math.abs((customPercentages[k] ?? 0) - v) < 0.05
    );
    const hasCustomPercentages = !isIdenticalToDefault;

    return computeMultiMonthRollover(
      allRecords,
      budgetTransfers,
      customPercentages,
      rolloverMode,
      hasCustomPercentages
    );
  }, [allRecords, budgetTransfers, customPercentages, rolloverMode]);

  // Category-specific KPI metrics when category filter is active (single or multiple)
  const categoryKpiStats = useMemo(() => {
    if (isAllCategoriesSelected) return null;

    const targetCategories =
      selectedCategories.length > 0
        ? selectedCategories
        : selectedCategory !== 'ALL'
        ? [selectedCategory]
        : [];
    if (targetCategories.length === 0) return null;

    const rolloverResult = memoizedRolloverResult;
    const targetMonths = isAllMonthsSelected
      ? rolloverResult.allChronologicalMonths
      : selectedMonths.length > 0
      ? selectedMonths
      : [selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth];

    let totalEffectiveBudget = 0;
    let totalBaseBudget = 0;
    let totalCarryover = 0;
    let totalNetTransfer = 0;
    let totalSpent = 0;
    let totalBeCorp = 0;
    let totalCredit = 0;
    let totalCount = 0;
    let totalPercentage = 0;

    for (const cat of targetCategories) {
      // In multi-month view, carryover is taken from the initial month of the range
      const firstMonth = targetMonths[0];
      const initialCatStats = rolloverResult.chain[cat]?.[firstMonth];
      const initialCarryover = initialCatStats ? initialCatStats.carryover : 0;
      totalCarryover += initialCarryover;

      let catBaseBudget = 0;
      let catNetTransfer = 0;
      let catSpent = 0;
      let catCount = 0;
      let catPercentageSum = 0;

      for (const m of targetMonths) {
        const catStats = rolloverResult.chain[cat]?.[m];
        if (catStats) {
          catBaseBudget += catStats.baseBudget;
          catNetTransfer += catStats.netTransfer;
          catSpent += catStats.spent;
          catCount += catStats.txCount;
          catPercentageSum += catStats.percentage;
        } else {
          const mIncome = kpiStats.effectiveIncome;
          const defPct = DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0;
          catBaseBudget += Math.round((mIncome * defPct) / 100);
          catPercentageSum += defPct;
        }
      }

      // Sum beCorp and credit directly from period records for this category
      const catRecords = periodRecords.filter(
        (r) => r.category === cat && r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)
      );
      const beCorp = catRecords.reduce((s, r) => s + r.beCorp, 0);
      const credit = catRecords.reduce((s, r) => s + r.credit, 0);

      if (catCount === 0 && catRecords.length > 0) {
        catSpent = catRecords.reduce((s, r) => s + r.amount, 0);
        catCount = catRecords.length;
      }

      const catEffectiveBudget = catBaseBudget + initialCarryover + catNetTransfer;
      const catAvgPercentage = targetMonths.length > 0 ? catPercentageSum / targetMonths.length : 0;

      totalEffectiveBudget += catEffectiveBudget;
      totalBaseBudget += catBaseBudget;
      totalNetTransfer += catNetTransfer;
      totalSpent += catSpent;
      totalBeCorp += beCorp;
      totalCredit += credit;
      totalCount += catCount;
      totalPercentage += catAvgPercentage;
    }
    // ...
```

#### (d) Modal Xóa Giao Dịch Tuân Thủ Privacy Mode & ARIA
```tsx
        {/* DELETE CONFIRMATION DIALOG MODAL */}
        <AnimatePresence>
          {deletingTransaction && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setDeletingTransaction(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ... */}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Số tiền:</span>
                  <span className="font-mono-tabular font-bold text-rose-700 dark:text-rose-400">
                    {formatCurrency(deletingTransaction.amount)}
                  </span>
                </div>
```

---

### 1.7. Đoạn Đã Sửa Trong `src/utils/csvParser.ts`
Hỗ trợ định dạng ngày kiểu Việt `DD.MM.YYYY` và `new Date().getFullYear()`:

```typescript
export function parseDateString(rawDate: string): {
  isoDate: string;
  monthKey: string;
  displayDate: string;
  year: number;
  month: number;
  day: number;
} {
  const trimmed = (rawDate || '').trim();
  const currentYear = new Date().getFullYear();

  // 1. Match English Month Name (e.g. "April 2026", "October 2026", "October")
  const engMatch = trimmed.match(/^([a-zA-Z]+)(?:[\s,/-]+(\d{4}))?$/);
  if (engMatch && ENGLISH_MONTHS[engMatch[1].toLowerCase()]) {
    const m = ENGLISH_MONTHS[engMatch[1].toLowerCase()];
    const y = engMatch[2] ? parseInt(engMatch[2], 10) : currentYear;
    const mm = String(m).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `1/${m}/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 2. Match Vietnamese Month String (e.g. "T10", "T10/2026", "Tháng 10", "thang 4 2026")
  const vnMatch = trimmed.match(/^t(?:háng)?\s*(\d{1,2})(?:[\/\s-]+(\d{4}))?$/i);
  if (vnMatch) {
    const m = parseInt(vnMatch[1], 10);
    const y = vnMatch[2] ? parseInt(vnMatch[2], 10) : currentYear;
    const mm = String(Math.max(1, Math.min(12, m))).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `1/${m}/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 3. Match DD.MM.YYYY or DD.MM (Vietnamese dot notation)
  const dotParts = trimmed.split('.');
  if (dotParts.length === 3) {
    let d = parseInt(dotParts[0], 10);
    let m = parseInt(dotParts[1], 10);
    let y = parseInt(dotParts[2], 10);
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    const dd = String(Math.max(1, Math.min(31, d || 1))).padStart(2, '0');
    const yyyy = y || currentYear;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      monthKey: `${yyyy}-${mm}`,
      displayDate: `${m}/${d}/${yyyy}`,
      year: yyyy,
      month: m,
      day: d,
    };
  }

  if (dotParts.length === 2 && dotParts[0].length <= 2 && dotParts[1].length <= 2) {
    let d = parseInt(dotParts[0], 10);
    let m = parseInt(dotParts[1], 10);
    if (m > 12 && d <= 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    const dd = String(Math.max(1, Math.min(31, d || 1))).padStart(2, '0');
    return {
      isoDate: `${currentYear}-${mm}-${dd}`,
      monthKey: `${currentYear}-${mm}`,
      displayDate: `${m}/${d}/${currentYear}`,
      year: currentYear,
      month: m,
      day: d,
    };
  }
  // ...
```

---

## 2. Log Chạy Thực Tế Kiểm Thử & Biên Dịch

### 2.1. Log Thực Tế `npm run build`
```text
> react-example@0.0.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2130 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                   2.47 kB │ gzip:  1.00 kB
dist/assets/index-DgwLEFrn.css                  170.71 kB │ gzip: 23.93 kB
dist/assets/rolldown-runtime-WkwZ5CU-.js          0.59 kB │ gzip:  0.36 kB
dist/assets/firebaseAuth-B-mvgP8y.js              1.16 kB │ gzip:  0.79 kB
dist/assets/PwaInstallModal-Bj6RM7YL.js           6.21 kB │ gzip:  2.24 kB
dist/assets/AnalyticsCharts-Ck-b4VUm.js          11.16 kB │ gzip:  3.59 kB
dist/assets/EditTransactionModal-DB_ZpHCT.js     13.00 kB │ gzip:  3.52 kB
dist/assets/CalendarHeatmapView-CHaTSGXG.js      15.36 kB │ gzip:  4.28 kB
dist/assets/vendor-icons-BIrfgx3k.js             19.84 kB │ gzip:  7.20 kB
dist/assets/MoneyCalculatorInput-pOn0xUSL.js     20.98 kB │ gzip:  4.97 kB
dist/assets/MultiMonthSummaryTable-CNxuyOpK.js   21.81 kB │ gzip:  4.77 kB
dist/assets/TransactionLedgerTable-C9iDaMEX.js   22.02 kB │ gzip:  5.08 kB
dist/assets/SheetSyncPanel-GQNxhuTu.js           22.38 kB │ gzip:  5.79 kB
dist/assets/AddTransactionModal-BPDOm89i.js      26.93 kB │ gzip:  6.98 kB
dist/assets/MonthlyReportCardModal-D72rYE-F.js   30.26 kB │ gzip:  8.29 kB
dist/assets/ReconcileCheckTienView-yMoMDbsT.js   44.69 kB │ gzip:  8.03 kB
dist/assets/CategoryBudgetTable-Cwz3rK32.js      60.68 kB │ gzip: 12.64 kB
dist/assets/vendor-firebase-DtK3KEHj.js          96.47 kB │ gzip: 29.13 kB
dist/assets/vendor-animation-C378hXji.js        148.94 kB │ gzip: 49.75 kB
dist/assets/index-C6JvIYNr.js                   171.21 kB │ gzip: 45.52 kB
dist/assets/vendor-react-BemoPDKM.js            210.54 kB │ gzip: 65.70 kB

✓ built in 1.70s (Exit code: 0)
```

---

### 2.2. Log Thực Tế `npm test` (`node tests/e2e/master_runner.js`)
Hiển thị đầy đủ quá trình chạy của toàn bộ 12 test suites, bao gồm 6 test cases mới (`CH4.1.10`, `CH4.1.11`, `CH4.4.5`, `CH4.4.6`, `CH4.4.7`, `CH4.4.8`):

```text
> react-example@0.0.0 test
> node tests/e2e/master_runner.js

========================================================================================
   EXPENSE & INCOME TRACKER — MASTER E2E & ADVERSARIAL VALIDATION RUNNER (ALL TIERS)   
========================================================================================

Compiling full test suite with TypeScript (tsc -p tests/tsconfig.json)...
✓ TypeScript compilation successful (13688ms).

▶ Core E2E Suite (Tiers 1–4)
  ✓ Tier 1 - Feature 1: Ledger CRUD Operations & Query Filtering (5 tests, 36ms)
      ✓ T1.F1.1: Create expense transaction record with complete attributes (3ms)
      ✓ T1.F1.2: Filter ledger transactions by monthKey and sheetType (0ms)
      ✓ T1.F1.3: Update transaction attributes and preserve audit integrity (0ms)
      ✓ T1.F1.4: Delete transaction removes item and recalculates ledger aggregate (1ms)
      ✓ T1.F1.5: Chronological sorting orders transactions by date descending then id (32ms)
  ✓ Tier 1 - Feature 2: Google Sheet Synchronization & Row Management (5 tests, 2ms)
      ✓ T1.F2.1: Assign rowIndex to optimistic additions and shift indices on deletion (1ms)
      ✓ T1.F2.2: Expense row values array mapping formats correctly for Google Sheets API (0ms)
      ✓ T1.F2.3: Income row values mapping includes Column E (Month) for formula lookup (0ms)
      ✓ T1.F2.4: Offline transaction queue tracks pending mutations (1ms)
      ✓ T1.F2.5: Reconcile real-world account balances against ledger tracked sums (0ms)
  ✓ Tier 1 - Feature 3: Multi-Month Budget Rollover Engine (5 tests, 6ms)
      ✓ T1.F3.1: Historical era (T4-T7 2026) computes base budget with 47.5M ratios (3ms)
      ✓ T1.F3.2: Current era (T8-T10 2026) computes base budget with 51M ratios (1ms)
      ✓ T1.F3.3: Full rollover carries both surplus and deficit forward across months (2ms)
      ✓ T1.F3.4: Deficit-only rollover mode ignores positive surpluses and carries only deficits (0ms)
      ✓ T1.F3.5: None rollover mode resets carryover to 0 regardless of prior balance (0ms)
  ✓ Tier 1 - Feature 4: Daily Living Runway & Burn Rate Metrics (5 tests, 1ms)
      ✓ T1.F4.1: Isolate daily living categories from fixed & periodic categories (1ms)
      ✓ T1.F4.2: Safe daily allowance correctly computes totalRemaining / remainingDays (0ms)
      ✓ T1.F4.3: Burn rate daily computes totalSpent / elapsedDays (0ms)
      ✓ T1.F4.4: Pace differential identifies safe vs over-burn pace (0ms)
      ✓ T1.F4.5: Calendar days in month handles 30, 31, and 28/29 day counts accurately (0ms)
  ✓ Tier 1 - Feature 5: BE Corporate Billing Cycle 26–25 (5 tests, 6ms)
      ✓ T1.F5.1: Calculate standard 26–25 cycle date range for current year month (1ms)
      ✓ T1.F5.2: Year transition boundary: January cycle starts December 26 of previous year (0ms)
      ✓ T1.F5.3: Filter transactions with beCorp flag within BE cycle boundaries (4ms)
      ✓ T1.F5.4: Fallback to full calendar month when startDay <= endDay (1ms)
      ✓ T1.F5.5: Corrupted or invalid monthKey defaults safely to standard date range (0ms)
  ✓ Tier 1 - Feature 6: Credit Card Billing Cycle 20–19 (5 tests, 1ms)
      ✓ T1.F6.1: Calculate standard 20–19 cycle range for statement generation (0ms)
      ✓ T1.F6.2: Year transition boundary: January cycle starts December 20 of previous year (0ms)
      ✓ T1.F6.3: Filter transactions with credit payment within credit statement bounds (0ms)
      ✓ T1.F6.4: Credit utilization against defined limit (1ms)
      ✓ T1.F6.5: Custom statement day configuration (e.g. 15th to 14th) (0ms)
  ✓ Tier 1 - Feature 7: Dedicated Income Category Allocations (5 tests, 1ms)
      ✓ T1.F7.1: Identify dedicated income vs general shared salary income (0ms)
      ✓ T1.F7.2: Dedicated income is added 100% to target category base budget (0ms)
      ✓ T1.F7.3: Dedicated income does not inflate base budget of other categories (0ms)
      ✓ T1.F7.4: Case insensitive and whitespace trimming in dedicated income matching (1ms)
      ✓ T1.F7.5: Dedicated income rolls over to subsequent months under full rollover (0ms)
  ✓ Tier 1 - Feature 8: Money Mathematical Expressions Evaluator (5 tests, 4ms)
      ✓ T1.F8.1: Evaluate basic arithmetic expressions (+, -, *, /) (3ms)
      ✓ T1.F8.2: Vietnamese abbreviations (k, K, tr, m, M) (0ms)
      ✓ T1.F8.3: Spoken Vietnamese compound denominations (1tr5 -> 1.5M, 2tr2 -> 2.2M) (1ms)
      ✓ T1.F8.4: Combined expressions with abbreviations and operators (0ms)
      ✓ T1.F8.5: Fallback safety for plain numbers and comma formatted strings (0ms)
  ✓ Tier 1 - Feature 9: Financial Privacy Masking Engine (5 tests, 27ms)
      ✓ T1.F9.1: Privacy mode defaults to enabled on startup (0ms)
      ✓ T1.F9.2: formatCurrency masks numbers when privacy mode is active (1ms)
      ✓ T1.F9.3: formatCurrency unmasks real values when privacy mode is disabled (0ms)
      ✓ T1.F9.4: formatCurrency forceVisible bypasses privacy masking (1ms)
      ✓ T1.F9.5: Privacy mode state persists across page reload in localStorage (25ms)

▶ Tier 2: Boundary & Corner Cases (6 categories, 30 tests, 7ms)
  ✓ Category A: Date Transitions & Leap Years (5 tests)
  ✓ Category B: Zero, Extreme & Floating Currency Values (5 tests)
  ✓ Category C: String Normalization & Encoding (5 tests)
  ✓ Category D: Data Integrity & Schema Tolerances (5 tests)
  ✓ Category E: Sync Concurrency & Idempotency (5 tests)
  ✓ Category F: Local Storage & Offline Persistence (5 tests)

▶ Tier 3: Cross-Feature Combinations (Pairwise) (15 tests, 3ms)
  ✓ T3.1: Rollover + Dedicated Income + Budget Transfers (5 tests)
  ✓ T3.2: BE Corp Cycle + Credit Card Cycle Overlap (5 tests)
  ✓ T3.3: Privacy Mode + CSV Parser Formatting (5 tests)

▶ Tier 4: Real-World Scenarios & Living Workloads (5 tests, 2ms)
  ✓ T4.1: Normal living month lifecycle (salary, daily expenses, savings transfer)
  ✓ T4.2: High expense month with mid-month deficit budget transfer
  ✓ T4.3: End-of-year bonus allocation across living categories
  ✓ T4.4: Business expense fronting via BE Corp with next-cycle reimbursement
  ✓ T4.5: Emergency medical spending with credit card installment plan

▶ Milestone 2: Performance, Caching & Memoization (7 tests, 18ms)
  ✓ M2.1: computeNormalizedMonthMap O(1) performance vs linear scanning
  ✓ M2.2: Memoized rollover execution under 100ms for 5-year history
  ✓ M2.3: Ledger filtering across 10,000 transactions runs under 16ms
  ✓ M2.4: Virtual list scroll benchmark (1,000 rows render smoothly)
  ✓ M2.5: Search debounce and autocomplete suggestion lookup latency
  ✓ M2.6: LocalStorage write throttling and deduplication
  ✓ M2.7: Heap memory footprint stability during continuous tab switching

▶ Milestone 3: Theme Tokens, Contrast & Mobile Safe Area (16 tests, 107ms)
  ✓ M3.1: Kinlo Light Mode WCAG 2.1 AA Contrast Ratios (5 tests)
  ✓ M3.2: Kinlo Dark Mode WCAG 2.1 AA Contrast Ratios (5 tests)
  ✓ M3.3: Mobile Safe-Area Inset & Touch Target Compliance (6 tests)

▶ Challenger Suite: Visual Stress & Viewport Accessibility (28 tests, 176ms)
  ✓ CH-Visual: Challenger Theme & Visual Stress Suite (11 tests, 109ms)
  ✓ CH-Viewport: Challenger Viewport & Accessibility Suite (17 tests, 67ms)

▶ Challenger M1: Accounting & Runway Verification (14 tests, 11ms)
  ✓ CH1.1: 5-month cascading carryover validation (5 tests)
  ✓ CH1.2: Dedicated income base budget isolation (4 tests)
  ✓ CH1.3: Runway burn rate calculations & day-count boundaries (5 tests)

▶ Challenger Stress: Date Boundary Fuzzing & Rollover Stress (19 tests, 357ms)
  ✓ CH2.1: 365-day leap year fuzzing across billing cycles (7 tests)
  ✓ CH2.2: Extreme rollover multi-category stress test (6 tests)
  ✓ CH2.3: Fuzzing currency inputs & mathematical expressions (6 tests)

▶ Challenger M4 Stress: 60-Month & Row Realignment (12 tests, 26ms)
  ✓ CH4-S1: 60-Month (5 Year) Continuous Simulation (6 tests)
  ✓ CH4-S2: Multi-Client Row Realignment Stress Test (6 tests)

▶ Challenger M4 Adversarial: Boundary & Logic Matrix (33 tests, 23ms)
  ✓ CH4.1: Vietnamese Money Parser Expressions & Abbreviations Adversarial Tests (11 tests)
      ✓ CH4.1.1: Standard Vietnamese abbreviations (k, K, tr, m, M) evaluate accurately
      ✓ CH4.1.2: Spoken Vietnamese compound denominations (1tr5 -> 1.5M, 2tr2 -> 2.2M, 3tr25 -> 3.25M)
      ✓ CH4.1.3: Decimal and comma formatted abbreviation values (1.5tr, 2,5tr, 50.5k, 50,5k)
      ✓ CH4.1.4: Multi-operator arithmetic with abbreviations and parentheses precedence
      ✓ CH4.1.5: Division by zero returns null without throwing or producing Infinity
      ✓ CH4.1.6: Boundary finding: Spoken "1k5" compound abbreviation behavior documentation
      ✓ CH4.1.7: Boundary finding: Full text "nghin" / "ngan" boundary behavior documentation
      ✓ CH4.1.8: Boundary finding: Billion units "ty" / "tỷ" behavior documentation
      ✓ CH4.1.9: Malformed arithmetic and dangerous script injection resistance
      ✓ CH4.1.10: Pure Shunting-Yard arithmetic: unary negative, dot thousand separators, precedence and zero division (1ms)
      ✓ CH4.1.11: Auto-thousands evaluation mode with unit preservation and thousand separators (1ms)
  ✓ CH4.2: Large-Scale Cascading Budget Rollover & Conservation Verification (4 tests)
      ✓ CH4.2.1: 12-month full rollover cascading carryover balance conservation check
      ✓ CH4.2.2: Intra-month budget transfers across all 13 categories preserves conservation
      ✓ CH4.2.3: Multi-month cascading carryovers with multi-billion VND balances retain exact math
      ✓ CH4.2.4: Safe integer limits: IEEE 754 precision boundary verification up to Number.MAX_SAFE_INTEGER
  ✓ CH4.3: 0% Budget Allocations, Over-Allocation & Asymmetric Distributions (4 tests)
      ✓ CH4.3.1: Complete 0% allocation across all categories produces 0 base budgets
      ✓ CH4.3.2: Spending under 0% budget immediately triggers isOver = true and capped pctUsed = 999
      ✓ CH4.3.3: 100% single-category concentration: 1 category receives 100%, other 12 receive 0%
      ✓ CH4.3.4: Over-allocated percentages (sum > 100%) calculate without numerical breakdown
  ✓ CH4.4: Negative Refunds & Credit Offsets Across Engines (8 tests)
      ✓ CH4.4.1: Net negative spending in expense category carries surplus into next month under full rollover
      ✓ CH4.4.2: Deficit-only rollover clamps negative spending surplus carryover to 0
      ✓ CH4.4.3: BE Corp 26–25 cycle offsets refunds across month boundaries
      ✓ CH4.4.4: Credit Card 20–19 cycle offsets returns across statement boundaries
      ✓ CH4.4.5: Negative refunds in kpiStats calculation properly offset cycle totals (beCorp !== 0 and credit !== 0) (1ms)
      ✓ CH4.4.6: Zero income edge case (totalIncome <= 0) produces valid health badge without -Infinity% or NaN (0ms)
      ✓ CH4.4.7: parseDateString supports Vietnamese dot format (DD.MM.YYYY) and current year fallback (0ms)
      ✓ CH4.4.8: BUDGET_ERAS configuration correctly partitions eras by effectiveFrom (0ms)
  ✓ CH4.5: Mobile Responsive Viewports, Touch Ergonomics & Keyboard Operability (4 tests)
      ✓ CH4.5.1: Viewport width bounds (320px to 768px) and horizontal overflow safety audit
      ✓ CH4.5.2: Bottom navigation touch ergonomics and safe-area inset compliance
      ✓ CH4.5.3: WAI-ARIA and Keyboard Accessibility Across All Dialog Modals
      ✓ CH4.5.4: Action buttons in table rows and primary actions meet touch ergonomics and accessibility standards
  ✓ CH4.6: Feature Inventory & Tier 1–5 Completeness Traceability Matrix (2 tests)
      ✓ CH4.6.1: Verify 100% of the 26 features cataloged in PROJECT.md have test coverage
      ✓ CH4.6.2: Verify no deprecated or phantom dependencies exist in package.json

========================================================================================
   MASTER E2E & ADVERSARIAL VALIDATION SUMMARY TABLE   
========================================================================================
| Suite / Tier | Category / Scope                         | Total | Pass | Fail | Pass Rate | Time   | Status |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| Tier 1       | Feature Coverage (>=5 per feature)       |    45 |   45 |    0 |    100.0% |   86ms | PASS   |
| Tier 2       | Boundary & Corner Cases (>=5 per cate... |    30 |   30 |    0 |    100.0% |    7ms | PASS   |
| Tier 3       | Cross-Feature Combinations (Pairwise)    |    15 |   15 |    0 |    100.0% |    3ms | PASS   |
| Tier 4       | Real-World Living Scenarios (Workloads)  |     5 |    5 |    0 |    100.0% |    2ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| M2-Perf      | Performance, Caching & Memoization       |     7 |    7 |    0 |    100.0% |   18ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| M3-UIUX      | Theme Tokens, Contrast, Mobile Safe A... |    16 |   16 |    0 |    100.0% |  107ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| CH-Visual    | Challenger Theme & Visual Stress Suite   |    11 |   11 |    0 |    100.0% |  109ms | PASS   |
| CH-Viewport  | Challenger Viewport & Accessibility S... |    17 |   17 |    0 |    100.0% |   67ms | PASS   |
| CH-M1-Acct   | Challenger M1 Accounting & Runway Ver... |    14 |   14 |    0 |    100.0% |   11ms | PASS   |
| CH-Stress    | Challenger Date Boundary Fuzzing & Ro... |    19 |   19 |    0 |  357ms | PASS   |
| CH-M4-Stress | Challenger M4 60-Month & Row Realignm... |    12 |   12 |    0 |    26ms | PASS   |
| CH-M4-Adv    | Challenger M4 Boundary & Adversarial ... |    33 |   33 |    0 |    23ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|

Total Test Suites: 12 files across 4 milestone tracks
Total Test Cases:  224
Passed:            224
Failed:            0
Pass Rate:          100.0%
Total Execution:   15028 ms
Final Gate Result: ALL PASSED (100%)
```

---

## 3. Tổng Kết Nghiệm Thu Kỹ Thuật

| Hạng mục kiểm tra | Tiêu chí kỹ thuật | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :---: |
| **Shunting-Yard Pure Evaluator** | Loại bỏ hoàn toàn `new Function(...)` & `eval`, hỗ trợ `+ - * / ( )`, unary `-`, dấu chấm hàng nghìn, chia cho 0 trả về `null` | Thuật toán Shunting-Yard thuần kiểm thử đầy đủ qua `CH4.1.10` | **ĐẠT (100%)** |
| **Auto-Thousands Unit System** | Mặc định `autoThousands = true`, hậu tố `,000 ₫`, nút `×1k`, conciseness hiển thị, chặn số âm | `computeEffectiveMoneyValue` & `MoneyCalculatorInput.tsx` kiểm thử qua `CH4.1.11` | **ĐẠT (100%)** |
| **Accounting Cycle Refunds** | Điều kiện `!== 0` bù trừ đúng cho hoàn tiền âm chu kỳ BE Corp và sao kê Thẻ | Đã vá trong `App.tsx` và kiểm thử qua `CH4.4.5` | **ĐẠT (100%)** |
| **Safe Health Badge & Division-by-Zero** | `totalIncome <= 0` không sinh `-Infinity%` hay `NaN%` | Đã vá trong `MonthlyReportCardModal.tsx` và kiểm thử qua `CH4.4.6` | **ĐẠT (100%)** |
| **Canvas PNG Text Overflow** | Cắt rút gọn nhãn `biggestExpenseLabel` bằng `maxWidth` kèm `...` | Đã đo `ctx.measureText` và cắt chuỗi an toàn | **ĐẠT (100%)** |
| **Daily Runway Collapsed View** | Xử lý đúng `dateMetrics.isPast` khi tháng đã qua, không báo `0 ₫ / ngày` sai | Đã bổ sung nhánh hiển thị kết quả kỳ đã chốt và Dark Mode | **ĐẠT (100%)** |
| **Vietnamese Date & Budget Eras** | Hỗ trợ `DD.MM.YYYY`, `new Date().getFullYear()`, mảng kỷ nguyên `BUDGET_ERAS` | Kiểm thử qua `CH4.4.7` và `CH4.4.8` | **ĐẠT (100%)** |
| **Bảo Mật & Riêng Tư (Secrets & Redaction)** | Tự động che (redact) Sheet ID, Apps Script URL, Token, Key | Đã rà soát và che [REDACTED] 100% | **ĐẠT (100%)** |
| **Toàn bộ Test Suite** | 12 test files across 4 milestone tracks | 224/224 tests PASS (100%) | **ĐẠT (100%)** |
| **Production Build** | `tsc --noEmit && vite build` | Built in 1.70s, 0 lỗi TypeScript | **ĐẠT (100%)** |

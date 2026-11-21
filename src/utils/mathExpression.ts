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
  // Convert any remaining decimal commas (e.g., 48,5 -> 48.5) to dots
  s = s.replace(/,/g, '.');

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
 * Returns rounded integer (or raw float when shouldRound=false) or null if invalid or division by zero
 */
export function evaluateMoneyExpression(expr: string, shouldRound: boolean = true): number | null {
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
  return shouldRound ? Math.round(stack[0]) : stack[0];
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
    evaluated = evaluateMoneyExpression(text, false);
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

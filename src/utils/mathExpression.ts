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

interface ScaleToken {
  type: 'num' | 'op';
  value?: number;
  hasScale?: boolean;
  op?: string;
}

/**
 * Tokenizes an expression preserving whether each numeric literal already carried
 * an explicit currency unit (k/tr/m) or thousand separator (100.000 / 100,000),
 * so mixed x1k expressions like "50k + 20" (= 70,000) and "50k * 2" (= 100,000)
 * evaluate accurately without scaling scalar multipliers/divisors.
 */
function tokenizeScaleAware(raw: string): ScaleToken[] | null {
  let s = raw.trim().replace(/[+\-*/xX×÷:\s]+$/, '');
  if (!s) return null;

  // Normalize multiplication / division symbols
  s = s.replace(/[xX×]/g, '*').replace(/[÷:]/g, '/');

  const tokens: ScaleToken[] = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')') {
      tokens.push({ type: 'op', op: c });
      i++;
      continue;
    }

    if (/\d/.test(c) || c === '.') {
      const rest = s.slice(i);

      // 1. Spoken Vietnamese million format: e.g. 1tr5, 2tr25, 1m5
      const spokenMatch = rest.match(/^(\d+)\s*(tr|trieu|triệu|m)\s*(\d+)\b/i);
      if (spokenMatch) {
        const val = parseFloat(`${spokenMatch[1]}.${spokenMatch[3]}`) * 1000000;
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val, hasScale: true });
        i += spokenMatch[0].length;
        continue;
      }

      // 2. Explicit million unit: e.g. 1.5tr, 1,5tr, 2m, 2trieu
      const milMatch = rest.match(/^(\d+(?:[.,]\d+)?)\s*(tr|trieu|triệu|m)\b/i);
      if (milMatch) {
        const val = parseFloat(milMatch[1].replace(',', '.')) * 1000000;
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val, hasScale: true });
        i += milMatch[0].length;
        continue;
      }

      // 3. Explicit thousand unit: e.g. 50k, 50.5k, 50,5k, 50nghin
      const kMatch = rest.match(/^(\d+(?:[.,]\d+)?)\s*(k|nghin|nghìn|ngan|ngàn)\b/i);
      if (kMatch) {
        const val = parseFloat(kMatch[1].replace(',', '.')) * 1000;
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val, hasScale: true });
        i += kMatch[0].length;
        continue;
      }

      // 4. Number with thousand separators (e.g. 100.000, 1,250,550, 100,000.5)
      const sepMatch = rest.match(/^(\d{1,3}(?:([.,])\d{3})+(?:[.,]\d+)?)/);
      if (sepMatch) {
        const rawNum = sepMatch[1];
        const sep = sepMatch[2];
        let normalized = rawNum;
        if (sep === '.') {
          normalized = normalized
            .replace(/(?<=\d)\.(?=\d{3}(?:\.|,|$))/g, '')
            .replace(/,/g, '.');
        } else {
          normalized = normalized.replace(/(?<=\d),(?=\d{3}(?:,|\.|$))/g, '');
        }
        const val = parseFloat(normalized);
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val, hasScale: true });
        i += sepMatch[0].length;
        continue;
      }

      // 5. Plain number (with optional decimal dot or comma, e.g. 20, 48.5, 48,5)
      const plainMatch = rest.match(/^(\d+(?:[.,]\d+)?|\.\d+)/);
      if (plainMatch) {
        const val = parseFloat(plainMatch[1].replace(',', '.'));
        if (!Number.isFinite(val)) return null;
        tokens.push({ type: 'num', value: val, hasScale: false });
        i += plainMatch[0].length;
        continue;
      }

      return null;
    }

    return null;
  }

  return tokens;
}

/**
 * Evaluates a mixed expression under autoThousands (x1k) mode.
 * Plain additive terms mixed with explicit-unit or thousand-separated terms
 * (e.g., "50k + 20" or "100.000 + 50") are scaled by 1,000, whereas scalar
 * multipliers/divisors (e.g., "50k * 2", "2 * 50k", "100k / 2") remain unscaled.
 */
function evaluateMixedAutoThousands(raw: string): number | null {
  const tokens = tokenizeScaleAware(raw);
  if (!tokens || tokens.length === 0) return null;

  type ScaleNode = { value: number; hasScale: boolean };
  let pos = 0;

  const parsePrimary = (): ScaleNode | null => {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos];
    if (tok.type === 'num') {
      pos++;
      return { value: tok.value!, hasScale: !!tok.hasScale };
    }
    if (tok.type === 'op' && tok.op === '(') {
      pos++;
      const inner: ScaleNode | null = parseExpr();
      if (!inner) return null;
      if (pos >= tokens.length || tokens[pos].type !== 'op' || tokens[pos].op !== ')') {
        return null;
      }
      pos++;
      return inner;
    }
    return null;
  };

  const parseUnary = (): ScaleNode | null => {
    if (pos < tokens.length && tokens[pos].type === 'op' && tokens[pos].op === '-') {
      pos++;
      const inner: ScaleNode | null = parseUnary();
      if (!inner) return null;
      return { value: -inner.value, hasScale: inner.hasScale };
    }
    if (pos < tokens.length && tokens[pos].type === 'op' && tokens[pos].op === '+') {
      pos++;
      return parseUnary();
    }
    return parsePrimary();
  };

  const parseTerm = (): ScaleNode | null => {
    let left: ScaleNode | null = parseUnary();
    if (!left) return null;

    while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].op === '*' || tokens[pos].op === '/')) {
      const op = tokens[pos].op!;
      pos++;
      const right: ScaleNode | null = parseUnary();
      if (!right) return null;

      if (op === '/') {
        if (right.value === 0) return null;
        left = {
          value: left.value / right.value,
          hasScale: left.hasScale || right.hasScale,
        };
      } else {
        left = {
          value: left.value * right.value,
          hasScale: left.hasScale || right.hasScale,
        };
      }
    }

    return left;
  };

  const parseExpr = (): ScaleNode | null => {
    let left: ScaleNode | null = parseTerm();
    if (!left) return null;

    while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].op === '+' || tokens[pos].op === '-')) {
      const op = tokens[pos].op!;
      pos++;
      const right: ScaleNode | null = parseTerm();
      if (!right) return null;

      let lv: number = left.value;
      let rv: number = right.value;
      const scaled: boolean = left.hasScale || right.hasScale;
      if (left.hasScale && !right.hasScale) {
        rv *= 1000;
      } else if (!left.hasScale && right.hasScale) {
        lv *= 1000;
      }
      left = {
        value: op === '+' ? lv + rv : lv - rv,
        hasScale: scaled,
      };
    }

    return left;
  };

  const result = parseExpr();
  if (!result || pos !== tokens.length || !Number.isFinite(result.value)) return null;

  return result.hasScale ? result.value : result.value * 1000;
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

  const hasUnit = hasExplicitUnit(text);
  const hasSeparators = hasThousandSeparator(text);

  let evaluated: number | null = null;
  let alreadyScaled = false;

  if (isExpression(text)) {
    if (isAutoThousands && (hasUnit || hasSeparators)) {
      evaluated = evaluateMixedAutoThousands(text);
      if (evaluated !== null) {
        alreadyScaled = true;
      }
    }
    if (evaluated === null) {
      evaluated = evaluateMoneyExpression(text, false);
    }
  } else {
    // Non-expression numeric entry: strip thousand separators BEFORE parseFloat
    // so "100,000" -> 100000 and "1,250,550" -> 1250550 instead of 100 / 1.25
    let normalized = text;
    if (hasSeparators) {
      normalized = normalized
        .replace(/(?<=\d)\.(?=\d{3}(?:\.|,|\b))/g, '')
        .replace(/(?<=\d),(?=\d{3}(?:,|\.|\b))/g, '')
        .replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '.');
    }

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

  // If autoThousands is ON and user did not specify explicit units or thousand separators:
  if (!alreadyScaled && isAutoThousands && !hasUnit && !hasSeparators) {
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

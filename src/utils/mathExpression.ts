/**
 * Safe Mathematical Expression Evaluator for Money Inputs
 * Supports Vietnamese money abbreviations (k, K, tr, m, M)
 * and basic arithmetic (+, -, *, /)
 */

export function isExpression(input: string): boolean {
  if (!input) return false;
  return /[+\-*/xX×÷:kmtrKMTR]/.test(input);
}

export function evaluateMoneyExpression(expr: string): number | null {
  if (!expr || typeof expr !== 'string') return null;
  let s = expr.trim();
  if (!s) return null;

  // If already just a plain or comma-formatted number, parse it
  if (!isExpression(s)) {
    const cleanDigits = s.replace(/[^0-9-]/g, '');
    if (!cleanDigits || cleanDigits === '-') return null;
    const n = parseInt(cleanDigits, 10);
    return Number.isFinite(n) ? n : null;
  }

  // Pre-process Vietnamese currency abbreviations:
  // 1. Million (tr, trieu, m) e.g., '1.5tr', '1,5tr', '2tr', '2m'
  s = s.replace(/(\d+),(\d+)\s*(tr|trieu|m)\b/gi, '$1.$2*1000000');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(tr|trieu|m)\b/gi, '($1*1000000)');

  // 2. Thousand (k, K, nghin, ngan) e.g., '50k', '50.5k', '50,5k'
  s = s.replace(/(\d+),(\d+)\s*(k|nghin|ngan)\b/gi, '$1.$2*1000');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(k|nghin|ngan)\b/gi, '($1*1000)');

  // 3. Remove thousand separator commas (e.g., 50,000 -> 50000)
  s = s.replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/,/g, '');

  // 4. Normalize multiplication and division symbols
  s = s.replace(/[xX×]/g, '*');
  s = s.replace(/[÷:]/g, '/');

  // 5. Validate that only safe mathematical tokens remain
  if (!/^[\d\s+\-*/().]+$/.test(s)) {
    return null;
  }

  try {
    // Restricted scope Function evaluation
    const fn = new Function(`'use strict'; return (${s});`);
    const res = fn();
    if (typeof res === 'number' && Number.isFinite(res)) {
      return Math.round(res);
    }
  } catch {
    return null;
  }
  return null;
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

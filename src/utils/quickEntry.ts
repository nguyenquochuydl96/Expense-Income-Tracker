import { TransactionRecord } from '../types/finance';

export interface CategoryStats {
  category: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  lastUsed: string; // ISO date
}

export interface QuickAmountOption {
  label: string;
  amount: number;
}

/**
 * Phân tích lịch sử giao dịch để đưa ra Top 6 danh mục hay dùng nhất (Expenses only)
 */
export function getTopCategories(
  records: TransactionRecord[],
  limit: number = 6
): CategoryStats[] {
  const expenseRecords = records.filter(
    (r) => r.sheetType === 'Expenses' && r.amount > 0
  );

  const categoryMap = new Map<string, CategoryStats>();

  expenseRecords.forEach((rec) => {
    const existing = categoryMap.get(rec.category);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += rec.amount;
      existing.avgAmount = existing.totalAmount / existing.count;
      // Update lastUsed if this record is newer
      if (rec.isoDate > existing.lastUsed) {
        existing.lastUsed = rec.isoDate;
      }
    } else {
      categoryMap.set(rec.category, {
        category: rec.category,
        count: 1,
        totalAmount: rec.amount,
        avgAmount: rec.amount,
        lastUsed: rec.isoDate,
      });
    }
  });

  // Sort by count DESC, then by lastUsed DESC
  return Array.from(categoryMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastUsed.localeCompare(a.lastUsed);
    })
    .slice(0, limit);
}

/**
 * Gợi ý số tiền điển hình cho một danh mục cụ thể (dựa trên lịch sử gần đây)
 */
export function getSuggestedAmountsForCategory(
  records: TransactionRecord[],
  category: string,
  limit: number = 4
): QuickAmountOption[] {
  const categoryRecords = records
    .filter(
      (r) =>
        r.sheetType === 'Expenses' &&
        r.category === category &&
        r.amount > 0
    )
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate)) // newest first
    .slice(0, 20); // Last 20 transactions

  if (categoryRecords.length === 0) return [];

  // Calculate common amounts (rounded to nearest 5k)
  const amountFrequency = new Map<number, number>();
  categoryRecords.forEach((rec) => {
    const rounded = Math.round(rec.amount / 5000) * 5000;
    amountFrequency.set(rounded, (amountFrequency.get(rounded) || 0) + 1);
  });

  // Sort by frequency DESC
  const sorted = Array.from(amountFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sorted.map(([amount, count]) => ({
    label: count > 1 ? `${amount / 1000}k (${count}x)` : `${amount / 1000}k`,
    amount,
  }));
}

/**
 * Làm tròn số tiền về bội số 5k hoặc 10k (để dễ nhìn)
 */
export function roundToNearestNice(amount: number): number {
  if (amount >= 100000) {
    return Math.round(amount / 10000) * 10000; // 10k increments
  }
  return Math.round(amount / 5000) * 5000; // 5k increments
}

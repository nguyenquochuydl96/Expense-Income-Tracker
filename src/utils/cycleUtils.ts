/**
 * Utilities for calculating billing cycles for BE Corp and Credit Card statements
 */

export interface CycleRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  displayLabel: string; // e.g. "26/09 – 25/10"
}

/**
 * Calculates date range for a cycle given a monthKey (YYYY-MM) and start/end days
 * Example: for '2026-10', startDay=26, endDay=25:
 * Start: 2026-09-26, End: 2026-10-25
 */
export function getBillingCycleRange(
  monthKey: string,
  startDay: number = 26,
  endDay: number = 25
): CycleRange {
  if (!monthKey || !monthKey.includes('-')) {
    return {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      displayLabel: '01/10 – 31/10',
    };
  }

  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // If startDay <= endDay, it's within the same month (e.g. 1st to end of month)
  if (startDay <= endDay) {
    const sD = String(Math.max(1, Math.min(31, startDay))).padStart(2, '0');
    const eD = String(Math.max(1, Math.min(31, endDay))).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return {
      startDate: `${year}-${mm}-${sD}`,
      endDate: `${year}-${mm}-${eD}`,
      displayLabel: `${sD}/${mm} – ${eD}/${mm}`,
    };
  }

  // startDay > endDay: starts in previous month, ends in current month
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const sD = String(Math.max(1, Math.min(31, startDay))).padStart(2, '0');
  const eD = String(Math.max(1, Math.min(31, endDay))).padStart(2, '0');
  const pMm = String(prevMonth).padStart(2, '0');
  const cMm = String(month).padStart(2, '0');

  return {
    startDate: `${prevYear}-${pMm}-${sD}`,
    endDate: `${year}-${cMm}-${eD}`,
    displayLabel: `${sD}/${pMm} – ${eD}/${cMm}`,
  };
}

/**
 * Filter records by ISO date range
 */
export function filterRecordsByDateRange<T extends { isoDate: string }>(
  records: T[],
  startDate: string,
  endDate: string
): T[] {
  return records.filter((r) => r.isoDate >= startDate && r.isoDate <= endDate);
}

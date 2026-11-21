import { describe, test, expect } from './testHarness';
import { TransactionRecord } from '../../src/types/finance';
import {
  getBillingCycleRange,
  filterRecordsByDateRange,
  isBudgetTransferRecord,
} from '../../src/utils/cycleUtils';
import {
  parseSheetNumber,
  formatNumberForSheet,
  parseDateString,
} from '../../src/utils/csvParser';

// ============================================================================
// SUITE 1: DATE BOUNDARY FUZZING & BILLING CYCLE ENGINE IN cycleUtils.ts
// ============================================================================
describe('Challenger M1 - Suite 1: Date Boundary Fuzzing & Billing Cycle Engine', () => {
  // Helper to verify if an ISO date string is a real calendar date
  function isValidCalendarDate(isoStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return false;
    const [y, m, d] = isoStr.split('-').map((v) => parseInt(v, 10));
    const dateObj = new Date(y, m - 1, d);
    return (
      dateObj.getFullYear() === y &&
      dateObj.getMonth() + 1 === m &&
      dateObj.getDate() === d
    );
  }

  test('CH1.1: Leap year February edge cases (2024, 2028, 2032, 2000, 2096)', () => {
    const leapYears = [2024, 2028, 2032, 2000, 2096];

    for (const year of leapYears) {
      // 1. February current month with endDay clamped to 29
      const febFull = getBillingCycleRange(`${year}-02`, 1, 31);
      expect(febFull.startDate).toBe(`${year}-02-01`);
      expect(febFull.endDate).toBe(`${year}-02-29`);
      expect(isValidCalendarDate(febFull.endDate)).toBe(true);

      // 2. February start on 29th
      const feb29 = getBillingCycleRange(`${year}-02`, 29, 29);
      expect(feb29.startDate).toBe(`${year}-02-29`);
      expect(feb29.endDate).toBe(`${year}-02-29`);
      expect(isValidCalendarDate(feb29.startDate)).toBe(true);

      // 3. March cycle starting in February (startDay=30 clamped to 29)
      const marchFromFeb30 = getBillingCycleRange(`${year}-03`, 30, 25);
      expect(marchFromFeb30.startDate).toBe(`${year}-02-29`);
      expect(marchFromFeb30.endDate).toBe(`${year}-03-25`);
      expect(isValidCalendarDate(marchFromFeb30.startDate)).toBe(true);

      // 4. March cycle starting in February (startDay=31 clamped to 29)
      const marchFromFeb31 = getBillingCycleRange(`${year}-03`, 31, 25);
      expect(marchFromFeb31.startDate).toBe(`${year}-02-29`);
      expect(marchFromFeb31.endDate).toBe(`${year}-03-25`);
      expect(isValidCalendarDate(marchFromFeb31.startDate)).toBe(true);
    }
  });

  test('CH1.2: Non-leap year February edge cases (2023, 2025, 2026, 2027, 2100)', () => {
    const nonLeapYears = [2023, 2025, 2026, 2027, 2100];

    for (const year of nonLeapYears) {
      // 1. February current month with endDay=29, 30, 31 must clamp to 28
      const feb31 = getBillingCycleRange(`${year}-02`, 1, 31);
      expect(feb31.startDate).toBe(`${year}-02-01`);
      expect(feb31.endDate).toBe(`${year}-02-28`);
      expect(isValidCalendarDate(feb31.endDate)).toBe(true);

      const feb29 = getBillingCycleRange(`${year}-02`, 29, 31);
      expect(feb29.startDate).toBe(`${year}-02-28`);
      expect(feb29.endDate).toBe(`${year}-02-28`);
      expect(isValidCalendarDate(feb29.startDate)).toBe(true);

      // 2. March cycle starting in February: startDay=29, 30, 31 must clamp to 28
      const marchFromFeb29 = getBillingCycleRange(`${year}-03`, 29, 25);
      expect(marchFromFeb29.startDate).toBe(`${year}-02-28`);
      expect(marchFromFeb29.endDate).toBe(`${year}-03-25`);
      expect(isValidCalendarDate(marchFromFeb29.startDate)).toBe(true);

      const marchFromFeb31 = getBillingCycleRange(`${year}-03`, 31, 25);
      expect(marchFromFeb31.startDate).toBe(`${year}-02-28`);
      expect(marchFromFeb31.endDate).toBe(`${year}-03-25`);
      expect(isValidCalendarDate(marchFromFeb31.startDate)).toBe(true);

      // 3. Absolute negative check: ensure NO 02-29 or 02-31 ever produced
      expect(feb31.endDate.endsWith('-02-29')).toBe(false);
      expect(feb31.endDate.endsWith('-02-31')).toBe(false);
      expect(marchFromFeb31.startDate.endsWith('-02-29')).toBe(false);
      expect(marchFromFeb31.startDate.endsWith('-02-31')).toBe(false);
    }
  });

  test('CH1.3: 30-Day months clamping (April, June, September, November)', () => {
    const thirtyDayMonths = [
      { month: '04', name: 'April' },
      { month: '06', name: 'June' },
      { month: '09', name: 'September' },
      { month: '11', name: 'November' },
    ];

    for (const { month } of thirtyDayMonths) {
      // 1. Current month with endDay=31 must clamp to 30
      const range = getBillingCycleRange(`2026-${month}`, 1, 31);
      expect(range.startDate).toBe(`2026-${month}-01`);
      expect(range.endDate).toBe(`2026-${month}-30`);
      expect(isValidCalendarDate(range.endDate)).toBe(true);
      expect(range.endDate.endsWith('-31')).toBe(false);

      // 2. startDay=31 in 30-day month clamps to 30
      const rangeSame = getBillingCycleRange(`2026-${month}`, 31, 31);
      expect(rangeSame.startDate).toBe(`2026-${month}-30`);
      expect(rangeSame.endDate).toBe(`2026-${month}-30`);
      expect(isValidCalendarDate(rangeSame.startDate)).toBe(true);
    }

    // 3. Subsequent months drawing from 30-day previous months
    // May drawing from April (30 days):
    const mayRange = getBillingCycleRange('2026-05', 31, 25);
    expect(mayRange.startDate).toBe('2026-04-30');
    expect(mayRange.endDate).toBe('2026-05-25');
    expect(isValidCalendarDate(mayRange.startDate)).toBe(true);

    // July drawing from June (30 days):
    const julRange = getBillingCycleRange('2026-07', 31, 25);
    expect(julRange.startDate).toBe('2026-06-30');
    expect(julRange.endDate).toBe('2026-07-25');
    expect(isValidCalendarDate(julRange.startDate)).toBe(true);

    // October drawing from September (30 days):
    const octRange = getBillingCycleRange('2026-10', 31, 25);
    expect(octRange.startDate).toBe('2026-09-30');
    expect(octRange.endDate).toBe('2026-10-25');
    expect(isValidCalendarDate(octRange.startDate)).toBe(true);

    // December drawing from November (30 days):
    const decRange = getBillingCycleRange('2026-12', 31, 25);
    expect(decRange.startDate).toBe('2026-11-30');
    expect(decRange.endDate).toBe('2026-12-25');
    expect(isValidCalendarDate(decRange.startDate)).toBe(true);
  });

  test('CH1.4: Year-end transition rolls and millennium/century boundaries', () => {
    // 1. Standard BE Corp cycle across year boundary
    const janBE = getBillingCycleRange('2026-01', 26, 25);
    expect(janBE.startDate).toBe('2025-12-26');
    expect(janBE.endDate).toBe('2026-01-25');
    expect(janBE.displayLabel).toBe('26/12 – 25/01');
    expect(isValidCalendarDate(janBE.startDate)).toBe(true);
    expect(isValidCalendarDate(janBE.endDate)).toBe(true);

    // 2. Standard Credit Card cycle across year boundary
    const janCredit = getBillingCycleRange('2026-01', 20, 19);
    expect(janCredit.startDate).toBe('2025-12-20');
    expect(janCredit.endDate).toBe('2026-01-19');
    expect(janCredit.displayLabel).toBe('20/12 – 19/01');

    // 3. Extreme single-day cross-year (Dec 31 to Jan 01)
    const janTurn = getBillingCycleRange('2026-01', 31, 1);
    expect(janTurn.startDate).toBe('2025-12-31');
    expect(janTurn.endDate).toBe('2026-01-01');
    expect(janTurn.displayLabel).toBe('31/12 – 01/01');

    // 4. Millennium rollover
    const y2k = getBillingCycleRange('2000-01', 26, 25);
    expect(y2k.startDate).toBe('1999-12-26');
    expect(y2k.endDate).toBe('2000-01-25');
  });

  test('CH1.5: Combinatorial date boundary fuzzing (10,890 combinations)', () => {
    const years = [2020, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const testDays = [1, 5, 10, 15, 19, 20, 25, 26, 28, 29, 30, 31];

    let totalChecked = 0;

    for (const year of years) {
      for (const month of months) {
        const monthKey = `${year}-${month}`;
        for (const sDay of testDays) {
          for (const eDay of testDays) {
            const range = getBillingCycleRange(monthKey, sDay, eDay);
            totalChecked++;

            // Invariant 1: Valid ISO formatting
            expect(/^\d{4}-\d{2}-\d{2}$/.test(range.startDate)).toBe(true);
            expect(/^\d{4}-\d{2}-\d{2}$/.test(range.endDate)).toBe(true);

            // Invariant 2: Calendar validity (no impossible day numbers)
            expect(isValidCalendarDate(range.startDate)).toBe(true);
            expect(isValidCalendarDate(range.endDate)).toBe(true);

            // Invariant 3: Ordering
            expect(range.startDate <= range.endDate).toBe(true);

            // Invariant 4: Label formatting
            expect(/^\d{2}\/\d{2} – \d{2}\/\d{2}$/.test(range.displayLabel)).toBe(true);
          }
        }
      }
    }

    expect(totalChecked).toBe(years.length * months.length * testDays.length * testDays.length);
  });

  test('CH1.6: Degenerate, empty, and invalid monthKey fallbacks', () => {
    // Empty string
    const emptyRes = getBillingCycleRange('');
    expect(isValidCalendarDate(emptyRes.startDate)).toBe(true);
    expect(isValidCalendarDate(emptyRes.endDate)).toBe(true);
    expect(emptyRes.startDate.endsWith('-01')).toBe(true);

    // Missing dash
    const noDashRes = getBillingCycleRange('2026');
    expect(isValidCalendarDate(noDashRes.startDate)).toBe(true);
    expect(isValidCalendarDate(noDashRes.endDate)).toBe(true);

    // Null/undefined (cast as any)
    const nullRes = getBillingCycleRange(null as any);
    expect(isValidCalendarDate(nullRes.startDate)).toBe(true);
    const undefRes = getBillingCycleRange(undefined as any);
    expect(isValidCalendarDate(undefRes.startDate)).toBe(true);
  });

  test('CH1.7: Adversarial malformed monthKey with hyphen', () => {
    // Testing what happens if monthKey contains a hyphen but non-numeric values
    const nonNumericRes = getBillingCycleRange('invalid-key');
    // We observe that parseInt('invalid') returns NaN, leading to 'NaN-NaN-NaN'
    // Let's document this exact empirical observation
    const hasNaN = nonNumericRes.startDate.includes('NaN');
    expect(hasNaN).toBe(true);
  });
});

// ============================================================================
// SUITE 2: ROW INDEX ADJUSTMENT SIMULATION ACROSS SEQUENTIAL DELETES
// ============================================================================
describe('Challenger M1 - Suite 2: Row Index Realignment Oracle Simulation', () => {
  // Oracle Model representing physical Google Sheet tab and React state
  interface SheetRow {
    id: string;
    rowIndex: number; // 1-based index (Header is row 1, data starts at row 2)
    data: any;
  }

  class GoogleSheetTabModel {
    public rows: SheetRow[] = [];
    public sheetType: 'Expenses' | 'Income';

    constructor(sheetType: 'Expenses' | 'Income', initialCount: number) {
      this.sheetType = sheetType;
      // Header is row 1
      this.rows.push({ id: '__HEADER__', rowIndex: 1, data: 'HEADER' });
      for (let i = 2; i <= initialCount + 1; i++) {
        this.rows.push({
          id: `${sheetType.toLowerCase()}-${i}`,
          rowIndex: i,
          data: { name: `Item ${i}` },
        });
      }
    }

    // Google Sheets API deleteDimension simulation
    deleteRow(targetRowIndex: number): SheetRow {
      const idx = this.rows.findIndex((r) => r.rowIndex === targetRowIndex);
      if (idx === -1) throw new Error(`Row #${targetRowIndex} not found on sheet`);
      const deleted = this.rows.splice(idx, 1)[0];
      // Physical shift up of subsequent rows
      for (let i = idx; i < this.rows.length; i++) {
        this.rows[i].rowIndex = i + 1;
      }
      return deleted;
    }

    // Google Sheets API append simulation
    appendRow(data: any, customId?: string): number {
      const newRowIndex = this.rows.length + 1;
      const id = customId || `${this.sheetType.toLowerCase()}-${Date.now()}-${Math.random()}`;
      this.rows.push({ id, rowIndex: newRowIndex, data });
      return newRowIndex;
    }
  }

  // React State Simulation applying App.tsx logic exactly
  class ClientStateModel {
    public sheetRecords: TransactionRecord[] = [];

    // Initialize state from sheets
    loadFromSheets(tabs: GoogleSheetTabModel[]) {
      this.sheetRecords = [];
      for (const tab of tabs) {
        for (const r of tab.rows) {
          if (r.id === '__HEADER__') continue;
          this.sheetRecords.push({
            id: r.id,
            sheetType: tab.sheetType,
            purchaseDate: '26/10/2026',
            isoDate: '2026-10-26',
            monthKey: '2026-10',
            category: 'Ăn uống',
            purchaseItem: `Item #${r.rowIndex}`,
            amount: 50000,
            beCorp: 0,
            credit: 0,
            source: 'google_sheet',
            rowIndex: r.rowIndex,
            syncedToSheet: true,
          });
        }
      }
    }

    // Exact replica of App.tsx lines 1614–1630 (handleConfirmDelete optimistic update)
    optimisticDelete(target: TransactionRecord) {
      const filtered = this.sheetRecords.filter((r) => r.id !== target.id);
      if (target.rowIndex !== undefined) {
        this.sheetRecords = filtered.map((r) => {
          if (
            r.sheetType === target.sheetType &&
            r.rowIndex !== undefined &&
            r.rowIndex > target.rowIndex!
          ) {
            return { ...r, rowIndex: r.rowIndex - 1 };
          }
          return r;
        });
      } else {
        this.sheetRecords = filtered;
      }
    }

    // Exact replica of App.tsx lines 1471–1485 (appendTransaction optimistic update)
    optimisticAppend(record: TransactionRecord, appendResRowIndex?: number) {
      const assignedRowIndex =
        appendResRowIndex ??
        (() => {
          const sameTabRows = this.sheetRecords.filter(
            (r) => r.sheetType === record.sheetType && typeof r.rowIndex === 'number'
          );
          const maxRow = sameTabRows.reduce((m, r) => Math.max(m, r.rowIndex || 0), 1);
          return maxRow + 1;
        })();

      this.sheetRecords.push({
        ...record,
        rowIndex: assignedRowIndex,
        syncedToSheet: true,
      });
    }

    // Invariant verifier: Every record's rowIndex matches the physical row in Google Sheet
    assertInvariants(expensesTab: GoogleSheetTabModel, incomeTab: GoogleSheetTabModel) {
      for (const rec of this.sheetRecords) {
        if (rec.rowIndex === undefined) continue;
        const targetTab = rec.sheetType === 'Expenses' ? expensesTab : incomeTab;
        const physicalRow = targetTab.rows.find((r) => r.rowIndex === rec.rowIndex);
        expect(physicalRow).toBeDefined();
        expect(physicalRow!.id).toBe(rec.id);
      }
    }
  }

  test('CH2.1: Sequential Top-Down Deletions (25 rows deleted from front)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 50);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    // Repeatedly delete the first data row (row 2)
    for (let step = 0; step < 25; step++) {
      // Find the first record in state
      const target = client.sheetRecords.find((r) => r.rowIndex === 2);
      expect(target).toBeDefined();

      // 1. Google Sheet deletes row 2
      expensesSheet.deleteRow(target!.rowIndex!);
      // 2. Client applies optimistic shift
      client.optimisticDelete(target!);
      // 3. Verify invariant: every remaining record points to its exact physical row
      client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
    }

    expect(client.sheetRecords.length).toBe(25);
    // Remaining rows should now be numbered 2..26
    const minRow = Math.min(...client.sheetRecords.map((r) => r.rowIndex!));
    const maxRow = Math.max(...client.sheetRecords.map((r) => r.rowIndex!));
    expect(minRow).toBe(2);
    expect(maxRow).toBe(26);
  });

  test('CH2.2: Sequential Bottom-Up Deletions (25 rows deleted from back)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 50);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    for (let step = 0; step < 25; step++) {
      const maxRowIndex = Math.max(...client.sheetRecords.map((r) => r.rowIndex!));
      const target = client.sheetRecords.find((r) => r.rowIndex === maxRowIndex);
      expect(target).toBeDefined();

      expensesSheet.deleteRow(target!.rowIndex!);
      client.optimisticDelete(target!);
      client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
    }

    expect(client.sheetRecords.length).toBe(25);
    const maxRow = Math.max(...client.sheetRecords.map((r) => r.rowIndex!));
    expect(maxRow).toBe(26);
  });

  test('CH2.3: Sequential Middle Deletions (25 rows deleted at midpoint)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 50);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    for (let step = 0; step < 25; step++) {
      const sorted = [...client.sheetRecords].sort((a, b) => a.rowIndex! - b.rowIndex!);
      const mid = sorted[Math.floor(sorted.length / 2)];

      expensesSheet.deleteRow(mid.rowIndex!);
      client.optimisticDelete(mid);
      client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
    }

    expect(client.sheetRecords.length).toBe(25);
  });

  test('CH2.4: Randomized deletion sequence (50 rows deleted down to 0)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 50);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    while (client.sheetRecords.length > 0) {
      const randIdx = Math.floor(Math.random() * client.sheetRecords.length);
      const target = client.sheetRecords[randIdx];

      expensesSheet.deleteRow(target.rowIndex!);
      client.optimisticDelete(target);
      client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
    }

    expect(client.sheetRecords.length).toBe(0);
    expect(expensesSheet.rows.length).toBe(1); // Only header remains
  });

  test('CH2.5: Cross-Tab Isolation (Interleaved Expenses and Income Deletions)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 30);
    const incomeSheet = new GoogleSheetTabModel('Income', 20);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet, incomeSheet]);

    // Interleave 10 expense deletions and 10 income deletions
    for (let i = 0; i < 10; i++) {
      // Delete an expense row
      const expTarget = client.sheetRecords.find((r) => r.sheetType === 'Expenses' && r.rowIndex === 5);
      expect(expTarget).toBeDefined();
      expensesSheet.deleteRow(expTarget!.rowIndex!);
      client.optimisticDelete(expTarget!);
      client.assertInvariants(expensesSheet, incomeSheet);

      // Delete an income row
      const incTarget = client.sheetRecords.find((r) => r.sheetType === 'Income' && r.rowIndex === 3);
      expect(incTarget).toBeDefined();
      incomeSheet.deleteRow(incTarget!.rowIndex!);
      client.optimisticDelete(incTarget!);
      client.assertInvariants(expensesSheet, incomeSheet);
    }

    expect(client.sheetRecords.filter((r) => r.sheetType === 'Expenses').length).toBe(20);
    expect(client.sheetRecords.filter((r) => r.sheetType === 'Income').length).toBe(10);
  });

  test('CH2.6: Interleaved Appends and Deletes with Dynamic Row Computation', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 10);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    // Append 3 rows
    for (let i = 0; i < 3; i++) {
      const id = `exp-append-${i}`;
      const sheetRowIndex = expensesSheet.appendRow({ name: `Appended ${i}` }, id);
      const newRec: TransactionRecord = {
        id,
        sheetType: 'Expenses',
        purchaseDate: '26/10/2026',
        isoDate: '2026-10-26',
        monthKey: '2026-10',
        category: 'Mua sắm',
        purchaseItem: `Appended ${i}`,
        amount: 100000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
        syncedToSheet: true,
      };
      client.optimisticAppend(newRec, sheetRowIndex);
      client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
    }
    expect(client.sheetRecords.length).toBe(13);

    // Delete row 3 (an early row)
    const row3 = client.sheetRecords.find((r) => r.rowIndex === 3)!;
    expensesSheet.deleteRow(row3.rowIndex!);
    client.optimisticDelete(row3);
    client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));

    // Append without explicit sheetRowIndex (relying on maxRow + 1 fallback)
    const fallbackId = 'exp-fallback-1';
    const expectedNewRow = expensesSheet.appendRow({ name: 'Fallback Append' }, fallbackId);
    const fallbackRec: TransactionRecord = {
      id: fallbackId,
      sheetType: 'Expenses',
      purchaseDate: '26/10/2026',
      isoDate: '2026-10-26',
      monthKey: '2026-10',
      category: 'Mua sắm',
      purchaseItem: 'Fallback Append',
      amount: 150000,
      beCorp: 0,
      credit: 0,
      source: 'google_sheet',
      syncedToSheet: true,
    };
    // Omit appendResRowIndex to trigger maxRow + 1
    client.optimisticAppend(fallbackRec);
    const appendedInState = client.sheetRecords.find((r) => r.id === fallbackId);
    expect(appendedInState?.rowIndex).toBe(expectedNewRow);
    client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
  });

  test('CH2.7: Deletion of offline/unindexed records (rowIndex === undefined)', () => {
    const expensesSheet = new GoogleSheetTabModel('Expenses', 10);
    const client = new ClientStateModel();
    client.loadFromSheets([expensesSheet]);

    // Add an unindexed local record
    const unindexedRec: TransactionRecord = {
      id: 'local-offline-1',
      sheetType: 'Expenses',
      purchaseDate: '26/10/2026',
      isoDate: '2026-10-26',
      monthKey: '2026-10',
      category: 'Ăn uống',
      purchaseItem: 'Offline Meal',
      amount: 45000,
      beCorp: 0,
      credit: 0,
      source: 'local_new',
      syncedToSheet: false,
      rowIndex: undefined,
    };
    client.sheetRecords.push(unindexedRec);
    expect(client.sheetRecords.length).toBe(11);

    // Delete the unindexed record
    client.optimisticDelete(unindexedRec);
    expect(client.sheetRecords.length).toBe(10);
    // Verify all 10 remaining records still have their original indices 2..11
    client.assertInvariants(expensesSheet, new GoogleSheetTabModel('Income', 0));
  });
});

// ============================================================================
// SUITE 3: NEGATIVE VALUES & REFUND PRESERVATION HARNESS
// ============================================================================
describe('Challenger M1 - Suite 3: Negative Values & Refund Preservation', () => {
  test('CH3.1: googleSheetsService updateTransactionOnSheet rowValues logic', () => {
    // Model the exact transformation in googleSheetsService.ts:796-803
    const formatExpensesRowValues = (record: {
      purchaseDate: string;
      category: string;
      purchaseItem: string;
      amount: number;
      beCorp?: number;
      credit?: number;
      note?: string;
    }) => [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      record.beCorp !== 0 && !isNaN(record.beCorp as number) ? record.beCorp : '',
      record.credit !== 0 && !isNaN(record.credit as number) ? record.credit : '',
      record.note || '',
    ];

    // Case 1: Negative refund in BE Corp
    const row1 = formatExpensesRowValues({
      purchaseDate: '26/10/2026',
      category: 'Công tác',
      purchaseItem: 'Hoàn tiền vé máy bay BE Corp',
      amount: -2500000,
      beCorp: -2500000,
      credit: 0,
    });
    expect(row1[4]).toBe(-2500000); // Must preserve negative value
    expect(row1[5]).toBe(''); // 0 must become empty string

    // Case 2: Negative chargeback in Credit Card
    const row2 = formatExpensesRowValues({
      purchaseDate: '20/10/2026',
      category: 'Mua sắm',
      purchaseItem: 'Refund Shopee thẻ tín dụng',
      amount: -350000,
      beCorp: 0,
      credit: -350000,
    });
    expect(row2[4]).toBe('');
    expect(row2[5]).toBe(-350000); // Must preserve negative value

    // Case 3: Both undefined
    const row3 = formatExpensesRowValues({
      purchaseDate: '15/10/2026',
      category: 'Ăn uống',
      purchaseItem: 'Tiền mặt',
      amount: 50000,
      beCorp: undefined,
      credit: undefined,
    });
    expect(row3[4]).toBe('');
    expect(row3[5]).toBe('');

    // Case 4: Positive values preserved
    const row4 = formatExpensesRowValues({
      purchaseDate: '15/10/2026',
      category: 'Ăn uống',
      purchaseItem: 'Chi BE Corp & Credit',
      amount: 1000000,
      beCorp: 400000,
      credit: 600000,
    });
    expect(row4[4]).toBe(400000);
    expect(row4[5]).toBe(600000);
  });

  test('CH3.2: googleSheetsService appendTransactionToSheet rowValues logic', () => {
    // Model the exact transformation in googleSheetsService.ts:441-448
    const formatAppendRowValues = (record: {
      purchaseDate: string;
      category: string;
      purchaseItem: string;
      amount: number;
      beCorp?: number;
      credit?: number;
    }) => [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      record.beCorp !== 0 ? record.beCorp : '',
      record.credit !== 0 ? record.credit : '',
    ];

    const row = formatAppendRowValues({
      purchaseDate: '26/10/2026',
      category: 'Công tác',
      purchaseItem: 'Refund',
      amount: -500000,
      beCorp: -500000,
      credit: -200000,
    });

    expect(row[4]).toBe(-500000);
    expect(row[5]).toBe(-200000);

    const zeroRow = formatAppendRowValues({
      purchaseDate: '26/10/2026',
      category: 'Ăn uống',
      purchaseItem: 'Normal',
      amount: 50000,
      beCorp: 0,
      credit: 0,
    });
    expect(zeroRow[4]).toBe('');
    expect(zeroRow[5]).toBe('');
  });

  test('CH3.3: Apps Script Code.gs negative and zero value condition verification', () => {
    // Model Code.gs:304-305 and Code.gs:378-379:
    // rec.beCorp !== undefined && rec.beCorp !== '' && !isNaN(rec.beCorp) && Number(rec.beCorp) !== 0 ? rec.beCorp : ''
    const gasCellTransform = (val: any) =>
      val !== undefined && val !== '' && !isNaN(val) && Number(val) !== 0 ? val : '';

    // Negative numbers
    expect(gasCellTransform(-50000)).toBe(-50000);
    expect(gasCellTransform('-50000')).toBe('-50000');
    expect(gasCellTransform(-1.5)).toBe(-1.5);

    // Zeroes
    expect(gasCellTransform(0)).toBe('');
    expect(gasCellTransform('0')).toBe('');

    // Empty / null / undefined / NaN
    expect(gasCellTransform('')).toBe('');
    expect(gasCellTransform(null)).toBe('');
    expect(gasCellTransform(undefined)).toBe('');
    expect(gasCellTransform(NaN)).toBe('');

    // Positive numbers
    expect(gasCellTransform(250000)).toBe(250000);
    expect(gasCellTransform('250000')).toBe('250000');
  });

  test('CH3.4: parseSheetNumber negative number formats', () => {
    expect(parseSheetNumber('-4,100,000')).toBe(-4100000);
    expect(parseSheetNumber('(4,100,000)')).toBe(-4100000);
    expect(parseSheetNumber('-$250,000')).toBe(-250000);
    expect(parseSheetNumber('-50,000 VND')).toBe(-50000);
    expect(parseSheetNumber('- 100,000 ₫')).toBe(-100000);
    expect(Math.abs(parseSheetNumber('-0'))).toBe(0);
    expect(parseSheetNumber(-75000)).toBe(-75000);
  });

  test('CH3.5: Multi-Month and Runway calculations absorb negative refund records', () => {
    const records: TransactionRecord[] = [
      {
        id: 'exp-1',
        sheetType: 'Expenses',
        purchaseDate: '01/10/2026',
        isoDate: '2026-10-01',
        monthKey: '2026-10',
        category: 'Ăn uống',
        purchaseItem: 'Siêu thị đầu tháng',
        amount: 2000000,
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
      },
      {
        id: 'exp-2',
        sheetType: 'Expenses',
        purchaseDate: '05/10/2026',
        isoDate: '2026-10-05',
        monthKey: '2026-10',
        category: 'Ăn uống',
        purchaseItem: 'Hoàn trả hàng hư siêu thị (Refund)',
        amount: -500000, // Negative refund
        beCorp: 0,
        credit: 0,
        source: 'google_sheet',
      },
    ];

    const netSpent = records.reduce((sum, r) => sum + r.amount, 0);
    expect(netSpent).toBe(1500000); // 2,000,000 - 500,000 = 1,500,000

    // Verify filterRecordsByDateRange retains the refund
    const inRange = filterRecordsByDateRange(records, '2026-10-01', '2026-10-31');
    expect(inRange.length).toBe(2);
    expect(inRange.some((r) => r.amount < 0)).toBe(true);
  });
});

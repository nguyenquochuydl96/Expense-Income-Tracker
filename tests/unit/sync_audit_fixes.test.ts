import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {
  buildRowSignature,
  generateTxId,
  isSyncConflictError,
  mergeBudgetTransfersOnSync,
  rollbackDeletedListRecord,
  rollbackDeletedRecord,
  rollbackEditedListRecord,
  rollbackEditedRecord,
} from '../../src/utils/syncStateUtils';
import {
  appendBudgetTransferToSheet,
  appendTransactionToSheet,
  updateTransactionOnSheet,
} from '../../src/services/googleSheetsService';
import type { BudgetTransferRecord, TransactionRecord } from '../../src/types/finance';

// ==================== MOCK GOOGLE APPS SCRIPT RUNTIME FOR Code.gs ====================

interface MockSheetData {
  name: string;
  rows: any[][];
  formulas?: string[][];
}

function createMockAppsScriptRuntime(initialSheets: MockSheetData[]) {
  const events: string[] = [];
  const sheetsMap = new Map<string, MockSheetData>();
  initialSheets.forEach((s) => {
    sheetsMap.set(s.name, {
      name: s.name,
      rows: s.rows.map((r) => [...r]),
      formulas: s.formulas ? s.formulas.map((r) => [...r]) : undefined,
    });
  });

  function wrapSheet(data: MockSheetData) {
    return {
      getName: () => data.name,
      getLastRow: () => data.rows.length,
      getLastColumn: () => data.rows.reduce((max, r) => Math.max(max, r.length), 0),
      getRange: (rowOrA1: number | string, col?: number, numRows = 1, numCols = 1) => {
        if (typeof rowOrA1 === 'string') {
          if (rowOrA1.toUpperCase() === 'A:A') {
            throw new Error('FORBIDDEN_FULL_COLUMN_SCAN: getRange("A:A") must not be called');
          }
          throw new Error(`Unexpected A1 range in mock: ${rowOrA1}`);
        }
        const startRow = rowOrA1;
        const startCol = col ?? 1;
        return {
          getValues: () => {
            const out: any[][] = [];
            for (let r = 0; r < numRows; r++) {
              const srcRow = data.rows[startRow - 1 + r] || [];
              const rowOut: any[] = [];
              for (let c = 0; c < numCols; c++) {
                const v = srcRow[startCol - 1 + c];
                rowOut.push(v === undefined ? '' : v);
              }
              out.push(rowOut);
            }
            return out;
          },
          getDisplayValues: () => {
            const out: string[][] = [];
            for (let r = 0; r < numRows; r++) {
              const srcRow = data.rows[startRow - 1 + r] || [];
              const rowOut: string[] = [];
              for (let c = 0; c < numCols; c++) {
                const v = srcRow[startCol - 1 + c];
                rowOut.push(v === undefined || v === null ? '' : String(v));
              }
              out.push(rowOut);
            }
            return out;
          },
          getFormulas: () => {
            const out: string[][] = [];
            for (let r = 0; r < numRows; r++) {
              const fRow = data.formulas?.[startRow - 1 + r] || [];
              const rowOut: string[] = [];
              for (let c = 0; c < numCols; c++) {
                rowOut.push(fRow[startCol - 1 + c] || '');
              }
              out.push(rowOut);
            }
            return out;
          },
          setValues: (values: any[][]) => {
            for (let r = 0; r < values.length; r++) {
              const targetIdx = startRow - 1 + r;
              while (data.rows.length <= targetIdx) {
                data.rows.push([]);
              }
              const targetRow = data.rows[targetIdx];
              for (let c = 0; c < values[r].length; c++) {
                targetRow[startCol - 1 + c] = values[r][c];
              }
            }
          },
        };
      },
      deleteRow: (rowIndex: number) => {
        data.rows.splice(rowIndex - 1, 1);
      },
    };
  }

  const ss = {
    getId: () => 'mock-sheet-id-123',
    getName: () => 'Heo & Mèo Finance Test Sheet',
    getSheets: () => Array.from(sheetsMap.values()).map(wrapSheet),
    getSheetByName: (name: string) => {
      const found = sheetsMap.get(name);
      return found ? wrapSheet(found) : null;
    },
    insertSheet: (name: string) => {
      const created: MockSheetData = { name, rows: [['Header']] };
      sheetsMap.set(name, created);
      return wrapSheet(created);
    },
  };

  const sandbox: any = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush: () => {
        events.push('flush');
      },
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          events.push('waitLock');
        },
        releaseLock: () => {
          events.push('releaseLock');
        },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({
        _text: text,
        setMimeType() {
          return this;
        },
        getContent() {
          return this._text;
        },
      }),
    },
    Logger: {
      log: () => {},
    },
  };

  const codeGsPath = path.resolve(process.cwd(), 'apps-script/Code.gs');
  const source = fs.readFileSync(codeGsPath, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  // Set deterministic test API key matching CONFIG.API_SECRET_KEY
  const apiKey = sandbox.CONFIG?.API_SECRET_KEY ?? 'YOUR_SECRET_KEY_HERE';

  function callPost(payload: Record<string, any>) {
    const out = sandbox.doPost({
      postData: { contents: JSON.stringify({ apiKey, ...payload }) },
    });
    return JSON.parse(out.getContent());
  }

  function callGet(parameter: Record<string, any>) {
    const out = sandbox.doGet({ parameter: { apiKey, ...parameter } });
    return JSON.parse(out.getContent());
  }

  return { sandbox, sheetsMap, events, callPost, callGet };
}

// ==================== 1. Code.gs SECURITY, CONFLICT, IDEMPOTENCY, ATOMIC MOVE ====================

describe('apps-script/Code.gs hardening & 2-way sync safety', () => {
  it('blocks all write/update/delete/move actions via doGet', () => {
    const { callGet } = createMockAppsScriptRuntime([
      { name: 'Expenses', rows: [['Date', 'Cat', 'Item', 'Amount', 'BE', 'Credit', 'Note', 'txId']] },
    ]);

    const writeActions = [
      'appendTransaction',
      'appendBudgetTransfer',
      'updateTransaction',
      'deleteTransaction',
      'moveTransaction',
      'updateCheckTienWallets',
    ];

    for (const action of writeActions) {
      const res = callGet({ action });
      assert.equal(res.success, false, `doGet must block ${action}`);
      assert.equal(res.code, 'METHOD_NOT_ALLOWED');
    }

    const pingRes = callGet({ action: 'ping' });
    assert.equal(pingRes.success, true);
  });

  it('parseSheetNumberServer handles parentheses negatives and Vietnamese dot thousand separators', () => {
    const { sandbox } = createMockAppsScriptRuntime([]);
    const parse = sandbox.parseSheetNumberServer;

    assert.equal(parse(50000, '50,000'), 50000);
    assert.equal(parse(-125000, '-125,000'), -125000);
    assert.equal(parse('', '(50,000)'), -50000);
    assert.equal(parse('', '(1.200.000 ₫)'), -1200000);
    assert.equal(parse('', '1.500.000'), 1500000);
    assert.equal(parse('', '50.000'), 50000);
    assert.equal(parse('', '1.500.000,50'), 1500000.5);
    assert.equal(parse('', '-4,100,000'), -4100000);
  });

  it('rejects update/delete with NOT_FOUND conflict when UUID txId is missing (NEVER falls back to rowIndex)', () => {
    const uuidRow2 = '11111111-1111-4111-8111-111111111111';
    const missingUuid = '99999999-9999-4999-8999-999999999999';
    const { callPost, sheetsMap } = createMockAppsScriptRuntime([
      {
        name: 'Expenses',
        rows: [
          ['Purchase Date', 'Category', 'Purchase Item', 'Amount', 'BE Corp', 'Credit', 'Note', 'txId'],
          ['10/25/2026', 'Ăn uống', 'Bún bò', 65000, '', '', '', uuidRow2],
        ],
      },
    ]);

    const updateRes = callPost({
      action: 'updateTransaction',
      tabName: 'Expenses',
      rowIndex: 2,
      txId: missingUuid,
      record: {
        purchaseDate: '10/25/2026',
        category: 'Ăn uống',
        purchaseItem: 'GHI ĐÈ NHẦM',
        amount: 999999,
      },
    });
    assert.equal(updateRes.success, false);
    assert.equal(updateRes.conflict, true);
    assert.equal(updateRes.code, 'NOT_FOUND');
    // Row 2 MUST remain untouched!
    assert.equal(sheetsMap.get('Expenses')!.rows[1][2], 'Bún bò');
    assert.equal(sheetsMap.get('Expenses')!.rows[1][3], 65000);

    const deleteRes = callPost({
      action: 'deleteTransaction',
      tabName: 'Expenses',
      rowIndex: 2,
      txId: missingUuid,
    });
    assert.equal(deleteRes.success, false);
    assert.equal(deleteRes.conflict, true);
    assert.equal(deleteRes.code, 'NOT_FOUND');
    assert.equal(sheetsMap.get('Expenses')!.rows.length, 2);
  });

  it('allows legacy rowIndex fallback ONLY when row signature matches, rejects on mismatch', () => {
    const { callPost, sheetsMap } = createMockAppsScriptRuntime([
      {
        name: 'Expenses',
        rows: [
          ['Purchase Date', 'Category', 'Purchase Item', 'Amount', 'BE Corp', 'Credit', 'Note', 'txId'],
          ['10/25/2026', 'Ăn uống', 'Cà phê sáng', 45000, '', '', '', ''],
        ],
      },
    ]);

    // Wrong signature -> must reject with SIGNATURE_MISMATCH
    const mismatchRes = callPost({
      action: 'updateTransaction',
      tabName: 'Expenses',
      rowIndex: 2,
      txId: 'exp-2-10/25/2026',
      expectedSignature: {
        purchaseDate: '10/25/2026',
        amount: 120000,
        purchaseItem: 'Cơm trưa',
      },
      record: {
        purchaseDate: '10/25/2026',
        category: 'Ăn uống',
        purchaseItem: 'Đổi tên',
        amount: 120000,
      },
    });
    assert.equal(mismatchRes.success, false);
    assert.equal(mismatchRes.conflict, true);
    assert.equal(mismatchRes.code, 'SIGNATURE_MISMATCH');
    assert.equal(sheetsMap.get('Expenses')!.rows[1][2], 'Cà phê sáng');

    // Matching signature -> succeeds
    const matchRes = callPost({
      action: 'updateTransaction',
      tabName: 'Expenses',
      rowIndex: 2,
      txId: 'exp-2-10/25/2026',
      expectedSignature: {
        purchaseDate: '10/25/2026',
        amount: 45000,
        purchaseItem: 'Cà phê sáng',
      },
      record: {
        purchaseDate: '10/25/2026',
        category: 'Ăn uống',
        purchaseItem: 'Cà phê sữa đá',
        amount: 48000,
      },
    });
    assert.equal(matchRes.success, true);
    assert.equal(sheetsMap.get('Expenses')!.rows[1][2], 'Cà phê sữa đá');
    assert.equal(sheetsMap.get('Expenses')!.rows[1][3], 48000);
  });

  it('deduplicates repeated appendTransaction and appendBudgetTransfer calls with same txId without scanning A:A', () => {
    const txUuid = '22222222-2222-4222-8222-222222222222';
    const btUuid = '33333333-3333-4333-8333-333333333333';
    const { callPost, sheetsMap, events } = createMockAppsScriptRuntime([
      { name: 'Expenses', rows: [['Date', 'Cat', 'Item', 'Amount', 'BE', 'Credit', 'Note', 'txId']] },
      { name: 'Budget Transfers', rows: [['Date', 'From', 'To', 'Amount', 'Desc', 'Month', 'txId']] },
    ]);

    const firstTx = callPost({
      action: 'appendTransaction',
      tabName: 'Expenses',
      record: {
        purchaseDate: '10/26/2026',
        category: 'Ăn uống',
        purchaseItem: 'Phở bò',
        amount: 70000,
        txId: txUuid,
      },
    });
    assert.equal(firstTx.success, true);
    assert.equal(firstTx.deduplicated, false);
    assert.equal(firstTx.rowIndex, 2);

    // Retry same txId (e.g. after timeout)
    const secondTx = callPost({
      action: 'appendTransaction',
      tabName: 'Expenses',
      record: {
        purchaseDate: '10/26/2026',
        category: 'Ăn uống',
        purchaseItem: 'Phở bò',
        amount: 70000,
        txId: txUuid,
      },
    });
    assert.equal(secondTx.success, true);
    assert.equal(secondTx.deduplicated, true);
    assert.equal(secondTx.rowIndex, 2);
    assert.equal(sheetsMap.get('Expenses')!.rows.length, 2); // header + 1 row only

    // Budget Transfer idempotency
    const firstBt = callPost({
      action: 'appendBudgetTransfer',
      tabName: 'Budget Transfers',
      transfer: {
        date: '10/26/2026',
        fromCategory: 'Tiết kiệm',
        toCategory: 'Ăn uống',
        amount: 500000,
        description: 'Bù tiền ăn',
        txId: btUuid,
      },
    });
    assert.equal(firstBt.success, true);
    assert.equal(firstBt.deduplicated, false);

    const secondBt = callPost({
      action: 'appendBudgetTransfer',
      tabName: 'Budget Transfers',
      transfer: {
        date: '10/26/2026',
        fromCategory: 'Tiết kiệm',
        toCategory: 'Ăn uống',
        amount: 500000,
        description: 'Bù tiền ăn',
        txId: btUuid,
      },
    });
    assert.equal(secondBt.success, true);
    assert.equal(secondBt.deduplicated, true);
    assert.equal(sheetsMap.get('Budget Transfers')!.rows.length, 2);

    // Verify flush happens before releaseLock on every write
    const lastFlushIdx = events.lastIndexOf('flush');
    const lastReleaseIdx = events.lastIndexOf('releaseLock');
    assert.ok(lastFlushIdx > -1 && lastFlushIdx < lastReleaseIdx, 'SpreadsheetApp.flush() must run before lock.releaseLock()');
  });

  it('performs atomic moveTransaction across Expenses and Income inside a single LockService + flush', () => {
    const moveUuid = '44444444-4444-4444-8444-444444444444';
    const { callPost, sheetsMap, events } = createMockAppsScriptRuntime([
      {
        name: 'Expenses',
        rows: [
          ['Purchase Date', 'Category', 'Purchase Item', 'Amount', 'BE Corp', 'Credit', 'Note', 'txId'],
          ['10/25/2026', 'Khác', 'Hoàn thuế', 1500000, '', '', '', moveUuid],
        ],
      },
      {
        name: 'Income',
        rows: [['Date', 'Income Source', 'Description', 'Income Amount', 'Month', 'txId']],
      },
    ]);

    const res = callPost({
      action: 'moveTransaction',
      fromTab: 'Expenses',
      toTab: 'Income',
      rowIndex: 2,
      txId: moveUuid,
      record: {
        sheetType: 'Income',
        purchaseDate: '10/25/2026',
        category: 'Khác',
        purchaseItem: 'Hoàn thuế',
        amount: 1500000,
        txId: moveUuid,
      },
    });

    assert.equal(res.success, true);
    assert.equal(res.rowIndex, 2);
    assert.equal(res.deletedRowIndex, 2);
    assert.equal(sheetsMap.get('Expenses')!.rows.length, 1); // deleted from source
    assert.equal(sheetsMap.get('Income')!.rows.length, 2); // appended to destination
    assert.equal(sheetsMap.get('Income')!.rows[1][5], moveUuid); // txId preserved in col F
    assert.deepEqual(events, ['waitLock', 'flush', 'releaseLock']);
  });

  it('handles Check tiền read/write safely when tab is missing and when tab exists', () => {
    // Case 1: Check tiền tab missing -> backward-compatible null / updated: false
    const runtimeNoTab = createMockAppsScriptRuntime([
      { name: 'Expenses', rows: [['Date', 'Cat', 'Item', 'Amount', 'BE', 'Credit', 'Note', 'txId']] },
      { name: 'Income', rows: [['Date', 'Source', 'Desc', 'Amount', 'Month', 'txId']] },
    ]);
    const syncNoTab = runtimeNoTab.callPost({ action: 'syncAll' });
    assert.equal(syncNoTab.success, true);
    assert.equal(syncNoTab.checkTien, null);

    const updNoTab = runtimeNoTab.callPost({
      action: 'updateCheckTienWallets',
      wallets: {
        heo: { cash: 100, bank: 200, ewallet: 300, receivable: 0 },
        meo: { cash: 400, bank: 500, ewallet: 600, receivable: 0 },
      },
    });
    assert.equal(updNoTab.success, true);
    assert.equal(updNoTab.updated, false);

    // Case 2: Check tiền tab exists
    const runtimeWithTab = createMockAppsScriptRuntime([
      { name: 'Expenses', rows: [['Date', 'Cat', 'Item', 'Amount', 'BE', 'Credit', 'Note', 'txId']] },
      { name: 'Income', rows: [['Date', 'Source', 'Desc', 'Amount', 'Month', 'txId']] },
      {
        name: 'Check tiền',
        rows: [
          ['', 'Owner', 'Cash', 'Bank', 'Momo', 'ZaloPay', 'Receivable', 'Total'],
          ['', 'Heo', '1,000,000', '2,000,000', '(500,000)', '100,000', '0', '2,600,000'],
          ['', 'Mèo', '500,000', '3,000,000', '200,000', '0', '100,000', '3,800,000'],
        ],
        formulas: [
          ['', '', '', '', '', '', '', ''],
          ['', '', '', '', '', '', '', '=SUM(C2:G2)'],
          ['', '', '', '', '', '', '', '=SUM(C3:G3)'],
        ],
      },
    ]);

    const syncWithTab = runtimeWithTab.callPost({ action: 'syncAll' });
    assert.equal(syncWithTab.success, true);
    assert.equal(syncWithTab.checkTien.sheetName, 'Check tiền');
    assert.equal(syncWithTab.checkTien.formattedRows.length, 3);
    assert.equal(syncWithTab.checkTien.detectedSummary.length, 2);

    const updWithTab = runtimeWithTab.callPost({
      action: 'updateCheckTienWallets',
      tabName: 'Check tiền',
      wallets: {
        heo: { cash: 1500000, bank: 2500000, ewallet: -300000, receivable: 50000 },
        meo: { cash: 700000, bank: 4000000, ewallet: 800000, receivable: 0 },
      },
    });
    assert.equal(updWithTab.success, true);
    assert.equal(updWithTab.updated, true);
    assert.deepEqual(runtimeWithTab.sheetsMap.get('Check tiền')!.rows[1].slice(2, 7), [
      1500000,
      2500000,
      -300000,
      0,
      50000,
    ]);
    assert.deepEqual(runtimeWithTab.sheetsMap.get('Check tiền')!.rows[2].slice(2, 7), [
      700000,
      4000000,
      800000,
      0,
      0,
    ]);
  });
});

// ==================== 2. googleSheetsService.ts OAuth RANGES & INSERT_ROWS ====================

describe('googleSheetsService.ts OAuth txId preservation & INSERT_ROWS', () => {
  it('appends with :append + insertDataOption=INSERT_ROWS on A:H (Expenses), A:F (Income), A:G (Transfers) and updates full ranges preserving txId', async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      return new Response(
        JSON.stringify({ updates: { updatedRange: "'Expenses'!A10:H10" } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const expTxId = '55555555-5555-4555-8555-555555555555';
      const expRes = await appendTransactionToSheet(
        'spreadsheet-abc',
        'Expenses',
        {
          sheetType: 'Expenses',
          purchaseDate: '10/25/2026',
          category: 'Ăn uống',
          purchaseItem: 'Cơm tấm',
          amount: 55000,
          beCorp: 0,
          credit: 0,
          note: 'Trưa',
          txId: expTxId,
        },
        'mock-oauth-token'
      );
      assert.equal(expRes.rowIndex, 10);
      assert.match(decodeURIComponent(calls[0].url), /'Expenses'!A:H:append/);
      assert.match(calls[0].url, /insertDataOption=INSERT_ROWS/);
      assert.equal(calls[0].body.values[0].length, 8);
      assert.equal(calls[0].body.values[0][7], expTxId);

      const incTxId = '66666666-6666-4666-8666-666666666666';
      await appendTransactionToSheet(
        'spreadsheet-abc',
        'Income',
        {
          sheetType: 'Income',
          purchaseDate: '10/25/2026',
          category: 'Lương Heo',
          purchaseItem: 'Lương T10',
          amount: 20000000,
          beCorp: 0,
          credit: 0,
          txId: incTxId,
        },
        'mock-oauth-token'
      );
      assert.match(decodeURIComponent(calls[1].url), /'Income'!A:F:append/);
      assert.match(calls[1].url, /insertDataOption=INSERT_ROWS/);
      assert.equal(calls[1].body.values[0].length, 6);
      assert.equal(calls[1].body.values[0][5], incTxId);

      // Update Expenses must PUT A5:H5 with txId in col H
      await updateTransactionOnSheet(
        'spreadsheet-abc',
        'Expenses',
        5,
        {
          sheetType: 'Expenses',
          purchaseDate: '10/25/2026',
          category: 'Ăn uống',
          purchaseItem: 'Cơm tấm sườn',
          amount: 60000,
          beCorp: 0,
          credit: 0,
          note: 'Updated',
          txId: expTxId,
        },
        'mock-oauth-token',
        expTxId
      );
      assert.equal(calls[2].method, 'PUT');
      assert.match(decodeURIComponent(calls[2].url), /'Expenses'!A5:H5/);
      assert.equal(calls[2].body.values[0][7], expTxId);

      // Update Income must PUT A3:F3 with txId in col F
      await updateTransactionOnSheet(
        'spreadsheet-abc',
        'Income',
        3,
        {
          sheetType: 'Income',
          purchaseDate: '10/25/2026',
          category: 'Lương Heo',
          purchaseItem: 'Lương T10 + Thưởng',
          amount: 22000000,
          beCorp: 0,
          credit: 0,
          txId: incTxId,
        },
        'mock-oauth-token',
        incTxId
      );
      assert.equal(calls[3].method, 'PUT');
      assert.match(decodeURIComponent(calls[3].url), /'Income'!A3:F3/);
      assert.equal(calls[3].body.values[0][5], incTxId);

      // Append Budget Transfer must use A:G + INSERT_ROWS with txId in col G
      const btTxId = '77777777-7777-4777-8777-777777777777';
      await appendBudgetTransferToSheet(
        'spreadsheet-abc',
        'Budget Transfers',
        {
          date: '10/25/2026',
          fromCategory: 'Tiết kiệm',
          toCategory: 'Du lịch',
          amount: 1000000,
          description: 'Chuyển quỹ',
          txId: btTxId,
        },
        'mock-oauth-token'
      );
      assert.match(decodeURIComponent(calls[4].url), /'Budget Transfers'!A:G:append/);
      assert.match(calls[4].url, /insertDataOption=INSERT_ROWS/);
      assert.equal(calls[4].body.values[0].length, 7);
      assert.equal(calls[4].body.values[0][6], btTxId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ==================== 3. syncStateUtils.ts MERGE & TARGETED ROLLBACK ====================

describe('syncStateUtils.ts local preservation & targeted rollbacks', () => {
  const mkTx = (overrides: Partial<TransactionRecord>): TransactionRecord => ({
    id: 'tx-1',
    txId: 'tx-1',
    rowIndex: 2,
    sheetType: 'Expenses',
    purchaseDate: '10/25/2026',
    isoDate: '2026-10-25',
    monthKey: '2026-10',
    category: 'Ăn uống',
    purchaseItem: 'Món A',
    amount: 50000,
    beCorp: 0,
    credit: 0,
    source: 'google_sheet',
    syncedToSheet: true,
    ...overrides,
  });

  const mkBt = (overrides: Partial<BudgetTransferRecord>): BudgetTransferRecord => ({
    id: 'bt-1',
    txId: 'bt-1',
    date: '10/25/2026',
    isoDate: '2026-10-25',
    monthKey: '2026-10',
    fromCategory: 'Tiết kiệm',
    toCategory: 'Ăn uống',
    amount: 300000,
    description: 'Bù chi tiêu',
    source: 'google_sheet',
    syncedToSheet: true,
    ...overrides,
  });

  it('mergeBudgetTransfersOnSync preserves unsynced local_new transfers when remote sheet syncs', () => {
    const unsyncedLocal = mkBt({
      id: 'local-unsynced-1',
      txId: 'local-unsynced-1',
      source: 'local_new',
      syncedToSheet: false,
      description: 'Offline pending',
    });
    const pushedLocal = mkBt({
      id: 'local-pushed-2',
      txId: 'local-pushed-2',
      source: 'local_new',
      syncedToSheet: false,
      description: 'Just pushed',
    });
    const remoteRow = mkBt({
      id: 'remote-1',
      txId: 'remote-1',
      rowIndex: 2,
      description: 'On sheet',
    });
    const remotePushedRow = mkBt({
      id: 'local-pushed-2',
      txId: 'local-pushed-2',
      rowIndex: 3,
      description: 'Just pushed',
    });

    const merged = mergeBudgetTransfersOnSync(
      [unsyncedLocal, pushedLocal],
      [remoteRow, remotePushedRow],
      new Set(['local-pushed-2'])
    );

    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 'local-unsynced-1');
    assert.equal(merged[0].syncedToSheet, false);
    assert.equal(merged[1].id, 'remote-1');
    assert.equal(merged[2].id, 'local-pushed-2');
    assert.equal(merged[2].syncedToSheet, true);
  });

  it('rollbackEditedRecord restores ONLY the failed edit without clobbering concurrent additions/edits', () => {
    const origA = mkTx({ id: 'a', rowIndex: 2, purchaseItem: 'Gốc A', amount: 50000 });
    const editedA = { ...origA, purchaseItem: 'Đã sửa A', amount: 80000 };
    const concurrentNewB = mkTx({ id: 'b', rowIndex: 3, purchaseItem: 'Mới thêm B', amount: 120000 });

    // Current state after optimistic edit of A + concurrent addition of B while API was in flight
    const currentState = [editedA, concurrentNewB];
    const rolledBack = rollbackEditedRecord(currentState, origA, 'a');

    assert.ok(rolledBack);
    assert.equal(rolledBack!.length, 2);
    assert.equal(rolledBack![0].purchaseItem, 'Gốc A');
    assert.equal(rolledBack![0].amount, 50000);
    // Concurrent addition B is preserved!
    assert.equal(rolledBack![1].id, 'b');
    assert.equal(rolledBack![1].purchaseItem, 'Mới thêm B');

    const rolledList = rollbackEditedListRecord([editedA, concurrentNewB], origA, 'a');
    assert.equal(rolledList[0].purchaseItem, 'Gốc A');
    assert.equal(rolledList[1].id, 'b');
  });

  it('rollbackDeletedRecord restores ONLY the deleted record and reverses rowIndex shifts while preserving concurrent additions', () => {
    const row2 = mkTx({ id: 'r2', rowIndex: 2, sheetType: 'Expenses', purchaseItem: 'Dòng 2' });
    const row3Deleted = mkTx({ id: 'r3', rowIndex: 3, sheetType: 'Expenses', purchaseItem: 'Dòng 3 bị xóa' });
    // After optimistic delete of r3: r4 was shifted from 4 -> 3, income r3 untouched, concurrent r5 added at row 4
    const row4Shifted = mkTx({ id: 'r4', rowIndex: 3, sheetType: 'Expenses', purchaseItem: 'Dòng 4' });
    const incomeRow3 = mkTx({ id: 'inc3', rowIndex: 3, sheetType: 'Income', purchaseItem: 'Thu nhập 3' });
    const concurrentAdded = mkTx({ id: 'new1', rowIndex: 4, sheetType: 'Expenses', purchaseItem: 'Thêm song song' });

    const currentAfterOptimisticDelete = [row2, row4Shifted, incomeRow3, concurrentAdded];
    const rolledBack = rollbackDeletedRecord(currentAfterOptimisticDelete, row3Deleted)!;

    assert.equal(rolledBack.length, 5);
    assert.equal(rolledBack.find((r) => r.id === 'r2')?.rowIndex, 2);
    assert.equal(rolledBack.find((r) => r.id === 'r3')?.rowIndex, 3);
    assert.equal(rolledBack.find((r) => r.id === 'r4')?.rowIndex, 4); // shifted back 3 -> 4
    assert.equal(rolledBack.find((r) => r.id === 'new1')?.rowIndex, 5); // concurrent row preserved & shifted 4 -> 5
    assert.equal(rolledBack.find((r) => r.id === 'inc3')?.rowIndex, 3); // different tab untouched

    const rolledList = rollbackDeletedListRecord([row2], row3Deleted);
    assert.equal(rolledList.length, 2);
    assert.equal(rolledList[1].id, 'r3');
  });

  it('helper utilities generate valid txId, row signature, and detect conflict errors', () => {
    const id = generateTxId('bt');
    assert.ok(id.length > 8);
    const sig = buildRowSignature({ purchaseDate: ' 10/25/2026 ', amount: 50000, purchaseItem: ' Cơm ' });
    assert.deepEqual(sig, { purchaseDate: '10/25/2026', amount: 50000, purchaseItem: 'Cơm' });

    assert.equal(isSyncConflictError({ conflict: true }), true);
    assert.equal(isSyncConflictError({ code: 'NOT_FOUND' }), true);
    assert.equal(isSyncConflictError({ code: 'SIGNATURE_MISMATCH' }), true);
    assert.equal(isSyncConflictError(new Error('Network error')), false);
  });
});

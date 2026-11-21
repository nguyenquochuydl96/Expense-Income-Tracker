# AUDIT BUNDLE: EXPENSE & INCOME TRACKER (HEO & MÈO FINANCE)

> **Mục đích**: Tổng hợp toàn bộ mã nguồn nghiệp vụ cốt lõi (Core Business Logic, Sync, Accounting, Storage, Security, Calculations, Master Test Runner) để phục vụ kiểm toán, audit mã nguồn và kiểm thử độc lập.
> **Ghi chú bảo mật**: Toàn bộ Google Apps Script Web App URL, Google Sheet ID, API Key, PIN secret và token cấu hình đã được tự động che thành `[REDACTED]`.

## MỤC LỤC TÀI LIỆU

### 1. Tầng đồng bộ Google Sheets, Apps Script, Storage & State Quản lý Giao dịch
*Bao gồm toàn bộ API client, Apps Script Web App (backend GAS), cơ chế lưu trữ offline-first, schema dữ liệu và state machine trong App.tsx.*

- [apps-script/Code.gs](#duong-dan-appsscriptcodegs)
- [src/services/appsScriptService.ts](#duong-dan-srcservicesappsscriptservicets)
- [src/services/googleSheetsService.ts](#duong-dan-srcservicesgooglesheetsservicets)
- [src/services/authStorage.ts](#duong-dan-srcservicesauthstoragets)
- [src/types/finance.ts](#duong-dan-srctypesfinancets)
- [src/utils/csvParser.ts](#duong-dan-srcutilscsvparserts)
- [src/App.tsx](#duong-dan-srcapptsx)

### 2. Logic Kế toán & Công thức Tài chính Cốt lõi
*Chu kỳ BE Corp (26-25), Thẻ tín dụng (20-19), Đa tháng Rollover, computeNormalizedMonthMap O(1), Quỹ sinh hoạt ngày (Runway), Tốc độ đốt tiền (Burn Rate), Hoàn tiền âm và Tách biệt giao dịch [Transfer].*

- [src/utils/cycleUtils.ts](#duong-dan-srcutilscycleutilsts)
- [src/utils/budgetUtils.ts](#duong-dan-srcutilsbudgetutilsts)
- [src/components/DailyLivingRunwayWidget.tsx](#duong-dan-srccomponentsdailylivingrunwaywidgettsx)

### 3. Smart Money Calculator Parser
*Bộ phân tích biểu thức toán học (+, -, *, /), chữ viết tắt tiếng Việt (k, K, tr, m, M) và tiếng lóng/nói (1tr5, 2tr2), kèm UI input component.*

- [src/utils/mathExpression.ts](#duong-dan-srcutilsmathexpressionts)
- [src/components/MoneyCalculatorInput.tsx](#duong-dan-srccomponentsmoneycalculatorinputtsx)

### 4. Lock Screen (PIN), Privacy Mode & Xuất Sổ Tài Chính Tháng
*Màn hình khóa PIN bảo mật, mã hóa hash, che số dư riêng tư (Privacy Masking), và hàm xuất Sổ tài chính tháng (PNG Canvas Infographic Card + Sao chép văn bản).*

- [src/components/AppLockScreen.tsx](#duong-dan-srccomponentsapplockscreentsx)
- [src/utils/privacyService.ts](#duong-dan-srcutilsprivacyservicets)
- [src/components/MonthlyReportCardModal.tsx](#duong-dan-srccomponentsmonthlyreportcardmodaltsx)

### 5. Package Manifest & Master Test Runner E2E
*Cấu hình thư viện/dependencies (package.json) và bộ chạy kiểm thử hợp nhất (master_runner.js) bảo đảm 218/218 test pass.*

- [package.json](#duong-dan-packagejson)
- [tests/e2e/master_runner.js](#duong-dan-testse2emasterrunnerjs)

---

# PHẦN 1: 1. TẦNG ĐỒNG BỘ GOOGLE SHEETS, APPS SCRIPT, STORAGE & STATE QUẢN LÝ GIAO DỊCH

> Bao gồm toàn bộ API client, Apps Script Web App (backend GAS), cơ chế lưu trữ offline-first, schema dữ liệu và state machine trong App.tsx.

## Đường dẫn: `apps-script/Code.gs` <a id="duong-dan-appsscriptcodegs"></a>

```javascript
/**
 * =========================================================================
 * HEOMEO FINANCE - WEB APP REST API (GOOGLE APPS SCRIPT)
 * =========================================================================
 * Hướng dẫn cài đặt Web App API:
 * 1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ mã nguồn này vào tệp Code.gs.
 * 3. Bấm Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment)
 *    -> Loại: Ứng dụng web (Web app)
 *    -> Thực thi dưới dạng: Tôi (Me)
 *    -> Ai có quyền truy cập: Bất kỳ ai (Anyone)
 *    -> Bấm Triển khai -> Sao chép URL ứng dụng web (Web App URL).
 * 4. Dán URL này vào mục "Đồng bộ Google Sheets" trên ứng dụng Heo & Mèo.
 * =========================================================================
 */

// ==================== CẤU HÌNH (CONFIGURATION) ====================
const CONFIG = {
  // 1. Mã bảo vệ gia đình (Tùy chọn - Dành cho Web/Mobile App)
  // Nếu điền (VD: 'heomeo2026'), chỉ người có mã này mới đọc/ghi dữ liệu vào Sheet được
  API_SECRET_KEY: '[REDACTED]',

  // 2. Cấu hình định mức
  BE_CORP_ALLOWANCE: 2500000, // 2.5 triệu / tháng (chu kỳ 26 -> 25)
};

// Danh mục chuẩn đồng bộ 100% với Web App & Sheet 'Source data validation'
const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Thuê nhà',
  'Hóa/Mỹ phẩm',
  'Thú cưng',
  'Giải trí Heo',
  'Giải trí Mèo',
  'Điện thoại/Xăng xe',
  'Tiết kiệm',
  'Quà tặng/Cưới hỏi',
  'Shopping',
  'Sức khỏe',
  'Du lịch',
  'Khác'
];

const INCOME_CATEGORIES = [
  'Lương Yes4All',
  'Lương BE',
  'Công đoàn Yes4All',
  'Công đoàn BE',
  'Chứng khoán',
  'Bán hàng',
  'Lương Heo',
  'Lương Mèo',
  'Khác'
];

// ==================== ROUTER: WEB APP API ====================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No content received' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.action) {
      return handleApiRequest(payload);
    }

    return jsonResponse({ success: false, error: 'Unknown payload format' });
  } catch (err) {
    Logger.log('Lỗi trong doPost: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : null;
    if (action) {
      return handleApiRequest(e.parameter);
    }
    return jsonResponse({
      success: true,
      message: 'HeoMeo Finance Web App API is running smoothly!',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== XỬ LÝ REST API CHO WEB & MOBILE APP ====================
function handleApiRequest(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = params.action;

    // Kiểm tra API Key (Nếu có cấu hình CONFIG.API_SECRET_KEY)
    if (CONFIG.API_SECRET_KEY && params.apiKey !== CONFIG.API_SECRET_KEY) {
      return jsonResponse({ success: false, error: 'Mã khóa bảo vệ không đúng (Invalid API Key)' });
    }

    // 1. PING / TEST KẾT NỐI
    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'Kết nối thành công với Google Sheet!',
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. ĐỌC METADATA
    if (action === 'getMetadata') {
      const sheets = ss.getSheets();
      const sheetNames = sheets.map(s => s.getName());
      return jsonResponse({
        success: true,
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        sheetNames: sheetNames,
        expensesTab: sheetNames.includes('Expenses') ? 'Expenses' : sheetNames[0],
        incomeTab: sheetNames.includes('Income') ? 'Income' : 'Income',
        budgetTransfersTab: sheetNames.find(n => /budget transfer|transfer/i.test(n)) || 'Budget Transfers',
        checkTienTab: sheetNames.find(n => /check tiền|check tien|check/i.test(n)) || null,
        summaryTab: sheetNames.find(n => /monthly overview|summary|overview/i.test(n)) || null
      });
    }

    // 3. ĐỒNG BỘ TOÀN BỘ DỮ LIỆU (EXPENSES, INCOME, TRANSFERS) TRONG 1 REQUEST
    if (action === 'syncAll' || action === 'fetchData') {
      const sheets = ss.getSheets();
      const sheetNames = sheets.map(s => s.getName());

      const expensesTab = sheetNames.includes('Expenses') ? 'Expenses' : sheetNames[0];
      const incomeTab = sheetNames.includes('Income') ? 'Income' : 'Income';
      const btTab = sheetNames.find(n => /budget transfer|transfer/i.test(n)) || 'Budget Transfers';
      const checkTienTab = sheetNames.find(n => /check tiền|check tien|check/i.test(n)) || null;
      const summaryTab = sheetNames.find(n => /monthly overview|summary|overview/i.test(n)) || null;

      const metadata = {
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        sheetNames: sheetNames,
        expensesTab: expensesTab,
        incomeTab: incomeTab,
        budgetTransfersTab: btTab,
        checkTienTab: checkTienTab,
        summaryTab: summaryTab
      };

      // Đọc Expenses
      const expenses = [];
      const expSheet = ss.getSheetByName(expensesTab);
      if (expSheet) {
        const lastRow = expSheet.getLastRow();
        if (lastRow >= 2) {
          const values = expSheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
          for (let i = 0; i < values.length; i++) {
            const row = values[i];
            const dateStr = (row[0] || '').trim();
            const cat = (row[1] || '').trim();
            const item = (row[2] || '').trim();
            const amtStr = (row[3] || '').replace(/[^0-9.-]/g, '');
            const amount = parseFloat(amtStr) || 0;
            const beCorp = parseFloat((row[4] || '').replace(/[^0-9.-]/g, '')) || 0;
            const credit = parseFloat((row[5] || '').replace(/[^0-9.-]/g, '')) || 0;
            const note = (row[6] || '').trim();

            if (dateStr || cat || item || amount > 0) {
              expenses.push({
                id: 'exp-' + (i + 2) + '-' + dateStr,
                rowIndex: i + 2,
                purchaseDate: dateStr,
                category: cat,
                purchaseItem: item,
                amount: amount,
                beCorp: beCorp,
                credit: credit,
                note: note,
                sheetType: 'Expenses'
              });
            }
          }
        }
      }

      // Đọc Income
      const income = [];
      const incSheet = ss.getSheetByName(incomeTab);
      if (incSheet) {
        const lastRow = incSheet.getLastRow();
        if (lastRow >= 2) {
          const values = incSheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
          for (let i = 0; i < values.length; i++) {
            const row = values[i];
            const dateStr = (row[0] || '').trim();
            const cat = (row[1] || '').trim();
            const item = (row[2] || '').trim();
            const amtStr = (row[3] || '').replace(/[^0-9.-]/g, '');
            const amount = parseFloat(amtStr) || 0;
            const monthStr = (row[4] || '').trim();

            if (dateStr || cat || item || amount > 0) {
              income.push({
                id: 'inc-' + (i + 2) + '-' + dateStr,
                rowIndex: i + 2,
                purchaseDate: dateStr,
                category: cat,
                purchaseItem: item,
                amount: amount,
                note: monthStr,
                sheetType: 'Income'
              });
            }
          }
        }
      }

      // Đọc Budget Transfers
      const budgetTransfers = [];
      const btSheet = ss.getSheetByName(btTab);
      if (btSheet) {
        const lastRow = btSheet.getLastRow();
        if (lastRow >= 2) {
          const values = btSheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
          for (let i = 0; i < values.length; i++) {
            const row = values[i];
            const dateStr = (row[0] || '').trim();
            const fromCat = (row[1] || '').trim();
            const toCat = (row[2] || '').trim();
            const amtStr = (row[3] || '').replace(/[^0-9.-]/g, '');
            const amount = parseFloat(amtStr) || 0;
            const desc = (row[4] || '').trim();
            const monthStr = (row[5] || '').trim();

            if (dateStr || fromCat || toCat || amount > 0) {
              budgetTransfers.push({
                id: 'bt-' + (i + 2) + '-' + dateStr,
                rowIndex: i + 2,
                date: dateStr,
                fromCategory: fromCat,
                toCategory: toCat,
                amount: amount,
                description: desc,
                month: monthStr
              });
            }
          }
        }
      }

      return jsonResponse({
        success: true,
        metadata: metadata,
        expenses: expenses,
        income: income,
        budgetTransfers: budgetTransfers,
        totalExpenses: expenses.length,
        totalIncome: income.length,
        totalTransfers: budgetTransfers.length
      });
    }

    // 4. THÊM GIAO DỊCH MỚI (EXPENSES HOẶC INCOME)
    if (action === 'appendTransaction') {
      const tabName = params.tabName || 'Expenses';
      const sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
      const rec = params.record || {};
      const isIncome = tabName.toLowerCase().includes('income') || rec.sheetType === 'Income';

      // Quét cột A để tìm dòng trống đầu tiên
      const colAValues = sheet.getRange("A:A").getValues();
      let targetRow = 1;
      for (let i = colAValues.length - 1; i >= 0; i--) {
        if (colAValues[i][0] !== "" && colAValues[i][0] !== null && colAValues[i][0] !== undefined) {
          targetRow = i + 2;
          break;
        }
      }
      if (targetRow < 2) targetRow = 2;

      if (isIncome) {
        const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
        sheet.getRange(targetRow, 1, 1, 5).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0,
          monthFormula
        ]]);
      } else {
        sheet.getRange(targetRow, 1, 1, 7).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0,
          rec.beCorp !== undefined && rec.beCorp !== '' && !isNaN(rec.beCorp) && Number(rec.beCorp) !== 0 ? rec.beCorp : '',
          rec.credit !== undefined && rec.credit !== '' && !isNaN(rec.credit) && Number(rec.credit) !== 0 ? rec.credit : '',
          rec.note ? rec.note : ''
        ]]);
      }

      return jsonResponse({
        success: true,
        rowIndex: targetRow,
        tabName: tabName,
        message: 'Đã thêm dòng mới vào hàng ' + targetRow
      });
    }

    // 5. THÊM ĐIỀU CHUYỂN NGÂN SÁCH (BUDGET TRANSFERS)
    if (action === 'appendBudgetTransfer') {
      const tabName = params.tabName || 'Budget Transfers';
      const sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
      const t = params.transfer || {};

      const colAValues = sheet.getRange("A:A").getValues();
      let targetRow = 1;
      for (let i = colAValues.length - 1; i >= 0; i--) {
        if (colAValues[i][0] !== "" && colAValues[i][0] !== null && colAValues[i][0] !== undefined) {
          targetRow = i + 2;
          break;
        }
      }
      if (targetRow < 2) targetRow = 2;

      const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
      sheet.getRange(targetRow, 1, 1, 6).setValues([[
        t.date || '',
        t.fromCategory || '',
        t.toCategory || '',
        t.amount || 0,
        t.description || '',
        monthFormula
      ]]);

      return jsonResponse({
        success: true,
        rowIndex: targetRow,
        message: 'Đã thêm điều chuyển vào hàng ' + targetRow
      });
    }

    // 6. CẬP NHẬT GIAO DỊCH
    if (action === 'updateTransaction') {
      const tabName = params.tabName || 'Expenses';
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

      const rowIndex = parseInt(params.rowIndex, 10);
      if (!rowIndex || rowIndex < 2) return jsonResponse({ success: false, error: 'Dòng không hợp lệ' });

      const rec = params.record || {};
      const isIncome = tabName.toLowerCase().includes('income') || rec.sheetType === 'Income';

      if (isIncome) {
        const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
        sheet.getRange(rowIndex, 1, 1, 5).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0,
          monthFormula
        ]]);
      } else {
        sheet.getRange(rowIndex, 1, 1, 7).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0,
          rec.beCorp !== undefined && rec.beCorp !== '' && !isNaN(rec.beCorp) && Number(rec.beCorp) !== 0 ? rec.beCorp : '',
          rec.credit !== undefined && rec.credit !== '' && !isNaN(rec.credit) && Number(rec.credit) !== 0 ? rec.credit : '',
          rec.note ? rec.note : ''
        ]]);
      }

      return jsonResponse({
        success: true,
        rowIndex: rowIndex,
        message: 'Đã cập nhật dòng #' + rowIndex
      });
    }

    // 7. XÓA GIAO DỊCH
    if (action === 'deleteTransaction') {
      const tabName = params.tabName || 'Expenses';
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

      const rowIndex = parseInt(params.rowIndex, 10);
      if (!rowIndex || rowIndex < 2) return jsonResponse({ success: false, error: 'Dòng không hợp lệ' });

      sheet.deleteRow(rowIndex);
      return jsonResponse({
        success: true,
        rowIndex: rowIndex,
        message: 'Đã xóa dòng #' + rowIndex
      });
    }

    return jsonResponse({ success: false, error: 'Yêu cầu không được hỗ trợ: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}
```

---

## Đường dẫn: `src/services/appsScriptService.ts` <a id="duong-dan-srcservicesappsscriptservicets"></a>

```typescript
import { BudgetTransferRecord, SheetTabType, TransactionRecord } from '../types/finance';
import { parseDateString } from '../utils/csvParser';
import { SpreadsheetMetadata } from './googleSheetsService';

export const STORAGE_KEY_WEB_APP_URL = 'heomeo_apps_script_url_v1';
export const STORAGE_KEY_WEB_APP_KEY = 'heomeo_apps_script_key_v1';
export const STORAGE_KEY_CONNECTION_MODE = 'heomeo_connection_mode_v1'; // 'webapp' | 'oauth'

export const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/[REDACTED]/exec';

export function isAppsScriptUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return clean.includes('script.google.com') && (clean.includes('/macros/s/') || clean.includes('/exec'));
}

export function getStoredWebAppUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEB_APP_URL);
    if (saved && isAppsScriptUrl(saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_WEB_APP_URL;
}

export function saveStoredWebAppUrl(url: string) {
  try {
    localStorage.setItem(STORAGE_KEY_WEB_APP_URL, url.trim());
  } catch {
    // ignore
  }
}

export function getStoredWebAppKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY_WEB_APP_KEY);
    if (key && key.trim()) return key.trim();
  } catch {
    // ignore
  }
  return '[REDACTED]';
}

export function saveStoredWebAppKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY_WEB_APP_KEY, key.trim());
  } catch {
    // ignore
  }
}

export function getConnectionMode(): 'webapp' | 'oauth' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONNECTION_MODE);
    if (saved === 'oauth' || saved === 'webapp') return saved;
    // Default to 'webapp' if web app url exists
    if (getStoredWebAppUrl()) return 'webapp';
  } catch {
    // ignore
  }
  return 'webapp';
}

export function setConnectionMode(mode: 'webapp' | 'oauth') {
  try {
    localStorage.setItem(STORAGE_KEY_CONNECTION_MODE, mode);
  } catch {
    // ignore
  }
}

/**
 * Universal caller for Google Apps Script Web App
 * Uses text/plain body to prevent CORS preflight OPTIONS issues in browsers
 */
async function callAppsScriptApi(webAppUrl: string, payload: any): Promise<any> {
  const cleanUrl = webAppUrl.trim();
  const storedKey = getStoredWebAppKey();
  if (storedKey && !payload.apiKey) {
    payload.apiKey = storedKey;
  }

  // First try GET if it's a read action for fastest caching & simplicity
  if (payload.action === 'ping' || payload.action === 'syncAll' || payload.action === 'getMetadata') {
    const params = new URLSearchParams();
    Object.keys(payload).forEach((k) => {
      if (payload[k] !== undefined && payload[k] !== null) {
        params.append(k, String(payload[k]));
      }
    });
    // Add cache buster
    params.append('_t', String(Date.now()));

    try {
      const getUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}${params.toString()}`;
      const res = await fetch(getUrl, {
        method: 'GET',
        redirect: 'follow',
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Fallback to POST below
    }
  }

  // POST with text/plain to avoid preflight OPTIONS block
  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Apps Script trả về lỗi (${res.status}): ${errText.slice(0, 100)}`);
  }

  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error || 'Thao tác trên Google Sheet thất bại');
  }
  return json;
}

export interface AppsScriptSyncResult {
  metadata: SpreadsheetMetadata;
  expenses: TransactionRecord[];
  income: TransactionRecord[];
  budgetTransfers: BudgetTransferRecord[];
}

export async function appsScriptPing(webAppUrl: string, apiKey?: string): Promise<{ success: boolean; title?: string }> {
  return await callAppsScriptApi(webAppUrl, { action: 'ping', apiKey });
}

export async function appsScriptSyncAll(webAppUrl: string, apiKey?: string): Promise<AppsScriptSyncResult> {
  const res = await callAppsScriptApi(webAppUrl, { action: 'syncAll', apiKey });

  const rawMeta = res.metadata || {};
  const metadata: SpreadsheetMetadata = {
    spreadsheetId: webAppUrl,
    title: rawMeta.title || 'Expense & Income Tracker',
    sheetNames: rawMeta.sheetNames || ['Expenses', 'Income', 'Monthly Overview', 'Budget Transfers'],
    expensesTab: rawMeta.expensesTab || 'Expenses',
    incomeTab: rawMeta.incomeTab || 'Income',
    checkTienTab: rawMeta.checkTienTab || null,
    summaryTab: rawMeta.summaryTab || null,
    budgetTransfersTab: rawMeta.budgetTransfersTab || 'Budget Transfers',
  };

  const expenses: TransactionRecord[] = (res.expenses || [])
    .filter((r: any) => {
      const amt = Number(r.amount) || 0;
      const be = Number(r.beCorp) || 0;
      const cr = Number(r.credit) || 0;
      const item = (r.purchaseItem || '').trim();
      const cat = (r.category || '').trim();
      const note = (r.note || '').trim();
      return amt !== 0 || be !== 0 || cr !== 0 || (item !== '' && item !== '(Không ghi nội dung)') || cat !== '' || note !== '';
    })
    .map((r: any, idx: number) => {
    const parsedDate = parseDateString(r.purchaseDate);
    return {
      id: r.id || `exp-${r.rowIndex || idx + 2}-${r.purchaseDate}`,
      rowIndex: r.rowIndex || idx + 2,
      sheetType: 'Expenses' as SheetTabType,
      purchaseDate: r.purchaseDate || '',
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: r.category || '',
      purchaseItem: r.purchaseItem || '',
      amount: Number(r.amount) || 0,
      beCorp: Number(r.beCorp) || 0,
      credit: Number(r.credit) || 0,
      note: r.note || '',
      source: 'google_sheet',
      syncedToSheet: true,
    };
  });

  const income: TransactionRecord[] = (res.income || [])
    .filter((r: any) => {
      const amt = Number(r.amount) || 0;
      const item = (r.purchaseItem || '').trim();
      const cat = (r.category || '').trim();
      const note = (r.note || '').trim();
      return amt !== 0 || (item !== '' && item !== '(Không ghi nội dung)') || cat !== '' || note !== '';
    })
    .map((r: any, idx: number) => {
    const parsedDate = parseDateString(r.purchaseDate);
    return {
      id: r.id || `inc-${r.rowIndex || idx + 2}-${r.purchaseDate}`,
      rowIndex: r.rowIndex || idx + 2,
      sheetType: 'Income' as SheetTabType,
      purchaseDate: r.purchaseDate || '',
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: r.category || '',
      purchaseItem: r.purchaseItem || '',
      amount: Number(r.amount) || 0,
      beCorp: 0,
      credit: 0,
      note: r.note || '',
      source: 'google_sheet',
      syncedToSheet: true,
    };
  });

  const budgetTransfers: BudgetTransferRecord[] = (res.budgetTransfers || []).map((t: any, idx: number) => {
    const parsedDate = parseDateString(t.date);
    return {
      id: t.id || `bt-${t.rowIndex || idx + 2}-${t.date}`,
      rowIndex: t.rowIndex || idx + 2,
      date: t.date || '',
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      fromCategory: t.fromCategory || '',
      toCategory: t.toCategory || '',
      amount: Number(t.amount) || 0,
      description: t.description || '',
      source: 'google_sheet',
      syncedToSheet: true,
    };
  });

  return { metadata, expenses, income, budgetTransfers };
}

export async function appsScriptAppendTransaction(
  webAppUrl: string,
  tabName: string,
  record: {
    sheetType?: SheetTabType;
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
  },
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendTransaction',
    tabName,
    record,
    apiKey,
  });
}

export async function appsScriptUpdateTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  record: {
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
  },
  apiKey?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'updateTransaction',
    tabName,
    rowIndex,
    record,
    apiKey,
  });
}

export async function appsScriptDeleteTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  apiKey?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'deleteTransaction',
    tabName,
    rowIndex,
    apiKey,
  });
}

export async function appsScriptAppendTransfer(
  webAppUrl: string,
  transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
  },
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendBudgetTransfer',
    tabName: 'Budget Transfers',
    transfer,
    apiKey,
  });
}
```

---

## Đường dẫn: `src/services/googleSheetsService.ts` <a id="duong-dan-srcservicesgooglesheetsservicets"></a>

```typescript
import { BudgetTransferRecord, CheckTienSheetData, SheetTabType, TransactionRecord } from '../types/finance';
import { parseDateString, parseSheetNumber } from '../utils/csvParser';
import {
  isAppsScriptUrl,
  appsScriptSyncAll,
  appsScriptAppendTransaction,
  appsScriptUpdateTransaction,
  appsScriptDeleteTransaction,
  appsScriptAppendTransfer,
} from './appsScriptService';

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
  expensesTab: string;
  incomeTab: string;
  checkTienTab: string | null;
  summaryTab: string | null;
  budgetTransfersTab: string | null;
  sheetIdsByName?: Record<string, number>;
}

export interface SummarySheetData {
  sheetName: string;
  formattedRows: string[][];
  formulaRows: string[][];
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (isAppsScriptUrl(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function findMatchingTab(sheetNames: string[], candidates: string[], fallback: string): string {
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  for (const candidate of lowerCandidates) {
    const exact = sheetNames.find((name) => name.trim().toLowerCase() === candidate);
    if (exact) return exact;
  }
  for (const candidate of lowerCandidates) {
    const partial = sheetNames.find((name) => name.toLowerCase().includes(candidate));
    if (partial) return partial;
  }
  return fallback;
}

export async function fetchSpreadsheetMetadata(
  spreadsheetIdOrUrl: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  if (isAppsScriptUrl(spreadsheetIdOrUrl)) {
    const result = await appsScriptSyncAll(spreadsheetIdOrUrl);
    return result.metadata;
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties(title,sheetId)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${msg})`);
    }
    throw new Error(`Không thể kết nối Google Sheet: ${msg}`);
  }

  const data = await res.json();
  const sheetNames: string[] = (data.sheets || []).map((s: any) => s.properties?.title || '');
  const sheetIdsByName: Record<string, number> = {
    'Expenses': 1528073380,
    'Income': 392215035,
  };
  (data.sheets || []).forEach((s: any) => {
    if (s.properties?.title && s.properties?.sheetId !== undefined) {
      sheetIdsByName[s.properties.title] = s.properties.sheetId;
    }
  });

  const expensesTab = findMatchingTab(
    sheetNames,
    ['expenditure', 'expenses', 'chi tiêu', 'chi tieu', 'expense', 'chi'],
    sheetNames[0] || 'Expenditure'
  );
  const incomeTab = findMatchingTab(
    sheetNames,
    ['income', 'thu nhập', 'thu nhap', 'thu', 'lương', 'salary', 'incomes', 'sheet income'],
    sheetNames.find((s) => /income|thu|lương/i.test(s)) || (sheetNames.includes('Income') ? 'Income' : (sheetNames.includes('Thu nhập') ? 'Thu nhập' : 'Income'))
  );
  const checkTienMatch = findMatchingTab(sheetNames, ['check tiền', 'check tien', 'đối soát', 'reconcile', 'check'], '');
  const summaryMatch = findMatchingTab(sheetNames, ['summary', 'tổng hợp', 'tong hop', 'báo cáo', 'overview'], '');

  const savedIncomeTab = typeof window !== 'undefined' ? localStorage.getItem('heomeo_custom_income_tab_v1') : null;
  const finalIncomeTab = savedIncomeTab && sheetNames.includes(savedIncomeTab) ? savedIncomeTab : incomeTab;

  const savedExpensesTab = typeof window !== 'undefined' ? localStorage.getItem('heomeo_custom_expenses_tab_v1') : null;
  const finalExpensesTab = savedExpensesTab && sheetNames.includes(savedExpensesTab) ? savedExpensesTab : expensesTab;

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || 'Expense & Income Tracker',
    sheetNames,
    expensesTab: finalExpensesTab,
    incomeTab: finalIncomeTab,
    checkTienTab: checkTienMatch || null,
    summaryTab: summaryMatch || null,
    budgetTransfersTab: sheetNames.find((n) => /budget transfer|transfer/i.test(n)) || null,
    sheetIdsByName,
  };
}

export async function fetchTabTransactions(
  spreadsheetId: string,
  tabName: string,
  sheetType: SheetTabType,
  accessToken: string
): Promise<TransactionRecord[]> {
  if (isAppsScriptUrl(spreadsheetId)) {
    const result = await appsScriptSyncAll(spreadsheetId);
    return sheetType === 'Expenses' ? result.expenses : result.income;
  }

  const safeTab = `'${tabName.replace(/'/g, "''")}'`;
  const range = `${safeTab}!A1:Z5000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.warn(`[fetchTabTransactions] Error reading ${tabName} (${res.status}):`, errBody);
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${errBody?.error?.message || ''})`);
    }
    if (res.status === 400 || res.status === 404) {
      return [];
    }
    throw new Error(errBody?.error?.message || `Không đọc được bảng ${tabName}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) return [];

  // Intelligent header and column detection separated by sheetType
  const header = (rows[0] || []).map((c) => (c || '').trim().toLowerCase());

  let dateIdx = -1;
  let categoryIdx = -1;
  let itemIdx = -1;
  let amountIdx = -1;
  let beCorpIdx = -1;
  let creditIdx = -1;
  let noteIdx = -1;

  if (sheetType === 'Expenses') {
    for (let c = 0; c < header.length; c++) {
      const h = header[c];
      if (dateIdx === -1 && /date|ngày|time|thời gian/i.test(h) && !/month|tháng/i.test(h)) dateIdx = c;
      else if (beCorpIdx === -1 && /be corp|becorp|be\s*corp/i.test(h)) beCorpIdx = c;
      else if (creditIdx === -1 && /credit|thẻ|tín dụng/i.test(h)) creditIdx = c;
      else if (amountIdx === -1 && /amount|số tiền|tiền|giá trị|thực nhận/i.test(h)) amountIdx = c;
      else if (categoryIdx === -1 && /category|hạng mục|danh mục|loại/i.test(h)) categoryIdx = c;
      else if (itemIdx === -1 && /item|nội dung|khoản|mô tả|tên|chi tiết/i.test(h)) itemIdx = c;
      else if (noteIdx === -1 && /note|ghi chú|bảng/i.test(h)) noteIdx = c;
    }
    if (dateIdx === -1) dateIdx = 0;
    if (categoryIdx === -1) categoryIdx = 1;
    if (itemIdx === -1) itemIdx = 2;
    if (amountIdx === -1) amountIdx = 3;
    if (beCorpIdx === -1) beCorpIdx = 4;
    if (creditIdx === -1) creditIdx = 5;
    if (noteIdx === -1) noteIdx = 6;
  } else {
    // sheetType === 'Income'
    // Header format: Date (0), Income Source (1), Description (2), Income Amount (3), Month (4)
    for (let c = 0; c < header.length; c++) {
      const h = header[c];
      if (dateIdx === -1 && /date|ngày|time|thời gian/i.test(h) && !/month|tháng/i.test(h)) dateIdx = c;
      else if (amountIdx === -1 && /income amount|amount|số tiền|tiền|giá trị|thực nhận/i.test(h)) amountIdx = c;
      else if (categoryIdx === -1 && /source|income source|nguồn|category|danh mục|hạng mục|loại/i.test(h)) categoryIdx = c;
      else if (itemIdx === -1 && /desc|description|item|mô tả|nội dung|khoản|chi tiết/i.test(h)) itemIdx = c;
      else if (noteIdx === -1 && /note|ghi chú/i.test(h)) noteIdx = c;
    }
    if (dateIdx === -1) dateIdx = 0;
    if (categoryIdx === -1) categoryIdx = 1;
    if (itemIdx === -1) itemIdx = 2;
    if (amountIdx === -1) amountIdx = 3;
  }

  const records: TransactionRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = dateIdx < row.length ? (row[dateIdx] || '').trim() : '';
    const rawCategory = categoryIdx !== -1 && categoryIdx < row.length ? (row[categoryIdx] || '').trim() : '';
    const rawItem = itemIdx !== -1 && itemIdx < row.length ? (row[itemIdx] || '').trim() : '';
    const rawAmount = amountIdx !== -1 && amountIdx < row.length ? (row[amountIdx] || '').trim() : '';
    const rawBeCorp = beCorpIdx !== -1 && beCorpIdx < row.length ? (row[beCorpIdx] || '').trim() : '';
    const rawCredit = creditIdx !== -1 && creditIdx < row.length ? (row[creditIdx] || '').trim() : '';
    const rawNote = noteIdx !== -1 && noteIdx < row.length ? (row[noteIdx] || '').trim() : '';

    if (!rawDate && !rawCategory && !rawItem && !rawAmount) continue;
    if (rawDate.toLowerCase() === 'purchase date' || rawDate.toLowerCase() === 'date') continue;

    const parsedDate = parseDateString(rawDate);
    const amount = parseSheetNumber(rawAmount);
    const beCorp = parseSheetNumber(rawBeCorp);
    const credit = parseSheetNumber(rawCredit);

    const hasContent = Boolean(
      (rawItem && rawItem.trim() !== '' && rawItem !== '(Không ghi nội dung)') ||
      (rawCategory && rawCategory.trim() !== '' && rawCategory !== 'Khác') ||
      (rawNote && rawNote.trim() !== '') ||
      amount !== 0 ||
      beCorp !== 0 ||
      credit !== 0
    );
    if (!hasContent) {
      continue;
    }

    records.push({
      id: `sheet-${sheetType}-${i + 1}`,
      rowIndex: i + 1,
      sheetType,
      purchaseDate: rawDate || parsedDate.displayDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: rawCategory || (sheetType === 'Income' ? 'Thu nhập' : 'Khác'),
      purchaseItem: rawItem || (sheetType === 'Income' ? rawCategory || 'Khoản thu' : '(Không ghi nội dung)'),
      amount,
      beCorp,
      credit,
      note: rawNote || undefined,
      source: 'google_sheet',
      syncedToSheet: true,
    });
  }

  return records;
}

export async function fetchCheckTienSheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<CheckTienSheetData | null> {
  const range = `'${tabName.replace(/'/g, "''")}'!A1:M120`;
  const [formattedRes, formulaRes] = await Promise.all([
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  if (!formattedRes.ok) return null;

  const formattedData = await formattedRes.json();
  const formulaData = formulaRes.ok ? await formulaRes.json() : { values: [] };

  const formattedRows: string[][] = formattedData.values || [];
  const formulaRows: string[][] = formulaData.values || [];

  const detectedSummary: { label: string; value: string; formula?: string }[] = [];

  for (let r = 0; r < formattedRows.length; r++) {
    const row = formattedRows[r] || [];
    const fRow = formulaRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      const formula = (fRow[c] || '').toString().trim();
      if (formula.startsWith('=')) {
        const leftLabel = c > 0 ? (row[c - 1] || '').trim() : '';
        const topLabel = r > 0 && formattedRows[r - 1] ? (formattedRows[r - 1][c] || '').trim() : '';
        const label = leftLabel || topLabel || `Ô ${String.fromCharCode(65 + c)}${r + 1}`;
        if (cell) {
          detectedSummary.push({ label, value: cell, formula });
        }
      }
    }
  }

  return {
    sheetName: tabName,
    formattedRows,
    formulaRows,
    detectedSummary,
  };
}

export async function fetchSummarySheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<SummarySheetData | null> {
  const range = `${tabName}!A1:Z100`;
  const [formattedRes, formulaRes] = await Promise.all([
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  if (!formattedRes.ok) return null;

  const formattedData = await formattedRes.json();
  const formulaData = formulaRes.ok ? await formulaRes.json() : { values: [] };

  return {
    sheetName: tabName,
    formattedRows: formattedData.values || [],
    formulaRows: formulaData.values || [],
  };
}

export const INCOME_TAB_HEADERS = ['Date', 'Income Source', 'Description', 'Income Amount', 'Month'];
export const EXPENSE_TAB_HEADERS = ['Purchase Date', 'Category', 'Purchase Item', 'Amount', 'BE Corp', 'Credit', 'Note'];
export const BUDGET_TRANSFER_HEADERS = ['Date', 'From Category', 'To Category', 'Amount', 'Description', 'Month'];

export async function createSheetTab(
  spreadsheetId: string,
  tabName: string,
  headerRow: string[],
  accessToken: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    if (!errBody?.error?.message?.includes('already exists')) {
      throw new Error(errBody?.error?.message || `Không thể tạo tab "${tabName}"`);
    }
  }

  // Write header row if newly created or empty
  const safeTab = `'${tabName.replace(/'/g, "''")}'`;
  const writeHeaderUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(safeTab + '!A1:Z1')}?valueInputOption=USER_ENTERED`;

  await fetch(writeHeaderUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [headerRow],
    }),
  }).catch(() => null);
}

export async function appendTransactionToSheet(
  spreadsheetId: string,
  tabName: string,
  record: {
    sheetType?: SheetTabType;
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
  },
  accessToken: string
): Promise<{ rowIndex?: number }> {
  if (isAppsScriptUrl(spreadsheetId)) {
    const asRes = await appsScriptAppendTransaction(spreadsheetId, tabName, record);
    return { rowIndex: asRes?.rowIndex };
  }

  const isIncome = record.sheetType === 'Income' || tabName.toLowerCase().includes('income');
  const safeTab = `'${tabName.replace(/'/g, "''")}'`;

  let rowValues: any[];
  let range: string;

  if (isIncome) {
    const parsedDate = parseDateString(record.purchaseDate);
    const monthDateStr = parsedDate.monthKey
      ? `${parseInt(parsedDate.monthKey.split('-')[1], 10)}/1/${parsedDate.monthKey.split('-')[0]}`
      : record.purchaseDate;

    // Income tab columns: Date (A), Income Source (B), Description (C), Income Amount (D), Month (E)
    rowValues = [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      monthDateStr,
    ];
    range = `${safeTab}!A:E`;
  } else {
    // Expenses tab columns: Date (A), Category (B), Purchase Item (C), Amount (D), BE Corp (E), Credit (F), Note (G)
    rowValues = [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      record.beCorp !== 0 ? record.beCorp : '',
      record.credit !== 0 ? record.credit : '',
    ];
    if (record.note && record.note.trim()) {
      rowValues.push(record.note.trim());
    }
    range = `${safeTab}!A:G`;
  }

  const sendAppend = async (): Promise<{ res: Response; targetRow?: number }> => {
    // 1. Try to find the exact next row based on Column A (to avoid being pushed by trailing formula cells in other columns)
    try {
      const colARange = `${safeTab}!A:A`;
      const colAUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(colARange)}?majorDimension=COLUMNS`;
      const colARes = await fetch(colAUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (colARes.ok) {
        const colAData = await colARes.json();
        const colAVals: any[] = colAData.values?.[0] || [];
        let lastFilledRow = 0;
        for (let i = 0; i < colAVals.length; i++) {
          if (colAVals[i] !== undefined && colAVals[i] !== null && String(colAVals[i]).trim() !== '') {
            lastFilledRow = i + 1;
          }
        }
        if (lastFilledRow > 0) {
          const targetRow = lastFilledRow + 1;
          const endCol = isIncome ? 'E' : 'G';
          const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            spreadsheetId
          )}/values/${encodeURIComponent(`${safeTab}!A${targetRow}:${endCol}${targetRow}`)}?valueInputOption=USER_ENTERED`;
          const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              majorDimension: 'ROWS',
              values: [rowValues],
            }),
          });
          if (putRes.ok) {
            return { res: putRes, targetRow };
          }
        }
      }
    } catch {
      // Fall back to append if Column A lookup fails
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`;

    const appendRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });
    return { res: appendRes };
  };

  let appendResult = await sendAppend();
  let res = appendResult.res;

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${msg})`);
    }

    if (
      msg.includes('Unable to parse range') ||
      msg.includes('not found') ||
      res.status === 400 ||
      res.status === 404
    ) {
      // Auto-create missing tab with standard headers and retry
      const defaultHeaders = isIncome ? INCOME_TAB_HEADERS : EXPENSE_TAB_HEADERS;
      await createSheetTab(spreadsheetId, tabName, defaultHeaders, accessToken);
      appendResult = await sendAppend();
      res = appendResult.res;
    }

    if (!res.ok) {
      const retryErr = await res.json().catch(() => ({}));
      const retryMsg = retryErr?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Không thể ghi dòng mới vào bảng ${tabName}: ${retryMsg}`);
    }
  }

  let finalRowIndex = appendResult.targetRow;
  if (!finalRowIndex) {
    try {
      const data = await res.json();
      const updatedRange = data?.updates?.updatedRange || '';
      const match = updatedRange.match(/![A-Za-z0-9_]*?[A-Z]+(\d+)/);
      if (match) {
        finalRowIndex = parseInt(match[1], 10);
      }
    } catch {
      // ignore
    }
  }

  return { rowIndex: finalRowIndex };
}

export async function fetchBudgetTransfersSheet(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<BudgetTransferRecord[]> {
  if (isAppsScriptUrl(spreadsheetId)) {
    const result = await appsScriptSyncAll(spreadsheetId);
    return result.budgetTransfers;
  }

  const range = `'${tabName.replace(/'/g, "''")}'!A2:F`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      return [];
    }
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Không thể đọc bảng ${tabName}: ${errBody?.error?.message || res.status}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const records: BudgetTransferRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[0]?.trim();
    const rawFrom = row[1]?.trim() || '';
    const rawTo = row[2]?.trim() || '';
    const rawAmount = row[3];
    const rawDesc = row[4]?.trim() || '';

    if (!rawDate && !rawFrom && !rawTo && !rawAmount) continue;

    const amount = parseSheetNumber(rawAmount);
    const parsedDate = parseDateString(rawDate);

    records.push({
      id: `bt-${i + 2}-${rawDate || 'undated'}`,
      rowIndex: i + 2,
      date: rawDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      fromCategory: rawFrom,
      toCategory: rawTo,
      amount,
      description: rawDesc,
      source: 'google_sheet',
      syncedToSheet: true,
    });
  }

  return records;
}

export async function appendBudgetTransferToSheet(
  spreadsheetId: string,
  tabName: string,
  transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
  },
  accessToken: string
): Promise<void> {
  if (isAppsScriptUrl(spreadsheetId)) {
    await appsScriptAppendTransfer(spreadsheetId, transfer);
    return;
  }

  const parsedDate = parseDateString(transfer.date);
  const monthDateStr = parsedDate.monthKey
    ? `${parseInt(parsedDate.monthKey.split('-')[1], 10)}/1/${parsedDate.monthKey.split('-')[0]}`
    : transfer.date;

  const rowValues = [
    transfer.date,
    transfer.fromCategory,
    transfer.toCategory,
    transfer.amount,
    transfer.description,
    monthDateStr,
  ];
  const safeTab = `'${tabName.replace(/'/g, "''")}'`;
  const range = `${safeTab}!A:F`;

  const sendAppend = async () => {
    // 1. Try to find the exact next row based on Column A (to avoid being pushed by trailing formula cells in other columns)
    try {
      const colARange = `${safeTab}!A:A`;
      const colAUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(colARange)}?majorDimension=COLUMNS`;
      const colARes = await fetch(colAUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (colARes.ok) {
        const colAData = await colARes.json();
        const colAVals: any[] = colAData.values?.[0] || [];
        let lastFilledRow = 0;
        for (let i = 0; i < colAVals.length; i++) {
          if (colAVals[i] !== undefined && colAVals[i] !== null && String(colAVals[i]).trim() !== '') {
            lastFilledRow = i + 1;
          }
        }
        if (lastFilledRow > 0) {
          const targetRow = lastFilledRow + 1;
          const endCol = 'F';
          const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            spreadsheetId
          )}/values/${encodeURIComponent(`${safeTab}!A${targetRow}:${endCol}${targetRow}`)}?valueInputOption=USER_ENTERED`;
          const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              majorDimension: 'ROWS',
              values: [rowValues],
            }),
          });
          if (putRes.ok) {
            return putRes;
          }
        }
      }
    } catch {
      // Fall back to append if Column A lookup fails
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`;

    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });
  };

  let res = await sendAppend();

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${msg})`);
    }

    if (
      msg.includes('Unable to parse range') ||
      msg.includes('not found') ||
      res.status === 400 ||
      res.status === 404
    ) {
      await createSheetTab(spreadsheetId, tabName, BUDGET_TRANSFER_HEADERS, accessToken);
      res = await sendAppend();
    }

    if (!res.ok) {
      const retryErr = await res.json().catch(() => ({}));
      const retryMsg = retryErr?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Không thể ghi chuyển ngân sách vào bảng ${tabName}: ${retryMsg}`);
    }
  }
}

/**
 * Updates an existing transaction row in Google Sheet by rowIndex
 */
export async function updateTransactionOnSheet(
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  record: {
    sheetType?: SheetTabType;
    purchaseDate: string;
    category: string;
    purchaseItem: string;
    amount: number;
    beCorp: number;
    credit: number;
    note?: string;
  },
  accessToken: string
): Promise<void> {
  if (isAppsScriptUrl(spreadsheetId)) {
    await appsScriptUpdateTransaction(spreadsheetId, tabName, rowIndex, record);
    return;
  }

  const isIncome = record.sheetType === 'Income' || tabName.toLowerCase().includes('income');
  const safeTab = `'${tabName.replace(/'/g, "''")}'`;

  let rowValues: any[];
  let range: string;

  if (isIncome) {
    const parsedDate = parseDateString(record.purchaseDate);
    const monthDateStr = parsedDate.monthKey
      ? `${parseInt(parsedDate.monthKey.split('-')[1], 10)}/1/${parsedDate.monthKey.split('-')[0]}`
      : record.purchaseDate;

    range = `${safeTab}!A${rowIndex}:E${rowIndex}`;
    rowValues = [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      monthDateStr,
    ];
  } else {
    range = `${safeTab}!A${rowIndex}:G${rowIndex}`;
    rowValues = [
      record.purchaseDate,
      record.category,
      record.purchaseItem,
      record.amount,
      record.beCorp !== 0 && !isNaN(record.beCorp) ? record.beCorp : '',
      record.credit !== 0 && !isNaN(record.credit) ? record.credit : '',
      record.note || '',
    ];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${errBody?.error?.message || ''})`);
    }
    throw new Error(errBody?.error?.message || `Không thể cập nhật dòng #${rowIndex} trên bảng ${tabName}`);
  }
}

/**
 * Deletes a row permanently from Google Sheet by rowIndex
 */
export async function deleteTransactionFromSheet(
  spreadsheetId: string,
  sheetId: number,
  rowIndex: number,
  accessToken: string,
  tabName?: string
): Promise<void> {
  if (isAppsScriptUrl(spreadsheetId)) {
    const finalTab = tabName || (sheetId === 392215035 ? 'Income' : 'Expenses');
    await appsScriptDeleteTransaction(spreadsheetId, finalTab, rowIndex);
    return;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}:batchUpdate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based index
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error(`TOKEN_EXPIRED: Token Google OAuth đã hết hạn (${errBody?.error?.message || ''})`);
    }
    throw new Error(errBody?.error?.message || `Không thể xóa dòng #${rowIndex} trên Google Sheet`);
  }
}
```

---

## Đường dẫn: `src/services/authStorage.ts` <a id="duong-dan-srcservicesauthstoragets"></a>

```typescript
const TOKEN_KEY = 'heomeo_google_access_token_v1';
const TOKEN_EXPIRY_KEY = 'heomeo_google_token_expiry_v1';

let cachedAccessToken: string | null = null;

export const saveAccessToken = (token: string, expiresInSecs = 3500) => {
  cachedAccessToken = token;
  const expiresAt = Date.now() + expiresInSecs * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  } catch (e) {
    console.warn('Cannot persist access token to localStorage', e);
  }
};

export const clearStoredAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // ignore
  }
};

export const getStoredAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiryStr) return null;
    const expiry = Number(expiryStr);
    // If token hasn't expired (leave 2 min safety buffer)
    if (Date.now() < expiry - 120000) {
      cachedAccessToken = token;
      return token;
    }
    clearStoredAccessToken();
    return null;
  } catch {
    return null;
  }
};

export const isStoredTokenExpired = (): boolean => {
  try {
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryStr) return true;
    return Date.now() >= Number(expiryStr);
  } catch {
    return true;
  }
};
```

---

## Đường dẫn: `src/types/finance.ts` <a id="duong-dan-srctypesfinancets"></a>

```typescript
export type SheetTabType = 'Expenses' | 'Income';

export interface TransactionRecord {
  id: string;
  rowIndex?: number;
  sheetType: SheetTabType;
  purchaseDate: string; // M/D/YYYY format as in Google Sheet, e.g. "10/25/2026"
  isoDate: string; // YYYY-MM-DD for sorting and cycle filtering
  monthKey: string; // YYYY-MM, e.g. "2026-10"
  category: string;
  purchaseItem: string;
  amount: number;
  beCorp: number;
  credit: number;
  note?: string;
  source: 'attached_csv' | 'google_sheet' | 'local_new';
  syncedToSheet?: boolean;
  syncing?: boolean; // true while background sync is in progress
}


export interface BudgetTransferRecord {
  id: string;
  rowIndex?: number;
  date: string; // M/D/YYYY format
  isoDate: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  fromCategory: string; // e.g. "Thu nhập riêng" or an Expense category
  toCategory: string; // Target category e.g. "Giải trí Heo"
  amount: number;
  description: string;
  source: 'google_sheet' | 'seed' | 'local_new';
  syncedToSheet?: boolean;
}

export interface CheckTienSheetData {
  sheetName: string;
  formattedRows: string[][];
  formulaRows: string[][];
  detectedSummary?: {
    label: string;
    value: string;
    formula?: string;
  }[];
}

export interface BillingCycleConfig {
  beCorpCycleType: 'monthly' | 'custom_day' | 'custom_range';
  beCorpStartDay: number; // e.g., 1 or 26
  beCorpStartDate: string; // YYYY-MM-DD
  beCorpEndDate: string; // YYYY-MM-DD
  beCorpBudget: number;
  creditCycleType: 'statement_day' | 'monthly' | 'custom_range';
  creditStatementDay: number; // e.g., 15 or 20 or 25
  creditStartDate: string; // YYYY-MM-DD
  creditEndDate: string; // YYYY-MM-DD
  creditLimit: number;
}

export interface RealWorldAccount {
  id: string;
  name: string;
  owner: 'Heo' | 'Mèo' | 'Chung';
  type: 'bank' | 'cash' | 'ewallet' | 'receivable';
  balance: number;
  includedInReconcile: boolean;
  note?: string;
}

export interface ItemSuggestion {
  item: string;
  category: string;
  lastAmount: number;
  count: number;
  typicalBeCorp: boolean;
  typicalCredit: boolean;
  sheetType?: SheetTabType;
}

export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Thuê nhà',
  'Hóa/Mỹ phẩm',
  'Thú cưng',
  'Giải trí Heo',
  'Giải trí Mèo',
  'Điện thoại/Xăng xe',
  'Tiết kiệm',
  'Quà tặng/Cưới hỏi',
  'Shopping',
  'Sức khỏe',
  'Du lịch',
  'Khác',
] as const;

export const INCOME_CATEGORIES = [
  'Lương Yes4All',
  'Lương BE',
  'Công đoàn Yes4All',
  'Công đoàn BE',
  'Chứng khoán',
  'Bán hàng',
  'Lương Heo',
  'Lương Mèo',
  'Khác',
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Ăn uống': '#0D9488',         // Teal 600
  'Tiết kiệm': '#2563EB',       // Blue 600
  'Thuê nhà': '#4F46E5',        // Indigo 600
  'Quà tặng/Cưới hỏi': '#E11D48', // Rose 600
  'Giải trí Heo': '#F43F5E',    // Rose 500 (Heo)
  'Giải trí Mèo': '#8B5CF6',    // Violet 500 (Mèo Xiêm)
  'Hóa/Mỹ phẩm': '#DB2777',     // Pink 600
  'Thú cưng': '#EA580C',        // Orange 600
  'Shopping': '#0284C7',        // Sky 600
  'Điện thoại/Xăng xe': '#475569', // Slate 600
  'Du lịch': '#059669',         // Emerald 600
  'Sức khỏe': '#16A34A',        // Green 600
  'Khác': '#64748B',            // Slate 500
};
```

---

## Đường dẫn: `src/utils/csvParser.ts` <a id="duong-dan-srcutilscsvparserts"></a>

```typescript
import { ItemSuggestion, SheetTabType, TransactionRecord } from '../types/finance';
import { isPrivacyActive } from './privacyService';

/**
 * Parses a number formatted like "6,548,000", "-4,100,000", "193,600", or "79000"
 */
export function parseSheetNumber(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;

  const str = raw.toString().trim();
  if (!str) return 0;

  let isNegative = false;
  if (str.includes('-')) {
    isNegative = true;
  }
  if (/^\(?\s*[$₫đ]?\s*\([^)]+\)\s*\)?$/.test(str) || /^\([^)]+\)$/.test(str)) {
    isNegative = true;
  }

  const cleaned = str
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/[$₫đ]/g, '')
    .replace(/VND/gi, '')
    .replace(/[()]/g, '')
    .replace(/-/g, '');

  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/**
 * Formats a number with thousand commas to match the user's Google Sheet ("48,000")
 */
export function formatNumberForSheet(
  val: number,
  showZero = false,
  forceVisible = false,
  showSign = false
): string {
  if (!val && !showZero) return '';
  if (!forceVisible && isPrivacyActive()) {
    return '••••••';
  }
  const formatted = Math.round(Math.abs(val)).toLocaleString('en-US');
  if (val < 0) return `-${formatted}`;
  if (val > 0 && showSign) return `+${formatted}`;
  return formatted;
}

/**
 * Formats a VND currency value for UI display
 */
export function formatCurrency(val: number, showSign = false, forceVisible = false): string {
  if (!forceVisible && isPrivacyActive()) {
    return '•••••• ₫';
  }
  const absFormatted = Math.abs(Math.round(val)).toLocaleString('en-US');
  if (val < 0) return `-${absFormatted} ₫`;
  if (val > 0 && showSign) return `+${absFormatted} ₫`;
  return `${absFormatted} ₫`;
}

/**
 * Converts YYYY-MM-DD input value into M/D/YYYY string matching the Google Sheet ("10/25/2026" or "4/1/2026")
 */
export function isoToSheetDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year}`;
}

/**
 * Parses M/D/YYYY (as used throughout the attached sheet: 4/1/2026 -> 4/30/2026 -> 10/25/2026)
 * into isoDate (YYYY-MM-DD), monthKey (YYYY-MM), and displayDate (M/D/YYYY).
 */
const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function parseDateString(rawDate: string): {
  isoDate: string;
  monthKey: string;
  displayDate: string;
  year: number;
  month: number;
  day: number;
} {
  const trimmed = (rawDate || '').trim();

  // 1. Match English Month Name (e.g. "April 2026", "October 2026", "October")
  const engMatch = trimmed.match(/^([a-zA-Z]+)(?:[\s,/-]+(\d{4}))?$/);
  if (engMatch && ENGLISH_MONTHS[engMatch[1].toLowerCase()]) {
    const m = ENGLISH_MONTHS[engMatch[1].toLowerCase()];
    const y = engMatch[2] ? parseInt(engMatch[2], 10) : 2026;
    const mm = String(m).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 2. Match Vietnamese Month (e.g. "Tháng 10/2026", "Tháng 4", "T10/2026", "T4")
  const vnMatch = trimmed.match(/^t(?:háng)?\s*(\d{1,2})(?:[\/\s-]+(\d{4}))?$/i);
  if (vnMatch) {
    const m = parseInt(vnMatch[1], 10);
    const y = vnMatch[2] ? parseInt(vnMatch[2], 10) : 2026;
    const mm = String(Math.max(1, Math.min(12, m))).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 3. Match M/D/YYYY or M/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    let m = parseInt(slashParts[0], 10);
    let d = parseInt(slashParts[1], 10);
    let y = parseInt(slashParts[2], 10);
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      const temp = m;
      m = d;
      d = temp;
    }
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    const dd = String(Math.max(1, Math.min(31, d || 1))).padStart(2, '0');
    const yyyy = y || 2026;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      monthKey: `${yyyy}-${mm}`,
      displayDate: `${m}/${d}/${yyyy}`,
      year: yyyy,
      month: m,
      day: d,
    };
  }

  if (slashParts.length === 2) {
    let m = parseInt(slashParts[0], 10);
    let y = parseInt(slashParts[1], 10);
    if (m > 100 && y <= 12) {
      const temp = m;
      m = y;
      y = temp;
    }
    if (y < 100) y += 2000;
    const mm = String(Math.max(1, Math.min(12, m || 1))).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  // 4. Match YYYY-MM-DD or YYYY-MM
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const y = parseInt(dashParts[0], 10) || 2026;
    const m = parseInt(dashParts[1], 10) || 10;
    const d = parseInt(dashParts[2], 10) || 1;
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-${dd}`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/${d}/${y}`,
      year: y,
      month: m,
      day: d,
    };
  }

  if (dashParts.length === 2 && dashParts[0].length === 4) {
    const y = parseInt(dashParts[0], 10) || 2026;
    const m = parseInt(dashParts[1], 10) || 10;
    const mm = String(m).padStart(2, '0');
    return {
      isoDate: `${y}-${mm}-01`,
      monthKey: `${y}-${mm}`,
      displayDate: `${m}/1/${y}`,
      year: y,
      month: m,
      day: 1,
    };
  }

  return {
    isoDate: '2026-10-25',
    monthKey: '2026-10',
    displayDate: '10/25/2026',
    year: 2026,
    month: 10,
    day: 25,
  };
}

export function parseRawCsvToGrid(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function parseAttachedExpenseCsv(csvText: string): TransactionRecord[] {
  const rows = parseRawCsvToGrid(csvText);
  const records: TransactionRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = (row[0] || '').trim();
    const rawCategory = (row[1] || '').trim();
    const rawItem = (row[2] || '').trim().replace(/\s*\n\s*/g, ' — ');
    const rawAmount = (row[3] || '').trim();
    const rawBeCorp = (row[4] || '').trim();
    const rawCredit = (row[5] || '').trim();
    const rawNote = (row[6] || '').trim();

    if (!rawDate && !rawCategory && !rawItem && !rawAmount) continue;
    if (rawDate.toLowerCase() === 'purchase date') continue;

    const amount = parseSheetNumber(rawAmount);
    const beCorp = parseSheetNumber(rawBeCorp);
    const credit = parseSheetNumber(rawCredit);

    // Filter out trailing empty template rows at the end of the sheet (e.g. 10/25/2026 with no amount)
    if (amount === 0 && beCorp === 0 && credit === 0 && !rawNote) {
      continue;
    }

    const parsedDate = parseDateString(rawDate);

    records.push({
      id: `csv-Expenses-${i + 1}`,
      rowIndex: i + 1,
      sheetType: 'Expenses',
      purchaseDate: rawDate || parsedDate.displayDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: rawCategory || 'Khác',
      purchaseItem: rawItem || rawCategory || 'Giao dịch',
      amount,
      beCorp,
      credit,
      note: rawNote || undefined,
      source: 'attached_csv',
      syncedToSheet: true,
    });
  }

  return records;
}

/**
 * Builds frequency-sorted item suggestions from historical transactions
 * grouped by sheetType & category so selecting a category only suggests
 * transactions that actually belong to that category.
 */
export function buildItemSuggestions(records: TransactionRecord[]): ItemSuggestion[] {
  const map = new Map<
    string,
    {
      item: string;
      category: string;
      sheetType: SheetTabType;
      lastAmount: number;
      count: number;
      beCorpCount: number;
      creditCount: number;
    }
  >();

  for (const rec of records) {
    if (!rec.purchaseItem || rec.purchaseItem.startsWith('(')) continue;
    const itemClean = rec.purchaseItem.trim();
    if (!itemClean) continue;
    const catClean = (rec.category || '').trim();
    const sheetType: SheetTabType = rec.sheetType === 'Income' ? 'Income' : 'Expenses';
    const key = `${sheetType}:::${catClean.toLowerCase()}:::${itemClean.toLowerCase()}`;

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (rec.amount > 0) existing.lastAmount = rec.amount;
      if (rec.beCorp > 0) existing.beCorpCount += 1;
      if (rec.credit > 0) existing.creditCount += 1;
    } else {
      map.set(key, {
        item: itemClean,
        category: catClean,
        sheetType,
        lastAmount: rec.amount > 0 ? rec.amount : 0,
        count: 1,
        beCorpCount: rec.beCorp > 0 ? 1 : 0,
        creditCount: rec.credit > 0 ? 1 : 0,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      item: entry.item,
      category: entry.category,
      sheetType: entry.sheetType,
      lastAmount: entry.lastAmount,
      count: entry.count,
      typicalBeCorp: entry.beCorpCount > entry.count / 2,
      typicalCredit: entry.creditCount > entry.count / 2,
    }));
}

export function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'ALL') return 'Tất cả các tháng (T4 – T10/2026)';
  const [year, month] = monthKey.split('-');
  return `Tháng ${parseInt(month, 10)}/${year}`;
}
```

---

## Đường dẫn: `src/App.tsx` <a id="duong-dan-srcapptsx"></a>

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Palette,
  Share2,
  ArrowLeftRight,
  LayoutDashboard,
  ReceiptText,
  Scale,
} from 'lucide-react';
import { PigIcon, SiameseCatIcon } from './utils/categoryIcons';
import { AppLockScreen, isDeviceUnlocked, lockDevice } from './components/AppLockScreen';
import { usePrivacyMode } from './utils/privacyService';
import { useThemeMode } from './utils/themeService';
import { MultiMonthPickerDropdown, formatSelectedMonthsDisplay } from './components/MultiMonthPickerDropdown';
import { MultiCategoryPickerDropdown } from './components/MultiCategoryPickerDropdown';
import { KinloCashflowCard } from './components/KinloCashflowCard';
import { KinloBankAccountsCard } from './components/KinloBankAccountsCard';
import {
  animateCardsEntrance,
  animateIconBounce,
  useKinloInteractions,
  triggerFloatUp,
} from './utils/kinloAnimations';
import { motion, AnimatePresence } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  BudgetTransferRecord,
  CheckTienSheetData,
  EXPENSE_CATEGORIES,
  TransactionRecord,
} from './types/finance';
import {
  buildItemSuggestions,
  formatCurrency,
  formatNumberForSheet,
  parseAttachedExpenseCsv,
  parseDateString,
} from './utils/csvParser';
import {
  getBillingCycleRange,
  isBudgetTransferRecord,
} from './utils/cycleUtils';
import { SEED_INCOME_RECORDS, SEED_BUDGET_TRANSFERS } from './utils/seedData';
import {
  getStoredAccessToken,
  clearStoredAccessToken,
} from './services/authStorage';
import {
  appendBudgetTransferToSheet,
  appendTransactionToSheet,
  deleteTransactionFromSheet,
  extractSpreadsheetId,
  fetchBudgetTransfersSheet,
  fetchCheckTienSheet,
  fetchSpreadsheetMetadata,
  fetchTabTransactions,
  SpreadsheetMetadata,
  updateTransactionOnSheet,
} from './services/googleSheetsService';
import {
  isAppsScriptUrl,
  appsScriptSyncAll,
  DEFAULT_WEB_APP_URL,
  getStoredWebAppUrl,
} from './services/appsScriptService';
import type { NewTransactionPayload } from './components/AddTransactionModal';
import {
  DEFAULT_CATEGORY_PERCENTAGES,
  computeMultiMonthRollover,
  SAVED_CATEGORY_PERCENTAGES_KEY,
  SAVED_ROLLOVER_MODE_KEY,
  type RolloverMode,
  type MultiMonthRolloverResult,
} from './utils/budgetUtils';

const EMPTY_CATEGORIES_ARRAY: string[] = [];

import {
  TableSkeletonLoader,
  ChartSkeletonLoader,
  ReconcileSkeletonLoader,
  SheetSyncSkeletonLoader,
} from './components/SkeletonLoaders';

// Lazy-loaded main views and secondary modals for optimal startup speed and minimal bundle size
const TransactionLedgerTable = lazy(() =>
  import('./components/TransactionLedgerTable').then((m) => ({ default: m.TransactionLedgerTable }))
);
const CategoryBudgetTable = lazy(() =>
  import('./components/CategoryBudgetTable').then((m) => ({ default: m.CategoryBudgetTable }))
);
const MultiMonthSummaryTable = lazy(() =>
  import('./components/MultiMonthSummaryTable').then((m) => ({ default: m.MultiMonthSummaryTable }))
);
const CalendarHeatmapView = lazy(() =>
  import('./components/CalendarHeatmapView').then((m) => ({ default: m.CalendarHeatmapView }))
);
const AddTransactionModal = lazy(() =>
  import('./components/AddTransactionModal').then((m) => ({ default: m.AddTransactionModal }))
);
const EditTransactionModal = lazy(() =>
  import('./components/EditTransactionModal').then((m) => ({ default: m.EditTransactionModal }))
);
const MonthlyReportCardModal = lazy(() =>
  import('./components/MonthlyReportCardModal').then((m) => ({ default: m.MonthlyReportCardModal }))
);
const PwaInstallModal = lazy(() =>
  import('./components/PwaInstallModal').then((m) => ({ default: m.PwaInstallModal }))
);
const ReconcileCheckTienView = lazy(() =>
  import('./components/ReconcileCheckTienView').then((m) => ({ default: m.ReconcileCheckTienView }))
);
const SheetSyncPanel = lazy(() =>
  import('./components/SheetSyncPanel').then((m) => ({ default: m.SheetSyncPanel }))
);
const AnalyticsCharts = lazy(() =>
  import('./components/AnalyticsCharts').then((m) => ({ default: m.AnalyticsCharts }))
);

type ActiveTab = 'dashboard' | 'ledger' | 'reconcile' | 'sync';

const LOCAL_NEW_ROWS_KEY = 'heomeo_local_new_rows_v1';
const SAVED_SHEET_URL_KEY = 'heomeo_spreadsheet_url_v1';
const SAVED_BASE_INCOME_KEY = 'heomeo_base_income_v1';
const SAVED_SHEET_RECORDS_KEY = 'heomeo_cached_sheet_records_v1';
const SAVED_SHEET_META_KEY = 'heomeo_cached_sheet_meta_v1';
const SAVED_CHECK_TIEN_KEY = 'heomeo_cached_check_tien_v1';
const SAVED_LAST_SYNCED_KEY = 'heomeo_last_synced_at_v1';
const SAVED_BUDGET_TRANSFERS_KEY = 'heomeo_cached_budget_transfers_v1';



const formatTodayDate = (): string => {
  const now = new Date();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[now.getDay()];
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${dayName}, ${d}/${m}/${y}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (typeof window !== 'undefined' && (window as any).__initialTab) || 'dashboard');
  const [attachedRecords, setAttachedRecords] = useState<TransactionRecord[]>([]);
  const [sheetRecords, setSheetRecords] = useState<TransactionRecord[] | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_SHEET_RECORDS_KEY);
      if (!saved) return null;
      const parsed: TransactionRecord[] = JSON.parse(saved);
      // Self-heal: purge cache if corrupted with 0-amount salaries, missing Luong BE, or old migrated income items
      const invalidIncome = parsed.some(
        (r) => r.sheetType === 'Income' && (r.category?.includes('Lương') || r.category?.includes('Thu')) && r.amount === 0
      );
      const missingLuongBe = !parsed.some(
        (r) => r.sheetType === 'Income' && r.monthKey === '2026-10' && (r.category?.includes('BE') || r.purchaseItem?.includes('Mèo'))
      );
      const hasOldMigratedIncome = parsed.some(
        (r) => r.sheetType === 'Income' && (r.purchaseItem?.includes('Slay the Spire') || r.purchaseItem?.includes('Nyota') || r.purchaseItem?.includes('PS4'))
      );
      if (invalidIncome || missingLuongBe || hasOldMigratedIncome) {
        localStorage.removeItem(SAVED_SHEET_RECORDS_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [localNewRecords, setLocalNewRecords] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_NEW_ROWS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [budgetTransfers, setBudgetTransfers] = useState<BudgetTransferRecord[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BUDGET_TRANSFERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length >= 8 &&
          parsed.some((b: any) => b.description?.includes('Slay the Spire'))
        ) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    try {
      localStorage.removeItem(SAVED_BUDGET_TRANSFERS_KEY);
    } catch {
      // ignore
    }
    return SEED_BUDGET_TRANSFERS;
  });

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('unlocked') === 'true') {
      return true;
    }
    return isDeviceUnlocked();
  });
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });
  const userHasManuallySelectedMonthRef = useRef<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Cycle start/end day configuration for BE Corp and Credit
  const [beCorpStartDay, setBeCorpStartDay] = useState<number>(26);
  const [beCorpEndDay, setBeCorpEndDay] = useState<number>(25);
  const [creditStartDay, setCreditStartDay] = useState<number>(20);
  const [creditEndDay, setCreditEndDay] = useState<number>(19);

  // Privacy mode (Masking/Unmasking financial numbers)
  const { isPrivate, togglePrivacy } = usePrivacyMode();

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Theme mode (Light / Dark) & Theme Preset (Kinlo / Cofra)
  const { isDark, toggleTheme, preset, togglePreset, activeConfig } = useThemeMode();

  // Monthly Report Card Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Toggle for secondary analytics charts (Bar & Donut)
  const [showCharts, setShowCharts] = useState<boolean>(false);

  // Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalPreset, setAddModalPreset] =
    useState<Partial<NewTransactionPayload> | null>(null);

  // Edit & Delete Transaction modal state
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast notification
  const [toast, setToast] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Kinlo Animation refs & interactive micro-interactions (magnetic buttons & card lift)
  const dashboardRef = useRef<HTMLDivElement>(null);
  useKinloInteractions(undefined, [activeTab, preset]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (activeTab === 'dashboard' && dashboardRef.current) {
      const cards = dashboardRef.current.querySelectorAll('.kinlo-card, .kinlo-card-night, [data-card-entrance]');
      if (cards.length > 0) {
        animateCardsEntrance(cards);
      }
    }
  }, [activeTab]);

  // Global Keyboard shortcuts: Alt + P (Privacy), Alt + N (Thêm nhanh giao dịch), Escape (Đóng modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        togglePrivacy();
        return;
      }
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setAddModalPreset(null);
        setIsAddModalOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (deletingTransaction) {
          setDeletingTransaction(null);
          return;
        }
        if (editingTransaction) {
          setEditingTransaction(null);
          return;
        }
        if (isAddModalOpen) {
          setIsAddModalOpen(false);
          return;
        }
        if (isReportModalOpen) {
          setIsReportModalOpen(false);
          return;
        }
        if (isInstallModalOpen) {
          setIsInstallModalOpen(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    togglePrivacy,
    deletingTransaction,
    editingTransaction,
    isAddModalOpen,
    isReportModalOpen,
    isInstallModalOpen,
  ]);

  // Google Auth & Sheets state (token kept strictly in memory)
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(() => {
    const saved = localStorage.getItem(SAVED_SHEET_URL_KEY);
    if (saved && isAppsScriptUrl(saved)) return saved;
    const storedWebApp = getStoredWebAppUrl();
    if (storedWebApp) return storedWebApp;
    return saved || DEFAULT_WEB_APP_URL;
  });
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMetadata | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_SHEET_META_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [checkTienData, setCheckTienData] = useState<CheckTienSheetData | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_CHECK_TIEN_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem(SAVED_LAST_SYNCED_KEY) || null;
  });

  const [monthlyBaseIncome, setMonthlyBaseIncome] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BASE_INCOME_KEY);
      return saved ? Number(saved) : 45000000;
    } catch {
      return 45000000;
    }
  });

  // Reference hooks to prevent stale closures and concurrent sync calls
  const isSyncingRef = useRef<boolean>(false);
  const activeSyncHasTokenRef = useRef<boolean>(false);
  const queuedAuthSyncRef = useRef<{ customUrlOrId?: string; overrideToken?: string; silent?: boolean } | null>(null);
  const localNewRecordsRef = useRef<TransactionRecord[]>(localNewRecords);
  localNewRecordsRef.current = localNewRecords;
  const budgetTransfersRef = useRef<BudgetTransferRecord[]>(budgetTransfers);
  budgetTransfersRef.current = budgetTransfers;
  const sheetRecordsRef = useRef<TransactionRecord[] | null>(sheetRecords);
  sheetRecordsRef.current = sheetRecords;

  // Save local state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_NEW_ROWS_KEY, JSON.stringify(localNewRecords));
    } catch {
      // ignore storage errors
    }
  }, [localNewRecords]);

  useEffect(() => {
    if (budgetTransfers.length > 0) {
      try {
        localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(budgetTransfers));
      } catch (e) {
        console.warn('Cannot persist budgetTransfers', e);
      }
    }
  }, [budgetTransfers]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_BASE_INCOME_KEY, String(monthlyBaseIncome));
    } catch {
      // ignore
    }
  }, [monthlyBaseIncome]);

  useEffect(() => {
    if (sheetRecords !== null) {
      try {
        localStorage.setItem(SAVED_SHEET_RECORDS_KEY, JSON.stringify(sheetRecords));
      } catch (e) {
        console.warn('Cannot persist sheetRecords', e);
      }
    }
  }, [sheetRecords]);

  useEffect(() => {
    if (sheetMeta !== null) {
      try {
        localStorage.setItem(SAVED_SHEET_META_KEY, JSON.stringify(sheetMeta));
      } catch (e) {
        console.warn('Cannot persist sheetMeta', e);
      }
    }
  }, [sheetMeta]);

  useEffect(() => {
    if (lastSyncedAt !== null) {
      try {
        localStorage.setItem(SAVED_LAST_SYNCED_KEY, lastSyncedAt);
      } catch (e) {
        // ignore
      }
    }
  }, [lastSyncedAt]);

  useEffect(() => {
    if (checkTienData !== null) {
      try {
        localStorage.setItem(SAVED_CHECK_TIEN_KEY, JSON.stringify(checkTienData));
      } catch (e) {
        // ignore
      }
    }
  }, [checkTienData]);

  const showToast = useCallback((type: 'success' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Load attached CSV on startup (skip fetch and parse when sheetRecords cache exists)
  useEffect(() => {
    if (sheetRecords !== null && sheetRecords.length > 0) {
      setIsLoadingInitial(false);
      return;
    }
    let mounted = true;
    async function loadAttachedCsv() {
      try {
        const assetUrl = `${import.meta.env.BASE_URL || './'}assets/aistudio/Expense___Income_Tracker_1a8ce480`;
        let res = await fetch(assetUrl).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch('./assets/aistudio/Expense___Income_Tracker_1a8ce480').catch(() => null);
        }
        if (!res || !res.ok) {
          res = await fetch('/assets/aistudio/Expense___Income_Tracker_1a8ce480').catch(() => null);
        }
        if (!res || !res.ok) throw new Error('Không thể tải file dữ liệu đính kèm');
        const text = await res.text();
        const parsed = parseAttachedExpenseCsv(text);
        if (mounted) {
          setAttachedRecords([...parsed, ...SEED_INCOME_RECORDS]);
        }
      } catch (err) {
        console.error('Error loading attached CSV:', err);
      } finally {
        if (mounted) setIsLoadingInitial(false);
      }
    }
    loadAttachedCsv();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-sync on load for Web App API (works without any Google login)
  useEffect(() => {
    // If user already has an OAuth token in storage, let Firebase Auth effect handle the sync
    const storedToken = getStoredAccessToken();
    if (storedToken) {
      return;
    }
    const targetUrl = spreadsheetInput || getStoredWebAppUrl() || DEFAULT_WEB_APP_URL;
    if (isAppsScriptUrl(targetUrl)) {
      handleConnectAndSyncSheet(targetUrl, '', true).catch((err) => {
        console.warn('Initial background Web App sync:', err);
      });
    }
  }, []);

  // Initialize Firebase Auth listener with auto-sync on load (only when stored OAuth token exists)
  useEffect(() => {
    const storedToken = getStoredAccessToken();
    if (!storedToken) return;

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    import('./services/firebaseAuth').then(({ initAuth }) => {
      if (!mounted) return;
      unsubscribe = initAuth(
        (loggedInUser, token) => {
          setUser(loggedInUser);
          setAccessToken(token);
          const targetUrl = localStorage.getItem(SAVED_SHEET_URL_KEY) || DEFAULT_WEB_APP_URL;
          if (targetUrl) {
            handleConnectAndSyncSheet(targetUrl, token);
          }
        },
        (maybeUser) => {
          setUser(maybeUser);
          setAccessToken(null);
        }
      );
    }).catch(console.error);

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Combined active records
  const allRecords = useMemo(() => {
    let combined: TransactionRecord[];
    if (sheetRecords !== null) {
      const unsynced = localNewRecords.filter((r) => !r.syncedToSheet);
      const sheetIds = new Set(sheetRecords.map((r) => r.id));
      const dedupedUnsynced = unsynced.filter((r) => !sheetIds.has(r.id));
      combined = [...sheetRecords, ...dedupedUnsynced];
    } else {
      combined = [...attachedRecords, ...localNewRecords];
    }

    // Filter ghost / blank template rows (no amount, no credit/be, no valid item name)
    return combined.filter(
      (r) =>
        (r.amount && r.amount !== 0) ||
        (r.beCorp && r.beCorp !== 0) ||
        (r.credit && r.credit !== 0) ||
        (r.purchaseItem && r.purchaseItem.trim() !== '' && r.purchaseItem !== '(Không ghi nội dung)') ||
        (r.note && r.note.trim() !== '')
    );
  }, [sheetRecords, attachedRecords, localNewRecords]);

  // Unique categories list (seeded with all standard expense categories)
  const allCategories = useMemo(() => {
    const set = new Set<string>(EXPENSE_CATEGORIES);
    allRecords.forEach((r) => {
      if (r.category && r.sheetType === 'Expenses') set.add(r.category);
    });
    return Array.from(set);
  }, [allRecords]);

  const isAllCategoriesSelected = useMemo(() => {
    return (
      selectedCategories.length === 0 ||
      selectedCategories.includes('ALL') ||
      (allCategories.length > 0 && selectedCategories.length >= allCategories.length)
    );
  }, [selectedCategories, allCategories]);

  // Derived single category for backward compatibility
  const selectedCategory = useMemo(() => {
    if (isAllCategoriesSelected) return 'ALL';
    if (selectedCategories.length === 1) return selectedCategories[0];
    return selectedCategories[0] || 'ALL';
  }, [isAllCategoriesSelected, selectedCategories]);

  const handleSelectCategories = useCallback((cats: string[]) => {
    if (
      cats.length === 0 ||
      cats.includes('ALL') ||
      (allCategories.length > 0 && cats.length >= allCategories.length)
    ) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(cats);
    }
  }, [allCategories]);

  const handleSelectCategory = useCallback((cat: string) => {
    if (cat === 'ALL') {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([cat]);
    }
  }, []);

  const setSelectedCategory = handleSelectCategory;

  const handleToggleCategory = useCallback(
    (cat: string) => {
      if (isAllCategoriesSelected) {
        const remaining = allCategories.filter((c) => c !== cat);
        setSelectedCategories(remaining.length > 0 ? remaining : [allCategories[0]]);
        return;
      }
      if (selectedCategories.includes(cat)) {
        const next = selectedCategories.filter((c) => c !== cat);
        if (next.length === 0) {
          setSelectedCategories([]);
        } else {
          setSelectedCategories(next);
        }
      } else {
        const next = [...selectedCategories, cat];
        if (next.length >= allCategories.length) {
          setSelectedCategories([]);
        } else {
          setSelectedCategories(next);
        }
      }
    },
    [isAllCategoriesSelected, selectedCategories, allCategories]
  );

  // Available months in dataset (sorted descending: latest month first)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.monthKey && r.monthKey.includes('-')) set.add(r.monthKey);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Dynamic default latest month (either current calendar month or latest in dataset)
  const defaultLatestMonth = useMemo(() => {
    const now = new Date();
    const currentCalMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (availableMonths.includes(currentCalMonth)) return currentCalMonth;
    return availableMonths[0] || currentCalMonth;
  }, [availableMonths]);

  // Automatically select latest month on initial data load if user hasn't explicitly chosen one
  useEffect(() => {
    if (!userHasManuallySelectedMonthRef.current && availableMonths.length > 0) {
      setSelectedMonths([defaultLatestMonth]);
    }
  }, [defaultLatestMonth, availableMonths]);

  const isAllMonthsSelected = useMemo(() => {
    return (
      selectedMonths.length === 0 ||
      selectedMonths.includes('ALL') ||
      (availableMonths.length > 0 && selectedMonths.length >= availableMonths.length)
    );
  }, [selectedMonths, availableMonths]);

  // Derived single month for backward compatibility
  const selectedMonth = useMemo(() => {
    if (isAllMonthsSelected) return 'ALL';
    if (selectedMonths.length === 1) return selectedMonths[0];
    return selectedMonths[0] || defaultLatestMonth;
  }, [isAllMonthsSelected, selectedMonths, defaultLatestMonth]);

  const selectedMonthsLabel = useMemo(() => {
    return formatSelectedMonthsDisplay(selectedMonths, availableMonths).title;
  }, [selectedMonths, availableMonths]);

  // Record counts per month for dropdown context
  const monthRecordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allRecords) {
      if (r.monthKey) {
        counts[r.monthKey] = (counts[r.monthKey] || 0) + 1;
      }
    }
    return counts;
  }, [allRecords]);

  // Records filtered by selectedMonths (Calendar month: 1st to 30/31st)
  const periodRecords = useMemo(() => {
    if (isAllMonthsSelected) return allRecords;
    const monthSet = new Set(selectedMonths);
    return allRecords.filter((r) => r.monthKey && monthSet.has(r.monthKey));
  }, [allRecords, isAllMonthsSelected, selectedMonths]);

  // Category record counts & spent totals for periodRecords (for category dropdown)
  const { categoryRecordCounts, categorySpentTotals } = useMemo(() => {
    const counts: Record<string, number> = {};
    const spents: Record<string, number> = {};
    for (const r of periodRecords) {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
        if (r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)) {
          spents[r.category] = (spents[r.category] || 0) + r.amount;
        }
      }
    }
    return { categoryRecordCounts: counts, categorySpentTotals: spents };
  }, [periodRecords]);

  const handleSelectMonth = useCallback((mKey: string) => {
    userHasManuallySelectedMonthRef.current = true;
    if (mKey === 'ALL') {
      setSelectedMonths(availableMonths);
    } else {
      setSelectedMonths([mKey]);
    }
  }, [availableMonths]);

  const handleToggleMonth = useCallback((mKey: string) => {
    userHasManuallySelectedMonthRef.current = true;
    setSelectedMonths((prev) => {
      if (prev.length === 0 || prev.includes('ALL') || prev.length >= availableMonths.length) {
        const remaining = availableMonths.filter((m) => m !== mKey);
        return remaining.length > 0 ? remaining : [availableMonths[0]];
      }
      if (prev.includes(mKey)) {
        const next = prev.filter((m) => m !== mKey);
        return next.length > 0 ? next : availableMonths;
      }
      const next = [...prev, mKey];
      return next.length >= availableMonths.length ? availableMonths : next;
    });
  }, [availableMonths]);

  // Historical autocomplete suggestions
  const itemSuggestions = useMemo(() => {
    return buildItemSuggestions(allRecords);
  }, [allRecords]);

  // Cycle range calculations for BE Corp and Credit for the active month
  const activeBeCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth,
      beCorpStartDay,
      beCorpEndDay
    );
  }, [selectedMonth, defaultLatestMonth, beCorpStartDay, beCorpEndDay]);

  const activeCreditCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth,
      creditStartDay,
      creditEndDay
    );
  }, [selectedMonth, defaultLatestMonth, creditStartDay, creditEndDay]);

  // KPI calculations (Separating BE Corp & Credit into their own independent cycles)
  const kpiStats = useMemo(() => {
    let sheetIncome = 0;
    let totalExpense = 0;
    let savingsExpense = 0;
    let livingExpense = 0;
    let negativeExpenseOffsets = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    for (const r of periodRecords) {
      if (r.sheetType === 'Income') {
        sheetIncome += r.amount;
        incomeCount += 1;
      } else {
        // Exclude budget transfers between categories from living/total expense consumption
        if (isBudgetTransferRecord(r)) {
          continue;
        }
        expenseCount += 1;
        totalExpense += r.amount;
        if (r.category === 'Tiết kiệm') {
          savingsExpense += r.amount;
        } else {
          livingExpense += r.amount;
        }
        if (r.amount < 0) {
          negativeExpenseOffsets += Math.abs(r.amount);
        }
      }
    }

    // Thu nhập lấy trực tiếp từ các khoản ghi trong sheet Income của kỳ đang chọn
    const effectiveIncome = sheetIncome;
    const netBalance = effectiveIncome - totalExpense;

    // Distinct cycle calculations for BE Corp and Credit across all selected months
    let beCorpCycleTotal = 0;
    let beCorpCount = 0;
    let creditCycleTotal = 0;
    let creditCount = 0;

    if (isAllMonthsSelected) {
      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (r.beCorp > 0) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (r.credit > 0) {
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
            r.beCorp > 0 &&
            beRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (
            r.credit > 0 &&
            creditRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    }

    const beDisplayLabel = isAllMonthsSelected
      ? 'Tất cả chu kỳ BE'
      : selectedMonths.length > 1
        ? `${selectedMonths.length} chu kỳ BE đã chọn`
        : activeBeCycle.displayLabel;

    const creditDisplayLabel = isAllMonthsSelected
      ? 'Tất cả kỳ sao kê thẻ'
      : selectedMonths.length > 1
        ? `${selectedMonths.length} kỳ sao kê thẻ đã chọn`
        : activeCreditCycle.displayLabel;

    return {
      sheetIncome,
      effectiveIncome,
      hasSheetIncome: sheetIncome > 0,
      totalExpense,
      savingsExpense,
      livingExpense,
      negativeExpenseOffsets,
      beCorpCycleTotal,
      beCorpCount,
      creditCycleTotal,
      creditCount,
      beRange: { ...activeBeCycle, displayLabel: beDisplayLabel },
      creditRange: { ...activeCreditCycle, displayLabel: creditDisplayLabel },
      netBalance,
      expenseCount,
      incomeCount,
    };
  }, [
    periodRecords,
    allRecords,
    monthlyBaseIncome,
    selectedMonth,
    selectedMonths,
    isAllMonthsSelected,
    availableMonths.length,
    activeBeCycle,
    activeCreditCycle,
    beCorpStartDay,
    beCorpEndDay,
    creditStartDay,
    creditEndDay,
  ]);

  // Memoized complete multi-month rollover chain across all categories and months
  const memoizedRolloverResult = useMemo(() => {
    let hasCustomPercentages = false;
    let customPercentages: Record<string, number> = {};
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY);
      if (saved) {
        customPercentages = JSON.parse(saved);
        const isIdenticalToDefault = Object.entries(DEFAULT_CATEGORY_PERCENTAGES).every(
          ([k, v]) => Math.abs((customPercentages[k] ?? 0) - v) < 0.05
        );
        if (!isIdenticalToDefault) {
          hasCustomPercentages = true;
        }
      }
    } catch {
      // ignore
    }

    let rolloverMode: RolloverMode = 'full';
    try {
      const saved = localStorage.getItem(SAVED_ROLLOVER_MODE_KEY) as RolloverMode;
      if (saved && ['full', 'deficit_only', 'none'].includes(saved)) {
        rolloverMode = saved;
      }
    } catch {
      // ignore
    }

    return computeMultiMonthRollover(
      allRecords,
      budgetTransfers,
      customPercentages,
      rolloverMode,
      hasCustomPercentages
    );
  }, [allRecords, budgetTransfers]);

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

    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth;
    const rolloverResult = memoizedRolloverResult;

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
      const catStats = rolloverResult.chain[cat]?.[targetMonth];
      const catRecords = periodRecords.filter(
        (r) => r.category === cat && r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)
      );
      const spent = catStats ? catStats.spent : catRecords.reduce((s, r) => s + r.amount, 0);
      const beCorp = catRecords.reduce((s, r) => s + r.beCorp, 0);
      const credit = catRecords.reduce((s, r) => s + r.credit, 0);
      const count = catStats ? catStats.txCount : catRecords.length;

      const baseBudget = catStats
        ? catStats.baseBudget
        : Math.round((kpiStats.effectiveIncome * (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0)) / 100);
      const carryover = catStats ? catStats.carryover : 0;
      const netTransfer = catStats ? catStats.netTransfer : 0;
      const effectiveBudget = catStats ? catStats.effectiveBudget : baseBudget;
      const percentage = catStats
        ? catStats.percentage
        : (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0);

      totalEffectiveBudget += effectiveBudget;
      totalBaseBudget += baseBudget;
      totalCarryover += carryover;
      totalNetTransfer += netTransfer;
      totalSpent += spent;
      totalBeCorp += beCorp;
      totalCredit += credit;
      totalCount += count;
      totalPercentage += percentage;
    }

    const remaining = totalEffectiveBudget - totalSpent;
    const displayLabel =
      targetCategories.length === 1
        ? targetCategories[0]
        : `${targetCategories.length} danh mục (${targetCategories.slice(0, 2).join(', ')}${targetCategories.length > 2 ? '...' : ''})`;

    return {
      category: displayLabel,
      categories: targetCategories,
      budget: totalEffectiveBudget,
      baseBudget: totalBaseBudget,
      carryover: totalCarryover,
      netTransfer: totalNetTransfer,
      spent: totalSpent,
      remaining,
      beCorp: totalBeCorp,
      credit: totalCredit,
      count: totalCount,
      percentage: totalPercentage,
    };
  }, [
    isAllCategoriesSelected,
    selectedCategories,
    selectedCategory,
    allRecords,
    budgetTransfers,
    periodRecords,
    selectedMonth,
    defaultLatestMonth,
    kpiStats.effectiveIncome,
  ]);

  // Google Sign-In handler
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const { googleSignIn } = await import('./services/firebaseAuth');
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast('success', `Đã đăng nhập Google (${result.user.email})`);
        if (spreadsheetInput.trim()) {
          await handleConnectAndSyncSheet(spreadsheetInput, result.accessToken);
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Đăng nhập Google thất bại.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    const { logout } = await import('./services/firebaseAuth');
    await logout();
    setUser(null);
    setAccessToken(null);
    setSheetMeta(null);
    showToast('warning', 'Đã ngắt phiên đăng nhập Google.');
  };

  // Connect & Sync with Google Sheet (with auto-push of offline/pending transactions and transfers)
  const handleConnectAndSyncSheet = async (
    customUrlOrId?: string,
    overrideToken?: string,
    silent?: boolean
  ) => {
    if (isSyncingRef.current) {
      if (overrideToken && !activeSyncHasTokenRef.current) {
        queuedAuthSyncRef.current = { customUrlOrId, overrideToken, silent };
      }
      console.log('Sync already in progress, skipping duplicate call.');
      return;
    }

    const targetInput = (customUrlOrId ?? spreadsheetInput).trim();
    if (!targetInput) {
      setSyncError('Vui lòng dán đường link hoặc ID file Google Sheet của bạn.');
      return;
    }

    const isAppsScript = isAppsScriptUrl(targetInput);
    let token = overrideToken || accessToken || getStoredAccessToken() || '';
    if (!token && !isAppsScript) {
      try {
        setIsLoggingIn(true);
        const { googleSignIn } = await import('./services/firebaseAuth');
        const loginRes = await googleSignIn();
        if (!loginRes) return;
        setUser(loginRes.user);
        setAccessToken(loginRes.accessToken);
        token = loginRes.accessToken;
      } catch (err: any) {
        setSyncError(err?.message || 'Vui lòng đăng nhập Google trước khi đồng bộ.');
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    isSyncingRef.current = true;
    activeSyncHasTokenRef.current = Boolean(token);
    setIsSyncing(true);
    setSyncError(null);

    const executeSync = async (currentToken: string) => {
      let meta: SpreadsheetMetadata;
      let preloadedExpenses: TransactionRecord[] | null = null;
      let preloadedIncome: TransactionRecord[] | null = null;
      let preloadedTransfers: BudgetTransferRecord[] | null = null;

      if (isAppsScript) {
        const fullData = await appsScriptSyncAll(targetInput);
        meta = fullData.metadata;
        preloadedExpenses = fullData.expenses;
        preloadedIncome = fullData.income;
        preloadedTransfers = fullData.budgetTransfers;
      } else {
        meta = await fetchSpreadsheetMetadata(targetInput, currentToken);
        const savedIncomeTab = localStorage.getItem('heomeo_custom_income_tab_v1');
        if (savedIncomeTab && meta.sheetNames.includes(savedIncomeTab)) {
          meta.incomeTab = savedIncomeTab;
        }
        const savedExpensesTab = localStorage.getItem('heomeo_custom_expenses_tab_v1');
        if (savedExpensesTab && meta.sheetNames.includes(savedExpensesTab)) {
          meta.expensesTab = savedExpensesTab;
        }
      }

      setSheetMeta(meta);
      localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

      // --- 1. AUTO-PUSH PENDING LOCAL TRANSACTIONS ---
      const pendingMap = new Map<string, TransactionRecord>();
      (localNewRecordsRef.current || []).forEach((r) => {
        if (!r.syncedToSheet) pendingMap.set(r.id, r);
      });
      try {
        const saved = localStorage.getItem(LOCAL_NEW_ROWS_KEY);
        if (saved) {
          const parsed: TransactionRecord[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((r) => {
              if (!r.syncedToSheet) pendingMap.set(r.id, r);
            });
          }
        }
      } catch {
        // ignore
      }
      (sheetRecordsRef.current || []).forEach((r) => {
        if (r.source === 'local_new' && !r.syncedToSheet) {
          pendingMap.set(r.id, r);
        }
      });

      const pendingTransactions = Array.from(pendingMap.values());
      const pushedTxIds = new Set<string>();

      if (pendingTransactions.length > 0) {
        // Sort chronologically
        pendingTransactions.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));

        setLocalNewRecords((prev) =>
          prev.map((r) => (pendingMap.has(r.id) ? { ...r, syncing: true } : r))
        );

        for (const rec of pendingTransactions) {
          const targetTab = rec.sheetType === 'Expenses' ? meta.expensesTab : meta.incomeTab;
          try {
            await appendTransactionToSheet(
              meta.spreadsheetId,
              targetTab,
              {
                sheetType: rec.sheetType,
                purchaseDate: rec.purchaseDate,
                category: rec.category,
                purchaseItem: rec.purchaseItem,
                amount: rec.amount,
                beCorp: rec.beCorp,
                credit: rec.credit,
                note: rec.note,
              },
              currentToken
            );
            pushedTxIds.add(rec.id);
          } catch (pushErr: any) {
            console.error(`Error auto-pushing transaction ${rec.id}:`, pushErr);
            if (
              pushErr?.message &&
              (pushErr.message.includes('TOKEN_EXPIRED') || pushErr.message.includes('401'))
            ) {
              throw pushErr;
            }
          }
        }

        if (pushedTxIds.size > 0) {
          setLocalNewRecords((prev) => {
            const remaining = prev.filter((r) => !pushedTxIds.has(r.id));
            try {
              localStorage.setItem(LOCAL_NEW_ROWS_KEY, JSON.stringify(remaining));
            } catch {}
            return remaining;
          });
        }
      }

      // --- 2. AUTO-PUSH PENDING BUDGET TRANSFERS ---
      const pendingTransfersMap = new Map<string, BudgetTransferRecord>();
      (budgetTransfersRef.current || []).forEach((t) => {
        if (t.source === 'local_new' && !t.syncedToSheet) {
          pendingTransfersMap.set(t.id, t);
        }
      });
      try {
        const savedBt = localStorage.getItem(SAVED_BUDGET_TRANSFERS_KEY);
        if (savedBt) {
          const parsedBt: BudgetTransferRecord[] = JSON.parse(savedBt);
          if (Array.isArray(parsedBt)) {
            parsedBt.forEach((t) => {
              if (t.source === 'local_new' && !t.syncedToSheet) {
                pendingTransfersMap.set(t.id, t);
              }
            });
          }
        }
      } catch {
        // ignore
      }

      const pendingTransfers = Array.from(pendingTransfersMap.values());
      const pushedBtIds = new Set<string>();

      if (pendingTransfers.length > 0) {
        pendingTransfers.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));
        const btTab = meta.budgetTransfersTab || 'Budget Transfers';
        for (const transfer of pendingTransfers) {
          try {
            await appendBudgetTransferToSheet(
              meta.spreadsheetId,
              btTab,
              {
                date: transfer.date,
                fromCategory: transfer.fromCategory,
                toCategory: transfer.toCategory,
                amount: transfer.amount,
                description: transfer.description,
              },
              currentToken
            );
            pushedBtIds.add(transfer.id);
          } catch (pushErr: any) {
            console.error(`Error auto-pushing transfer ${transfer.id}:`, pushErr);
            if (
              pushErr?.message &&
              (pushErr.message.includes('TOKEN_EXPIRED') || pushErr.message.includes('401'))
            ) {
              throw pushErr;
            }
          }
        }

        if (pushedBtIds.size > 0) {
          setBudgetTransfers((prev) => {
            const updated = prev.map((t) =>
              pushedBtIds.has(t.id) ? { ...t, syncedToSheet: true } : t
            );
            try {
              localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      }

      // --- 3. FETCH ALL LATEST ROWS DIRECTLY FROM GOOGLE SHEETS ---
      let expensesRows: TransactionRecord[];
      let incomeRows: TransactionRecord[];
      let checkTien: any = null;
      let liveTransfers: BudgetTransferRecord[] = [];

      if (isAppsScript && preloadedExpenses && preloadedIncome && preloadedTransfers && pushedTxIds.size === 0 && pushedBtIds.size === 0) {
        expensesRows = preloadedExpenses;
        incomeRows = preloadedIncome;
        liveTransfers = preloadedTransfers;
      } else {
        const [exp, inc, ct, bt] = await Promise.all([
          fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', currentToken),
          fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', currentToken),
          meta.checkTienTab
            ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, currentToken)
            : Promise.resolve(null),
          meta.budgetTransfersTab
            ? fetchBudgetTransfersSheet(meta.spreadsheetId, meta.budgetTransfersTab, currentToken)
            : Promise.resolve([]),
        ]);
        expensesRows = exp;
        incomeRows = inc;
        checkTien = ct;
        liveTransfers = bt;
      }

      setSheetRecords([...expensesRows, ...incomeRows]);
      if (checkTien) {
        setCheckTienData(checkTien);
      }
      if (liveTransfers && liveTransfers.length > 0) {
        setBudgetTransfers(liveTransfers);
        try {
          localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(liveTransfers));
        } catch {}
      }

      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncedAt(nowStr);

      return {
        meta,
        pushedCount: pushedTxIds.size + pushedBtIds.size,
        expensesCount: expensesRows.length,
        incomeCount: incomeRows.length,
        checkTienTab: checkTien?.sheetName,
      };
    };

    try {
      let activeToken = token;
      try {
        const res = await executeSync(activeToken);
        if (res.pushedCount > 0) {
          showToast(
            'success',
            `✓ Đã tự động đồng bộ ${res.pushedCount} giao dịch chờ lên Google Sheet!`
          );
        } else if (!silent) {
          showToast(
            'success',
            isAppsScript
              ? `✓ Đã kết nối Web App API: ${res.expensesCount} chi tiêu, ${res.incomeCount} thu nhập (Không cần đăng nhập Google)!`
              : `Đã đồng bộ "${res.meta.title}": ${res.expensesCount} dòng Expenses, ${res.incomeCount} dòng Income${
                  res.checkTienTab ? ' & Check tiền' : ''
                }`
          );
        }
      } catch (innerErr: any) {
        if (
          innerErr?.message &&
          (innerErr.message.includes('TOKEN_EXPIRED') || innerErr.message.includes('401'))
        ) {
          showToast('warning', 'Token Google hết hạn, đang tự động làm mới phiên đăng nhập...');
          const { googleSignIn } = await import('./services/firebaseAuth');
          const freshLogin = await googleSignIn();
          if (!freshLogin) throw new Error('Không thể làm mới token đăng nhập.');
          setUser(freshLogin.user);
          setAccessToken(freshLogin.accessToken);
          activeToken = freshLogin.accessToken;

          const res = await executeSync(activeToken);
          if (res.pushedCount > 0) {
            showToast(
              'success',
              `✓ Đã tự động đồng bộ ${res.pushedCount} giao dịch chờ lên Google Sheet!`
            );
          } else if (!silent) {
            showToast('success', 'Đã làm mới token và đồng bộ thành công!');
          }
        } else {
          throw innerErr;
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Không thể đồng bộ dữ liệu từ Google Sheet.');
    } finally {
      isSyncingRef.current = false;
      activeSyncHasTokenRef.current = false;
      setIsSyncing(false);
      if (queuedAuthSyncRef.current) {
        const next = queuedAuthSyncRef.current;
        queuedAuthSyncRef.current = null;
        handleConnectAndSyncSheet(next.customUrlOrId, next.overrideToken, next.silent).catch(console.error);
      }
    }
  };

  const handleSaveTransfer = async (transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
    isoDate: string;
  }) => {
    const parts = transfer.date.split('/');
    const monthKey = parts.length === 3 ? `${parts[2]}-${parts[0].padStart(2, '0')}` : selectedMonth;
    const newTransfer: BudgetTransferRecord = {
      id: `local-bt-${Date.now()}`,
      date: transfer.date,
      isoDate: transfer.isoDate,
      monthKey,
      fromCategory: transfer.fromCategory,
      toCategory: transfer.toCategory,
      amount: transfer.amount,
      description: transfer.description,
      source: 'local_new',
      syncedToSheet: false,
    };

    setBudgetTransfers((prev) => [newTransfer, ...prev]);

    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    if ((accessToken || isAppsScript) && effectiveSheetId) {
      const tabName = sheetMeta?.budgetTransfersTab || 'Budget Transfers';
      try {
        await appendBudgetTransferToSheet(
          effectiveSheetId,
          tabName,
          {
            date: transfer.date,
            fromCategory: transfer.fromCategory,
            toCategory: transfer.toCategory,
            amount: transfer.amount,
            description: transfer.description,
          },
          accessToken || ''
        );
        setBudgetTransfers((prev) =>
          prev.map((t) => (t.id === newTransfer.id ? { ...t, syncedToSheet: true } : t))
        );
        showToast('success', `Đã chuyển ngân sách thành công vào tab "${tabName}" trên Google Sheet!`);
      } catch (err: any) {
        console.error('Failed to append budget transfer to sheet:', err);
        showToast('warning', `Đã lưu tạm điều chuyển vào máy (Google Sheet: ${err.message})`);
      }
    } else {
      showToast('success', 'Đã lưu điều chuyển ngân sách (offline)!');
    }
  };

  const backgroundSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleDebouncedBackgroundSync = useCallback(
    (sheetId: string, token: string, delayMs = 2500) => {
      if (backgroundSyncTimerRef.current) {
        clearTimeout(backgroundSyncTimerRef.current);
      }
      backgroundSyncTimerRef.current = setTimeout(() => {
        handleConnectAndSyncSheet(sheetId, token, true).catch(console.error);
      }, delayMs);
    },
    [handleConnectAndSyncSheet]
  );

  useEffect(() => {
    return () => {
      if (backgroundSyncTimerRef.current) {
        clearTimeout(backgroundSyncTimerRef.current);
      }
    };
  }, []);

  // Save new transaction(s) (Optimistic Update)
  const handleSaveTransaction = async (
    payloadOrList: NewTransactionPayload | NewTransactionPayload[]
  ) => {
    const list = Array.isArray(payloadOrList) ? payloadOrList : [payloadOrList];
    if (list.length === 0) return;

    const createdRecords: TransactionRecord[] = [];

    for (let i = 0; i < list.length; i++) {
      const payload = list[i];
      const parsedDate = parseDateString(payload.purchaseDate);
      const newRecord: TransactionRecord = {
        id: `local-${payload.sheetType}-${Date.now()}-${i}`,
        sheetType: payload.sheetType,
        purchaseDate: payload.purchaseDate,
        isoDate: parsedDate.isoDate,
        monthKey: parsedDate.monthKey,
        category: payload.category,
        purchaseItem: payload.purchaseItem,
        amount: payload.amount,
        beCorp: payload.beCorp,
        credit: payload.credit,
        note: payload.note,
        source: 'local_new',
        syncedToSheet: false,
        syncing: false,
      };
      createdRecords.push(newRecord);
    }

    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    if (effectiveSheetId && (effectiveToken || isAppsScript)) {
      createdRecords.forEach((r) => (r.syncing = true));
      setSheetRecords((prev) => (prev ? [...prev, ...createdRecords] : [...attachedRecords, ...createdRecords]));
      showToast(
        'success',
        createdRecords.length > 1
          ? `✓ Đang tự động lưu & đồng bộ ${createdRecords.length} dòng lên Google Sheet...`
          : `✓ Đang tự động lưu & đồng bộ "${createdRecords[0].purchaseItem}" lên Google Sheet...`
      );

      const expensesTab = sheetMeta?.expensesTab || 'Expenses';
      const incomeTab = sheetMeta?.incomeTab || 'Income';

      let anyError = false;
      for (const record of createdRecords) {
        const targetTab =
          record.sheetType === 'Expenses'
            ? expensesTab
            : incomeTab;

        try {
          const appendRes = await appendTransactionToSheet(
            effectiveSheetId,
            targetTab,
            {
              sheetType: record.sheetType,
              purchaseDate: record.purchaseDate,
              category: record.category,
              purchaseItem: record.purchaseItem,
              amount: record.amount,
              beCorp: record.beCorp,
              credit: record.credit,
              note: record.note,
            },
            effectiveToken
          );

          setSheetRecords((prev) => {
            if (!prev) return prev;
            const assignedRowIndex =
              appendRes?.rowIndex ??
              (() => {
                const sameTabRows = prev.filter(
                  (r) => r.sheetType === record.sheetType && typeof r.rowIndex === 'number'
                );
                const maxRow = sameTabRows.reduce((m, r) => Math.max(m, r.rowIndex || 0), 1);
                return maxRow + 1;
              })();

            return prev.map((r) =>
              r.id === record.id
                ? { ...r, syncedToSheet: true, syncing: false, rowIndex: assignedRowIndex }
                : r
            );
          });
        } catch (err: any) {
          anyError = true;
          setSheetRecords((prev) =>
            prev ? prev.filter((r) => r.id !== record.id) : prev
          );
          if (err?.message?.includes('TOKEN_EXPIRED') || err?.message?.includes('401')) {
            clearStoredAccessToken();
            setAccessToken(null);
          }
          showToast(
            'warning',
            `Không thể tự động đẩy "${record.purchaseItem}" lên Google Sheet (${err?.message || 'Lỗi kết nối'}). Đã lưu trên máy.`
          );
          setLocalNewRecords((prev) => [...prev, { ...record, syncing: false, syncedToSheet: false }]);
        }
      }

      if (!anyError) {
        showToast(
          'success',
          createdRecords.length > 1
            ? `✓ Đã tự động đồng bộ thành công ${createdRecords.length} dòng lên Google Sheet!`
            : `✓ Đã tự động đồng bộ thành công "${createdRecords[0].purchaseItem}" lên Google Sheet!`
        );
        // Debounced background sync (2.5s) to avoid Google Sheets API rate-limiting
        scheduleDebouncedBackgroundSync(effectiveSheetId, effectiveToken);
      }
    } else {
      setLocalNewRecords((prev) => [...prev, ...createdRecords]);
      showToast(
        'warning',
        createdRecords.length > 1
          ? `Đã lưu tạm ${createdRecords.length} giao dịch trên máy (Chưa kết nối Google Sheet). Bấm đồng bộ để đẩy lên Sheet.`
          : `Đã lưu tạm "${createdRecords[0].purchaseItem}" trên máy (Chưa kết nối Google Sheet). Bấm đồng bộ để đẩy lên Sheet.`
      );
    }

    if (createdRecords.length > 0 && !isAllMonthsSelected && !selectedMonths.includes(createdRecords[0].monthKey)) {
      setSelectedMonths([createdRecords[0].monthKey]);
    }
  };

  // Edit transaction handler
  const handleSaveEditedTransaction = async (updated: TransactionRecord) => {
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    // 1. Optimistic update
    setSheetRecords((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev
    );
    setLocalNewRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setAttachedRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );

    // 2. If already on Google Sheet
    if (updated.rowIndex && effectiveSheetId && (effectiveToken || isAppsScript)) {
      const expensesTab = sheetMeta?.expensesTab || 'Expenses';
      const incomeTab = sheetMeta?.incomeTab || 'Income';
      const originalRecord = (sheetRecords || []).find((r) => r.id === updated.id);
      const originalSheetType = originalRecord?.sheetType ?? updated.sheetType;
      const originalTab = originalSheetType === 'Income' ? incomeTab : expensesTab;
      const targetTab = updated.sheetType === 'Income' ? incomeTab : expensesTab;

      if (originalTab !== targetTab) {
        // Tab changed: delete from old tab and append to new tab
        const oldSheetId =
          sheetMeta?.sheetIdsByName?.[originalTab] ??
          (originalRecord?.sheetType === 'Income' ? 392215035 : 1528073380);
        await deleteTransactionFromSheet(effectiveSheetId, oldSheetId, updated.rowIndex, effectiveToken, originalTab);
        await appendTransactionToSheet(
          effectiveSheetId,
          targetTab,
          {
            sheetType: updated.sheetType,
            purchaseDate: updated.purchaseDate,
            category: updated.category,
            purchaseItem: updated.purchaseItem,
            amount: updated.amount,
            beCorp: updated.beCorp,
            credit: updated.credit,
            note: updated.note,
          },
          effectiveToken
        );
      } else {
        await updateTransactionOnSheet(
          effectiveSheetId,
          targetTab,
          updated.rowIndex,
          {
            sheetType: updated.sheetType,
            purchaseDate: updated.purchaseDate,
            category: updated.category,
            purchaseItem: updated.purchaseItem,
            amount: updated.amount,
            beCorp: updated.beCorp,
            credit: updated.credit,
            note: updated.note,
          },
          effectiveToken
        );
      }

      showToast('success', `✓ Đã cập nhật "${updated.purchaseItem}" trên Google Sheet!`);
      // Debounced background sync (2.5s) to avoid Google Sheets API rate-limiting
      scheduleDebouncedBackgroundSync(effectiveSheetId, effectiveToken);
    } else {
      showToast('success', `✓ Đã cập nhật giao dịch "${updated.purchaseItem}"!`);
    }
  };

  // Delete transaction handler
  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    const target = deletingTransaction;
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    setIsDeleting(true);
    try {
      // 1. Optimistic remove with row index decrement for shifted rows
      setSheetRecords((prev) => {
        if (!prev) return prev;
        const filtered = prev.filter((r) => r.id !== target.id);
        if (target.rowIndex !== undefined) {
          return filtered.map((r) => {
            if (
              r.sheetType === target.sheetType &&
              r.rowIndex !== undefined &&
              r.rowIndex > target.rowIndex!
            ) {
              return { ...r, rowIndex: r.rowIndex - 1 };
            }
            return r;
          });
        }
        return filtered;
      });
      setLocalNewRecords((prev) => prev.filter((r) => r.id !== target.id));
      setAttachedRecords((prev) => prev.filter((r) => r.id !== target.id));

      // 2. If it is on Google Sheet
      if (target.rowIndex && effectiveSheetId && (effectiveToken || isAppsScript)) {
        const expensesTab = sheetMeta?.expensesTab || 'Expenses';
        const incomeTab = sheetMeta?.incomeTab || 'Income';
        const tabName = target.sheetType === 'Income' ? incomeTab : expensesTab;
        const sheetId =
          sheetMeta?.sheetIdsByName?.[tabName] ??
          (target.sheetType === 'Income' ? 392215035 : 1528073380);

        await deleteTransactionFromSheet(effectiveSheetId, sheetId, target.rowIndex, effectiveToken, tabName);
        showToast('success', `✓ Đã xóa vĩnh viễn dòng #${target.rowIndex} ("${target.purchaseItem}") khỏi Google Sheet!`);
        // Debounced background sync (2.5s) to avoid Google Sheets API rate-limiting
        scheduleDebouncedBackgroundSync(effectiveSheetId, effectiveToken);
      } else {
        showToast('success', `✓ Đã xóa giao dịch "${target.purchaseItem}"!`);
      }

      setDeletingTransaction(null);
    } catch (err: any) {
      showToast('warning', `Không thể xóa giao dịch: ${err?.message || 'Lỗi không xác định'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenAddModal = useCallback(() => {
    setAddModalPreset(null);
    setIsAddModalOpen(true);
  }, []);

  const handleEditTransaction = useCallback((tx: TransactionRecord) => {
    setEditingTransaction(tx);
  }, []);

  const handleDeleteTransaction = useCallback((tx: TransactionRecord) => {
    setDeletingTransaction(tx);
  }, []);

  const handleToggleCharts = useCallback(() => {
    setShowCharts((prev) => !prev);
  }, []);

  const handleOpenTransfer = useCallback(() => {
    setAddModalPreset({ note: 'TRANSFER_MODE' });
    setIsAddModalOpen(true);
  }, []);

  const handleOpenAddModalWithPreset = useCallback((preset?: Partial<NewTransactionPayload> | null) => {
    setAddModalPreset(preset ?? null);
    setIsAddModalOpen(true);
  }, []);

  // Push pending to sheet (delegates to handleConnectAndSyncSheet which auto-pushes all pending)
  const handlePushPendingToSheet = useCallback(async () => {
    const effectiveToken = accessToken || getStoredAccessToken();
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!effectiveSheetId) return;
    await handleConnectAndSyncSheet(effectiveSheetId, effectiveToken || undefined);
  }, [accessToken, sheetMeta, spreadsheetInput, handleConnectAndSyncSheet]);

  const handleSelectIncomeTab = async (tabName: string) => {
    if (!sheetMeta) return;
    const token = accessToken || getStoredAccessToken();
    try {
      localStorage.setItem('heomeo_custom_income_tab_v1', tabName);
      const updatedMeta = { ...sheetMeta, incomeTab: tabName };
      setSheetMeta(updatedMeta);
      if (token) {
        setIsSyncing(true);
        const incomeRows = await fetchTabTransactions(sheetMeta.spreadsheetId, tabName, 'Income', token);
        setSheetRecords((prev) => {
          const expenses = (prev || []).filter((r) => r.sheetType === 'Expenses');
          return [...expenses, ...incomeRows];
        });
        showToast('success', `Đã chuyển sang Bảng Thu nhập "${tabName}": tìm thấy ${incomeRows.length} dòng.`);
      } else {
        showToast('warning', `Đã chọn Bảng Thu nhập "${tabName}". Vui lòng kết nối Google Sheet để tải dữ liệu.`);
      }
    } catch (err: any) {
      showToast('warning', `Lỗi đọc tab "${tabName}": ${err?.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectExpensesTab = async (tabName: string) => {
    if (!sheetMeta) return;
    const token = accessToken || getStoredAccessToken();
    try {
      localStorage.setItem('heomeo_custom_expenses_tab_v1', tabName);
      const updatedMeta = { ...sheetMeta, expensesTab: tabName };
      setSheetMeta(updatedMeta);
      if (token) {
        setIsSyncing(true);
        const expenseRows = await fetchTabTransactions(sheetMeta.spreadsheetId, tabName, 'Expenses', token);
        setSheetRecords((prev) => {
          const incomes = (prev || []).filter((r) => r.sheetType === 'Income');
          return [...expenseRows, ...incomes];
        });
        showToast('success', `Đã chuyển sang Bảng Chi tiêu "${tabName}": tìm thấy ${expenseRows.length} dòng.`);
      } else {
        showToast('warning', `Đã chọn Bảng Chi tiêu "${tabName}". Vui lòng kết nối Google Sheet để tải dữ liệu.`);
      }
    } catch (err: any) {
      showToast('warning', `Lỗi đọc tab "${tabName}": ${err?.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const header = 'Purchase Date,Category,Purchase Item,Amount,BE Corp,Credit,\r\n';
    const escapeCell = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const body = allRecords
      .filter((r) => r.sheetType === 'Expenses')
      .map((r) => {
        const amt = formatNumberForSheet(r.amount, true, true);
        const be = r.beCorp !== 0 ? formatNumberForSheet(r.beCorp, false, true) : '';
        const cr = r.credit !== 0 ? formatNumberForSheet(r.credit, false, true) : '';
        const note = r.note ? escapeCell(r.note) : '';
        return [
          escapeCell(r.purchaseDate),
          escapeCell(r.category),
          escapeCell(r.purchaseItem),
          escapeCell(amt),
          escapeCell(be),
          escapeCell(cr),
          note,
        ].join(',');
      })
      .join('\r\n');

    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expenses_Export_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalExpensesCount = useMemo(
    () => allRecords.filter((r) => r.sheetType === 'Expenses').length,
    [allRecords]
  );
  const totalIncomeCount = useMemo(
    () => allRecords.filter((r) => r.sheetType === 'Income').length,
    [allRecords]
  );

  const handleLockApp = useCallback(() => {
    lockDevice();
    setIsUnlocked(false);
    showToast('success', 'Đã khóa ứng dụng an toàn');
  }, [showToast]);

  if (!isUnlocked) {
    return <AppLockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--ink)] transition-colors">
      {/* ═══════ COFRA DESKTOP LEFT SIDEBAR (Only active in Cofra preset on lg+ screens) ═══════ */}
      {preset === 'cofra' && (
        <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-64 bg-[var(--side-bg)] text-[var(--side-ink)] border-r border-[var(--side-line)] flex-col justify-between p-4 z-40 transition-colors select-none">
          <div className="space-y-4">
            {/* Cofra Brand Header */}
            <div className="flex items-center gap-3 px-2 py-1">
              <div
                role="button"
                tabIndex={0}
                className="flex items-center -space-x-2 p-1 rounded-xl bg-black/10 dark:bg-white/10 border border-[var(--side-line)] cursor-pointer hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                onClick={() => setActiveTab('dashboard')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveTab('dashboard');
                  }
                }}
                title="Heo & Mèo Finance"
                aria-label="Trang chủ Dashboard"
              >
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-1 ring-white dark:ring-black flex items-center justify-center shadow-xs z-10">
                  <PigIcon className="w-4.5 h-4.5" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-1 ring-white dark:ring-black flex items-center justify-center shadow-xs z-0">
                  <SiameseCatIcon className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold tracking-tight text-[var(--side-ink)] font-display truncate">
                    Heo &amp; Mèo
                  </h1>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[var(--side-ink)]">
                    COFRA
                  </span>
                </div>
                <span className="text-[10.5px] text-[var(--side-muted)] block truncate">
                  Ba mẹ Chuối, Đậu, Vịt
                </span>
              </div>
            </div>

            {/* Cofra Navigation: MONEY */}
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--side-muted)] px-2.5 mb-1.5">
                Money &amp; Sổ cái
              </div>
              <nav className="space-y-1">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'ledger', label: 'Sổ giao dịch', icon: ReceiptText, count: periodRecords.length },
                  { id: 'reconcile', label: 'Check tiền & Đối soát', icon: Scale },
                  { id: 'sync', label: 'Đồng bộ Sheets', icon: RefreshCw },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        animateIconBounce(e.currentTarget);
                        setActiveTab(item.id as any);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-bold border border-[var(--line)]'
                          : 'text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--ink)]' : 'text-[var(--side-muted)]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.count === 'number' && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[var(--card-2)] text-[var(--muted)] border border-[var(--line)]">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Cofra Controls: THEME & SETTINGS */}
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--side-muted)] px-2.5 mb-1.5">
                Giao diện &amp; Chế độ
              </div>
              <div className="space-y-1">
                {/* Theme Preset Switcher */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(e.currentTarget, next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--side-ink)] transition-all cursor-pointer"
                  title="Bấm để chuyển về giao diện Kinlo"
                >
                  <div className="flex items-center gap-2.5">
                    <Palette className="w-4 h-4 text-[var(--side-ink)]" />
                    <span>Theme Preset</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--card)] text-[var(--ink)] border border-[var(--line)]">
                    Cofra Luxe
                  </span>
                </button>

                {/* Dark / Light Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-slate-200" />}
                    <span>Chế độ hiển thị</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--side-ink)]">
                    {isDark ? 'Tối' : 'Sáng'}
                  </span>
                </button>

                {/* Privacy Mode Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isPrivate ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                    <span>Bảo mật số tiền</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--side-ink)]">
                    {isPrivate ? 'Đang ẩn' : 'Hiện'}
                  </span>
                </button>

                {/* Monthly Report Modal */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Share2 className="w-4 h-4 text-amber-500" />
                    <span>Báo cáo tháng</span>
                  </div>
                  <span className="text-[10px] text-[var(--side-muted)]">Xem</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cofra Sidebar Footer Profile */}
          <div className="pt-3 border-t border-[var(--side-line)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--card)] border border-[var(--line)] flex items-center justify-center font-bold text-[11px] text-[var(--ink)]">
                HM
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--side-ink)] block truncate">Heo &amp; Mèo</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLockApp}
              className="p-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Khóa ứng dụng"
              aria-label="Khóa ứng dụng an toàn"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Container Wrapper (shifts right on lg when Cofra preset active) */}
      <div className={`flex-1 flex flex-col transition-all ${preset === 'cofra' ? 'lg:pl-64' : ''}`}>
        {/* ═══════ HEADER: KINLO FLOATING GLASS OR COFRA SLIM BREADCRUMB ═══════ */}
        {preset === 'kinlo' ? (
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 sm:pt-4">
            <header className="w-full px-4 sm:px-6 py-3 rounded-2xl sm:rounded-3xl bg-[var(--glass)] backdrop-blur-xl border border-[var(--line)] shadow-[var(--shadow)] flex flex-wrap items-center justify-between gap-3 text-[var(--ink)] transition-all">
              {/* Left Brand Badge (Duo Avatars: Heo & Mèo) */}
              <div className="flex items-center gap-3">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center -space-x-2.5 p-1 rounded-2xl bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/15 shadow-xs hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0 magnetic focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  onClick={() => setActiveTab('dashboard')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTab('dashboard');
                    }
                  }}
                  title="Heo & Mèo Finance"
                  aria-label="Trang chủ Dashboard"
                >
                  <div
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs z-10"
                    title="Heo 🐷"
                  >
                    <PigIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>
                  <div
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs z-0"
                    title="Mèo Xiêm 🐱"
                  >
                    <SiameseCatIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ink)]">
                      Heo &amp; Mèo
                    </h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--card-2)] text-[var(--accent-text)] border border-[var(--line)]">
                      Finance
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] block font-medium">
                    Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt
                  </span>
                </div>
              </div>

              {/* Center Navigation Tabs (Kinlo Glass Nav Rail) */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold p-1 rounded-2xl bg-[var(--card-2)] border border-[var(--line)] overflow-x-auto max-w-full relative">
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'ledger', label: `Sổ giao dịch (${periodRecords.length})` },
                  { id: 'reconcile', label: 'Check tiền & Đối soát' },
                  {
                    id: 'sync',
                    label: `Đồng bộ (${
                      sheetRecords && sheetRecords.length > 0
                        ? accessToken
                          ? 'Đã kết nối'
                          : 'Đã lưu máy'
                        : 'Chưa kết nối'
                    })`,
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={(e) => {
                        animateIconBounce(e.currentTarget);
                        setActiveTab(tab.id as any);
                      }}
                      className={`relative px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer font-semibold ${
                        isActive
                          ? 'text-[var(--accent-ink)] font-bold'
                          : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="kinlo-active-desktop-pill"
                          className="absolute inset-0 bg-[var(--accent)] rounded-xl shadow-xs"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2">
                {/* Theme Preset Switcher (🌿 Kinlo / 🏛️ Cofra) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(
                      e.currentTarget,
                      next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)'
                    );
                  }}
                  className="magnetic min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] cursor-pointer"
                  title={`Đang dùng: ${activeConfig.name} — Bấm để đổi sang theme ${preset === 'kinlo' ? 'Cofra' : 'Kinlo'}`}
                  aria-label={`Đang dùng ${activeConfig.name}. Bấm để đổi sang theme ${preset === 'kinlo' ? 'Cofra' : 'Kinlo'}`}
                >
                  <Palette className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  <span className="hidden sm:inline font-medium font-mono-tabular">
                    Kinlo
                  </span>
                </button>

                {/* Theme Toggle Button (☀️ Sáng / 🌙 Tối) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="magnetic min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] cursor-pointer"
                  title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
                  aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
                >
                  {isDark ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="hidden sm:inline font-medium">Sáng</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="hidden sm:inline font-medium">Tối</span>
                    </>
                  )}
                </button>

                {/* Privacy Mode Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className={`magnetic min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                    isPrivate
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                      : 'bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                  title={isPrivate ? 'Đang ẩn số tiền — Bấm để hiện' : 'Đang hiện số tiền — Bấm để ẩn'}
                  aria-label={isPrivate ? 'Đang ẩn số tiền. Bấm để hiển thị' : 'Đang hiện số tiền. Bấm để bảo mật ẩn'}
                >
                  {isPrivate ? (
                    <>
                      <EyeOff className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="hidden md:inline">Đang ẩn</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-[var(--muted)] shrink-0" />
                      <span className="hidden md:inline">Hiện số</span>
                    </>
                  )}
                </button>

                {/* Monthly Report Card Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="magnetic min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Báo cáo tài chính tháng"
                  aria-label="Mở báo cáo tài chính tháng"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden lg:inline">Báo cáo</span>
                </button>

                {/* Lock App Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    handleLockApp();
                  }}
                  className="magnetic min-h-[44px] min-w-[44px] p-2 rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] transition-colors cursor-pointer flex items-center justify-center"
                  title="Khóa ứng dụng an toàn"
                  aria-label="Khóa ứng dụng an toàn"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>

                {/* Kinlo Primary Action Button (Thêm giao dịch) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                  className="magnetic kinlo-btn-primary min-h-[44px] px-3 sm:px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md active:scale-95 transition-transform"
                  aria-label="Thêm giao dịch mới"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Thêm giao dịch</span>
                  <span className="sm:hidden">Thêm</span>
                </button>
              </div>
            </header>
          </div>
        ) : (
          /* Cofra Header (Slim & Crisp Breadcrumb Header) */
          <div className="w-full px-4 sm:px-8 pt-3 sm:pt-4">
            <header className="w-full px-4 sm:px-6 py-3 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between gap-3 text-[var(--ink)]">
              {/* Breadcrumb on Desktop / Mobile Brand on Phone */}
              <div className="flex items-center gap-2.5">
                <div className="lg:hidden flex items-center -space-x-2 mr-1">
                  <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-1 ring-white dark:ring-black flex items-center justify-center">
                    <PigIcon className="w-4 h-4" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-1 ring-white dark:ring-black flex items-center justify-center">
                    <SiameseCatIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                  <span className="font-bold text-[var(--ink)]">Heo &amp; Mèo</span>
                  <span>/</span>
                  <span className="text-[var(--ink)] font-bold">
                    {activeTab === 'dashboard' ? 'Overview' : activeTab === 'ledger' ? 'Activity' : activeTab === 'reconcile' ? 'Check tiền & Đối soát' : 'Sync'}
                  </span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2">
                {/* Theme Preset Switcher */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(e.currentTarget, next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)');
                  }}
                  className="min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Bấm để chuyển sang theme Kinlo"
                  aria-label="Bấm để chuyển sang theme Kinlo"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-mono text-[11px]">Cofra</span>
                </button>

                {/* Dark/Light Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="min-h-[44px] min-w-[44px] p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center justify-center gap-1"
                  title={isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}
                  aria-label={isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                {/* Privacy Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className={`min-h-[44px] min-w-[44px] p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                    isPrivate ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' : 'bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                  title={isPrivate ? 'Hiện số tiền' : 'Ẩn số tiền'}
                  aria-label={isPrivate ? 'Đang ẩn số tiền. Bấm để hiển thị' : 'Đang hiện số tiền. Bấm để bảo mật ẩn'}
                >
                  {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-[var(--muted)]" />}
                </button>

                {/* Report button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="hidden sm:flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer"
                  title="Báo cáo tài chính"
                  aria-label="Mở báo cáo tài chính tháng"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Báo cáo</span>
                </button>

                {/* Lock button */}
                <button
                  type="button"
                  onClick={handleLockApp}
                  className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] transition-colors cursor-pointer flex items-center justify-center"
                  title="Khóa ứng dụng"
                  aria-label="Khóa ứng dụng an toàn"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>

                {/* Primary Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                  className="magnetic kinlo-btn-primary min-h-[44px] px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
                  aria-label="Thêm giao dịch mới"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Thêm giao dịch</span>
                  <span className="sm:hidden">Thêm</span>
                </button>
              </div>
            </header>
          </div>
        )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs pointer-events-none"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-5 pb-24 md:pb-6">
        {/* ═══════ KINLO GREETING HERO BAR (PHEAD) ═══════ */}
        <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] font-display">
              Xin chào, Heo &amp; Mèo 👋
            </h2>
            <div className="text-xs sm:text-sm text-[var(--muted)] mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span>{formatTodayDate()}</span>
              <span>·</span>
              <span className="font-mono-tabular">Chu kỳ BE: <strong>{kpiStats.beRange.displayLabel}</strong></span>
              <span>·</span>
              <span className="font-mono-tabular">Sao kê Credit: <strong>{kpiStats.creditRange.displayLabel}</strong></span>
            </div>
          </div>

          {/* Kinlo Action Controls Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter 1: Date Range Multi-Month Picker */}
            <MultiMonthPickerDropdown
              availableMonths={availableMonths}
              selectedMonths={selectedMonths}
              onChange={(nextMonths) => {
                userHasManuallySelectedMonthRef.current = true;
                setSelectedMonths(nextMonths);
              }}
              monthRecordCounts={monthRecordCounts}
              totalRecordCount={allRecords.length}
            />

            {/* Filter 2: Multi-Category Picker Dropdown (Only show on dashboard and ledger tabs) */}
            {(activeTab === 'dashboard' || activeTab === 'ledger') && (
              <MultiCategoryPickerDropdown
                allCategories={allCategories}
                selectedCategories={isAllCategoriesSelected ? allCategories : selectedCategories}
                onChange={handleSelectCategories}
                categoryRecordCounts={categoryRecordCounts}
                categorySpentTotals={categorySpentTotals}
                totalRecordCount={periodRecords.length}
              />
            )}

            {/* Reset Filter Button if active */}
            {(!isAllMonthsSelected || selectedMonths.length !== 1 || selectedMonths[0] !== defaultLatestMonth || !isAllCategoriesSelected) && (
              <button
                type="button"
                onClick={() => {
                  userHasManuallySelectedMonthRef.current = false;
                  setSelectedMonths([defaultLatestMonth]);
                  setSelectedCategories([]);
                }}
                className="text-xs text-[var(--accent-text)] hover:underline font-semibold px-2 py-1 cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            )}

            {/* Quick Move Budget Button */}
            <button
              type="button"
              onClick={() => {
                setAddModalPreset({ note: 'TRANSFER_MODE' });
                setIsAddModalOpen(true);
              }}
              className="kinlo-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              title="Chuyển hạn mức ngân sách giữa 2 danh mục"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Chuyển Budget</span>
            </button>

            {/* Quick Sync Sheet Button */}
            {sheetMeta && accessToken ? (
              <button
                type="button"
                onClick={() => handleConnectAndSyncSheet(sheetMeta.spreadsheetId)}
                disabled={isSyncing}
                className="kinlo-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Đồng bộ Sheet</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ═══════ ACTIVE CATEGORY FILTER BANNER ═══════ */}
        <AnimatePresence>
          {!isAllCategoriesSelected && (activeTab === 'dashboard' || activeTab === 'ledger') && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-900 dark:text-sky-200 shadow-2xs overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
                <span>
                  Đang lọc riêng theo danh mục:{' '}
                  <strong className="font-extrabold text-sky-950 dark:text-sky-100 text-sm">
                    {selectedCategories.length === 1
                      ? selectedCategories[0]
                      : `${selectedCategories.length} danh mục (${selectedCategories.join(', ')})`}
                  </strong>
                  {isAllMonthsSelected ? ' · Tất cả thời gian' : ` · ${selectedMonthsLabel}`}
                  {' · '}
                  <strong>{categoryKpiStats?.count || 0}</strong> giao dịch
                  {' · '}
                  Tổng chi:{' '}
                  <strong className="font-mono-tabular font-bold text-sky-950 dark:text-sky-100 text-sm">
                    {formatCurrency(categoryKpiStats?.spent || 0)}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className="px-3 py-1 font-semibold text-xs text-sky-800 dark:text-sky-200 bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-sky-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                ✕ Xem tất cả danh mục
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoadingInitial ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Đang nạp dữ liệu lịch sử tài chính của bạn...
          </div>
        ) : (
          <>
            {/* VIEW CONTENT */}
            <div>
              {/* VIEW 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div key="dashboard" ref={dashboardRef} className="space-y-5">
                {/* ═══════ KINLO HERO ASYMMETRIC 7fr / 5fr GRID ═══════ */}
                {categoryKpiStats ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Left 7 Cols: Category Cashflow & Budget Card */}
                    <div className="lg:col-span-7">
                      <KinloCashflowCard
                        income={categoryKpiStats.budget}
                        totalExpense={categoryKpiStats.spent}
                        netBalance={categoryKpiStats.remaining}
                        livingExpense={Math.max(0, categoryKpiStats.spent - categoryKpiStats.beCorp - categoryKpiStats.credit)}
                        savingsExpense={0}
                        beCorpCycleTotal={categoryKpiStats.beCorp}
                        creditCycleTotal={categoryKpiStats.credit}
                        incomeCount={1}
                        expenseCount={categoryKpiStats.count}
                        periodLabel={`Đang xem danh mục: ${categoryKpiStats.category}`}
                        onViewLedger={() => setActiveTab('ledger')}
                        className="h-full"
                      />
                    </div>

                    {/* Right 5 Cols: Category In the Bank & Cards Card */}
                    <div className="lg:col-span-5">
                      <KinloBankAccountsCard
                        beCorpAmount={categoryKpiStats.beCorp}
                        creditAmount={categoryKpiStats.credit}
                        beCorpCount={0}
                        creditCount={0}
                        beRangeLabel={kpiStats.beRange.displayLabel}
                        creditRangeLabel={kpiStats.creditRange.displayLabel}
                        dailySafeSpend={0}
                        onReconcileClick={() => setActiveTab('reconcile')}
                        className="h-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Left 7 Cols: Kinlo Cashflow & Budget Card */}
                    <div className="lg:col-span-7">
                      <KinloCashflowCard
                        income={kpiStats.effectiveIncome}
                        totalExpense={kpiStats.totalExpense}
                        netBalance={kpiStats.netBalance}
                        livingExpense={kpiStats.livingExpense}
                        savingsExpense={kpiStats.savingsExpense}
                        beCorpCycleTotal={kpiStats.beCorpCycleTotal}
                        creditCycleTotal={kpiStats.creditCycleTotal}
                        incomeCount={kpiStats.incomeCount}
                        expenseCount={kpiStats.expenseCount}
                        periodLabel={selectedMonthsLabel}
                        onViewLedger={() => setActiveTab('ledger')}
                        className="h-full"
                      />
                    </div>

                    {/* Right 5 Cols: Kinlo In The Bank & Cards Card */}
                    <div className="lg:col-span-5">
                      <KinloBankAccountsCard
                        beCorpAmount={kpiStats.beCorpCycleTotal}
                        creditAmount={kpiStats.creditCycleTotal}
                        beCorpCount={kpiStats.beCorpCount}
                        creditCount={kpiStats.creditCount}
                        beRangeLabel={kpiStats.beRange.displayLabel}
                        creditRangeLabel={kpiStats.creditRange.displayLabel}
                        dailySafeSpend={Math.max(0, Math.round(kpiStats.netBalance / 30))}
                        onReconcileClick={() => setActiveTab('reconcile')}
                        className="h-full"
                      />
                    </div>
                  </div>
                )}

                {/* ═══════ MULTI-MONTH BUDGET & CASHFLOW SUMMARY MATRIX (Answers Requirement 5) ═══════ */}
                <Suspense fallback={<TableSkeletonLoader label="Đang tải ma trận dòng tiền đa tháng..." />}>
                  <MultiMonthSummaryTable
                    allRecords={allRecords}
                    availableMonths={availableMonths}
                    selectedMonth={selectedMonth}
                    selectedMonths={selectedMonths}
                    onSelectMonth={handleSelectMonth}
                    onToggleMonth={handleToggleMonth}
                    monthlyBaseIncome={monthlyBaseIncome}
                    beCorpStartDay={beCorpStartDay}
                    beCorpEndDay={beCorpEndDay}
                    creditStartDay={creditStartDay}
                    creditEndDay={creditEndDay}
                    isPrivate={isPrivate}
                  />
                </Suspense>

                {/* ═══════ MỚI: NGÂN SÁCH & CHI TIÊU THEO HẠNG MỤC (Budget · Đã chi · Còn lại) ═══════ */}
                <Suspense fallback={<TableSkeletonLoader label="Đang tải bảng ngân sách hạng mục..." />}>
                  <CategoryBudgetTable
                    recordsInPeriod={periodRecords}
                    allRecords={allRecords}
                    totalIncome={kpiStats.effectiveIncome}
                    selectedMonth={selectedMonth}
                    selectedMonths={selectedMonths}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleSelectCategory}
                    selectedCategories={isAllCategoriesSelected ? EMPTY_CATEGORIES_ARRAY : selectedCategories}
                    onSelectCategories={handleSelectCategories}
                    onToggleCategory={handleToggleCategory}
                    showChartsButton={true}
                    onShowCharts={handleToggleCharts}
                    onOpenTransfer={handleOpenTransfer}
                    budgetTransfers={budgetTransfers}
                    isPrivate={isPrivate}
                    precomputedRollover={memoizedRolloverResult}
                  />
                </Suspense>

                {/* ═══════ OPTIONAL: BIỂU ĐỒ BỔ TRỢ (TOP CHI TIÊU & TỶ TRỌNG) KHI BẬT ═══════ */}
                {showCharts && (
                  <Suspense fallback={<ChartSkeletonLoader label="Đang tải biểu đồ phân tích dòng tiền..." />}>
                    <AnalyticsCharts
                      expensesInPeriod={periodRecords}
                      allRecords={allRecords}
                      selectedMonth={selectedMonth}
                      selectedMonths={selectedMonths}
                      onSelectMonth={handleSelectMonth}
                      onToggleMonth={handleToggleMonth}
                      selectedCategoryFilter={selectedCategory}
                      onSelectCategoryFilter={handleSelectCategory}
                      selectedCategories={isAllCategoriesSelected ? EMPTY_CATEGORIES_ARRAY : selectedCategories}
                      onToggleCategoryFilter={handleToggleCategory}
                      monthlyBaseIncome={monthlyBaseIncome}
                      isPrivate={isPrivate}
                    />
                  </Suspense>
                )}

                {/* ═══════ LỊCH CHI TIÊU TRỰC QUAN (CALENDAR HEATMAP VIEW) ═══════ */}
                <Suspense fallback={<TableSkeletonLoader label="Đang nạp lịch chi tiêu trực quan..." />}>
                  <CalendarHeatmapView
                    records={periodRecords}
                    allRecords={allRecords}
                    selectedMonth={selectedMonth}
                    onOpenAddModalWithPreset={handleOpenAddModalWithPreset}
                    onSelectTransaction={handleEditTransaction}
                    isPrivate={isPrivate}
                  />
                </Suspense>
                </div>
              )}

              {/* VIEW 2: FULL TRANSACTION LEDGER */}
              {activeTab === 'ledger' && (
                <div key="ledger" className="animate-in fade-in duration-200">
                  <Suspense fallback={<TableSkeletonLoader label="Đang tải sổ chi tiết giao dịch..." />}>
                    <TransactionLedgerTable
                      records={periodRecords}
                      selectedCategory={selectedCategory}
                      onSelectCategory={handleSelectCategory}
                      selectedCategories={isAllCategoriesSelected ? EMPTY_CATEGORIES_ARRAY : selectedCategories}
                      onSelectCategories={handleSelectCategories}
                      onOpenAddModal={handleOpenAddModal}
                      onEditTransaction={handleEditTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      onPushPendingToSheet={handlePushPendingToSheet}
                      isSyncing={isSyncing}
                      periodLabel={selectedMonthsLabel}
                      isPrivate={isPrivate}
                    />
                  </Suspense>
                </div>
              )}

              {/* VIEW 3: CHECK TIỀN & CHU KỲ BE CORP / CREDIT */}
              {activeTab === 'reconcile' && (
                <div key="reconcile" className="animate-in fade-in duration-200">
                  <Suspense fallback={<ReconcileSkeletonLoader label="Đang nạp màn hình đối soát ví & thẻ..." />}>
                    <ReconcileCheckTienView
                      allRecords={allRecords}
                      selectedMonth={selectedMonth}
                      onOpenAddWithPreset={(preset) => {
                        setAddModalPreset(preset);
                        setIsAddModalOpen(true);
                      }}
                      checkTienData={checkTienData}
                      onEditTransaction={(tx) => setEditingTransaction(tx)}
                    />
                  </Suspense>
                </div>
              )}

              {/* VIEW 4: GOOGLE SHEET SYNC PANEL */}
              {activeTab === 'sync' && (
                <div key="sync" className="animate-in fade-in duration-200">
                  <Suspense fallback={<SheetSyncSkeletonLoader label="Đang nạp bảng đồng bộ Google Sheet..." />}>
                    <SheetSyncPanel
                      user={user}
                      accessToken={accessToken}
                      isLoggingIn={isLoggingIn}
                      onGoogleLogin={handleGoogleLogin}
                      onGoogleLogout={handleGoogleLogout}
                      spreadsheetInput={spreadsheetInput}
                      onChangeSpreadsheetInput={setSpreadsheetInput}
                      sheetMeta={sheetMeta}
                      isSyncing={isSyncing}
                      syncError={syncError}
                      lastSyncedAt={lastSyncedAt}
                      onConnectAndSyncSheet={handleConnectAndSyncSheet}
                      pendingLocalRecords={localNewRecords.filter((r) => !r.syncedToSheet)}
                      onPushPendingToSheet={handlePushPendingToSheet}
                      onExportCsv={handleExportCsv}
                      totalExpensesCount={totalExpensesCount}
                      totalIncomeCount={totalIncomeCount}
                      onSelectIncomeTab={handleSelectIncomeTab}
                      onSelectExpensesTab={handleSelectExpensesTab}
                    />
                  </Suspense>
                </div>
              )}
            </div>
        </>
      )}
      </main>
      </div>

      <Suspense fallback={null}>
        {/* ADD TRANSACTION MODAL */}
        {isAddModalOpen && (
          <AddTransactionModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleSaveTransaction}
            onSaveTransfer={handleSaveTransfer}
            suggestions={itemSuggestions}
            isSheetConnected={Boolean(
              (sheetMeta || spreadsheetInput) &&
              (accessToken || getStoredAccessToken() || isAppsScriptUrl(spreadsheetInput) || isAppsScriptUrl(sheetMeta?.spreadsheetId))
            )}
            initialPreset={addModalPreset}
            allRecords={allRecords}
            onGoogleLogin={handleGoogleLogin}
            expensesTabName={sheetMeta?.expensesTab || 'Expenses'}
            incomeTabName={sheetMeta?.incomeTab || 'Income'}
          />
        )}

        {/* EDIT TRANSACTION MODAL */}
        {editingTransaction && (
          <EditTransactionModal
            isOpen={Boolean(editingTransaction)}
            onClose={() => setEditingTransaction(null)}
            record={editingTransaction}
            onSave={handleSaveEditedTransaction}
            onDeleteRequest={(rec) => {
              setEditingTransaction(null);
              setDeletingTransaction(rec);
            }}
          />
        )}

        {/* PWA Install Guide Modal */}
        {isInstallModalOpen && (
          <PwaInstallModal
            isOpen={isInstallModalOpen}
            onClose={() => setIsInstallModalOpen(false)}
            deferredPrompt={deferredPrompt}
            onInstallSuccess={() => showToast('success', 'Đã cài đặt ứng dụng thành công!')}
          />
        )}

        {/* Monthly Report Card Modal (Infographic Card & Image Export) */}
        {isReportModalOpen && (
          <MonthlyReportCardModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            selectedMonth={selectedMonth}
            allRecords={allRecords}
          />
        )}
      </Suspense>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingTransaction && (
          <motion.div
            key="delete-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 cursor-pointer"
            onClick={() => !isDeleting && setDeletingTransaction(null)}
          >
            <motion.div
              key="delete-modal-card"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Xác nhận xóa giao dịch</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch này?
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Mục chi tiêu:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{deletingTransaction.purchaseItem}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ngày:</span>
                  <span className="font-mono-tabular text-slate-700 dark:text-slate-300">{deletingTransaction.purchaseDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Danh mục:</span>
                  <span className="text-slate-700 dark:text-slate-300">{deletingTransaction.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Số tiền:</span>
                  <span className="font-mono-tabular font-bold text-rose-700 dark:text-rose-400">
                    {formatCurrency(deletingTransaction.amount, false, true)}
                  </span>
                </div>
                {deletingTransaction.rowIndex && (
                  <div className="flex justify-between border-t border-slate-200/80 dark:border-slate-700 pt-1.5 mt-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Mã giao dịch:</span>
                    <span className="font-mono-tabular text-teal-700 dark:text-teal-400 font-medium">
                      {deletingTransaction.sheetType === 'Income' ? 'Thu nhập' : 'Chi tiêu'} #{deletingTransaction.rowIndex}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-rose-600 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-2.5">
                ⚠️ Thao tác này sẽ xóa vĩnh viễn giao dịch khỏi hệ thống và cập nhật lại toàn bộ ngân sách. Không thể hoàn tác.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingTransaction(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ KINLO MOBILE BOTTOM NAVIGATION BAR (< md) ═══════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--glass)] backdrop-blur-2xl border-t border-[var(--line)] shadow-2xl px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around text-center">
        {/* Tab 1: Dashboard */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('dashboard');
          }}
          className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
          aria-label="Trang chủ Dashboard"
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Dashboard</span>
          </div>
        </button>

        {/* Tab 2: Ledger */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('ledger');
          }}
          className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
          aria-label="Sổ cái giao dịch"
        >
          {activeTab === 'ledger' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <ReceiptText className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Sổ cái</span>
          </div>
          {periodRecords.length > 0 && (
            <span className="absolute -top-0.5 right-0.5 z-20 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--accent)] text-[var(--accent-ink)]">
              {periodRecords.length}
            </span>
          )}
        </button>

        {/* Central Prominent Quick Add Button (Kinlo Accent Floating Action) */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setAddModalPreset(null);
            setIsAddModalOpen(true);
          }}
          className="magnetic w-11 h-11 min-h-[44px] min-w-[44px] -mt-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
          title="Thêm giao dịch mới"
          aria-label="Thêm giao dịch mới"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Tab 3: Reconcile */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('reconcile');
          }}
          className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'reconcile'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
          aria-label="Đối soát ví & thẻ"
        >
          {activeTab === 'reconcile' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <Scale className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Đối soát</span>
          </div>
        </button>

        {/* Tab 4: Sync */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('sync');
          }}
          className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'sync'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
          aria-label="Đồng bộ Google Sheets"
        >
          {activeTab === 'sync' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <RefreshCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Đồng bộ</span>
          </div>
        </button>
      </nav>
    </div>
  );
}
```

---

# PHẦN 2: 2. LOGIC KẾ TOÁN & CÔNG THỨC TÀI CHÍNH CỐT LÕI

> Chu kỳ BE Corp (26-25), Thẻ tín dụng (20-19), Đa tháng Rollover, computeNormalizedMonthMap O(1), Quỹ sinh hoạt ngày (Runway), Tốc độ đốt tiền (Burn Rate), Hoàn tiền âm và Tách biệt giao dịch [Transfer].

## Đường dẫn: `src/utils/cycleUtils.ts` <a id="duong-dan-srcutilscycleutilsts"></a>

```typescript
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
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curMm = String(curMonth).padStart(2, '0');
    const maxDays = new Date(curYear, curMonth, 0).getDate();
    const maxDd = String(maxDays).padStart(2, '0');
    return {
      startDate: `${curYear}-${curMm}-01`,
      endDate: `${curYear}-${curMm}-${maxDd}`,
      displayLabel: `01/${curMm} – ${maxDd}/${curMm}`,
    };
  }

  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // If startDay <= endDay, it's within the same month (e.g. 1st to end of month)
  if (startDay <= endDay) {
    const maxDaysInMonth = new Date(year, month, 0).getDate();
    const sD = String(Math.max(1, Math.min(maxDaysInMonth, startDay))).padStart(2, '0');
    const eD = String(Math.max(1, Math.min(maxDaysInMonth, endDay))).padStart(2, '0');
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

  const maxDaysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const maxDaysInCurrentMonth = new Date(year, month, 0).getDate();

  const sD = String(Math.max(1, Math.min(maxDaysInPrevMonth, startDay))).padStart(2, '0');
  const eD = String(Math.max(1, Math.min(maxDaysInCurrentMonth, endDay))).padStart(2, '0');
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

/**
 * Detects whether an expense record is a Budget Transfer record
 * (either new standardized format "[Transfer] ..." or historical patterns like "Cho Mèo", "Heo cho", "Chuyển qua...", "Lấy từ...")
 */
export function isBudgetTransferRecord(r: {
  sheetType?: string;
  purchaseItem?: string;
  note?: string;
}): boolean {
  if (r.sheetType !== 'Expenses') return false;
  const item = (r.purchaseItem || '').toLowerCase().trim();
  const note = (r.note || '').toLowerCase().trim();

  if (item.startsWith('[transfer]') || note.includes('transfer budget') || note.startsWith('transfer:')) {
    return true;
  }
  if (item.includes('chuyển qua') || item.includes('lấy từ')) return true;
  if (item === 'cho mèo' || item === 'heo cho') return true;

  return false;
}
```

---

## Đường dẫn: `src/utils/budgetUtils.ts` <a id="duong-dan-srcutilsbudgetutilsts"></a>

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

      // Historical months (T4-T7) are locked historical eras synchronized to Google Sheet Section 2 (R20:R23)
      // They MUST NEVER be retroactively modified by Phase 2 or custom percentages!
      if (mKey <= '2026-07') {
        ratio = DEFAULT_CATEGORY_RATIOS_T4_T7[cat] ?? 0;
        pct = DEFAULT_CATEGORY_PERCENTAGES_T4_T7[cat] ?? (ratio * 100);
      } else {
        if (hasCustomPercentages && customPercentages[cat] !== undefined) {
          pct = customPercentages[cat];
          ratio = pct / 100;
        } else {
          ratio = DEFAULT_CATEGORY_RATIOS[cat] ?? 0;
          pct = DEFAULT_CATEGORY_PERCENTAGES[cat] ?? (ratio * 100);
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

## Đường dẫn: `src/components/DailyLivingRunwayWidget.tsx` <a id="duong-dan-srccomponentsdailylivingrunwaywidgettsx"></a>

```tsx
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
        // Nếu một hạng mục chỉ phát sinh đúng 1 lần (txCount <= 1) và vẫn nằm trong hạn mức (spent <= effectiveBudget),
        // đây là khoản thanh toán trọn gói 1 lần hợp lệ, không phải nhịp độ thường nhật cần cảnh báo.
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
                        ? 'bg-teal-50/80 border-teal-500 shadow-sm ring-2 ring-teal-400/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top: Category Badge & Status */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <CategoryBadge category={item.category} />
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                            statusBadge.type === 'danger'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : statusBadge.type === 'warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : statusBadge.type === 'safe'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Remaining vs Safe daily */}
                      <div className="space-y-1 font-mono-tabular">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-slate-500">Còn lại:</span>
                          <span
                            className={`text-sm font-bold ${
                              item.remaining < 0 ? 'text-rose-600' : 'text-slate-800'
                            }`}
                          >
                            {formatCurrency(item.remaining)}
                          </span>
                        </div>
                        {!dateMetrics.isPast && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] text-teal-700 font-medium">Tiêu tối đa:</span>
                            <span className="text-xs font-bold text-teal-700">
                              {formatCurrency(safeDaily)}
                              <span className="text-[10px] font-normal">/ngày</span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between text-slate-400 text-[10px]">
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
            <div className="pt-2 border-t border-indigo-100/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2 font-medium">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono-tabular border transition-all ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <span className="font-sans font-medium text-slate-800">{item.category}:</span>
                      {isFinished ? (
                        <span className="text-emerald-700 font-bold">Đã chi trả</span>
                      ) : (
                        <span className={item.remaining < 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
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
          <div className="flex items-center gap-2">
            <span className="text-teal-800 font-semibold">⚡ Hạn mức hôm nay:</span>
            <span className="font-black text-teal-700 text-sm">
              {formatCurrency(summary.safeDailyAllowance)} / ngày
            </span>
            <span className="text-slate-500 font-sans text-[11px]">
              (Còn lại {formatCurrency(summary.totalRemaining)} cho {dailyItems.length} quỹ thường nhật)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {summary.isPacingSafe ? (
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

# PHẦN 3: 3. SMART MONEY CALCULATOR PARSER

> Bộ phân tích biểu thức toán học (+, -, *, /), chữ viết tắt tiếng Việt (k, K, tr, m, M) và tiếng lóng/nói (1tr5, 2tr2), kèm UI input component.

## Đường dẫn: `src/utils/mathExpression.ts` <a id="duong-dan-srcutilsmathexpressionts"></a>

```typescript
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

  // Trim any trailing operators/spaces (e.g., '50k + ' -> '50k')
  s = s.replace(/[+\-*/xX×÷:\s]+$/, '');
  if (!s) return null;

  // If already just a plain or comma-formatted number, parse it
  if (!isExpression(s)) {
    const cleanDigits = s.replace(/[^0-9-]/g, '');
    if (!cleanDigits || cleanDigits === '-') return null;
    const n = parseInt(cleanDigits, 10);
    return Number.isFinite(n) ? n : null;
  }

  // Pre-process Vietnamese currency abbreviations:
  // 1. Spoken Vietnamese format: e.g. 1tr5 -> 1.5tr, 1tr2 -> 1.2tr
  s = s.replace(/(\d+)\s*(tr|trieu|m)\s*(\d+)\b/gi, (_match, p1, _p2, p3) => {
    return `${p1}.${p3}tr`;
  });

  // 2. Million (tr, trieu, m) e.g., '1.5tr', '1,5tr', '2tr', '2m'
  s = s.replace(/(\d+),(\d+)\s*(tr|trieu|m)\b/gi, '$1.$2*1000000');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(tr|trieu|m)\b/gi, '($1*1000000)');

  // 3. Thousand (k, K, nghin, ngan) e.g., '50k', '50.5k', '50,5k'
  s = s.replace(/(\d+),(\d+)\s*(k|nghin|ngan)\b/gi, '$1.$2*1000');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(k|nghin|ngan)\b/gi, '($1*1000)');

  // 4. Remove thousand separator commas (e.g., 50,000 -> 50000)
  s = s.replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/,/g, '');

  // 5. Normalize multiplication and division symbols
  s = s.replace(/[xX×]/g, '*');
  s = s.replace(/[÷:]/g, '/');

  // 6. Validate that only safe mathematical tokens remain
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
```

---

## Đường dẫn: `src/components/MoneyCalculatorInput.tsx` <a id="duong-dan-srccomponentsmoneycalculatorinputtsx"></a>

```tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calculator, Check, X, Delete, CornerDownLeft } from 'lucide-react';
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

# PHẦN 4: 4. LOCK SCREEN (PIN), PRIVACY MODE & XUẤT SỔ TÀI CHÍNH THÁNG

> Màn hình khóa PIN bảo mật, mã hóa hash, che số dư riêng tư (Privacy Masking), và hàm xuất Sổ tài chính tháng (PNG Canvas Infographic Card + Sao chép văn bản).

## Đường dẫn: `src/components/AppLockScreen.tsx` <a id="duong-dan-srccomponentsapplockscreentsx"></a>

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';
import { saveStoredWebAppKey } from '../services/appsScriptService';

export const STORAGE_KEY_APP_UNLOCKED = 'heomeo_app_unlocked_v1';
export const STORAGE_KEY_CUSTOM_PIN = 'heomeo_custom_pin_v1';
export const DEFAULT_MASTER_PIN = '[REDACTED]';

export function getEffectiveMasterPin(): string {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (custom && custom.trim().length >= 4) return custom.trim();
  } catch {
    // ignore
  }
  return DEFAULT_MASTER_PIN;
}

export function isDeviceUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_APP_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function lockDevice() {
  try {
    localStorage.removeItem(STORAGE_KEY_APP_UNLOCKED);
  } catch {
    // ignore
  }
}

interface AppLockScreenProps {
  onUnlock: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const masterPin = getEffectiveMasterPin();

  const handleVerifyPin = useCallback(
    (enteredPin: string) => {
      if (enteredPin === masterPin) {
        setIsSuccess(true);
        setErrorMsg(null);
        if (rememberDevice) {
          try {
            localStorage.setItem(STORAGE_KEY_APP_UNLOCKED, 'true');
          } catch {
            // ignore
          }
        }
        // Save to Apps Script API Key storage as well
        saveStoredWebAppKey(enteredPin);

        const t1 = window.setTimeout(() => {
          onUnlock();
        }, 400);
        timersRef.current.push(t1);
      } else {
        setIsShaking(true);
        setErrorMsg('Mã PIN không đúng, vui lòng thử lại');
        const t2 = window.setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
        timersRef.current.push(t2);
      }
    },
    [masterPin, rememberDevice, onUnlock]
  );

  const handlePressDigit = useCallback(
    (digit: string) => {
      if (isSuccess || pin.length >= 6) return;
      setErrorMsg(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 6) {
        handleVerifyPin(nextPin);
      }
    },
    [pin, isSuccess, handleVerifyPin]
  );

  const handleDeleteDigit = useCallback(() => {
    if (isSuccess || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess, pin.length]);

  const handleClearAll = useCallback(() => {
    if (isSuccess) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePressDigit, handleDeleteDigit, handleClearAll]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Background glowing aura */}
      <div className="absolute top-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        {/* App Logo & Lock Icon */}
        <div className="relative mb-4">
          <div className="flex items-center -space-x-3 p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl shadow-indigo-500/25">
            <div
              className="w-12 h-12 rounded-full bg-rose-100 ring-2 ring-white/80 flex items-center justify-center shadow-md z-10"
              title="Heo 🐷"
            >
              <PigIcon className="w-7 h-7" />
            </div>
            <div
              className="w-12 h-12 rounded-full bg-[#FAF4EE] ring-2 ring-white/80 flex items-center justify-center shadow-md z-0"
              title="Mèo Xiêm 🐱"
            >
              <SiameseCatIcon className="w-7 h-7" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-teal-500 border-2 border-slate-950 flex items-center justify-center shadow-md z-20">
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-white" />
            )}
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
          Heo &amp; Mèo
        </h1>
        <p className="text-[11px] text-pink-200/90 font-medium mb-2">
          Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt
        </p>
        <p className="text-xs text-slate-300 font-medium mb-6">
          Nhập mã PIN để mở khóa sổ chi tiêu
        </p>

        {/* 6-dot PIN Indicator */}
        <div
          className={`flex items-center justify-center gap-3.5 mb-6 transition-transform ${
            isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                  isSuccess
                    ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-400/50'
                    : isShaking
                    ? 'bg-rose-500 border-rose-500 scale-105'
                    : isFilled
                    ? 'bg-teal-400 border-teal-400 scale-110 shadow-md shadow-teal-400/40'
                    : 'bg-transparent border-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 sm:gap-3.5 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handlePressDigit(num)}
              className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Clear all, 0, Backspace */}
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
          >
            Xóa hết
          </button>

          <button
            type="button"
            onClick={() => handlePressDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDeleteDigit}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Remember device checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer mb-4 hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 text-teal-500 focus:ring-teal-400 bg-slate-900 cursor-pointer accent-teal-500"
          />
          <span>Ghi nhớ mở khóa trên thiết bị này</span>
        </label>

        {/* Hint button */}
        <button
          type="button"
          onClick={() => setShowHint(!showHint)}
          className="text-[11px] text-slate-400 hover:text-teal-300 underline underline-offset-4 transition-colors cursor-pointer"
        >
          {showHint ? 'Liên hệ Heo để được bật mí 😉' : 'Quên mã PIN?'}
        </button>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Bảo mật 2 lớp kết hợp Google Apps Script API</span>
        </div>
      </div>
    </div>
  );
};
```

---

## Đường dẫn: `src/utils/privacyService.ts` <a id="duong-dan-srcutilsprivacyservicets"></a>

```typescript
import { useSyncExternalStore } from 'react';

export const STORAGE_KEY_PRIVACY = 'heomeo_privacy_mode_v1';

// Mặc định luôn là TRUE (Ẩn số tiền) mỗi khi mở app hoặc tải lại trang
// Bảo vệ dữ liệu tài chính cá nhân khỏi người xung quanh khi mở ở cơ quan, văn phòng hay nơi công cộng
let globalPrivacyMode = true;

const listeners = new Set<() => void>();

export function isPrivacyActive(): boolean {
  return globalPrivacyMode;
}

export function setPrivacyMode(enabled: boolean) {
  if (globalPrivacyMode !== enabled) {
    globalPrivacyMode = enabled;
    listeners.forEach((fn) => fn());
  }
}

export function togglePrivacyMode(): boolean {
  const next = !globalPrivacyMode;
  setPrivacyMode(next);
  return next;
}

function subscribePrivacy(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getPrivacySnapshot(): boolean {
  return globalPrivacyMode;
}

/**
 * Hook to consume and toggle privacy mode anywhere in the app
 */
export function usePrivacyMode() {
  const isPrivate = useSyncExternalStore(subscribePrivacy, getPrivacySnapshot, () => true);

  return {
    isPrivate,
    togglePrivacy: togglePrivacyMode,
  };
}
```

---

## Đường dẫn: `src/components/MonthlyReportCardModal.tsx` <a id="duong-dan-srccomponentsmonthlyreportcardmodaltsx"></a>

```tsx
import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Award,
  Sparkles,
  TrendingUp,
  CreditCard,
  Building2,
} from 'lucide-react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { getBillingCycleRange, isBudgetTransferRecord } from '../utils/cycleUtils';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';
import { usePrivacyMode } from '../utils/privacyService';
import { motion, AnimatePresence } from 'motion/react';

interface MonthlyReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  allRecords: TransactionRecord[];
}

export const MonthlyReportCardModal: React.FC<MonthlyReportCardModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  allRecords,
}) => {
  const { isPrivate: _isPrivate } = usePrivacyMode();
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'cover' | 'insights'>('cover');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetMonth = selectedMonth !== 'ALL' && selectedMonth.includes('-')
    ? selectedMonth
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = targetMonth.split('-');
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);

  // Helper to detect Savings / Investment categories or records
  const isSavingsCategory = (catName: string) => {
    const clean = (catName || '').trim().toLowerCase();
    return (
      clean === 'tiết kiệm' ||
      clean.startsWith('tiết kiệm') ||
      clean.includes('tích lũy') ||
      clean.includes('đầu tư')
    );
  };

  const isSavingsRecord = (r: { category?: string; purchaseItem?: string }) => {
    if (isSavingsCategory(r.category || '')) return true;
    const cleanItem = (r.purchaseItem || '').toLowerCase();
    return (
      cleanItem.includes('tiết kiệm') ||
      cleanItem.includes('chỉ vàng') ||
      cleanItem.includes('cây vàng') ||
      cleanItem.includes('gửi tk')
    );
  };

  // Compute month stats
  const monthRecords = allRecords.filter((r) => r.monthKey === targetMonth);
  const incomeRecords = monthRecords.filter((r) => r.sheetType === 'Income');
  const expenseRecords = monthRecords.filter((r) => r.sheetType === 'Expenses' && !isBudgetTransferRecord(r));

  const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);

  // Separate Savings from Living Expenses
  const savingsRecords = expenseRecords.filter((r) => isSavingsRecord(r));
  const livingExpenseRecords = expenseRecords.filter((r) => !isSavingsRecord(r));

  const savingsAmount = savingsRecords.reduce((sum, r) => sum + r.amount, 0);
  const livingExpense = livingExpenseRecords.reduce((sum, r) => sum + r.amount, 0);

  // Remaining cash & living budget balances
  const cashRemaining = totalIncome - totalExpense;
  const livingRemaining = totalIncome - livingExpense;

  const savingsPctOfIncome = totalIncome > 0 ? (savingsAmount / totalIncome) * 100 : 0;
  const livingPctOfIncome = totalIncome > 0 ? (livingExpense / totalIncome) * 100 : 0;
  const cashSavingsRate = totalIncome > 0 ? (cashRemaining / totalIncome) * 100 : 0;

  // Top Living Categories (excluding Savings)
  const livingCatMap = new Map<string, number>();
  for (const r of livingExpenseRecords) {
    livingCatMap.set(r.category, (livingCatMap.get(r.category) || 0) + r.amount);
  }
  const topLivingCategories = Array.from(livingCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      pctOfLiving: livingExpense > 0 ? (amt / livingExpense) * 100 : 0,
      pctOfTotal: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
    }));

  // Top biggest single living expense item (Loại trừ hoàn toàn các khoản Tiết kiệm / Tích lũy / Đầu tư)
  const sortedLivingExpenses = [...livingExpenseRecords].sort((a, b) => b.amount - a.amount);
  const biggestExpense = sortedLivingExpenses[0] || null;

  // Helper to format the biggest expense title cleanly with fallback to category or note
  const getBiggestExpenseLabel = (exp: TransactionRecord | null): string => {
    if (!exp) return '';
    const item = (exp.purchaseItem || '').trim();
    const cat = (exp.category || '').trim();
    const note = (exp.note || '').trim();

    const hasValidItem = item !== '' && item !== '(Không ghi nội dung)';
    const hasValidCat = cat !== '';

    if (hasValidItem && hasValidCat) {
      if (item.toLowerCase() === cat.toLowerCase()) {
        return item;
      }
      return `${item} (${cat})`;
    }
    if (hasValidItem) {
      return item;
    }
    if (hasValidCat) {
      return cat;
    }
    if (note) {
      return note;
    }
    return 'Khoản chi lớn';
  };

  const biggestExpenseLabel = getBiggestExpenseLabel(biggestExpense);

  // Credit & BE totals using billing cycle ranges (BE: 26–25, Credit: 20–19)
  const beRange = getBillingCycleRange(targetMonth, 26, 25);
  const creditRange = getBillingCycleRange(targetMonth, 20, 19);

  const totalBeCorp = allRecords
    .filter(
      (r) =>
        r.sheetType === 'Expenses' &&
        r.isoDate &&
        r.isoDate >= beRange.startDate &&
        r.isoDate <= beRange.endDate
    )
    .reduce((sum, r) => sum + r.beCorp, 0);

  const totalCredit = allRecords
    .filter(
      (r) =>
        r.sheetType === 'Expenses' &&
        r.isoDate &&
        r.isoDate >= creditRange.startDate &&
        r.isoDate <= creditRange.endDate
    )
    .reduce((sum, r) => sum + r.credit, 0);

  // Previous month calculation
  const prevDate = new Date(yearNum, monthNum - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const [py, pm] = prevMonthKey.split('-');
  const prevMonthLabel = `T${parseInt(pm, 10)}/${py.slice(2)}`;

  // Compute previous month stats for MoM comparison
  const prevMonthStats = (() => {
    const pRecords = allRecords.filter((r) => r.monthKey === prevMonthKey);
    if (pRecords.length === 0) return null;

    const pIncome = pRecords.filter((r) => r.sheetType === 'Income').reduce((s, r) => s + r.amount, 0);
    const pExpenses = pRecords
      .filter((r) => r.sheetType === 'Expenses' && !isBudgetTransferRecord(r))
      .reduce((s, r) => s + r.amount, 0);

    const pSavings = pRecords
      .filter((r) => r.sheetType === 'Expenses' && !isBudgetTransferRecord(r) && isSavingsRecord(r))
      .reduce((s, r) => s + r.amount, 0);
    const pLiving = pExpenses - pSavings;

    const expenseDelta = totalExpense - pExpenses;
    const expenseDeltaPct = pExpenses > 0 ? (expenseDelta / pExpenses) * 100 : 0;

    const livingDelta = livingExpense - pLiving;
    const livingDeltaPct = pLiving > 0 ? (livingDelta / pLiving) * 100 : 0;

    const incomeDelta = totalIncome - pIncome;
    const incomeDeltaPct = pIncome > 0 ? (incomeDelta / pIncome) * 100 : 0;

    // Category shifts: which categories increased or decreased the most (excluding rent and savings)
    const pCatMap = new Map<string, number>();
    for (const r of pRecords.filter((r) => r.sheetType === 'Expenses' && !isBudgetTransferRecord(r))) {
      pCatMap.set(r.category, (pCatMap.get(r.category) || 0) + r.amount);
    }

    const allCatMap = new Map<string, number>();
    for (const r of expenseRecords) {
      allCatMap.set(r.category, (allCatMap.get(r.category) || 0) + r.amount);
    }

    const allCatNames = new Set([...allCatMap.keys(), ...pCatMap.keys()]);
    const catShifts: {
      category: string;
      currentAmt: number;
      prevAmt: number;
      delta: number;
      deltaPct: number;
    }[] = [];

    for (const cat of allCatNames) {
      if (isSavingsRecord({ category: cat }) || cat === 'Thuê nhà') continue;
      const cur = allCatMap.get(cat) || 0;
      const prev = pCatMap.get(cat) || 0;
      const delta = cur - prev;
      const deltaPct = prev > 0 ? (delta / prev) * 100 : cur > 0 ? 100 : 0;
      catShifts.push({ category: cat, currentAmt: cur, prevAmt: prev, delta, deltaPct });
    }

    // Top increase & Top decrease
    const topIncrease = catShifts.filter((c) => c.delta > 50000).sort((a, b) => b.delta - a.delta)[0] || null;
    const topDecrease = catShifts.filter((c) => c.delta < -50000).sort((a, b) => a.delta - b.delta)[0] || null;

    return {
      hasData: true,
      pIncome,
      pExpenses,
      pSavings,
      pLiving,
      expenseDelta,
      expenseDeltaPct,
      livingDelta,
      livingDeltaPct,
      incomeDelta,
      incomeDeltaPct,
      topIncrease,
      topDecrease,
    };
  })();

  // 5% Rule Constants for Traffic Light Evaluation (Đỏ - Vàng - Xanh)
  const MOM_THRESHOLD = 5.0; // 5%

  // Expense MoM status:
  // deltaPct < -5%  => Green (Tiết kiệm hơn)
  // deltaPct > +5%  => Red (Chi nhiều hơn)
  // [-5%, +5%]      => Yellow (Chi tiêu ổn định)
  const isExpenseDecreased = prevMonthStats ? prevMonthStats.expenseDeltaPct < -MOM_THRESHOLD : false;
  const isExpenseIncreased = prevMonthStats ? prevMonthStats.expenseDeltaPct > MOM_THRESHOLD : false;

  // Income MoM status:
  // deltaPct > +5%  => Green (Thu nhập tăng)
  // deltaPct < -5%  => Red (Thu nhập giảm)
  // [-5%, +5%]      => Yellow (Thu nhập ổn định)
  const isIncomeIncreased = prevMonthStats ? prevMonthStats.incomeDeltaPct > MOM_THRESHOLD : false;
  const isIncomeDecreased = prevMonthStats ? prevMonthStats.incomeDeltaPct < -MOM_THRESHOLD : false;

  // Health assessment (Separating Savings from Living Deficit)
  let healthTitle = '';
  let healthDesc = '';
  let healthBadge = '';
  let healthBadgeText = '';
  let healthStars = '';

  if (savingsAmount > 0) {
    if (livingRemaining >= 0) {
      if (cashRemaining >= 0) {
        if (savingsPctOfIncome >= 30) {
          healthStars = '⭐⭐⭐';
          healthTitle = 'Xuất sắc — Tích lũy thần tốc';
          healthDesc = `Bạn đã trích gửi tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), chi tiêu sinh hoạt ${formatCurrency(livingExpense)} rất hợp lý. Dư tiền mặt ${formatCurrency(cashRemaining)}!`;
          healthBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        } else if (savingsPctOfIncome >= 15) {
          healthStars = '⭐⭐';
          healthTitle = 'Tốt & Cân bằng tài chính';
          healthDesc = `Đã trích tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), chi tiêu sinh hoạt ${formatCurrency(livingExpense)} trong tầm kiểm soát. Dư tiền mặt ${formatCurrency(cashRemaining)}.`;
          healthBadge = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        } else {
          healthStars = '⭐';
          healthTitle = 'Tích lũy ổn định';
          healthDesc = `Đã trích tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), sinh hoạt trong ngân sách và vẫn dư ${formatCurrency(cashRemaining)} tiền mặt.`;
          healthBadge = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
          healthBadgeText = `Tích lũy: ${savingsPctOfIncome.toFixed(1)}%`;
        }
      } else {
        // livingRemaining >= 0 but cashRemaining < 0 because savings transfer was aggressive
        healthStars = '💎';
        healthTitle = 'Tích lũy vượt mức — Dòng tiền mặt âm nhẹ';
        healthDesc = `Chi sinh hoạt thực tế chỉ ${formatCurrency(livingExpense)} (thặng dư +${formatCurrency(livingRemaining)}). Dòng tiền ví âm ${formatCurrency(Math.abs(cashRemaining))} là do chủ động trích gửi Tiết kiệm ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập), tài sản tích lũy tăng trưởng rất tốt!`;
        healthBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        healthBadgeText = `Đã trích tiết kiệm: ${savingsPctOfIncome.toFixed(1)}%`;
      }
    } else {
      // livingRemaining < 0
      healthStars = '⚠️';
      healthTitle = 'Chi tiêu sinh hoạt vượt thu nhập';
      healthDesc = `Chi tiêu sinh hoạt (${formatCurrency(livingExpense)}) đã vượt thu nhập ${formatCurrency(Math.abs(livingRemaining))} (chưa tính khoản tiết kiệm ${formatCurrency(savingsAmount)}). Cần rà soát cắt giảm chi tiêu tháng tới!`;
      healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      healthBadgeText = `Thâm hụt sinh hoạt: ${((Math.abs(livingRemaining) / totalIncome) * 100).toFixed(1)}%`;
    }
  } else {
    // No savings recorded
    if (cashRemaining >= 0) {
      if (cashSavingsRate >= 30) {
        healthStars = '⭐⭐⭐';
        healthTitle = 'Xuất sắc — Thặng dư cao';
        healthDesc = `Dư ${formatCurrency(cashRemaining)} (${cashSavingsRate.toFixed(1)}% thu nhập). Nên trích một phần vào quỹ tiết kiệm hoặc đầu tư!`;
        healthBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        healthBadgeText = `Thặng dư: +${cashSavingsRate.toFixed(1)}%`;
      } else if (cashSavingsRate >= 15) {
        healthStars = '⭐⭐';
        healthTitle = 'Tốt & Cân bằng tài chính';
        healthDesc = `Dòng tiền dương khỏe mạnh (+${cashSavingsRate.toFixed(1)}%), chi tiêu sinh hoạt điều độ và kiểm soát tốt.`;
        healthBadge = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
        healthBadgeText = `Dư tiền: +${cashSavingsRate.toFixed(1)}%`;
      } else {
        healthStars = '⭐';
        healthTitle = 'Hòa vốn — Cần tích lũy thêm';
        healthDesc = 'Thu vừa đủ bù chi. Nên rà soát bớt các khoản ăn uống/mua sắm để có quỹ dự phòng an toàn.';
        healthBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        healthBadgeText = `Dư tiền: +${cashSavingsRate.toFixed(1)}%`;
      }
    } else {
      healthStars = '⚠️';
      healthTitle = 'Thâm hụt ngân sách';
      healthDesc = `Chi tiêu vượt thu nhập ${formatCurrency(Math.abs(cashRemaining))}. Cần hãm phanh chi tiêu tháng tới!`;
      healthBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      healthBadgeText = `Thâm hụt: -${((Math.abs(cashRemaining) / totalIncome) * 100).toFixed(1)}%`;
    }
  }

  // Copy Summary text to clipboard
  const handleCopySummary = () => {
    const lines = [
      `📊 BÁO CÁO TÀI CHÍNH THÁNG ${monthNum}/${yearNum} — HEO & MÈO 🐷🐱`,
      `👨‍👩‍👧‍👦 Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt`,
      `---------------------------------`,
      `💰 Tổng thu nhập: ${formatCurrency(totalIncome)}`,
      `🛒 Chi sinh hoạt: ${formatCurrency(livingExpense)} (${livingPctOfIncome.toFixed(1)}% thu nhập)`,
      savingsAmount > 0 ? `🏦 Trích gửi tiết kiệm: ${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập)` : '',
      `💳 Tổng chi thực tế: ${formatCurrency(totalExpense)}`,
      `💵 Dòng tiền mặt còn lại: ${formatCurrency(cashRemaining, cashRemaining > 0)}`,
      `⭐ Đánh giá: ${healthStars} ${healthTitle}`,
      `💡 Chi tiết: ${healthDesc}`,
      prevMonthStats && prevMonthStats.hasData ? [
        `---------------------------------`,
        `📈 So với tháng trước (${prevMonthLabel}):`,
        `  • Tổng chi: ${prevMonthStats.expenseDelta <= 0 ? '' : '+'}${formatCurrency(prevMonthStats.expenseDelta)} (${isExpenseDecreased ? 'tiết kiệm' : isExpenseIncreased ? 'tăng' : 'ổn định'} ${prevMonthStats.expenseDeltaPct.toFixed(1)}%)`,
        `  • Tổng thu nhập: ${prevMonthStats.incomeDelta >= 0 ? '+' : ''}${formatCurrency(prevMonthStats.incomeDelta)} (${prevMonthStats.incomeDeltaPct.toFixed(1)}%)`,
        prevMonthStats.topIncrease ? `  • Tăng nhiều nhất: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
        prevMonthStats.topDecrease ? `  • Cắt giảm tốt nhất: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
      ].filter(Boolean).join('\n') : '',
      `---------------------------------`,
      `🏆 Top Hạng Mục Chi Tiêu Sinh Hoạt:`,
      ...topLivingCategories.map(
        (c, idx) => `  ${idx + 1}. ${c.category}: ${formatCurrency(c.amount)} (${c.pctOfLiving.toFixed(0)}% sinh hoạt)`
      ),
      biggestExpense ? `🌟 Món chi sinh hoạt lớn nhất: ${biggestExpenseLabel} (${formatCurrency(biggestExpense.amount)})` : '',
      totalCredit > 0 ? `💳 Quẹt thẻ tín dụng: ${formatCurrency(totalCredit)}` : '',
      `---------------------------------`,
      `🔗 Xem chi tiết tại https://nguyenquochuydl96.github.io/Expense-Income-Tracker/`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download High-Resolution Infographic Card as PNG via Canvas
  const handleDownloadImage = () => {
    setIsGeneratingImg(true);

    try {
      const canvas = document.createElement('canvas');
      const scale = 2; // High DPI for crisp rendering
      const width = 600;
      const height = (prevMonthStats && prevMonthStats.hasData ? 930 : 830) + (savingsAmount > 0 ? 56 : 0);

      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // 1. Background gradient (Dark Navy fintech theme)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#132247');
      bgGrad.addColorStop(0.35, '#0E1726');
      bgGrad.addColorStop(1, '#0B0F19');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Background decorative glowing circles
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.beginPath();
      ctx.arc(width - 50, 100, 160, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(20, 184, 166, 0.08)';
      ctx.beginPath();
      ctx.arc(50, height - 100, 140, 0, Math.PI * 2);
      ctx.fill();

      // 2. Header Brand
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Heo & Mèo Finance', 36, 55);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt', 36, 76);

      // Period Pill badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(width - 170, 38, 134, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`THÁNG ${monthNum}/${yearNum}`, width - 150, 58);

      // Decorative separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, 96);
      ctx.lineTo(width - 36, 96);
      ctx.stroke();

      // 3. Health Assessment Banner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(36, 115, width - 72, 74, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${healthStars}  ${healthTitle}`, 54, 142);

      // Health badge text on the right
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      const badgeW = ctx.measureText(healthBadgeText).width;
      ctx.fillText(healthBadgeText, width - 54 - badgeW, 142);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      // Word wrap for healthDesc
      const words = healthDesc.split(' ');
      let line = '';
      let descY = 164;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > (width - 108) && n > 0) {
          ctx.fillText(line, 54, descY);
          line = words[n] + ' ';
          descY += 16;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 54, descY);

      // 4. Three Big KPI Cards
      const cardW = (width - 72 - 24) / 3;

      // Card 1: Thu nhập
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.roundRect(36, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.stroke();
      ctx.fillStyle = '#6EE7B7';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TỔNG THU NHẬP', 50, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(totalIncome), 50, 258);
      ctx.fillStyle = 'rgba(110, 231, 183, 0.7)';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${incomeRecords.length} giao dịch`, 50, 280);

      // Card 2: Chi tiêu
      const card2Bg = livingRemaining >= 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(244, 63, 94, 0.12)';
      const card2Border = livingRemaining >= 0 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(244, 63, 94, 0.3)';
      const card2TitleCol = livingRemaining >= 0 ? '#C7D2FE' : '#FDA4AF';
      ctx.fillStyle = card2Bg;
      ctx.beginPath();
      ctx.roundRect(36 + cardW + 12, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = card2Border;
      ctx.stroke();
      ctx.fillStyle = card2TitleCol;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('TỔNG CHI TIÊU', 50 + cardW + 12, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(totalExpense), 50 + cardW + 12, 258);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      const c2Sub = savingsAmount > 0 ? `Sinh hoạt: ${formatNumberForSheet(livingExpense)}` : '100% sinh hoạt';
      ctx.fillText(c2Sub, 50 + cardW + 12, 280);

      // Card 3: Còn lại
      const card3Color = cashRemaining >= 0 ? '#38BDF8' : livingRemaining >= 0 && savingsAmount > 0 ? '#FBBF24' : '#FB7185';
      const card3Bg = cashRemaining >= 0 ? 'rgba(14, 165, 233, 0.12)' : livingRemaining >= 0 && savingsAmount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(244, 63, 94, 0.15)';
      const card3Border = cashRemaining >= 0 ? 'rgba(14, 165, 233, 0.3)' : livingRemaining >= 0 && savingsAmount > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.4)';
      ctx.fillStyle = card3Bg;
      ctx.beginPath();
      ctx.roundRect(36 + (cardW + 12) * 2, 205, cardW, 95, 12);
      ctx.fill();
      ctx.strokeStyle = card3Border;
      ctx.stroke();
      ctx.fillStyle = card3Color;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      const c3Label = cashRemaining >= 0 ? 'CÒN LẠI' : livingRemaining >= 0 && savingsAmount > 0 ? 'DÒNG TIỀN VÍ' : 'THÂM HỤT';
      ctx.fillText(c3Label, 50 + (cardW + 12) * 2, 230);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(formatCurrency(cashRemaining, cashRemaining > 0), 50 + (cardW + 12) * 2, 258);
      ctx.fillStyle = card3Color;
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      const c3Sub = savingsAmount > 0 ? `Đã gửi TK: ${formatNumberForSheet(savingsAmount)}` : (cashRemaining >= 0 ? 'Thặng dư ví' : 'Bội chi');
      ctx.fillText(c3Sub, 50 + (cardW + 12) * 2, 280);

      // 5. Savings Banner (if any) + Top Living Categories Section
      let curY = 325;

      if (savingsAmount > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.beginPath();
        ctx.roundRect(36, curY, width - 72, 46, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.stroke();

        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText('🏦 Đã trích Tiết kiệm / Tích lũy:', 52, curY + 28);

        ctx.fillStyle = '#A7F3D0';
        ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
        const savText = `${formatCurrency(savingsAmount)} (${savingsPctOfIncome.toFixed(1)}% thu nhập)`;
        ctx.fillText(savText, width - 52 - ctx.measureText(savText).width, curY + 28);

        curY += 56;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🏆 Top Hạng Mục Chi Tiêu Sinh Hoạt', 36, curY + 16);
      curY += 28;

      topLivingCategories.forEach((cat, idx) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(36, curY, width - 72, 44, 10);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${idx + 1}. ${cat.category}`, 54, curY + 27);

        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        const amtText = `${formatCurrency(cat.amount)}  (${cat.pctOfLiving.toFixed(0)}% sinh hoạt)`;
        ctx.fillText(amtText, width - 54 - ctx.measureText(amtText).width, curY + 27);

        curY += 50;
      });

      // 6. MoM Comparison Card (Canvas)
      if (prevMonthStats && prevMonthStats.hasData) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.beginPath();
        ctx.roundRect(36, curY + 6, width - 72, 88, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.stroke();

        ctx.fillStyle = '#A5B4FC';
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(`📈 So Sánh Với Tháng Trước (${prevMonthLabel}):`, 52, curY + 28);

        // MoM badge on canvas
        const momBadgeText = isExpenseDecreased ? 'Tiết kiệm hơn' : isExpenseIncreased ? 'Chi nhiều hơn' : 'Chi tiêu ổn định';
        const momBadgeColor = isExpenseDecreased ? '#34D399' : isExpenseIncreased ? '#FB7185' : '#FBBF24';
        ctx.fillStyle = momBadgeColor;
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        const mbW = ctx.measureText(momBadgeText).width;
        ctx.fillText(momBadgeText, width - 52 - mbW, curY + 28);

        // Expense delta (5% rule)
        const expColor = isExpenseDecreased ? '#34D399' : isExpenseIncreased ? '#FB7185' : '#FBBF24';
        const expSign = prevMonthStats.expenseDelta <= 0 ? '' : '+';
        ctx.fillStyle = expColor;
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(
          `Tổng chi: ${expSign}${formatCurrency(prevMonthStats.expenseDelta)} (${prevMonthStats.expenseDeltaPct > 0 ? '+' : ''}${prevMonthStats.expenseDeltaPct.toFixed(1)}%)`,
          52,
          curY + 50
        );

        // Income delta (5% rule)
        const incColor = isIncomeIncreased ? '#34D399' : isIncomeDecreased ? '#FB7185' : '#FBBF24';
        const incSign = prevMonthStats.incomeDelta >= 0 ? '+' : '';
        ctx.fillStyle = incColor;
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        const incText = `Tổng thu: ${incSign}${formatCurrency(prevMonthStats.incomeDelta)} (${prevMonthStats.incomeDeltaPct > 0 ? '+' : ''}${prevMonthStats.incomeDeltaPct.toFixed(1)}%)`;
        ctx.fillText(incText, 320, curY + 50);

        if (prevMonthStats.topIncrease || prevMonthStats.topDecrease) {
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '11px "Segoe UI", Arial, sans-serif';
          const shiftDetail = [
            prevMonthStats.topIncrease ? `Tăng: ${prevMonthStats.topIncrease.category} (+${formatCurrency(prevMonthStats.topIncrease.delta)})` : '',
            prevMonthStats.topDecrease ? `Giảm: ${prevMonthStats.topDecrease.category} (${formatCurrency(prevMonthStats.topDecrease.delta)})` : '',
          ].filter(Boolean).join('  ·  ');
          ctx.fillText(shiftDetail, 52, curY + 74);
        }

        curY += 104;
      }

      // 7. Highlights Box (Biggest expense + Credit)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(36, curY + 6, width - 72, 85, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('🌟 Món chi sinh hoạt lớn nhất:', 54, curY + 28);

      if (biggestExpense) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(biggestExpenseLabel, 54, curY + 48);
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        const amtW = ctx.measureText(formatCurrency(biggestExpense.amount)).width;
        ctx.fillText(formatCurrency(biggestExpense.amount), width - 54 - amtW, curY + 48);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Không có chi tiêu', 54, curY + 48);
      }

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`💳 Quẹt thẻ tín dụng: ${formatCurrency(totalCredit)}  ·  Ví BE Corp: ${formatCurrency(totalBeCorp)}`, 54, curY + 72);

      // 8. Footer
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Được tạo tự động từ ứng dụng Heo & Mèo Finance · Đồng bộ Google Sheets', 36, height - 20);

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Bao_Cao_Tai_Chinh_Thang_${monthNum}_${yearNum}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export canvas:', err);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="monthly-report-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-5 py-4 sm:py-8 overflow-y-auto cursor-pointer"
          onClick={onClose}
        >
          {/* 3D BOOK CONTAINER WITH PERSPECTIVE */}
          <div
            style={{ perspective: 1600 }}
            className="w-full max-w-5xl my-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              key="monthly-report-book"
              role="dialog"
              aria-modal="true"
              aria-labelledby="monthly-report-modal-title"
              initial={{ opacity: 0, scale: 0.92, y: 24, rotateX: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24, rotateX: 6 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative bg-slate-950 text-white rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Top Navigation Bar: Close & Mobile Tab Switcher */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
                <div className="flex items-center gap-2">
                  <span id="monthly-report-modal-title" className="text-xs font-mono-tabular font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                    Sổ tài chính Tháng {monthNum}/{yearNum}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-400 font-serif italic">
                    — Heo &amp; Mèo Edition
                  </span>
                </div>

                {/* Mobile Tab Pill Switcher (hidden on md and up) */}
                <div className="flex md:hidden items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setMobileTab('cover')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileTab === 'cover'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bìa Sổ
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('insights')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      mobileTab === 'insights'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Đối Soát
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                  title="Đóng sổ (Escape)"
                  aria-label="Đóng báo cáo tháng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BOOK BODY: DUAL SPREAD (LEFT COVER + RIGHT INSIGHTS) */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 relative divide-y md:divide-y-0 md:divide-x divide-slate-800">
                {/* ════════ LEFT PAGE (5 cols): LUXE PASSBOOK COVER ════════ */}
                <motion.div
                  initial={{ rotateY: -15, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ transformOrigin: 'right center' }}
                  className={`md:col-span-5 p-6 sm:p-7 flex flex-col justify-between space-y-6 relative bg-gradient-to-br from-[#0c162d] via-[#101c38] to-[#0a1122] ${
                    mobileTab === 'insights' ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  {/* Subtle Gold Foil Corner Accents */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-400/40 pointer-events-none" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-400/40 pointer-events-none" />

                  {/* Top Emblem & Title */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center -space-x-2.5 p-1.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 shadow-inner">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shadow-xs">
                          <PigIcon className="w-6 h-6" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#FAF4EE] flex items-center justify-center shadow-xs">
                          <SiameseCatIcon className="w-6 h-6" />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 font-mono">
                          Financial Passbook
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          Heo &amp; Mèo Finance
                        </h3>
                        <p className="text-xs text-amber-100/70">
                          Sổ chi tiêu ba mẹ Chuối, Đậu, Vịt
                        </p>
                      </div>
                    </div>

                    {/* Official Health Assessment Seal */}
                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-amber-400/20 shadow-xs space-y-1.5 relative overflow-hidden">
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <span className="text-sm">{healthStars}</span>
                          <span>{healthTitle}</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${healthBadge}`}>
                          {healthBadgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                        {healthDesc}
                      </p>
                    </div>
                  </div>

                  {/* 3 Main Pillars of Financial Balance */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-amber-200/80 uppercase tracking-wider font-mono">
                      Cân đối thu chi tháng
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {/* Income Row */}
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-emerald-200">Tổng thu nhập:</span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm text-emerald-300">
                          {formatCurrency(totalIncome)}
                        </span>
                      </div>

                      {/* Living Expense Row */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-400" />
                          <span className="font-semibold text-slate-300">Chi sinh hoạt:</span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm text-white">
                          {formatCurrency(livingExpense)}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            ({livingPctOfIncome.toFixed(0)}%)
                          </span>
                        </span>
                      </div>

                      {/* Savings Row if exists */}
                      {savingsAmount > 0 && (
                        <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-400" />
                            <span className="font-semibold text-teal-200">Trích gửi Tiết kiệm:</span>
                          </div>
                          <span className="font-extrabold font-mono-tabular text-sm text-teal-300">
                            {formatCurrency(savingsAmount)}
                          </span>
                        </div>
                      )}

                      {/* Net Remaining Row */}
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          cashRemaining >= 0
                            ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                            : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cashRemaining >= 0 ? 'bg-sky-400' : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-semibold">
                            {cashRemaining >= 0 ? 'Dòng tiền mặt còn lại:' : 'Dòng tiền ví thâm hụt:'}
                          </span>
                        </div>
                        <span className="font-extrabold font-mono-tabular text-sm">
                          {formatCurrency(cashRemaining, cashRemaining > 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stamp & Verification */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-serif italic">Verified with Google Sheets</span>
                    <span className="font-mono text-amber-400/80 font-bold">HM-PASSBOOK #{monthNum}{yearNum}</span>
                  </div>
                </motion.div>

                {/* ════════ RIGHT PAGE (7 cols): FINANCIAL INSIGHTS & AUDIT ════════ */}
                <motion.div
                  initial={{ rotateY: 15, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ transformOrigin: 'left center' }}
                  className={`md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5 bg-slate-900/90 ${
                    mobileTab === 'cover' ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Section 1: MoM Comparison */}
                    {prevMonthStats && prevMonthStats.hasData && (
                      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-700/40 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                            <span>So với tháng trước ({prevMonthLabel}):</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold font-mono-tabular px-2.5 py-0.5 rounded-full border ${
                              isExpenseDecreased
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                : isExpenseIncreased
                                ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                                : 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            {isExpenseDecreased
                              ? '📉 Tiết kiệm hơn'
                              : isExpenseIncreased
                              ? '📈 Chi nhiều hơn'
                              : '⚖️ Chi tiêu ổn định'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-slate-400 text-[10px]">Tổng chi:</div>
                            <div
                              className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                                isExpenseDecreased
                                  ? 'text-emerald-300'
                                  : isExpenseIncreased
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
                              }`}
                            >
                              {prevMonthStats.expenseDelta <= 0 ? '' : '+'}
                              {formatCurrency(prevMonthStats.expenseDelta)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({prevMonthStats.expenseDeltaPct > 0 ? '+' : ''}
                                {prevMonthStats.expenseDeltaPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                            <div className="text-slate-400 text-[10px]">Tổng thu:</div>
                            <div
                              className={`font-bold font-mono-tabular text-xs mt-0.5 ${
                                isIncomeIncreased
                                  ? 'text-emerald-300'
                                  : isIncomeDecreased
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
                              }`}
                            >
                              {prevMonthStats.incomeDelta >= 0 ? '+' : ''}
                              {formatCurrency(prevMonthStats.incomeDelta)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({prevMonthStats.incomeDeltaPct > 0 ? '+' : ''}
                                {prevMonthStats.incomeDeltaPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {(prevMonthStats.topIncrease || prevMonthStats.topDecrease) && (
                          <div className="space-y-1 text-[11px] text-slate-300 pt-1 border-t border-indigo-900/40">
                            {prevMonthStats.topIncrease && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">• Tăng nhiều nhất:</span>
                                <span className="font-semibold text-rose-300">
                                  {prevMonthStats.topIncrease.category} (+{formatCurrency(prevMonthStats.topIncrease.delta)})
                                </span>
                              </div>
                            )}
                            {prevMonthStats.topDecrease && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">• Cắt giảm tốt nhất:</span>
                                <span className="font-semibold text-emerald-300">
                                  {prevMonthStats.topDecrease.category} ({formatCurrency(prevMonthStats.topDecrease.delta)})
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 2: Top Living Categories with visual progress bars */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>Top Hạng Mục Chi Tiêu Sinh Hoạt:</span>
                        </span>
                        {livingExpense > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono-tabular">
                            Tổng sinh hoạt: {formatCurrency(livingExpense)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {topLivingCategories.map((c, idx) => (
                          <div
                            key={c.category}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">
                                {idx + 1}. {c.category}
                              </span>
                              <span className="font-bold font-mono-tabular text-rose-300">
                                {formatCurrency(c.amount)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({c.pctOfLiving.toFixed(0)}%)
                                </span>
                              </span>
                            </div>
                            {/* Thin progress bar */}
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full"
                                style={{ width: `${Math.min(100, c.pctOfLiving)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Highlights (Biggest item & Card credit) */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
                      {biggestExpense && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Món chi lớn nhất:</span>
                          </span>
                          <span className="font-bold text-amber-300 text-right truncate max-w-[260px]" title={biggestExpenseLabel}>
                            {biggestExpenseLabel}{' '}
                            <span className="font-mono-tabular text-rose-300">
                              ({formatCurrency(biggestExpense.amount)})
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-400 pt-1.5 border-t border-white/5">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Quẹt thẻ tín dụng:</span>
                        </span>
                        <strong className="text-indigo-300 font-mono-tabular">
                          {formatCurrency(totalCredit)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ví BE Corp:</span>
                        </span>
                        <strong className="text-amber-300 font-mono-tabular">
                          {formatCurrency(totalBeCorp)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép tóm tắt!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-300" />
                          <span>Sao chép tóm tắt</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      disabled={isGeneratingImg}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 via-teal-600 to-indigo-600 hover:opacity-95 text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-amber-200" />
                      <span>{isGeneratingImg ? 'Đang tạo...' : 'Lưu ảnh thiệp (PNG)'}</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

---

# PHẦN 5: 5. PACKAGE MANIFEST & MASTER TEST RUNNER E2E

> Cấu hình thư viện/dependencies (package.json) và bộ chạy kiểm thử hợp nhất (master_runner.js) bảo đảm 218/218 test pass.

## Đường dẫn: `package.json` <a id="duong-dan-packagejson"></a>

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit",
    "test": "node tests/e2e/master_runner.js",
    "test:e2e:master": "node tests/e2e/master_runner.js"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "firebase": "^13.1.0",
    "lucide-react": "^0.546.0",
    "motion": "^14.9.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2"
  }
}
```

---

## Đường dẫn: `tests/e2e/master_runner.js` <a id="duong-dan-testse2emasterrunnerjs"></a>

```javascript
#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const testsDir = resolve(projectRoot, 'tests');
const distDir = resolve(testsDir, 'dist');
const require = createRequire(import.meta.url);

// Terminal color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Test Suite Catalog Definitions
const SUITE_GROUPS = [
  {
    groupId: 'CORE-E2E',
    groupName: 'Core E2E Suite (Tiers 1–4)',
    suites: [
      {
        id: 'Tier 1',
        name: 'Feature Coverage (>=5 per feature)',
        file: 'tier1_features.test.js',
        expectedCount: 45,
      },
      {
        id: 'Tier 2',
        name: 'Boundary & Corner Cases (>=5 per category)',
        file: 'tier2_boundaries.test.js',
        expectedCount: 30,
      },
      {
        id: 'Tier 3',
        name: 'Cross-Feature Combinations (Pairwise)',
        file: 'tier3_cross_feature.test.js',
        expectedCount: 15,
      },
      {
        id: 'Tier 4',
        name: 'Real-World Living Scenarios (Workloads)',
        file: 'tier4_real_world.test.js',
        expectedCount: 5,
      },
    ],
  },
  {
    groupId: 'M2-PERF',
    groupName: 'Milestone 2: Performance, Cache & Bundle Optimization',
    suites: [
      {
        id: 'M2-Perf',
        name: 'Performance, Caching & Memoization',
        file: 'milestone2_performance.test.js',
        expectedCount: 7,
      },
    ],
  },
  {
    groupId: 'M3-UIUX',
    groupName: 'Milestone 3: UI/UX Polish, Themes & Accessibility',
    suites: [
      {
        id: 'M3-UIUX',
        name: 'Theme Tokens, Contrast, Mobile Safe Areas & A11y',
        file: 'milestone3_ui_ux.test.js',
        expectedCount: 15,
      },
    ],
  },
  {
    groupId: 'CHALLENGER-ADV',
    groupName: 'Tier 5: Adversarial Hardening & Stress Verification',
    suites: [
      {
        id: 'CH-Visual',
        name: 'Challenger Theme & Visual Stress Suite',
        file: 'challenger_m3_theme_visual.js',
        expectedCount: 11,
      },
      {
        id: 'CH-Viewport',
        name: 'Challenger Viewport & Accessibility Stress Suite',
        file: 'challenger_m3_stress.js',
        expectedCount: 17,
      },
      {
        id: 'CH-M1-Acct',
        name: 'Challenger M1 Accounting & Runway Verification',
        file: 'challenger_m1_verification.js',
        expectedCount: 14,
      },
      {
        id: 'CH-Stress',
        name: 'Challenger Date Boundary Fuzzing & Row Realignment',
        file: 'challenger_stress.test.js',
        expectedCount: 19,
      },
      {
        id: 'CH-M4-Stress',
        name: 'Challenger M4 60-Month & Row Realignment Fuzzing',
        file: 'challenger_m4_master_stress.js',
        expectedCount: 12,
      },
      {
        id: 'CH-M4-Adv',
        name: 'Challenger M4 Boundary & Adversarial Suite',
        file: 'challenger_m4_adversarial.js',
        expectedCount: 27,
      },
    ],
  },
];

async function main() {
  const masterStartTime = Date.now();

  console.log(`\n${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   EXPENSE & INCOME TRACKER — MASTER E2E & ADVERSARIAL VALIDATION RUNNER (ALL TIERS)   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}\n`);

  // 1. Ensure dist directory and CommonJS package.json exist
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  const distPkgPath = resolve(distDir, 'package.json');
  if (!existsSync(distPkgPath)) {
    writeFileSync(distPkgPath, JSON.stringify({ type: 'commonjs' }, null, 2));
  }

  // 2. Compile all test files via TypeScript
  console.log(`${c.dim}Compiling full test suite with TypeScript (tsc -p tests/tsconfig.json)...${c.reset}`);
  const tscStart = Date.now();
  try {
    execSync('npx tsc -p tests/tsconfig.json', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    const tscDuration = Date.now() - tscStart;
    console.log(`${c.green}✓ TypeScript compilation successful (${tscDuration}ms).${c.reset}\n`);
  } catch (err) {
    console.error(`${c.red}✗ Compilation error:${c.reset}`, err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }

  // 3. Load test harness
  const harnessPath = resolve(distDir, 'tests/e2e/testHarness.js');
  const { registry } = require(harnessPath);

  // 4. Sequential execution by Suite Group
  let grandTotalTests = 0;
  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  const failureDetails = [];
  const groupResults = [];

  for (const group of SUITE_GROUPS) {
    console.log(`${c.bold}${c.magenta}▶ ${group.groupName}${c.reset}`);
    const groupStart = Date.now();
    let groupTests = 0;
    let groupPassed = 0;
    let groupFailed = 0;

    const suiteRows = [];

    for (const suiteDef of group.suites) {
      const suiteFilePath = resolve(distDir, 'tests/e2e', suiteDef.file);
      if (!existsSync(suiteFilePath)) {
        console.error(`${c.red}Error: Test file not found: ${suiteFilePath}${c.reset}`);
        process.exit(1);
      }

      // Clear registry before loading this specific file to isolate metrics
      registry.clear();
      require(suiteFilePath);

      const suiteStart = Date.now();
      const summaries = await registry.runSuites();
      const suiteDuration = Date.now() - suiteStart;

      let fileTests = 0;
      let filePassed = 0;
      let fileFailed = 0;

      for (const summary of summaries) {
        const isSuiteAllPass = summary.failed === 0;
        const suiteIcon = isSuiteAllPass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
        console.log(`  ${suiteIcon} ${c.bold}${summary.suiteName}${c.reset} ${c.dim}(${summary.total} tests, ${summary.durationMs}ms)${c.reset}`);

        for (const res of summary.results) {
          fileTests++;
          groupTests++;
          grandTotalTests++;

          if (res.passed) {
            filePassed++;
            groupPassed++;
            grandTotalPassed++;
            console.log(`      ${c.green}✓${c.reset} ${c.dim}${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
          } else {
            fileFailed++;
            groupFailed++;
            grandTotalFailed++;
            console.log(`      ${c.red}✗ ${res.testName}${c.reset} ${c.gray}(${res.durationMs}ms)${c.reset}`);
            failureDetails.push(res);
          }
        }
      }

      suiteRows.push({
        id: suiteDef.id,
        name: suiteDef.name,
        total: fileTests,
        passed: filePassed,
        failed: fileFailed,
        durationMs: suiteDuration,
        status: fileFailed === 0 ? 'PASS' : 'FAIL',
      });
    }

    const groupDuration = Date.now() - groupStart;
    groupResults.push({
      groupId: group.groupId,
      groupName: group.groupName,
      total: groupTests,
      passed: groupPassed,
      failed: groupFailed,
      durationMs: groupDuration,
      suites: suiteRows,
    });

    console.log('');
  }

  const masterDuration = Date.now() - masterStartTime;

  // 5. Print Failures if any
  if (failureDetails.length > 0) {
    console.log(`\n${c.bold}${c.red}========================================================================================${c.reset}`);
    console.log(`${c.bold}${c.red}   FAILURE DETAILS (${failureDetails.length})   ${c.reset}`);
    console.log(`${c.bold}${c.red}========================================================================================${c.reset}\n`);

    for (let i = 0; i < failureDetails.length; i++) {
      const f = failureDetails[i];
      console.log(`${c.red}[${i + 1}] ${f.suiteName} > ${f.testName}${c.reset}`);
      console.log(`${c.yellow}${f.error?.stack || f.error?.message || f.error}${c.reset}\n`);
    }
  }

  // 6. Print Executive Summary Table
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}   MASTER E2E & ADVERSARIAL VALIDATION SUMMARY TABLE   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================================${c.reset}`);
  console.log(`${c.bold}| Suite / Tier | Category / Scope                         | Total | Pass | Fail | Pass Rate | Time   | Status |${c.reset}`);
  console.log(`|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|`);

  for (const group of groupResults) {
    for (const s of group.suites) {
      const idPad = s.id.padEnd(12, ' ');
      const namePad = (s.name.length > 40 ? s.name.substring(0, 37) + '...' : s.name).padEnd(40, ' ');
      const totalPad = String(s.total).padStart(5, ' ');
      const passPad = String(s.passed).padStart(4, ' ');
      const failPad = String(s.failed).padStart(4, ' ');
      const rateStr = ((s.passed / (s.total || 1)) * 100).toFixed(1) + '%';
      const ratePad = rateStr.padStart(9, ' ');
      const timeStr = `${s.durationMs}ms`.padStart(6, ' ');
      const statusStr = s.failed === 0 ? `${c.green}PASS${c.reset}  ` : `${c.red}FAIL${c.reset}  `;

      console.log(`| ${idPad} | ${namePad} | ${totalPad} | ${passPad} | ${failPad} | ${ratePad} | ${timeStr} | ${statusStr} |`);
    }
    console.log(`|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|`);
  }

  const grandRate = ((grandTotalPassed / (grandTotalTests || 1)) * 100).toFixed(1) + '%';
  const totalStatus =
    grandTotalFailed === 0
      ? `${c.green}${c.bold}ALL PASSED (100%)${c.reset}`
      : `${c.red}${c.bold}FAILURES DETECTED${c.reset}`;

  console.log(`\n${c.bold}Total Test Suites:${c.reset} ${groupResults.reduce((acc, g) => acc + g.suites.length, 0)} files across ${groupResults.length} milestone tracks`);
  console.log(`${c.bold}Total Test Cases:${c.reset}  ${c.bold}${grandTotalTests}${c.reset}`);
  console.log(`${c.bold}Passed:${c.reset}            ${c.green}${c.bold}${grandTotalPassed}${c.reset}`);
  console.log(`${c.bold}Failed:${c.reset}            ${grandTotalFailed > 0 ? c.red : c.green}${grandTotalFailed}${c.reset}`);
  console.log(`${c.bold}Pass Rate:${c.reset}          ${c.bold}${grandRate}${c.reset}`);
  console.log(`${c.bold}Total Execution:${c.reset}   ${masterDuration} ms`);
  console.log(`${c.bold}Final Gate Result:${c.reset} ${totalStatus}\n`);

  if (grandTotalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${c.red}Master Runner fatal error:${c.reset}`, err);
  process.exit(1);
});
```

---

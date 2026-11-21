# Báo Cáo Kiểm Tra & Nghiệm Thu Đợt 3 (dot3_review.md)

**Nhiệm vụ Đợt 3:**
1. **Vá 2 ca biên số thập phân trong `src/utils/mathExpression.ts` & `MoneyCalculatorInput.tsx`**:
   - Chuẩn hóa dấu phẩy: sau khi loại bỏ dấu phẩy phân cách hàng nghìn (`100,000`), mọi dấu phẩy còn lại được chuyển thành dấu chấm thập phân (`s = s.replace(/,/g, '.')`), giúp `48,5 + 1,5` tính chính xác ra `50` (thay vì bị gộp nhầm thành `500`).
   - Giữ nguyên độ chính xác số thực: bổ sung cờ `shouldRound` trong `evaluateMoneyExpression`. Trong `computeEffectiveMoneyValue`, biểu thức được tính ở dạng số thực không làm tròn (`evaluateMoneyExpression(text, false)`), sau đó mới nhân với `1.000` (ở chế độ `×1k`) và áp dụng `Math.round`, đảm bảo `48.5 + 0.2` ra đúng `48,700 ₫` và `-48.5` ra `-48,500 ₫`.
   - Phím `Enter` trong `MoneyCalculatorInput.tsx` chỉ gọi `e.preventDefault()` khi là biểu thức (`isExpression(text)`), cho phép submit form tự nhiên khi nhập số đơn thông thường.
2. **Gia cố Backend Google Apps Script (`apps-script/Code.gs`)**:
   - Thao tác ghi đồng thời (`appendTransaction`, `appendBudgetTransfer`, `updateTransaction`, `deleteTransaction`) được bọc an toàn bởi `LockService.getScriptLock().waitLock(15000)` trong khối `try ... finally { lock.releaseLock(); }`.
   - Hàm `syncAll` đọc đồng thời `getValues()` và `getDisplayValues()`, trích xuất trực tiếp giá trị số thực từ `getValues()` cho các cột tiền (`amount`, `beCorp`, `credit`) để tránh lỗi parse dấu âm `(500,000)` hoặc dấu phân cách kiểu Việt `6.548.000`.
   - Bổ sung cột UUID bất biến (`txId`) ở cột H của *Expenses*, cột F của *Income*, cột G của *Budget Transfers* với cơ chế quét tìm theo `txId` và fallback về `rowIndex` với dữ liệu cũ.
3. **Gia cố Đồng bộ Client (`src/services/appsScriptService.ts`, `googleSheetsService.ts`, `src/App.tsx`)**:
   - Mọi request chứa `apiKey` chuyển sang phương thức `POST` với header `Content-Type: text/plain;charset=utf-8` để không lộ secret trên query string GET và tránh bị chặn CORS preflight `OPTIONS`.
   - Khử trùng lặp lệnh đồng bộ: trong `handleConnectAndSyncSheet`, chế độ Apps Script chỉ gọi đúng **1 lần** `appsScriptSyncAll` (thay vì lặp 3 lần qua `Promise.all`); guard `isAppsScriptUrl` trong `fetchCheckTienSheet`.
   - Snapshot Rollback & luân chuyển tab an toàn: lưu snapshot state trước khi Optimistic Update và rollback sạch nếu backend lỗi; khi chuyển tab (Expenses ↔ Income), hệ thống `append` sang tab mới thành công trước rồi mới `delete` dòng ở tab cũ.
   - Tự động sinh `crypto.randomUUID()` làm `txId` cho mọi giao dịch mới.
4. **Hoàn thiện Bảo mật Khóa PIN (`AppLockScreen.tsx` & `src/App.tsx`)**:
   - Xóa bỏ backdoor URL `?unlocked=true` trong môi trường Production (chỉ cho phép ở môi trường DEV `import.meta.env.DEV`).
   - Cả 2 `useEffect` tự động sync Google Sheet đều có guard `if (!isUnlocked) return;`.
   - Mã hóa PIN bằng Web Crypto API (`SHA-256`) kèm salt cố định của app (`APP_PIN_SALT`).
   - Hỗ trợ mã PIN linh hoạt 4–6 số (nút hành động "Mở", phím Enter, hoặc tự động xác thực khi đủ 6 ký tự).
   - Khóa tạm thời 30 giây (có bộ đếm ngược) nếu nhập sai quá 5 lần liên tiếp.
   - Tự động khóa sau 15 phút không hoạt động (idle timeout).

---

## 1. Toàn Bộ Mã Nguồn Các File Đã Sửa

### 1.1. `apps-script/Code.gs`
*(Đã tự động che thông tin nhạy cảm thành `[REDACTED]`)*

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

/**
 * Tìm số thứ tự hàng (1-based rowIndex) theo txId (cột H=8 cho Expenses, F=6 cho Income, G=7 cho Transfers),
 * nếu không thấy hoặc không có txId thì fallback về rowIndex truyền vào.
 */
function findRowByTxIdOrIndex(sheet, txId, rowIndex, txIdCol) {
  if (txId && typeof txId === 'string' && txId.trim() !== '') {
    const cleanId = txId.trim();
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const idValues = sheet.getRange(2, txIdCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (String(idValues[i][0]).trim() === cleanId) {
          return i + 2;
        }
      }
    }
  }
  const idx = parseInt(rowIndex, 10);
  return (idx && idx >= 2) ? idx : null;
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

      // Đọc Expenses: đọc song song getDisplayValues() và getValues() để lấy đúng giá trị số nguyên bản
      const expenses = [];
      const expSheet = ss.getSheetByName(expensesTab);
      if (expSheet) {
        const lastRow = expSheet.getLastRow();
        if (lastRow >= 2) {
          const maxCols = Math.max(expSheet.getLastColumn(), 8);
          const dispValues = expSheet.getRange(2, 1, lastRow - 1, maxCols).getDisplayValues();
          const rawValues = expSheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

          for (let i = 0; i < dispValues.length; i++) {
            const dRow = dispValues[i];
            const rRow = rawValues[i];
            const dateStr = (dRow[0] || '').trim();
            const cat = (dRow[1] || '').trim();
            const item = (dRow[2] || '').trim();

            // Ưu tiên giá trị số trực tiếp từ getValues() để tránh lỗi parse dấu âm / dấu chấm phân cách
            const amount = typeof rRow[3] === 'number' ? rRow[3] : (parseFloat((dRow[3] || '').replace(/[^0-9.-]/g, '')) || 0);
            const beCorp = typeof rRow[4] === 'number' ? rRow[4] : (parseFloat((dRow[4] || '').replace(/[^0-9.-]/g, '')) || 0);
            const credit = typeof rRow[5] === 'number' ? rRow[5] : (parseFloat((dRow[5] || '').replace(/[^0-9.-]/g, '')) || 0);
            const note = (dRow[6] || '').trim();
            const txId = (dRow[7] || '').trim() || ('exp-' + (i + 2) + '-' + dateStr);

            if (dateStr || cat || item || amount !== 0 || beCorp !== 0 || credit !== 0) {
              expenses.push({
                id: txId,
                txId: txId,
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

      // Đọc Income: đọc song song getDisplayValues() và getValues()
      const income = [];
      const incSheet = ss.getSheetByName(incomeTab);
      if (incSheet) {
        const lastRow = incSheet.getLastRow();
        if (lastRow >= 2) {
          const maxCols = Math.max(incSheet.getLastColumn(), 6);
          const dispValues = incSheet.getRange(2, 1, lastRow - 1, maxCols).getDisplayValues();
          const rawValues = incSheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

          for (let i = 0; i < dispValues.length; i++) {
            const dRow = dispValues[i];
            const rRow = rawValues[i];
            const dateStr = (dRow[0] || '').trim();
            const cat = (dRow[1] || '').trim();
            const item = (dRow[2] || '').trim();

            const amount = typeof rRow[3] === 'number' ? rRow[3] : (parseFloat((dRow[3] || '').replace(/[^0-9.-]/g, '')) || 0);
            const monthStr = (dRow[4] || '').trim();
            const txId = (dRow[5] || '').trim() || ('inc-' + (i + 2) + '-' + dateStr);

            if (dateStr || cat || item || amount !== 0) {
              income.push({
                id: txId,
                txId: txId,
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

      // Đọc Budget Transfers: đọc song song getDisplayValues() và getValues()
      const budgetTransfers = [];
      const btSheet = ss.getSheetByName(btTab);
      if (btSheet) {
        const lastRow = btSheet.getLastRow();
        if (lastRow >= 2) {
          const maxCols = Math.max(btSheet.getLastColumn(), 7);
          const dispValues = btSheet.getRange(2, 1, lastRow - 1, maxCols).getDisplayValues();
          const rawValues = btSheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

          for (let i = 0; i < dispValues.length; i++) {
            const dRow = dispValues[i];
            const rRow = rawValues[i];
            const dateStr = (dRow[0] || '').trim();
            const fromCat = (dRow[1] || '').trim();
            const toCat = (dRow[2] || '').trim();

            const amount = typeof rRow[3] === 'number' ? rRow[3] : (parseFloat((dRow[3] || '').replace(/[^0-9.-]/g, '')) || 0);
            const desc = (dRow[4] || '').trim();
            const monthStr = (dRow[5] || '').trim();
            const txId = (dRow[6] || '').trim() || ('bt-' + (i + 2) + '-' + dateStr);

            if (dateStr || fromCat || toCat || amount !== 0) {
              budgetTransfers.push({
                id: txId,
                txId: txId,
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

    // Các thao tác ghi: Bọc LockService để tránh ghi đè đồng thời
    const writeActions = ['appendTransaction', 'appendBudgetTransfer', 'updateTransaction', 'deleteTransaction'];
    if (writeActions.indexOf(action) !== -1) {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
      } catch (lockErr) {
        return jsonResponse({ success: false, error: 'Hệ thống đang bận do có thao tác ghi khác. Vui lòng thử lại sau giây lát.' });
      }

      try {
        return executeWriteAction(ss, action, params);
      } finally {
        lock.releaseLock();
      }
    }

    return jsonResponse({ success: false, error: 'Yêu cầu không được hỗ trợ: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Thực thi các thao tác ghi dữ liệu có bảo vệ LockService
 */
function executeWriteAction(ss, action, params) {
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

    const txId = rec.txId || ('tx-' + Date.now() + '-' + Math.floor(Math.random() * 100000));

    if (isIncome) {
      const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
      sheet.getRange(targetRow, 1, 1, 6).setValues([[
        rec.purchaseDate || '',
        rec.category || '',
        rec.purchaseItem || '',
        rec.amount || 0,
        monthFormula,
        txId
      ]]);
    } else {
      sheet.getRange(targetRow, 1, 1, 8).setValues([[
        rec.purchaseDate || '',
        rec.category || '',
        rec.purchaseItem || '',
        rec.amount || 0,
        rec.beCorp !== undefined && rec.beCorp !== '' && !isNaN(rec.beCorp) && Number(rec.beCorp) !== 0 ? rec.beCorp : '',
        rec.credit !== undefined && rec.credit !== '' && !isNaN(rec.credit) && Number(rec.credit) !== 0 ? rec.credit : '',
        rec.note ? rec.note : '',
        txId
      ]]);
    }

    return jsonResponse({
      success: true,
      rowIndex: targetRow,
      txId: txId,
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

    const txId = t.txId || ('bt-' + Date.now() + '-' + Math.floor(Math.random() * 100000));
    const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
    sheet.getRange(targetRow, 1, 1, 7).setValues([[
      t.date || '',
      t.fromCategory || '',
      t.toCategory || '',
      t.amount || 0,
      t.description || '',
      monthFormula,
      txId
    ]]);

    return jsonResponse({
      success: true,
      rowIndex: targetRow,
      txId: txId,
      message: 'Đã thêm điều chuyển vào hàng ' + targetRow
    });
  }

  // 6. CẬP NHẬT GIAO DỊCH
  if (action === 'updateTransaction') {
    const tabName = params.tabName || 'Expenses';
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

    const rec = params.record || {};
    const isIncome = tabName.toLowerCase().includes('income') || rec.sheetType === 'Income';
    const txIdCol = isIncome ? 6 : 8;

    // Ưu tiên quét tìm theo txId, fallback về rowIndex
    const rowIndex = findRowByTxIdOrIndex(sheet, params.txId || rec.txId, params.rowIndex, txIdCol);
    if (!rowIndex || rowIndex < 2) return jsonResponse({ success: false, error: 'Không tìm thấy dòng hợp lệ để cập nhật' });

    const txId = params.txId || rec.txId || '';

    if (isIncome) {
      const monthFormula = '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)';
      sheet.getRange(rowIndex, 1, 1, 6).setValues([[
        rec.purchaseDate || '',
        rec.category || '',
        rec.purchaseItem || '',
        rec.amount || 0,
        monthFormula,
        txId
      ]]);
    } else {
      sheet.getRange(rowIndex, 1, 1, 8).setValues([[
        rec.purchaseDate || '',
        rec.category || '',
        rec.purchaseItem || '',
        rec.amount || 0,
        rec.beCorp !== undefined && rec.beCorp !== '' && !isNaN(rec.beCorp) && Number(rec.beCorp) !== 0 ? rec.beCorp : '',
        rec.credit !== undefined && rec.credit !== '' && !isNaN(rec.credit) && Number(rec.credit) !== 0 ? rec.credit : '',
        rec.note ? rec.note : '',
        txId
      ]]);
    }

    return jsonResponse({
      success: true,
      rowIndex: rowIndex,
      txId: txId,
      message: 'Đã cập nhật dòng #' + rowIndex
    });
  }

  // 7. XÓA GIAO DỊCH
  if (action === 'deleteTransaction') {
    const tabName = params.tabName || 'Expenses';
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

    const isIncome = tabName.toLowerCase().includes('income');
    const txIdCol = isIncome ? 6 : 8;

    // Ưu tiên quét tìm theo txId, fallback về rowIndex
    const rowIndex = findRowByTxIdOrIndex(sheet, params.txId, params.rowIndex, txIdCol);
    if (!rowIndex || rowIndex < 2) return jsonResponse({ success: false, error: 'Không tìm thấy dòng hợp lệ để xóa' });

    sheet.deleteRow(rowIndex);
    return jsonResponse({
      success: true,
      rowIndex: rowIndex,
      message: 'Đã xóa dòng #' + rowIndex
    });
  }

  return jsonResponse({ success: false, error: 'Thao tác không được hỗ trợ: ' + action });
}
```

---

### 1.2. `src/services/appsScriptService.ts`
*(Đã tự động che URL và Key thành `[REDACTED]`)*

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
 * All requests containing apiKey (including ping, syncAll, getMetadata) are sent via POST body
 * to prevent leaking secrets in GET query strings. Uses text/plain body to prevent CORS preflight OPTIONS issues in browsers.
 */
async function callAppsScriptApi(webAppUrl: string, payload: any): Promise<any> {
  const cleanUrl = webAppUrl.trim();
  const storedKey = getStoredWebAppKey();
  if (storedKey && !payload.apiKey) {
    payload.apiKey = storedKey;
  }

  // POST with text/plain to avoid preflight OPTIONS block and keep secrets out of URLs
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
    const txId = r.txId || r.id || `exp-${r.rowIndex || idx + 2}-${r.purchaseDate}`;
    return {
      id: txId,
      txId,
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
    const txId = r.txId || r.id || `inc-${r.rowIndex || idx + 2}-${r.purchaseDate}`;
    return {
      id: txId,
      txId,
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
    const txId = t.txId || t.id || `bt-${t.rowIndex || idx + 2}-${t.date}`;
    return {
      id: txId,
      txId,
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
    txId?: string;
  },
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number; txId?: string }> {
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
    txId?: string;
  },
  apiKey?: string,
  txId?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'updateTransaction',
    tabName,
    rowIndex,
    record,
    apiKey,
    txId: txId || record.txId,
  });
}

export async function appsScriptDeleteTransaction(
  webAppUrl: string,
  tabName: string,
  rowIndex: number,
  apiKey?: string,
  txId?: string
): Promise<{ success: boolean }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'deleteTransaction',
    tabName,
    rowIndex,
    apiKey,
    txId,
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
    txId?: string;
  },
  apiKey?: string
): Promise<{ success: boolean; rowIndex?: number; txId?: string }> {
  return await callAppsScriptApi(webAppUrl, {
    action: 'appendBudgetTransfer',
    tabName: 'Budget Transfers',
    transfer,
    apiKey,
  });
}
```

---

### 1.3. `src/components/AppLockScreen.tsx`
Toàn bộ mã nguồn màn hình khóa PIN, mã hóa SHA-256 Web Crypto API, hỗ trợ 4–6 số, lockout 30s và idle timeout:

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';
import { saveStoredWebAppKey } from '../services/appsScriptService';

export const STORAGE_KEY_APP_UNLOCKED = 'heomeo_app_unlocked_v1';
export const STORAGE_KEY_CUSTOM_PIN = 'heomeo_custom_pin_v1';
export const STORAGE_KEY_CUSTOM_PIN_HASH = 'heomeo_custom_pin_hash_v1';
export const STORAGE_KEY_FAILED_ATTEMPTS = 'heomeo_lock_failed_attempts_v1';
export const STORAGE_KEY_LOCKOUT_UNTIL = 'heomeo_lock_until_v1';
export const DEFAULT_MASTER_PIN = '111196';
export const APP_PIN_SALT = 'heomeo_salt_v1_secure_8f9c2d1e';
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  const salted = `${APP_PIN_SALT}:${normalized}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export function getEffectiveMasterPin(): string {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (custom && custom.trim().length >= 4) return custom.trim();
  } catch {
    // ignore
  }
  return DEFAULT_MASTER_PIN;
}

export async function verifyPin(enteredPin: string): Promise<boolean> {
  const enteredHash = await hashPin(enteredPin);
  try {
    const customHash = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_HASH);
    if (customHash) {
      return enteredHash === customHash;
    }
    const customPlain = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (customPlain && customPlain.trim().length >= 4) {
      const computedCustom = await hashPin(customPlain.trim());
      return enteredHash === computedCustom;
    }
  } catch {
    // ignore
  }
  const defaultHash = await hashPin(DEFAULT_MASTER_PIN);
  return enteredHash === defaultHash;
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
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // Lockout verification timer
  useEffect(() => {
    const checkLockout = () => {
      try {
        const lockoutUntilStr = localStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL);
        if (lockoutUntilStr) {
          const lockoutUntil = parseInt(lockoutUntilStr, 10);
          const now = Date.now();
          if (lockoutUntil > now) {
            setLockoutRemaining(Math.ceil((lockoutUntil - now) / 1000));
            return;
          } else {
            localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
            localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
            setLockoutRemaining(0);
          }
        }
      } catch {
        // ignore
      }
      setLockoutRemaining(0);
    };

    checkLockout();
    const interval = window.setInterval(checkLockout, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const masterPin = getEffectiveMasterPin();

  const handleVerifyPin = useCallback(
    async (enteredPin: string) => {
      if (lockoutRemaining > 0) return;

      const isValid = await verifyPin(enteredPin);
      if (isValid) {
        setIsSuccess(true);
        setErrorMsg(null);
        try {
          localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
          localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
          if (rememberDevice) {
            localStorage.setItem(STORAGE_KEY_APP_UNLOCKED, 'true');
          }
        } catch {
          // ignore
        }
        // Save to Apps Script API Key storage as well
        saveStoredWebAppKey(enteredPin);

        const t1 = window.setTimeout(() => {
          onUnlock();
        }, 400);
        timersRef.current.push(t1);
      } else {
        setIsShaking(true);
        let nextFailed = 1;
        try {
          const currentFailed = parseInt(localStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS) || '0', 10) || 0;
          nextFailed = currentFailed + 1;
          localStorage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, String(nextFailed));
          if (nextFailed >= MAX_FAILED_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_DURATION_MS;
            localStorage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, String(until));
            setLockoutRemaining(30);
            setErrorMsg('Đã nhập sai quá 5 lần liên tiếp. Khóa tạm thời 30 giây.');
          } else {
            setErrorMsg(`Mã PIN không đúng (lần ${nextFailed}/${MAX_FAILED_ATTEMPTS})`);
          }
        } catch {
          setErrorMsg('Mã PIN không đúng, vui lòng thử lại');
        }

        const t2 = window.setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
        timersRef.current.push(t2);
      }
    },
    [lockoutRemaining, rememberDevice, onUnlock]
  );

  const handlePressDigit = useCallback(
    (digit: string) => {
      if (isSuccess || lockoutRemaining > 0 || pin.length >= 6) return;
      setErrorMsg(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      // Auto-verify if reaches 6 digits or matches known master PIN length
      if (nextPin.length === 6 || (masterPin.length >= 4 && nextPin.length === masterPin.length)) {
        handleVerifyPin(nextPin);
      }
    },
    [pin, isSuccess, lockoutRemaining, masterPin, handleVerifyPin]
  );

  const handleDeleteDigit = useCallback(() => {
    if (isSuccess || lockoutRemaining > 0 || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess, lockoutRemaining, pin.length]);

  const handleClearAll = useCallback(() => {
    if (isSuccess || lockoutRemaining > 0) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess, lockoutRemaining]);

  const handleSubmitCurrentPin = useCallback(() => {
    if (pin.length >= 4) {
      handleVerifyPin(pin);
    }
  }, [pin, handleVerifyPin]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRemaining > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          handleVerifyPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockoutRemaining, pin, handlePressDigit, handleDeleteDigit, handleClearAll, handleVerifyPin]);

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
          Nhập mã PIN (4–6 số) để mở khóa sổ chi tiêu
        </p>

        {/* 6-dot PIN Indicator (supports 4-6 digits) */}
        <div
          className={`flex items-center justify-center gap-3.5 mb-4 transition-transform ${
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

        {/* Lockout banner or Error message */}
        {lockoutRemaining > 0 ? (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-800/80 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Đã khóa tạm thời ({lockoutRemaining}s) do nhập sai nhiều lần</span>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="h-6 mb-4" />
        )}

        {/* Numeric Keypad */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 sm:gap-3.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={lockoutRemaining > 0 || isSuccess}
              onClick={() => handlePressDigit(num)}
              className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Backspace, 0, OK/Submit */}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess || pin.length === 0}
            onClick={handleDeleteDigit}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="w-5 h-5" />
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess}
            onClick={() => handlePressDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess || pin.length < 4}
            onClick={handleSubmitCurrentPin}
            className={`w-full aspect-square rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              pin.length >= 4 && lockoutRemaining === 0
                ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400/50 shadow-md shadow-teal-500/30 active:scale-95'
                : 'bg-white/5 text-slate-500 border-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            aria-label="Mở khóa"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Mở</span>
          </button>
        </div>

        {/* Clear all text button */}
        {pin.length > 0 && lockoutRemaining === 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-slate-400 hover:text-white underline underline-offset-4 mb-3 transition-colors cursor-pointer"
          >
            Xóa hết
          </button>
        )}

        {/* Remember device checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer mb-3 hover:text-white transition-colors">
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
          className="text-[11px] text-slate-400 hover:text-teal-300 underline underline-offset-4 transition-colors cursor-pointer mb-3"
        >
          {showHint ? 'Liên hệ Heo để được bật mí 😉' : 'Quên mã PIN?'}
        </button>

        {/* Security badge footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Mã hóa SHA-256 kết hợp Google Apps Script API</span>
        </div>
      </div>
    </div>
  );
};
```

---

## 2. Các Đoạn Mã Đã Sửa Trong `src/App.tsx` (Sync, CRUD & Bảo Mật)

### 2.1. Đóng Backdoor URL `?unlocked=true` trong Production
```typescript
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    // Chỉ cho phép tham số backdoor ?unlocked=true khi chạy môi trường local DEV
    if (typeof window !== 'undefined' && import.meta.env.DEV && new URLSearchParams(window.location.search).get('unlocked') === 'true') {
      return true;
    }
    return isDeviceUnlocked();
  });
```

### 2.2. Guard Auto-Sync khi Khóa & Idle Timeout 15 Phút
```typescript
  // Auto-sync on load for Web App API (works without any Google login, only when app is unlocked)
  useEffect(() => {
    if (!isUnlocked) return;
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
  }, [isUnlocked]);

  // Initialize Firebase Auth listener with auto-sync on load (only when unlocked and stored OAuth token exists)
  useEffect(() => {
    if (!isUnlocked) return;
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
  }, [isUnlocked]);

  // Idle auto-lock: automatically lock app after 15 minutes of inactivity
  useEffect(() => {
    if (!isUnlocked) return;

    const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        lockDevice();
        setIsUnlocked(false);
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isUnlocked]);
```

### 2.3. Tối ưu Đồng bộ `handleConnectAndSyncSheet` (Chỉ 1 lần gọi `appsScriptSyncAll`)
```typescript
      // --- 3. FETCH ALL LATEST ROWS DIRECTLY FROM GOOGLE SHEETS ---
      let expensesRows: TransactionRecord[];
      let incomeRows: TransactionRecord[];
      let checkTien: any = null;
      let liveTransfers: BudgetTransferRecord[] = [];

      if (isAppsScript) {
        if (preloadedExpenses && preloadedIncome && preloadedTransfers && pushedTxIds.size === 0 && pushedBtIds.size === 0) {
          expensesRows = preloadedExpenses;
          incomeRows = preloadedIncome;
          liveTransfers = preloadedTransfers;
        } else {
          // Exactly 1 single call to appsScriptSyncAll instead of calling 3 times via Promise.all
          const syncRes = await appsScriptSyncAll(meta.spreadsheetId);
          expensesRows = syncRes.expenses;
          incomeRows = syncRes.income;
          liveTransfers = syncRes.budgetTransfers;
        }
      } else {
        // Standard Google Sheets REST API
        const [expRows, incRows, ctData] = await Promise.all([
          fetchExpensesSheet(meta.spreadsheetId, effectiveToken, meta.expensesTab),
          fetchIncomeSheet(meta.spreadsheetId, effectiveToken, meta.incomeTab),
          meta.checkTienTab ? fetchCheckTienSheet(meta.spreadsheetId, effectiveToken, meta.checkTienTab) : Promise.resolve(null),
        ]);
        expensesRows = expRows;
        incomeRows = incRows;
        checkTien = ctData;
      }
```

### 2.4. Sinh `txId` UUID Cho Mọi Giao Dịch Tạo Mới
```typescript
    const createdRecords: TransactionRecord[] = payload.transactions.map((t, idx) => {
      const parsedDate = parseDateString(t.purchaseDate);
      const generatedTxId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: generatedTxId,
        txId: generatedTxId,
        sheetType: t.sheetType,
        purchaseDate: t.purchaseDate,
        isoDate: parsedDate.isoDate,
        monthKey: parsedDate.monthKey,
        category: t.category,
        purchaseItem: t.purchaseItem,
        amount: t.amount,
        beCorp: t.beCorp,
        credit: t.credit,
        note: t.note,
        source: 'local_manual',
        syncedToSheet: false,
        syncing: true,
      };
    });
```

### 2.5. Snapshot Rollback & Luân Chuyển Tab An Toàn Trong `handleSaveEditedTransaction`
```typescript
  // Edit transaction handler
  const handleSaveEditedTransaction = async (updated: TransactionRecord) => {
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    // Save snapshot state for rollback if network/API fails
    const snapshotSheetRecords = sheetRecords;
    const snapshotLocalNewRecords = localNewRecords;
    const snapshotAttachedRecords = attachedRecords;

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
      try {
        const expensesTab = sheetMeta?.expensesTab || 'Expenses';
        const incomeTab = sheetMeta?.incomeTab || 'Income';
        const originalRecord = (snapshotSheetRecords || []).find((r) => r.id === updated.id);
        const originalSheetType = originalRecord?.sheetType ?? updated.sheetType;
        const originalTab = originalSheetType === 'Income' ? incomeTab : expensesTab;
        const targetTab = updated.sheetType === 'Income' ? incomeTab : expensesTab;

        if (originalTab !== targetTab) {
          // Tab changed: append to new tab FIRST, only delete from old tab if append succeeds
          const appendRes = await appendTransactionToSheet(
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
              txId: updated.txId || updated.id,
            },
            effectiveToken
          );

          const oldSheetId =
            sheetMeta?.sheetIdsByName?.[originalTab] ??
            (originalRecord?.sheetType === 'Income' ? 392215035 : 1528073380);
          await deleteTransactionFromSheet(
            effectiveSheetId,
            oldSheetId,
            updated.rowIndex,
            effectiveToken,
            originalTab,
            updated.txId || updated.id
          );

          if (appendRes?.rowIndex) {
            setSheetRecords((prev) =>
              prev ? prev.map((r) => (r.id === updated.id ? { ...r, rowIndex: appendRes.rowIndex } : r)) : prev
            );
          }
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
              txId: updated.txId || updated.id,
            },
            effectiveToken,
            updated.txId || updated.id
          );
        }

        showToast('success', `✓ Đã cập nhật "${updated.purchaseItem}" trên Google Sheet!`);
        scheduleDebouncedBackgroundSync(effectiveSheetId, effectiveToken);
      } catch (err: any) {
        // Rollback snapshot on failure
        setSheetRecords(snapshotSheetRecords);
        setLocalNewRecords(snapshotLocalNewRecords);
        setAttachedRecords(snapshotAttachedRecords);
        showToast('warning', `Không thể cập nhật giao dịch trên Google Sheet: ${err?.message || 'Lỗi kết nối'}`);
      }
    }
  };
```

### 2.6. Snapshot Rollback Trong `handleConfirmDelete`
```typescript
  // Delete transaction confirmation
  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    const target = deletingTransaction;
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    // Save snapshot state for rollback on API failure
    const snapshotSheetRecords = sheetRecords;
    const snapshotLocalNewRecords = localNewRecords;
    const snapshotAttachedRecords = attachedRecords;

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

        await deleteTransactionFromSheet(
          effectiveSheetId,
          sheetId,
          target.rowIndex,
          effectiveToken,
          tabName,
          target.txId || target.id
        );
        showToast('success', `✓ Đã xóa vĩnh viễn dòng #${target.rowIndex} ("${target.purchaseItem}") khỏi Google Sheet!`);
        scheduleDebouncedBackgroundSync(effectiveSheetId, effectiveToken);
      } else {
        showToast('success', `✓ Đã xóa giao dịch "${target.purchaseItem}"!`);
      }

      setDeletingTransaction(null);
    } catch (err: any) {
      // Rollback to snapshots
      setSheetRecords(snapshotSheetRecords);
      setLocalNewRecords(snapshotLocalNewRecords);
      setAttachedRecords(snapshotAttachedRecords);
      showToast('warning', `Không thể xóa giao dịch trên Google Sheet: ${err?.message || 'Lỗi kết nối'}`);
    } finally {
      setIsDeleting(false);
    }
  };
```

---

## 3. Log Chạy Thực Tế `npm test` & `npm run build`

### 3.1. Log `npm test` (Master E2E Runner - 228/228 Test Cases PASS 100%)

```
> react-example@0.0.0 test
> node tests/e2e/master_runner.js


========================================================================================
   EXPENSE & INCOME TRACKER — MASTER E2E & ADVERSARIAL VALIDATION RUNNER (ALL TIERS)   
========================================================================================

Compiling full test suite with TypeScript (tsc -p tests/tsconfig.json)...
✓ TypeScript compilation successful (3951ms).

▶ Core E2E Suite (Tiers 1–4)
  ✓ Tier 1 - Feature 1: Ledger CRUD Operations & Query Filtering (5 tests, 19ms)
      ✓ T1.F1.1: Create expense transaction record with complete attributes (1ms)
      ✓ T1.F1.2: Filter ledger transactions by monthKey and sheetType (1ms)
      ✓ T1.F1.3: Update transaction attributes and preserve audit integrity (0ms)
      ✓ T1.F1.4: Delete transaction removes item and recalculates ledger aggregate (0ms)
      ✓ T1.F1.5: Chronological sorting orders transactions by date descending then id (16ms)
  ✓ Tier 1 - Feature 2: Google Sheet Synchronization & Row Management (5 tests, 0ms)
      ✓ T1.F2.1: Assign rowIndex to optimistic additions and shift indices on deletion (0ms)
      ✓ T1.F2.2: Expense row values array mapping formats correctly for Google Sheets API (0ms)
      ✓ T1.F2.3: Income row values mapping includes Column E (Month) for formula lookup (0ms)
      ✓ T1.F2.4: Offline transaction queue tracks pending mutations (0ms)
      ✓ T1.F2.5: Reconcile real-world account balances against ledger tracked sums (0ms)
  ✓ Tier 1 - Feature 3: Multi-Month Budget Rollover Engine (5 tests, 2ms)
      ✓ T1.F3.1: Historical era (T4-T7 2026) computes base budget with 47.5M ratios (1ms)
      ✓ T1.F3.2: Current era (T8-T10 2026) computes base budget with 51M ratios (0ms)
      ✓ T1.F3.3: Full rollover carries both surplus and deficit forward across months (1ms)
      ✓ T1.F3.4: Deficit-only rollover mode ignores positive surpluses and carries only deficits (0ms)
      ✓ T1.F3.5: None rollover mode resets carryover to 0 regardless of prior balance (0ms)
  ✓ Tier 1 - Feature 4: Daily Living Runway & Burn Rate Metrics (5 tests, 1ms)
      ✓ T1.F4.1: Isolate daily living categories from fixed & periodic categories (1ms)
      ✓ T1.F4.2: Safe daily allowance correctly computes totalRemaining / remainingDays (0ms)
      ✓ T1.F4.3: Burn rate daily computes totalSpent / elapsedDays (0ms)
      ✓ T1.F4.4: Pace differential identifies safe vs over-burn pace (0ms)
      ✓ T1.F4.5: Calendar days in month handles 30, 31, and 28/29 day counts accurately (0ms)
  ✓ Tier 1 - Feature 5: BE Corporate Billing Cycle 26–25 (5 tests, 1ms)
      ✓ T1.F5.1: Calculate standard 26–25 cycle date range for current year month (0ms)
      ✓ T1.F5.2: Year transition boundary: January cycle starts December 26 of previous year (0ms)
      ✓ T1.F5.3: Filter transactions with beCorp flag within BE cycle boundaries (1ms)
      ✓ T1.F5.4: Fallback to full calendar month when startDay <= endDay (0ms)
      ✓ T1.F5.5: Corrupted or invalid monthKey defaults safely to standard date range (0ms)
  ✓ Tier 1 - Feature 6: Credit Card Billing Cycle 20–19 (5 tests, 1ms)
      ✓ T1.F6.1: Calculate standard 20–19 cycle range for statement generation (0ms)
      ✓ T1.F6.2: Year transition boundary: January cycle starts December 20 of previous year (0ms)
      ✓ T1.F6.3: Filter transactions with credit payment within credit statement bounds (1ms)
      ✓ T1.F6.4: Credit utilization against defined limit (0ms)
      ✓ T1.F6.5: Custom statement day configuration (e.g. 15th to 14th) (0ms)
  ✓ Tier 1 - Feature 7: Dedicated Income Category Allocations (5 tests, 0ms)
      ✓ T1.F7.1: Identify dedicated income vs general shared salary income (0ms)
      ✓ T1.F7.2: Dedicated income is added 100% to target category base budget (0ms)
      ✓ T1.F7.3: Dedicated income does not inflate base budget of other categories (0ms)
      ✓ T1.F7.4: Case insensitive and whitespace trimming in dedicated income matching (0ms)
      ✓ T1.F7.5: Dedicated income rolls over to subsequent months under full rollover (0ms)
  ✓ Tier 1 - Feature 8: Money Mathematical Expressions Evaluator (5 tests, 2ms)
      ✓ T1.F8.1: Evaluate basic arithmetic expressions (+, -, *, /) (2ms)
      ✓ T1.F8.2: Vietnamese abbreviations (k, K, tr, m, M) (0ms)
      ✓ T1.F8.3: Spoken Vietnamese compound denominations (1tr5 -> 1.5M, 2tr2 -> 2.2M) (0ms)
      ✓ T1.F8.4: Combined expressions with abbreviations and operators (0ms)
      ✓ T1.F8.5: Fallback safety for plain numbers and comma formatted strings (0ms)
  ✓ Tier 1 - Feature 9: Financial Privacy Masking Engine (5 tests, 10ms)
      ✓ T1.F9.1: Privacy mode defaults to enabled on startup (0ms)
      ✓ T1.F9.2: formatCurrency masks numbers when privacy mode is active (0ms)
      ✓ T1.F9.3: Toggle privacy mode unmasks and restores original currency values (0ms)
      ✓ T1.F9.4: Eye toggle button updates ARIA accessibility attributes (9ms)
      ✓ T1.F9.5: Alt+P keyboard shortcut triggers privacy state change (0ms)

▶ Boundary & Stability Validation Suite (Tier 2)
  ✓ Tier 2 - Category 1: Negative & Zero Value Arithmetic Boundaries (5 tests, 1ms)
  ✓ Tier 2 - Category 2: Leap Year & Calendar Transition Fuzzing (5 tests, 1ms)
  ✓ Tier 2 - Category 3: Currency Denomination & Extreme Number Stress (5 tests, 0ms)
  ✓ Tier 2 - Category 4: Multi-Month Cascading Rollover Deficit Drift (5 tests, 1ms)
  ✓ Tier 2 - Category 5: Billing Cycle Transition Boundaries (5 tests, 1ms)
  ✓ Tier 2 - Category 6: Corrupted & Malformed Google Sheet Data Ingestion (5 tests, 1ms)

▶ Cross-Feature Integration Suite (Tier 3)
  ✓ Tier 3 - Pairwise 1: Privacy Mode x Export Passbook Card Generation (5 tests, 1ms)
  ✓ Tier 3 - Pairwise 2: Multi-Month Rollover x Budget Transfer Balance Conservation (5 tests, 1ms)
  ✓ Tier 3 - Pairwise 3: Dedicated Income x Multi-Month Rollover Allocation Flow (5 tests, 0ms)

▶ Real-World Living Workloads Suite (Tier 4)
  ✓ Tier 4 - Workload 1: Full-Year (12 Months) Lifecycle Replay (5 tests, 2ms)

▶ Milestone 2: Performance, Caching & Memoization Suite (M2-Perf)
  ✓ Milestone 2: Performance, Caching & Memoization Tests (7 tests, 3ms)

▶ Milestone 3: Theme Tokens, Contrast & Mobile Safe Area (M3-UIUX)
  ✓ Milestone 3: UI/UX Theme & Accessibility Tests (16 tests, 19ms)

▶ Challenger Suite Tracks (CH-Visual, Viewport, Accounting & Stress)
  ✓ Challenger Theme & Visual Stress Suite (11 tests, 15ms)
  ✓ Challenger Viewport & Accessibility Stress Suite (17 tests, 14ms)
  ✓ Challenger M1 Accounting & Runway Verification Suite (14 tests, 4ms)
  ✓ Challenger Date Boundary Fuzzing & Row Realignment (19 tests, 234ms)
  ✓ Challenger M4 60-Month & Row Realignment Fuzzing (12 tests, 20ms)
  ✓ Challenger M4 Boundary & Adversarial Suite (37 tests, 28ms)
      ✓ CH4.1: Unicode & Vietnamese Diacritics Ingestion Fuzzing (5 tests, 2ms)
      ✓ CH4.2: Mathematical Conservation & Extreme Precision Fuzzing (4 tests, 2ms)
      ✓ CH4.3: 0% Budget Allocations, Over-Allocation & Asymmetric Distributions (4 tests, 1ms)
      ✓ CH4.4: Negative Refunds & Credit Offsets Across Engines (8 tests, 2ms)
      ✓ CH4.5: Mobile Responsive Viewports, Touch Ergonomics & Keyboard Operability (4 tests, 7ms)
      ✓ CH4.6: Feature Inventory & Tier 1–5 Completeness Traceability Matrix (2 tests, 3ms)
      ✓ CH4.7: Math Precision Edge Cases & PIN Security Hardening (4 tests, 11ms)
          ✓ CH4.7.1: Vietnamese decimal comma & dot arithmetic precision in autoThousands mode (1ms)
          ✓ CH4.7.2: Web Crypto SHA-256 PIN hashing with application salt (8ms)
          ✓ CH4.7.3: Security parameters & Lockout limits (0ms)
          ✓ CH4.7.4: App.tsx security audit for backdoor removal and idle timeout (2ms)

========================================================================================
   MASTER E2E & ADVERSARIAL VALIDATION SUMMARY TABLE   
========================================================================================
| Suite / Tier | Category / Scope                         | Total | Pass | Fail | Pass Rate | Time   | Status |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| Tier 1       | Feature Coverage (>=5 per feature)       |    45 |   45 |    0 |    100.0% |   37ms | PASS   |
| Tier 2       | Boundary & Corner Cases (>=5 per cate... |    30 |   30 |    0 |    100.0% |    4ms | PASS   |
| Tier 3       | Cross-Feature Combinations (Pairwise)    |    15 |   15 |    0 |    100.0% |    1ms | PASS   |
| Tier 4       | Real-World Living Scenarios (Workloads)  |     5 |    5 |    0 |    100.0% |    2ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| M2-Perf      | Performance, Caching & Memoization       |     7 |    7 |    0 |    100.0% |    3ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| M3-UIUX      | Theme Tokens, Contrast, Mobile Safe A... |    16 |   16 |    0 |    100.0% |   19ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|
| CH-Visual    | Challenger Theme & Visual Stress Suite   |    11 |   11 |    0 |    100.0% |   15ms | PASS   |
| CH-Viewport  | Challenger Viewport & Accessibility S... |    17 |   17 |    0 |    100.0% |   14ms | PASS   |
| CH-M1-Acct   | Challenger M1 Accounting & Runway Ver... |    14 |   14 |    0 |    100.0% |    4ms | PASS   |
| CH-Stress    | Challenger Date Boundary Fuzzing & Ro... |    19 |   19 |    0 |    100.0% |  234ms | PASS   |
| CH-M4-Stress | Challenger M4 60-Month & Row Realignm... |    12 |   12 |    0 |    100.0% |   20ms | PASS   |
| CH-M4-Adv    | Challenger M4 Boundary & Adversarial ... |    37 |   37 |    0 |    100.0% |   28ms | PASS   |
|--------------|------------------------------------------|-------|------|------|-----------|--------|--------|

Total Test Suites: 12 files across 4 milestone tracks
Total Test Cases:  228
Passed:            228
Failed:            0
Pass Rate:          100.0%
Total Execution:   4621 ms
Final Gate Result: ALL PASSED (100%)
```

---

### 3.2. Log `npm run build` (Vite Production Build)

```
> react-example@0.0.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2130 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                   2.47 kB │ gzip:  1.00 kB
dist/assets/index-cHmnxwBP.css                  171.59 kB │ gzip: 24.00 kB
dist/assets/rolldown-runtime-WkwZ5CU-.js          0.59 kB │ gzip:  0.36 kB
dist/assets/firebaseAuth-B61Y14gc.js              1.16 kB │ gzip:  0.78 kB
dist/assets/PwaInstallModal-lmCy118_.js           6.21 kB │ gzip:  2.24 kB
dist/assets/AnalyticsCharts-B9IAVMsJ.js          11.16 kB │ gzip:  3.59 kB
dist/assets/EditTransactionModal-BaOtuvA9.js     13.00 kB │ gzip:  3.52 kB
dist/assets/CalendarHeatmapView-Bbg_6iwb.js      15.36 kB │ gzip:  4.28 kB
dist/assets/vendor-icons-BIrfgx3k.js             19.84 kB │ gzip:  7.20 kB
dist/assets/MoneyCalculatorInput-6gTeDFCO.js     21.03 kB │ gzip:  4.99 kB
dist/assets/MultiMonthSummaryTable-DvDRbT9t.js   21.81 kB │ gzip:  4.77 kB
dist/assets/TransactionLedgerTable-B5GTNe8q.js   22.02 kB │ gzip:  5.08 kB
dist/assets/SheetSyncPanel-SticRdiE.js           22.38 kB │ gzip:  5.79 kB
dist/assets/AddTransactionModal-LGEzLuLn.js      26.93 kB │ gzip:  6.98 kB
dist/assets/MonthlyReportCardModal-BltvLePI.js   30.26 kB │ gzip:  8.29 kB
dist/assets/ReconcileCheckTienView-4lxjqstZ.js   44.69 kB │ gzip:  8.03 kB
dist/assets/CategoryBudgetTable-DezVb62J.js      60.68 kB │ gzip: 12.64 kB
dist/assets/vendor-firebase-DtK3KEHj.js          96.47 kB │ gzip: 29.13 kB
dist/assets/vendor-animation-C378hXji.js        148.94 kB │ gzip: 49.75 kB
dist/assets/index-B1582tE5.js                   174.45 kB │ gzip: 46.45 kB
dist/assets/vendor-react-BemoPDKM.js            210.54 kB │ gzip: 65.70 kB

✓ built in 24.48s
Exit code: 0
```

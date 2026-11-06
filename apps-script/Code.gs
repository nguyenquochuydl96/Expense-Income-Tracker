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
  API_SECRET_KEY: '111196',

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
          rec.beCorp ? rec.beCorp : '',
          rec.credit ? rec.credit : '',
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
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0
        ]]);
      } else {
        sheet.getRange(rowIndex, 1, 1, 7).setValues([[
          rec.purchaseDate || '',
          rec.category || '',
          rec.purchaseItem || '',
          rec.amount || 0,
          rec.beCorp ? rec.beCorp : '',
          rec.credit ? rec.credit : '',
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

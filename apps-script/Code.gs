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
  API_SECRET_KEY: 'YOUR_SECRET_KEY_HERE',

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

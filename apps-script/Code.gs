/**
 * =========================================================================
 * HEOMEO FINANCE - WEB APP REST API (GOOGLE APPS SCRIPT)
 * =========================================================================
 * Hướng dẫn cài đặt Web App API:
 * 1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ mã nguồn này vào tệp Code.gs.
 * 3. Bấm Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment)
 *    (hoặc Quản lý triển khai -> Sửa -> Phiên bản mới khi cập nhật)
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

const WRITE_ACTIONS = [
  'appendTransaction',
  'appendBudgetTransfer',
  'updateTransaction',
  'deleteTransaction',
  'moveTransaction',
  'updateCheckTienWallets'
];

// ==================== ROUTER: WEB APP API ====================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No content received' });
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.action) {
      return handleApiRequest(payload, 'POST');
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
      if (WRITE_ACTIONS.indexOf(action) !== -1) {
        return jsonResponse({
          success: false,
          code: 'METHOD_NOT_ALLOWED',
          error: 'Các thao tác ghi/sửa/xóa chỉ được phép thực hiện qua HTTP POST.'
        });
      }
      return handleApiRequest(e.parameter, 'GET');
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

// ==================== HELPERS AN TOÀN DỮ LIỆU ====================

/**
 * Chuẩn hóa parse số từ Google Sheet (ưu tiên số nguyên bản từ getValues(),
 * fallback text hỗ trợ số âm trong ngoặc "(50,000)" và dấu "." phân cách nghìn "1.500.000").
 */
function parseSheetNumberServer(rawVal, dispVal) {
  if (typeof rawVal === 'number' && !isNaN(rawVal) && isFinite(rawVal)) {
    return rawVal;
  }

  let str = '';
  if (dispVal !== undefined && dispVal !== null && String(dispVal).trim() !== '') {
    str = String(dispVal).trim();
  } else if (rawVal !== undefined && rawVal !== null) {
    str = String(rawVal).trim();
  }
  if (!str) return 0;

  let isNegative = false;
  // Số âm kế toán trong ngoặc: (50,000), (1.200.000 ₫)
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }
  if (str.charAt(0) === '-') {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.charAt(0) === '+') {
    str = str.slice(1).trim();
  }

  // Loại bỏ ký hiệu tiền tệ và khoảng trắng
  str = str.replace(/[₫đ$€£¥\s]|vnd/gi, '');
  if (!str) return 0;

  const hasDot = str.indexOf('.') !== -1;
  const hasComma = str.indexOf(',') !== -1;

  if (hasDot && hasComma) {
    // Ký tự xuất hiện sau cùng là dấu thập phân
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Dạng 1.500.000,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Dạng 1,500,000.50
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    // Dạng dấu chấm phân cách nghìn VN: 50.000 hoặc 1.500.000
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  } else if (hasComma) {
    // Dạng dấu phẩy phân cách nghìn US: 50,000 hoặc 1,500,000
    if (/^\d{1,3}(,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(/,/g, '.');
    }
  }

  str = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(str);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/**
 * Tìm dòng trống kế tiếp theo cột A, giới hạn bởi getLastRow() (tránh đọc 50.000 dòng trống).
 */
function getNextAppendRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return 2;

  const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  let targetRow = 2;
  for (let i = colAValues.length - 1; i >= 0; i--) {
    const val = colAValues[i][0];
    if (val !== '' && val !== null && val !== undefined) {
      targetRow = i + 2;
      break;
    }
  }
  return targetRow < 2 ? 2 : targetRow;
}

/**
 * Phân biệt txId thật (UUID hoặc mã tx-.../bt-... do app cấp) với ID tổng hợp legacy (exp-2-..., inc-5-..., sheet-...).
 */
function isRealTxId(txId) {
  if (!txId || typeof txId !== 'string') return false;
  const clean = txId.trim();
  if (!clean) return false;
  if (/^(?:exp|inc|bt)-\d+-/i.test(clean)) return false;
  if (/^(?:sheet|csv)-/i.test(clean)) return false;
  return true;
}

/**
 * Quét cột txId giới hạn bởi getLastRow(). Trả về 1-based rowIndex nếu tìm thấy, ngược lại null.
 */
function findRowByTxId(sheet, txId, txIdCol) {
  if (!isRealTxId(txId)) return null;
  const cleanId = txId.trim();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const idValues = sheet.getRange(2, txIdCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < idValues.length; i++) {
    if (String(idValues[i][0]).trim() === cleanId) {
      return i + 2;
    }
  }
  return null;
}

/**
 * Tìm số thứ tự hàng (1-based rowIndex) an toàn:
 * - Nếu request gửi kèm txId thật (UUID/custom txId): BẮT BUỘC tìm đúng txId trong cột txIdCol.
 *   Nếu không tìm thấy -> trả về lỗi xung đột { found: false, conflict: true, code: 'NOT_FOUND' },
 *   TUYỆT ĐỐI KHÔNG fallback sang rowIndex để tránh ghi đè/xóa nhầm dòng khi có người khác sửa cùng lúc.
 * - Chỉ fallback sang rowIndex cho dữ liệu legacy chưa có txId, đồng thời đối chiếu chữ ký dòng
 *   (purchaseDate + amount + purchaseItem) nếu client truyền expectedSignature.
 */
function findRowByTxIdOrIndex(sheet, txId, rowIndex, txIdCol, expectedSignature) {
  if (isRealTxId(txId)) {
    const matchedRow = findRowByTxId(sheet, txId, txIdCol);
    if (matchedRow !== null) {
      return { found: true, rowIndex: matchedRow };
    }
    return {
      found: false,
      conflict: true,
      code: 'NOT_FOUND',
      error: 'Không tìm thấy giao dịch với mã txId trên Google Sheet (có thể đã bị xóa hoặc thay đổi ở thiết bị khác). Vui lòng đồng bộ lại.'
    };
  }

  const idx = parseInt(rowIndex, 10);
  const lastRow = sheet.getLastRow();
  if (!idx || idx < 2 || idx > lastRow) {
    return {
      found: false,
      conflict: true,
      code: 'NOT_FOUND',
      error: 'Vị trí dòng #' + rowIndex + ' không còn hợp lệ trên Google Sheet. Vui lòng đồng bộ lại.'
    };
  }

  // Nếu dòng tại rowIndex đã có txId thật khác trên Sheet -> dòng đã dịch chuyển
  const maxCheckCol = Math.max(txIdCol, 4);
  const dispRow = sheet.getRange(idx, 1, 1, maxCheckCol).getDisplayValues()[0];
  const rawRow = sheet.getRange(idx, 1, 1, maxCheckCol).getValues()[0];
  const existingTxId = String(dispRow[txIdCol - 1] || '').trim();
  if (isRealTxId(existingTxId)) {
    return {
      found: false,
      conflict: true,
      code: 'SIGNATURE_MISMATCH',
      error: 'Dòng #' + idx + ' hiện thuộc giao dịch khác (có mã txId riêng). Vui lòng đồng bộ lại.'
    };
  }

  // Đối chiếu chữ ký dòng (purchaseDate + amount + purchaseItem) cho dữ liệu legacy
  if (expectedSignature && typeof expectedSignature === 'object') {
    const sheetDate = String(dispRow[0] || '').trim();
    const sheetItem = String(dispRow[2] || '').trim();
    const sheetAmount = parseSheetNumberServer(rawRow[3], dispRow[3]);

    const expDate = String(expectedSignature.purchaseDate || '').trim();
    const expItem = String(expectedSignature.purchaseItem || '').trim();
    const hasExpAmount = expectedSignature.amount !== undefined && expectedSignature.amount !== null && !isNaN(Number(expectedSignature.amount));
    const expAmount = hasExpAmount ? Number(expectedSignature.amount) : null;

    const dateMismatch = expDate !== '' && sheetDate !== '' && expDate !== sheetDate;
    const amountMismatch = expAmount !== null && Math.abs(sheetAmount - expAmount) > 0.01;
    const itemMismatch =
      expItem !== '' &&
      expItem !== '(Không ghi nội dung)' &&
      sheetItem !== '' &&
      expItem.toLowerCase() !== sheetItem.toLowerCase();

    if (dateMismatch || amountMismatch || itemMismatch) {
      return {
        found: false,
        conflict: true,
        code: 'SIGNATURE_MISMATCH',
        error: 'Nội dung dòng #' + idx + ' trên Google Sheet không khớp chữ ký gốc (dữ liệu đã dịch chuyển). Vui lòng đồng bộ lại.'
      };
    }
  }

  return { found: true, rowIndex: idx };
}

/**
 * Đọc cấu trúc tab Check tiền (trả về null an toàn nếu tab không tồn tại).
 */
function readCheckTienData(ss, checkTienTab) {
  if (!checkTienTab) return null;
  const ctSheet = ss.getSheetByName(checkTienTab);
  if (!ctSheet) return null;

  const lastRow = Math.min(ctSheet.getLastRow(), 120);
  const lastCol = Math.min(Math.max(ctSheet.getLastColumn(), 8), 13);
  if (lastRow < 1) {
    return {
      sheetName: checkTienTab,
      formattedRows: [],
      formulaRows: [],
      detectedSummary: []
    };
  }

  const range = ctSheet.getRange(1, 1, lastRow, lastCol);
  const formattedRows = range.getDisplayValues();
  const formulaRows = range.getFormulas();
  const detectedSummary = [];

  for (let r = 0; r < formattedRows.length; r++) {
    const row = formattedRows[r] || [];
    const fRow = formulaRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim();
      const formula = String(fRow[c] || '').trim();
      if (formula.indexOf('=') === 0 && cell) {
        const leftLabel = c > 0 ? String(row[c - 1] || '').trim() : '';
        const topLabel = r > 0 && formattedRows[r - 1] ? String(formattedRows[r - 1][c] || '').trim() : '';
        const label = leftLabel || topLabel || ('Ô ' + String.fromCharCode(65 + c) + (r + 1));
        detectedSummary.push({ label: label, value: cell, formula: formula });
      }
    }
  }

  return {
    sheetName: checkTienTab,
    formattedRows: formattedRows,
    formulaRows: formulaRows,
    detectedSummary: detectedSummary
  };
}

/**
 * Ghi 1 dòng giao dịch vào tab Expenses hoặc Income (có kiểm tra chống ghi trùng theo txId).
 */
function writeTransactionRow(sheet, tabName, rec, preferredTxId) {
  const isIncome = tabName.toLowerCase().includes('income') || rec.sheetType === 'Income';
  const txIdCol = isIncome ? 6 : 8;
  const candidateTxId = preferredTxId || rec.txId || '';

  // Chống ghi trùng (Idempotency) theo txId trong vùng LockService
  if (isRealTxId(candidateTxId)) {
    const existingRow = findRowByTxId(sheet, candidateTxId, txIdCol);
    if (existingRow !== null) {
      return {
        rowIndex: existingRow,
        txId: candidateTxId.trim(),
        deduplicated: true
      };
    }
  }

  const targetRow = getNextAppendRow(sheet);
  const txId = isRealTxId(candidateTxId)
    ? candidateTxId.trim()
    : ('tx-' + Date.now() + '-' + Math.floor(Math.random() * 100000));

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

  return {
    rowIndex: targetRow,
    txId: txId,
    deduplicated: false
  };
}

// ==================== XỬ LÝ REST API CHO WEB & MOBILE APP ====================
function handleApiRequest(params, httpMethod) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = params.action;
    const method = httpMethod || 'POST';

    // Chặn toàn bộ hành động ghi/sửa/xóa nếu không đi qua POST
    if (WRITE_ACTIONS.indexOf(action) !== -1 && method !== 'POST') {
      return jsonResponse({
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        error: 'Các thao tác ghi/sửa/xóa chỉ được phép thực hiện qua HTTP POST.'
      });
    }

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

    // 3. ĐỒNG BỘ TOÀN BỘ DỮ LIỆU (EXPENSES, INCOME, TRANSFERS, CHECK TIỀN) TRONG 1 REQUEST
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

            const amount = parseSheetNumberServer(rRow[3], dRow[3]);
            const beCorp = parseSheetNumberServer(rRow[4], dRow[4]);
            const credit = parseSheetNumberServer(rRow[5], dRow[5]);
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

            const amount = parseSheetNumberServer(rRow[3], dRow[3]);
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

            const amount = parseSheetNumberServer(rRow[3], dRow[3]);
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

      // Đọc Check tiền (trả về null an toàn nếu tab không tồn tại)
      const checkTien = readCheckTienData(ss, checkTienTab);

      return jsonResponse({
        success: true,
        metadata: metadata,
        expenses: expenses,
        income: income,
        budgetTransfers: budgetTransfers,
        checkTien: checkTien,
        totalExpenses: expenses.length,
        totalIncome: income.length,
        totalTransfers: budgetTransfers.length
      });
    }

    // Các thao tác ghi: Bọc LockService + SpreadsheetApp.flush() để tránh ghi đè đồng thời
    if (WRITE_ACTIONS.indexOf(action) !== -1) {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
      } catch (lockErr) {
        return jsonResponse({ success: false, error: 'Hệ thống đang bận do có thao tác ghi khác. Vui lòng thử lại sau giây lát.' });
      }

      try {
        const response = executeWriteAction(ss, action, params);
        SpreadsheetApp.flush();
        return response;
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
  // 4. THÊM GIAO DỊCH MỚI (EXPENSES HOẶC INCOME) - CÓ CHỐNG GHI TRÙNG (IDEMPOTENCY)
  if (action === 'appendTransaction') {
    const tabName = params.tabName || 'Expenses';
    const sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    const rec = params.record || {};

    const writeRes = writeTransactionRow(sheet, tabName, rec, params.txId || rec.txId);

    return jsonResponse({
      success: true,
      rowIndex: writeRes.rowIndex,
      txId: writeRes.txId,
      tabName: tabName,
      deduplicated: writeRes.deduplicated,
      message: writeRes.deduplicated
        ? ('Giao dịch đã tồn tại ở hàng ' + writeRes.rowIndex + ' (chống ghi trùng)')
        : ('Đã thêm dòng mới vào hàng ' + writeRes.rowIndex)
    });
  }

  // 5. THÊM ĐIỀU CHUYỂN NGÂN SÁCH (BUDGET TRANSFERS) - CÓ CHỐNG GHI TRÙNG (IDEMPOTENCY)
  if (action === 'appendBudgetTransfer') {
    const tabName = params.tabName || 'Budget Transfers';
    const sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    const t = params.transfer || {};
    const candidateTxId = params.txId || t.txId || '';

    if (isRealTxId(candidateTxId)) {
      const existingRow = findRowByTxId(sheet, candidateTxId, 7);
      if (existingRow !== null) {
        return jsonResponse({
          success: true,
          rowIndex: existingRow,
          txId: candidateTxId.trim(),
          deduplicated: true,
          message: 'Điều chuyển đã tồn tại ở hàng ' + existingRow + ' (chống ghi trùng)'
        });
      }
    }

    const targetRow = getNextAppendRow(sheet);
    const txId = isRealTxId(candidateTxId)
      ? candidateTxId.trim()
      : ('bt-' + Date.now() + '-' + Math.floor(Math.random() * 100000));
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
      deduplicated: false,
      message: 'Đã thêm điều chuyển vào hàng ' + targetRow
    });
  }

  // 6. CẬP NHẬT GIAO DỊCH (CHẶN GHI ĐÈ NHẦM DÒNG)
  if (action === 'updateTransaction') {
    const tabName = params.tabName || 'Expenses';
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

    const rec = params.record || {};
    const isIncome = tabName.toLowerCase().includes('income') || rec.sheetType === 'Income';
    const txIdCol = isIncome ? 6 : 8;

    const lookup = findRowByTxIdOrIndex(
      sheet,
      params.txId || rec.txId,
      params.rowIndex,
      txIdCol,
      params.expectedSignature
    );
    if (!lookup.found) {
      return jsonResponse({
        success: false,
        conflict: Boolean(lookup.conflict),
        code: lookup.code || 'NOT_FOUND',
        error: lookup.error || 'Không tìm thấy dòng hợp lệ để cập nhật'
      });
    }

    const rowIndex = lookup.rowIndex;
    const rawTxId = params.txId || rec.txId || '';
    const txId = isRealTxId(rawTxId) ? rawTxId.trim() : '';

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

  // 7. XÓA GIAO DỊCH (CHẶN XÓA NHẦM DÒNG)
  if (action === 'deleteTransaction') {
    const tabName = params.tabName || 'Expenses';
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return jsonResponse({ success: false, error: 'Không tìm thấy tab: ' + tabName });

    const isIncome = tabName.toLowerCase().includes('income');
    const txIdCol = isIncome ? 6 : 8;

    const lookup = findRowByTxIdOrIndex(
      sheet,
      params.txId,
      params.rowIndex,
      txIdCol,
      params.expectedSignature
    );
    if (!lookup.found) {
      return jsonResponse({
        success: false,
        conflict: Boolean(lookup.conflict),
        code: lookup.code || 'NOT_FOUND',
        error: lookup.error || 'Không tìm thấy dòng hợp lệ để xóa'
      });
    }

    sheet.deleteRow(lookup.rowIndex);
    return jsonResponse({
      success: true,
      rowIndex: lookup.rowIndex,
      message: 'Đã xóa dòng #' + lookup.rowIndex
    });
  }

  // 8. CHUYỂN TAB NGUYÊN TỬ (EXPENSES <-> INCOME) TRONG CÙNG LOCKSERVICE
  if (action === 'moveTransaction') {
    const fromTab = params.fromTab || 'Expenses';
    const toTab = params.toTab || 'Income';
    const rec = params.record || {};

    const fromSheet = ss.getSheetByName(fromTab);
    if (!fromSheet) {
      return jsonResponse({ success: false, error: 'Không tìm thấy tab nguồn: ' + fromTab });
    }

    const fromIsIncome = fromTab.toLowerCase().includes('income');
    const fromTxIdCol = fromIsIncome ? 6 : 8;
    const lookup = findRowByTxIdOrIndex(
      fromSheet,
      params.txId || rec.txId,
      params.rowIndex,
      fromTxIdCol,
      params.expectedSignature
    );

    if (!lookup.found) {
      return jsonResponse({
        success: false,
        conflict: Boolean(lookup.conflict),
        code: lookup.code || 'NOT_FOUND',
        error: lookup.error || 'Không tìm thấy dòng nguồn hợp lệ để chuyển tab'
      });
    }

    const toSheet = ss.getSheetByName(toTab) || ss.insertSheet(toTab);
    const writeRes = writeTransactionRow(toSheet, toTab, rec, params.txId || rec.txId);
    fromSheet.deleteRow(lookup.rowIndex);

    return jsonResponse({
      success: true,
      rowIndex: writeRes.rowIndex,
      deletedRowIndex: lookup.rowIndex,
      txId: writeRes.txId,
      fromTab: fromTab,
      toTab: toTab,
      deduplicated: writeRes.deduplicated,
      message: 'Đã chuyển giao dịch từ "' + fromTab + '" (#' + lookup.rowIndex + ') sang "' + toTab + '" (#' + writeRes.rowIndex + ')'
    });
  }

  // 9. CẬP NHẬT SỐ DƯ VÍ TRONG TAB CHECK TIỀN (AN TOÀN KHI TAB CHƯA TỒN TẠI)
  if (action === 'updateCheckTienWallets') {
    const sheets = ss.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    const tabName = params.tabName || sheetNames.find(n => /check tiền|check tien|check/i.test(n)) || null;
    if (!tabName) {
      return jsonResponse({
        success: true,
        updated: false,
        message: 'Tab Check tiền chưa tồn tại trên Google Sheet'
      });
    }

    const ctSheet = ss.getSheetByName(tabName);
    if (!ctSheet) {
      return jsonResponse({
        success: true,
        updated: false,
        message: 'Không tìm thấy tab: ' + tabName
      });
    }

    const wallets = params.wallets || {};
    const lastRow = Math.min(ctSheet.getLastRow(), 120);
    if (lastRow < 1) {
      return jsonResponse({
        success: true,
        updated: false,
        message: 'Tab Check tiền chưa có dòng Heo/Mèo để cập nhật'
      });
    }

    const colBValues = ctSheet.getRange(1, 2, lastRow, 1).getDisplayValues();
    let heoRowIndex = null;
    let meoRowIndex = null;
    for (let i = 0; i < colBValues.length; i++) {
      const label = String(colBValues[i][0] || '').trim().toLowerCase();
      if (label === 'heo' && heoRowIndex === null) heoRowIndex = i + 1;
      if ((label === 'mèo' || label === 'meo') && meoRowIndex === null) meoRowIndex = i + 1;
    }

    let updatedCount = 0;
    if (heoRowIndex && wallets.heo) {
      const h = wallets.heo;
      ctSheet.getRange(heoRowIndex, 3, 1, 5).setValues([[
        Number(h.cash) || 0,
        Number(h.bank) || 0,
        Number(h.ewallet) || 0,
        0,
        Number(h.receivable) || 0
      ]]);
      updatedCount++;
    }
    if (meoRowIndex && wallets.meo) {
      const m = wallets.meo;
      ctSheet.getRange(meoRowIndex, 3, 1, 5).setValues([[
        Number(m.cash) || 0,
        Number(m.bank) || 0,
        Number(m.ewallet) || 0,
        0,
        Number(m.receivable) || 0
      ]]);
      updatedCount++;
    }

    return jsonResponse({
      success: true,
      updated: updatedCount > 0,
      tabName: tabName,
      updatedRows: { heo: heoRowIndex, meo: meoRowIndex },
      message: updatedCount > 0
        ? ('Đã đồng bộ số dư ví lên tab "' + tabName + '"')
        : 'Không tìm thấy dòng Heo/Mèo trong tab Check tiền'
    });
  }

  return jsonResponse({ success: false, error: 'Thao tác không được hỗ trợ: ' + action });
}

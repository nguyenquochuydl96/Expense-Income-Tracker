/**
 * =========================================================================
 * HEOMEO FINANCE - TELEGRAM QUICK-ADD BOT (GOOGLE APPS SCRIPT)
 * =========================================================================
 * Hướng dẫn:
 * 1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ mã nguồn này vào tệp Code.gs.
 * 3. Điền TELEGRAM_BOT_TOKEN (lấy từ @BotFather).
 * 4. (Tùy chọn) Điền GEMINI_API_KEY để bot hiểu tiếng Việt tự nhiên 100%.
 * 5. Bấm Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment)
 *    -> Loại: Ứng dụng web (Web app)
 *    -> Thực thi dưới dạng: Tôi (Me)
 *    -> Ai có quyền truy cập: Bất kỳ ai (Anyone)
 *    -> Bấm Triển khai -> Sao chép URL ứng dụng web (Web App URL).
 * 6. Chọn hàm `setWebhook` ở danh sách hàm bên trên -> Bấm Chạy (Run).
 * =========================================================================
 */

// ==================== CẤU HÌNH (CONFIGURATION) ====================
const CONFIG = {
  // 1. Token bot lấy từ @BotFather trên Telegram (Bắt buộc cho Telegram)
  TELEGRAM_BOT_TOKEN: 'YOUR_TELEGRAM_BOT_TOKEN_HERE',

  // 2. Web App URL sau khi deploy (Dùng cho cả Web App & Telegram Webhook)
  WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbwp6bORyNAXWePm2R7akA-VMLDdKPr421g0r-0Nb203wPJYM2f1lY5AriJQ4KBTTFcUyQ/exec',

  // 3. Mã bảo vệ gia đình (Tùy chọn - Dành cho Web/Mobile App)
  // Nếu điền (VD: 'heomeo2026'), chỉ người có mã này mới đọc/ghi dữ liệu vào Sheet được
  API_SECRET_KEY: '111196',

  // 4. Google Gemini API Key (Tùy chọn - Miễn phí tại aistudio.google.com)
  // Nếu có, bot Telegram sẽ hiểu mọi câu nói tự nhiên, văn nói, viết tắt tiếng Việt
  GEMINI_API_KEY: '',

  // 5. Giới hạn Chat ID Telegram được phép sử dụng (Bảo mật bot - Tránh người lạ)
  // Để trống [] nếu cho phép mọi người trong nhóm của bạn dùng
  ALLOWED_CHAT_IDS: [], 

  // 6. Cấu hình định mức
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

// ==================== ROUTER: WEB APP API & TELEGRAM WEBHOOK ====================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No content received' });
    }

    const payload = JSON.parse(e.postData.contents);

    // 1. Phân luồng: Nếu request đến từ Web App / Mobile App (có trường `action`)
    if (payload.action) {
      return handleApiRequest(payload);
    }

    // 2. Phân luồng: Nếu request đến từ Telegram Webhook (có `message` hoặc `update_id`)
    if (payload.message || payload.edited_message || payload.update_id) {
      return handleTelegramWebhook(payload);
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
      message: 'HeoMeo Finance Web App API & Telegram Bot is running smoothly!',
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

// ==================== XỬ LÝ TIN NHẮN TỪ BOT TELEGRAM ====================
function handleTelegramWebhook(update) {
  try {
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return jsonResponse({ success: true, message: 'No text message' });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const senderName = message.from ? (message.from.first_name || 'Bạn') : 'Bạn';

    // Kiểm tra quyền truy cập (nếu có cấu hình ALLOWED_CHAT_IDS)
    if (CONFIG.ALLOWED_CHAT_IDS.length > 0 && !CONFIG.ALLOWED_CHAT_IDS.includes(chatId)) {
      sendMessage(chatId, `⛔ Xin lỗi ${senderName}, bạn không có quyền sử dụng bot này. Chat ID của bạn là: \`${chatId}\``);
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    // Xử lý các lệnh hệ thống
    if (text.startsWith('/start') || text.startsWith('/help') || text.toLowerCase() === 'help') {
      sendHelpMessage(chatId);
      return jsonResponse({ success: true });
    }

    if (text.startsWith('/check') || text.toLowerCase() === 'check' || text.toLowerCase() === 'check tien') {
      sendCheckTienSummary(chatId);
      return jsonResponse({ success: true });
    }

    if (text.startsWith('/categories') || text.toLowerCase() === 'danh muc') {
      sendCategoriesList(chatId);
      return jsonResponse({ success: true });
    }

    if (text.startsWith('/undo') || text.toLowerCase() === 'undo' || text.toLowerCase() === 'huy') {
      handleUndoLastAction(chatId);
      return jsonResponse({ success: true });
    }

    // Xử lý tin nhắn ghi chép chi tiêu / thu nhập
    handleTransactionMessage(chatId, text, senderName);
  } catch (err) {
    Logger.log('Lỗi trong handleTelegramWebhook: ' + err.toString());
  }

  return jsonResponse({ success: true });
}

// ==================== XỬ LÝ GHI CHÉP GIAO DỊCH ====================
function handleTransactionMessage(chatId, text, senderName) {
  // Gửi thông báo đang xử lý nếu cần
  sendChatAction(chatId, 'typing');

  // Bước 1: Ưu tiên AI (Gemini) nếu có cấu hình API Key
  let record = null;
  if (CONFIG.GEMINI_API_KEY) {
    record = parseWithGemini(text, CONFIG.GEMINI_API_KEY);
  }

  // Bước 2: Nếu không có Gemini hoặc Gemini lỗi, dùng Regex Rules cực nhạy
  if (!record) {
    record = parseWithRules(text);
  }

  if (!record || record.error) {
    sendMessage(chatId, `⚠️ ${record && record.error ? record.error : 'Không nhận diện được giao dịch'}.\n\n💡 Ví dụ nhanh:\n• \`heo 50k an sang\`\n• \`meo 350k ao shopee credit\`\n• \`be 80k grab di lam\`\n• \`transfer 100k giai tri heo sang giai tri meo\`\nGõ \`/help\` để xem đầy đủ hướng dẫn.`);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const dateStr = formatDateMdy(today);

  // XỬ LÝ TRƯỜNG HỢP 1: CHUYỂN BUDGET HOẶC THU NHẬP RIÊNG (BUDGET TRANSFERS)
  if (record.type === 'Transfer') {
    let transferSheet = ss.getSheetByName('Budget Transfers');
    if (!transferSheet) {
      transferSheet = ss.insertSheet('Budget Transfers');
      transferSheet.appendRow(['Date', 'From Category', 'To Category', 'Amount', 'Description', 'Month']);
    }

    const fromCat = record.fromCategory || 'Khác';
    const toCat = record.toCategory || 'Khác';
    const amount = record.amount;
    const isTopUp = fromCat === 'Thu nhập riêng';
    const desc = record.description || (isTopUp ? `Nạp vào ${toCat} (Bot)` : `Chuyển từ ${fromCat} sang ${toCat} (Bot)`);

    // Ghi vào tab Budget Transfers: Date (A), From Category (B), To Category (C), Amount (D), Description (E), Month (F)
    const rowData = [
      dateStr,
      fromCat,
      toCat,
      amount,
      desc,
      '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)'
    ];
    transferSheet.appendRow(rowData);
    const lastRow = transferSheet.getLastRow();

    // Lưu vết để Undo
    saveLastAction({
      sheetName: 'Budget Transfers',
      type: 'Transfer',
      rows: [lastRow],
      description: `${isTopUp ? 'Nạp' : 'Chuyển'} ${formatVND(amount)} ${isTopUp ? 'vào' : 'từ ' + fromCat + ' sang'} ${toCat}`
    });

    const replyMsg = `🔄 *ĐÃ ${isTopUp ? 'BỔ SUNG QUỸ' : 'CHUYỂN NGÂN SÁCH'} THÀNH CÔNG!*
━━━━━━━━━━━━━━━━━━
💰 *Số tiền:* \`${formatVND(amount)}\`
${isTopUp ? `✨ *Nguồn:* \`Thu nhập riêng\`
📥 *Đích đến:* \`${toCat}\` (+${formatVND(amount)})` : `📤 *Từ danh mục:* \`${fromCat}\` (-${formatVND(amount)})
📥 *Sang danh mục:* \`${toCat}\` (+${formatVND(amount)})`}
📅 *Ngày ghi nhận:* ${dateStr}
📊 *Tab Google Sheet:* \`Budget Transfers\`
━━━━━━━━━━━━━━━━━━
💡 *Mẹo:* Nếu nhập nhầm, gõ \`/undo\` để hoàn tác tức thì.`;

    sendMessage(chatId, replyMsg);
    return;
  }

  // XỬ LÝ TRƯỜNG HỢP 2: THU NHẬP (INCOME)
  if (record.sheetType === 'Income') {
    const incomeSheet = ss.getSheetByName('Income');
    if (!incomeSheet) {
      sendMessage(chatId, '❌ Không tìm thấy tab `Income` trong Google Sheet.');
      return;
    }

    const rowData = [
      dateStr,
      record.category,
      record.item,
      record.amount,
      '=DATE(YEAR(INDIRECT("A"&ROW())), MONTH(INDIRECT("A"&ROW())), 1)'
    ];
    incomeSheet.appendRow(rowData);
    const lastRow = incomeSheet.getLastRow();

    saveLastAction({
      sheetName: 'Income',
      type: 'Income',
      rows: [lastRow],
      description: `${record.item} (${formatVND(record.amount)})`
    });

    const replyMsg = `💵 *ĐÃ GHI NHẬN THU NHẬP (INCOME)!*
━━━━━━━━━━━━━━━━━━
📅 *Ngày:* ${dateStr}
🏷️ *Nguồn thu:* \`${record.category}\`
📝 *Nội dung:* ${record.item}
💰 *Số tiền:* \`+${formatVND(record.amount)}\`
👤 *Người nhận:* ${record.note || senderName}
━━━━━━━━━━━━━━━━━━
💡 Gõ \`/undo\` nếu muốn hoàn tác giao dịch này.`;

    sendMessage(chatId, replyMsg);
    return;
  }

  // XỬ LÝ TRƯỜNG HỢP 3: CHI TIÊU (EXPENSES)
  const expenseSheet = ss.getSheetByName('Expenses');
  if (!expenseSheet) {
    sendMessage(chatId, '❌ Không tìm thấy tab `Expenses` trong Google Sheet.');
    return;
  }

  const beCorpVal = record.beCorp ? record.amount : '';
  const creditVal = record.credit ? record.amount : '';
  const noteVal = record.note || (record.beCorp ? 'BE Corp' : (record.credit ? 'Credit' : ''));

  const rowData = [
    dateStr,
    record.category,
    record.item,
    record.amount,
    beCorpVal,
    creditVal,
    noteVal
  ];
  expenseSheet.appendRow(rowData);
  const lastRow = expenseSheet.getLastRow();

  saveLastAction({
    sheetName: 'Expenses',
    type: 'Expenses',
    rows: [lastRow],
    description: `${record.item} (${formatVND(record.amount)})`
  });

  // Tạo thông báo chi tiết
  let tags = [];
  if (record.beCorp) tags.push('🏢 BE Corp (Reimburse)');
  if (record.credit) tags.push('💳 Thẻ tín dụng (Credit)');
  const tagStr = tags.length > 0 ? `\n🔖 *Hình thức:* ${tags.join(' | ')}` : '';

  const replyMsg = `✅ *ĐÃ GHI NHẬN CHI TIÊU (EXPENSES)!*
━━━━━━━━━━━━━━━━━━
📅 *Ngày:* ${dateStr}
🏷️ *Danh mục:* \`${record.category}\`
🛍️ *Món chi:* ${record.item}
💵 *Số tiền:* \`${formatVND(record.amount)}\`${tagStr}
👤 *Người chi:* ${record.note || senderName}
━━━━━━━━━━━━━━━━━━
💡 Gõ \`/undo\` nếu muốn xóa dòng này vừa nhập.`;

  sendMessage(chatId, replyMsg);
}

// ==================== BỘ PHÂN TÍCH QUY TẮC (REGEX ENGINE) ====================
function parseWithRules(text) {
  const trimmed = text.trim();
  const norm = removeAccents(trimmed);

  // 1. Chuyển Budget: e.g. "transfer 100k giai tri heo sang giai tri meo" hoặc "chuyen 200k an uong sang shopping"
  const transferMatch = norm.match(/(?:transfer|chuyen|chuyen khoan)\s+([^\s]+)\s+(?:tu\s+)?(.+?)\s+sang\s+(.+)/i);
  if (transferMatch) {
    const amtInfo = parseAmount(transferMatch[1]);
    if (amtInfo) {
      const fromCat = matchCategory(transferMatch[2].trim(), false);
      const toCat = matchCategory(transferMatch[3].trim(), false);
      return {
        type: 'Transfer',
        amount: amtInfo.amount,
        fromCategory: fromCat,
        toCategory: toCat
      };
    }
  }

  // 1b. Bổ sung quỹ / Thu nhập riêng: e.g. "nap 500k vao giai tri heo", "ban do 3.2tr vao giai tri heo", "thu rieng 1.5tr vao giai tri meo"
  const topUpMatch = norm.match(/(?:nap|ban do|thu rieng|hoan coc|thuong ngoai)\s+([^\s]+)\s+(?:vao|cho|sang)\s+(.+)/i);
  if (topUpMatch) {
    const amtInfo = parseAmount(topUpMatch[1]);
    if (amtInfo) {
      const toCat = matchCategory(topUpMatch[2].trim(), false);
      return {
        type: 'Transfer',
        amount: amtInfo.amount,
        fromCategory: 'Thu nhập riêng',
        toCategory: toCat,
        description: `Bổ sung quỹ: ${trimmed}`
      };
    }
  }

  // 2. Tìm số tiền
  const amtInfo = parseAmount(trimmed);
  if (!amtInfo) {
    return { error: 'Không tìm thấy số tiền hợp lệ (ví dụ: 50k, 1.5tr, 200.000...)' };
  }

  // 3. Nhận diện Thu nhập (Income)
  const isIncome = /^(?:thu|income|\+)\b/i.test(norm) ||
                   /\b(?:thuong|bonus|thuong du an)\b/i.test(norm) ||
                   (/\bluong\b/i.test(norm) && !/\b(?:an|uong|mua|chi|tra|vay)\b/i.test(norm));

  // 4. Nhận diện người chi (Heo / Mèo)
  let person = '';
  const isPetContext = /tiem phong|thu y|pate|hat cho|hat meo|cat meo|cat ve sinh/i.test(norm);
  if (!isPetContext) {
    if (/\bheo\b/i.test(norm)) person = 'Heo';
    else if (/\bmeo\b/i.test(norm) && !/tiem|kham|pate|cho meo/i.test(norm)) person = 'Mèo';
  }

  // 5. Cờ BE Corp
  let isBeCorp = false;
  if (/\b(?:be|becorp)\b/i.test(norm) && !/\bluong be\b/i.test(norm)) {
    isBeCorp = true;
  }

  // 6. Cờ Thẻ tín dụng Credit
  let isCredit = false;
  if (/\b(?:credit|cr|the tin dung|the td|the credit)\b/i.test(norm)) {
    isCredit = true;
  }

  // 7. Làm sạch tên món hàng / nội dung chi
  let cleanDesc = trimmed
    .replace(new RegExp(amtInfo.raw.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'), 'i'), '')
    .replace(/\b(?:credit|cr|the tin dung|the td|the credit)\b/gi, '')
    .replace(/\b(?:becorp)\b/gi, '')
    .replace(/^(?:thu|income|\+)\b/gi, '')
    .trim();

  if (person && !isPetContext) {
    cleanDesc = cleanDesc.replace(new RegExp(`\\b${person}\\b`, 'gi'), '').trim();
  }
  if (isBeCorp) {
    cleanDesc = cleanDesc.replace(/\bbe\b/gi, '').trim();
  }

  let item = cleanDesc.replace(/^[-:,.\s]+|[-:,.\s]+$/g, '').trim();
  if (!item) {
    item = isIncome ? 'Thu nhập' : 'Chi tiêu';
  }
  item = item.charAt(0).toUpperCase() + item.slice(1);

  // 8. Nhận diện danh mục
  const category = matchCategory(trimmed, isIncome);

  if (isIncome) {
    return {
      sheetType: 'Income',
      amount: amtInfo.amount,
      category: category,
      item: item,
      note: person || ''
    };
  }

  return {
    sheetType: 'Expenses',
    amount: amtInfo.amount,
    category: category,
    item: item,
    beCorp: isBeCorp ? amtInfo.amount : 0,
    credit: isCredit ? amtInfo.amount : 0,
    note: person || ''
  };
}

// Phân tích số tiền (50k, 1.5tr, 200.000, 50000)
function parseAmount(text) {
  let m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|m)\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'));
    return { amount: Math.round(val * 1000000), raw: m[0] };
  }

  m = text.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'));
    return { amount: Math.round(val * 1000), raw: m[0] };
  }

  m = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (m) {
    const clean = m[1].replace(/[.,]/g, '');
    return { amount: parseInt(clean, 10), raw: m[0] };
  }

  m = text.match(/\b(\d{4,9})\b/);
  if (m) {
    return { amount: parseInt(m[1], 10), raw: m[0] };
  }

  return null;
}

// Khớp danh mục thông minh
function matchCategory(text, isIncome) {
  const norm = removeAccents(text);

  if (isIncome) {
    // So khớp chính xác trước
    for (const cat of INCOME_CATEGORIES) {
      if (removeAccents(cat) === norm) return cat;
    }
    if (/yes4all/i.test(norm)) return 'Lương Yes4All';
    if (/luong be\b/i.test(norm)) return 'Lương BE';
    if (/cong doan/i.test(norm)) return 'Công đoàn Yes4All';
    if (/chung khoan|co phieu/i.test(norm)) return 'Chứng khoán';
    if (/ban hang|thanh ly|ban do|ban man|ban may|ban /i.test(norm)) return 'Bán hàng';
    if (/heo/i.test(norm)) return 'Lương Heo';
    if (/meo/i.test(norm)) return 'Lương Mèo';
    return 'Khác';
  }

  // So khớp chính xác tên danh mục chi tiêu trước
  for (const cat of EXPENSE_CATEGORIES) {
    if (removeAccents(cat) === norm) return cat;
  }

  // Thú cưng
  if (/tiem phong|thu y|pate|hat cho|hat meo|cat meo|cat ve sinh|chuong cho|chuong meo|tam cho|tam meo/i.test(norm) ||
      (/\b(?:cho|meo)\b/i.test(norm) && /kham|tiem|thuoc|chuong|do choi/i.test(norm))) {
    return 'Thú cưng';
  }

  // Giải trí Heo / Mèo
  if (/giai tri heo|netflix heo|game heo|steam|bida|playstation|ps5/i.test(norm)) return 'Giải trí Heo';
  if (/giai tri meo|nail|lam mong|spa meo|xem phim meo|sach meo/i.test(norm)) return 'Giải trí Mèo';

  // Shopping
  if (/shopee|lazada|tiktok shop|tiki|quan ao|vay|dam|ao thun|ao khoac|giay|dep|tui xach|mua sam|gia dung|noi chien/i.test(norm) ||
      norm.includes('shopping')) {
    return 'Shopping';
  }

  // Ăn uống
  if (/an sang|an trua|an toi|an vat|an dem|cafe|ca phe|tra sua|nuoc ep|com|pho|bun|mi quang|banh mi|banh|lau|bbq|do an|di cho|sieu thi|winmart|coopmart|thuc pham|thit|ca|rau|hai san/i.test(norm)) {
    return 'Ăn uống';
  }

  // Thuê nhà
  if (/tien nha|thue nha|dien nuoc|tien dien|tien nuoc|phi quan ly|internet|wifi/i.test(norm)) return 'Thuê nhà';

  // Hóa/Mỹ phẩm
  if (/hoa my pham|my pham|skincare|dau goi|sua tam|kem chong nang|son|giay ve sinh|nuoc giat|xa phong|kem danh rang/i.test(norm)) return 'Hóa/Mỹ phẩm';

  // Điện thoại / Xăng xe
  if (/xang|do xang|gui xe|grab|be bike|be car|taxi|cuoc dien thoai|viettel|vinaphone|mobifone|4g|nap the/i.test(norm)) return 'Điện thoại/Xăng xe';

  // Tiết kiệm
  if (/tiet kiem|gui tiet kiem|vang|tich luy/i.test(norm)) return 'Tiết kiệm';

  // Quà tặng / Cưới hỏi
  if (/qua|sinh nhat|dam cuoi|thiep cuoi|mung tuoi|li xi|thoi noi/i.test(norm)) return 'Quà tặng/Cưới hỏi';

  // Sức khỏe
  if (/suc khoe|thuoc|kham benh|nha khoa|rang|vien phi|vitamin|thuc pham chuc nang|khau trang/i.test(norm)) return 'Sức khỏe';

  // Du lịch
  if (/du lich|ve may bay|khach san|homestay|tour|resort|ve tau/i.test(norm)) return 'Du lịch';

  // Fallback
  if (/\b(?:an|uong|lau|nuong)\b/i.test(norm)) return 'Ăn uống';

  return 'Khác';
}

// Bỏ dấu tiếng Việt
function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim();
}

// ==================== BỘ PHÂN TÍCH AI (GEMINI 2.5 FLASH) ====================
function parseWithGemini(userText, apiKey) {
  try {
    const prompt = `Bạn là trợ lý tài chính cá nhân cho cặp đôi Heo và Mèo. Phân tích tin nhắn chi tiêu/thu nhập sau và trả về JSON thuần túy (không dùng backticks, không markdown):
Tin nhắn: "${userText}"

Quy tắc:
1. sheetType: "Expenses" hoặc "Income" hoặc "Transfer".
2. category: Phải là 1 trong các danh mục sau:
   - Chi tiêu: Ăn uống, Thuê nhà, Hóa/Mỹ phẩm, Thú cưng, Giải trí Heo, Giải trí Mèo, Điện thoại/Xăng xe, Tiết kiệm, Quà tặng/Cưới hỏi, Shopping, Sức khỏe, Du lịch, Khác.
   - Thu nhập: Lương Yes4All, Lương BE, Công đoàn Yes4All, Công đoàn BE, Chứng khoán, Bán hàng, Lương Heo, Lương Mèo, Khác.
3. item: Tên món chi/thu ngắn gọn, viết hoa chữ cái đầu (VD: "Ăn sáng phở bò", "Grab đi làm").
4. amount: Số tiền nguyên dương (VND). Nếu ghi 50k -> 50000, 1.5tr -> 1500000.
5. beCorp: Số tiền phụ cấp BE Corp (nếu có nhắc đến BE/Grab đi làm thì bằng amount, ngược lại là 0).
6. credit: Số tiền quẹt thẻ tín dụng (nếu có nhắc đến credit/thẻ tín dụng thì bằng amount, ngược lại là 0).
7. note: "Heo" hoặc "Mèo" (nếu câu nói thể hiện người chi) hoặc ghi chú thêm.
8. Nếu là "Transfer": type="Transfer", fromCategory, toCategory, amount.

Định dạng JSON trả về:
{"sheetType":"Expenses","category":"Ăn uống","item":"Ăn sáng phở","amount":50000,"beCorp":0,"credit":0,"note":"Heo"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const resJson = JSON.parse(response.getContentText());
    if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
      const rawText = resJson.candidates[0].content.parts[0].text;
      return JSON.parse(rawText);
    }
  } catch (e) {
    Logger.log('Lỗi gọi Gemini API: ' + e.toString());
  }
  return null;
}

// ==================== HÀM TIỆN ÍCH HOÀN TÁC (UNDO) ====================
function saveLastAction(action) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_ACTION', JSON.stringify(action));
}

function handleUndoLastAction(chatId) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('LAST_ACTION');
  if (!raw) {
    sendMessage(chatId, 'ℹ️ Không có giao dịch gần nhất nào để hoàn tác.');
    return;
  }

  const action = JSON.parse(raw);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(action.sheetName);

  if (!sheet) {
    sendMessage(chatId, `❌ Không tìm thấy tab \`${action.sheetName}\`.`);
    return;
  }

  // Xóa các dòng từ dưới lên để không lệch vị trí row
  const rows = action.rows.sort((a, b) => b - a);
  rows.forEach(r => {
    if (r > 1 && r <= sheet.getLastRow()) {
      sheet.deleteRow(r);
    }
  });

  props.deleteProperty('LAST_ACTION');

  sendMessage(chatId, `🗑️ *ĐÃ HOÀN TÁC THÀNH CÔNG!*
Đã xóa dòng vừa nhập:
*${action.description}* khỏi tab \`${action.sheetName}\`.`);
}

// ==================== TỔNG HỢP /CHECK TIỀN ====================
function sendCheckTienSummary(chatId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checkTienSheet = ss.getSheetByName('Check tiền');
  const expenseSheet = ss.getSheetByName('Expenses');

  let report = '📊 *TÌNH HÌNH TÀI CHÍNH HIỆN TẠI*\n━━━━━━━━━━━━━━━━━━\n';

  // 1. Đọc dữ liệu từ tab 'Check tiền' nếu có
  if (checkTienSheet) {
    try {
      const heoTotal = checkTienSheet.getRange('H2').getValue();
      const meoTotal = checkTienSheet.getRange('H3').getValue();
      const realTotal = checkTienSheet.getRange('H4').getValue();
      const gap = checkTienSheet.getRange('J4').getValue();
      const creditCycle = checkTienSheet.getRange('K2').getValue();
      const beRemain = checkTienSheet.getRange('L2').getValue();

      report += `💵 *Số dư thực tế (Tiền mặt & Ví):*
• Heo: \`${formatVND(heoTotal)}\`
• Mèo: \`${formatVND(meoTotal)}\`
➔ *Tổng cộng:* \`${formatVND(realTotal)}\`

🏢 *Phụ cấp BE Corp còn lại:* \`${formatVND(beRemain)}\`
💳 *Sao kê Credit chu kỳ này:* \`${formatVND(creditCycle)}\`
⚖️ *Lệch tiền (Gap):* \`${formatVND(gap)}\`\n━━━━━━━━━━━━━━━━━━\n`;
    } catch (e) {
      Logger.log('Lỗi đọc Check tiền: ' + e);
    }
  }

  report += `💡 Xem biểu đồ và chi tiết đầy đủ tại Web App của bạn!`;
  sendMessage(chatId, report);
}

function sendHelpMessage(chatId) {
  const helpText = `🤖 *CHÀO MỪNG ĐẾN VỚI HEO & MÈO FINANCE BOT!*
Bot giúp 2 bạn ghi nhanh chi tiêu/thu nhập thẳng vào Google Sheet chỉ trong 2 giây.

📝 *CÚ PHÁP NHẬP NHANH:*
━━━━━━━━━━━━━━━━━━
🔹 *Chi tiêu thông thường:*
• \`heo 50k an sang\`
• \`meo 350k mua vay shopee\`
• \`120k cafe voi ban\`
• \`do xang 70.000\`

🔹 *Chi tiêu qua BE Corp (Reimburse):*
• \`be 80k grab di lam\`
• \`heo 120k taxi be\`

🔹 *Quẹt thẻ tín dụng (Credit):*
• \`meo 500k uniqlo credit\`
• \`450k an lau haidilao cr\`

🔹 *Chuyển ngân sách (Transfer Budget):*
• \`transfer 100k giai tri heo sang giai tri meo\`
• \`chuyen 200k an uong sang shopping\`

🔹 *Ghi nhận Thu nhập (Income):*
• \`income luong heo 28tr\`
• \`thu 1.5tr ban man hinh cu\`
• \`thuong du an 3.827.000\`

━━━━━━━━━━━━━━━━━━
⚙️ *LỆNH HỆ THỐNG:*
• \`/check\` : Xem số dư ví thực tế, phụ cấp BE & nợ Credit
• \`/categories\` : Xem danh sách danh mục hợp lệ
• \`/undo\` : Hoàn tác (xóa) dòng vừa nhập nhầm
• \`/help\` : Xem lại hướng dẫn này`;

  sendMessage(chatId, helpText);
}

function sendCategoriesList(chatId) {
  let msg = `🏷️ *DANH MỤC HỢP LỆ TRONG GOOGLE SHEET:*\n\n`;
  msg += `*💸 Chi tiêu (Expenses):*\n`;
  EXPENSE_CATEGORIES.forEach(c => { msg += `• ${c}\n`; });
  msg += `\n*💵 Thu nhập (Income):*\n`;
  INCOME_CATEGORIES.forEach(c => { msg += `• ${c}\n`; });
  sendMessage(chatId, msg);
}

// ==================== CÁC HÀM GIAO TIẾP VỚI TELEGRAM API ====================
function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('Lỗi sendMessage: ' + e);
  }
}

function sendChatAction(chatId, action) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendChatAction`;
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, action: action }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

// ==================== HÀM THIẾT LẬP WEBHOOK (RUN ONCE) ====================
/**
 * Chạy hàm này trực tiếp trong Apps Script để kết nối Telegram Webhook
 */
function setWebhook() {
  if (CONFIG.TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    Logger.log('❌ Lỗi: Hãy điền TELEGRAM_BOT_TOKEN vào CONFIG trước.');
    return;
  }
  if (CONFIG.WEBHOOK_URL === 'YOUR_WEB_APP_URL_HERE') {
    Logger.log('❌ Lỗi: Hãy điền WEBHOOK_URL sau khi deploy vào CONFIG.');
    return;
  }

  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(CONFIG.WEBHOOK_URL)}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Kết quả thiết lập Webhook: ' + response.getContentText());
}

function getWebhookInfo() {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Thông tin Webhook hiện tại: ' + response.getContentText());
}

function deleteWebhook() {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/deleteWebhook`;
  const response = UrlFetchApp.fetch(url);
  Logger.log('Kết quả xóa Webhook: ' + response.getContentText());
}

// ==================== TIỆN ÍCH ĐỊNH DẠNG ====================
function formatDateMdy(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatVND(num) {
  if (num === null || num === undefined || isNaN(num)) return '0 đ';
  return Number(num).toLocaleString('vi-VN') + ' đ';
}

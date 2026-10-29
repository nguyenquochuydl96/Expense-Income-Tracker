// Test script for Telegram Message Parser

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

// Helper to remove accents for fuzzy matching
function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim();
}

// Parse monetary amounts (e.g., 50k, 1.5tr, 1,5tr, 200000, 200.000)
function parseAmount(text) {
  // Check for 'tr' or 'm' (triệu)
  let m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|m)\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'));
    return { amount: Math.round(val * 1000000), raw: m[0] };
  }

  // Check for 'k' (nghìn)
  m = text.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(',', '.'));
    return { amount: Math.round(val * 1000), raw: m[0] };
  }

  // Check for full formatted number like 50.000, 50,000, 3.827.000
  m = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (m) {
    const clean = m[1].replace(/[.,]/g, '');
    return { amount: parseInt(clean, 10), raw: m[0] };
  }

  // Standalone numbers >= 1000
  m = text.match(/\b(\d{4,9})\b/);
  if (m) {
    return { amount: parseInt(m[1], 10), raw: m[0] };
  }

  return null;
}

// Match category keywords
function detectCategory(cleanText, isIncome = false) {
  const norm = removeAccents(cleanText);

  if (isIncome) {
    if (/yes4all/i.test(norm)) return 'Lương Yes4All';
    if (/luong be\b/i.test(norm)) return 'Lương BE';
    if (/cong doan/i.test(norm)) return 'Công đoàn Yes4All';
    if (/chung khoan|co phieu/i.test(norm)) return 'Chứng khoán';
    if (/ban hang|thanh ly|ban do|ban man|ban may|ban /i.test(norm)) return 'Bán hàng';
    if (/thuong|bonus|du an/i.test(norm)) return 'Khác';
    if (/\bheo\b/i.test(norm)) return 'Lương Heo';
    if (/\bmeo\b/i.test(norm)) return 'Lương Mèo';
    return 'Khác';
  }

  // Pet care patterns (pate cho meo, tiem phong meo, hat cho, cat meo, thu y)
  if (/tiem phong|thu y|pate|hat cho|hat meo|cat meo|cat ve sinh|chuong cho|chuong meo|tam cho|tam meo/i.test(norm) ||
      (/\b(?:cho|meo)\b/i.test(norm) && /kham|tiem|thuoc|chuong|do choi/i.test(norm))) {
    return 'Thú cưng';
  }

  // Specific Personal Entertainment
  if (/giai tri heo|netflix heo|game heo|steam|bida|playstation|ps5/i.test(norm)) return 'Giải trí Heo';
  if (/giai tri meo|nail|lam mong|spa meo|xem phim meo|sach meo/i.test(norm)) return 'Giải trí Mèo';
  
  // Shopping (clothes, shoes, ecommerce)
  if (/shopee|lazada|tiktok shop|tiki|quan ao|vay|dam|ao thun|ao khoac|giay|dep|tui xach|mua sam|gia dung|noi chien|do gia dung/i.test(norm)) {
    return 'Shopping';
  }

  // Food & Beverage
  if (/an sang|an trua|an toi|an vat|an dem|cafe|ca phe|tra sua|nuoc ep|com|pho|bun|mi quang|banh mi|banh|lau|bbq|do an|di cho|sieu thi|winmart|coopmart|thuc pham|thit|ca|rau|hai san/i.test(norm)) {
    return 'Ăn uống';
  }

  // Rent & Utilities
  if (/tien nha|thue nha|dien nuoc|tien dien|tien nuoc|phi quan ly|internet|wifi/i.test(norm)) return 'Thuê nhà';

  // Cosmetics & Personal Care
  if (/hoa my pham|my pham|skincare|dau goi|sua tam|kem chong nang|son|giay ve sinh|nuoc giat|xa phong|kem danh rang|ban chai/i.test(norm)) return 'Hóa/Mỹ phẩm';

  // Transport & Commute
  if (/xang|do xang|gui xe|grab|be bike|be car|taxi|cuoc dien thoai|viettel|vinaphone|mobifone|4g|nap the/i.test(norm)) return 'Điện thoại/Xăng xe';

  // Savings & Investments
  if (/tiet kiem|gui tiet kiem|vang|tich luy/i.test(norm)) return 'Tiết kiệm';

  // Gifts & Weddings
  if (/qua|sinh nhat|dam cuoi|thiep cuoi|mung tuoi|li xi|thoi noi/i.test(norm)) return 'Quà tặng/Cưới hỏi';

  // Health
  if (/suc khoe|thuoc|kham benh|nha khoa|rang|vien phi|vitamin|thuc pham chuc nang|khau trang/i.test(norm)) return 'Sức khỏe';

  // Travel
  if (/du lich|ve may bay|khach san|homestay|tour|resort|ve tau/i.test(norm)) return 'Du lịch';

  // Generic food fallback
  if (/\b(?:an|uong|lau|nuong)\b/i.test(norm)) return 'Ăn uống';

  return 'Khác';
}

function parseTelegramMessage(text) {
  const trimmed = text.trim();
  const norm = removeAccents(trimmed);

  // 1. Check for Budget Transfer: e.g. "transfer 100k giai tri heo sang giai tri meo" or "chuyen 100k an uong sang shopping"
  const transferMatch = norm.match(/(?:transfer|chuyen|chuyen khoan)\s+([^\s]+)\s+(?:tu\s+)?(.+?)\s+sang\s+(.+)/i);
  if (transferMatch) {
    const amtInfo = parseAmount(transferMatch[1]);
    if (amtInfo) {
      const fromCatRaw = transferMatch[2].trim();
      const toCatRaw = transferMatch[3].trim();
      const fromCat = detectCategory(fromCatRaw);
      const toCat = detectCategory(toCatRaw);
      return {
        type: 'Transfer',
        amount: amtInfo.amount,
        fromCategory: fromCat,
        toCategory: toCat,
        description: `Chuyển ${amtInfo.amount.toLocaleString('vi-VN')}đ từ ${fromCat} sang ${toCat}`
      };
    }
  }

  // 2. Check for Income
  const isIncome = /^(?:thu|income|\+)\b/i.test(norm) || 
                   /\b(?:thuong|bonus|thuong du an)\b/i.test(norm) ||
                   (/\bluong\b/i.test(norm) && !/\b(?:an|uong|mua|chi|tra|vay)\b/i.test(norm));
  
  // 3. Extract Amount
  const amtInfo = parseAmount(trimmed);
  if (!amtInfo) {
    return { error: 'Không tìm thấy số tiền hợp lệ (ví dụ: 50k, 1.5tr, 200.000...)' };
  }

  // 4. Extract Person (Heo or Mèo)
  // Only detect as person if it appears at start or clearly separated from pet context
  let person = '';
  const isPetContext = /tiem phong|thu y|pate|hat cho|hat meo|cat meo|cat ve sinh/i.test(norm);
  if (!isPetContext) {
    if (/^heo\b|\bheo$/i.test(norm) || /\bheo\s+\d/i.test(norm)) person = 'Heo';
    else if (/^meo\b|\bmeo$/i.test(norm) || /\bmeo\s+\d/i.test(norm)) person = 'Mèo';
    else if (/\bheo\b/i.test(norm)) person = 'Heo';
    else if (/\bmeo\b/i.test(norm) && !/tiem|kham|pate|cho meo/i.test(norm)) person = 'Mèo';
  }

  // 5. Detect BE Corp
  let isBeCorp = false;
  if (/\b(?:be|becorp)\b/i.test(norm) && !/\bluong be\b/i.test(norm)) {
    isBeCorp = true;
  }

  // 6. Detect Credit Card
  let isCredit = false;
  if (/\b(?:credit|cr|the tin dung|the td|the credit)\b/i.test(norm)) {
    isCredit = true;
  }

  // 7. Clean up item description
  let cleanDesc = trimmed
    .replace(new RegExp(amtInfo.raw.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'), 'i'), '')
    .replace(/\b(?:credit|cr|the tin dung|the td|the credit)\b/gi, '')
    .replace(/\b(?:becorp)\b/gi, '')
    .replace(/^(?:thu|income|\+)\b/gi, '')
    .trim();

  // Remove person name if not pet context
  if (person) {
    cleanDesc = cleanDesc.replace(new RegExp(`\\b${person}\\b`, 'gi'), '').trim();
  }

  // If "be" was standalone flag, remove it
  if (isBeCorp) {
    cleanDesc = cleanDesc.replace(/\bbe\b/gi, '').trim();
  }

  // Capitalize item description
  let item = cleanDesc.replace(/^[-:,.\s]+|[-:,.\s]+$/g, '').trim();
  if (!item) {
    item = isIncome ? 'Thu nhập' : 'Chi tiêu';
  }
  item = item.charAt(0).toUpperCase() + item.slice(1);

  // 8. Detect Category
  const category = detectCategory(trimmed, isIncome);

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

// Test cases
const testCases = [
  'heo 50k an sang',
  'meo 350k mua vay shopee',
  'be 80k grab di gap khach',
  'meo 450k an lau haidilao credit',
  '120k cafe voi ban',
  'transfer 100k giai tri heo sang giai tri meo',
  'chuyen 200k an uong sang shopping',
  'thu 1.5tr ban man hinh cu',
  'income luong heo 28tr',
  'meo mua kem chong nang 250k cr',
  'heo do xang 70.000',
  'tiem phong meo 320k',
  'thuong du an 3.827.000'
];

console.log('--- TESTING TELEGRAM PARSER ---');
testCases.forEach(tc => {
  console.log(`\nInput: "${tc}"`);
  console.log(JSON.stringify(parseTelegramMessage(tc), null, 2));
});

import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, ArrowRight, Sparkles, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MoneyCalculatorInput } from './MoneyCalculatorInput';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ItemSuggestion,
  SheetTabType,
  TransactionRecord,
} from '../types/finance';
import {
  formatNumberForSheet,
  isoToSheetDate,
  parseSheetNumber,
} from '../utils/csvParser';

export interface NewTransactionPayload {
  sheetType: SheetTabType;
  purchaseDate: string; // M/D/YYYY
  isoDate: string; // YYYY-MM-DD
  category: string;
  purchaseItem: string;
  amount: number;
  beCorp: number;
  credit: number;
  note?: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: NewTransactionPayload | NewTransactionPayload[]) => Promise<void>;
  onSaveTransfer?: (transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
    isoDate: string;
  }) => Promise<void>;
  suggestions: ItemSuggestion[];
  isSheetConnected: boolean;
  initialPreset?: Partial<NewTransactionPayload> | null;
  allRecords: TransactionRecord[];
  onGoogleLogin?: () => Promise<void>;
  expensesTabName?: string;
  incomeTabName?: string;
}

const getTodayIsoDate = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Predefined category-specific common transaction suggestions
const CATEGORY_DEFAULT_SUGGESTIONS: Record<string, { item: string; typicalAmount?: number }[]> = {
  'Tiết kiệm': [
    { item: 'Gửi tiết kiệm ngân hàng', typicalAmount: 5000000 },
    { item: 'Tích lũy tài khoản', typicalAmount: 2000000 },
    { item: 'Mua vàng tích lũy' },
    { item: 'Gửi tiết kiệm online', typicalAmount: 3000000 },
    { item: 'Quỹ dự phòng khẩn cấp', typicalAmount: 1000000 },
  ],
  'Ăn uống': [
    { item: 'Cơm trưa', typicalAmount: 50000 },
    { item: 'Cà phê / Đồ uống', typicalAmount: 45000 },
    { item: 'Ăn sáng', typicalAmount: 35000 },
    { item: 'Đi chợ / Siêu thị', typicalAmount: 200000 },
    { item: 'Ăn tối gia đình', typicalAmount: 150000 },
  ],
  'Thuê nhà': [
    { item: 'Tiền thuê nhà tháng này' },
    { item: 'Phí dịch vụ / Chung cư' },
    { item: 'Tiền gửi xe', typicalAmount: 150000 },
  ],
  'Hóa/Mỹ phẩm': [
    { item: 'Mỹ phẩm chăm sóc da', typicalAmount: 300000 },
    { item: 'Dầu gội / Sữa tắm', typicalAmount: 150000 },
    { item: 'Nước giặt / Nước rửa chén', typicalAmount: 120000 },
  ],
  'Thú cưng': [
    { item: 'Hạt thức ăn cho mèo', typicalAmount: 250000 },
    { item: 'Pate mèo', typicalAmount: 100000 },
    { item: 'Cát vệ sinh mèo', typicalAmount: 120000 },
    { item: 'Khám thú y / Thuốc cho mèo' },
    { item: 'Cỏ mèo / Bánh thưởng', typicalAmount: 50000 },
  ],
  'Giải trí Heo': [
    { item: 'Cafe / Gặp bạn Heo', typicalAmount: 100000 },
    { item: 'Xem phim rạp', typicalAmount: 150000 },
    { item: 'Game / Giải trí cá nhân', typicalAmount: 200000 },
  ],
  'Giải trí Mèo': [
    { item: 'Cafe / Đi chơi Mèo', typicalAmount: 100000 },
    { item: 'Xem phim rạp', typicalAmount: 150000 },
    { item: 'Mua sắm giải trí Mèo', typicalAmount: 200000 },
  ],
  'Điện thoại/Xăng xe': [
    { item: 'Đổ xăng xe máy / ô tô', typicalAmount: 100000 },
    { item: 'Nạp tiền điện thoại / 4G', typicalAmount: 100000 },
    { item: 'Bảo dưỡng / Thay nhớt xe', typicalAmount: 150000 },
    { item: 'Vé gửi xe', typicalAmount: 20000 },
  ],
  'Quà tặng/Cưới hỏi': [
    { item: 'Mừng cưới / Đám cưới', typicalAmount: 500000 },
    { item: 'Quà sinh nhật', typicalAmount: 300000 },
    { item: 'Quà biếu / Thăm hỏi', typicalAmount: 500000 },
  ],
  'Shopping': [
    { item: 'Mua quần áo / Giày dép', typicalAmount: 350000 },
    { item: 'Đơn hàng Shopee / Lazada', typicalAmount: 200000 },
    { item: 'Đồ gia dụng gia đình', typicalAmount: 250000 },
  ],
  'Sức khỏe': [
    { item: 'Mua thuốc tây', typicalAmount: 150000 },
    { item: 'Khám bệnh / Xét nghiệm', typicalAmount: 500000 },
    { item: 'Vitamin / Thực phẩm chức năng', typicalAmount: 300000 },
  ],
  'Du lịch': [
    { item: 'Vé máy bay / Vé tàu' },
    { item: 'Tiền phòng khách sạn' },
    { item: 'Chi phí ăn uống du lịch' },
  ],
  'Lương Yes4All': [
    { item: 'Lương Yes4All chuyển khoản' },
    { item: 'Thưởng KPI Yes4All' },
    { item: 'Phụ cấp Yes4All' },
  ],
  'Lương BE': [
    { item: 'Lương BE chuyển khoản' },
    { item: 'Thưởng dự án BE' },
  ],
  'Công đoàn Yes4All': [
    { item: 'Trợ cấp công đoàn Yes4All' },
    { item: 'Quà lễ tết công đoàn Yes4All' },
  ],
  'Công đoàn BE': [
    { item: 'Trợ cấp công đoàn BE' },
    { item: 'Quà lễ tết công đoàn BE' },
  ],
  'Chứng khoán': [
    { item: 'Lợi nhuận cổ phiếu' },
    { item: 'Cổ tức tiền mặt' },
  ],
  'Bán hàng': [
    { item: 'Doanh thu bán hàng' },
    { item: 'Thanh lý đồ cũ' },
  ],
  'Lương Heo': [
    { item: 'Lương Heo' },
    { item: 'Thưởng Heo' },
  ],
  'Lương Mèo': [
    { item: 'Lương Mèo' },
    { item: 'Thưởng Mèo' },
  ],
};

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suggestions,
  isSheetConnected,
  initialPreset,
  onSaveTransfer,
  onGoogleLogin,
  expensesTabName,
  incomeTabName,
}) => {
  type ModalMode = 'Expenses' | 'Income' | 'Transfer';
  const [modalMode, setModalMode] = useState<ModalMode>('Expenses');
  const [sheetType, setSheetType] = useState<SheetTabType>('Expenses');
  const [isoDate, setIsoDate] = useState<string>(() => getTodayIsoDate());
  const [category, setCategory] = useState<string>('Ăn uống');
  const [fromCategory, setFromCategory] = useState<string>('Giải trí Heo');
  const [toCategory, setToCategory] = useState<string>('Giải trí Mèo');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [purchaseItem, setPurchaseItem] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [beCorpStr, setBeCorpStr] = useState<string>('');
  const [creditStr, setCreditStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (initialPreset) {
        const targetSheet = initialPreset.sheetType || 'Expenses';
        if (initialPreset.note === 'TRANSFER_MODE') {
          setModalMode('Transfer');
          setSheetType('Expenses');
        } else {
          setModalMode(targetSheet === 'Income' ? 'Income' : 'Expenses');
          setSheetType(targetSheet);
        }
        setIsoDate(initialPreset.isoDate || getTodayIsoDate());
        setCategory(
          initialPreset.category ||
            (targetSheet === 'Expenses' ? 'Ăn uống' : 'Lương Yes4All')
        );
        setPurchaseItem(initialPreset.purchaseItem || '');
        setAmountStr(
          initialPreset.amount !== undefined
            ? formatNumberForSheet(initialPreset.amount, false, true)
            : ''
        );
        setBeCorpStr(
          initialPreset.beCorp
            ? formatNumberForSheet(initialPreset.beCorp, false, true)
            : ''
        );
        setCreditStr(
          initialPreset.credit
            ? formatNumberForSheet(initialPreset.credit, false, true)
            : ''
        );
        setNote(initialPreset.note || '');
      } else {
        // Reset cleanly to default form with TODAY'S date and default category
        setIsoDate(getTodayIsoDate());
        setModalMode('Expenses');
        setSheetType('Expenses');
        setCategory('Ăn uống');
        setPurchaseItem('');
        setAmountStr('');
        setBeCorpStr('');
        setCreditStr('');
        setNote('');
      }
    }
  }, [isOpen, initialPreset]);

  const categoriesList = useMemo(() => {
    return sheetType === 'Expenses'
      ? [...EXPENSE_CATEGORIES]
      : [...INCOME_CATEGORIES];
  }, [sheetType]);

  const handleModeChange = (mode: ModalMode) => {
    setModalMode(mode);
    if (mode === 'Transfer') {
      setSheetType('Expenses');
      setBeCorpStr('');
      setCreditStr('');
    } else {
      setSheetType(mode);
      setCategory(mode === 'Expenses' ? 'Ăn uống' : 'Lương Yes4All');
      setCustomCategory('');
      if (mode === 'Income') {
        setBeCorpStr('');
        setCreditStr('');
      }
    }
  };

  const filteredSuggestions = useMemo(() => {
    const q = purchaseItem.trim().toLowerCase();
    const currentCat = category === '__CUSTOM__' ? customCategory.trim() : category;

    // 1. Filter historical suggestions that STRICTLY match sheetType and category
    const matched = suggestions.filter((s) => {
      // Must match sheetType (if suggestion has sheetType defined)
      if (s.sheetType && s.sheetType !== sheetType) return false;

      // Must strictly match current category
      if (currentCat) {
        if (s.category.trim().toLowerCase() !== currentCat.trim().toLowerCase()) {
          return false;
        }
      }

      // If user typed a search query, filter by item name
      if (q) {
        return s.item.toLowerCase().includes(q);
      }

      return true;
    });

    // 2. Supplement with category-specific defaults if needed
    const defaults = CATEGORY_DEFAULT_SUGGESTIONS[currentCat] || [];
    const seen = new Set(matched.map((m) => m.item.toLowerCase()));
    const supplemental: ItemSuggestion[] = [];

    for (const def of defaults) {
      if (!seen.has(def.item.toLowerCase())) {
        if (!q || def.item.toLowerCase().includes(q)) {
          supplemental.push({
            item: def.item,
            category: currentCat,
            sheetType,
            lastAmount: def.typicalAmount || 0,
            count: 0,
            typicalBeCorp: false,
            typicalCredit: false,
          });
          seen.add(def.item.toLowerCase());
        }
      }
    }

    return [...matched, ...supplemental].slice(0, 8);
  }, [purchaseItem, suggestions, sheetType, category, customCategory]);

  const applySuggestion = (s: ItemSuggestion) => {
    setPurchaseItem(s.item);
    if (s.category && category === '__CUSTOM__') {
      setCategory(s.category);
    }
    // Theo yêu cầu người dùng: chỉ điền tên món, không tự động điền sẵn số tiền
    // vì thực tế ít khi nào tiêu dùng cùng món mà chính xác đến từng giá tiền.
    setShowSuggestions(false);
  };

  // Handler khi thay đổi Số tiền chi (Amount)
  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    // Lưu ý: Trường hợp ngược lại thì không tự nhập BE Corp hay tín dụng
    // vì không phải giao dịch nào cũng dùng BE hay tín dụng
  };

  // Handler khi nhập BE Corp: mặc định đồng bộ luôn sang "Số tiền chi"
  const handleBeCorpChange = (val: string) => {
    setBeCorpStr(val);
    setAmountStr(val);
  };

  // Handler khi nhập Quẹt thẻ Credit: mặc định đồng bộ luôn sang "Số tiền chi"
  const handleCreditChange = (val: string) => {
    setCreditStr(val);
    setAmountStr(val);
  };

  const formatNumericInput = (val: string): string => {
    const trimmed = val.trim();
    if (trimmed === '-') return '-';
    const isNegative = trimmed.startsWith('-');
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (!digits) return isNegative ? '-' : '';
    const num = parseInt(digits, 10);
    if (!Number.isFinite(num)) return '';
    return (isNegative ? '-' : '') + num.toLocaleString('en-US');
  };

  const parsedAmount = parseSheetNumber(amountStr);
  const parsedBeCorp = parseSheetNumber(beCorpStr);
  const parsedCredit = parseSheetNumber(creditStr);
  const sheetDatePreview = isoToSheetDate(isoDate);
  const finalCategory =
    category === '__CUSTOM__' ? customCategory.trim() || 'Khác' : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (modalMode === 'Transfer') {
      if (fromCategory === toCategory) {
        setErrorMsg('Danh mục nguồn và danh mục đích không được trùng nhau.');
        return;
      }
      if (parsedAmount <= 0) {
        setErrorMsg('Vui lòng nhập số tiền chuyển lớn hơn 0.');
        return;
      }

      setIsSubmitting(true);
      try {
        const transferNote = note.trim();
        const payloadFrom: NewTransactionPayload = {
          sheetType: 'Expenses',
          purchaseDate: sheetDatePreview,
          isoDate,
          category: fromCategory,
          purchaseItem: `[Transfer] Chuyển sang ${toCategory}${transferNote ? ': ' + transferNote : ''}`,
          amount: parsedAmount,
          beCorp: 0,
          credit: 0,
          note: transferNote ? `Transfer: ${transferNote}` : 'Transfer Budget',
        };

        const payloadTo: NewTransactionPayload = {
          sheetType: 'Expenses',
          purchaseDate: sheetDatePreview,
          isoDate,
          category: toCategory,
          purchaseItem: `[Transfer] Nhận từ ${fromCategory}${transferNote ? ': ' + transferNote : ''}`,
          amount: -parsedAmount,
          beCorp: 0,
          credit: 0,
          note: transferNote ? `Transfer: ${transferNote}` : 'Transfer Budget',
        };

        if (onSaveTransfer) {
          await onSaveTransfer({
            date: sheetDatePreview,
            fromCategory,
            toCategory,
            amount: parsedAmount,
            description: transferNote,
            isoDate,
          });
        } else {
          await onSave([payloadFrom, payloadTo]);
        }
        setAmountStr('');
        setNote('');
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Có lỗi xảy ra khi chuyển ngân sách.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!purchaseItem.trim() && parsedAmount === 0) {
      setErrorMsg('Vui lòng nhập nội dung hoặc số tiền.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        sheetType,
        purchaseDate: sheetDatePreview,
        isoDate,
        category: finalCategory,
        purchaseItem: purchaseItem.trim(),
        amount: parsedAmount,
        beCorp: sheetType === 'Expenses' ? parsedBeCorp : 0,
        credit: sheetType === 'Expenses' ? parsedCredit : 0,
        note: note.trim() || undefined,
      });
      setPurchaseItem('');
      setAmountStr('');
      setBeCorpStr('');
      setCreditStr('');
      setNote('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi lưu giao dịch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-tx-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto cursor-pointer"
          onClick={onClose}
        >
          <motion.div
            key="add-tx-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 transition-all cursor-default text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {modalMode === 'Transfer'
                ? 'Chuyển ngân sách giữa 2 danh mục'
                : modalMode === 'Expenses'
                ? 'Thêm khoản chi tiêu mới'
                : 'Thêm khoản thu nhập mới'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {modalMode === 'Transfer'
                ? 'Điều chuyển hạn mức ngân sách mà không làm thay đổi tổng ngân sách gia đình'
                : modalMode === 'Expenses'
                ? 'Ghi nhận khoản chi tiêu vào sổ cái và cập nhật ngân sách'
                : 'Ghi nhận khoản thu nhập vào sổ cái và phân bổ ngân sách'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Mode Switcher (3 Tabs) */}
          <div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 dark:bg-slate-800/90 rounded-xl border border-slate-300/60 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => handleModeChange('Expenses')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate cursor-pointer ${
                  modalMode === 'Expenses'
                    ? 'bg-white dark:bg-rose-950/80 text-rose-700 dark:text-rose-200 shadow-xs font-bold border border-slate-200/80 dark:border-rose-700/80'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                💸 Chi tiêu
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('Income')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate cursor-pointer ${
                  modalMode === 'Income'
                    ? 'bg-white dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-200 shadow-xs font-bold border border-slate-200/80 dark:border-emerald-700/80'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                💰 Thu nhập
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('Transfer')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate cursor-pointer ${
                  modalMode === 'Transfer'
                    ? 'bg-white dark:bg-purple-950/80 text-purple-700 dark:text-purple-200 shadow-xs font-bold border border-slate-200/80 dark:border-purple-700/80'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                🔄 Chuyển Budget
              </button>
            </div>
          </div>

          {/* Connection Status Banner */}
          {isSheetConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Đang kết nối Google Sheet · Ghi vào bảng <strong>{modalMode === 'Expenses' ? (expensesTabName || 'Expenses') : modalMode === 'Income' ? (incomeTabName || 'Income') : 'Budget Transfers'}</strong>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Chưa kết nối Google Sheet (Dữ liệu sẽ lưu tạm trên máy).</span>
              </div>
              {onGoogleLogin && (
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md text-[11px] shrink-0 transition-colors"
                >
                  Đăng nhập để đồng bộ
                </button>
              )}
            </div>
          )}

          {modalMode === 'Transfer' ? (
            /* TRANSFER BUDGET FORM */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày chuyển ngân sách
                </label>
                <input
                  type="date"
                  value={isoDate}
                  onChange={(e) => setIsoDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Trích từ danh mục (Nguồn -)
                  </label>
                  <select
                    value={fromCategory}
                    onChange={(e) => setFromCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-amber-50/30 focus:outline-none focus:border-amber-600 font-medium"
                  >
                    <option value="Thu nhập riêng">✨ Thu nhập riêng / Nạp thêm ngoài</option>
                    <optgroup label="Danh mục chi tiêu">
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-900 mb-1">
                    Chuyển sang danh mục (Đích +)
                  </label>
                  <select
                    value={toCategory}
                    onChange={(e) => setToCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg bg-emerald-50/30 focus:outline-none focus:border-emerald-600 font-medium"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tiền chuyển (₫) <span className="text-purple-600">*</span>
                </label>
                <MoneyCalculatorInput
                  value={amountStr}
                  onChange={(val) => setAmountStr(val)}
                  placeholder="VD: 100,000"
                  theme="purple"
                  size="lg"
                  required
                  inputClassName="text-purple-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do / Ghi chú chuyển ngân sách
                </label>
                <input
                  type="text"
                  placeholder="VD: Cho Mèo, Nhường đi xem phim, Mượn tạm..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Transfer Preview Card */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 text-xs text-purple-950">
                <div className="font-semibold flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tóm tắt điều chuyển ngân sách:</span>
                </div>
                {fromCategory === 'Thu nhập riêng' ? (
                  <>
                    <div className="flex items-center justify-between text-teal-800">
                      <span>✨ Nguồn tiền:</span>
                      <span className="font-semibold">Thu nhập riêng / Tiền túi ngoài</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-800 font-bold">
                      <span>🔺 Bổ sung ngân sách {toCategory}:</span>
                      <span className="font-mono-tabular">+{amountStr ? amountStr + ' ₫' : '0 ₫'}</span>
                    </div>
                    <div className="text-[11px] text-purple-700 pt-1.5 border-t border-purple-200/60 leading-relaxed">
                      ⚡ Tăng trực tiếp hạn mức khả dụng của <strong>{toCategory}</strong> mà không trừ bất kỳ danh mục nào khác.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-amber-800 font-semibold">
                      <span>🔻 Giảm ngân sách {fromCategory}:</span>
                      <span className="font-mono-tabular">-{amountStr ? amountStr + ' ₫' : '0 ₫'}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-800 font-bold">
                      <span>🔺 Tăng ngân sách {toCategory}:</span>
                      <span className="font-mono-tabular">+{amountStr ? amountStr + ' ₫' : '0 ₫'}</span>
                    </div>
                    <div className="text-[11px] text-purple-700 pt-1.5 border-t border-purple-200/60 leading-relaxed">
                      ⚡ Điều chuyển hạn mức giữa 2 danh mục mà không làm thay đổi tổng ngân sách gia đình.
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
          {/* Row 1: Purchase Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày giao dịch
              </label>
              <input
                type="date"
                value={isoDate}
                onChange={(e) => setIsoDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {sheetType === 'Expenses' ? 'Danh mục chi tiêu' : 'Mục đích thu nhập / Ngân sách'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              >
                {sheetType === 'Expenses' ? (
                  <>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Nhập danh mục khác...</option>
                  </>
                ) : (
                  <>
                    <optgroup label="💼 Thu nhập chung (Chia theo % cho các ngân sách)">
                      {INCOME_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🎯 Dành riêng cho 1 mục (Cộng thẳng 100% vào Budget mục đó)">
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} (Thưởng / Dành riêng)
                        </option>
                      ))}
                    </optgroup>
                    <option value="__CUSTOM__">+ Nhập danh mục khác...</option>
                  </>
                )}
              </select>
              {category === '__CUSTOM__' && (
                <input
                  type="text"
                  placeholder="Nhập tên danh mục..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              )}

              {sheetType === 'Income' && EXPENSE_CATEGORIES.includes(category as any) && (
                <div className="mt-1.5 p-2 bg-teal-50 border border-teal-200 rounded-lg flex items-start gap-1.5 text-[11px] text-teal-900">
                  <span className="shrink-0 text-xs">🎯</span>
                  <span>
                    Khoản này sẽ <strong>cộng thẳng 100%</strong> vào ngân sách của danh mục <strong>{category}</strong>, không chia cho các mục khác.
                  </span>
                </div>
              )}
              {sheetType === 'Income' && !EXPENSE_CATEGORIES.includes(category as any) && category !== '__CUSTOM__' && (
                <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                  <span>💼</span>
                  <span>Thu nhập chung: Sẽ chia theo tỷ lệ % cho tất cả ngân sách trong tháng.</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Purchase Item with Autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {sheetType === 'Expenses' ? 'Nội dung chi tiêu' : 'Nội dung khoản thu'}
              </label>
              {filteredSuggestions.length > 0 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  <span>
                    Gợi ý theo mục:{' '}
                    <strong className="text-teal-600 dark:text-teal-400">
                      {category === '__CUSTOM__' ? customCategory || 'Khác' : category}
                    </strong>
                  </span>
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                category === 'Tiết kiệm'
                  ? 'VD: Gửi tiết kiệm VPBank, Tích lũy online...'
                  : sheetType === 'Expenses'
                    ? `VD: Nhập nội dung chi cho ${category}...`
                    : `VD: Nhập nội dung khoản thu cho ${category}...`
              }
              value={purchaseItem}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => setPurchaseItem(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span>
                    Gợi ý cho danh mục{' '}
                    <strong className="text-teal-600 dark:text-teal-400">
                      {category === '__CUSTOM__' ? customCategory || 'Khác' : category}
                    </strong>
                    :
                  </span>
                  <span className="text-[10px] text-slate-400 italic">
                    (chỉ điền tên món · {filteredSuggestions.length})
                  </span>
                </div>
                {filteredSuggestions.map((s) => (
                  <button
                    key={`${s.category}-${s.item}`}
                    type="button"
                    onMouseDown={() => applySuggestion(s)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="truncate flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{s.item}</span>
                      {s.count > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          {s.count} lần
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                          phổ biến
                        </span>
                      )}
                    </div>
                    {s.lastAmount > 0 && (
                      <span
                        className="font-mono-tabular text-slate-400 dark:text-slate-500 shrink-0 text-[11px]"
                        title="Giá lần gần nhất (chỉ để tham khảo, không tự điền vào ô tiền)"
                      >
                        ~{formatNumberForSheet(s.lastAmount)} ₫
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Amounts */}
          {sheetType === 'Expenses' ? (
            /* Khi là Chi tiêu: Hiện 3 cột (Số tiền chi, BE Corp, Credit) */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số tiền chi (₫) <span className="text-rose-600">*</span>
                </label>
                <MoneyCalculatorInput
                  value={amountStr}
                  onChange={handleAmountChange}
                  placeholder="VD: 50,000"
                  theme="rose"
                  size="md"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                    <span>BE Corp</span>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/70 font-normal">
                      (→ tự điền chi)
                    </span>
                  </label>
                  {parsedAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBeCorpStr(
                          parsedBeCorp === parsedAmount
                            ? ''
                            : formatNumberForSheet(parsedAmount)
                        )
                      }
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium"
                    >
                      {parsedBeCorp === parsedAmount ? 'Xóa' : '= Số tiền'}
                    </button>
                  )}
                </div>
                <MoneyCalculatorInput
                  value={beCorpStr}
                  onChange={handleBeCorpChange}
                  placeholder="Để trống nếu không"
                  theme="amber"
                  size="md"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-indigo-800 dark:text-indigo-400 flex items-center gap-1">
                    <span>Quẹt thẻ Credit</span>
                    <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/70 font-normal">
                      (→ tự điền chi)
                    </span>
                  </label>
                  {parsedAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCreditStr(
                          parsedCredit === parsedAmount
                            ? ''
                            : formatNumberForSheet(parsedAmount)
                        )
                      }
                      className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {parsedCredit === parsedAmount ? 'Xóa' : '= Số tiền'}
                    </button>
                  )}
                </div>
                <MoneyCalculatorInput
                  value={creditStr}
                  onChange={handleCreditChange}
                  placeholder="Để trống nếu không"
                  theme="indigo"
                  size="md"
                />
              </div>
            </div>
          ) : (
            /* Khi là Thu nhập: CHỈ CẦN 1 Ô SỐ TIỀN THU NHẬP (ẨN HOÀN TOÀN BE CORP VÀ CREDIT) */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số tiền thu nhập (₫) <span className="text-emerald-600">*</span>
              </label>
              <MoneyCalculatorInput
                value={amountStr}
                onChange={(val) => setAmountStr(val)}
                placeholder="VD: 25,000,000"
                theme="emerald"
                size="lg"
                required
                inputClassName="text-emerald-800 font-bold"
              />
            </div>
          )}

          {/* Row 4: Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú thêm (không bắt buộc)
            </label>
            <input
              type="text"
              placeholder="VD: Mua chung với bạn, tiền thưởng dự án..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shadow-xs ${
                modalMode === 'Transfer'
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : sheetType === 'Expenses'
                  ? 'bg-rose-700 hover:bg-rose-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {modalMode === 'Transfer' ? (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{isSubmitting ? 'Đang chuyển...' : 'Xác nhận chuyển ngân sách'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Đang ghi vào Sheet...'
                      : `Lưu vào ${sheetType === 'Expenses' ? 'Chi tiêu' : 'Thu nhập'}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};

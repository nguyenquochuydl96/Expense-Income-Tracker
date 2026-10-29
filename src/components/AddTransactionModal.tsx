import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, ArrowRight, Sparkles, ArrowLeftRight } from 'lucide-react';
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
  suggestions: ItemSuggestion[];
  isSheetConnected: boolean;
  initialPreset?: Partial<NewTransactionPayload> | null;
  allRecords: TransactionRecord[];
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suggestions,
  isSheetConnected,
  initialPreset,
}) => {
  type ModalMode = 'Expenses' | 'Income' | 'Transfer';
  const [modalMode, setModalMode] = useState<ModalMode>('Expenses');
  const [sheetType, setSheetType] = useState<SheetTabType>('Expenses');
  const [isoDate, setIsoDate] = useState<string>('2026-10-25');
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
        setIsoDate(initialPreset.isoDate || '2026-10-25');
        setCategory(
          initialPreset.category ||
            (targetSheet === 'Expenses' ? 'Khác' : 'Lương Yes4All')
        );
        setPurchaseItem(initialPreset.purchaseItem || '');
        setAmountStr(
          initialPreset.amount !== undefined
            ? formatNumberForSheet(initialPreset.amount, false)
            : ''
        );
        setBeCorpStr(
          initialPreset.beCorp
            ? formatNumberForSheet(initialPreset.beCorp, false)
            : ''
        );
        setCreditStr(
          initialPreset.credit
            ? formatNumberForSheet(initialPreset.credit, false)
            : ''
        );
        setNote(initialPreset.note || '');
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
    if (sheetType !== 'Expenses') return [];
    const q = purchaseItem.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions
      .filter(
        (s) =>
          s.item.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [purchaseItem, suggestions, sheetType]);

  const applySuggestion = (s: ItemSuggestion) => {
    setPurchaseItem(s.item);
    setCategory(s.category);
    if (!amountStr && s.lastAmount > 0) {
      setAmountStr(formatNumberForSheet(s.lastAmount));
      if (s.typicalBeCorp) setBeCorpStr(formatNumberForSheet(s.lastAmount));
      if (s.typicalCredit) setCreditStr(formatNumberForSheet(s.lastAmount));
    }
    setShowSuggestions(false);
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

  if (!isOpen) return null;

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

        await onSave([payloadFrom, payloadTo]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {modalMode === 'Transfer'
                ? 'Chuyển ngân sách giữa 2 danh mục'
                : modalMode === 'Expenses'
                ? 'Thêm khoản chi tiêu mới'
                : 'Thêm khoản thu nhập mới'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {modalMode === 'Transfer'
                ? 'Điều chuyển hạn mức ngân sách mà không làm thay đổi tổng chi tiêu gia đình'
                : `Ghi vào bảng ${sheetType} trên Google Sheet`}
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
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeChange('Expenses')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate ${
                  modalMode === 'Expenses'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💸 Chi tiêu
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('Income')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate ${
                  modalMode === 'Income'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💰 Thu nhập
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('Transfer')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-all truncate ${
                  modalMode === 'Transfer'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔄 Chuyển Budget
              </button>
            </div>
          </div>

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
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
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
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="VD: 100,000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(formatNumericInput(e.target.value))}
                  required
                  className="w-full px-3 py-2.5 text-base font-mono-tabular font-bold text-purple-900 border border-slate-300 rounded-lg focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
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
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1.5 text-xs text-purple-900">
                <div className="font-semibold flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tóm tắt điều chuyển:</span>
                </div>
                <div className="flex items-center justify-between text-amber-800">
                  <span>🔻 Giảm ngân sách {fromCategory}:</span>
                  <span className="font-mono-tabular font-bold">-{amountStr ? amountStr + ' ₫' : '0 ₫'}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-800">
                  <span>🔺 Tăng ngân sách {toCategory}:</span>
                  <span className="font-mono-tabular font-bold">+{amountStr ? amountStr + ' ₫' : '0 ₫'}</span>
                </div>
                <div className="text-[11px] text-purple-700 pt-1 border-t border-purple-200/50">
                  ⚡ Sẽ tự động tạo 2 dòng đối ứng trên Google Sheet (Expenses) và không làm tăng tổng chi tiêu của gia đình.
                </div>
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
              <label className="text-xs font-semibold text-slate-700">
                {sheetType === 'Expenses' ? 'Nội dung chi tiêu' : 'Nội dung khoản thu'}
              </label>
              {sheetType === 'Expenses' && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Gợi ý từ lịch sử
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                sheetType === 'Expenses'
                  ? 'VD: Cafe, Bún nước tương, Cát mèo, Grab...'
                  : 'VD: Lương tháng 10 Heo, Thưởng dự án Mèo...'
              }
              value={purchaseItem}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => setPurchaseItem(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                <div className="px-3 py-1 text-[11px] text-slate-400 border-b border-slate-100">
                  Món thường dùng gần đây:
                </div>
                {filteredSuggestions.map((s) => (
                  <button
                    key={`${s.category}-${s.item}`}
                    type="button"
                    onMouseDown={() => applySuggestion(s)}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-slate-900">{s.item}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-teal-700">{s.category}</span>
                    </div>
                    <span className="font-mono-tabular text-slate-500 shrink-0">
                      {s.lastAmount > 0 ? `${formatNumberForSheet(s.lastAmount)} ₫` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Amounts */}
          {sheetType === 'Expenses' ? (
            /* Khi là Chi tiêu: Hiện 3 cột (Số tiền chi, BE Corp, Credit) tối giản, KHÔNG có gợi ý số tiền */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tiền chi (₫) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="VD: 50,000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(formatNumericInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm font-mono-tabular font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-amber-800">
                    BE Corp
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
                      className="text-[11px] text-amber-700 hover:underline font-medium"
                    >
                      {parsedBeCorp === parsedAmount ? 'Xóa' : '= Số tiền'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Để trống nếu không"
                  value={beCorpStr}
                  onChange={(e) => setBeCorpStr(formatNumericInput(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-indigo-800">
                    Quẹt thẻ Credit
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
                      className="text-[11px] text-indigo-700 hover:underline font-medium"
                    >
                      {parsedCredit === parsedAmount ? 'Xóa' : '= Số tiền'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Để trống nếu không"
                  value={creditStr}
                  onChange={(e) => setCreditStr(formatNumericInput(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>
          ) : (
            /* Khi là Thu nhập: CHỈ CẦN 1 Ô SỐ TIỀN THU NHẬP (ẨN HOÀN TOÀN BE CORP VÀ CREDIT) */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số tiền thu nhập (₫) <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="VD: 25,000,000"
                value={amountStr}
                onChange={(e) => setAmountStr(formatNumericInput(e.target.value))}
                required
                className="w-full px-3 py-2.5 text-base font-mono-tabular font-bold text-emerald-800 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
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
      </div>
    </div>
  );
};

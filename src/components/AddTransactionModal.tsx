import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, ArrowRight, Sparkles, Zap } from 'lucide-react';
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
import { getTopCategories, getSuggestedAmountsForCategory } from '../utils/quickEntry';

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
  onSave: (payload: NewTransactionPayload) => Promise<void>;
  suggestions: ItemSuggestion[];
  isSheetConnected: boolean;
  initialPreset?: Partial<NewTransactionPayload> | null;
  allRecords: TransactionRecord[]; // For analyzing history
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suggestions,
  isSheetConnected,
  initialPreset,
  allRecords,
}) => {
  const [sheetType, setSheetType] = useState<SheetTabType>('Expenses');
  const [isoDate, setIsoDate] = useState<string>('2026-10-25');
  const [category, setCategory] = useState<string>('Ăn uống');
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
        setSheetType(targetSheet);
        setIsoDate(initialPreset.isoDate || '2026-10-25');
        setCategory(
          initialPreset.category ||
            (targetSheet === 'Expenses' ? 'Khác' : 'Lương Heo')
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

  // Top 6 frequently used categories (Expenses only)
  const topCategories = useMemo(() => {
    if (sheetType !== 'Expenses') return [];
    return getTopCategories(allRecords, 6);
  }, [allRecords, sheetType]);

  // Smart amount suggestions for selected category
  const smartAmounts = useMemo(() => {
    if (sheetType !== 'Expenses') return [];
    return getSuggestedAmountsForCategory(allRecords, category, 4);
  }, [allRecords, category, sheetType]);

  const handleSheetTypeChange = (type: SheetTabType) => {
    setSheetType(type);
    setCategory(type === 'Expenses' ? 'Ăn uống' : 'Lương Heo');
    setCustomCategory('');
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

    if (!purchaseItem.trim() && parsedAmount === 0) {
      setErrorMsg('Vui lòng nhập nội dung (Purchase Item) hoặc số tiền (Amount).');
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
        beCorp: parsedBeCorp,
        credit: parsedCredit,
        note: note.trim() || undefined,
      });
      // Reset fields for next entry
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-lg overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Thêm giao dịch mới vào sổ Google Sheet
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động nối thêm 1 dòng vào cuối bảng <strong className="text-slate-700">{sheetType}</strong> · Giữ nguyên lịch sử cũ
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target Table Selector: Expenses vs Income */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Chọn bảng đích trên Google Sheet
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleSheetTypeChange('Expenses')}
                className={`py-2 px-4 text-xs font-semibold rounded-md transition-colors ${
                  sheetType === 'Expenses'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng Expenses (Chi tiêu)
              </button>
              <button
                type="button"
                onClick={() => handleSheetTypeChange('Income')}
                className={`py-2 px-4 text-xs font-semibold rounded-md transition-colors ${
                  sheetType === 'Income'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng Income (Thu nhập)
              </button>
            </div>
          </div>

          {/* Row 1: Purchase Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  1. Purchase Date (Ngày)
                </label>
                <span className="text-[11px] font-mono-tabular text-teal-700">
                  Ghi Sheet: {sheetDatePreview}
                </span>
              </div>
              <input
                type="date"
                value={isoDate}
                onChange={(e) => setIsoDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                2. Category (Danh mục)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Nhập danh mục khác...</option>
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
            </div>
          </div>

          {/* Quick Category Chips (Top 6 hay dùng nhất) */}
          {sheetType === 'Expenses' && topCategories.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-teal-700" />
                <span className="text-[11px] font-semibold text-teal-900 uppercase tracking-wide">
                  Danh mục hay dùng (Chọn nhanh)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topCategories.map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setCategory(cat.category)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      category === cat.category
                        ? 'bg-teal-600 text-white shadow-md'
                        : 'bg-white text-slate-800 hover:bg-teal-100 border border-teal-200'
                    }`}
                  >
                    {cat.category}
                    <span className="ml-1.5 text-[10px] opacity-75">
                      ({cat.count}x · ~{Math.round(cat.avgAmount / 1000)}k)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Purchase Item with Historical Autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                3. Purchase Item (Nội dung chi tiết)
              </label>
              {sheetType === 'Expenses' && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Gợi ý thông minh từ lịch sử
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                sheetType === 'Expenses'
                  ? 'VD: Cafe boardgame, Bún nước tương, Cát mèo, Xe Heo...'
                  : 'VD: Lương tháng 10, Thưởng dự án, Bán đồ...'
              }
              value={purchaseItem}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              onChange={(e) => setPurchaseItem(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-md py-1 max-h-48 overflow-y-auto">
                <div className="px-3 py-1 text-[11px] text-slate-400 border-b border-slate-100">
                  Chọn nhanh món thường nhập (tự điền Danh mục & Số tiền gần nhất):
                </div>
                {filteredSuggestions.map((s) => (
                  <button
                    key={`${s.category}-${s.item}`}
                    type="button"
                    onMouseDown={() => applySuggestion(s)}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <span className="font-medium text-slate-900">{s.item}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-teal-700">{s.category}</span>
                    </div>
                    <span className="font-mono-tabular text-slate-500 shrink-0">
                      {s.lastAmount > 0 ? `${formatNumberForSheet(s.lastAmount)} ₫` : ''} ({s.count}x)
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Amount, BE Corp, Credit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  4. Amount (Số tiền)
                </label>
                <div className="flex items-center gap-1">
                  {smartAmounts.length > 0 ? (
                    smartAmounts.map((smart) => (
                      <button
                        key={smart.amount}
                        type="button"
                        onClick={() => setAmountStr(smart.amount.toLocaleString('en-US'))}
                        className="text-[10px] font-mono-tabular px-1.5 py-0.5 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded font-semibold"
                        title={`Thường dùng cho ${category}`}
                      >
                        {smart.label}
                      </button>
                    ))
                  ) : (
                    [25000, 50000, 100000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setAmountStr(quick.toLocaleString('en-US'))}
                        className="text-[10px] font-mono-tabular px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >
                        {quick / 1000}k
                      </button>
                    ))
                  )}
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="VD: 50,000"
                value={amountStr}
                onChange={(e) => setAmountStr(formatNumericInput(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono-tabular font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-amber-800">
                  5. BE Corp (Cột E)
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
                    {parsedBeCorp === parsedAmount ? 'Xóa' : '= Amount'}
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Để trống nếu không"
                value={beCorpStr}
                onChange={(e) => setBeCorpStr(formatNumericInput(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-indigo-800">
                  6. Credit (Cột F)
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
                    {parsedCredit === parsedAmount ? 'Xóa' : '= Amount'}
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Để trống nếu không"
                value={creditStr}
                onChange={(e) => setCreditStr(formatNumericInput(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Optional Column G Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ghi chú mở rộng (Cột G - không bắt buộc)
            </label>
            <input
              type="text"
              placeholder="VD: Chị Sơn 40k, Thảo 50k, có phí ship..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>

          {/* Exact Row Preview to guarantee column fidelity */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
              <span>Xem trước dòng sẽ ghi nối vào cuối bảng {sheetType}:</span>
              <span className="font-mono-tabular">
                {isSheetConnected ? 'Đồng bộ trực tiếp Google Sheet' : 'Lưu bộ nhớ đệm & chờ đồng bộ'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded p-2 overflow-x-auto">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Purchase Date</div>
                <div className="text-slate-900 truncate">{sheetDatePreview}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Category</div>
                <div className="text-slate-900 truncate font-sans">{finalCategory}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Purchase Item</div>
                <div className="text-slate-900 truncate font-sans">
                  {purchaseItem || '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-sans">Amount</div>
                <div className="text-slate-900 font-semibold">
                  {formatNumberForSheet(parsedAmount, true)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-amber-700 font-sans">BE Corp</div>
                <div className="text-amber-800">
                  {parsedBeCorp !== 0 ? formatNumberForSheet(parsedBeCorp) : '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-indigo-700 font-sans">Credit</div>
                <div className="text-indigo-800">
                  {parsedCredit !== 0 ? formatNumberForSheet(parsedCredit) : '—'}
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
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
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Đang ghi vào Sheet...'
                  : `Lưu dòng mới vào ${sheetType}`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

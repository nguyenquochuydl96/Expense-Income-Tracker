import React, { useState, useEffect, useMemo } from 'react';
import {
  TransactionRecord,
  SheetTabType,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../types/finance';
import {
  formatNumberForSheet,
  parseSheetNumber,
  isoToSheetDate,
  parseDateString,
} from '../utils/csvParser';
import { X, Calendar, Tag, FileText, DollarSign, CreditCard, Trash2, Check, AlertCircle } from 'lucide-react';
import { MoneyCalculatorInput } from './MoneyCalculatorInput';

export interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: TransactionRecord | null;
  onSave: (updatedRecord: TransactionRecord) => Promise<void>;
  onDeleteRequest: (record: TransactionRecord) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  onDeleteRequest,
}) => {
  const [sheetType, setSheetType] = useState<SheetTabType>('Expenses');
  const [isoDate, setIsoDate] = useState<string>('');
  const [category, setCategory] = useState<string>('Ăn uống');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [purchaseItem, setPurchaseItem] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [beCorpStr, setBeCorpStr] = useState<string>('');
  const [creditStr, setCreditStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setErrorMsg(null);
      setSheetType(record.sheetType || 'Expenses');
      setIsoDate(record.isoDate || '');
      
      const isCustom =
        record.sheetType === 'Expenses'
          ? !EXPENSE_CATEGORIES.includes(record.category as any)
          : !INCOME_CATEGORIES.includes(record.category as any);

      if (isCustom && record.category) {
        setCategory('__CUSTOM__');
        setCustomCategory(record.category);
      } else {
        setCategory(record.category || (record.sheetType === 'Expenses' ? 'Ăn uống' : 'Lương Yes4All'));
        setCustomCategory('');
      }

      setPurchaseItem(record.purchaseItem || '');
      setAmountStr(record.amount ? formatNumberForSheet(record.amount, false) : '0');
      setBeCorpStr(record.beCorp ? formatNumberForSheet(record.beCorp, false) : '');
      setCreditStr(record.credit ? formatNumberForSheet(record.credit, false) : '');
      setNote(record.note || '');
    }
  }, [isOpen, record]);

  const categoriesList = useMemo(() => {
    return sheetType === 'Expenses' ? [...EXPENSE_CATEGORIES] : [...INCOME_CATEGORIES];
  }, [sheetType]);

  if (!isOpen || !record) return null;

  const parsedAmount = parseSheetNumber(amountStr);
  const parsedBeCorp = parseSheetNumber(beCorpStr);
  const parsedCredit = parseSheetNumber(creditStr);
  const sheetDatePreview = isoToSheetDate(isoDate);
  const finalCategory = category === '__CUSTOM__' ? customCategory.trim() || 'Khác' : category;

  const handleAmountChange = (raw: string, setter: (val: string) => void) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setter('');
      return;
    }
    const isNegative = trimmed.startsWith('-');
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (!digits) {
      setter(isNegative ? '-' : '');
      return;
    }
    const num = parseInt(digits, 10);
    setter((isNegative ? '-' : '') + (Number.isFinite(num) ? num.toLocaleString('en-US') : ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!purchaseItem.trim() && parsedAmount === 0) {
      setErrorMsg('Vui lòng nhập nội dung hoặc số tiền.');
      return;
    }

    const parsedDate = parseDateString(sheetDatePreview);

    const updatedRecord: TransactionRecord = {
      ...record,
      sheetType,
      purchaseDate: sheetDatePreview,
      isoDate,
      monthKey: parsedDate.monthKey,
      category: finalCategory,
      purchaseItem: purchaseItem.trim() || 'Giao dịch',
      amount: parsedAmount,
      beCorp: sheetType === 'Expenses' ? parsedBeCorp : 0,
      credit: sheetType === 'Expenses' ? parsedCredit : 0,
      note: note.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      await onSave(updatedRecord);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi lưu thay đổi.');
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
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Chỉnh sửa giao dịch</span>
              {record.rowIndex && (
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  #{record.rowIndex}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật lại thông tin ngày, danh mục, số tiền trên Google Sheet
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Sheet type selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Loại giao dịch</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSheetType('Expenses');
                  if (!EXPENSE_CATEGORIES.includes(category as any)) setCategory('Ăn uống');
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  sheetType === 'Expenses'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chi tiêu (Expenses)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetType('Income');
                  setBeCorpStr('');
                  setCreditStr('');
                  if (!INCOME_CATEGORIES.includes(category as any)) setCategory('Lương Yes4All');
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  sheetType === 'Income'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Thu nhập (Income)
              </button>
            </div>
          </div>

          {/* Row 2: Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngày giao dịch</span>
              </label>
              <input
                type="date"
                required
                value={isoDate}
                onChange={(e) => setIsoDate(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-mono-tabular"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Google Sheet: {sheetDatePreview}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Danh mục</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Danh mục tùy biến...</option>
              </select>
            </div>
          </div>

          {category === '__CUSTOM__' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên danh mục tùy biến
              </label>
              <input
                type="text"
                placeholder="Nhập tên danh mục mới..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
            </div>
          )}

          {/* Row 3: Item description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Nội dung giao dịch</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Grab car, Cơm trưa, Siêu thị..."
              value={purchaseItem}
              onChange={(e) => setPurchaseItem(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </div>

          {/* Row 4: Amount, BE Corp, Credit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Số tiền (₫) *</span>
              </label>
              <MoneyCalculatorInput
                value={amountStr}
                onChange={(val) => setAmountStr(val)}
                placeholder="50,000"
                theme={sheetType === 'Expenses' ? 'rose' : 'emerald'}
                size="sm"
                required
                inputClassName="font-semibold text-slate-900 bg-slate-50"
              />
            </div>

            {sheetType === 'Expenses' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <span>BE Corp</span>
                  </label>
                  <MoneyCalculatorInput
                    value={beCorpStr}
                    onChange={(val) => setBeCorpStr(val)}
                    placeholder="Để trống nếu 0"
                    theme="amber"
                    size="sm"
                    inputClassName="text-amber-900 bg-amber-50/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-indigo-800 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Quẹt thẻ Credit</span>
                  </label>
                  <MoneyCalculatorInput
                    value={creditStr}
                    onChange={(val) => setCreditStr(val)}
                    placeholder="Để trống nếu 0"
                    theme="indigo"
                    size="sm"
                    inputClassName="text-indigo-900 bg-indigo-50/40"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <span className="text-[11px] text-slate-400 block pt-6">
                  Thu nhập sẽ tự động cộng vào tổng Income của tháng tương ứng.
                </span>
              </div>
            )}
          </div>

          {/* Row 5: Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú thêm (không bắt buộc)
            </label>
            <input
              type="text"
              placeholder="VD: Mua chung, hoàn tiền..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onDeleteRequest(record)}
              className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa giao dịch này</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

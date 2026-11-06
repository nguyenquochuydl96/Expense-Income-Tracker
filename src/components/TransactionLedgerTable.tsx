import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpDown,
  FilterX,
  Edit3,
  Trash2,
  UploadCloud,
  X,
  Zap,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TransactionRecord,
} from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { MultiCategoryPickerDropdown } from './MultiCategoryPickerDropdown';
import { usePrivacyMode } from '../utils/privacyService';

interface TransactionLedgerTableProps {
  records: TransactionRecord[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedCategories?: string[];
  onSelectCategories?: (cats: string[]) => void;
  onOpenAddModal: () => void;
  onEditTransaction?: (record: TransactionRecord) => void;
  onDeleteTransaction?: (record: TransactionRecord) => void;
  onPushPendingToSheet?: () => Promise<void>;
  isSyncing?: boolean;
  periodLabel?: string;
  isPrivate?: boolean;
}

type QuickLedgerFilter = 'all' | 'expenses' | 'income' | 'becorp' | 'credit' | 'savings';

export const TransactionLedgerTable: React.FC<TransactionLedgerTableProps> = React.memo(({
  records,
  selectedCategory,
  onSelectCategory,
  selectedCategories,
  onSelectCategories,
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
  onPushPendingToSheet,
  isSyncing,
  periodLabel,
  isPrivate: propIsPrivate,
}) => {
  const { isPrivate: hookIsPrivate } = usePrivacyMode();
  const _effectiveIsPrivate = propIsPrivate !== undefined ? propIsPrivate : hookIsPrivate;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickLedgerFilter>('all');
  const [filterBigExpense, setFilterBigExpense] = useState<boolean>(false);
  const [filterWeekendOnly, setFilterWeekendOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount_desc'>('newest');
  const [visibleLimit, setVisibleLimit] = useState<number>(80);

  const allCategories = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
    records.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [records]);

  const isAllCategoriesSelected = useMemo(() => {
    return (
      !selectedCategories ||
      selectedCategories.length === 0 ||
      selectedCategories.includes('ALL') ||
      (allCategories.length > 0 && selectedCategories.length >= allCategories.length)
    );
  }, [selectedCategories, allCategories]);

  const { categoryRecordCounts, categorySpentTotals } = useMemo(() => {
    const counts: Record<string, number> = {};
    const spents: Record<string, number> = {};
    records.forEach((r) => {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
        if (r.sheetType === 'Expenses') {
          spents[r.category] = (spents[r.category] || 0) + r.amount;
        }
      }
    });
    return { categoryRecordCounts: counts, categorySpentTotals: spents };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = records.filter((rec) => {
      if (!isAllCategoriesSelected && selectedCategories && selectedCategories.length > 0) {
        if (!selectedCategories.includes(rec.category)) return false;
      } else if (selectedCategory !== 'ALL' && rec.category !== selectedCategory) {
        return false;
      }
      if (quickFilter === 'expenses' && rec.sheetType !== 'Expenses') return false;
      if (quickFilter === 'income' && rec.sheetType !== 'Income') return false;
      if (quickFilter === 'becorp' && rec.beCorp === 0) return false;
      if (quickFilter === 'credit' && rec.credit === 0) return false;
      if (quickFilter === 'savings' && rec.category !== 'Tiết kiệm') return false;

      // Smart Quick Filters
      if (filterBigExpense && Math.abs(rec.amount) < 1000000) return false;

      if (filterWeekendOnly) {
        if (!rec.isoDate) return false;
        const d = new Date(rec.isoDate + 'T12:00:00');
        const day = d.getDay();
        if (day !== 0 && day !== 6) return false;
      }

      if (q) {
        const hay = `${rec.purchaseDate} ${rec.category} ${rec.purchaseItem} ${rec.note || ''} ${rec.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortOrder === 'amount_desc') {
        return Math.abs(b.amount) - Math.abs(a.amount);
      }
      const dateCmp = (a.isoDate || '').localeCompare(b.isoDate || '');
      if (dateCmp !== 0) {
        return sortOrder === 'newest' ? -dateCmp : dateCmp;
      }
      const idxA = a.rowIndex || (a.source === 'local_new' ? 999999 : 0);
      const idxB = b.rowIndex || (b.source === 'local_new' ? 999999 : 0);
      return sortOrder === 'newest' ? idxB - idxA : idxA - idxB;
    });
  }, [
    records,
    selectedCategory,
    selectedCategories,
    isAllCategoriesSelected,
    quickFilter,
    searchQuery,
    sortOrder,
    filterBigExpense,
    filterWeekendOnly,
  ]);

  const totals = useMemo(() => {
    let expenseSum = 0;
    let incomeSum = 0;
    let beCorp = 0;
    let credit = 0;
    for (const r of filteredRecords) {
      if (r.sheetType === 'Income') {
        incomeSum += r.amount;
      } else {
        expenseSum += r.amount;
        beCorp += r.beCorp;
        credit += r.credit;
      }
    }
    return { expenseSum, incomeSum, beCorp, credit };
  }, [filteredRecords]);

  const displayedRows = filteredRecords.slice(0, visibleLimit);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Sổ Cái Lịch Sử Giao Dịch
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hiển thị {filteredRecords.length} giao dịch{periodLabel ? ` (${periodLabel})` : ''}
              {quickFilter === 'income' ? (
                <>
                  {' '}· Tổng thu nhập:{' '}
                  <strong className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totals.incomeSum, true)}
                  </strong>
                </>
              ) : quickFilter === 'expenses' ? (
                <>
                  {' '}· Tổng chi tiêu:{' '}
                  <strong className="font-mono-tabular text-slate-900 dark:text-slate-200">
                    {formatCurrency(totals.expenseSum)}
                  </strong>
                  {' '}· Tổng BE Corp:{' '}
                  <strong className="font-mono-tabular text-amber-700 dark:text-amber-400">
                    {formatCurrency(totals.beCorp)}
                  </strong>
                  {' '}· Tổng Credit:{' '}
                  <strong className="font-mono-tabular text-indigo-700 dark:text-indigo-400">
                    {formatCurrency(totals.credit)}
                  </strong>
                </>
              ) : (
                <>
                  {' '}· Tổng chi:{' '}
                  <strong className="font-mono-tabular text-slate-900 dark:text-slate-200">
                    {formatCurrency(totals.expenseSum)}
                  </strong>
                  {totals.incomeSum > 0 && (
                    <>
                      {' '}· Thu:{' '}
                      <strong className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(totals.incomeSum, true)}
                      </strong>
                    </>
                  )}
                  {totals.beCorp > 0 && (
                    <>
                      {' '}· BE Corp:{' '}
                      <strong className="font-mono-tabular text-amber-700 dark:text-amber-400">
                        {formatCurrency(totals.beCorp)}
                      </strong>
                    </>
                  )}
                  {totals.credit > 0 && (
                    <>
                      {' '}· Credit:{' '}
                      <strong className="font-mono-tabular text-indigo-700 dark:text-indigo-400">
                        {formatCurrency(totals.credit)}
                      </strong>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm dòng giao dịch mới</span>
          </button>
        </div>

        {/* Pending Offline Transactions Alert */}
        {records.some((r) => r.source === 'local_new' && !r.syncedToSheet) && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>
                Có <strong>{records.filter((r) => r.source === 'local_new' && !r.syncedToSheet).length} giao dịch</strong> mới nhập đang lưu trên máy (Chờ đồng bộ lên Google Sheet).
              </span>
            </div>
            {onPushPendingToSheet && (
              <button
                type="button"
                onClick={onPushPendingToSheet}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : `Đồng bộ lên Google Sheet ngay`}</span>
              </button>
            )}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Interactive Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800/90 rounded-lg border border-slate-300/60 dark:border-slate-700/80 overflow-x-auto no-scrollbar max-w-full">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'income', label: 'Income' },
                { id: 'becorp', label: 'Có BE Corp' },
                { id: 'credit', label: 'Có Credit' },
                { id: 'savings', label: 'Tiết kiệm' },
              ] as { id: QuickLedgerFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQuickFilter(tab.id);
                  setVisibleLimit(80);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  quickFilter === tab.id
                    ? 'bg-white dark:bg-indigo-600 text-indigo-950 dark:text-white shadow-xs border border-slate-200/80 dark:border-indigo-500'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Category Select & Sort */}
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm món hàng, ngày, ghi chú..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(80);
                }}
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVisibleLimit(80);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {onSelectCategories ? (
              <MultiCategoryPickerDropdown
                allCategories={allCategories}
                selectedCategories={
                  selectedCategories && selectedCategories.length > 0
                    ? selectedCategories
                    : selectedCategory !== 'ALL'
                    ? [selectedCategory]
                    : allCategories
                }
                onChange={(cats) => {
                  onSelectCategories(cats);
                  if (cats.length === 1) {
                    onSelectCategory(cats[0]);
                  } else if (cats.length === allCategories.length || cats.length === 0) {
                    onSelectCategory('ALL');
                  } else {
                    onSelectCategory(cats[0]);
                  }
                  setVisibleLimit(80);
                }}
                categoryRecordCounts={categoryRecordCounts}
                categorySpentTotals={categorySpentTotals}
                totalRecordCount={records.length}
              />
            ) : (
              <select
                value={selectedCategory}
                onChange={(e) => {
                  onSelectCategory(e.target.value);
                  setVisibleLimit(80);
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500"
              >
                <option value="ALL">Tất cả danh mục</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) =>
                  prev === 'newest'
                    ? 'oldest'
                    : prev === 'oldest'
                    ? 'amount_desc'
                    : 'newest'
                )
              }
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>
                {sortOrder === 'newest'
                  ? 'Mới nhất'
                  : sortOrder === 'oldest'
                  ? 'Cũ nhất'
                  : 'Số tiền lớn nhất'}
              </span>
            </button>

            {((!isAllCategoriesSelected || selectedCategory !== 'ALL') || quickFilter !== 'all' || searchQuery || filterBigExpense || filterWeekendOnly) && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('ALL');
                  if (onSelectCategories) onSelectCategories(allCategories);
                  setQuickFilter('all');
                  setSearchQuery('');
                  setFilterBigExpense(false);
                  setFilterWeekendOnly(false);
                  setVisibleLimit(80);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Smart Quick Filter Chips (Lọc thông minh 1 chạm) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar max-w-full">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Lọc thông minh:</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setFilterBigExpense((prev) => !prev);
              setVisibleLimit(80);
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              filterBigExpense
                ? 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-600 font-bold shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 font-medium'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${filterBigExpense ? 'text-amber-600 dark:text-amber-400 fill-amber-500' : 'text-slate-400'}`} />
            <span>⚡ Món lớn (≥ 1M)</span>
            {filterBigExpense && (
              <span className="text-[10px] bg-amber-200/90 text-amber-950 dark:bg-amber-800 dark:text-amber-100 px-1.5 py-0.2 rounded-full font-bold">
                Bật
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterWeekendOnly((prev) => !prev);
              setVisibleLimit(80);
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              filterWeekendOnly
                ? 'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-600 font-bold shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 font-medium'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${filterWeekendOnly ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span>🏖️ Cuối tuần (T7 & CN)</span>
            {filterWeekendOnly && (
              <span className="text-[10px] bg-indigo-200/90 text-indigo-950 dark:bg-indigo-800 dark:text-indigo-100 px-1.5 py-0.2 rounded-full font-bold">
                Bật
              </span>
            )}
          </button>

          {(filterBigExpense || filterWeekendOnly) && (
            <button
              type="button"
              onClick={() => {
                setFilterBigExpense(false);
                setFilterWeekendOnly(false);
                setVisibleLimit(80);
              }}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline ml-1 cursor-pointer shrink-0"
            >
              Bỏ lọc thông minh
            </button>
          )}
        </div>
      </div>

      {/* ═══════ MOBILE CARD LIST VIEW (< 768px) ═══════ */}
      <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {displayedRows.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-500 dark:text-slate-400 text-xs">
            Không tìm thấy dòng giao dịch nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          displayedRows.map((rec) => {
            const isIncome = rec.sheetType === 'Income';
            return (
              <div
                key={rec.id}
                className="p-3.5 space-y-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all rounded-xl"
              >
                {/* Header: Date, Category badge, Sheet type */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryBadge
                      category={rec.category}
                      onClick={() =>
                        onSelectCategory(
                          selectedCategory === rec.category ? 'ALL' : rec.category
                        )
                      }
                      compact
                    />
                    <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                      {rec.purchaseDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isIncome && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                        Thu nhập
                      </span>
                    )}
                    {rec.source === 'local_new' && (
                      rec.syncedToSheet ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          ✓ Đã đồng bộ
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                          Chờ đồng bộ
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Main: Item name & prominent Amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 break-words flex-1">
                    {rec.purchaseItem}
                  </div>
                  <div
                    className={`text-sm font-extrabold font-mono-tabular text-right shrink-0 ${
                      isIncome
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : rec.amount < 0
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {formatNumberForSheet(rec.amount, true, false, isIncome)}
                  </div>
                </div>

                {/* Sub-row: BE Corp & Credit & Note */}
                {(rec.beCorp !== 0 || rec.credit !== 0 || rec.note) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    {rec.beCorp !== 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-mono-tabular font-semibold border border-amber-200/60 dark:border-amber-900/60">
                        Ví BE: {formatNumberForSheet(rec.beCorp, true)}
                      </span>
                    )}
                    {rec.credit !== 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-[11px] font-mono-tabular font-semibold border border-indigo-200/60 dark:border-indigo-900/60">
                        Credit: {formatNumberForSheet(rec.credit, true)}
                      </span>
                    )}
                    {rec.note && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        {rec.note}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer: Row index & Tap Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                  <span className="font-mono-tabular">
                    {rec.rowIndex ? `#${rec.rowIndex}` : 'Giao dịch mới'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {onEditTransaction && (
                      <button
                        type="button"
                        onClick={() => onEditTransaction(rec)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-sky-950/60 hover:text-sky-700 dark:hover:text-sky-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>Sửa</span>
                      </button>
                    )}
                    {onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(rec)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══════ DESKTOP DATA GRID (>= 768px) ═══════ */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <th className="py-2.5 px-4 w-28">Purchase Date</th>
              <th className="py-2.5 px-4 w-40">Category</th>
              <th className="py-2.5 px-4">Purchase Item</th>
              <th className="py-2.5 px-4 text-right w-36">Amount</th>
              <th className="py-2.5 px-4 text-right w-32 text-amber-800 dark:text-amber-400">BE Corp</th>
              <th className="py-2.5 px-4 text-right w-32 text-indigo-800 dark:text-indigo-400">Credit</th>
              <th className="py-2.5 px-4 w-36">Phân loại / Ghi chú</th>
              <th className="py-2.5 px-3 text-center w-20">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  Không tìm thấy dòng giao dịch nào khớp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              displayedRows.map((rec) => {
                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {rec.purchaseDate}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <CategoryBadge
                        category={rec.category}
                        onClick={() =>
                          onSelectCategory(
                            selectedCategory === rec.category ? 'ALL' : rec.category
                          )
                        }
                        compact
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {rec.purchaseItem}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                        rec.sheetType === 'Income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : rec.amount < 0
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {formatNumberForSheet(rec.amount, true, false, rec.sheetType === 'Income')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {rec.beCorp !== 0 ? formatNumberForSheet(rec.beCorp, true) : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                      {rec.credit !== 0 ? formatNumberForSheet(rec.credit, true) : ''}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <span>{rec.sheetType}</span>
                      {rec.rowIndex && (
                        <>
                          <span className="mx-1">·</span>
                          <span className="font-mono-tabular">#{rec.rowIndex}</span>
                        </>
                      )}
                      {rec.note && (
                        <>
                          <span className="mx-1">·</span>
                          <span className="text-slate-700 dark:text-slate-300">{rec.note}</span>
                        </>
                      )}
                      {rec.source === 'local_new' && (
                        <>
                          <span className="mx-1">·</span>
                          {rec.syncing ? (
                            <span className="text-teal-700 dark:text-teal-400 font-medium inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping"></span>
                              Đang đồng bộ...
                            </span>
                          ) : rec.syncedToSheet ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">✓ Đã đồng bộ</span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">Chờ đồng bộ</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {onEditTransaction && (
                          <button
                            type="button"
                            title="Chỉnh sửa giao dịch này"
                            onClick={() => onEditTransaction(rec)}
                            className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTransaction && (
                          <button
                            type="button"
                            title="Xóa giao dịch này"
                            onClick={() => onDeleteTransaction(rec)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Totals Footer */}
      {filteredRecords.length > visibleLimit && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>
            Đang hiển thị {displayedRows.length} / {filteredRecords.length} dòng
          </span>
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + 150)}
            className="px-4 py-1.5 font-semibold text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Xem thêm 150 dòng tiếp theo
          </button>
        </div>
      )}
    </section>
  );
});

TransactionLedgerTable.displayName = 'TransactionLedgerTable';

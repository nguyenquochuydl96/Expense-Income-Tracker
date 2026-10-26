import React, { useMemo, useState } from 'react';
import { Search, Plus, ArrowUpDown, FilterX } from 'lucide-react';
import {
  CATEGORY_COLORS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TransactionRecord,
} from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';

interface TransactionLedgerTableProps {
  records: TransactionRecord[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenAddModal: () => void;
}

type QuickLedgerFilter = 'all' | 'expenses' | 'income' | 'becorp' | 'credit' | 'savings';

export const TransactionLedgerTable: React.FC<TransactionLedgerTableProps> = ({
  records,
  selectedCategory,
  onSelectCategory,
  onOpenAddModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickLedgerFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount_desc'>('newest');
  const [visibleLimit, setVisibleLimit] = useState<number>(80);

  const allCategories = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
    records.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = records.filter((rec) => {
      if (selectedCategory !== 'ALL' && rec.category !== selectedCategory) {
        return false;
      }
      if (quickFilter === 'expenses' && rec.sheetType !== 'Expenses') return false;
      if (quickFilter === 'income' && rec.sheetType !== 'Income') return false;
      if (quickFilter === 'becorp' && rec.beCorp === 0) return false;
      if (quickFilter === 'credit' && rec.credit === 0) return false;
      if (quickFilter === 'savings' && rec.category !== 'Tiết kiệm') return false;

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
      const dateCmp = a.isoDate.localeCompare(b.isoDate);
      if (dateCmp !== 0) {
        return sortOrder === 'newest' ? -dateCmp : dateCmp;
      }
      const idxA = a.rowIndex || 0;
      const idxB = b.rowIndex || 0;
      return sortOrder === 'newest' ? idxB - idxA : idxA - idxB;
    });
  }, [records, selectedCategory, quickFilter, searchQuery, sortOrder]);

  const totals = useMemo(() => {
    let amount = 0;
    let beCorp = 0;
    let credit = 0;
    for (const r of filteredRecords) {
      amount += r.amount;
      beCorp += r.beCorp;
      credit += r.credit;
    }
    return { amount, beCorp, credit };
  }, [filteredRecords]);

  const displayedRows = filteredRecords.slice(0, visibleLimit);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Sổ Cái Lịch Sử Giao Dịch (Chuẩn 6 Cột Google Sheet)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hiển thị {filteredRecords.length} giao dịch · Tổng cột Amount:{' '}
              <strong className="font-mono-tabular text-slate-900">
                {formatCurrency(totals.amount)}
              </strong>{' '}
              · Tổng BE Corp:{' '}
              <strong className="font-mono-tabular text-amber-700">
                {formatCurrency(totals.beCorp)}
              </strong>{' '}
              · Tổng Credit:{' '}
              <strong className="font-mono-tabular text-indigo-700">
                {formatCurrency(totals.credit)}
              </strong>
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Interactive Segmented Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
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
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  quickFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => {
                onSelectCategory(e.target.value);
                setVisibleLimit(80);
              }}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="ALL">Tất cả danh mục</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

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
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {sortOrder === 'newest'
                  ? 'Mới nhất'
                  : sortOrder === 'oldest'
                  ? 'Cũ nhất (Theo Sheet)'
                  : 'Số tiền lớn nhất'}
              </span>
            </button>

            {(selectedCategory !== 'ALL' || quickFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('ALL');
                  setQuickFilter('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High-Density Data Grid matching exact Google Sheet Columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <th className="py-2.5 px-4 w-28">Purchase Date</th>
              <th className="py-2.5 px-4 w-40">Category</th>
              <th className="py-2.5 px-4">Purchase Item</th>
              <th className="py-2.5 px-4 text-right w-36">Amount</th>
              <th className="py-2.5 px-4 text-right w-32 text-amber-800">BE Corp</th>
              <th className="py-2.5 px-4 text-right w-32 text-indigo-800">Credit</th>
              <th className="py-2.5 px-4 w-36">Bảng / Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  Không tìm thấy dòng giao dịch nào khớp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              displayedRows.map((rec) => {
                const catColor = CATEGORY_COLORS[rec.category] || '#64748B';
                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/90 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {rec.purchaseDate}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectCategory(
                            selectedCategory === rec.category ? 'ALL' : rec.category
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-slate-800 hover:text-teal-700 font-medium text-left"
                      >
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                        <span>{rec.category}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-medium">
                      {rec.purchaseItem}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                        rec.sheetType === 'Income'
                          ? 'text-emerald-700'
                          : rec.amount < 0
                          ? 'text-teal-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {rec.sheetType === 'Income' ? '+' : ''}
                      {formatNumberForSheet(rec.amount, true)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular text-amber-700 whitespace-nowrap">
                      {rec.beCorp !== 0 ? formatNumberForSheet(rec.beCorp, true) : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular text-indigo-700 whitespace-nowrap">
                      {rec.credit !== 0 ? formatNumberForSheet(rec.credit, true) : ''}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
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
                          <span className="text-slate-700">{rec.note}</span>
                        </>
                      )}
                      {rec.source === 'local_new' && !rec.syncedToSheet && (
                        <>
                          <span className="mx-1">·</span>
                          <span className="text-amber-700">Chờ đẩy Sheet</span>
                        </>
                      )}
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>
            Đang hiển thị {displayedRows.length} / {filteredRecords.length} dòng
          </span>
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + 150)}
            className="px-4 py-1.5 font-semibold text-teal-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Xem thêm 150 dòng tiếp theo
          </button>
        </div>
      )}
    </section>
  );
};

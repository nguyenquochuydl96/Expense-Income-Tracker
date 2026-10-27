import React, { useMemo } from 'react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { CategoryBadge } from '../utils/categoryIcons';
import { ArrowRight, Plus } from 'lucide-react';

interface DashboardDualTablesProps {
  records: TransactionRecord[];
  allRecords: TransactionRecord[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenAddModal: () => void;
  onViewFullLedger: () => void;
}

export const DashboardDualTables: React.FC<DashboardDualTablesProps> = ({
  records,
  allRecords,
  selectedCategory,
  onSelectCategory,
  onOpenAddModal,
  onViewFullLedger,
}) => {
  // 1. LEFT TABLE: Category Summary by Cycle / Type (Matching AR Aging Summary in reference image)
  const categorySummaryRows = useMemo(() => {
    const expenseRecords = records.filter((r) => r.sheetType === 'Expenses');
    const map = new Map<
      string,
      {
        category: string;
        living: number;
        savings: number;
        beCorp: number;
        credit: number;
        total: number;
        count: number;
      }
    >();

    for (const r of expenseRecords) {
      const existing = map.get(r.category) || {
        category: r.category,
        living: 0,
        savings: 0,
        beCorp: 0,
        credit: 0,
        total: 0,
        count: 0,
      };

      existing.total += r.amount;
      existing.count += 1;
      existing.beCorp += r.beCorp;
      existing.credit += r.credit;

      if (r.category === 'Tiết kiệm') {
        existing.savings += r.amount;
      } else {
        existing.living += r.amount;
      }

      map.set(r.category, existing);
    }

    return Array.from(map.values())
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [records]);

  // 2. RIGHT TABLE: Recent Unpaid / Incurred Transactions (Matching Unpaid Invoices in reference image)
  const recentTransactions = useMemo(() => {
    return [...records]
      .filter((r) => r.sheetType === 'Expenses')
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
      .slice(0, 6);
  }, [records]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ═══════ LEFT TABLE: CATEGORY AGING / SUMMARY (Matching AR Aging Summary) ═══════ */}
      <section className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm overflow-hidden flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                Tổng hợp chi tiêu theo phân loại
              </h2>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <th className="py-2 pr-3">Danh mục</th>
                  <th className="py-2 px-2 text-right">Tiền mặt/Ví</th>
                  <th className="py-2 px-2 text-right">BE Corp</th>
                  <th className="py-2 px-2 text-right">Credit</th>
                  <th className="py-2 pl-3 text-right">Tổng chi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categorySummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có dữ liệu chi tiêu trong kỳ
                    </td>
                  </tr>
                ) : (
                  categorySummaryRows.map((row, idx) => {
                    const isSelected = selectedCategory === row.category;
                    const cashAmount = row.total - row.beCorp - row.credit;

                    return (
                      <tr
                        key={row.category}
                        onClick={() =>
                          onSelectCategory(selectedCategory === row.category ? 'ALL' : row.category)
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50 font-medium' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Category Name */}
                        <td className="py-2.5 pr-3 text-slate-800 font-medium whitespace-nowrap">
                          <span className="truncate max-w-[120px] sm:max-w-[140px] block" title={row.category}>
                            {row.category}
                          </span>
                        </td>

                        {/* Cash / Living with soft pastel tint */}
                        <td className="py-2 px-2 text-right font-mono-tabular">
                          {cashAmount > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                              {formatNumberForSheet(cashAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* BE Corp with soft green tint (matching reference table green cell) */}
                        <td className="py-2 px-2 text-right font-mono-tabular">
                          {row.beCorp > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-medium">
                              {formatNumberForSheet(row.beCorp)}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Credit with soft cyan/blue tint (matching reference table cyan cell) */}
                        <td className="py-2 px-2 text-right font-mono-tabular">
                          {row.credit > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-cyan-100 text-cyan-800 font-medium">
                              {formatNumberForSheet(row.credit)}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Total Amount Due with warm pastel peach tint (matching reference table peach column) */}
                        <td className="py-2 pl-3 text-right font-mono-tabular font-bold whitespace-nowrap">
                          <div className="bg-rose-50/80 text-rose-900 px-2 py-0.5 rounded inline-block">
                            {formatNumberForSheet(row.total)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono-tabular">
            Top 6 danh mục lớn nhất
          </span>
          <button
            type="button"
            onClick={onViewFullLedger}
            className="text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1"
          >
            <span>Xem chi tiết sổ cái</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ═══════ RIGHT TABLE: RECENT TRANSACTIONS (Matching Unpaid Invoices) ═══════ */}
      <section className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm overflow-hidden flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                Giao dịch chi tiêu gần nhất
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi mới</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <th className="py-2 pr-2">Món hàng</th>
                  <th className="py-2 px-2">Danh mục</th>
                  <th className="py-2 px-2">Ngày</th>
                  <th className="py-2 pl-3 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Không có giao dịch nào
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((rec) => {
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        {/* Item Name */}
                        <td className="py-2.5 pr-2 font-medium text-slate-900 whitespace-nowrap">
                          <span className="truncate max-w-[130px] sm:max-w-[160px] block" title={rec.purchaseItem}>
                            {rec.purchaseItem}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <CategoryBadge category={rec.category} compact />
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-2 font-mono-tabular text-slate-500 whitespace-nowrap">
                          {rec.purchaseDate}
                        </td>

                        {/* Amount with peach tint (matching reference image) */}
                        <td className="py-2.5 pl-3 text-right font-mono-tabular font-bold whitespace-nowrap">
                          <div className="bg-rose-50/80 text-rose-900 px-2 py-0.5 rounded inline-block">
                            {formatNumberForSheet(rec.amount)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono-tabular">
            Hiển thị 6 giao dịch mới nhất
          </span>
          <button
            type="button"
            onClick={onViewFullLedger}
            className="text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1"
          >
            <span>Toàn bộ sổ giao dịch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};

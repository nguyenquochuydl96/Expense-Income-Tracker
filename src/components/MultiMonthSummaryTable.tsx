import React, { useMemo, useState } from 'react';
import { TransactionRecord } from '../types/finance';
import { formatCurrency, formatNumberForSheet } from '../utils/csvParser';
import { getBillingCycleRange } from '../utils/cycleUtils';
import { ChevronRight, Calendar, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';

interface MultiMonthSummaryTableProps {
  allRecords: TransactionRecord[];
  availableMonths: string[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  monthlyBaseIncome?: number;
  beCorpStartDay?: number;
  beCorpEndDay?: number;
  creditStartDay?: number;
  creditEndDay?: number;
}

export const MultiMonthSummaryTable: React.FC<MultiMonthSummaryTableProps> = ({
  allRecords,
  availableMonths,
  selectedMonth,
  onSelectMonth,
  monthlyBaseIncome,
  beCorpStartDay = 26,
  beCorpEndDay = 25,
  creditStartDay = 25,
  creditEndDay = 24,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Chronological order (T4 -> T10)
  const sortedMonths = useMemo(() => {
    return [...availableMonths].sort((a, b) => a.localeCompare(b));
  }, [availableMonths]);

  // Compute stats for each month
  const monthlyData = useMemo(() => {
    return sortedMonths.map((mKey) => {
      const [y, m] = mKey.split('-');
      const label = `T${parseInt(m, 10)}/${y.slice(2)}`;

      const mRecords = allRecords.filter((r) => r.monthKey === mKey);

      // Income strictly from Sheet Income records for this specific month
      const sheetIncome = mRecords
        .filter((r) => r.sheetType === 'Income')
        .reduce((sum, r) => sum + r.amount, 0);
      const income = sheetIncome;

      // Expenses
      const expenseRecords = mRecords.filter((r) => r.sheetType === 'Expenses');
      let totalExpense = 0;
      let livingExpense = 0;
      let savingsExpense = 0;

      for (const r of expenseRecords) {
        totalExpense += r.amount;
        if (r.category === 'Tiết kiệm') {
          savingsExpense += r.amount;
        } else {
          livingExpense += r.amount;
        }
      }

      const remaining = income - totalExpense;
      const pctUsed = income > 0 ? (totalExpense / income) * 100 : 0;

      // Cycle-aware BE Corp & Credit
      const beRange = getBillingCycleRange(mKey, beCorpStartDay, beCorpEndDay);
      const creditRange = getBillingCycleRange(mKey, creditStartDay, creditEndDay);

      const beCorpTotal = allRecords
        .filter(
          (r) =>
            r.sheetType === 'Expenses' &&
            r.beCorp !== 0 &&
            r.isoDate >= beRange.startDate &&
            r.isoDate <= beRange.endDate
        )
        .reduce((sum, r) => sum + r.beCorp, 0);

      const creditTotal = allRecords
        .filter(
          (r) =>
            r.sheetType === 'Expenses' &&
            r.credit !== 0 &&
            r.isoDate >= creditRange.startDate &&
            r.isoDate <= creditRange.endDate
        )
        .reduce((sum, r) => sum + r.credit, 0);

      return {
        mKey,
        label,
        budget: income,
        livingExpense,
        savingsExpense,
        totalExpense,
        remaining,
        pctUsed,
        beCorpTotal,
        creditTotal,
        beRangeLabel: beRange.displayLabel,
        creditRangeLabel: creditRange.displayLabel,
      };
    });
  }, [
    sortedMonths,
    allRecords,
    beCorpStartDay,
    beCorpEndDay,
    creditStartDay,
    creditEndDay,
  ]);

  // Aggregate stats (Total & Average across all months)
  const totals = useMemo(() => {
    const count = Math.max(1, monthlyData.length);
    const sumBudget = monthlyData.reduce((s, m) => s + m.budget, 0);
    const sumLiving = monthlyData.reduce((s, m) => s + m.livingExpense, 0);
    const sumSavings = monthlyData.reduce((s, m) => s + m.savingsExpense, 0);
    const sumExpense = monthlyData.reduce((s, m) => s + m.totalExpense, 0);
    const sumRemaining = monthlyData.reduce((s, m) => s + m.remaining, 0);
    const sumBeCorp = monthlyData.reduce((s, m) => s + m.beCorpTotal, 0);
    const sumCredit = monthlyData.reduce((s, m) => s + m.creditTotal, 0);

    return {
      total: {
        budget: sumBudget,
        living: sumLiving,
        savings: sumSavings,
        expense: sumExpense,
        remaining: sumRemaining,
        beCorp: sumBeCorp,
        credit: sumCredit,
      },
      avg: {
        budget: sumBudget / count,
        living: sumLiving / count,
        savings: sumSavings / count,
        expense: sumExpense / count,
        remaining: sumRemaining / count,
        beCorp: sumBeCorp / count,
        credit: sumCredit / count,
      },
    };
  }, [monthlyData]);

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <span>Bảng tổng hợp ngân sách đa tháng (Multi-Month Summary)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {monthlyData.length} tháng
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Đối chiếu đồng thời Thu nhập (Sheet Income), Chi tiêu &amp; Remaining qua tất cả các tháng · Nhấp vào cột tháng để lọc Dashboard
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white"
        >
          {isExpanded ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Thu gọn</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Mở rộng ({monthlyData.length} tháng)</span>
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                <th className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10 w-44 shadow-xs">
                  Chỉ số tài chính
                </th>
                {monthlyData.map((m) => {
                  const isCurrent = selectedMonth === m.mKey;
                  return (
                    <th
                      key={m.mKey}
                      onClick={() => onSelectMonth(m.mKey)}
                      className={`py-2.5 px-3 text-right cursor-pointer transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-sky-100/90 text-sky-900 font-bold border-b-2 border-sky-600'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                      title={`Xem chi tiết ${m.label}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{m.label}</span>
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-right bg-slate-100 text-slate-800 font-bold border-l border-slate-200">
                  Trung bình
                </th>
                <th className="py-2.5 px-4 text-right bg-slate-100/80 text-slate-900 font-bold">
                  Tổng cộng
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs font-mono-tabular">
              {/* Row 1: Thu nhập (Sheet Income) */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2.5 px-4 font-sans font-medium text-emerald-900 sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                  Thu nhập (Sheet Income)
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2.5 px-3 text-right ${
                      selectedMonth === m.mKey ? 'bg-sky-50/50 font-semibold text-emerald-800' : 'text-slate-700'
                    }`}
                  >
                    {formatNumberForSheet(m.budget)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right bg-slate-50 font-semibold text-slate-800 border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.budget)}
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-50 font-bold text-emerald-800">
                  {formatNumberForSheet(totals.total.budget)}
                </td>
              </tr>

              {/* Row 2: Chi sinh hoạt */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-4 font-sans text-slate-600 sticky left-0 bg-white z-10 whitespace-nowrap pl-7 text-[11px] shadow-xs">
                  • Chi sinh hoạt
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-slate-600 ${
                      selectedMonth === m.mKey ? 'bg-sky-50/30 font-medium' : ''
                    }`}
                  >
                    {formatNumberForSheet(m.livingExpense)}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 text-slate-600 border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.living)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 text-slate-700">
                  {formatNumberForSheet(totals.total.living)}
                </td>
              </tr>

              {/* Row 3: Tiết kiệm */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-4 font-sans text-slate-600 sticky left-0 bg-white z-10 whitespace-nowrap pl-7 text-[11px] shadow-xs">
                  • Tiết kiệm / Đầu tư
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-blue-700 ${
                      selectedMonth === m.mKey ? 'bg-sky-50/30 font-medium' : ''
                    }`}
                  >
                    {m.savingsExpense > 0 ? formatNumberForSheet(m.savingsExpense) : '—'}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 text-blue-700 border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.savings)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 text-blue-800 font-medium">
                  {formatNumberForSheet(totals.total.savings)}
                </td>
              </tr>

              {/* Row 4: Tổng chi tiêu */}
              <tr className="bg-slate-50/40 hover:bg-slate-50 transition-colors font-semibold">
                <td className="py-2.5 px-4 font-sans font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 whitespace-nowrap shadow-xs">
                  Tổng chi tiêu
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2.5 px-3 text-right text-rose-700 font-bold ${
                      selectedMonth === m.mKey ? 'bg-sky-50 font-extrabold' : ''
                    }`}
                  >
                    {formatNumberForSheet(m.totalExpense)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right bg-slate-100 text-rose-700 font-bold border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.expense)}
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-100 text-rose-800 font-extrabold">
                  {formatNumberForSheet(totals.total.expense)}
                </td>
              </tr>

              {/* Row 5: Còn lại / Remaining (Highlighted like Sheet Summary) */}
              <tr className="hover:bg-slate-50/80 transition-colors font-bold">
                <td className="py-2.5 px-4 font-sans font-extrabold text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                  Còn lại (Remaining)
                </td>
                {monthlyData.map((m) => {
                  const isPositive = m.remaining >= 0;
                  return (
                    <td
                      key={m.mKey}
                      className={`py-2.5 px-3 text-right ${
                        selectedMonth === m.mKey ? 'bg-sky-50' : ''
                      }`}
                    >
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                            : 'bg-rose-50 text-rose-800 border border-rose-200/60'
                        }`}
                      >
                        {formatCurrency(m.remaining, true)}
                      </span>
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right bg-slate-50 border-l border-slate-200">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      totals.avg.remaining >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {formatCurrency(totals.avg.remaining, true)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right bg-slate-50">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-extrabold ${
                      totals.total.remaining >= 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {formatCurrency(totals.total.remaining, true)}
                  </span>
                </td>
              </tr>

              {/* Row 6: Tỷ lệ chi / Thu nhập */}
              <tr className="hover:bg-slate-50/80 transition-colors text-[11px]">
                <td className="py-2 px-4 font-sans text-slate-500 sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                  Tỷ lệ chi / Thu nhập
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right ${
                      selectedMonth === m.mKey ? 'bg-sky-50/30' : ''
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        m.pctUsed > 100
                          ? 'text-rose-700'
                          : m.pctUsed > 80
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {m.pctUsed.toFixed(0)}%
                    </span>
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 font-semibold text-slate-700 border-l border-slate-200">
                  {((totals.avg.expense / totals.avg.budget) * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 font-bold text-slate-800">
                  {((totals.total.expense / totals.total.budget) * 100).toFixed(0)}%
                </td>
              </tr>

              {/* Row 7: BE Corp Cycle */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-4 font-sans text-amber-800 font-medium sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                  Ví BE Corp (Chu kỳ 26–25)
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-amber-800 ${
                      selectedMonth === m.mKey ? 'bg-sky-50/30 font-semibold' : ''
                    }`}
                    title={`Chu kỳ ${m.beRangeLabel}`}
                  >
                    {m.beCorpTotal > 0 ? (
                      <span className="bg-amber-50 px-1.5 py-0.5 rounded text-[11px] text-amber-900 border border-amber-200/50">
                        {formatNumberForSheet(m.beCorpTotal)}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 text-amber-800 font-semibold border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.beCorp)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 text-amber-900 font-bold">
                  {formatNumberForSheet(totals.total.beCorp)}
                </td>
              </tr>

              {/* Row 8: Credit Card Statement Cycle */}
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-4 font-sans text-indigo-800 font-medium sticky left-0 bg-white z-10 whitespace-nowrap shadow-xs">
                  Thẻ Credit (Sao kê 25–24)
                </td>
                {monthlyData.map((m) => (
                  <td
                    key={m.mKey}
                    className={`py-2 px-3 text-right text-indigo-800 ${
                      selectedMonth === m.mKey ? 'bg-sky-50/30 font-semibold' : ''
                    }`}
                    title={`Sao kê ${m.creditRangeLabel}`}
                  >
                    {m.creditTotal > 0 ? (
                      <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] text-indigo-900 border border-indigo-200/50">
                        {formatNumberForSheet(m.creditTotal)}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                ))}
                <td className="py-2 px-3 text-right bg-slate-50 text-indigo-800 font-semibold border-l border-slate-200">
                  {formatNumberForSheet(totals.avg.credit)}
                </td>
                <td className="py-2 px-4 text-right bg-slate-50 text-indigo-900 font-bold">
                  {formatNumberForSheet(totals.total.credit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

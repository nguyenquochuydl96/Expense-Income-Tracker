import React, { useMemo, useState } from 'react';
import {
  Calculator,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  FileSpreadsheet,
  ArrowUpRight,
} from 'lucide-react';
import {
  CheckTienSheetData,
  RealWorldAccount,
  TransactionRecord,
} from '../types/finance';
import {
  formatCurrency,
  formatNumberForSheet,
  isoToSheetDate,
  parseSheetNumber,
} from '../utils/csvParser';
import { NewTransactionPayload } from './AddTransactionModal';

interface ReconcileCheckTienViewProps {
  allRecords: TransactionRecord[];
  selectedMonth: string;
  checkTienData: CheckTienSheetData | null;
  isSheetConnected: boolean;
  onOpenAddWithPreset: (preset: Partial<NewTransactionPayload>) => void;
  onNavigateToSync: () => void;
  accounts: RealWorldAccount[];
  onUpdateAccounts: React.Dispatch<React.SetStateAction<RealWorldAccount[]>>;
  openingOrBaseIncome: number;
  onUpdateOpeningOrBaseIncome: (val: number) => void;
}

export const ReconcileCheckTienView: React.FC<ReconcileCheckTienViewProps> = ({
  allRecords,
  selectedMonth,
  checkTienData,
  isSheetConnected,
  onOpenAddWithPreset,
  onNavigateToSync,
  accounts,
  onUpdateAccounts,
  openingOrBaseIncome,
  onUpdateOpeningOrBaseIncome,
}) => {
  // Cycle filter state for BE Corp and Credit
  const [beStartDate, setBeStartDate] = useState<string>('2026-10-01');
  const [beEndDate, setBeEndDate] = useState<string>('2026-10-31');
  const [creditStartDate, setCreditStartDate] = useState<string>('2026-09-20');
  const [creditEndDate, setCreditEndDate] = useState<string>('2026-10-25');

  // Reconcile calculation options
  const [reconcilePeriodMode, setReconcilePeriodMode] = useState<'selected_month' | 'custom_range'>('selected_month');
  const [reconcileStart, setReconcileStart] = useState<string>('2026-10-01');
  const [reconcileEnd, setReconcileEnd] = useState<string>('2026-10-31');
  const [addBackUnpaidCredit, setAddBackUnpaidCredit] = useState<boolean>(true);
  const [addBackBeCorp, setAddBackBeCorp] = useState<boolean>(true);
  const [showFormulasInMirror, setShowFormulasInMirror] = useState<boolean>(false);

  // New account input
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccOwner, setNewAccOwner] = useState<'Heo' | 'Mèo' | 'Chung'>('Chung');

  // Quick cycle presets
  const applyBePreset = (preset: 'oct_full' | 'cycle_26_25' | 'sep_full') => {
    if (preset === 'oct_full') {
      setBeStartDate('2026-10-01');
      setBeEndDate('2026-10-31');
    } else if (preset === 'cycle_26_25') {
      setBeStartDate('2026-09-26');
      setBeEndDate('2026-10-25');
    } else {
      setBeStartDate('2026-09-01');
      setBeEndDate('2026-09-30');
    }
  };

  const applyCreditPreset = (preset: 'stmt_20_19' | 'stmt_15_14' | 'oct_full') => {
    if (preset === 'stmt_20_19') {
      setCreditStartDate('2026-09-20');
      setCreditEndDate('2026-10-19');
    } else if (preset === 'stmt_15_14') {
      setCreditStartDate('2026-09-15');
      setCreditEndDate('2026-10-14');
    } else {
      setCreditStartDate('2026-10-01');
      setCreditEndDate('2026-10-31');
    }
  };

  // 1. BE Corp Cycle Analysis
  const beCorpCycleStats = useMemo(() => {
    const items = allRecords.filter(
      (r) =>
        r.sheetType === 'Expenses' &&
        r.beCorp !== 0 &&
        r.isoDate >= beStartDate &&
        r.isoDate <= beEndDate
    );
    const totalBeCorp = items.reduce((sum, r) => sum + r.beCorp, 0);
    const totalPersonalAmount = items.reduce((sum, r) => sum + r.amount, 0);
    const diffPaidForOthers = totalBeCorp - totalPersonalAmount;
    return { items, totalBeCorp, totalPersonalAmount, diffPaidForOthers };
  }, [allRecords, beStartDate, beEndDate]);

  // 2. Credit Cycle Analysis
  const creditCycleStats = useMemo(() => {
    const items = allRecords.filter(
      (r) =>
        r.sheetType === 'Expenses' &&
        r.credit !== 0 &&
        r.isoDate >= creditStartDate &&
        r.isoDate <= creditEndDate
    );
    const totalCredit = items.reduce((sum, r) => sum + r.credit, 0);
    const totalPersonalAmount = items.reduce((sum, r) => sum + r.amount, 0);
    const diffPaidForOthers = totalCredit - totalPersonalAmount;
    return { items, totalCredit, totalPersonalAmount, diffPaidForOthers };
  }, [allRecords, creditStartDate, creditEndDate]);

  // 3. Reconcile ("Check tiền") calculation
  const reconcileStats = useMemo(() => {
    const filtered = allRecords.filter((r) => {
      if (reconcilePeriodMode === 'selected_month') {
        return selectedMonth === 'ALL' ? true : r.monthKey === selectedMonth;
      }
      return r.isoDate >= reconcileStart && r.isoDate <= reconcileEnd;
    });

    const sheetIncome = filtered
      .filter((r) => r.sheetType === 'Income')
      .reduce((sum, r) => sum + r.amount, 0);

    const effectiveAvailableFunds = sheetIncome + openingOrBaseIncome;

    const totalRecordedExpense = filtered
      .filter((r) => r.sheetType === 'Expenses')
      .reduce((sum, r) => sum + r.amount, 0);

    // Portion of personal expense (`amount`) that was paid via Credit or BE Corp (so cash/bank wasn't deducted yet)
    const personalPaidViaCredit = filtered
      .filter((r) => r.sheetType === 'Expenses' && r.credit > 0)
      .reduce((sum, r) => sum + Math.min(r.amount, r.credit), 0);

    const personalPaidViaBeCorp = filtered
      .filter((r) => r.sheetType === 'Expenses' && r.beCorp > 0)
      .reduce((sum, r) => sum + Math.min(r.amount, r.beCorp), 0);

    let theoreticalRemainingCash = effectiveAvailableFunds - totalRecordedExpense;
    if (addBackUnpaidCredit) {
      theoreticalRemainingCash += personalPaidViaCredit;
    }
    if (addBackBeCorp) {
      theoreticalRemainingCash += personalPaidViaBeCorp;
    }

    const actualRealWorldTotal = accounts
      .filter((a) => a.includedInReconcile)
      .reduce((sum, a) => sum + a.balance, 0);

    // Discrepancy = Actual money on hand - Theoretical book balance
    // If negative (< 0): Actual money is LESS than book says -> You spent money in real life and forgot to note it in the app!
    const discrepancy = actualRealWorldTotal - theoreticalRemainingCash;

    return {
      sheetIncome,
      effectiveAvailableFunds,
      totalRecordedExpense,
      personalPaidViaCredit,
      personalPaidViaBeCorp,
      theoreticalRemainingCash,
      actualRealWorldTotal,
      discrepancy,
      txCount: filtered.length,
    };
  }, [
    allRecords,
    reconcilePeriodMode,
    selectedMonth,
    reconcileStart,
    reconcileEnd,
    openingOrBaseIncome,
    addBackUnpaidCredit,
    addBackBeCorp,
    accounts,
  ]);

  const handleAccountBalanceChange = (id: string, rawVal: string) => {
    const parsed = parseSheetNumber(rawVal);
    onUpdateAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, balance: parsed } : a))
    );
  };

  const handleToggleAccount = (id: string) => {
    onUpdateAccounts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, includedInReconcile: !a.includedInReconcile } : a
      )
    );
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    onUpdateAccounts((prev) => [
      ...prev,
      {
        id: `acc-${Date.now()}`,
        name: newAccName.trim(),
        owner: newAccOwner,
        type: 'bank',
        balance: 0,
        includedInReconcile: true,
      },
    ]);
    setNewAccName('');
  };

  const handleRemoveAccount = (id: string) => {
    onUpdateAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRecordDiscrepancy = () => {
    const missingAmount = Math.abs(Math.round(reconcileStats.discrepancy));
    if (missingAmount === 0) return;

    const todayIso = '2026-10-25';
    if (reconcileStats.discrepancy < 0) {
      // Missing real-world money -> Forgotten expense
      onOpenAddWithPreset({
        sheetType: 'Expenses',
        isoDate: todayIso,
        purchaseDate: isoToSheetDate(todayIso),
        category: 'Khác',
        purchaseItem: 'Thất lạc chưa nhớ / Lệch tiền (Check tiền)',
        amount: missingAmount,
      });
    } else {
      // Extra real-world money -> Negative expense adjustment or unrecorded refund
      onOpenAddWithPreset({
        sheetType: 'Expenses',
        isoDate: todayIso,
        purchaseDate: isoToSheetDate(todayIso),
        category: 'Khác',
        purchaseItem: 'Bù lệch tiền dư (Check tiền)',
        amount: -missingAmount,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* PART 1: RECONCILE ENGINE ("CHECK TIỀN" - ĐỐI SOÁT TIỀN THỰC TẾ VS SỔ SÁCH) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Check Tiền — Đối Soát Số Dư Thực Tế &amp; Phát Hiện Quên Ghi Chép
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tổng hợp toàn bộ tiền đang có ở ngoài đời thực (Ngân hàng, Tiền mặt, Ví) so với thống kê chi tiêu để kiểm tra xem có bị lệch tiền do quên note vào app hay không.
            </p>
          </div>

          {/* Period selector for Reconcile */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setReconcilePeriodMode('selected_month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  reconcilePeriodMode === 'selected_month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo tháng đang chọn ({selectedMonth === 'ALL' ? 'Tất cả' : selectedMonth})
              </button>
              <button
                type="button"
                onClick={() => setReconcilePeriodMode('custom_range')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  reconcilePeriodMode === 'custom_range'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tùy chỉnh từ ngày – đến ngày
              </button>
            </div>
            {reconcilePeriodMode === 'custom_range' && (
              <div className="flex items-center gap-1.5 text-xs font-mono-tabular">
                <input
                  type="date"
                  value={reconcileStart}
                  onChange={(e) => setReconcileStart(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded-md"
                />
                <span>→</span>
                <input
                  type="date"
                  value={reconcileEnd}
                  onChange={(e) => setReconcileEnd(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded-md"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Reconciliation Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Column 1: Book Balance Calculation */}
          <div className="lg:col-span-4 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
                01. Số dư sổ sách lý thuyết (Trên App/Sheet)
              </h3>

              <div className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">
                    Quỹ đầu kỳ / Thu nhập tiền mặt &amp; ngân hàng đầu tháng (₫):
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberForSheet(openingOrBaseIncome, true)}
                    onChange={(e) =>
                      onUpdateOpeningOrBaseIncome(parseSheetNumber(e.target.value))
                    }
                    className="w-full px-3 py-2 text-sm font-mono-tabular font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>

                {reconcileStats.sheetIncome > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span>+ Thu nhập từ bảng Income:</span>
                    <span className="font-mono-tabular font-semibold text-emerald-700">
                      +{formatCurrency(reconcileStats.sheetIncome)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-700 pt-2 border-t border-slate-200/80">
                  <span>− Tổng chi tiêu đã ghi ({reconcileStats.txCount} dòng):</span>
                  <span className="font-mono-tabular font-semibold text-rose-700">
                    −{formatCurrency(reconcileStats.totalRecordedExpense)}
                  </span>
                </div>

                {/* Credit & BE Corp non-cash adjustments */}
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <label className="flex items-start justify-between gap-2 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={addBackUnpaidCredit}
                        onChange={(e) => setAddBackUnpaidCredit(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>+ Cộng lại khoản quẹt Credit (chưa trừ tiền mặt):</span>
                    </span>
                    <span className="font-mono-tabular text-indigo-700 font-medium shrink-0">
                      +{formatCurrency(reconcileStats.personalPaidViaCredit)}
                    </span>
                  </label>

                  <label className="flex items-start justify-between gap-2 cursor-pointer">
                    <span className="flex items-center gap-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={addBackBeCorp}
                        onChange={(e) => setAddBackBeCorp(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>+ Cộng lại khoản dùng ví BE Corp:</span>
                    </span>
                    <span className="font-mono-tabular text-amber-700 font-medium shrink-0">
                      +{formatCurrency(reconcileStats.personalPaidViaBeCorp)}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                = Tiền lý thuyết phải còn:
              </span>
              <span className="text-base font-bold font-mono-tabular text-slate-900">
                {formatCurrency(reconcileStats.theoreticalRemainingCash)}
              </span>
            </div>
          </div>

          {/* Column 2: Actual Real-World Accounts */}
          <div className="lg:col-span-5 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  02. Tiền thực tế đang có ngoài đời (Ví / Ngân hàng)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Tự động lưu số dư trên trình duyệt
                </span>
              </div>

              <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                      acc.includedInReconcile
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={acc.includedInReconcile}
                        onChange={() => handleToggleAccount(acc.id)}
                        className="rounded border-slate-300 text-teal-600"
                        title="Tính vào tổng đối soát"
                      />
                      <div className="truncate">
                        <div className="text-xs font-medium text-slate-900 truncate">
                          {acc.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {acc.owner}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={acc.balance === 0 ? '' : formatNumberForSheet(acc.balance)}
                        placeholder="0"
                        onChange={(e) =>
                          handleAccountBalanceChange(acc.id, e.target.value)
                        }
                        className="w-32 px-2.5 py-1.5 text-right text-xs font-mono-tabular font-semibold border border-slate-300 rounded-md focus:outline-none focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(acc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Xóa nguồn tiền"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new real-world wallet/bank account */}
              <form onSubmit={handleAddAccount} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Thêm tài khoản/ví (VD: VietinBank, Tiền mặt Heo...)"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
                <select
                  value={newAccOwner}
                  onChange={(e) => setNewAccOwner(e.target.value as any)}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Chung">Chung</option>
                  <option value="Heo">Heo</option>
                  <option value="Mèo">Mèo</option>
                </select>
                <button
                  type="submit"
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                = Tổng tiền thực tế đang có:
              </span>
              <span className="text-base font-bold font-mono-tabular text-teal-800">
                {formatCurrency(reconcileStats.actualRealWorldTotal)}
              </span>
            </div>
          </div>

          {/* Column 3: Discrepancy Verdict & 1-Click Adjustment */}
          <div className="lg:col-span-3 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
                03. Kết quả Check Tiền
              </h3>

              <div className="mt-5">
                <div className="text-xs text-slate-500">
                  Độ lệch (Thực tế − Lý thuyết):
                </div>
                <div
                  className={`text-2xl font-bold font-mono-tabular mt-1 ${
                    reconcileStats.discrepancy === 0
                      ? 'text-emerald-700'
                      : reconcileStats.discrepancy < 0
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}
                >
                  {formatCurrency(reconcileStats.discrepancy, true)}
                </div>

                <div className="mt-4 p-3 rounded-lg border bg-white border-slate-200 text-xs space-y-1.5">
                  {reconcileStats.discrepancy === 0 ? (
                    <div className="flex items-start gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Khớp sổ 100%!</strong> Số tiền thực tế ngoài đời khớp hoàn toàn với thống kê thu chi.
                      </span>
                    </div>
                  ) : reconcileStats.discrepancy < 0 ? (
                    <div className="flex items-start gap-2 text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Đang hụt {formatCurrency(Math.abs(reconcileStats.discrepancy))} ngoài đời thực!</strong> Có khoản chi tiêu đã trả nhưng quên note vào bảng Expenses.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Đang dư {formatCurrency(reconcileStats.discrepancy)} ngoài đời thực!</strong> Có thể có khoản thu/hoàn tiền hoặc trả hộ chưa ghi giảm trừ.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {reconcileStats.discrepancy !== 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleRecordDiscrepancy}
                  className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>
                    Ghi nhận khoản lệch ({formatCurrency(Math.abs(reconcileStats.discrepancy))})
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                  Mở sẵn form mục &ldquo;Khác · Thất lạc chưa nhớ / Lệch tiền&rdquo; để lưu vào Google Sheet
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PART 2: CHU KỲ TÍNH BE CORP & CREDIT (BILLING CYCLE TRACKER) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BE Corp Cycle Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-amber-600" />
                <span>Chu kỳ tính BE Corp</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tổng phát sinh cột BE Corp và phần chênh lệch đặt hộ/tài trợ theo chu kỳ
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyBePreset('oct_full')}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                T10 (1/10–31/10)
              </button>
              <button
                type="button"
                onClick={() => applyBePreset('cycle_26_25')}
                className="px-2 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 rounded"
              >
                Chu kỳ 26/9–25/10
              </button>
              <button
                type="button"
                onClick={() => applyBePreset('sep_full')}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                T9
              </button>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs">
            <span className="font-medium text-slate-700">Khoảng ngày chu kỳ BE Corp:</span>
            <div className="flex items-center gap-2 font-mono-tabular">
              <input
                type="date"
                value={beStartDate}
                onChange={(e) => setBeStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded"
              />
              <span>đến</span>
              <input
                type="date"
                value={beEndDate}
                onChange={(e) => setBeEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Summary KPI strip */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Tổng cột BE Corp</div>
              <div className="text-sm font-bold font-mono-tabular text-amber-700 mt-1">
                {formatCurrency(beCorpCycleStats.totalBeCorp)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {beCorpCycleStats.items.length} giao dịch
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Phần chi cá nhân (Amount)</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-1">
                {formatCurrency(beCorpCycleStats.totalPersonalAmount)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Tính vào chi tiêu
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Chênh lệch (BE − Amount)</div>
              <div className="text-sm font-bold font-mono-tabular text-teal-700 mt-1">
                {formatCurrency(beCorpCycleStats.diffPaidForOthers, true)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Đặt chung / Trợ cấp
              </div>
            </div>
          </div>

          {/* Transaction list in BE Corp cycle */}
          <div className="mt-4 max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {beCorpCycleStats.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không có giao dịch BE Corp trong khoảng ngày này.
              </div>
            ) : (
              beCorpCycleStats.items.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-mono-tabular text-slate-500">
                      {item.purchaseDate}
                    </span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-medium text-slate-900">{item.purchaseItem}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-500">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono-tabular">
                    <span className="text-slate-400" title="Amount cá nhân">
                      Chi: {formatNumberForSheet(item.amount, true)}
                    </span>
                    <span className="font-semibold text-amber-700" title="Cột BE Corp">
                      BE: {formatNumberForSheet(item.beCorp, true)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Credit Statement Cycle Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-indigo-600" />
                <span>Chu kỳ sao kê thẻ Credit</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tổng dư nợ quẹt thẻ Credit trong kỳ sao kê và các khoản quẹt hộ
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyCreditPreset('stmt_20_19')}
                className="px-2 py-1 text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded"
              >
                Sao kê 20/9–19/10
              </button>
              <button
                type="button"
                onClick={() => applyCreditPreset('stmt_15_14')}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                Sao kê 15/9–14/10
              </button>
              <button
                type="button"
                onClick={() => applyCreditPreset('oct_full')}
                className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                Trọn T10
              </button>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs">
            <span className="font-medium text-slate-700">Khoảng ngày sao kê Credit:</span>
            <div className="flex items-center gap-2 font-mono-tabular">
              <input
                type="date"
                value={creditStartDate}
                onChange={(e) => setCreditStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded"
              />
              <span>đến</span>
              <input
                type="date"
                value={creditEndDate}
                onChange={(e) => setCreditEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded"
              />
            </div>
          </div>

          {/* Summary KPI strip */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Tổng quẹt cột Credit</div>
              <div className="text-sm font-bold font-mono-tabular text-indigo-700 mt-1">
                {formatCurrency(creditCycleStats.totalCredit)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {creditCycleStats.items.length} giao dịch
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Phần chi cá nhân (Amount)</div>
              <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-1">
                {formatCurrency(creditCycleStats.totalPersonalAmount)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Tính vào chi tiêu
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500">Quẹt hộ / Chênh lệch</div>
              <div className="text-sm font-bold font-mono-tabular text-teal-700 mt-1">
                {formatCurrency(creditCycleStats.diffPaidForOthers, true)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Credit − Amount
              </div>
            </div>
          </div>

          {/* Transaction list in Credit cycle */}
          <div className="mt-4 max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {creditCycleStats.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không có giao dịch Credit trong khoảng ngày này.
              </div>
            ) : (
              creditCycleStats.items.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-mono-tabular text-slate-500">
                      {item.purchaseDate}
                    </span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-medium text-slate-900">{item.purchaseItem}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-500">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono-tabular">
                    <span className="text-slate-400" title="Amount cá nhân">
                      Chi: {formatNumberForSheet(item.amount, true)}
                    </span>
                    <span className="font-semibold text-indigo-700" title="Cột Credit">
                      Credit: {formatNumberForSheet(item.credit, true)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* PART 3: LIVE MIRROR OF GOOGLE SHEET TAB "CHECK TIỀN" */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              <span>
                Bảng dữ liệu &amp; công thức gốc từ Sheet &ldquo;Check tiền&rdquo;
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hiển thị trực tiếp các ô tính toán và công thức chu kỳ đọc từ tab &ldquo;Check tiền&rdquo; trên Google Sheet của bạn
            </p>
          </div>

          {checkTienData && (
            <button
              type="button"
              onClick={() => setShowFormulasInMirror((prev) => !prev)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {showFormulasInMirror ? 'Xem giá trị đã tính' : 'Xem công thức gốc (=SUMIFS...)'}
            </button>
          )}
        </div>

        {!checkTienData ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              {isSheetConnected
                ? 'Không tìm thấy tab tên "Check tiền" trong file Google Sheet hiện tại hoặc tab đang trống.'
                : 'File đính kèm mặc định chỉ chứa bản xuất CSV của tab Expenses. Hãy kết nối trực tiếp Google Sheet để ứng dụng đọc trực tiếp toàn bộ công thức và bảng "Check tiền" của bạn.'}
            </p>
            {!isSheetConnected && (
              <button
                type="button"
                onClick={onNavigateToSync}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Kết nối Google Sheet để tải tab &ldquo;Check tiền&rdquo;
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {checkTienData.detectedSummary && checkTienData.detectedSummary.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Các chỉ số công thức phát hiện trong tab &ldquo;{checkTienData.sheetName}&rdquo;:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {checkTienData.detectedSummary.slice(0, 8).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="text-slate-500 truncate">{item.label}</div>
                      <div className="text-sm font-bold font-mono-tabular text-slate-900 mt-0.5">
                        {item.value}
                      </div>
                      {item.formula && (
                        <div
                          className="text-[10px] font-mono-tabular text-teal-700 truncate mt-1"
                          title={item.formula}
                        >
                          {item.formula}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <tbody className="divide-y divide-slate-100">
                  {(showFormulasInMirror
                    ? checkTienData.formulaRows
                    : checkTienData.formattedRows
                  ).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 bg-slate-50 text-slate-400 font-mono-tabular border-r border-slate-200 text-center w-10">
                        {rIdx + 1}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-1.5 border-r border-slate-100 font-mono-tabular text-slate-800 whitespace-nowrap"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

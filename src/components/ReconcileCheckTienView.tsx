import React, { useMemo, useState, useEffect } from 'react';
import {
  Calculator,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowUpRight,
  CreditCard,
  Wallet,
  Car,
  User,
  Users,
  Coins,
  Building2,
  Smartphone,
  HandCoins,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
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
  onOpenAddWithPreset: (preset: Partial<NewTransactionPayload>) => void;
  accounts: RealWorldAccount[];
  onUpdateAccounts: React.Dispatch<React.SetStateAction<RealWorldAccount[]>>;
  openingOrBaseIncome: number;
  onUpdateOpeningOrBaseIncome: (val: number) => void;
}

type ReconcileSubTab = 'reconcile' | 'accounts' | 'becorp' | 'credit';

const SAVED_BE_SUBSIDY_KEY = 'heomeo_be_subsidy_quota_v1';
const DEFAULT_BE_SUBSIDY = 2500000;

export const ReconcileCheckTienView: React.FC<ReconcileCheckTienViewProps> = ({
  allRecords,
  selectedMonth,
  onOpenAddWithPreset,
  accounts,
  onUpdateAccounts,
  openingOrBaseIncome,
  onUpdateOpeningOrBaseIncome,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ReconcileSubTab>('reconcile');

  // BE Corp subsidy quota (default 2.5m)
  const [beSubsidyQuota, setBeSubsidyQuota] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BE_SUBSIDY_KEY);
      return saved ? Number(saved) : DEFAULT_BE_SUBSIDY;
    } catch {
      return DEFAULT_BE_SUBSIDY;
    }
  });

  const [isEditingSubsidy, setIsEditingSubsidy] = useState<boolean>(false);
  const [tempSubsidy, setTempSubsidy] = useState<number>(beSubsidyQuota);

  const handleSaveSubsidy = () => {
    setBeSubsidyQuota(tempSubsidy);
    try {
      localStorage.setItem(SAVED_BE_SUBSIDY_KEY, String(tempSubsidy));
    } catch {
      // ignore
    }
    setIsEditingSubsidy(false);
  };

  // Cycle filter state for BE Corp (default: 26th last month to 25th this month)
  const [beStartDate, setBeStartDate] = useState<string>('2026-09-26');
  const [beEndDate, setBeEndDate] = useState<string>('2026-10-25');

  // Cycle filter state for Credit (default: 25th last month to 24th this month)
  const [creditStartDate, setCreditStartDate] = useState<string>('2026-09-25');
  const [creditEndDate, setCreditEndDate] = useState<string>('2026-10-24');

  // Reconcile calculation options
  const [reconcilePeriodMode, setReconcilePeriodMode] = useState<'selected_month' | 'custom_range'>('selected_month');
  const [reconcileStart, setReconcileStart] = useState<string>('2026-10-01');
  const [reconcileEnd, setReconcileEnd] = useState<string>('2026-10-31');
  const [addBackUnpaidCredit, setAddBackUnpaidCredit] = useState<boolean>(true);

  // New account form state
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccOwner, setNewAccOwner] = useState<'Heo' | 'Mèo'>('Heo');
  const [newAccType, setNewAccType] = useState<'cash' | 'bank' | 'ewallet' | 'receivable'>('bank');

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

  const applyCreditPreset = (preset: 'stmt_25_24' | 'stmt_15_14' | 'oct_full') => {
    if (preset === 'stmt_25_24') {
      setCreditStartDate('2026-09-25');
      setCreditEndDate('2026-10-24');
    } else if (preset === 'stmt_15_14') {
      setCreditStartDate('2026-09-15');
      setCreditEndDate('2026-10-14');
    } else {
      setCreditStartDate('2026-10-01');
      setCreditEndDate('2026-10-31');
    }
  };

  // 1. BE Corp Cycle Analysis - SORTED NEWEST TO OLDEST
  const beCorpCycleStats = useMemo(() => {
    const items = allRecords
      .filter(
        (r) =>
          r.sheetType === 'Expenses' &&
          r.beCorp !== 0 &&
          r.isoDate >= beStartDate &&
          r.isoDate <= beEndDate
      )
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate) || ((b.rowIndex || 0) - (a.rowIndex || 0)));

    const totalBeCorp = items.reduce((sum, r) => sum + r.beCorp, 0);
    const totalPersonalAmount = items.reduce((sum, r) => sum + r.amount, 0);
    const diffPaidForOthers = totalBeCorp - totalPersonalAmount;
    const remainingQuota = beSubsidyQuota - totalBeCorp;
    const pctUsed = beSubsidyQuota > 0 ? (totalBeCorp / beSubsidyQuota) * 100 : 0;

    return {
      items,
      totalBeCorp,
      totalPersonalAmount,
      diffPaidForOthers,
      remainingQuota,
      pctUsed,
    };
  }, [allRecords, beStartDate, beEndDate, beSubsidyQuota]);

  // 2. Credit Cycle Analysis - SORTED NEWEST TO OLDEST
  const creditCycleStats = useMemo(() => {
    const items = allRecords
      .filter(
        (r) =>
          r.sheetType === 'Expenses' &&
          r.credit !== 0 &&
          r.isoDate >= creditStartDate &&
          r.isoDate <= creditEndDate
      )
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate) || ((b.rowIndex || 0) - (a.rowIndex || 0)));

    const totalCredit = items.reduce((sum, r) => sum + r.credit, 0);
    const totalPersonalAmount = items.reduce((sum, r) => sum + r.amount, 0);
    const diffPaidForOthers = totalCredit - totalPersonalAmount;
    return { items, totalCredit, totalPersonalAmount, diffPaidForOthers };
  }, [allRecords, creditStartDate, creditEndDate]);

  // 3. Reconcile ("Check tiền") calculation - BE CORP ADD-BACK PERMANENTLY REMOVED
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

    // Portion of expense paid via Credit that hasn't deducted cash/bank yet
    const personalPaidViaCredit = filtered
      .filter((r) => r.sheetType === 'Expenses' && r.credit > 0)
      .reduce((sum, r) => sum + Math.min(r.amount, r.credit), 0);

    let theoreticalRemainingCash = effectiveAvailableFunds - totalRecordedExpense;
    if (addBackUnpaidCredit) {
      theoreticalRemainingCash += personalPaidViaCredit;
    }

    const actualRealWorldTotal = accounts
      .filter((a) => a.includedInReconcile)
      .reduce((sum, a) => sum + a.balance, 0);

    const discrepancy = actualRealWorldTotal - theoreticalRemainingCash;

    return {
      sheetIncome,
      effectiveAvailableFunds,
      totalRecordedExpense,
      personalPaidViaCredit,
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
    accounts,
  ]);

  // Account management handlers
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
        type: newAccType,
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

    const todayIso = new Date().toISOString().split('T')[0];
    if (reconcileStats.discrepancy < 0) {
      onOpenAddWithPreset({
        sheetType: 'Expenses',
        isoDate: todayIso,
        purchaseDate: isoToSheetDate(todayIso),
        category: 'Khác',
        purchaseItem: 'Thất lạc chưa nhớ / Lệch tiền (Check tiền)',
        amount: missingAmount,
      });
    } else {
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

  // Group accounts by owner Heo & Mèo
  const heoAccounts = useMemo(() => {
    return accounts.filter((a) => a.owner === 'Heo');
  }, [accounts]);

  const meoAccounts = useMemo(() => {
    return accounts.filter((a) => a.owner === 'Mèo');
  }, [accounts]);

  const chungAccounts = useMemo(() => {
    return accounts.filter((a) => a.owner === 'Chung');
  }, [accounts]);

  const heoTotal = useMemo(() => {
    return heoAccounts.filter((a) => a.includedInReconcile).reduce((s, a) => s + a.balance, 0);
  }, [heoAccounts]);

  const meoTotal = useMemo(() => {
    return meoAccounts.filter((a) => a.includedInReconcile).reduce((s, a) => s + a.balance, 0);
  }, [meoAccounts]);

  const chungTotal = useMemo(() => {
    return chungAccounts.filter((a) => a.includedInReconcile).reduce((s, a) => s + a.balance, 0);
  }, [chungAccounts]);

  const ACCOUNT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    cash: { label: 'Tiền mặt', icon: Coins, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    bank: { label: 'Thẻ / Ngân hàng', icon: Building2, color: 'text-sky-700 bg-sky-50 border-sky-200' },
    ewallet: { label: 'Ví điện tử', icon: Smartphone, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    receivable: { label: 'Đang cho vay', icon: HandCoins, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  };

  return (
    <div className="space-y-6">
      {/* ═══════ SUB-TAB NAVIGATION ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('reconcile')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'reconcile'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>01. Đối Soát Check Tiền</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('accounts')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'accounts'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>02. Ví &amp; Tài Khoản (Heo &amp; Mèo)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === 'accounts' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {formatCurrency(reconcileStats.actualRealWorldTotal)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('becorp')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'becorp'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>03. Chu Trình BE Corp</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === 'becorp' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {formatCurrency(beCorpCycleStats.totalBeCorp)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('credit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'credit'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>04. Sao Kê Thẻ Credit</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === 'credit' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {formatCurrency(creditCycleStats.totalCredit)}
            </span>
          </button>
        </div>

        {/* Quick balance badge */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 font-mono-tabular px-2">
          <span>Lệch sổ:</span>
          <strong className={`font-bold ${
            reconcileStats.discrepancy === 0 ? 'text-emerald-700' : reconcileStats.discrepancy < 0 ? 'text-rose-700' : 'text-amber-700'
          }`}>
            {formatCurrency(reconcileStats.discrepancy, true)}
          </strong>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: ĐỐI SOÁT CHECK TIỀN (SỔ SÁCH VS THỰC TẾ)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'reconcile' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Đối Soát Check Tiền — Kiểm Tra Khớp Sổ &amp; Bắt Lệch
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                So sánh số dư lý thuyết trên sổ sách (App/Sheet) với tổng số tiền mặt &amp; ngân hàng thực tế đang có của Heo &amp; Mèo.
              </p>
            </div>

            {/* Period selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReconcilePeriodMode('selected_month')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    reconcilePeriodMode === 'selected_month'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo tháng đang chọn ({selectedMonth === 'ALL' ? 'Tất cả' : selectedMonth})
                </button>
                <button
                  type="button"
                  onClick={() => setReconcilePeriodMode('custom_range')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    reconcilePeriodMode === 'custom_range'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tùy chỉnh ngày
                </button>
              </div>
              {reconcilePeriodMode === 'custom_range' && (
                <div className="flex items-center gap-1.5 text-xs font-mono-tabular">
                  <input
                    type="date"
                    value={reconcileStart}
                    onChange={(e) => setReconcileStart(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800"
                  />
                  <span>→</span>
                  <input
                    type="date"
                    value={reconcileEnd}
                    onChange={(e) => setReconcileEnd(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3-Column Reconciliation Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Column 1: Book Balance Calculation */}
            <div className="lg:col-span-4 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/70 shadow-2xs">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-200">
                  01. Sổ Sách Lý Thuyết (App / Sheet)
                </h3>

                <div className="mt-4 space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Quỹ đầu kỳ / Thu nhập đầu tháng (₫):
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberForSheet(openingOrBaseIncome, true)}
                      onChange={(e) =>
                        onUpdateOpeningOrBaseIncome(parseSheetNumber(e.target.value))
                      }
                      className="w-full px-3 py-2 text-sm font-mono-tabular font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 text-slate-900"
                    />
                  </div>

                  {reconcileStats.sheetIncome > 0 && (
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span>+ Thu nhập bảng Income:</span>
                      <span className="font-mono-tabular font-bold text-emerald-700">
                        +{formatCurrency(reconcileStats.sheetIncome)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-700 font-medium pt-2 border-t border-slate-200">
                    <span>− Tổng chi tiêu đã ghi ({reconcileStats.txCount} dòng):</span>
                    <span className="font-mono-tabular font-bold text-rose-700">
                      −{formatCurrency(reconcileStats.totalRecordedExpense)}
                    </span>
                  </div>

                  {/* Credit adjustment only (BE Corp completely removed) */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="flex items-start justify-between gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="flex items-center gap-2 text-slate-700 text-xs">
                        <input
                          type="checkbox"
                          checked={addBackUnpaidCredit}
                          onChange={(e) => setAddBackUnpaidCredit(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span>+ Quẹt Credit chưa trừ tiền mặt:</span>
                      </span>
                      <span className="font-mono-tabular text-indigo-700 font-bold shrink-0">
                        +{formatCurrency(reconcileStats.personalPaidViaCredit)}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  = Tiền lý thuyết phải còn:
                </span>
                <span className="text-base font-extrabold font-mono-tabular text-slate-900">
                  {formatCurrency(reconcileStats.theoreticalRemainingCash)}
                </span>
              </div>
            </div>

            {/* Column 2: Actual Real-World Accounts (Combined from Heo & Mèo) */}
            <div className="lg:col-span-5 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-white shadow-2xs">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    02. Tiền Thực Tế Ngoài Đời (Heo &amp; Mèo)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('accounts')}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Quản lý chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sub-summary by person */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                      <span>🐷 Heo</span>
                    </div>
                    <div className="text-base font-extrabold font-mono-tabular text-rose-950 mt-1">
                      {formatCurrency(heoTotal)}
                    </div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      {heoAccounts.length} nguồn tiền
                    </div>
                  </div>

                  <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                      <span>🐱 Mèo</span>
                    </div>
                    <div className="text-base font-extrabold font-mono-tabular text-sky-950 mt-1">
                      {formatCurrency(meoTotal)}
                    </div>
                    <div className="text-[11px] text-sky-700 mt-0.5">
                      {meoAccounts.length} nguồn tiền
                    </div>
                  </div>
                </div>

                {/* Quick accounts list */}
                <div className="mt-4 space-y-2 max-h-52 overflow-y-auto pr-1 divide-y divide-slate-100">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="pt-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          acc.owner === 'Heo' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {acc.owner}
                        </span>
                        <span className="font-medium text-slate-800 truncate">{acc.name}</span>
                      </div>
                      <span className="font-mono-tabular font-bold text-slate-900 shrink-0">
                        {formatCurrency(acc.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  = Tổng tiền thực tế (Heo + Mèo):
                </span>
                <span className="text-base font-extrabold font-mono-tabular text-teal-800">
                  {formatCurrency(reconcileStats.actualRealWorldTotal)}
                </span>
              </div>
            </div>

            {/* Column 3: Discrepancy Verdict & 1-Click Adjustment */}
            <div className="lg:col-span-3 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/60 shadow-2xs">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-200">
                  03. Kết Quả Check Tiền
                </h3>

                <div className="mt-5">
                  <div className="text-xs text-slate-600 font-medium">
                    Độ lệch (Thực tế − Lý thuyết):
                  </div>
                  <div
                    className={`text-2xl font-extrabold font-mono-tabular mt-1.5 ${
                      reconcileStats.discrepancy === 0
                        ? 'text-emerald-700'
                        : reconcileStats.discrepancy < 0
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatCurrency(reconcileStats.discrepancy, true)}
                  </div>

                  <div className="mt-4 p-3.5 rounded-xl border bg-white border-slate-200 text-xs space-y-2">
                    {reconcileStats.discrepancy === 0 ? (
                      <div className="flex items-start gap-2 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                        <div>
                          <strong className="block font-bold">Khớp sổ 100%!</strong>
                          <span className="text-slate-600">Số tiền ngoài đời thực khớp hoàn toàn với số liệu chi tiêu trên sổ sách.</span>
                        </div>
                      </div>
                    ) : reconcileStats.discrepancy < 0 ? (
                      <div className="flex items-start gap-2 text-rose-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <strong className="block font-bold">Hụt {formatCurrency(Math.abs(reconcileStats.discrepancy))}!</strong>
                          <span className="text-slate-600">Có khoản chi ngoài đời đã tiêu nhưng quên ghi vào app/sheet.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <strong className="block font-bold">Dư {formatCurrency(reconcileStats.discrepancy)}!</strong>
                          <span className="text-slate-600">Có khoản tiền hoàn/thu vào hoặc trả hộ chưa ghi giảm trừ.</span>
                        </div>
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
                    className="w-full py-2.5 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>
                      Ghi nhận lệch ({formatCurrency(Math.abs(reconcileStats.discrepancy))})
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                    Mở form mục &ldquo;Khác · Lệch tiền&rdquo; để ghi vào Google Sheet
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: VÍ & TÀI KHOẢN (TÁCH RIÊNG 2 NGƯỜI HEO & MÈO)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'accounts' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Quản Lý Ví &amp; Tài Khoản — Tách Riêng Heo 🐷 &amp; Mèo 🐱
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi 4 nguồn tiền chuẩn cho mỗi người: <strong>Tiền mặt</strong>, <strong>Thẻ / Ngân hàng</strong>, <strong>Ví điện tử</strong>, và <strong>Đang cho vay</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl text-xs">
              <span className="text-teal-800 font-medium">Tổng tài sản 2 người:</span>
              <strong className="text-base font-extrabold font-mono-tabular text-teal-950">
                {formatCurrency(heoTotal + meoTotal + chungTotal)}
              </strong>
            </div>
          </div>

          {/* Dual Columns: Heo vs Mèo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ═══════ COLUMN HEO ═══════ */}
            <div className="border border-rose-200 rounded-xl p-5 bg-rose-50/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-rose-200">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐷</span>
                  <div>
                    <h3 className="text-sm font-bold text-rose-950">Ví &amp; Tài Khoản của Heo</h3>
                    <span className="text-[11px] text-rose-700">Tiền mặt, thẻ, ví điện tử, cho vay</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-rose-700 font-medium">Tổng tiền Heo</div>
                  <div className="text-lg font-extrabold font-mono-tabular text-rose-950">
                    {formatCurrency(heoTotal)}
                  </div>
                </div>
              </div>

              {/* Heo Accounts List */}
              <div className="space-y-3">
                {heoAccounts.map((acc) => {
                  const typeConf = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.bank;
                  const IconComp = typeConf.icon;
                  return (
                    <div
                      key={acc.id}
                      className="p-3 bg-white border border-rose-100 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-rose-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg border shrink-0 ${typeConf.color}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{acc.name}</div>
                          <span className="text-[10px] text-slate-500 font-medium">{typeConf.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={acc.balance === 0 ? '' : formatNumberForSheet(acc.balance)}
                          placeholder="0"
                          onChange={(e) => handleAccountBalanceChange(acc.id, e.target.value)}
                          className="w-32 px-2.5 py-1.5 text-right text-xs font-mono-tabular font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500 bg-slate-50/50"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(acc.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa tài khoản này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══════ COLUMN MÈO ═══════ */}
            <div className="border border-sky-200 rounded-xl p-5 bg-sky-50/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-sky-200">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐱</span>
                  <div>
                    <h3 className="text-sm font-bold text-sky-950">Ví &amp; Tài Khoản của Mèo</h3>
                    <span className="text-[11px] text-sky-700">Tiền mặt, thẻ, ví điện tử, cho vay</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-sky-700 font-medium">Tổng tiền Mèo</div>
                  <div className="text-lg font-extrabold font-mono-tabular text-sky-950">
                    {formatCurrency(meoTotal)}
                  </div>
                </div>
              </div>

              {/* Mèo Accounts List */}
              <div className="space-y-3">
                {meoAccounts.map((acc) => {
                  const typeConf = ACCOUNT_TYPE_CONFIG[acc.type] || ACCOUNT_TYPE_CONFIG.bank;
                  const IconComp = typeConf.icon;
                  return (
                    <div
                      key={acc.id}
                      className="p-3 bg-white border border-sky-100 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-sky-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg border shrink-0 ${typeConf.color}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{acc.name}</div>
                          <span className="text-[10px] text-slate-500 font-medium">{typeConf.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={acc.balance === 0 ? '' : formatNumberForSheet(acc.balance)}
                          placeholder="0"
                          onChange={(e) => handleAccountBalanceChange(acc.id, e.target.value)}
                          className="w-32 px-2.5 py-1.5 text-right text-xs font-mono-tabular font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 bg-slate-50/50"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(acc.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa tài khoản này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add New Account Form */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Thêm tài khoản / nguồn tiền mới:</h4>
            <form onSubmit={handleAddAccount} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                placeholder="Tên ví / ngân hàng (VD: Vietcombank, Ví Momo, Tiền mặt...)"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-teal-600"
              />
              <select
                value={newAccOwner}
                onChange={(e) => setNewAccOwner(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
              >
                <option value="Heo">Thuộc về Heo 🐷</option>
                <option value="Mèo">Thuộc về Mèo 🐱</option>
              </select>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank">Thẻ / Ngân hàng</option>
                <option value="ewallet">Ví điện tử</option>
                <option value="receivable">Đang cho vay</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm</span>
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: CHU TRÌNH BE CORP (TRỢ CẤP 2.5TR/THÁNG & SORT NGÀY GẦN NHẤT)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'becorp' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Chu Trình Tính BE Corp — Định Mức Trợ Cấp 2.500.000 ₫/tháng
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi số tiền trợ cấp BE Corp công ty cấp mỗi tháng, kiểm soát đã dùng bao nhiêu và còn lại bao nhiêu trong chu kỳ.
              </p>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyBePreset('cycle_26_25')}
                className="px-2.5 py-1.5 text-xs font-bold bg-amber-100 text-amber-900 rounded-lg border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
              >
                Chu kỳ 26/9 – 25/10 (Chuẩn)
              </button>
              <button
                type="button"
                onClick={() => applyBePreset('oct_full')}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Trọn T10 (1/10–31/10)
              </button>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-xs">
            <span className="font-bold text-amber-950">Khoảng ngày chu kỳ BE Corp:</span>
            <div className="flex items-center gap-2 font-mono-tabular">
              <input
                type="date"
                value={beStartDate}
                onChange={(e) => setBeStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-semibold text-slate-800"
              />
              <span className="text-amber-800 font-bold">đến</span>
              <input
                type="date"
                value={beEndDate}
                onChange={(e) => setBeEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* 3 KPI Cards: Trợ cấp 2.5tr, Đã dùng, Còn lại */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Định mức trợ cấp */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-600 font-medium flex items-center justify-between">
                  <span>Trợ cấp BE Corp / tháng</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingSubsidy((prev) => !prev)}
                    className="text-[11px] text-amber-700 hover:underline font-bold"
                  >
                    {isEditingSubsidy ? 'Hủy' : 'Đổi mức'}
                  </button>
                </div>
                {isEditingSubsidy ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      type="number"
                      step="100000"
                      value={tempSubsidy}
                      onChange={(e) => setTempSubsidy(Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm font-bold border border-amber-400 rounded bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSubsidy}
                      className="px-2 py-1 bg-amber-600 text-white text-xs font-bold rounded"
                    >
                      Lưu
                    </button>
                  </div>
                ) : (
                  <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-2">
                    {formatCurrency(beSubsidyQuota)}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Hạn mức công ty cấp định kỳ
              </div>
            </div>

            {/* Card 2: Đã dùng trong chu kỳ */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-xs text-amber-800 font-medium">Đã dùng trong chu kỳ</div>
                <div className="text-xl font-extrabold font-mono-tabular text-amber-950 mt-2">
                  {formatCurrency(beCorpCycleStats.totalBeCorp)}
                </div>
              </div>
              <div className="text-[11px] text-amber-800 mt-2 font-medium">
                {beCorpCycleStats.items.length} giao dịch phát sinh
              </div>
            </div>

            {/* Card 3: Còn lại trong chu kỳ */}
            <div className={`p-4 border rounded-xl flex flex-col justify-between ${
              beCorpCycleStats.remainingQuota >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-rose-50 border-rose-200'
            }`}>
              <div>
                <div className={`text-xs font-medium ${
                  beCorpCycleStats.remainingQuota >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  {beCorpCycleStats.remainingQuota >= 0 ? 'Còn lại trong chu kỳ' : 'Vượt hạn mức trợ cấp!'}
                </div>
                <div className={`text-xl font-extrabold font-mono-tabular mt-2 ${
                  beCorpCycleStats.remainingQuota >= 0 ? 'text-emerald-950' : 'text-rose-950'
                }`}>
                  {formatCurrency(beCorpCycleStats.remainingQuota)}
                </div>
              </div>
              <div className={`text-[11px] font-bold mt-2 ${
                beCorpCycleStats.remainingQuota >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {beCorpCycleStats.remainingQuota >= 0
                  ? `Đã dùng ${beCorpCycleStats.pctUsed.toFixed(0)}% định mức`
                  : `Vượt quá ${formatCurrency(Math.abs(beCorpCycleStats.remainingQuota))}`}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>Tiến độ sử dụng định mức BE Corp:</span>
              <span className="font-bold font-mono-tabular">{beCorpCycleStats.pctUsed.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  beCorpCycleStats.pctUsed > 100
                    ? 'bg-rose-600'
                    : beCorpCycleStats.pctUsed > 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, beCorpCycleStats.pctUsed)}%` }}
              />
            </div>
          </div>

          {/* Detailed Transaction List - SORTED NEWEST TO OLDEST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Bảng chi tiết giao dịch BE Corp (Xếp từ ngày gần nhất tới xa nhất):
              </h3>
              <span className="text-xs text-slate-500 font-mono-tabular">
                {beCorpCycleStats.items.length} giao dịch
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Ngày</th>
                    <th className="py-2.5 px-3">Nội dung chi tiêu</th>
                    <th className="py-2.5 px-3">Danh mục</th>
                    <th className="py-2.5 px-3 text-right">Chi cá nhân (Amount)</th>
                    <th className="py-2.5 px-3 text-right text-amber-900 bg-amber-100/70">Tiền ví BE Corp</th>
                    <th className="py-2.5 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-tabular">
                  {beCorpCycleStats.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Không có giao dịch BE Corp trong chu kỳ ngày này.
                      </td>
                    </tr>
                  ) : (
                    beCorpCycleStats.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                          {item.purchaseDate}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          {item.purchaseItem}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-amber-800 bg-amber-50/40">
                          {formatCurrency(item.beCorp)}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-[11px] text-slate-500">
                          {item.note || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: CHU KỲ SAO KÊ THẺ CREDIT (SORT NGÀY GẦN NHẤT TỚI XA NHẤT)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'credit' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Chu Kỳ Sao Kê Thẻ Credit — 25 Tháng Trước Đến 24 Tháng Này
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Theo dõi tổng số tiền đã cà thẻ tín dụng trong kỳ sao kê để chuẩn bị thanh toán khi ngân hàng gửi sao kê.
              </p>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyCreditPreset('stmt_25_24')}
                className="px-2.5 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-900 rounded-lg border border-indigo-300 hover:bg-indigo-200 transition-colors cursor-pointer"
              >
                Sao kê 25/9 – 24/10 (Chuẩn)
              </button>
              <button
                type="button"
                onClick={() => applyCreditPreset('oct_full')}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Trọn T10 (1/10–31/10)
              </button>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200 text-xs">
            <span className="font-bold text-indigo-950">Khoảng ngày chu kỳ sao kê Credit:</span>
            <div className="flex items-center gap-2 font-mono-tabular">
              <input
                type="date"
                value={creditStartDate}
                onChange={(e) => setCreditStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-semibold text-slate-800"
              />
              <span className="text-indigo-800 font-bold">đến</span>
              <input
                type="date"
                value={creditEndDate}
                onChange={(e) => setCreditEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="text-xs text-indigo-800 font-medium">Tổng tiền quẹt cột Credit</div>
              <div className="text-xl font-extrabold font-mono-tabular text-indigo-950 mt-2">
                {formatCurrency(creditCycleStats.totalCredit)}
              </div>
              <div className="text-[11px] text-indigo-700 mt-2 font-medium">
                {creditCycleStats.items.length} giao dịch trong kỳ sao kê
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs text-slate-600 font-medium">Chi tiêu bản thân (Amount)</div>
              <div className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-2">
                {formatCurrency(creditCycleStats.totalPersonalAmount)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Đã tính vào ngân sách chi tiêu
              </div>
            </div>

            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="text-xs text-teal-800 font-medium">Quẹt hộ / Chờ thu hồi (Credit − Amount)</div>
              <div className="text-xl font-extrabold font-mono-tabular text-teal-950 mt-2">
                {formatCurrency(creditCycleStats.diffPaidForOthers, true)}
              </div>
              <div className="text-[11px] text-teal-700 mt-2 font-medium">
                Khoản bạn bè / người thân gửi lại
              </div>
            </div>
          </div>

          {/* Detailed Transaction List - SORTED NEWEST TO OLDEST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Bảng chi tiết giao dịch quẹt thẻ Credit (Xếp từ ngày gần nhất tới xa nhất):
              </h3>
              <span className="text-xs text-slate-500 font-mono-tabular">
                {creditCycleStats.items.length} giao dịch
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Ngày</th>
                    <th className="py-2.5 px-3">Nội dung chi tiêu</th>
                    <th className="py-2.5 px-3">Danh mục</th>
                    <th className="py-2.5 px-3 text-right">Chi cá nhân (Amount)</th>
                    <th className="py-2.5 px-3 text-right text-indigo-900 bg-indigo-100/70">Tiền quẹt thẻ Credit</th>
                    <th className="py-2.5 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-tabular">
                  {creditCycleStats.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Không có giao dịch quẹt Credit trong khoảng ngày này.
                      </td>
                    </tr>
                  ) : (
                    creditCycleStats.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                          {item.purchaseDate}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          {item.purchaseItem}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-indigo-800 bg-indigo-50/40">
                          {formatCurrency(item.credit)}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-[11px] text-slate-500">
                          {item.note || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

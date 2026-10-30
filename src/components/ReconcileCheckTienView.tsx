import React, { useMemo, useState, useEffect } from 'react';
import {
  Calculator,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Wallet,
  Car,
  Users,
  Coins,
  Building2,
  Smartphone,
  HandCoins,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { CheckTienSheetData, TransactionRecord } from '../types/finance';
import {
  formatCurrency,
  formatNumberForSheet,
  isoToSheetDate,
  parseSheetNumber,
} from '../utils/csvParser';
import { getBillingCycleRange } from '../utils/cycleUtils';
import { NewTransactionPayload } from './AddTransactionModal';
import { MoneyCalculatorInput } from './MoneyCalculatorInput';
import { evaluateMoneyExpression } from '../utils/mathExpression';

export interface WalletCategory {
  cash: number;       // Tiền mặt
  bank: number;       // Thẻ / Ngân hàng
  ewallet: number;    // Ví điện tử
  receivable: number; // Đang cho vay
}

export interface HeoMeoWallets {
  heo: WalletCategory;
  meo: WalletCategory;
}

interface ReconcileCheckTienViewProps {
  allRecords: TransactionRecord[];
  selectedMonth: string;
  onOpenAddWithPreset: (preset: Partial<NewTransactionPayload>) => void;
  checkTienData?: CheckTienSheetData | null;
}

type ReconcileSubTab = 'reconcile' | 'accounts' | 'becorp' | 'credit';

const SAVED_WALLETS_KEY = 'heomeo_wallets_v3';
const SAVED_BE_SUBSIDY_KEY = 'heomeo_be_subsidy_quota_v1';
const DEFAULT_BE_SUBSIDY = 2500000;

const DEFAULT_WALLETS: HeoMeoWallets = {
  heo: {
    cash: 1949000,
    bank: 2107000,
    ewallet: -863000, // Momo (-949k) + Zalopay (86k)
    receivable: 0,
  },
  meo: {
    cash: 760000,
    bank: 13954000,
    ewallet: 2678000, // Momo (16k) + Zalopay (2,662k)
    receivable: 390000,
  },
};

export const ReconcileCheckTienView: React.FC<ReconcileCheckTienViewProps> = ({
  allRecords,
  selectedMonth,
  onOpenAddWithPreset,
  checkTienData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ReconcileSubTab>('reconcile');

  // ═══════ WALLET FUNDS: 4 FIXED FIELDS FOR HEO & 4 FOR MÈO ═══════
  const [wallets, setWallets] = useState<HeoMeoWallets>(() => {
    try {
      const saved = localStorage.getItem(SAVED_WALLETS_KEY);
      if (saved) return JSON.parse(saved);

      // Clean migration: recover cash if user previously had it, but discard phantom 'Chung' accounts
      const oldAccountsRaw = localStorage.getItem('heomeo_real_accounts_v1');
      if (oldAccountsRaw) {
        const oldAccounts = JSON.parse(oldAccountsRaw);
        const heoCash = oldAccounts.find((a: any) => a.id === 'acc-heo-cash')?.balance ?? 1450000;
        const meoCash = oldAccounts.find((a: any) => a.id === 'acc-meo-cash')?.balance ?? 1850000;
        const heoBank = oldAccounts.find((a: any) => a.id === 'acc-heo-bank')?.balance ?? 0;
        const meoBank = oldAccounts.find((a: any) => a.id === 'acc-meo-bank')?.balance ?? 0;
        const heoEwallet = oldAccounts.find((a: any) => a.id === 'acc-heo-ewallet')?.balance ?? 0;
        const meoEwallet = oldAccounts.find((a: any) => a.id === 'acc-meo-ewallet')?.balance ?? 0;
        const heoRec = oldAccounts.find((a: any) => a.id === 'acc-heo-receivable')?.balance ?? 0;
        const meoRec = oldAccounts.find((a: any) => a.id === 'acc-meo-receivable')?.balance ?? 0;

        const migrated: HeoMeoWallets = {
          heo: { cash: heoCash, bank: heoBank, ewallet: heoEwallet, receivable: heoRec },
          meo: { cash: meoCash, bank: meoBank, ewallet: meoEwallet, receivable: meoRec },
        };
        localStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(migrated));
        localStorage.removeItem('heomeo_real_accounts_v1');
        return migrated;
      }
    } catch {
      // fallback
    }
    return DEFAULT_WALLETS;
  });

  // Save wallets on update
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_WALLETS_KEY, JSON.stringify(wallets));
    } catch {
      // ignore
    }
  }, [wallets]);

  // Sync wallets from live Google Sheet Check tiền data when synced
  useEffect(() => {
    if (checkTienData && checkTienData.formattedRows && checkTienData.formattedRows.length >= 3) {
      const rows = checkTienData.formattedRows;
      const heoRow = rows.find((r: string[]) => (r[1] || '').trim().toLowerCase() === 'heo');
      const meoRow = rows.find(
        (r: string[]) =>
          (r[1] || '').trim().toLowerCase() === 'mèo' ||
          (r[1] || '').trim().toLowerCase() === 'meo'
      );
      if (heoRow && meoRow) {
        setWallets({
          heo: {
            cash: parseSheetNumber(heoRow[2]),
            bank: parseSheetNumber(heoRow[3]),
            ewallet: parseSheetNumber(heoRow[4]) + parseSheetNumber(heoRow[5]),
            receivable: parseSheetNumber(heoRow[6]),
          },
          meo: {
            cash: parseSheetNumber(meoRow[2]),
            bank: parseSheetNumber(meoRow[3]),
            ewallet: parseSheetNumber(meoRow[4]) + parseSheetNumber(meoRow[5]),
            receivable: parseSheetNumber(meoRow[6]),
          },
        });
      }
    }
  }, [checkTienData]);

  const handleWalletChange = (
    person: 'heo' | 'meo',
    field: keyof WalletCategory,
    rawVal: string | number
  ) => {
    let num = 0;
    if (typeof rawVal === 'number') {
      num = rawVal;
    } else {
      const evaluated = evaluateMoneyExpression(rawVal);
      if (evaluated !== null) {
        num = evaluated;
      } else {
        const cleanDigits = rawVal.replace(/[^\d]/g, '');
        num = cleanDigits === '' ? 0 : parseInt(cleanDigits, 10);
      }
    }
    setWallets((prev) => ({
      ...prev,
      [person]: {
        ...prev[person],
        [field]: num,
      },
    }));
  };

  // Real Money Totals (Heo, Mèo, Combined)
  const heoTotal = useMemo(() => {
    return wallets.heo.cash + wallets.heo.bank + wallets.heo.ewallet + wallets.heo.receivable;
  }, [wallets.heo]);

  const meoTotal = useMemo(() => {
    return wallets.meo.cash + wallets.meo.bank + wallets.meo.ewallet + wallets.meo.receivable;
  }, [wallets.meo]);

  const totalRealMoney = useMemo(() => {
    return heoTotal + meoTotal;
  }, [heoTotal, meoTotal]);

  // ═══════ CHU KỲ CHECK TIỀN (THEO CHU KỲ SAO KÊ 25-24) ═══════
  const defaultCycle = useMemo(() => {
    return getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
  }, [selectedMonth]);

  const [cyclePreset, setCyclePreset] = useState<'standard_25_24' | 'becorp_26_25' | 'custom'>('standard_25_24');
  const [cycleStart, setCycleStart] = useState<string>(defaultCycle.startDate);
  const [cycleEnd, setCycleEnd] = useState<string>(defaultCycle.endDate);

  // Sync cycle start/end when selectedMonth changes
  useEffect(() => {
    if (cyclePreset === 'standard_25_24') {
      const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
      setCycleStart(c.startDate);
      setCycleEnd(c.endDate);
    } else if (cyclePreset === 'becorp_26_25') {
      const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 26, 25);
      setCycleStart(c.startDate);
      setCycleEnd(c.endDate);
    }
  }, [selectedMonth, cyclePreset]);

  // ═══════ TÍNH TOÁN THEO CHU KỲ (INCOME − EXPENSE + CREDIT) ═══════
  const cycleReconcileStats = useMemo(() => {
    // 1. Income within cycle
    const incomeRows = allRecords.filter(
      (r) => r.sheetType === 'Income' && r.isoDate >= cycleStart && r.isoDate <= cycleEnd
    );
    let cycleIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
    // Fallback: If income has monthKey matching selectedMonth
    if (cycleIncome === 0 && selectedMonth !== 'ALL') {
      const monthIncomeRows = allRecords.filter(
        (r) => r.sheetType === 'Income' && r.monthKey === selectedMonth
      );
      cycleIncome = monthIncomeRows.reduce((s, r) => s + r.amount, 0);
    }

    // 2. Expense within cycle
    const expenseRows = allRecords.filter(
      (r) => r.sheetType === 'Expenses' && r.isoDate >= cycleStart && r.isoDate <= cycleEnd
    );
    const cycleExpense = expenseRows.reduce((s, r) => s + r.amount, 0);

    // 3. Credit swiped within cycle
    const creditRows = allRecords.filter(
      (r) => r.sheetType === 'Expenses' && r.credit > 0 && r.isoDate >= cycleStart && r.isoDate <= cycleEnd
    );
    const cycleCredit = creditRows.reduce((s, r) => s + r.credit, 0);

    // Theoretical remaining = Income - Expense + Credit (Chuẩn 100% Google Sheet)
    const theoreticalRemaining = cycleIncome - cycleExpense + cycleCredit;

    // Discrepancy = Actual money - Theoretical book money
    const discrepancy = totalRealMoney - theoreticalRemaining;

    return {
      cycleIncome,
      incomeCount: incomeRows.length,
      cycleExpense,
      expenseCount: expenseRows.length,
      cycleCredit,
      creditCount: creditRows.length,
      theoreticalRemaining,
      discrepancy,
    };
  }, [allRecords, cycleStart, cycleEnd, selectedMonth, totalRealMoney]);

  // ═══════ BE CORP SUBSIDY TRACKER (2.5M / THÁNG) ═══════
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

  // BE Corp cycle range (26th last month to 25th this month)
  const beCycle = useMemo(() => {
    return getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 26, 25);
  }, [selectedMonth]);

  const [beStartDate, setBeStartDate] = useState<string>(beCycle.startDate);
  const [beEndDate, setBeEndDate] = useState<string>(beCycle.endDate);

  useEffect(() => {
    const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 26, 25);
    setBeStartDate(c.startDate);
    setBeEndDate(c.endDate);
  }, [selectedMonth]);

  // BE Corp Cycle Analysis - SORTED NEWEST TO OLDEST
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

  // Credit statement cycle range (25th last month to 24th this month)
  const creditCycle = useMemo(() => {
    return getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
  }, [selectedMonth]);

  const [creditStartDate, setCreditStartDate] = useState<string>(creditCycle.startDate);
  const [creditEndDate, setCreditEndDate] = useState<string>(creditCycle.endDate);

  useEffect(() => {
    const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
    setCreditStartDate(c.startDate);
    setCreditEndDate(c.endDate);
  }, [selectedMonth]);

  // Credit Cycle Analysis - SORTED NEWEST TO OLDEST
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
    const avgPerTransaction = items.length > 0 ? Math.round(totalCredit / items.length) : 0;
    return { items, totalCredit, avgPerTransaction };
  }, [allRecords, creditStartDate, creditEndDate]);

  // Record discrepancy to sheet
  const handleRecordDiscrepancy = () => {
    const missingAmount = Math.abs(Math.round(cycleReconcileStats.discrepancy));
    if (missingAmount === 0) return;

    const todayIso = new Date().toISOString().split('T')[0];
    if (cycleReconcileStats.discrepancy < 0) {
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

  const WALLET_FIELDS: { key: keyof WalletCategory; label: string; icon: any; color: string; desc: string }[] = [
    { key: 'cash', label: 'Tiền mặt', icon: Coins, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', desc: 'Tiền mặt trong ví, túi' },
    { key: 'bank', label: 'Thẻ / Ngân hàng', icon: Building2, color: 'text-sky-700 bg-sky-50 border-sky-200', desc: 'Tài khoản Techcombank, Vietin, VCB...' },
    { key: 'ewallet', label: 'Ví điện tử', icon: Smartphone, color: 'text-purple-700 bg-purple-50 border-purple-200', desc: 'Momo, ZaloPay, ShopeePay...' },
    { key: 'receivable', label: 'Đang cho vay', icon: HandCoins, color: 'text-amber-700 bg-amber-50 border-amber-200', desc: 'Đồng nghiệp, bạn bè nợ chờ trả' },
  ];

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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeSubTab === 'accounts' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {formatCurrency(totalRealMoney)}
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeSubTab === 'becorp' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900'
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeSubTab === 'credit' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-900'
            }`}>
              {formatCurrency(creditCycleStats.totalCredit)}
            </span>
          </button>
        </div>

        {/* Real-time discrepancy tag */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 font-mono-tabular px-2">
          <span>Lệch sổ:</span>
          <strong className={`text-sm font-bold ${
            cycleReconcileStats.discrepancy === 0
              ? 'text-emerald-700'
              : cycleReconcileStats.discrepancy < 0
              ? 'text-rose-700'
              : 'text-amber-700'
          }`}>
            {formatCurrency(cycleReconcileStats.discrepancy, true)}
          </strong>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: ĐỐI SOÁT CHECK TIỀN (INCOME − EXPENSE + CREDIT THEO CHU KỲ)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'reconcile' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-teal-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Đối Soát Check Tiền — Công Thức Chu Kỳ (Income − Expense + Credit)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tự động tính số dư lý thuyết theo đúng chu kỳ (25 tháng trước đến 24 tháng này) và đối soát với tổng tiền thực tế của Heo &amp; Mèo.
              </p>
            </div>

            {/* Cycle Preset Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCyclePreset('standard_25_24');
                    const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
                    setCycleStart(c.startDate);
                    setCycleEnd(c.endDate);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    cyclePreset === 'standard_25_24'
                      ? 'bg-white text-teal-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chu kỳ 25–24 ({defaultCycle.displayLabel})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCyclePreset('becorp_26_25');
                    const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 26, 25);
                    setCycleStart(c.startDate);
                    setCycleEnd(c.endDate);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    cyclePreset === 'becorp_26_25'
                      ? 'bg-white text-teal-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chu kỳ 26–25
                </button>
                <button
                  type="button"
                  onClick={() => setCyclePreset('custom')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    cyclePreset === 'custom'
                      ? 'bg-white text-teal-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tùy chỉnh ngày
                </button>
              </div>

              {cyclePreset === 'custom' && (
                <div className="flex items-center gap-1.5 text-xs font-mono-tabular">
                  <input
                    type="date"
                    value={cycleStart}
                    onChange={(e) => setCycleStart(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800 font-semibold"
                  />
                  <span>→</span>
                  <input
                    type="date"
                    value={cycleEnd}
                    onChange={(e) => setCycleEnd(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-800 font-semibold"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3-Column Reconciliation Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Column 1: Automated Book Balance Calculation (Income - Expense + Credit) */}
            <div className="lg:col-span-4 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/70 shadow-2xs">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    01. Sổ Sách Lý Thuyết (Trong Chu Kỳ)
                  </h3>
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-mono-tabular">
                    {cycleStart.slice(5).replace('-', '/')} – {cycleEnd.slice(5).replace('-', '/')}
                  </span>
                </div>

                <div className="mt-4 space-y-4 text-xs">
                  {/* Income */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-slate-700 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Thu nhập chu kỳ</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Bảng Income ({cycleReconcileStats.incomeCount} khoản)</span>
                    </div>
                    <span className="font-mono-tabular font-extrabold text-emerald-700 text-sm">
                      +{formatCurrency(cycleReconcileStats.cycleIncome)}
                    </span>
                  </div>

                  {/* Expense */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-slate-700 font-semibold flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                        <span>Tổng chi tiêu chu kỳ</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Bảng Expenses ({cycleReconcileStats.expenseCount} dòng)</span>
                    </div>
                    <span className="font-mono-tabular font-extrabold text-rose-700 text-sm">
                      −{formatCurrency(cycleReconcileStats.cycleExpense)}
                    </span>
                  </div>

                  {/* Credit */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-slate-700 font-semibold flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Quẹt thẻ Credit</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Chưa trừ tiền mặt ({cycleReconcileStats.creditCount} dòng)</span>
                    </div>
                    <span className="font-mono-tabular font-extrabold text-indigo-700 text-sm">
                      +{formatCurrency(cycleReconcileStats.cycleCredit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Theoretical Total */}
              <div className="mt-6 pt-4 border-t-2 border-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    = Tiền lý thuyết phải còn:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono-tabular">
                    (Income − Expense + Credit)
                  </span>
                </div>
                <span className="text-base font-extrabold font-mono-tabular text-slate-900">
                  {formatCurrency(cycleReconcileStats.theoreticalRemaining)}
                </span>
              </div>
            </div>

            {/* Column 2: Actual Real-World Money of Heo & Mèo */}
            <div className="lg:col-span-5 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-white shadow-2xs">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    02. Tiền Thực Tế Ngoài Đời (Heo &amp; Mèo)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('accounts')}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Xem toàn màn hình</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sub-cards for Heo & Mèo */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {/* Heo mini card */}
                  <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                      <span className="text-xs font-bold text-rose-950 flex items-center gap-1">
                        <span>🐷</span> Heo
                      </span>
                      <strong className="text-xs font-extrabold font-mono-tabular text-rose-950">
                        {formatCurrency(heoTotal)}
                      </strong>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {WALLET_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-1">
                          <span className="text-slate-600 truncate">{f.label}:</span>
                          <MoneyCalculatorInput
                            value={wallets.heo[f.key] === 0 ? '' : formatNumberForSheet(wallets.heo[f.key], false)}
                            onChange={(_str, num) => handleWalletChange('heo', f.key, num)}
                            placeholder="0"
                            size="xs"
                            theme="rose"
                            className="w-28 shrink-0"
                            inputClassName="text-right font-bold text-rose-950"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mèo mini card */}
                  <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-sky-200 pb-1.5">
                      <span className="text-xs font-bold text-sky-950 flex items-center gap-1">
                        <span>🐱</span> Mèo
                      </span>
                      <strong className="text-xs font-extrabold font-mono-tabular text-sky-950">
                        {formatCurrency(meoTotal)}
                      </strong>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {WALLET_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-1">
                          <span className="text-slate-600 truncate">{f.label}:</span>
                          <MoneyCalculatorInput
                            value={wallets.meo[f.key] === 0 ? '' : formatNumberForSheet(wallets.meo[f.key], false)}
                            onChange={(_str, num) => handleWalletChange('meo', f.key, num)}
                            placeholder="0"
                            size="xs"
                            theme="sky"
                            className="w-28 shrink-0"
                            inputClassName="text-right font-bold text-sky-950"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Money Total */}
              <div className="mt-6 pt-4 border-t-2 border-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    = Tổng tiền thực tế (Heo + Mèo):
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono-tabular">
                    (Tiền mặt + Thẻ + Ví + Cho vay)
                  </span>
                </div>
                <span className="text-base font-extrabold font-mono-tabular text-teal-800">
                  {formatCurrency(totalRealMoney)}
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
                      cycleReconcileStats.discrepancy === 0
                        ? 'text-emerald-700'
                        : cycleReconcileStats.discrepancy < 0
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatCurrency(cycleReconcileStats.discrepancy, true)}
                  </div>

                  <div className="mt-4 p-3.5 rounded-xl border bg-white border-slate-200 text-xs space-y-2">
                    {cycleReconcileStats.discrepancy === 0 ? (
                      <div className="flex items-start gap-2 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                        <div>
                          <strong className="block font-bold">Khớp sổ 100%!</strong>
                          <span className="text-slate-600">Số tiền ngoài đời thực khớp hoàn toàn với số dư lý thuyết theo chu kỳ.</span>
                        </div>
                      </div>
                    ) : cycleReconcileStats.discrepancy < 0 ? (
                      <div className="flex items-start gap-2 text-rose-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <div>
                          <strong className="block font-bold">Hụt {formatCurrency(Math.abs(cycleReconcileStats.discrepancy))}!</strong>
                          <span className="text-slate-600">Có khoản chi tiêu ngoài đời đã tiêu nhưng quên ghi vào bảng chi tiêu.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <strong className="block font-bold">Dư {formatCurrency(cycleReconcileStats.discrepancy)}!</strong>
                          <span className="text-slate-600">Có khoản tiền hoàn/thu vào hoặc trả hộ chưa được trừ ra.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {cycleReconcileStats.discrepancy !== 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleRecordDiscrepancy}
                    className="w-full py-2.5 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>
                      Ghi nhận lệch ({formatCurrency(Math.abs(cycleReconcileStats.discrepancy))})
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1.5 text-center">
                    Mở form mục &ldquo;Khác · Lệch tiền&rdquo; để lưu vào Sheet
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: VÍ & TÀI KHOẢN (4 NGUỒN TIỀN CÓ SẴN CHO HEO & MÈO)
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
                4 nguồn tiền có sẵn cho mỗi người: <strong>Tiền mặt</strong>, <strong>Thẻ</strong>, <strong>Ví điện tử</strong>, và <strong>Đang cho vay</strong>. Chỉ cần nhập số dư khi đối soát, không cần tạo thêm.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 px-4 py-2.5 rounded-xl text-xs">
              <span className="text-teal-800 font-medium">Tổng tài sản 2 người:</span>
              <strong className="text-lg font-extrabold font-mono-tabular text-teal-950">
                {formatCurrency(totalRealMoney)}
              </strong>
            </div>
          </div>

          {/* Dual Columns: Heo vs Mèo (Each has exactly 4 ready-to-input fields) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ═══════ COLUMN HEO ═══════ */}
            <div className="border border-rose-200 rounded-2xl p-6 bg-rose-50/30 space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-rose-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🐷</span>
                  <div>
                    <h3 className="text-base font-extrabold text-rose-950">Ví &amp; Tài Khoản của Heo</h3>
                    <span className="text-xs text-rose-700">4 nguồn tiền chuẩn</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-rose-700 font-medium">Tổng tiền Heo</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-rose-950">
                    {formatCurrency(heoTotal)}
                  </div>
                </div>
              </div>

              {/* 4 Ready Inputs for Heo */}
              <div className="space-y-3.5">
                {WALLET_FIELDS.map((f) => {
                  const IconComp = f.icon;
                  return (
                    <div
                      key={f.key}
                      className="p-3.5 bg-white border border-rose-100 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-rose-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl border shrink-0 ${f.color}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900">{f.label}</div>
                          <span className="text-[11px] text-slate-500 font-medium block truncate">{f.desc}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <MoneyCalculatorInput
                          value={wallets.heo[f.key] === 0 ? '' : formatNumberForSheet(wallets.heo[f.key], false)}
                          onChange={(_str, num) => handleWalletChange('heo', f.key, num)}
                          placeholder="0 ₫"
                          size="md"
                          theme="rose"
                          className="w-44 shrink-0"
                          inputClassName="text-right text-sm font-extrabold text-slate-900 bg-slate-50/50"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══════ COLUMN MÈO ═══════ */}
            <div className="border border-sky-200 rounded-2xl p-6 bg-sky-50/30 space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-sky-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🐱</span>
                  <div>
                    <h3 className="text-base font-extrabold text-sky-950">Ví &amp; Tài Khoản của Mèo</h3>
                    <span className="text-xs text-sky-700">4 nguồn tiền chuẩn</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-sky-700 font-medium">Tổng tiền Mèo</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-sky-950">
                    {formatCurrency(meoTotal)}
                  </div>
                </div>
              </div>

              {/* 4 Ready Inputs for Mèo */}
              <div className="space-y-3.5">
                {WALLET_FIELDS.map((f) => {
                  const IconComp = f.icon;
                  return (
                    <div
                      key={f.key}
                      className="p-3.5 bg-white border border-sky-100 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-sky-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl border shrink-0 ${f.color}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900">{f.label}</div>
                          <span className="text-[11px] text-slate-500 font-medium block truncate">{f.desc}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <MoneyCalculatorInput
                          value={wallets.meo[f.key] === 0 ? '' : formatNumberForSheet(wallets.meo[f.key], false)}
                          onChange={(_str, num) => handleWalletChange('meo', f.key, num)}
                          placeholder="0 ₫"
                          size="md"
                          theme="sky"
                          className="w-44 shrink-0"
                          inputClassName="text-right text-sm font-extrabold text-slate-900 bg-slate-50/50"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
                onClick={() => {
                  const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 26, 25);
                  setBeStartDate(c.startDate);
                  setBeEndDate(c.endDate);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-amber-100 text-amber-900 rounded-lg border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
              >
                Chu kỳ 26/9 – 25/10 (Chuẩn)
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
                onClick={() => {
                  const c = getBillingCycleRange(selectedMonth !== 'ALL' ? selectedMonth : '2026-10', 25, 24);
                  setCreditStartDate(c.startDate);
                  setCreditEndDate(c.endDate);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-900 rounded-lg border border-indigo-300 hover:bg-indigo-200 transition-colors cursor-pointer"
              >
                Sao kê 25/9 – 24/10 (Chuẩn)
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

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="text-xs text-indigo-800 font-medium">Tổng tiền cần thanh toán sao kê Credit</div>
              <div className="text-2xl font-extrabold font-mono-tabular text-indigo-950 mt-2">
                {formatCurrency(creditCycleStats.totalCredit)}
              </div>
              <div className="text-[11px] text-indigo-700 mt-2 font-medium">
                Tổng phát sinh quẹt thẻ tín dụng cần thanh toán trong chu kỳ ({creditStartDate} → {creditEndDate})
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs text-slate-600 font-medium">Số lượng giao dịch quẹt thẻ</div>
              <div className="text-2xl font-extrabold font-mono-tabular text-slate-900 mt-2">
                {creditCycleStats.items.length} <span className="text-sm font-normal text-slate-500">giao dịch</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Trung bình ~{formatCurrency(creditCycleStats.avgPerTransaction)} / giao dịch
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

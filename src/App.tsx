import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  CheckTienSheetData,
  RealWorldAccount,
  TransactionRecord,
} from './types/finance';
import {
  buildItemSuggestions,
  formatCurrency,
  formatMonthLabel,
  formatNumberForSheet,
  parseAttachedExpenseCsv,
  parseDateString,
} from './utils/csvParser';
import {
  googleSignIn,
  initAuth,
  logout,
} from './services/firebaseAuth';
import {
  appendTransactionToSheet,
  fetchCheckTienSheet,
  fetchSpreadsheetMetadata,
  fetchTabTransactions,
  SpreadsheetMetadata,
} from './services/googleSheetsService';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import {
  AddTransactionModal,
  NewTransactionPayload,
} from './components/AddTransactionModal';
import { TransactionLedgerTable } from './components/TransactionLedgerTable';
import { ReconcileCheckTienView } from './components/ReconcileCheckTienView';
import { SheetSyncPanel } from './components/SheetSyncPanel';

type ActiveTab = 'dashboard' | 'ledger' | 'reconcile' | 'sync';

const LOCAL_NEW_ROWS_KEY = 'heomeo_local_new_rows_v1';
const SAVED_SHEET_URL_KEY = 'heomeo_spreadsheet_url_v1';
const SAVED_ACCOUNTS_KEY = 'heomeo_real_accounts_v1';
const SAVED_BASE_INCOME_KEY = 'heomeo_base_income_v1';

const DEFAULT_ACCOUNTS: RealWorldAccount[] = [
  {
    id: 'acc-vietin',
    name: 'Tài khoản Ngân hàng chính (VietinBank / Techcombank)',
    owner: 'Chung',
    type: 'bank',
    balance: 12500000,
    includedInReconcile: true,
  },
  {
    id: 'acc-heo-cash',
    name: 'Tiền mặt & Ví cá nhân Heo',
    owner: 'Heo',
    type: 'cash',
    balance: 1450000,
    includedInReconcile: true,
  },
  {
    id: 'acc-meo-cash',
    name: 'Tiền mặt & Ví cá nhân Mèo',
    owner: 'Mèo',
    type: 'cash',
    balance: 1850000,
    includedInReconcile: true,
  },
  {
    id: 'acc-receivable',
    name: 'Tiền đồng nghiệp / bạn bè chờ chuyển trả (Order chung)',
    owner: 'Chung',
    type: 'receivable',
    balance: 657000,
    includedInReconcile: true,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [attachedRecords, setAttachedRecords] = useState<TransactionRecord[]>([]);
  const [sheetRecords, setSheetRecords] = useState<TransactionRecord[] | null>(null);
  const [localNewRecords, setLocalNewRecords] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_NEW_ROWS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalPreset, setAddModalPreset] =
    useState<Partial<NewTransactionPayload> | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Google Auth & Sheets state (token kept strictly in memory)
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(() => {
    return localStorage.getItem(SAVED_SHEET_URL_KEY) || '';
  });
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMetadata | null>(null);
  const [checkTienData, setCheckTienData] = useState<CheckTienSheetData | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Real-world accounts for "Check tiền" reconciliation
  const [accounts, setAccounts] = useState<RealWorldAccount[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ACCOUNTS;
    } catch {
      return DEFAULT_ACCOUNTS;
    }
  });

  const [monthlyBaseIncome, setMonthlyBaseIncome] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BASE_INCOME_KEY);
      return saved ? Number(saved) : 45000000;
    } catch {
      return 45000000;
    }
  });

  // Save local state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_NEW_ROWS_KEY, JSON.stringify(localNewRecords));
    } catch {
      // ignore storage errors
    }
  }, [localNewRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // ignore
    }
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_BASE_INCOME_KEY, String(monthlyBaseIncome));
    } catch {
      // ignore
    }
  }, [monthlyBaseIncome]);

  const showToast = useCallback((type: 'success' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Load attached CSV on startup
  useEffect(() => {
    let mounted = true;
    async function loadAttachedCsv() {
      try {
        const res = await fetch('/assets/aistudio/Expense___Income_Tracker_1a8ce480');
        if (!res.ok) throw new Error('Không thể tải file dữ liệu đính kèm');
        const text = await res.text();
        const parsed = parseAttachedExpenseCsv(text);
        if (mounted) {
          setAttachedRecords(parsed);
        }
      } catch (err) {
        console.error('Error loading attached CSV:', err);
      } finally {
        if (mounted) setIsLoadingInitial(false);
      }
    }
    loadAttachedCsv();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (loggedInUser, token) => {
        setUser(loggedInUser);
        setAccessToken(token);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Combined active records (Live Google Sheet if synced, otherwise attached CSV + unsynced local additions)
  const allRecords = useMemo(() => {
    if (sheetRecords !== null) {
      const unsynced = localNewRecords.filter((r) => !r.syncedToSheet);
      return [...sheetRecords, ...unsynced];
    }
    return [...attachedRecords, ...localNewRecords];
  }, [sheetRecords, attachedRecords, localNewRecords]);

  // Available months in dataset
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.monthKey && r.monthKey.includes('-')) set.add(r.monthKey);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Records filtered by selectedMonth
  const periodRecords = useMemo(() => {
    if (selectedMonth === 'ALL') return allRecords;
    return allRecords.filter((r) => r.monthKey === selectedMonth);
  }, [allRecords, selectedMonth]);

  // Historical autocomplete suggestions
  const itemSuggestions = useMemo(() => {
    return buildItemSuggestions(allRecords);
  }, [allRecords]);

  // KPI calculations for the selected month / period
  const kpiStats = useMemo(() => {
    let sheetIncome = 0;
    let totalExpense = 0;
    let savingsExpense = 0;
    let livingExpense = 0;
    let negativeExpenseOffsets = 0;
    let totalBeCorp = 0;
    let totalCredit = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    for (const r of periodRecords) {
      if (r.sheetType === 'Income') {
        sheetIncome += r.amount;
        incomeCount += 1;
      } else {
        expenseCount += 1;
        totalExpense += r.amount;
        if (r.category === 'Tiết kiệm') {
          savingsExpense += r.amount;
        } else {
          livingExpense += r.amount;
        }
        if (r.amount < 0) {
          negativeExpenseOffsets += Math.abs(r.amount);
        }
        totalBeCorp += r.beCorp;
        totalCredit += r.credit;
      }
    }

    const monthMultiplier =
      selectedMonth === 'ALL' ? Math.max(1, availableMonths.length) : 1;
    const effectiveIncome =
      sheetIncome > 0 ? sheetIncome : monthlyBaseIncome * monthMultiplier;
    const netBalance = effectiveIncome - totalExpense;

    return {
      sheetIncome,
      effectiveIncome,
      hasSheetIncome: sheetIncome > 0,
      totalExpense,
      savingsExpense,
      livingExpense,
      negativeExpenseOffsets,
      totalBeCorp,
      totalCredit,
      netBalance,
      expenseCount,
      incomeCount,
    };
  }, [periodRecords, monthlyBaseIncome, selectedMonth, availableMonths.length]);

  // Google Sign-In handler
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast('success', `Đã đăng nhập Google (${result.user.email})`);
        if (spreadsheetInput.trim()) {
          await handleConnectAndSyncSheet(spreadsheetInput, result.accessToken);
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Đăng nhập Google thất bại.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setSheetMeta(null);
    showToast('warning', 'Đã ngắt phiên đăng nhập Google.');
  };

  // Connect & Sync with Google Sheet
  const handleConnectAndSyncSheet = async (
    customUrlOrId?: string,
    overrideToken?: string
  ) => {
    const targetInput = (customUrlOrId ?? spreadsheetInput).trim();
    if (!targetInput) {
      setSyncError('Vui lòng dán đường link hoặc ID file Google Sheet của bạn.');
      return;
    }

    let token = overrideToken || accessToken;
    if (!token) {
      try {
        setIsLoggingIn(true);
        const loginRes = await googleSignIn();
        if (!loginRes) return;
        setUser(loginRes.user);
        setAccessToken(loginRes.accessToken);
        token = loginRes.accessToken;
      } catch (err: any) {
        setSyncError(err?.message || 'Vui lòng đăng nhập Google trước khi đồng bộ.');
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      const meta = await fetchSpreadsheetMetadata(targetInput, token);
      setSheetMeta(meta);
      localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

      const [expensesRows, incomeRows, checkTien] = await Promise.all([
        fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', token),
        fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', token),
        meta.checkTienTab
          ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, token)
          : Promise.resolve(null),
      ]);

      setSheetRecords([...expensesRows, ...incomeRows]);
      if (checkTien) {
        setCheckTienData(checkTien);
      }

      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncedAt(nowStr);
      showToast(
        'success',
        `Đã đồng bộ "${meta.title}": ${expensesRows.length} dòng Expenses, ${incomeRows.length} dòng Income${
          checkTien ? `, kèm tab "${checkTien.sheetName}"` : ''
        }.`
      );
    } catch (err: any) {
      setSyncError(err?.message || 'Không thể đồng bộ dữ liệu từ Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Save new transaction (appends to Google Sheet if connected, and updates UI immediately)
  const handleSaveTransaction = async (payload: NewTransactionPayload) => {
    const parsedDate = parseDateString(payload.purchaseDate);
    const newRecord: TransactionRecord = {
      id: `local-${payload.sheetType}-${Date.now()}`,
      sheetType: payload.sheetType,
      purchaseDate: payload.purchaseDate,
      isoDate: parsedDate.isoDate,
      monthKey: parsedDate.monthKey,
      category: payload.category,
      purchaseItem: payload.purchaseItem,
      amount: payload.amount,
      beCorp: payload.beCorp,
      credit: payload.credit,
      note: payload.note,
      source: 'local_new',
      syncedToSheet: false,
    };

    if (sheetMeta && accessToken) {
      const targetTab =
        payload.sheetType === 'Expenses'
          ? sheetMeta.expensesTab
          : sheetMeta.incomeTab;

      await appendTransactionToSheet(
        sheetMeta.spreadsheetId,
        targetTab,
        {
          purchaseDate: payload.purchaseDate,
          category: payload.category,
          purchaseItem: payload.purchaseItem,
          amount: payload.amount,
          beCorp: payload.beCorp,
          credit: payload.credit,
          note: payload.note,
        },
        accessToken
      );

      newRecord.syncedToSheet = true;
      setSheetRecords((prev) => (prev ? [...prev, newRecord] : [newRecord]));
      showToast(
        'success',
        `Đã ghi thêm dòng mới "${payload.purchaseItem}" vào cuối bảng ${targetTab} trên Google Sheet!`
      );
    } else {
      setLocalNewRecords((prev) => [...prev, newRecord]);
      showToast(
        'success',
        `Đã thêm "${payload.purchaseItem}" vào bảng ${payload.sheetType} (Sẵn sàng đẩy lên Google Sheet khi kết nối).`
      );
    }

    // Switch selected month to the new transaction's month if not viewing ALL
    if (selectedMonth !== 'ALL' && selectedMonth !== parsedDate.monthKey) {
      setSelectedMonth(parsedDate.monthKey);
    }
  };

  // Push any pending local rows to Google Sheet
  const handlePushPendingToSheet = async () => {
    if (!sheetMeta || !accessToken) return;
    const pending = localNewRecords.filter((r) => !r.syncedToSheet);
    if (pending.length === 0) return;

    setIsSyncing(true);
    try {
      for (const rec of pending) {
        const targetTab =
          rec.sheetType === 'Expenses'
            ? sheetMeta.expensesTab
            : sheetMeta.incomeTab;
        await appendTransactionToSheet(
          sheetMeta.spreadsheetId,
          targetTab,
          {
            purchaseDate: rec.purchaseDate,
            category: rec.category,
            purchaseItem: rec.purchaseItem,
            amount: rec.amount,
            beCorp: rec.beCorp,
            credit: rec.credit,
            note: rec.note,
          },
          accessToken
        );
      }

      setLocalNewRecords((prev) =>
        prev.map((r) => ({ ...r, syncedToSheet: true }))
      );
      await handleConnectAndSyncSheet(sheetMeta.spreadsheetId, accessToken);
      showToast(
        'success',
        `Đã đẩy thành công ${pending.length} dòng mới lên cuối bảng Google Sheet!`
      );
    } catch (err: any) {
      setSyncError(err?.message || 'Lỗi khi đẩy các dòng chờ lên Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV preserving exact 6-column structure
  const handleExportCsv = () => {
    const header = 'Purchase Date,Category,Purchase Item,Amount,BE Corp,Credit,\r\n';
    const escapeCell = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const body = allRecords
      .filter((r) => r.sheetType === 'Expenses')
      .map((r) => {
        const amt = formatNumberForSheet(r.amount, true);
        const be = r.beCorp !== 0 ? formatNumberForSheet(r.beCorp) : '';
        const cr = r.credit !== 0 ? formatNumberForSheet(r.credit) : '';
        const note = r.note ? escapeCell(r.note) : '';
        return [
          escapeCell(r.purchaseDate),
          escapeCell(r.category),
          escapeCell(r.purchaseItem),
          escapeCell(amt),
          escapeCell(be),
          escapeCell(cr),
          note,
        ].join(',');
      })
      .join('\r\n');

    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expenses_Export_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingUnsyncedCount = useMemo(
    () => localNewRecords.filter((r) => !r.syncedToSheet).length,
    [localNewRecords]
  );

  const totalExpensesCount = useMemo(
    () => allRecords.filter((r) => r.sheetType === 'Expenses').length,
    [allRecords]
  );
  const totalIncomeCount = useMemo(
    () => allRecords.filter((r) => r.sheetType === 'Income').length,
    [allRecords]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          Heo &amp; Mèo Finance
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Tổng quan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'ledger'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Sổ giao dịch
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'reconcile'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Check tiền &amp; Chu kỳ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'sync'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Kết nối Sheet
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setAddModalPreset(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm giao dịch</span>
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Contextual Workspace Toolbar: Month Filter & Sync Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1">
              Kỳ thống kê:
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {availableMonths.map((mKey) => {
                const [y, m] = mKey.split('-');
                const active = selectedMonth === mKey;
                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setSelectedMonth(mKey)}
                    className={`px-3 py-1.5 text-xs font-medium font-mono-tabular rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    T{parseInt(m, 10)}/{y}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedMonth('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedMonth === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({allRecords.length})
              </button>
            </div>
          </div>

          {/* Data Source Status & Quick Sync Action */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {sheetMeta ? (
              <>
                <span>
                  Nguồn: <strong className="text-emerald-700">Google Sheet ({sheetMeta.title})</strong>
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => handleConnectAndSyncSheet(sheetMeta.spreadsheetId)}
                  disabled={isSyncing}
                  className="text-teal-700 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Làm mới Sheet</span>
                </button>
              </>
            ) : (
              <>
                <span>
                  Nguồn: <strong className="text-slate-900">Dữ liệu lịch sử đính kèm ({totalExpensesCount} dòng)</strong>
                </span>
                {pendingUnsyncedCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700 font-medium">
                      +{pendingUnsyncedCount} dòng mới
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  className="text-teal-700 hover:underline font-semibold"
                >
                  Kết nối Google Sheet trực tiếp →
                </button>
              </>
            )}
          </div>
        </div>

        {isLoadingInitial ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Đang nạp dữ liệu lịch sử tài chính của bạn...
          </div>
        ) : (
          <>
            {/* VIEW 1: DASHBOARD TỔNG QUAN */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* 4 KPI SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Tổng Thu */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Tổng thu ({formatMonthLabel(selectedMonth)})</span>
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-2">
                        {formatCurrency(kpiStats.effectiveIncome)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      {kpiStats.hasSheetIncome ? (
                        <span>Từ {kpiStats.incomeCount} khoản bảng Income</span>
                      ) : (
                        <span>Thu nhập định mức (chưa có dòng Income)</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setAddModalPreset({
                            sheetType: 'Income',
                            isoDate:
                              selectedMonth !== 'ALL'
                                ? `${selectedMonth}-01`
                                : '2026-10-01',
                            category: 'Lương Heo',
                          });
                          setIsAddModalOpen(true);
                        }}
                        className="text-teal-700 hover:underline font-medium"
                      >
                        + Ghi thu nhập
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Tổng Chi (Bao gồm Tiết kiệm theo quy tắc) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Tổng chi ({kpiStats.expenseCount} khoản)</span>
                        <ArrowDownRight className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-rose-700 mt-2">
                        {formatCurrency(kpiStats.totalExpense)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono-tabular">
                      <span>Sinh hoạt: {formatCurrency(kpiStats.livingExpense)}</span>
                      <span>·</span>
                      <span className="text-blue-700">
                        Tiết kiệm: {formatCurrency(kpiStats.savingsExpense)}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Số Dư Tháng */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Số dư còn lại (Thu − Chi)</span>
                        <Wallet className="w-4 h-4 text-teal-700" />
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono-tabular mt-2 ${
                          kpiStats.netBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrency(kpiStats.netBalance, true)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Hoàn/Bán đồ: {formatCurrency(kpiStats.negativeExpenseOffsets)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('reconcile')}
                        className="text-teal-700 hover:underline font-medium"
                      >
                        Check tiền thực tế →
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Phát sinh BE Corp & Credit */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Phát sinh Credit &amp; BE Corp</span>
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-indigo-700 mt-2">
                        {formatCurrency(kpiStats.totalCredit + kpiStats.totalBeCorp)}
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono-tabular">
                      <span className="text-amber-700">
                        BE Corp: {formatCurrency(kpiStats.totalBeCorp)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-indigo-700">
                        Credit: {formatCurrency(kpiStats.totalCredit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CHARTS: PIE CHART & MONTHLY BAR CHART */}
                <AnalyticsCharts
                  expensesInPeriod={periodRecords}
                  allRecords={allRecords}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  selectedCategoryFilter={selectedCategory}
                  onSelectCategoryFilter={setSelectedCategory}
                  monthlyBaseIncome={monthlyBaseIncome}
                />

                {/* TRANSACTION TABLE */}
                <TransactionLedgerTable
                  records={periodRecords}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenAddModal={() => {
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                />
              </div>
            )}

            {/* VIEW 2: FULL TRANSACTION LEDGER */}
            {activeTab === 'ledger' && (
              <TransactionLedgerTable
                records={periodRecords}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onOpenAddModal={() => {
                  setAddModalPreset(null);
                  setIsAddModalOpen(true);
                }}
              />
            )}

            {/* VIEW 3: CHECK TIỀN & CHU KỲ BE CORP / CREDIT */}
            {activeTab === 'reconcile' && (
              <ReconcileCheckTienView
                allRecords={allRecords}
                selectedMonth={selectedMonth}
                checkTienData={checkTienData}
                isSheetConnected={Boolean(sheetMeta && accessToken)}
                onOpenAddWithPreset={(preset) => {
                  setAddModalPreset(preset);
                  setIsAddModalOpen(true);
                }}
                onNavigateToSync={() => setActiveTab('sync')}
                accounts={accounts}
                onUpdateAccounts={setAccounts}
                openingOrBaseIncome={monthlyBaseIncome}
                onUpdateOpeningOrBaseIncome={setMonthlyBaseIncome}
              />
            )}

            {/* VIEW 4: GOOGLE SHEET SYNC PANEL */}
            {activeTab === 'sync' && (
              <SheetSyncPanel
                user={user}
                accessToken={accessToken}
                isLoggingIn={isLoggingIn}
                onGoogleLogin={handleGoogleLogin}
                onGoogleLogout={handleGoogleLogout}
                spreadsheetInput={spreadsheetInput}
                onChangeSpreadsheetInput={setSpreadsheetInput}
                sheetMeta={sheetMeta}
                isSyncing={isSyncing}
                syncError={syncError}
                lastSyncedAt={lastSyncedAt}
                onConnectAndSyncSheet={handleConnectAndSyncSheet}
                pendingLocalRecords={localNewRecords.filter((r) => !r.syncedToSheet)}
                onPushPendingToSheet={handlePushPendingToSheet}
                onExportCsv={handleExportCsv}
                totalExpensesCount={totalExpensesCount}
                totalIncomeCount={totalIncomeCount}
              />
            )}
          </>
        )}
      </main>

      {/* ADD TRANSACTION MODAL */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveTransaction}
        suggestions={itemSuggestions}
        isSheetConnected={Boolean(sheetMeta && accessToken)}
        initialPreset={addModalPreset}
      />
    </div>
  );
}

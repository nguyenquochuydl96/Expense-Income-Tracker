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
      let activeToken = token;
      try {
        const meta = await fetchSpreadsheetMetadata(targetInput, activeToken);
        setSheetMeta(meta);
        localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

        const [expensesRows, incomeRows, checkTien] = await Promise.all([
          fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', activeToken),
          fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', activeToken),
          meta.checkTienTab
            ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, activeToken)
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
      } catch (innerErr: any) {
        // If TOKEN_EXPIRED, automatically refresh token via googleSignIn and retry once!
        if (innerErr?.message && innerErr.message.includes('TOKEN_EXPIRED')) {
          showToast('warning', 'Token Google hết hạn, đang tự động làm mới phiên đăng nhập...');
          const freshLogin = await googleSignIn();
          if (!freshLogin) throw new Error('Không thể làm mới token đăng nhập.');
          setUser(freshLogin.user);
          setAccessToken(freshLogin.accessToken);
          activeToken = freshLogin.accessToken;

          // Retry sync with fresh token
          const meta = await fetchSpreadsheetMetadata(targetInput, activeToken);
          setSheetMeta(meta);
          localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

          const [expensesRows, incomeRows, checkTien] = await Promise.all([
            fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', activeToken),
            fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', activeToken),
            meta.checkTienTab
              ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, activeToken)
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
          showToast('success', 'Đã làm mới token và đồng bộ thành công!');
        } else {
          throw innerErr;
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Không thể đồng bộ dữ liệu từ Google Sheet.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Save new transaction (Optimistic Update: add to UI immediately, sync in background)
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
      syncing: false,
    };

    // OPTIMISTIC UPDATE: Add to UI immediately
    if (sheetMeta && accessToken) {
      // Connected: show in UI with syncing badge
      newRecord.syncing = true;
      setSheetRecords((prev) => (prev ? [...prev, newRecord] : [newRecord]));
      showToast('success', `✓ Đã thêm "${payload.purchaseItem}" vào bảng!`);

      // Background sync to Google Sheets
      const targetTab =
        payload.sheetType === 'Expenses'
          ? sheetMeta.expensesTab
          : sheetMeta.incomeTab;

      try {
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

        // Mark as synced
        setSheetRecords((prev) =>
          prev
            ? prev.map((r) =>
                r.id === newRecord.id
                  ? { ...r, syncedToSheet: true, syncing: false }
                  : r
              )
            : prev
        );
      } catch (err: any) {
        // Sync failed: mark as unsynced
        setSheetRecords((prev) =>
          prev
            ? prev.map((r) =>
                r.id === newRecord.id ? { ...r, syncing: false } : r
              )
            : prev
        );
        showToast(
          'warning',
          `Không thể đẩy "${payload.purchaseItem}" lên Google Sheet. Dữ liệu vẫn lưu ở máy.`
        );
      }
    } else {
      // Not connected: save to localNewRecords
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
                {/* 4 KPI SUMMARY CARDS - FINTECH GLASSMORPHISM STYLE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Tổng Thu - Emerald Gradient Accent */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-white border border-emerald-200 rounded-2xl p-5 shadow-lg shadow-emerald-100/50 hover:shadow-xl hover:shadow-emerald-100/60 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Tổng thu</span>
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-extrabold font-mono-tabular text-emerald-700 mb-1">
                        {formatCurrency(kpiStats.effectiveIncome)}
                      </div>
                      <div className="text-xs text-emerald-700/70 font-medium">
                        {formatMonthLabel(selectedMonth)}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-emerald-200/50 flex items-center justify-between text-xs">
                      {kpiStats.hasSheetIncome ? (
                        <span className="text-slate-600">{kpiStats.incomeCount} khoản Income</span>
                      ) : (
                        <span className="text-slate-500">Thu nhập định mức</span>
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
                        className="text-emerald-700 hover:text-emerald-900 font-semibold"
                      >
                        + Ghi thu
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Tổng Chi - Rose Gradient Accent */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-white border border-rose-200 rounded-2xl p-5 shadow-lg shadow-rose-100/50 hover:shadow-xl hover:shadow-rose-100/60 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-rose-900/70 uppercase tracking-wide">Tổng chi</span>
                        <div className="p-2 bg-rose-100 rounded-lg">
                          <ArrowDownRight className="w-4 h-4 text-rose-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-extrabold font-mono-tabular text-rose-700 mb-1">
                        {formatCurrency(kpiStats.totalExpense)}
                      </div>
                      <div className="text-xs text-rose-700/70 font-medium">
                        {kpiStats.expenseCount} khoản chi tiêu
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-rose-200/50 flex items-center justify-between text-[11px] font-mono-tabular">
                      <span className="text-slate-600">
                        Sinh hoạt: <strong className="text-slate-900">{formatCurrency(kpiStats.livingExpense)}</strong>
                      </span>
                      <span className="text-blue-700 font-semibold">
                        TK: {formatCurrency(kpiStats.savingsExpense)}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Số Dư - Slate/Teal Gradient */}
                  <div className={`relative overflow-hidden bg-gradient-to-br ${
                    kpiStats.netBalance >= 0 
                      ? 'from-teal-50 via-white to-white border-teal-200 shadow-teal-100/50 hover:shadow-teal-100/60' 
                      : 'from-red-50 via-white to-white border-red-200 shadow-red-100/50 hover:shadow-red-100/60'
                  } border rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 ${
                      kpiStats.netBalance >= 0 ? 'bg-teal-500/10' : 'bg-red-500/10'
                    } rounded-full blur-3xl -mr-16 -mt-16`}></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          kpiStats.netBalance >= 0 ? 'text-teal-900/70' : 'text-red-900/70'
                        }`}>Số dư</span>
                        <div className={`p-2 rounded-lg ${
                          kpiStats.netBalance >= 0 ? 'bg-teal-100' : 'bg-red-100'
                        }`}>
                          <Wallet className={`w-4 h-4 ${
                            kpiStats.netBalance >= 0 ? 'text-teal-700' : 'text-red-600'
                          }`} />
                        </div>
                      </div>
                      <div
                        className={`text-3xl font-extrabold font-mono-tabular mb-1 ${
                          kpiStats.netBalance >= 0 ? 'text-teal-700' : 'text-red-700'
                        }`}
                      >
                        {formatCurrency(kpiStats.netBalance, true)}
                      </div>
                      <div className={`text-xs font-medium ${
                        kpiStats.netBalance >= 0 ? 'text-teal-700/70' : 'text-red-700/70'
                      }`}>
                        Thu − Chi còn lại
                      </div>
                    </div>
                    <div className={`mt-4 pt-3 border-t ${
                      kpiStats.netBalance >= 0 ? 'border-teal-200/50' : 'border-red-200/50'
                    } flex items-center justify-between text-xs`}>
                      <span className="text-slate-600">
                        Hoàn: {formatCurrency(kpiStats.negativeExpenseOffsets)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('reconcile')}
                        className={`font-semibold ${
                          kpiStats.netBalance >= 0 ? 'text-teal-700 hover:text-teal-900' : 'text-red-700 hover:text-red-900'
                        }`}
                      >
                        Check tiền →
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Credit & BE Corp - Indigo/Amber Gradient */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-white border border-indigo-200 rounded-2xl p-5 shadow-lg shadow-indigo-100/50 hover:shadow-xl hover:shadow-indigo-100/60 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide">Phát sinh</span>
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <CreditCard className="w-4 h-4 text-indigo-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-extrabold font-mono-tabular text-indigo-700 mb-1">
                        {formatCurrency(kpiStats.totalCredit + kpiStats.totalBeCorp)}
                      </div>
                      <div className="text-xs text-indigo-700/70 font-medium">
                        Credit &amp; BE Corp
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-indigo-200/50 flex items-center justify-between text-[11px] font-mono-tabular">
                      <span className="text-amber-700 font-semibold">
                        BE: {formatCurrency(kpiStats.totalBeCorp)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-indigo-700 font-semibold">
                        CR: {formatCurrency(kpiStats.totalCredit)}
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
        allRecords={allRecords}
      />

      {/* GLOBAL SYNC STATUS FLOATING BADGE */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl shadow-lg border text-xs font-medium transition-all ${
            isSyncing
              ? 'bg-teal-50 border-teal-200 text-teal-800'
              : sheetMeta && accessToken
              ? 'bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50'
              : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
          }`}
        >
          {isSyncing ? (
            <>
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping"></span>
              <span>Đang đồng bộ Google Sheets...</span>
            </>
          ) : sheetMeta && accessToken ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Đã kết nối Sheet {lastSyncedAt ? `(Sync lúc ${lastSyncedAt})` : ''}</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Chưa kết nối Google Sheet (Click để cấu hình)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

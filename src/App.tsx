import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
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
import { DashboardDualTables } from './components/DashboardDualTables';
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

  // Combined active records
  const allRecords = useMemo(() => {
    if (sheetRecords !== null) {
      const unsynced = localNewRecords.filter((r) => !r.syncedToSheet);
      return [...sheetRecords, ...unsynced];
    }
    return [...attachedRecords, ...localNewRecords];
  }, [sheetRecords, attachedRecords, localNewRecords]);

  // Unique categories list
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.category && r.sheetType === 'Expenses') set.add(r.category);
    });
    return Array.from(set).sort();
  }, [allRecords]);

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
        if (innerErr?.message && innerErr.message.includes('TOKEN_EXPIRED')) {
          showToast('warning', 'Token Google hết hạn, đang tự động làm mới phiên đăng nhập...');
          const freshLogin = await googleSignIn();
          if (!freshLogin) throw new Error('Không thể làm mới token đăng nhập.');
          setUser(freshLogin.user);
          setAccessToken(freshLogin.accessToken);
          activeToken = freshLogin.accessToken;

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

  // Save new transaction (Optimistic Update)
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

    if (sheetMeta && accessToken) {
      newRecord.syncing = true;
      setSheetRecords((prev) => (prev ? [...prev, newRecord] : [newRecord]));
      showToast('success', `✓ Đã thêm "${payload.purchaseItem}" vào bảng!`);

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
      setLocalNewRecords((prev) => [...prev, newRecord]);
      showToast(
        'success',
        `Đã thêm "${payload.purchaseItem}" vào bảng ${payload.sheetType} (Sẵn sàng đẩy lên Google Sheet khi kết nối).`
      );
    }

    if (selectedMonth !== 'ALL' && selectedMonth !== parsedDate.monthKey) {
      setSelectedMonth(parsedDate.monthKey);
    }
  };

  // Push pending to sheet
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

  // Export CSV
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EEF2F6' }}>
      {/* ═══════ TOP HEADER (Xero Coupler Curved Dark Navy Banner) ═══════ */}
      <div className="w-full pt-0">
        <header
          className="w-full px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white shadow-md rounded-br-[36px] sm:rounded-br-[48px]"
          style={{
            backgroundColor: '#132247',
          }}
        >
          {/* Left Brand: Circular Logo + Name (Matching Reference Image) */}
          <div className="flex items-center gap-3.5">
            {/* Circular Coupler-style logo */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs">
              <div className="w-7 h-7 rounded-lg bg-[#0077B6] flex items-center justify-center">
                <span className="text-white font-black text-sm tracking-tighter">HM</span>
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Billing dashboard for Heo &amp; Mèo
              </h1>
              <span className="text-[10px] tracking-wider font-semibold text-sky-300 uppercase block -mt-0.5">
                HEOMEO.FINANCE
              </span>
            </div>
          </div>

          {/* Right Action Buttons (Matching Reference Image) */}
          <div className="flex items-center gap-3">
            {/* Explore more dashboards button (Lavender pill) */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'dashboard' ? 'ledger' : 'dashboard')}
              className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: '#E0E7FF',
                color: '#3730A3',
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{activeTab === 'dashboard' ? 'Xem sổ chi tiết' : 'Về Dashboard'}</span>
            </button>

            {/* Set up dashboard button (Dark purple pill) */}
            <button
              type="button"
              onClick={() => {
                setAddModalPreset(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: '#2E1065',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm giao dịch</span>
            </button>
          </div>
        </header>
      </div>

      {/* Navigation Sub-bar */}
      <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 pt-3 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'ledger'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sổ giao dịch ({periodRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'reconcile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Check tiền &amp; Đối soát
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'sync'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Sheet ({sheetMeta ? 'Đã kết nối' : 'Chưa sync'})
          </button>
        </nav>

        {/* Sync status badge */}
        {sheetMeta && accessToken ? (
          <button
            type="button"
            onClick={() => handleConnectAndSyncSheet(sheetMeta.spreadsheetId)}
            disabled={isSyncing}
            className="text-[11px] font-medium text-emerald-800 hover:underline flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
            <span>Sheet: {sheetMeta.title}</span>
          </button>
        ) : null}
      </div>

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
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* ═══════ FLOATING FILTER BAR (Matching Reference Image) ═══════ */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter 1: Date Range Selector with Calendar Icon */}
          <div className="relative bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center px-3 py-2 gap-2 text-xs font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer pr-6 appearance-none text-slate-800 font-semibold"
              >
                {availableMonths.map((mKey) => {
                  const [y, m] = mKey.split('-');
                  return (
                    <option key={mKey} value={mKey}>
                      Tháng {parseInt(m, 10)}, {y}
                    </option>
                  );
                })}
                <option value="ALL">Tất cả thời gian ({allRecords.length} giao dịch)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
            </div>
          </div>

          {/* Filter 2: Category Dropdown (Matching "Customer" dropdown in reference image) */}
          <div className="relative bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center px-3 py-2 gap-2 text-xs font-medium text-slate-700">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer pr-6 appearance-none text-slate-800 font-semibold"
              >
                <option value="ALL">Tất cả danh mục (Category)</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
            </div>
          </div>

          {/* Reset Filter Button if active */}
          {(selectedMonth !== '2026-10' || selectedCategory !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('2026-10');
                setSelectedCategory('ALL');
              }}
              className="text-xs text-sky-700 hover:text-sky-900 font-medium px-2 py-1"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        {isLoadingInitial ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Đang nạp dữ liệu lịch sử tài chính của bạn...
          </div>
        ) : (
          <>
            {/* VIEW 1: DASHBOARD (Matching Reference Image) */}
            {activeTab === 'dashboard' && (
              <div className="space-y-5">
                {/* ═══════ 4 KPI SUMMARY CARDS (Exact Match to Reference Colors & Layout) ═══════ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Deep Blue (Matching Unpaid Invoices Amount) */}
                  <div
                    className="rounded-xl p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: '#0B4B8A' }}
                    onClick={() => {
                      setAddModalPreset({
                        sheetType: 'Income',
                        isoDate: selectedMonth !== 'ALL' ? `${selectedMonth}-01` : '2026-10-01',
                        category: 'Lương Heo',
                      });
                      setIsAddModalOpen(true);
                    }}
                  >
                    <div className="text-xs font-semibold text-white/90 tracking-wide mb-1.5">
                      Tổng thu nhập
                    </div>
                    <div className="text-3xl font-extrabold font-mono-tabular text-white mb-3">
                      {formatCurrency(kpiStats.effectiveIncome)}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] italic text-white/70">in home currency</span>
                    </div>
                  </div>

                  {/* Card 2: Ocean Blue (Matching Overdue Amount) */}
                  <div
                    className="rounded-xl p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: '#0077B6' }}
                    onClick={() => setActiveTab('ledger')}
                  >
                    <div className="text-xs font-semibold text-white/90 tracking-wide mb-1.5">
                      Tổng chi tiêu
                    </div>
                    <div className="text-3xl font-extrabold font-mono-tabular text-white mb-3">
                      {formatCurrency(kpiStats.totalExpense)}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] italic text-white/70">in home currency</span>
                    </div>
                  </div>

                  {/* Card 3: Mint/Teal Green (Matching Overdue Invoices 30+ Days) */}
                  <div
                    className="rounded-xl p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: '#059669' }}
                    onClick={() => setActiveTab('reconcile')}
                  >
                    <div className="text-xs font-semibold text-white/90 tracking-wide mb-1.5">
                      Số dư khả dụng (Net)
                    </div>
                    <div className="text-3xl font-extrabold font-mono-tabular text-white mb-3">
                      {formatCurrency(kpiStats.netBalance, true)}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] italic text-white/70">in home currency</span>
                    </div>
                  </div>

                  {/* Card 4: Purple/Violet (Matching Overdue Invoices 90+ Days) */}
                  <div
                    className="rounded-xl p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: '#6D3894' }}
                    onClick={() => setActiveTab('ledger')}
                  >
                    <div className="text-xs font-semibold text-white/90 tracking-wide mb-1.5">
                      Phát sinh BE Corp &amp; Credit
                    </div>
                    <div className="text-3xl font-extrabold font-mono-tabular text-white mb-3">
                      {formatCurrency(kpiStats.totalCredit + kpiStats.totalBeCorp)}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] italic text-white/70">in home currency</span>
                    </div>
                  </div>
                </div>

                {/* ═══════ MIDDLE ROW: HORIZONTAL BAR CHART + CORAL DONUT CHART ═══════ */}
                <AnalyticsCharts
                  expensesInPeriod={periodRecords}
                  allRecords={allRecords}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  selectedCategoryFilter={selectedCategory}
                  onSelectCategoryFilter={setSelectedCategory}
                  monthlyBaseIncome={monthlyBaseIncome}
                />

                {/* ═══════ BOTTOM ROW: TWO DUAL DATA TABLES (Matching Reference Image) ═══════ */}
                <DashboardDualTables
                  records={periodRecords}
                  allRecords={allRecords}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenAddModal={() => {
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                  onViewFullLedger={() => setActiveTab('ledger')}
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
    </div>
  );
}

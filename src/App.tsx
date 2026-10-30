import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
  LayoutGrid,
  CalendarRange,
  Filter,
  Bot,
  Trash2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  BudgetTransferRecord,
  CheckTienSheetData,
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
  getBillingCycleRange,
  isBudgetTransferRecord,
} from './utils/cycleUtils';
import { SEED_INCOME_RECORDS, SEED_BUDGET_TRANSFERS } from './utils/seedData';
import {
  googleSignIn,
  initAuth,
  logout,
  getStoredAccessToken,
  clearStoredAccessToken,
} from './services/firebaseAuth';
import {
  appendBudgetTransferToSheet,
  appendTransactionToSheet,
  deleteTransactionFromSheet,
  extractSpreadsheetId,
  fetchBudgetTransfersSheet,
  fetchCheckTienSheet,
  fetchSpreadsheetMetadata,
  fetchTabTransactions,
  SpreadsheetMetadata,
  updateTransactionOnSheet,
} from './services/googleSheetsService';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import {
  AddTransactionModal,
  NewTransactionPayload,
} from './components/AddTransactionModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { TransactionLedgerTable } from './components/TransactionLedgerTable';
import { DashboardDualTables } from './components/DashboardDualTables';
import { MultiMonthSummaryTable } from './components/MultiMonthSummaryTable';
import {
  CategoryBudgetTable,
  DEFAULT_CATEGORY_PERCENTAGES,
  DEFAULT_CATEGORY_PERCENTAGES_T4_T7,
  computeMultiMonthRollover,
  SAVED_CATEGORY_PERCENTAGES_KEY,
  SAVED_ROLLOVER_MODE_KEY,
  RolloverMode,
} from './components/CategoryBudgetTable';
import { ReconcileCheckTienView } from './components/ReconcileCheckTienView';
import { SheetSyncPanel } from './components/SheetSyncPanel';
import { TelegramBotModal } from './components/TelegramBotModal';

type ActiveTab = 'dashboard' | 'ledger' | 'reconcile' | 'sync';

const LOCAL_NEW_ROWS_KEY = 'heomeo_local_new_rows_v1';
const SAVED_SHEET_URL_KEY = 'heomeo_spreadsheet_url_v1';
const SAVED_BASE_INCOME_KEY = 'heomeo_base_income_v1';
const SAVED_SHEET_RECORDS_KEY = 'heomeo_cached_sheet_records_v1';
const SAVED_SHEET_META_KEY = 'heomeo_cached_sheet_meta_v1';
const SAVED_CHECK_TIEN_KEY = 'heomeo_cached_check_tien_v1';
const SAVED_LAST_SYNCED_KEY = 'heomeo_last_synced_at_v1';
const SAVED_BUDGET_TRANSFERS_KEY = 'heomeo_cached_budget_transfers_v1';



export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [attachedRecords, setAttachedRecords] = useState<TransactionRecord[]>([]);
  const [sheetRecords, setSheetRecords] = useState<TransactionRecord[] | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_SHEET_RECORDS_KEY);
      if (!saved) return null;
      const parsed: TransactionRecord[] = JSON.parse(saved);
      // Self-heal: purge cache if corrupted with 0-amount salaries, missing Luong BE, or old migrated income items
      const invalidIncome = parsed.some(
        (r) => r.sheetType === 'Income' && (r.category?.includes('Lương') || r.category?.includes('Thu')) && r.amount === 0
      );
      const missingLuongBe = !parsed.some(
        (r) => r.sheetType === 'Income' && r.monthKey === '2026-10' && (r.category?.includes('BE') || r.purchaseItem?.includes('Mèo'))
      );
      const hasOldMigratedIncome = parsed.some(
        (r) => r.sheetType === 'Income' && (r.purchaseItem?.includes('Slay the Spire') || r.purchaseItem?.includes('Nyota') || r.purchaseItem?.includes('PS4'))
      );
      if (invalidIncome || missingLuongBe || hasOldMigratedIncome) {
        localStorage.removeItem(SAVED_SHEET_RECORDS_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [localNewRecords, setLocalNewRecords] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_NEW_ROWS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [budgetTransfers, setBudgetTransfers] = useState<BudgetTransferRecord[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BUDGET_TRANSFERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length >= 8 &&
          parsed.some((b: any) => b.description?.includes('Slay the Spire'))
        ) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    try {
      localStorage.removeItem(SAVED_BUDGET_TRANSFERS_KEY);
    } catch {
      // ignore
    }
    return SEED_BUDGET_TRANSFERS;
  });

  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Cycle start/end day configuration for BE Corp and Credit
  const [beCorpStartDay, setBeCorpStartDay] = useState<number>(26);
  const [beCorpEndDay, setBeCorpEndDay] = useState<number>(25);
  const [creditStartDay, setCreditStartDay] = useState<number>(25);
  const [creditEndDay, setCreditEndDay] = useState<number>(24);

  // Toggle for secondary analytics charts (Bar & Donut)
  const [showCharts, setShowCharts] = useState<boolean>(false);

  // Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalPreset, setAddModalPreset] =
    useState<Partial<NewTransactionPayload> | null>(null);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);

  // Edit & Delete Transaction modal state
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast notification
  const [toast, setToast] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Google Auth & Sheets state (token kept strictly in memory)
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(() => {
    return localStorage.getItem(SAVED_SHEET_URL_KEY) || 'https://docs.google.com/spreadsheets/d/1CTSEC-J52yGD-VIxOuzyNZ8Qddg0bmOIzMSzRVM6ZTI/edit';
  });
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMetadata | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_SHEET_META_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [checkTienData, setCheckTienData] = useState<CheckTienSheetData | null>(() => {
    try {
      const saved = localStorage.getItem(SAVED_CHECK_TIEN_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem(SAVED_LAST_SYNCED_KEY) || null;
  });

  const [monthlyBaseIncome, setMonthlyBaseIncome] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SAVED_BASE_INCOME_KEY);
      return saved ? Number(saved) : 45000000;
    } catch {
      return 45000000;
    }
  });

  // Reference hooks to prevent stale closures and concurrent sync calls
  const isSyncingRef = useRef<boolean>(false);
  const localNewRecordsRef = useRef<TransactionRecord[]>(localNewRecords);
  localNewRecordsRef.current = localNewRecords;
  const budgetTransfersRef = useRef<BudgetTransferRecord[]>(budgetTransfers);
  budgetTransfersRef.current = budgetTransfers;
  const sheetRecordsRef = useRef<TransactionRecord[] | null>(sheetRecords);
  sheetRecordsRef.current = sheetRecords;

  // Save local state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_NEW_ROWS_KEY, JSON.stringify(localNewRecords));
    } catch {
      // ignore storage errors
    }
  }, [localNewRecords]);

  useEffect(() => {
    if (budgetTransfers.length > 0) {
      try {
        localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(budgetTransfers));
      } catch (e) {
        console.warn('Cannot persist budgetTransfers', e);
      }
    }
  }, [budgetTransfers]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_BASE_INCOME_KEY, String(monthlyBaseIncome));
    } catch {
      // ignore
    }
  }, [monthlyBaseIncome]);

  useEffect(() => {
    if (sheetRecords !== null) {
      try {
        localStorage.setItem(SAVED_SHEET_RECORDS_KEY, JSON.stringify(sheetRecords));
      } catch (e) {
        console.warn('Cannot persist sheetRecords', e);
      }
    }
  }, [sheetRecords]);

  useEffect(() => {
    if (sheetMeta !== null) {
      try {
        localStorage.setItem(SAVED_SHEET_META_KEY, JSON.stringify(sheetMeta));
      } catch (e) {
        console.warn('Cannot persist sheetMeta', e);
      }
    }
  }, [sheetMeta]);

  useEffect(() => {
    if (lastSyncedAt !== null) {
      try {
        localStorage.setItem(SAVED_LAST_SYNCED_KEY, lastSyncedAt);
      } catch (e) {
        // ignore
      }
    }
  }, [lastSyncedAt]);

  useEffect(() => {
    if (checkTienData !== null) {
      try {
        localStorage.setItem(SAVED_CHECK_TIEN_KEY, JSON.stringify(checkTienData));
      } catch (e) {
        // ignore
      }
    }
  }, [checkTienData]);

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
        const assetUrl = `${import.meta.env.BASE_URL || './'}assets/aistudio/Expense___Income_Tracker_1a8ce480`;
        let res = await fetch(assetUrl).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch('./assets/aistudio/Expense___Income_Tracker_1a8ce480').catch(() => null);
        }
        if (!res || !res.ok) {
          res = await fetch('/assets/aistudio/Expense___Income_Tracker_1a8ce480').catch(() => null);
        }
        if (!res || !res.ok) throw new Error('Không thể tải file dữ liệu đính kèm');
        const text = await res.text();
        const parsed = parseAttachedExpenseCsv(text);
        if (mounted) {
          setAttachedRecords([...parsed, ...SEED_INCOME_RECORDS]);
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

  // Initialize Firebase Auth listener with auto-sync on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (loggedInUser, token) => {
        setUser(loggedInUser);
        setAccessToken(token);
        const targetUrl = localStorage.getItem(SAVED_SHEET_URL_KEY) || 'https://docs.google.com/spreadsheets/d/1CTSEC-J52yGD-VIxOuzyNZ8Qddg0bmOIzMSzRVM6ZTI/edit';
        if (targetUrl) {
          handleConnectAndSyncSheet(targetUrl, token);
        }
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
      const sheetIds = new Set(sheetRecords.map((r) => r.id));
      const dedupedUnsynced = unsynced.filter((r) => !sheetIds.has(r.id));
      return [...sheetRecords, ...dedupedUnsynced];
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

  // Records filtered by selectedMonth (Calendar month: 1st to 30/31st)
  const periodRecords = useMemo(() => {
    if (selectedMonth === 'ALL') return allRecords;
    return allRecords.filter((r) => r.monthKey === selectedMonth);
  }, [allRecords, selectedMonth]);

  // Historical autocomplete suggestions
  const itemSuggestions = useMemo(() => {
    return buildItemSuggestions(allRecords);
  }, [allRecords]);

  // Cycle range calculations for BE Corp and Credit for the active month
  const activeBeCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : '2026-10',
      beCorpStartDay,
      beCorpEndDay
    );
  }, [selectedMonth, beCorpStartDay, beCorpEndDay]);

  const activeCreditCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : '2026-10',
      creditStartDay,
      creditEndDay
    );
  }, [selectedMonth, creditStartDay, creditEndDay]);

  // KPI calculations (Separating BE Corp & Credit into their own independent cycles)
  const kpiStats = useMemo(() => {
    let sheetIncome = 0;
    let totalExpense = 0;
    let savingsExpense = 0;
    let livingExpense = 0;
    let negativeExpenseOffsets = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    for (const r of periodRecords) {
      if (r.sheetType === 'Income') {
        sheetIncome += r.amount;
        incomeCount += 1;
      } else {
        // Exclude budget transfers between categories from living/total expense consumption
        if (isBudgetTransferRecord(r)) {
          continue;
        }
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
      }
    }

    // Thu nhập lấy trực tiếp từ các khoản ghi trong sheet Income của kỳ đang chọn
    const effectiveIncome = sheetIncome;
    const netBalance = effectiveIncome - totalExpense;

    // Distinct cycle calculations for BE Corp and Credit
    let beCorpCycleTotal = 0;
    let beCorpCount = 0;
    let creditCycleTotal = 0;
    let creditCount = 0;

    if (selectedMonth === 'ALL') {
      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (r.beCorp > 0) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (r.credit > 0) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    } else {
      // Filter by respective cycle dates
      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (
            r.beCorp > 0 &&
            r.isoDate >= activeBeCycle.startDate &&
            r.isoDate <= activeBeCycle.endDate
          ) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (
            r.credit > 0 &&
            r.isoDate >= activeCreditCycle.startDate &&
            r.isoDate <= activeCreditCycle.endDate
          ) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    }

    return {
      sheetIncome,
      effectiveIncome,
      hasSheetIncome: sheetIncome > 0,
      totalExpense,
      savingsExpense,
      livingExpense,
      negativeExpenseOffsets,
      beCorpCycleTotal,
      beCorpCount,
      creditCycleTotal,
      creditCount,
      beRange: activeBeCycle,
      creditRange: activeCreditCycle,
      netBalance,
      expenseCount,
      incomeCount,
    };
  }, [
    periodRecords,
    allRecords,
    monthlyBaseIncome,
    selectedMonth,
    availableMonths.length,
    activeBeCycle,
    activeCreditCycle,
  ]);

  // Category-specific KPI metrics when selectedCategory !== 'ALL'
  const categoryKpiStats = useMemo(() => {
    if (selectedCategory === 'ALL') return null;

    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : '2026-10';

    let hasCustomPercentages = false;
    let customPercentages: Record<string, number> = {};
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_PERCENTAGES_KEY);
      if (saved) {
        customPercentages = JSON.parse(saved);
        const isIdenticalToDefault = Object.entries(DEFAULT_CATEGORY_PERCENTAGES).every(
          ([k, v]) => Math.abs((customPercentages[k] ?? 0) - v) < 0.05
        );
        if (!isIdenticalToDefault) {
          hasCustomPercentages = true;
        }
      }
    } catch {
      // ignore
    }

    let rolloverMode: RolloverMode = 'full';
    try {
      const saved = localStorage.getItem(SAVED_ROLLOVER_MODE_KEY) as RolloverMode;
      if (saved && ['full', 'deficit_only', 'none'].includes(saved)) {
        rolloverMode = saved;
      }
    } catch {
      // ignore
    }

    const rolloverResult = computeMultiMonthRollover(
      allRecords,
      budgetTransfers,
      customPercentages,
      rolloverMode,
      hasCustomPercentages
    );

    const catStats = rolloverResult.chain[selectedCategory]?.[targetMonth];

    const catRecords = periodRecords.filter(
      (r) => r.category === selectedCategory && r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)
    );
    const spent = catStats ? catStats.spent : catRecords.reduce((s, r) => s + r.amount, 0);
    const beCorp = catRecords.reduce((s, r) => s + r.beCorp, 0);
    const credit = catRecords.reduce((s, r) => s + r.credit, 0);
    const count = catStats ? catStats.txCount : catRecords.length;

    const baseBudget = catStats
      ? catStats.baseBudget
      : Math.round((kpiStats.effectiveIncome * (DEFAULT_CATEGORY_PERCENTAGES[selectedCategory] ?? 0)) / 100);
    const carryover = catStats ? catStats.carryover : 0;
    const netTransfer = catStats ? catStats.netTransfer : 0;
    const effectiveBudget = catStats ? catStats.effectiveBudget : baseBudget;
    const remaining = catStats ? catStats.remaining : effectiveBudget - spent;
    const percentage = catStats
      ? catStats.percentage
      : (DEFAULT_CATEGORY_PERCENTAGES[selectedCategory] ?? 0);

    return {
      category: selectedCategory,
      budget: effectiveBudget,
      baseBudget,
      carryover,
      netTransfer,
      spent,
      remaining,
      beCorp,
      credit,
      count,
      percentage,
    };
  }, [selectedCategory, allRecords, budgetTransfers, periodRecords, selectedMonth, kpiStats.effectiveIncome]);

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

  // Connect & Sync with Google Sheet (with auto-push of offline/pending transactions and transfers)
  const handleConnectAndSyncSheet = async (
    customUrlOrId?: string,
    overrideToken?: string,
    silent?: boolean
  ) => {
    if (isSyncingRef.current) {
      console.log('Sync already in progress, skipping duplicate call.');
      return;
    }

    const targetInput = (customUrlOrId ?? spreadsheetInput).trim();
    if (!targetInput) {
      setSyncError('Vui lòng dán đường link hoặc ID file Google Sheet của bạn.');
      return;
    }

    let token = overrideToken || accessToken || getStoredAccessToken();
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

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    const executeSync = async (currentToken: string) => {
      const meta = await fetchSpreadsheetMetadata(targetInput, currentToken);
      setSheetMeta(meta);
      localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

      const savedIncomeTab = localStorage.getItem('heomeo_custom_income_tab_v1');
      if (savedIncomeTab && meta.sheetNames.includes(savedIncomeTab)) {
        meta.incomeTab = savedIncomeTab;
      }
      const savedExpensesTab = localStorage.getItem('heomeo_custom_expenses_tab_v1');
      if (savedExpensesTab && meta.sheetNames.includes(savedExpensesTab)) {
        meta.expensesTab = savedExpensesTab;
      }

      // --- 1. AUTO-PUSH PENDING LOCAL TRANSACTIONS ---
      const pendingMap = new Map<string, TransactionRecord>();
      (localNewRecordsRef.current || []).forEach((r) => {
        if (!r.syncedToSheet) pendingMap.set(r.id, r);
      });
      try {
        const saved = localStorage.getItem(LOCAL_NEW_ROWS_KEY);
        if (saved) {
          const parsed: TransactionRecord[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((r) => {
              if (!r.syncedToSheet) pendingMap.set(r.id, r);
            });
          }
        }
      } catch {
        // ignore
      }
      (sheetRecordsRef.current || []).forEach((r) => {
        if (r.source === 'local_new' && !r.syncedToSheet) {
          pendingMap.set(r.id, r);
        }
      });

      const pendingTransactions = Array.from(pendingMap.values());
      const pushedTxIds = new Set<string>();

      if (pendingTransactions.length > 0) {
        // Sort chronologically
        pendingTransactions.sort((a, b) => a.isoDate.localeCompare(b.isoDate));

        setLocalNewRecords((prev) =>
          prev.map((r) => (pendingMap.has(r.id) ? { ...r, syncing: true } : r))
        );

        for (const rec of pendingTransactions) {
          const targetTab = rec.sheetType === 'Expenses' ? meta.expensesTab : meta.incomeTab;
          try {
            await appendTransactionToSheet(
              meta.spreadsheetId,
              targetTab,
              {
                sheetType: rec.sheetType,
                purchaseDate: rec.purchaseDate,
                category: rec.category,
                purchaseItem: rec.purchaseItem,
                amount: rec.amount,
                beCorp: rec.beCorp,
                credit: rec.credit,
                note: rec.note,
              },
              currentToken
            );
            pushedTxIds.add(rec.id);
          } catch (pushErr: any) {
            console.error(`Error auto-pushing transaction ${rec.id}:`, pushErr);
            if (
              pushErr?.message &&
              (pushErr.message.includes('TOKEN_EXPIRED') || pushErr.message.includes('401'))
            ) {
              throw pushErr;
            }
          }
        }

        if (pushedTxIds.size > 0) {
          setLocalNewRecords((prev) => {
            const remaining = prev.filter((r) => !pushedTxIds.has(r.id));
            try {
              localStorage.setItem(LOCAL_NEW_ROWS_KEY, JSON.stringify(remaining));
            } catch {}
            return remaining;
          });
        }
      }

      // --- 2. AUTO-PUSH PENDING BUDGET TRANSFERS ---
      const pendingTransfersMap = new Map<string, BudgetTransferRecord>();
      (budgetTransfersRef.current || []).forEach((t) => {
        if (t.source === 'local_new' && !t.syncedToSheet) {
          pendingTransfersMap.set(t.id, t);
        }
      });
      try {
        const savedBt = localStorage.getItem(SAVED_BUDGET_TRANSFERS_KEY);
        if (savedBt) {
          const parsedBt: BudgetTransferRecord[] = JSON.parse(savedBt);
          if (Array.isArray(parsedBt)) {
            parsedBt.forEach((t) => {
              if (t.source === 'local_new' && !t.syncedToSheet) {
                pendingTransfersMap.set(t.id, t);
              }
            });
          }
        }
      } catch {
        // ignore
      }

      const pendingTransfers = Array.from(pendingTransfersMap.values());
      const pushedBtIds = new Set<string>();

      if (pendingTransfers.length > 0) {
        pendingTransfers.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
        const btTab = meta.budgetTransfersTab || 'Budget Transfers';
        for (const transfer of pendingTransfers) {
          try {
            await appendBudgetTransferToSheet(
              meta.spreadsheetId,
              btTab,
              {
                date: transfer.date,
                fromCategory: transfer.fromCategory,
                toCategory: transfer.toCategory,
                amount: transfer.amount,
                description: transfer.description,
              },
              currentToken
            );
            pushedBtIds.add(transfer.id);
          } catch (pushErr: any) {
            console.error(`Error auto-pushing transfer ${transfer.id}:`, pushErr);
            if (
              pushErr?.message &&
              (pushErr.message.includes('TOKEN_EXPIRED') || pushErr.message.includes('401'))
            ) {
              throw pushErr;
            }
          }
        }

        if (pushedBtIds.size > 0) {
          setBudgetTransfers((prev) => {
            const updated = prev.map((t) =>
              pushedBtIds.has(t.id) ? { ...t, syncedToSheet: true } : t
            );
            try {
              localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      }

      // --- 3. FETCH ALL LATEST ROWS DIRECTLY FROM GOOGLE SHEETS ---
      const [expensesRows, incomeRows, checkTien, liveTransfers] = await Promise.all([
        fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', currentToken),
        fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', currentToken),
        meta.checkTienTab
          ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, currentToken)
          : Promise.resolve(null),
        meta.budgetTransfersTab
          ? fetchBudgetTransfersSheet(meta.spreadsheetId, meta.budgetTransfersTab, currentToken)
          : Promise.resolve([]),
      ]);

      setSheetRecords([...expensesRows, ...incomeRows]);
      if (checkTien) {
        setCheckTienData(checkTien);
      }
      if (liveTransfers && liveTransfers.length > 0) {
        setBudgetTransfers(liveTransfers);
        try {
          localStorage.setItem(SAVED_BUDGET_TRANSFERS_KEY, JSON.stringify(liveTransfers));
        } catch {}
      }

      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSyncedAt(nowStr);

      return {
        meta,
        pushedCount: pushedTxIds.size + pushedBtIds.size,
        expensesCount: expensesRows.length,
        incomeCount: incomeRows.length,
        checkTienTab: checkTien?.sheetName,
      };
    };

    try {
      let activeToken = token;
      try {
        const res = await executeSync(activeToken);
        if (res.pushedCount > 0) {
          showToast(
            'success',
            `✓ Đã tự động đồng bộ ${res.pushedCount} giao dịch chờ lên Google Sheet!`
          );
        } else if (!silent) {
          showToast(
            'success',
            `Đã đồng bộ "${res.meta.title}": ${res.expensesCount} dòng Expenses, ${res.incomeCount} dòng Income${
              res.checkTienTab ? `, kèm tab "${res.checkTienTab}"` : ''
            }.`
          );
        }
      } catch (innerErr: any) {
        if (
          innerErr?.message &&
          (innerErr.message.includes('TOKEN_EXPIRED') || innerErr.message.includes('401'))
        ) {
          showToast('warning', 'Token Google hết hạn, đang tự động làm mới phiên đăng nhập...');
          const freshLogin = await googleSignIn();
          if (!freshLogin) throw new Error('Không thể làm mới token đăng nhập.');
          setUser(freshLogin.user);
          setAccessToken(freshLogin.accessToken);
          activeToken = freshLogin.accessToken;

          const res = await executeSync(activeToken);
          if (res.pushedCount > 0) {
            showToast(
              'success',
              `✓ Đã tự động đồng bộ ${res.pushedCount} giao dịch chờ lên Google Sheet!`
            );
          } else if (!silent) {
            showToast('success', 'Đã làm mới token và đồng bộ thành công!');
          }
        } else {
          throw innerErr;
        }
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Không thể đồng bộ dữ liệu từ Google Sheet.');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  const handleSaveTransfer = async (transfer: {
    date: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    description: string;
    isoDate: string;
  }) => {
    const parts = transfer.date.split('/');
    const monthKey = parts.length === 3 ? `${parts[2]}-${parts[0].padStart(2, '0')}` : selectedMonth;
    const newTransfer: BudgetTransferRecord = {
      id: `local-bt-${Date.now()}`,
      date: transfer.date,
      isoDate: transfer.isoDate,
      monthKey,
      fromCategory: transfer.fromCategory,
      toCategory: transfer.toCategory,
      amount: transfer.amount,
      description: transfer.description,
      source: 'local_new',
      syncedToSheet: false,
    };

    setBudgetTransfers((prev) => [newTransfer, ...prev]);

    if (accessToken && sheetMeta?.spreadsheetId) {
      const tabName = sheetMeta.budgetTransfersTab || 'Budget Transfers';
      try {
        await appendBudgetTransferToSheet(
          sheetMeta.spreadsheetId,
          tabName,
          {
            date: transfer.date,
            fromCategory: transfer.fromCategory,
            toCategory: transfer.toCategory,
            amount: transfer.amount,
            description: transfer.description,
          },
          accessToken
        );
        setBudgetTransfers((prev) =>
          prev.map((t) => (t.id === newTransfer.id ? { ...t, syncedToSheet: true } : t))
        );
        showToast('success', `Đã chuyển ngân sách thành công vào tab "${tabName}" trên Google Sheet!`);
      } catch (err: any) {
        console.error('Failed to append budget transfer to sheet:', err);
        showToast('warning', `Đã lưu tạm điều chuyển vào máy (Google Sheet: ${err.message})`);
      }
    } else {
      showToast('success', 'Đã lưu điều chuyển ngân sách (offline)!');
    }
  };

  // Save new transaction(s) (Optimistic Update)
  const handleSaveTransaction = async (
    payloadOrList: NewTransactionPayload | NewTransactionPayload[]
  ) => {
    const list = Array.isArray(payloadOrList) ? payloadOrList : [payloadOrList];
    if (list.length === 0) return;

    const createdRecords: TransactionRecord[] = [];

    for (let i = 0; i < list.length; i++) {
      const payload = list[i];
      const parsedDate = parseDateString(payload.purchaseDate);
      const newRecord: TransactionRecord = {
        id: `local-${payload.sheetType}-${Date.now()}-${i}`,
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
      createdRecords.push(newRecord);
    }

    const effectiveToken = accessToken || getStoredAccessToken();
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);

    if (effectiveSheetId && effectiveToken) {
      createdRecords.forEach((r) => (r.syncing = true));
      setSheetRecords((prev) => (prev ? [...prev, ...createdRecords] : [...attachedRecords, ...createdRecords]));
      showToast(
        'success',
        createdRecords.length > 1
          ? `✓ Đang tự động lưu & đồng bộ ${createdRecords.length} dòng lên Google Sheet...`
          : `✓ Đang tự động lưu & đồng bộ "${createdRecords[0].purchaseItem}" lên Google Sheet...`
      );

      const expensesTab = sheetMeta?.expensesTab || 'Expenses';
      const incomeTab = sheetMeta?.incomeTab || 'Income';

      let anyError = false;
      for (const record of createdRecords) {
        const targetTab =
          record.sheetType === 'Expenses'
            ? expensesTab
            : incomeTab;

        try {
          await appendTransactionToSheet(
            effectiveSheetId,
            targetTab,
            {
              sheetType: record.sheetType,
              purchaseDate: record.purchaseDate,
              category: record.category,
              purchaseItem: record.purchaseItem,
              amount: record.amount,
              beCorp: record.beCorp,
              credit: record.credit,
              note: record.note,
            },
            effectiveToken
          );

          setSheetRecords((prev) =>
            prev
              ? prev.map((r) =>
                  r.id === record.id
                    ? { ...r, syncedToSheet: true, syncing: false }
                    : r
                )
              : prev
          );
        } catch (err: any) {
          anyError = true;
          setSheetRecords((prev) =>
            prev ? prev.filter((r) => r.id !== record.id) : prev
          );
          if (err?.message?.includes('TOKEN_EXPIRED') || err?.message?.includes('401')) {
            clearStoredAccessToken();
            setAccessToken(null);
          }
          showToast(
            'warning',
            `Không thể tự động đẩy "${record.purchaseItem}" lên Google Sheet (${err?.message || 'Lỗi kết nối'}). Đã lưu trên máy.`
          );
          setLocalNewRecords((prev) => [...prev, { ...record, syncing: false, syncedToSheet: false }]);
        }
      }

      if (!anyError) {
        showToast(
          'success',
          createdRecords.length > 1
            ? `✓ Đã tự động đồng bộ thành công ${createdRecords.length} dòng lên Google Sheet!`
            : `✓ Đã tự động đồng bộ thành công "${createdRecords[0].purchaseItem}" lên Google Sheet!`
        );
        // Live background sync to pull newest row indices & update balances
        handleConnectAndSyncSheet(effectiveSheetId, effectiveToken, true).catch(console.error);
      }
    } else {
      setLocalNewRecords((prev) => [...prev, ...createdRecords]);
      showToast(
        'warning',
        createdRecords.length > 1
          ? `Đã lưu tạm ${createdRecords.length} giao dịch trên máy (Chưa kết nối Google Sheet). Bấm đồng bộ để đẩy lên Sheet.`
          : `Đã lưu tạm "${createdRecords[0].purchaseItem}" trên máy (Chưa kết nối Google Sheet). Bấm đồng bộ để đẩy lên Sheet.`
      );
    }

    if (createdRecords.length > 0 && selectedMonth !== 'ALL' && selectedMonth !== createdRecords[0].monthKey) {
      setSelectedMonth(createdRecords[0].monthKey);
    }
  };

  // Edit transaction handler
  const handleSaveEditedTransaction = async (updated: TransactionRecord) => {
    const effectiveToken = accessToken || getStoredAccessToken();
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);

    // 1. Optimistic update
    setSheetRecords((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev
    );
    setLocalNewRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );

    // 2. If already on Google Sheet
    if (updated.rowIndex && effectiveSheetId && effectiveToken) {
      const expensesTab = sheetMeta?.expensesTab || 'Expenses';
      const incomeTab = sheetMeta?.incomeTab || 'Income';
      const originalRecord = (sheetRecords || []).find((r) => r.id === updated.id);
      const originalSheetType = originalRecord?.sheetType ?? updated.sheetType;
      const originalTab = originalSheetType === 'Income' ? incomeTab : expensesTab;
      const targetTab = updated.sheetType === 'Income' ? incomeTab : expensesTab;

      if (originalTab !== targetTab) {
        // Tab changed: delete from old tab and append to new tab
        const oldSheetId =
          sheetMeta?.sheetIdsByName?.[originalTab] ??
          (originalRecord?.sheetType === 'Income' ? 392215035 : 1528073380);
        await deleteTransactionFromSheet(effectiveSheetId, oldSheetId, updated.rowIndex, effectiveToken);
        await appendTransactionToSheet(
          effectiveSheetId,
          targetTab,
          {
            sheetType: updated.sheetType,
            purchaseDate: updated.purchaseDate,
            category: updated.category,
            purchaseItem: updated.purchaseItem,
            amount: updated.amount,
            beCorp: updated.beCorp,
            credit: updated.credit,
            note: updated.note,
          },
          effectiveToken
        );
      } else {
        await updateTransactionOnSheet(
          effectiveSheetId,
          targetTab,
          updated.rowIndex,
          {
            sheetType: updated.sheetType,
            purchaseDate: updated.purchaseDate,
            category: updated.category,
            purchaseItem: updated.purchaseItem,
            amount: updated.amount,
            beCorp: updated.beCorp,
            credit: updated.credit,
            note: updated.note,
          },
          effectiveToken
        );
      }

      showToast('success', `✓ Đã cập nhật "${updated.purchaseItem}" trên Google Sheet!`);
      // Background sync to refresh overviews and recalculate balances
      handleConnectAndSyncSheet(effectiveSheetId, effectiveToken, true).catch(console.error);
    } else {
      showToast('success', `✓ Đã cập nhật giao dịch "${updated.purchaseItem}"!`);
    }
  };

  // Delete transaction handler
  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return;
    const target = deletingTransaction;
    const effectiveToken = accessToken || getStoredAccessToken();
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);

    setIsDeleting(true);
    try {
      // 1. Optimistic remove
      setSheetRecords((prev) => (prev ? prev.filter((r) => r.id !== target.id) : prev));
      setLocalNewRecords((prev) => prev.filter((r) => r.id !== target.id));
      setAttachedRecords((prev) => prev.filter((r) => r.id !== target.id));

      // 2. If it is on Google Sheet
      if (target.rowIndex && effectiveSheetId && effectiveToken) {
        const expensesTab = sheetMeta?.expensesTab || 'Expenses';
        const incomeTab = sheetMeta?.incomeTab || 'Income';
        const tabName = target.sheetType === 'Income' ? incomeTab : expensesTab;
        const sheetId =
          sheetMeta?.sheetIdsByName?.[tabName] ??
          (target.sheetType === 'Income' ? 392215035 : 1528073380);

        await deleteTransactionFromSheet(effectiveSheetId, sheetId, target.rowIndex, effectiveToken);
        showToast('success', `✓ Đã xóa vĩnh viễn dòng #${target.rowIndex} ("${target.purchaseItem}") khỏi Google Sheet!`);
        // Background sync to re-index all rows
        handleConnectAndSyncSheet(effectiveSheetId, effectiveToken, true).catch(console.error);
      } else {
        showToast('success', `✓ Đã xóa giao dịch "${target.purchaseItem}"!`);
      }

      setDeletingTransaction(null);
    } catch (err: any) {
      showToast('warning', `Không thể xóa giao dịch: ${err?.message || 'Lỗi không xác định'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Push pending to sheet (delegates to handleConnectAndSyncSheet which auto-pushes all pending)
  const handlePushPendingToSheet = async () => {
    const effectiveToken = accessToken || getStoredAccessToken();
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!effectiveSheetId) return;
    await handleConnectAndSyncSheet(effectiveSheetId, effectiveToken || undefined);
  };

  const handleSelectIncomeTab = async (tabName: string) => {
    if (!sheetMeta) return;
    const token = accessToken || getStoredAccessToken();
    try {
      localStorage.setItem('heomeo_custom_income_tab_v1', tabName);
      const updatedMeta = { ...sheetMeta, incomeTab: tabName };
      setSheetMeta(updatedMeta);
      if (token) {
        setIsSyncing(true);
        const incomeRows = await fetchTabTransactions(sheetMeta.spreadsheetId, tabName, 'Income', token);
        setSheetRecords((prev) => {
          const expenses = (prev || []).filter((r) => r.sheetType === 'Expenses');
          return [...expenses, ...incomeRows];
        });
        showToast('success', `Đã chuyển sang Bảng Thu nhập "${tabName}": tìm thấy ${incomeRows.length} dòng.`);
      } else {
        showToast('warning', `Đã chọn Bảng Thu nhập "${tabName}". Vui lòng kết nối Google Sheet để tải dữ liệu.`);
      }
    } catch (err: any) {
      showToast('warning', `Lỗi đọc tab "${tabName}": ${err?.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectExpensesTab = async (tabName: string) => {
    if (!sheetMeta) return;
    const token = accessToken || getStoredAccessToken();
    try {
      localStorage.setItem('heomeo_custom_expenses_tab_v1', tabName);
      const updatedMeta = { ...sheetMeta, expensesTab: tabName };
      setSheetMeta(updatedMeta);
      if (token) {
        setIsSyncing(true);
        const expenseRows = await fetchTabTransactions(sheetMeta.spreadsheetId, tabName, 'Expenses', token);
        setSheetRecords((prev) => {
          const incomes = (prev || []).filter((r) => r.sheetType === 'Income');
          return [...expenseRows, ...incomes];
        });
        showToast('success', `Đã chuyển sang Bảng Chi tiêu "${tabName}": tìm thấy ${expenseRows.length} dòng.`);
      } else {
        showToast('warning', `Đã chọn Bảng Chi tiêu "${tabName}". Vui lòng kết nối Google Sheet để tải dữ liệu.`);
      }
    } catch (err: any) {
      showToast('warning', `Lỗi đọc tab "${tabName}": ${err?.message}`);
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
          {/* Left Brand */}
          <div className="flex items-center gap-3.5">
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

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
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
            Đồng bộ dữ liệu ({sheetRecords && sheetRecords.length > 0 ? (accessToken ? 'Đã kết nối' : 'Đã lưu máy') : 'Chưa kết nối'})
          </button>
          <button
            type="button"
            onClick={() => setIsTelegramModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/70 transition-all shadow-2xs font-semibold"
            title="Mở hướng dẫn & cú pháp Telegram Bot Quick-Add"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bot Telegram</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] bg-indigo-200 text-indigo-800 font-bold">Mới</span>
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
            <span>Dữ liệu: {sheetMeta.title}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleConnectAndSyncSheet()}
            disabled={isSyncing}
            className="text-[11px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-amber-700' : 'text-amber-700'}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}</span>
          </button>
        )}
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
        {/* ═══════ FLOATING FILTER BAR ═══════ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter 1: Date Range Selector (Month: 01 to 30/31st) */}
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
                        Tháng {parseInt(m, 10)}, {y} (01/{m} – Hết tháng)
                      </option>
                    );
                  })}
                  <option value="ALL">Tất cả thời gian ({allRecords.length} giao dịch)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
              </div>
            </div>

            {/* Filter 2: Category Dropdown (Only show on dashboard and ledger tabs) */}
            {(activeTab === 'dashboard' || activeTab === 'ledger') && (
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
            )}

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

          {/* Quick cycle info pill */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono-tabular">
            <span className="hidden sm:inline">Chu kỳ BE: <strong>{kpiStats.beRange.displayLabel}</strong></span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Sao kê Credit: <strong>{kpiStats.creditRange.displayLabel}</strong></span>
          </div>
        </div>

        {/* ═══════ ACTIVE CATEGORY FILTER BANNER ═══════ */}
        {selectedCategory !== 'ALL' && (activeTab === 'dashboard' || activeTab === 'ledger') && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
              <span>
                Đang lọc riêng theo danh mục: <strong className="font-extrabold text-sky-950 text-sm">{selectedCategory}</strong>
                {selectedMonth !== 'ALL' ? ` · Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : ' · Tất cả thời gian'}
                {' · '}
                <strong>{categoryKpiStats?.count || 0}</strong> giao dịch
                {' · '}
                Tổng chi: <strong className="font-mono-tabular font-bold text-sky-950 text-sm">{formatCurrency(categoryKpiStats?.spent || 0)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className="px-3 py-1 font-semibold text-xs text-sky-800 bg-white hover:bg-sky-100 border border-sky-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              ✕ Xem tất cả danh mục
            </button>
          </div>
        )}

        {isLoadingInitial ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Đang nạp dữ liệu lịch sử tài chính của bạn...
          </div>
        ) : (
          <>
            {/* VIEW 1: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-5">
                {/* ═══════ 5 KPI CARDS (General vs Category-specific) ═══════ */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {categoryKpiStats ? (
                    <>
                      {/* Category Card 1: Ngân sách danh mục (Budget) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#0B4B8A' }}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1 truncate">
                          Ngân sách khả dụng · {categoryKpiStats.category}
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(categoryKpiStats.budget)}
                        </div>
                        <div className="text-[11px] text-white/80 font-medium truncate flex items-center gap-1.5 flex-wrap">
                          <span>Định mức: {formatCurrency(categoryKpiStats.baseBudget)}</span>
                          {categoryKpiStats.carryover !== 0 && (
                            <span>· Lũy kế: {categoryKpiStats.carryover > 0 ? '+' : ''}{formatCurrency(categoryKpiStats.carryover)}</span>
                          )}
                          {categoryKpiStats.netTransfer !== 0 && (
                            <span>· Chuyển quỹ: {categoryKpiStats.netTransfer > 0 ? '+' : ''}{formatCurrency(categoryKpiStats.netTransfer)}</span>
                          )}
                        </div>
                      </div>

                      {/* Category Card 2: Đã chi danh mục */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#0077B6' }}
                        onClick={() => setActiveTab('ledger')}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1 truncate">
                          Đã chi · {categoryKpiStats.category}
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(categoryKpiStats.spent)}
                        </div>
                        <div className="text-xs text-white/70 font-medium">
                          {categoryKpiStats.count} giao dịch trong kỳ
                        </div>
                      </div>

                      {/* Category Card 3: Còn lại danh mục (Dương / Âm) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: categoryKpiStats.remaining >= 0 ? '#059669' : '#DC2626' }}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1 truncate">
                          {categoryKpiStats.remaining >= 0 ? 'Còn lại (Dư)' : 'Bội chi (Âm)'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {categoryKpiStats.remaining >= 0 ? '+' : ''}{formatCurrency(categoryKpiStats.remaining)}
                        </div>
                        <div className="text-xs text-white/80 font-medium truncate">
                          {categoryKpiStats.remaining >= 0 ? 'Trong hạn mức khả dụng' : 'Vượt quá định mức tháng!'}
                        </div>
                      </div>

                      {/* Category Card 4: BE Corp cho danh mục */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#D97706' }}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1 truncate">
                          BE Corp ({categoryKpiStats.category})
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(categoryKpiStats.beCorp)}
                        </div>
                        <div className="text-xs text-white/80 font-medium">
                          Thanh toán qua ví công ty
                        </div>
                      </div>

                      {/* Category Card 5: Credit cho danh mục */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs transition-transform hover:-translate-y-0.5 col-span-2 sm:col-span-1"
                        style={{ backgroundColor: '#6D3894' }}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1 truncate">
                          Credit ({categoryKpiStats.category})
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(categoryKpiStats.credit)}
                        </div>
                        <div className="text-xs text-white/80 font-medium">
                          Thanh toán qua thẻ tín dụng
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Card 1: Tổng thu nhập (Deep Blue) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#0B4B8A' }}
                        onClick={() => {
                          setAddModalPreset({
                            sheetType: 'Income',
                            isoDate: selectedMonth !== 'ALL' ? `${selectedMonth}-01` : '2026-10-01',
                            category: 'Lương Yes4All',
                          });
                          setIsAddModalOpen(true);
                        }}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1">
                          Tổng thu nhập
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(kpiStats.effectiveIncome)}
                        </div>
                        <div className="text-xs text-white/70 font-medium">
                          {selectedMonth === 'ALL'
                            ? `Tất cả các tháng · ${kpiStats.incomeCount} khoản thu`
                            : kpiStats.incomeCount > 0
                              ? `${formatMonthLabel(selectedMonth)} · ${kpiStats.incomeCount} khoản thu`
                              : `${formatMonthLabel(selectedMonth)} · Chưa có giao dịch`}
                        </div>
                      </div>

                      {/* Card 2: Tổng chi tiêu (Ocean Blue - Calendar Month) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#0077B6' }}
                        onClick={() => setActiveTab('ledger')}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1">
                          Tổng chi tiêu
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(kpiStats.totalExpense)}
                        </div>
                        <div className="text-xs text-white/70 font-medium">
                          {kpiStats.expenseCount} giao dịch (01/{selectedMonth.split('-')[1]} – Hết tháng)
                        </div>
                      </div>

                      {/* Card 3: Số dư khả dụng Net Balance (Mint Green or Red) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: kpiStats.netBalance >= 0 ? '#059669' : '#DC2626' }}
                        onClick={() => setActiveTab('reconcile')}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1">
                          Số dư khả dụng (Net)
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(kpiStats.netBalance)}
                        </div>
                        <div className="text-xs text-white/70 font-medium">
                          Thu − Chi còn lại
                        </div>
                      </div>

                      {/* Card 4: Ví BE Corp (Riêng biệt - Amber / Orange) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#D97706' }}
                        onClick={() => setActiveTab('reconcile')}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1">
                          Ví BE Corp
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(kpiStats.beCorpCycleTotal)}
                        </div>
                        <div className="text-xs text-white/80 font-medium flex items-center gap-1 font-mono-tabular">
                          <CalendarRange className="w-3 h-3 text-white/70" />
                          <span>{kpiStats.beRange.displayLabel}</span>
                        </div>
                      </div>

                      {/* Card 5: Thẻ tín dụng Credit (Riêng biệt - Purple / Violet) */}
                      <div
                        className="rounded-xl p-4 sm:p-5 shadow-xs cursor-pointer transition-transform hover:-translate-y-0.5 col-span-2 sm:col-span-1"
                        style={{ backgroundColor: '#6D3894' }}
                        onClick={() => setActiveTab('reconcile')}
                      >
                        <div className="text-xs font-semibold text-white/90 tracking-wide mb-1">
                          Thẻ tín dụng (Credit)
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mb-2 truncate">
                          {formatCurrency(kpiStats.creditCycleTotal)}
                        </div>
                        <div className="text-xs text-white/80 font-medium flex items-center gap-1 font-mono-tabular">
                          <CalendarRange className="w-3 h-3 text-white/70" />
                          <span>Sao kê: {kpiStats.creditRange.displayLabel}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ═══════ MULTI-MONTH BUDGET & CASHFLOW SUMMARY MATRIX (Answers Requirement 5) ═══════ */}
                <MultiMonthSummaryTable
                  allRecords={allRecords}
                  availableMonths={availableMonths}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  monthlyBaseIncome={monthlyBaseIncome}
                  beCorpStartDay={beCorpStartDay}
                  beCorpEndDay={beCorpEndDay}
                  creditStartDay={creditStartDay}
                  creditEndDay={creditEndDay}
                />

                {/* ═══════ MỚI: NGÂN SÁCH & CHI TIÊU THEO HẠNG MỤC (Budget · Đã chi · Còn lại) ═══════ */}
                <CategoryBudgetTable
                  recordsInPeriod={periodRecords}
                  allRecords={allRecords}
                  totalIncome={kpiStats.effectiveIncome}
                  selectedMonth={selectedMonth}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  showChartsButton={true}
                  onShowCharts={() => setShowCharts((prev) => !prev)}
                  onOpenTransfer={() => {
                    setAddModalPreset({ note: 'TRANSFER_MODE' });
                    setIsAddModalOpen(true);
                  }}
                  budgetTransfers={budgetTransfers}
                />

                {/* ═══════ OPTIONAL: BIỂU ĐỒ BỔ TRỢ (TOP CHI TIÊU & TỶ TRỌNG) KHI BẬT ═══════ */}
                {showCharts && (
                  <AnalyticsCharts
                    expensesInPeriod={periodRecords}
                    allRecords={allRecords}
                    selectedMonth={selectedMonth}
                    onSelectMonth={setSelectedMonth}
                    selectedCategoryFilter={selectedCategory}
                    onSelectCategoryFilter={setSelectedCategory}
                    monthlyBaseIncome={monthlyBaseIncome}
                  />
                )}

                {/* ═══════ BOTTOM ROW: TWO DUAL DATA TABLES ═══════ */}
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
                onEditTransaction={setEditingTransaction}
                onDeleteTransaction={setDeletingTransaction}
                onPushPendingToSheet={handlePushPendingToSheet}
                isSyncing={isSyncing}
              />
            )}

            {/* VIEW 3: CHECK TIỀN & CHU KỲ BE CORP / CREDIT */}
            {activeTab === 'reconcile' && (
              <ReconcileCheckTienView
                allRecords={allRecords}
                selectedMonth={selectedMonth}
                onOpenAddWithPreset={(preset) => {
                  setAddModalPreset(preset);
                  setIsAddModalOpen(true);
                }}
                checkTienData={checkTienData}
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
                onSelectIncomeTab={handleSelectIncomeTab}
                onSelectExpensesTab={handleSelectExpensesTab}
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
        onSaveTransfer={handleSaveTransfer}
        suggestions={itemSuggestions}
        isSheetConnected={Boolean((sheetMeta || spreadsheetInput) && (accessToken || getStoredAccessToken()))}
        initialPreset={addModalPreset}
        allRecords={allRecords}
        onGoogleLogin={handleGoogleLogin}
        expensesTabName={sheetMeta?.expensesTab || 'Expenses'}
        incomeTabName={sheetMeta?.incomeTab || 'Income'}
      />

      {/* TELEGRAM BOT QUICK-ADD MODAL */}
      <TelegramBotModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        spreadsheetUrl={spreadsheetInput}
      />

      {/* EDIT TRANSACTION MODAL */}
      <EditTransactionModal
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        record={editingTransaction}
        onSave={handleSaveEditedTransaction}
        onDeleteRequest={(rec) => {
          setEditingTransaction(null);
          setDeletingTransaction(rec);
        }}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa giao dịch</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bạn có chắc chắn muốn xóa vĩnh viễn giao dịch này?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mục chi tiêu:</span>
                <span className="font-semibold text-slate-900">{deletingTransaction.purchaseItem}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày:</span>
                <span className="font-mono-tabular text-slate-700">{deletingTransaction.purchaseDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Danh mục:</span>
                <span className="text-slate-700">{deletingTransaction.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số tiền:</span>
                <span className="font-mono-tabular font-bold text-rose-700">
                  {formatCurrency(deletingTransaction.amount)}
                </span>
              </div>
              {deletingTransaction.rowIndex && (
                <div className="flex justify-between border-t border-slate-200/80 pt-1.5 mt-1.5">
                  <span className="text-slate-500">Mã giao dịch:</span>
                  <span className="font-mono-tabular text-teal-700 font-medium">
                    {deletingTransaction.sheetType === 'Income' ? 'Thu nhập' : 'Chi tiêu'} #{deletingTransaction.rowIndex}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-rose-600 bg-rose-50/80 border border-rose-200 rounded-lg p-2.5">
              ⚠️ Thao tác này sẽ xóa vĩnh viễn giao dịch khỏi hệ thống và cập nhật lại toàn bộ ngân sách. Không thể hoàn tác.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTransaction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
  Moon,
  Sun,
  Palette,
  Share2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeftRight,
  LayoutDashboard,
  ReceiptText,
  Scale,
} from 'lucide-react';
import { PigIcon, SiameseCatIcon } from './utils/categoryIcons';
import { AppLockScreen, isDeviceUnlocked, lockDevice } from './components/AppLockScreen';
import { usePrivacyMode } from './utils/privacyService';
import { useThemeMode } from './utils/themeService';
import { PwaInstallModal } from './components/PwaInstallModal';
import { CalendarHeatmapView } from './components/CalendarHeatmapView';
import { MonthlyReportCardModal } from './components/MonthlyReportCardModal';
import { MultiMonthPickerDropdown, formatSelectedMonthsDisplay } from './components/MultiMonthPickerDropdown';
import { MultiCategoryPickerDropdown } from './components/MultiCategoryPickerDropdown';
import { AnimatedCurrency } from './components/AnimatedCurrency';
import { TiltCard } from './components/TiltCard';
import { RealisticBankCard } from './components/RealisticBankCard';
import { CashflowSegmentedBar } from './components/CashflowSegmentedBar';
import { KinloCashflowCard } from './components/KinloCashflowCard';
import { KinloBankAccountsCard } from './components/KinloBankAccountsCard';
import {
  animateCardsEntrance,
  animateIconBounce,
  useKinloInteractions,
  triggerFloatUp,
} from './utils/kinloAnimations';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import {
  BudgetTransferRecord,
  CheckTienSheetData,
  EXPENSE_CATEGORIES,
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
import {
  isAppsScriptUrl,
  appsScriptSyncAll,
  DEFAULT_WEB_APP_URL,
  getStoredWebAppUrl,
} from './services/appsScriptService';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import {
  AddTransactionModal,
  NewTransactionPayload,
} from './components/AddTransactionModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { TransactionLedgerTable } from './components/TransactionLedgerTable';
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



const formatTodayDate = (): string => {
  const now = new Date();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[now.getDay()];
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${dayName}, ${d}/${m}/${y}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => (typeof window !== 'undefined' && (window as any).__initialTab) || 'dashboard');
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
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('unlocked') === 'true') {
      return true;
    }
    return isDeviceUnlocked();
  });
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });
  const userHasManuallySelectedMonthRef = useRef<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Cycle start/end day configuration for BE Corp and Credit
  const [beCorpStartDay, setBeCorpStartDay] = useState<number>(26);
  const [beCorpEndDay, setBeCorpEndDay] = useState<number>(25);
  const [creditStartDay, setCreditStartDay] = useState<number>(20);
  const [creditEndDay, setCreditEndDay] = useState<number>(19);

  // Privacy mode (Masking/Unmasking financial numbers)
  const { isPrivate, togglePrivacy } = usePrivacyMode();

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Theme mode (Light / Dark) & Theme Preset (Kinlo / Cofra)
  const { isDark, toggleTheme, preset, togglePreset, activeConfig } = useThemeMode();

  // Monthly Report Card Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

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

  // Kinlo Animation refs & interactive micro-interactions (magnetic buttons & card lift)
  const dashboardRef = useRef<HTMLDivElement>(null);
  useKinloInteractions(undefined, [activeTab, preset]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (activeTab === 'dashboard' && dashboardRef.current) {
      const cards = dashboardRef.current.querySelectorAll('.kinlo-card, .kinlo-card-night, [data-card-entrance]');
      if (cards.length > 0) {
        animateCardsEntrance(cards);
      }
    }
  }, [activeTab]);

  // Global Keyboard shortcuts: Alt + P (Privacy), Alt + N (Thêm nhanh giao dịch), Escape (Đóng modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        togglePrivacy();
        return;
      }
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setAddModalPreset(null);
        setIsAddModalOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (deletingTransaction) {
          setDeletingTransaction(null);
          return;
        }
        if (editingTransaction) {
          setEditingTransaction(null);
          return;
        }
        if (isAddModalOpen) {
          setIsAddModalOpen(false);
          return;
        }
        if (isReportModalOpen) {
          setIsReportModalOpen(false);
          return;
        }
        if (isTelegramModalOpen) {
          setIsTelegramModalOpen(false);
          return;
        }
        if (isInstallModalOpen) {
          setIsInstallModalOpen(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    togglePrivacy,
    deletingTransaction,
    editingTransaction,
    isAddModalOpen,
    isReportModalOpen,
    isTelegramModalOpen,
    isInstallModalOpen,
  ]);

  // Google Auth & Sheets state (token kept strictly in memory)
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(() => {
    const saved = localStorage.getItem(SAVED_SHEET_URL_KEY);
    if (saved && isAppsScriptUrl(saved)) return saved;
    const storedWebApp = getStoredWebAppUrl();
    if (storedWebApp) return storedWebApp;
    return saved || DEFAULT_WEB_APP_URL;
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

  // Auto-sync on load for Web App API (works without any Google login)
  useEffect(() => {
    const targetUrl = spreadsheetInput || getStoredWebAppUrl() || DEFAULT_WEB_APP_URL;
    if (isAppsScriptUrl(targetUrl)) {
      handleConnectAndSyncSheet(targetUrl, '', true).catch((err) => {
        console.warn('Initial background Web App sync:', err);
      });
    }
  }, []);

  // Initialize Firebase Auth listener with auto-sync on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (loggedInUser, token) => {
        setUser(loggedInUser);
        setAccessToken(token);
        const targetUrl = localStorage.getItem(SAVED_SHEET_URL_KEY) || DEFAULT_WEB_APP_URL;
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
    let combined: TransactionRecord[];
    if (sheetRecords !== null) {
      const unsynced = localNewRecords.filter((r) => !r.syncedToSheet);
      const sheetIds = new Set(sheetRecords.map((r) => r.id));
      const dedupedUnsynced = unsynced.filter((r) => !sheetIds.has(r.id));
      combined = [...sheetRecords, ...dedupedUnsynced];
    } else {
      combined = [...attachedRecords, ...localNewRecords];
    }

    // Filter ghost / blank template rows (no amount, no credit/be, no valid item name)
    return combined.filter(
      (r) =>
        (r.amount && r.amount !== 0) ||
        (r.beCorp && r.beCorp !== 0) ||
        (r.credit && r.credit !== 0) ||
        (r.purchaseItem && r.purchaseItem.trim() !== '' && r.purchaseItem !== '(Không ghi nội dung)') ||
        (r.note && r.note.trim() !== '')
    );
  }, [sheetRecords, attachedRecords, localNewRecords]);

  // Unique categories list (seeded with all standard expense categories)
  const allCategories = useMemo(() => {
    const set = new Set<string>(EXPENSE_CATEGORIES);
    allRecords.forEach((r) => {
      if (r.category && r.sheetType === 'Expenses') set.add(r.category);
    });
    return Array.from(set);
  }, [allRecords]);

  const isAllCategoriesSelected = useMemo(() => {
    return (
      selectedCategories.length === 0 ||
      selectedCategories.includes('ALL') ||
      (allCategories.length > 0 && selectedCategories.length >= allCategories.length)
    );
  }, [selectedCategories, allCategories]);

  // Derived single category for backward compatibility
  const selectedCategory = useMemo(() => {
    if (isAllCategoriesSelected) return 'ALL';
    if (selectedCategories.length === 1) return selectedCategories[0];
    return selectedCategories[0] || 'ALL';
  }, [isAllCategoriesSelected, selectedCategories]);

  const handleSelectCategories = useCallback((cats: string[]) => {
    if (
      cats.length === 0 ||
      cats.includes('ALL') ||
      (allCategories.length > 0 && cats.length >= allCategories.length)
    ) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(cats);
    }
  }, [allCategories]);

  const handleSelectCategory = useCallback((cat: string) => {
    if (cat === 'ALL') {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([cat]);
    }
  }, []);

  const setSelectedCategory = handleSelectCategory;

  const handleToggleCategory = useCallback(
    (cat: string) => {
      if (isAllCategoriesSelected) {
        const remaining = allCategories.filter((c) => c !== cat);
        setSelectedCategories(remaining.length > 0 ? remaining : [allCategories[0]]);
        return;
      }
      if (selectedCategories.includes(cat)) {
        const next = selectedCategories.filter((c) => c !== cat);
        if (next.length === 0) {
          setSelectedCategories([]);
        } else {
          setSelectedCategories(next);
        }
      } else {
        const next = [...selectedCategories, cat];
        if (next.length >= allCategories.length) {
          setSelectedCategories([]);
        } else {
          setSelectedCategories(next);
        }
      }
    },
    [isAllCategoriesSelected, selectedCategories, allCategories]
  );

  // Available months in dataset (sorted descending: latest month first)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.monthKey && r.monthKey.includes('-')) set.add(r.monthKey);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Dynamic default latest month (either current calendar month or latest in dataset)
  const defaultLatestMonth = useMemo(() => {
    const now = new Date();
    const currentCalMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (availableMonths.includes(currentCalMonth)) return currentCalMonth;
    return availableMonths[0] || currentCalMonth;
  }, [availableMonths]);

  // Automatically select latest month on initial data load if user hasn't explicitly chosen one
  useEffect(() => {
    if (!userHasManuallySelectedMonthRef.current && availableMonths.length > 0) {
      setSelectedMonths([defaultLatestMonth]);
    }
  }, [defaultLatestMonth, availableMonths]);

  const isAllMonthsSelected = useMemo(() => {
    return (
      selectedMonths.length === 0 ||
      selectedMonths.includes('ALL') ||
      (availableMonths.length > 0 && selectedMonths.length >= availableMonths.length)
    );
  }, [selectedMonths, availableMonths]);

  // Derived single month for backward compatibility
  const selectedMonth = useMemo(() => {
    if (isAllMonthsSelected) return 'ALL';
    if (selectedMonths.length === 1) return selectedMonths[0];
    return selectedMonths[0] || defaultLatestMonth;
  }, [isAllMonthsSelected, selectedMonths, defaultLatestMonth]);

  const selectedMonthsLabel = useMemo(() => {
    return formatSelectedMonthsDisplay(selectedMonths, availableMonths).title;
  }, [selectedMonths, availableMonths]);

  // Record counts per month for dropdown context
  const monthRecordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allRecords) {
      if (r.monthKey) {
        counts[r.monthKey] = (counts[r.monthKey] || 0) + 1;
      }
    }
    return counts;
  }, [allRecords]);

  // Records filtered by selectedMonths (Calendar month: 1st to 30/31st)
  const periodRecords = useMemo(() => {
    if (isAllMonthsSelected) return allRecords;
    const monthSet = new Set(selectedMonths);
    return allRecords.filter((r) => r.monthKey && monthSet.has(r.monthKey));
  }, [allRecords, isAllMonthsSelected, selectedMonths]);

  // Category record counts & spent totals for periodRecords (for category dropdown)
  const { categoryRecordCounts, categorySpentTotals } = useMemo(() => {
    const counts: Record<string, number> = {};
    const spents: Record<string, number> = {};
    for (const r of periodRecords) {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
        if (r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)) {
          spents[r.category] = (spents[r.category] || 0) + r.amount;
        }
      }
    }
    return { categoryRecordCounts: counts, categorySpentTotals: spents };
  }, [periodRecords]);

  const handleSelectMonth = useCallback((mKey: string) => {
    userHasManuallySelectedMonthRef.current = true;
    if (mKey === 'ALL') {
      setSelectedMonths(availableMonths);
    } else {
      setSelectedMonths([mKey]);
    }
  }, [availableMonths]);

  const handleToggleMonth = useCallback((mKey: string) => {
    userHasManuallySelectedMonthRef.current = true;
    setSelectedMonths((prev) => {
      if (prev.length === 0 || prev.includes('ALL') || prev.length >= availableMonths.length) {
        const remaining = availableMonths.filter((m) => m !== mKey);
        return remaining.length > 0 ? remaining : [availableMonths[0]];
      }
      if (prev.includes(mKey)) {
        const next = prev.filter((m) => m !== mKey);
        return next.length > 0 ? next : availableMonths;
      }
      const next = [...prev, mKey];
      return next.length >= availableMonths.length ? availableMonths : next;
    });
  }, [availableMonths]);

  // Historical autocomplete suggestions
  const itemSuggestions = useMemo(() => {
    return buildItemSuggestions(allRecords);
  }, [allRecords]);

  // Cycle range calculations for BE Corp and Credit for the active month
  const activeBeCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth,
      beCorpStartDay,
      beCorpEndDay
    );
  }, [selectedMonth, defaultLatestMonth, beCorpStartDay, beCorpEndDay]);

  const activeCreditCycle = useMemo(() => {
    return getBillingCycleRange(
      selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth,
      creditStartDay,
      creditEndDay
    );
  }, [selectedMonth, defaultLatestMonth, creditStartDay, creditEndDay]);

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

    // Distinct cycle calculations for BE Corp and Credit across all selected months
    let beCorpCycleTotal = 0;
    let beCorpCount = 0;
    let creditCycleTotal = 0;
    let creditCount = 0;

    if (isAllMonthsSelected) {
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
      // Filter by respective cycle dates across each selected month
      const beRanges = selectedMonths.map((m) => getBillingCycleRange(m, beCorpStartDay, beCorpEndDay));
      const creditRanges = selectedMonths.map((m) => getBillingCycleRange(m, creditStartDay, creditEndDay));

      for (const r of allRecords) {
        if (r.sheetType === 'Expenses') {
          if (
            r.beCorp > 0 &&
            beRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            beCorpCycleTotal += r.beCorp;
            beCorpCount += 1;
          }
          if (
            r.credit > 0 &&
            creditRanges.some((rng) => r.isoDate >= rng.startDate && r.isoDate <= rng.endDate)
          ) {
            creditCycleTotal += r.credit;
            creditCount += 1;
          }
        }
      }
    }

    const beDisplayLabel = isAllMonthsSelected
      ? 'Tất cả chu kỳ BE'
      : selectedMonths.length > 1
        ? `${selectedMonths.length} chu kỳ BE đã chọn`
        : activeBeCycle.displayLabel;

    const creditDisplayLabel = isAllMonthsSelected
      ? 'Tất cả kỳ sao kê thẻ'
      : selectedMonths.length > 1
        ? `${selectedMonths.length} kỳ sao kê thẻ đã chọn`
        : activeCreditCycle.displayLabel;

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
      beRange: { ...activeBeCycle, displayLabel: beDisplayLabel },
      creditRange: { ...activeCreditCycle, displayLabel: creditDisplayLabel },
      netBalance,
      expenseCount,
      incomeCount,
    };
  }, [
    periodRecords,
    allRecords,
    monthlyBaseIncome,
    selectedMonth,
    selectedMonths,
    isAllMonthsSelected,
    availableMonths.length,
    activeBeCycle,
    activeCreditCycle,
    beCorpStartDay,
    beCorpEndDay,
    creditStartDay,
    creditEndDay,
  ]);

  // Category-specific KPI metrics when category filter is active (single or multiple)
  const categoryKpiStats = useMemo(() => {
    if (isAllCategoriesSelected) return null;

    const targetCategories =
      selectedCategories.length > 0
        ? selectedCategories
        : selectedCategory !== 'ALL'
        ? [selectedCategory]
        : [];
    if (targetCategories.length === 0) return null;

    const targetMonth = selectedMonth !== 'ALL' ? selectedMonth : defaultLatestMonth;

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

    let totalEffectiveBudget = 0;
    let totalBaseBudget = 0;
    let totalCarryover = 0;
    let totalNetTransfer = 0;
    let totalSpent = 0;
    let totalBeCorp = 0;
    let totalCredit = 0;
    let totalCount = 0;
    let totalPercentage = 0;

    for (const cat of targetCategories) {
      const catStats = rolloverResult.chain[cat]?.[targetMonth];
      const catRecords = periodRecords.filter(
        (r) => r.category === cat && r.sheetType === 'Expenses' && !isBudgetTransferRecord(r)
      );
      const spent = catStats ? catStats.spent : catRecords.reduce((s, r) => s + r.amount, 0);
      const beCorp = catRecords.reduce((s, r) => s + r.beCorp, 0);
      const credit = catRecords.reduce((s, r) => s + r.credit, 0);
      const count = catStats ? catStats.txCount : catRecords.length;

      const baseBudget = catStats
        ? catStats.baseBudget
        : Math.round((kpiStats.effectiveIncome * (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0)) / 100);
      const carryover = catStats ? catStats.carryover : 0;
      const netTransfer = catStats ? catStats.netTransfer : 0;
      const effectiveBudget = catStats ? catStats.effectiveBudget : baseBudget;
      const percentage = catStats
        ? catStats.percentage
        : (DEFAULT_CATEGORY_PERCENTAGES[cat] ?? 0);

      totalEffectiveBudget += effectiveBudget;
      totalBaseBudget += baseBudget;
      totalCarryover += carryover;
      totalNetTransfer += netTransfer;
      totalSpent += spent;
      totalBeCorp += beCorp;
      totalCredit += credit;
      totalCount += count;
      totalPercentage += percentage;
    }

    const remaining = totalEffectiveBudget - totalSpent;
    const displayLabel =
      targetCategories.length === 1
        ? targetCategories[0]
        : `${targetCategories.length} danh mục (${targetCategories.slice(0, 2).join(', ')}${targetCategories.length > 2 ? '...' : ''})`;

    return {
      category: displayLabel,
      categories: targetCategories,
      budget: totalEffectiveBudget,
      baseBudget: totalBaseBudget,
      carryover: totalCarryover,
      netTransfer: totalNetTransfer,
      spent: totalSpent,
      remaining,
      beCorp: totalBeCorp,
      credit: totalCredit,
      count: totalCount,
      percentage: totalPercentage,
    };
  }, [
    isAllCategoriesSelected,
    selectedCategories,
    selectedCategory,
    allRecords,
    budgetTransfers,
    periodRecords,
    selectedMonth,
    defaultLatestMonth,
    kpiStats.effectiveIncome,
  ]);

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

    const isAppsScript = isAppsScriptUrl(targetInput);
    let token = overrideToken || accessToken || getStoredAccessToken() || '';
    if (!token && !isAppsScript) {
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
      let meta: SpreadsheetMetadata;
      let preloadedExpenses: TransactionRecord[] | null = null;
      let preloadedIncome: TransactionRecord[] | null = null;
      let preloadedTransfers: BudgetTransferRecord[] | null = null;

      if (isAppsScript) {
        const fullData = await appsScriptSyncAll(targetInput);
        meta = fullData.metadata;
        preloadedExpenses = fullData.expenses;
        preloadedIncome = fullData.income;
        preloadedTransfers = fullData.budgetTransfers;
      } else {
        meta = await fetchSpreadsheetMetadata(targetInput, currentToken);
        const savedIncomeTab = localStorage.getItem('heomeo_custom_income_tab_v1');
        if (savedIncomeTab && meta.sheetNames.includes(savedIncomeTab)) {
          meta.incomeTab = savedIncomeTab;
        }
        const savedExpensesTab = localStorage.getItem('heomeo_custom_expenses_tab_v1');
        if (savedExpensesTab && meta.sheetNames.includes(savedExpensesTab)) {
          meta.expensesTab = savedExpensesTab;
        }
      }

      setSheetMeta(meta);
      localStorage.setItem(SAVED_SHEET_URL_KEY, targetInput);

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
        pendingTransactions.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));

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
        pendingTransfers.sort((a, b) => (a.isoDate || '').localeCompare(b.isoDate || ''));
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
      let expensesRows: TransactionRecord[];
      let incomeRows: TransactionRecord[];
      let checkTien: any = null;
      let liveTransfers: BudgetTransferRecord[] = [];

      if (isAppsScript && preloadedExpenses && preloadedIncome && preloadedTransfers && pushedTxIds.size === 0 && pushedBtIds.size === 0) {
        expensesRows = preloadedExpenses;
        incomeRows = preloadedIncome;
        liveTransfers = preloadedTransfers;
      } else {
        const [exp, inc, ct, bt] = await Promise.all([
          fetchTabTransactions(meta.spreadsheetId, meta.expensesTab, 'Expenses', currentToken),
          fetchTabTransactions(meta.spreadsheetId, meta.incomeTab, 'Income', currentToken),
          meta.checkTienTab
            ? fetchCheckTienSheet(meta.spreadsheetId, meta.checkTienTab, currentToken)
            : Promise.resolve(null),
          meta.budgetTransfersTab
            ? fetchBudgetTransfersSheet(meta.spreadsheetId, meta.budgetTransfersTab, currentToken)
            : Promise.resolve([]),
        ]);
        expensesRows = exp;
        incomeRows = inc;
        checkTien = ct;
        liveTransfers = bt;
      }

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
            isAppsScript
              ? `✓ Đã kết nối Web App API: ${res.expensesCount} chi tiêu, ${res.incomeCount} thu nhập (Không cần đăng nhập Google)!`
              : `Đã đồng bộ "${res.meta.title}": ${res.expensesCount} dòng Expenses, ${res.incomeCount} dòng Income${
                  res.checkTienTab ? ' & Check tiền' : ''
                }`
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

    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    if ((accessToken || isAppsScript) && effectiveSheetId) {
      const tabName = sheetMeta?.budgetTransfersTab || 'Budget Transfers';
      try {
        await appendBudgetTransferToSheet(
          effectiveSheetId,
          tabName,
          {
            date: transfer.date,
            fromCategory: transfer.fromCategory,
            toCategory: transfer.toCategory,
            amount: transfer.amount,
            description: transfer.description,
          },
          accessToken || ''
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

    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    if (effectiveSheetId && (effectiveToken || isAppsScript)) {
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

    if (createdRecords.length > 0 && !isAllMonthsSelected && !selectedMonths.includes(createdRecords[0].monthKey)) {
      setSelectedMonths([createdRecords[0].monthKey]);
    }
  };

  // Edit transaction handler
  const handleSaveEditedTransaction = async (updated: TransactionRecord) => {
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    // 1. Optimistic update
    setSheetRecords((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev
    );
    setLocalNewRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setAttachedRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );

    // 2. If already on Google Sheet
    if (updated.rowIndex && effectiveSheetId && (effectiveToken || isAppsScript)) {
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
        await deleteTransactionFromSheet(effectiveSheetId, oldSheetId, updated.rowIndex, effectiveToken, originalTab);
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
    const effectiveToken = accessToken || getStoredAccessToken() || '';
    const effectiveSheetId = sheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    const isAppsScript = isAppsScriptUrl(effectiveSheetId);

    setIsDeleting(true);
    try {
      // 1. Optimistic remove
      setSheetRecords((prev) => (prev ? prev.filter((r) => r.id !== target.id) : prev));
      setLocalNewRecords((prev) => prev.filter((r) => r.id !== target.id));
      setAttachedRecords((prev) => prev.filter((r) => r.id !== target.id));

      // 2. If it is on Google Sheet
      if (target.rowIndex && effectiveSheetId && (effectiveToken || isAppsScript)) {
        const expensesTab = sheetMeta?.expensesTab || 'Expenses';
        const incomeTab = sheetMeta?.incomeTab || 'Income';
        const tabName = target.sheetType === 'Income' ? incomeTab : expensesTab;
        const sheetId =
          sheetMeta?.sheetIdsByName?.[tabName] ??
          (target.sheetType === 'Income' ? 392215035 : 1528073380);

        await deleteTransactionFromSheet(effectiveSheetId, sheetId, target.rowIndex, effectiveToken, tabName);
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
        const amt = formatNumberForSheet(r.amount, true, true);
        const be = r.beCorp !== 0 ? formatNumberForSheet(r.beCorp, false, true) : '';
        const cr = r.credit !== 0 ? formatNumberForSheet(r.credit, false, true) : '';
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

  const handleLockApp = useCallback(() => {
    lockDevice();
    setIsUnlocked(false);
    showToast('success', 'Đã khóa ứng dụng an toàn');
  }, [showToast]);

  if (!isUnlocked) {
    return <AppLockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--ink)] transition-colors">
      {/* ═══════ COFRA DESKTOP LEFT SIDEBAR (Only active in Cofra preset on lg+ screens) ═══════ */}
      {preset === 'cofra' && (
        <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-64 bg-[var(--side-bg)] text-[var(--side-ink)] border-r border-[var(--side-line)] flex-col justify-between p-4 z-40 transition-colors select-none">
          <div className="space-y-4">
            {/* Cofra Brand Header */}
            <div className="flex items-center gap-3 px-2 py-1">
              <div
                className="flex items-center -space-x-2 p-1 rounded-xl bg-black/10 dark:bg-white/10 border border-[var(--side-line)] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                onClick={() => setActiveTab('dashboard')}
                title="Heo & Mèo Finance"
              >
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-1 ring-white dark:ring-black flex items-center justify-center shadow-xs z-10">
                  <PigIcon className="w-4.5 h-4.5" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-1 ring-white dark:ring-black flex items-center justify-center shadow-xs z-0">
                  <SiameseCatIcon className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold tracking-tight text-[var(--side-ink)] font-display truncate">
                    Heo &amp; Mèo
                  </h1>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[var(--side-ink)]">
                    COFRA
                  </span>
                </div>
                <span className="text-[10.5px] text-[var(--side-muted)] block truncate">
                  Ba mẹ Chuối, Đậu, Vịt
                </span>
              </div>
            </div>

            {/* Cofra Navigation: MONEY */}
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--side-muted)] px-2.5 mb-1.5">
                Money &amp; Sổ cái
              </div>
              <nav className="space-y-1">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'ledger', label: 'Sổ giao dịch', icon: ReceiptText, count: periodRecords.length },
                  { id: 'reconcile', label: 'Check tiền & Đối soát', icon: Scale },
                  { id: 'sync', label: 'Đồng bộ Sheets', icon: RefreshCw },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        animateIconBounce(e.currentTarget);
                        setActiveTab(item.id as any);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-bold border border-[var(--line)]'
                          : 'text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--ink)]' : 'text-[var(--side-muted)]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.count === 'number' && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[var(--card-2)] text-[var(--muted)] border border-[var(--line)]">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsTelegramModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Bot Telegram</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    Auto
                  </span>
                </button>
              </nav>
            </div>

            {/* Cofra Controls: THEME & SETTINGS */}
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--side-muted)] px-2.5 mb-1.5">
                Giao diện &amp; Chế độ
              </div>
              <div className="space-y-1">
                {/* Theme Preset Switcher */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(e.currentTarget, next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--side-ink)] transition-all cursor-pointer"
                  title="Bấm để chuyển về giao diện Kinlo"
                >
                  <div className="flex items-center gap-2.5">
                    <Palette className="w-4 h-4 text-[var(--side-ink)]" />
                    <span>Theme Preset</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--card)] text-[var(--ink)] border border-[var(--line)]">
                    Cofra Luxe
                  </span>
                </button>

                {/* Dark / Light Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-slate-200" />}
                    <span>Chế độ hiển thị</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--side-ink)]">
                    {isDark ? 'Tối' : 'Sáng'}
                  </span>
                </button>

                {/* Privacy Mode Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isPrivate ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                    <span>Bảo mật số tiền</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--side-ink)]">
                    {isPrivate ? 'Đang ẩn' : 'Hiện'}
                  </span>
                </button>

                {/* Monthly Report Modal */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Share2 className="w-4 h-4 text-amber-500" />
                    <span>Báo cáo tháng</span>
                  </div>
                  <span className="text-[10px] text-[var(--side-muted)]">Xem</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cofra Sidebar Footer Profile */}
          <div className="pt-3 border-t border-[var(--side-line)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--card)] border border-[var(--line)] flex items-center justify-center font-bold text-[11px] text-[var(--ink)]">
                HM
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--side-ink)] block truncate">Gia đình Chuối &amp; Đậu</span>
                <span className="text-[10px] text-[var(--side-muted)] block truncate">
                  {accessToken ? 'Đã kết nối Sheets' : 'Lưu trữ cục bộ'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLockApp}
              className="p-1.5 rounded-lg text-[var(--side-muted)] hover:text-[var(--side-ink)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Khóa ứng dụng"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Container Wrapper (shifts right on lg when Cofra preset active) */}
      <div className={`flex-1 flex flex-col transition-all ${preset === 'cofra' ? 'lg:pl-64' : ''}`}>
        {/* ═══════ HEADER: KINLO FLOATING GLASS OR COFRA SLIM BREADCRUMB ═══════ */}
        {preset === 'kinlo' ? (
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 sm:pt-4">
            <header className="w-full px-4 sm:px-6 py-3 rounded-2xl sm:rounded-3xl bg-[var(--glass)] backdrop-blur-xl border border-[var(--line)] shadow-[var(--shadow)] flex flex-wrap items-center justify-between gap-3 text-[var(--ink)] transition-all">
              {/* Left Brand Badge (Duo Avatars: Heo & Mèo) */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center -space-x-2.5 p-1 rounded-2xl bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/15 shadow-xs hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0 magnetic"
                  onClick={() => setActiveTab('dashboard')}
                  title="Heo & Mèo Finance"
                >
                  <div
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs z-10"
                    title="Heo 🐷"
                  >
                    <PigIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>
                  <div
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs z-0"
                    title="Mèo Xiêm 🐱"
                  >
                    <SiameseCatIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ink)]">
                      Heo &amp; Mèo
                    </h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--card-2)] text-[var(--accent-text)] border border-[var(--line)]">
                      Finance
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] block font-medium">
                    Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt
                  </span>
                </div>
              </div>

              {/* Center Navigation Tabs (Kinlo Glass Nav Rail) */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold p-1 rounded-2xl bg-[var(--card-2)] border border-[var(--line)] overflow-x-auto max-w-full relative">
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'ledger', label: `Sổ giao dịch (${periodRecords.length})` },
                  { id: 'reconcile', label: 'Check tiền & Đối soát' },
                  {
                    id: 'sync',
                    label: `Đồng bộ (${
                      sheetRecords && sheetRecords.length > 0
                        ? accessToken
                          ? 'Đã kết nối'
                          : 'Đã lưu máy'
                        : 'Chưa kết nối'
                    })`,
                  },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={(e) => {
                        animateIconBounce(e.currentTarget);
                        setActiveTab(tab.id as any);
                      }}
                      className={`relative px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer font-semibold ${
                        isActive
                          ? 'text-[var(--accent-ink)] font-bold'
                          : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white/40 dark:hover:bg-white/5'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="kinlo-active-desktop-pill"
                          className="absolute inset-0 bg-[var(--accent)] rounded-xl shadow-xs"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsTelegramModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer magnetic"
                  title="Mở hướng dẫn & cú pháp Telegram Bot"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-500" />
                  <span>Bot Telegram</span>
                </button>
              </nav>

              {/* Right Action Controls */}
              <div className="flex items-center gap-2">
                {/* Theme Preset Switcher (🌿 Kinlo / 🏛️ Cofra) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(
                      e.currentTarget,
                      next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)'
                    );
                  }}
                  className="magnetic p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] cursor-pointer"
                  title={`Đang dùng: ${activeConfig.name} — Bấm để đổi sang theme ${preset === 'kinlo' ? 'Cofra' : 'Kinlo'}`}
                >
                  <Palette className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  <span className="hidden sm:inline font-medium font-mono-tabular">
                    Kinlo
                  </span>
                </button>

                {/* Theme Toggle Button (☀️ Sáng / 🌙 Tối) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="magnetic p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] cursor-pointer"
                  title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
                >
                  {isDark ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="hidden sm:inline font-medium">Sáng</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="hidden sm:inline font-medium">Tối</span>
                    </>
                  )}
                </button>

                {/* Privacy Mode Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className={`magnetic p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 border cursor-pointer ${
                    isPrivate
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                      : 'bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                  title={isPrivate ? 'Đang ẩn số tiền — Bấm để hiện' : 'Đang hiện số tiền — Bấm để ẩn'}
                >
                  {isPrivate ? (
                    <>
                      <EyeOff className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="hidden md:inline">Đang ẩn</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-[var(--muted)] shrink-0" />
                      <span className="hidden md:inline">Hiện số</span>
                    </>
                  )}
                </button>

                {/* Monthly Report Card Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="magnetic p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center gap-1.5"
                  title="Báo cáo tài chính tháng"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden lg:inline">Báo cáo</span>
                </button>

                {/* Lock App Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    handleLockApp();
                  }}
                  className="magnetic p-2 rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] transition-colors cursor-pointer"
                  title="Khóa ứng dụng an toàn"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>

                {/* Kinlo Primary Action Button (Thêm giao dịch) */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                  className="magnetic kinlo-btn-primary px-3 sm:px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Thêm giao dịch</span>
                  <span className="sm:hidden">Thêm</span>
                </button>
              </div>
            </header>
          </div>
        ) : (
          /* Cofra Header (Slim & Crisp Breadcrumb Header) */
          <div className="w-full px-4 sm:px-8 pt-3 sm:pt-4">
            <header className="w-full px-4 sm:px-6 py-3 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-between gap-3 text-[var(--ink)]">
              {/* Breadcrumb on Desktop / Mobile Brand on Phone */}
              <div className="flex items-center gap-2.5">
                <div className="lg:hidden flex items-center -space-x-2 mr-1">
                  <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/70 ring-1 ring-white dark:ring-black flex items-center justify-center">
                    <PigIcon className="w-4 h-4" />
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#FAF4EE] dark:bg-amber-950/50 ring-1 ring-white dark:ring-black flex items-center justify-center">
                    <SiameseCatIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                  <span className="font-bold text-[var(--ink)]">Heo &amp; Mèo</span>
                  <span>/</span>
                  <span className="text-[var(--ink)] font-bold">
                    {activeTab === 'dashboard' ? 'Overview' : activeTab === 'ledger' ? 'Activity' : activeTab === 'reconcile' ? 'Check tiền & Đối soát' : 'Sync'}
                  </span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2">
                {/* Theme Preset Switcher */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    const next = togglePreset();
                    triggerFloatUp(e.currentTarget, next === 'cofra' ? 'Theme Cofra (Mono Luxe)' : 'Theme Kinlo (Ocean)');
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center gap-1.5"
                  title="Bấm để chuyển sang theme Kinlo"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-mono text-[11px]">Cofra</span>
                </button>

                {/* Dark/Light Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    toggleTheme();
                  }}
                  className="p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer flex items-center gap-1"
                  title={isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                {/* Privacy Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    togglePrivacy();
                  }}
                  className={`p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isPrivate ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' : 'bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border-[var(--line)]'
                  }`}
                  title={isPrivate ? 'Hiện số tiền' : 'Ẩn số tiền'}
                >
                  {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-[var(--muted)]" />}
                </button>

                {/* Report button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setIsReportModalOpen(true);
                  }}
                  className="hidden sm:flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--ink)] border border-[var(--line)] transition-all cursor-pointer"
                  title="Báo cáo tài chính"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Báo cáo</span>
                </button>

                {/* Lock button */}
                <button
                  type="button"
                  onClick={handleLockApp}
                  className="p-2 rounded-xl bg-[var(--card-2)] hover:bg-[var(--card-3)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] transition-colors cursor-pointer"
                  title="Khóa ứng dụng"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>

                {/* Primary Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    animateIconBounce(e.currentTarget);
                    setAddModalPreset(null);
                    setIsAddModalOpen(true);
                  }}
                  className="magnetic kinlo-btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Thêm giao dịch</span>
                  <span className="sm:hidden">Thêm</span>
                </button>
              </div>
            </header>
          </div>
        )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs pointer-events-none"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-5 pb-24 md:pb-6">
        {/* ═══════ KINLO GREETING HERO BAR (PHEAD) ═══════ */}
        <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] font-display">
              Xin chào, Heo &amp; Mèo 👋
            </h2>
            <div className="text-xs sm:text-sm text-[var(--muted)] mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span>{formatTodayDate()}</span>
              <span>·</span>
              <span className="font-mono-tabular">Chu kỳ BE: <strong>{kpiStats.beRange.displayLabel}</strong></span>
              <span>·</span>
              <span className="font-mono-tabular">Sao kê Credit: <strong>{kpiStats.creditRange.displayLabel}</strong></span>
            </div>
          </div>

          {/* Kinlo Action Controls Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter 1: Date Range Multi-Month Picker */}
            <MultiMonthPickerDropdown
              availableMonths={availableMonths}
              selectedMonths={selectedMonths}
              onChange={(nextMonths) => {
                userHasManuallySelectedMonthRef.current = true;
                setSelectedMonths(nextMonths);
              }}
              monthRecordCounts={monthRecordCounts}
              totalRecordCount={allRecords.length}
            />

            {/* Filter 2: Multi-Category Picker Dropdown (Only show on dashboard and ledger tabs) */}
            {(activeTab === 'dashboard' || activeTab === 'ledger') && (
              <MultiCategoryPickerDropdown
                allCategories={allCategories}
                selectedCategories={isAllCategoriesSelected ? allCategories : selectedCategories}
                onChange={handleSelectCategories}
                categoryRecordCounts={categoryRecordCounts}
                categorySpentTotals={categorySpentTotals}
                totalRecordCount={periodRecords.length}
              />
            )}

            {/* Reset Filter Button if active */}
            {(!isAllMonthsSelected || selectedMonths.length !== 1 || selectedMonths[0] !== defaultLatestMonth || !isAllCategoriesSelected) && (
              <button
                type="button"
                onClick={() => {
                  userHasManuallySelectedMonthRef.current = false;
                  setSelectedMonths([defaultLatestMonth]);
                  setSelectedCategories([]);
                }}
                className="text-xs text-[var(--accent-text)] hover:underline font-semibold px-2 py-1 cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            )}

            {/* Quick Move Budget Button */}
            <button
              type="button"
              onClick={() => {
                setAddModalPreset({ note: 'TRANSFER_MODE' });
                setIsAddModalOpen(true);
              }}
              className="kinlo-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              title="Chuyển hạn mức ngân sách giữa 2 danh mục"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Chuyển Budget</span>
            </button>

            {/* Quick Sync Sheet Button */}
            {sheetMeta && accessToken ? (
              <button
                type="button"
                onClick={() => handleConnectAndSyncSheet(sheetMeta.spreadsheetId)}
                disabled={isSyncing}
                className="kinlo-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Đồng bộ Sheet</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ═══════ ACTIVE CATEGORY FILTER BANNER ═══════ */}
        <AnimatePresence>
          {!isAllCategoriesSelected && (activeTab === 'dashboard' || activeTab === 'ledger') && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-900 dark:text-sky-200 shadow-2xs overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
                <span>
                  Đang lọc riêng theo danh mục:{' '}
                  <strong className="font-extrabold text-sky-950 dark:text-sky-100 text-sm">
                    {selectedCategories.length === 1
                      ? selectedCategories[0]
                      : `${selectedCategories.length} danh mục (${selectedCategories.join(', ')})`}
                  </strong>
                  {isAllMonthsSelected ? ' · Tất cả thời gian' : ` · ${selectedMonthsLabel}`}
                  {' · '}
                  <strong>{categoryKpiStats?.count || 0}</strong> giao dịch
                  {' · '}
                  Tổng chi:{' '}
                  <strong className="font-mono-tabular font-bold text-sky-950 dark:text-sky-100 text-sm">
                    {formatCurrency(categoryKpiStats?.spent || 0)}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className="px-3 py-1 font-semibold text-xs text-sky-800 dark:text-sky-200 bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-sky-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                ✕ Xem tất cả danh mục
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoadingInitial ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Đang nạp dữ liệu lịch sử tài chính của bạn...
          </div>
        ) : (
          <>
            {/* VIEW CONTENT */}
            <div>
              {/* VIEW 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div key="dashboard" ref={dashboardRef} className="space-y-5">
                {/* ═══════ KINLO HERO ASYMMETRIC 7fr / 5fr GRID ═══════ */}
                {categoryKpiStats ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Left 7 Cols: Category Cashflow & Budget Card */}
                    <div className="lg:col-span-7">
                      <KinloCashflowCard
                        income={categoryKpiStats.budget}
                        totalExpense={categoryKpiStats.spent}
                        netBalance={categoryKpiStats.remaining}
                        livingExpense={Math.max(0, categoryKpiStats.spent - categoryKpiStats.beCorp - categoryKpiStats.credit)}
                        savingsExpense={0}
                        beCorpCycleTotal={categoryKpiStats.beCorp}
                        creditCycleTotal={categoryKpiStats.credit}
                        incomeCount={1}
                        expenseCount={categoryKpiStats.count}
                        periodLabel={`Đang xem danh mục: ${categoryKpiStats.category}`}
                        onViewLedger={() => setActiveTab('ledger')}
                        className="h-full"
                      />
                    </div>

                    {/* Right 5 Cols: Category In the Bank & Cards Card */}
                    <div className="lg:col-span-5">
                      <KinloBankAccountsCard
                        beCorpAmount={categoryKpiStats.beCorp}
                        creditAmount={categoryKpiStats.credit}
                        beCorpCount={0}
                        creditCount={0}
                        beRangeLabel={kpiStats.beRange.displayLabel}
                        creditRangeLabel={kpiStats.creditRange.displayLabel}
                        dailySafeSpend={0}
                        onReconcileClick={() => setActiveTab('reconcile')}
                        className="h-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    {/* Left 7 Cols: Kinlo Cashflow & Budget Card */}
                    <div className="lg:col-span-7">
                      <KinloCashflowCard
                        income={kpiStats.effectiveIncome}
                        totalExpense={kpiStats.totalExpense}
                        netBalance={kpiStats.netBalance}
                        livingExpense={kpiStats.livingExpense}
                        savingsExpense={kpiStats.savingsExpense}
                        beCorpCycleTotal={kpiStats.beCorpCycleTotal}
                        creditCycleTotal={kpiStats.creditCycleTotal}
                        incomeCount={kpiStats.incomeCount}
                        expenseCount={kpiStats.expenseCount}
                        periodLabel={selectedMonthsLabel}
                        onViewLedger={() => setActiveTab('ledger')}
                        className="h-full"
                      />
                    </div>

                    {/* Right 5 Cols: Kinlo In The Bank & Cards Card */}
                    <div className="lg:col-span-5">
                      <KinloBankAccountsCard
                        beCorpAmount={kpiStats.beCorpCycleTotal}
                        creditAmount={kpiStats.creditCycleTotal}
                        beCorpCount={kpiStats.beCorpCount}
                        creditCount={kpiStats.creditCount}
                        beRangeLabel={kpiStats.beRange.displayLabel}
                        creditRangeLabel={kpiStats.creditRange.displayLabel}
                        dailySafeSpend={Math.max(0, Math.round(kpiStats.netBalance / 30))}
                        onReconcileClick={() => setActiveTab('reconcile')}
                        className="h-full"
                      />
                    </div>
                  </div>
                )}

                {/* ═══════ MULTI-MONTH BUDGET & CASHFLOW SUMMARY MATRIX (Answers Requirement 5) ═══════ */}
                <MultiMonthSummaryTable
                  allRecords={allRecords}
                  availableMonths={availableMonths}
                  selectedMonth={selectedMonth}
                  selectedMonths={selectedMonths}
                  onSelectMonth={handleSelectMonth}
                  onToggleMonth={handleToggleMonth}
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
                  selectedMonths={selectedMonths}
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleSelectCategory}
                  selectedCategories={isAllCategoriesSelected ? [] : selectedCategories}
                  onSelectCategories={handleSelectCategories}
                  onToggleCategory={handleToggleCategory}
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
                    selectedMonths={selectedMonths}
                    onSelectMonth={handleSelectMonth}
                    onToggleMonth={handleToggleMonth}
                    selectedCategoryFilter={selectedCategory}
                    onSelectCategoryFilter={handleSelectCategory}
                    selectedCategories={isAllCategoriesSelected ? [] : selectedCategories}
                    onToggleCategoryFilter={handleToggleCategory}
                    monthlyBaseIncome={monthlyBaseIncome}
                  />
                )}

                {/* ═══════ LỊCH CHI TIÊU TRỰC QUAN (CALENDAR HEATMAP VIEW) ═══════ */}
                <CalendarHeatmapView
                  records={periodRecords}
                  allRecords={allRecords}
                  selectedMonth={selectedMonth}
                  onOpenAddModalWithPreset={(preset) => {
                    setAddModalPreset(preset);
                    setIsAddModalOpen(true);
                  }}
                  onSelectTransaction={(tx) => setEditingTransaction(tx)}
                />
                </div>
              )}

              {/* VIEW 2: FULL TRANSACTION LEDGER */}
              {activeTab === 'ledger' && (
                <div key="ledger" className="animate-in fade-in duration-200">
                  <TransactionLedgerTable
                    records={periodRecords}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleSelectCategory}
                    selectedCategories={isAllCategoriesSelected ? [] : selectedCategories}
                    onSelectCategories={handleSelectCategories}
                    onOpenAddModal={() => {
                      setAddModalPreset(null);
                      setIsAddModalOpen(true);
                    }}
                    onEditTransaction={setEditingTransaction}
                    onDeleteTransaction={setDeletingTransaction}
                    onPushPendingToSheet={handlePushPendingToSheet}
                    isSyncing={isSyncing}
                    periodLabel={selectedMonthsLabel}
                  />
                </div>
              )}

              {/* VIEW 3: CHECK TIỀN & CHU KỲ BE CORP / CREDIT */}
              {activeTab === 'reconcile' && (
                <div key="reconcile" className="animate-in fade-in duration-200">
                  <ReconcileCheckTienView
                    allRecords={allRecords}
                    selectedMonth={selectedMonth}
                    onOpenAddWithPreset={(preset) => {
                      setAddModalPreset(preset);
                      setIsAddModalOpen(true);
                    }}
                    checkTienData={checkTienData}
                    onEditTransaction={(tx) => setEditingTransaction(tx)}
                  />
                </div>
              )}

              {/* VIEW 4: GOOGLE SHEET SYNC PANEL */}
              {activeTab === 'sync' && (
                <div key="sync" className="animate-in fade-in duration-200">
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
                </div>
              )}
            </div>
        </>
      )}
      </main>
      </div>

      {/* ADD TRANSACTION MODAL */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveTransaction}
        onSaveTransfer={handleSaveTransfer}
        suggestions={itemSuggestions}
        isSheetConnected={Boolean(
          (sheetMeta || spreadsheetInput) &&
          (accessToken || getStoredAccessToken() || isAppsScriptUrl(spreadsheetInput) || isAppsScriptUrl(sheetMeta?.spreadsheetId))
        )}
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
      <AnimatePresence>
        {deletingTransaction && (
          <motion.div
            key="delete-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 cursor-pointer"
            onClick={() => !isDeleting && setDeletingTransaction(null)}
          >
            <motion.div
              key="delete-modal-card"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
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
                    {formatCurrency(deletingTransaction.amount, false, true)}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Guide Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallSuccess={() => setIsStandalone(true)}
      />

      {/* Monthly Report Card Modal (Infographic Card & Image Export) */}
      <MonthlyReportCardModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedMonth={selectedMonth}
        allRecords={allRecords}
      />

      {/* ═══════ KINLO MOBILE BOTTOM NAVIGATION BAR (< md) ═══════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--glass)] backdrop-blur-2xl border-t border-[var(--line)] shadow-2xl px-2 py-1.5 flex items-center justify-around text-center">
        {/* Tab 1: Dashboard */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('dashboard');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Dashboard</span>
          </div>
        </button>

        {/* Tab 2: Ledger */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('ledger');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
        >
          {activeTab === 'ledger' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <ReceiptText className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Sổ cái</span>
          </div>
          {periodRecords.length > 0 && (
            <span className="absolute -top-0.5 right-0.5 z-20 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--accent)] text-[var(--accent-ink)]">
              {periodRecords.length}
            </span>
          )}
        </button>

        {/* Central Prominent Quick Add Button (Kinlo Accent Floating Action) */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setAddModalPreset(null);
            setIsAddModalOpen(true);
          }}
          className="magnetic w-11 h-11 -mt-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
          title="Thêm giao dịch mới"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Tab 3: Reconcile */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('reconcile');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'reconcile'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
        >
          {activeTab === 'reconcile' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <Scale className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Đối soát</span>
          </div>
        </button>

        {/* Tab 4: Sync */}
        <button
          type="button"
          onClick={(e) => {
            animateIconBounce(e.currentTarget);
            setActiveTab('sync');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'sync'
              ? 'text-[var(--accent-text)] font-bold'
              : 'text-[var(--muted)] font-medium hover:text-[var(--ink)]'
          }`}
        >
          {activeTab === 'sync' && (
            <motion.div
              layoutId="kinlo-active-mobile-pill"
              className="absolute inset-0 bg-[var(--accent)]/15 rounded-xl -z-0"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center">
            <RefreshCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Đồng bộ</span>
          </div>
        </button>
      </nav>
    </div>
  );
}

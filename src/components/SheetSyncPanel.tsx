import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link2,
  Download,
  LogOut,
  UploadCloud,
  FileSpreadsheet,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Key,
  KeyRound,
  Globe,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Wand2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { SpreadsheetMetadata } from '../services/googleSheetsService';
import { TransactionRecord } from '../types/finance';
import {
  isAppsScriptUrl,
  getStoredWebAppUrl,
  saveStoredWebAppUrl,
  getStoredWebAppKey,
  saveStoredWebAppKey,
  getConnectionMode,
  setConnectionMode,
} from '../services/appsScriptService';
import { changePin, hasConfiguredPin, isValidPinFormat } from './AppLockScreen';

interface SheetSyncPanelProps {
  user: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  spreadsheetInput: string;
  onChangeSpreadsheetInput: (val: string) => void;
  sheetMeta: SpreadsheetMetadata | null;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  onConnectAndSyncSheet: (customUrlOrId?: string) => Promise<void>;
  pendingLocalRecords: TransactionRecord[];
  onPushPendingToSheet: () => Promise<void>;
  onExportCsv: () => void;
  totalExpensesCount: number;
  totalIncomeCount: number;
  onSelectIncomeTab?: (tabName: string) => void;
  onSelectExpensesTab?: (tabName: string) => void;
}

export const SheetSyncPanel: React.FC<SheetSyncPanelProps> = React.memo(({
  user,
  accessToken,
  isLoggingIn,
  onGoogleLogin,
  onGoogleLogout,
  spreadsheetInput,
  onChangeSpreadsheetInput,
  sheetMeta,
  isSyncing,
  syncError,
  lastSyncedAt,
  onConnectAndSyncSheet,
  pendingLocalRecords,
  onPushPendingToSheet,
  onExportCsv,
  totalExpensesCount,
  totalIncomeCount,
  onSelectIncomeTab,
  onSelectExpensesTab,
}) => {
  // Sync mode: 'webapp' (Web App API - No login, no expiration) vs 'oauth' (Google Sign-In)
  const [activeMode, setActiveMode] = useState<'webapp' | 'oauth'>(() => {
    if (isAppsScriptUrl(spreadsheetInput) || getStoredWebAppUrl()) {
      return 'webapp';
    }
    return getConnectionMode();
  });

  const [webAppUrlInput, setWebAppUrlInput] = useState<string>(() => {
    return isAppsScriptUrl(spreadsheetInput) ? spreadsheetInput : getStoredWebAppUrl() || '';
  });

  const [webAppKeyInput, setWebAppKeyInput] = useState<string>(() => {
    return getStoredWebAppKey() || '';
  });

  const [oauthSheetInput, setOauthSheetInput] = useState<string>(() => {
    return !isAppsScriptUrl(spreadsheetInput) ? spreadsheetInput : '';
  });

  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [copiedApiKey, setCopiedApiKey] = useState<boolean>(false);

  const copiedApiKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedCodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedApiKeyTimerRef.current) clearTimeout(copiedApiKeyTimerRef.current);
      if (copiedCodeTimerRef.current) clearTimeout(copiedCodeTimerRef.current);
    };
  }, []);

  // Device PIN change state (completely independent from API_SECRET_KEY)
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [pinChangeStatus, setPinChangeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);

  // Sync mode state
  const handleModeChange = (mode: 'webapp' | 'oauth') => {
    setActiveMode(mode);
    setConnectionMode(mode);
  };

  // Generate cryptographically random 36-char API_SECRET_KEY
  const handleGenerateStrongKey = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const bytes = new Uint8Array(36);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const generated = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    setWebAppKeyInput(generated);
    setShowApiKey(true);
  };

  const handleCopyApiKey = async () => {
    if (!webAppKeyInput.trim()) return;
    try {
      await navigator.clipboard.writeText(webAppKeyInput.trim());
      if (copiedApiKeyTimerRef.current) clearTimeout(copiedApiKeyTimerRef.current);
      setCopiedApiKey(true);
      copiedApiKeyTimerRef.current = setTimeout(() => {
        setCopiedApiKey(false);
        copiedApiKeyTimerRef.current = null;
      }, 2500);
    } catch {
      setCopiedApiKey(false);
    }
  };

  // Connect via Web App API
  const handleWebAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = webAppUrlInput.trim();
    if (!cleanUrl) return;
    saveStoredWebAppUrl(cleanUrl);
    saveStoredWebAppKey(webAppKeyInput.trim());
    onChangeSpreadsheetInput(cleanUrl);
    await onConnectAndSyncSheet(cleanUrl);
  };

  // Change local device PIN (4-6 digits, salted SHA-256 hash only)
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeStatus(null);
    if (!isValidPinFormat(newPinInput)) {
      setPinChangeStatus({ type: 'error', message: 'Mã PIN mới phải gồm từ 4 đến 6 chữ số.' });
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setPinChangeStatus({ type: 'error', message: 'Mã PIN xác nhận không khớp.' });
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await changePin(currentPinInput, newPinInput);
      if (res.success) {
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setPinChangeStatus({
          type: 'success',
          message: 'Đã cập nhật mã PIN khóa thiết bị (băm SHA-256). Khóa API Google Sheet không bị ảnh hưởng.',
        });
      } else {
        setPinChangeStatus({ type: 'error', message: res.error || 'Không thể đổi mã PIN.' });
      }
    } finally {
      setIsChangingPin(false);
    }
  };

  // Connect via OAuth
  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = oauthSheetInput.trim();
    if (!cleanInput) return;
    onChangeSpreadsheetInput(cleanInput);
    await onConnectAndSyncSheet(cleanInput);
  };

  // Quick copy instructions / script
  const handleCopyCode = async () => {
    try {
      const codeText = `// Mở file apps-script/Code.gs trong thư mục mã nguồn dự án để copy toàn bộ.`;
      await navigator.clipboard.writeText(codeText);
      if (copiedCodeTimerRef.current) clearTimeout(copiedCodeTimerRef.current);
      setCopiedCode(true);
      copiedCodeTimerRef.current = setTimeout(() => {
        setCopiedCode(false);
        copiedCodeTimerRef.current = null;
      }, 3000);
    } catch {
      if (copiedCodeTimerRef.current) clearTimeout(copiedCodeTimerRef.current);
      setCopiedCode(true);
      copiedCodeTimerRef.current = setTimeout(() => {
        setCopiedCode(false);
        copiedCodeTimerRef.current = null;
      }, 3000);
    }
  };

  const isConnectedViaWebApp = isAppsScriptUrl(sheetMeta?.spreadsheetId || spreadsheetInput);

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        {/* Panel Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Kết Nối &amp; Đồng Bộ Google Sheets
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                2 Chế Độ
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Đồng bộ 2 chiều dữ liệu <strong>Expenses</strong>, <strong>Income</strong>, <strong>Budget Transfers</strong> và <strong>Check tiền</strong> trực tiếp với Google Sheet của bạn.
            </p>
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất bản sao CSV ({totalExpensesCount + totalIncomeCount} dòng)</span>
          </button>
        </div>

        {/* Connection Mode Selector Tabs */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleModeChange('webapp')}
            className={`flex-1 py-2.5 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'webapp'
                ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-200/80 dark:border-emerald-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Chế độ 1: Web App API (Khuyên dùng · Vĩnh viễn không hết hạn)</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('oauth')}
            className={`flex-1 py-2.5 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeMode === 'oauth'
                ? 'bg-white dark:bg-slate-700 text-indigo-800 dark:text-indigo-300 shadow-xs border border-indigo-200/80 dark:border-indigo-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Chế độ 2: Đăng nhập Google OAuth (Cá nhân · Hết hạn sau 1h)</span>
          </button>
        </div>

        {/* TAB 1: WEB APP API (RECOMMENDED) */}
        {activeMode === 'webapp' && (
          <div className="mt-6 space-y-6">
            <div className="p-5 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-sky-50/60 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-sky-950/30 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <span>Đồng bộ qua Google Apps Script Web App API</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-100 text-emerald-900 uppercase">
                        Khuyên dùng
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      ✓ Không cần đăng nhập Google · ✓ Vĩnh viễn không hết hạn 1 tiếng · ✓ Cả Heo &amp; Mèo dùng chung từ mọi máy &amp; điện thoại
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Hướng dẫn cài đặt (1 phút)</span>
                  {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Collapsible Step-by-Step Guide */}
              {showGuide && (
                <div className="mt-5 pt-4 border-t border-emerald-200/80 dark:border-emerald-800/60 space-y-3 text-xs text-slate-700 dark:text-slate-300 animate-fadeIn">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    Cách tạo Web App URL từ Google Sheet của bạn (Chỉ làm 1 lần duy nhất):
                  </div>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Mở Google Sheet của bạn ➔ chọn menu <strong>Tiện ích mở rộng (Extensions)</strong> ➔ <strong>Apps Script</strong>.
                    </li>
                    <li>
                      Xóa mã cũ trong <code>Code.gs</code> và dán mã nguồn từ tệp <code className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold">apps-script/Code.gs</code>.
                    </li>
                    <li>
                      Bấm nút xanh <strong>Triển khai (Deploy)</strong> ở góc trên bên phải ➔ chọn <strong>Tùy chọn triển khai mới (New deployment)</strong>.
                    </li>
                    <li>
                      Chọn loại bánh răng: <strong>Ứng dụng web (Web app)</strong>.
                    </li>
                    <li>
                      Mục <em>Thực thi dưới dạng (Execute as)</em>: Chọn <strong>Tôi (Me)</strong>.<br />
                      Mục <em>Ai có quyền truy cập (Who has access)</em>: Chọn <strong>Bất kỳ ai (Anyone)</strong> ⚠️.
                    </li>
                    <li>
                      Bấm <strong>Triển khai (Deploy)</strong> ➔ Sao chép <strong>URL ứng dụng web</strong> (dạng <code>https://script.google.com/macros/s/.../exec</code>) và dán vào ô bên dưới!
                    </li>
                  </ol>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href="https://sheets.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-2xs"
                    >
                      <span>Mở Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Đã sao chép hướng dẫn!' : 'Sao chép đường dẫn file Code.gs'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Web App Input Form */}
              <form onSubmit={handleWebAppSubmit} className="mt-5 space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    URL Ứng dụng Web (Web App URL):
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="Dán link https://script.google.com/macros/s/.../exec vào đây..."
                      value={webAppUrlInput}
                      onChange={(e) => setWebAppUrlInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-base sm:text-xs font-mono border border-emerald-300 dark:border-emerald-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                  <div className="sm:col-span-8 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Khóa bí mật <code>API_SECRET_KEY</code> (Độc lập với mã PIN · Khuyến nghị ≥ 32 ký tự):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleGenerateStrongKey}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer"
                          title="Tạo chuỗi bí mật ngẫu nhiên 36 ký tự để dán vào Code.gs"
                        >
                          <Wand2 className="w-3 h-3 text-emerald-600" />
                          <span>Tạo khóa mạnh</span>
                        </button>
                        {webAppKeyInput.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={handleCopyApiKey}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {copiedApiKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedApiKey ? 'Đã chép' : 'Chép'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Nhập API_SECRET_KEY khớp với CONFIG.API_SECRET_KEY trong Code.gs..."
                        value={webAppKeyInput}
                        onChange={(e) => setWebAppKeyInput(e.target.value)}
                        className="w-full pl-8 pr-9 py-2 text-base sm:text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 -m-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-teal-500/60"
                        aria-label={showApiKey ? 'Ẩn khóa API' : 'Hiện khóa API'}
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">
                        Lưu 1 lần trên máy, không bị xóa khi khóa app bằng mã PIN.
                      </span>
                      {webAppKeyInput.trim().length > 0 && (
                        <span
                          className={
                            webAppKeyInput.trim().length >= 32
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'text-amber-700 dark:text-amber-400 font-medium'
                          }
                        >
                          {webAppKeyInput.trim().length >= 32
                            ? `✓ Độ dài an toàn (${webAppKeyInput.trim().length} ký tự)`
                            : `Hiện tại ${webAppKeyInput.trim().length} ký tự (khuyến nghị ≥ 32)`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex items-end pb-5">
                    <button
                      type="submit"
                      disabled={isSyncing || !webAppUrlInput.trim()}
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Đang đồng bộ...' : 'Lưu & Đồng bộ Web App'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Status Pill */}
              {isConnectedViaWebApp && (
                <div className="mt-4 p-3 bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>🟢 Đang kết nối vĩnh viễn qua Web App API (Cả Heo &amp; Mèo cùng dùng chung mà không cần đăng nhập Google).</span>
                  </div>
                  {lastSyncedAt && (
                    <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                      Đồng bộ gần nhất: {lastSyncedAt}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE OAUTH (FALLBACK) */}
        {activeMode === 'oauth' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Bước 1: Xác thực tài khoản Google cá nhân</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Đăng nhập tài khoản Google của bạn để cấp quyền ghi tạm thời (Phiên làm việc kéo dài 60 phút).
                </p>

                <div className="mt-5">
                  {!accessToken ? (
                    <div>
                      {user && (
                        <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                          <div className="font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Phiên đăng nhập Google đã hết hạn</span>
                          </div>
                          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                            Tài khoản <strong>{user.email || user.displayName}</strong>. Nhấn nút bên dưới để cấp quyền lại.
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={onGoogleLogin}
                        disabled={isLoggingIn}
                        className="gsi-material-button w-full"
                      >
                        <div className="gsi-material-button-state"></div>
                        <div className="gsi-material-button-content-wrapper">
                          <div className="gsi-material-button-icon">
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            </svg>
                          </div>
                          <span className="gsi-material-button-contents">
                            {isLoggingIn ? 'Đang đăng nhập...' : 'Sign in with Google'}
                          </span>
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="truncate">Đã xác thực Google</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          {user?.email || user?.displayName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onGoogleLogout}
                        className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Thoát</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                Lưu ý: Nếu chia sẻ cho người khác trong chế độ này, bạn cần thêm email của họ vào danh sách <strong>Test Users</strong> trong Google Cloud Console.
              </div>
            </div>

            {/* Step 2: Spreadsheet URL Input */}
            <div className="lg:col-span-7 p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Bước 2: Nhập đường link Google Sheet của bạn
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dán link đầy đủ (ví dụ: <code className="font-mono text-slate-700 dark:text-slate-300">https://docs.google.com/spreadsheets/d/.../edit</code>).
                </p>

                <form onSubmit={handleOAuthSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Dán link Google Sheet hoặc ID vào đây..."
                      value={oauthSheetInput}
                      onChange={(e) => setOauthSheetInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing || !oauthSheetInput.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {syncError && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{syncError}</div>
          </div>
        )}

        {/* Active Connected Spreadsheet Details */}
        {sheetMeta && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <FileSpreadsheet className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                <span>Bảng tính đang đồng bộ: <strong>{sheetMeta.title}</strong></span>
                {!isAppsScriptUrl(sheetMeta.spreadsheetId) && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetMeta.spreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 hover:underline inline-flex items-center gap-0.5 text-[11px] font-normal"
                    title="Mở Google Sheet trên tab mới"
                  >
                    <span>Mở Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {lastSyncedAt && (
                <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  Cập nhật lúc: {lastSyncedAt}
                </span>
              )}
            </div>

            {/* Tab Selector Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bảng Chi tiêu (Expenses): <span className="text-slate-500 dark:text-slate-400 font-normal">({totalExpensesCount} dòng)</span>
                </label>
                <select
                  value={sheetMeta.expensesTab}
                  onChange={(e) => onSelectExpensesTab?.(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-600 font-medium text-slate-900 dark:text-slate-100"
                >
                  {sheetMeta.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name} {name === sheetMeta.expensesTab ? '✓' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bảng Thu nhập (Income): <span className="text-slate-500 dark:text-slate-400 font-normal">({totalIncomeCount} dòng)</span>
                </label>
                <select
                  value={sheetMeta.incomeTab}
                  onChange={(e) => onSelectIncomeTab?.(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:border-teal-600 font-medium text-slate-900 dark:text-slate-100"
                >
                  {sheetMeta.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name} {name === sheetMeta.incomeTab ? '✓' : ''}
                    </option>
                  ))}
                  {!sheetMeta.sheetNames.includes(sheetMeta.incomeTab) && (
                    <option value={sheetMeta.incomeTab}>
                      {sheetMeta.incomeTab} (Sẽ tự động tạo trên Sheet khi lưu)
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400 pt-1 text-[11px]">
              <span>
                Bảng Đối soát: <strong className="text-slate-900 dark:text-slate-100">{sheetMeta.checkTienTab || 'Chưa phát hiện'}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Bảng Chuyển Budget: <strong className="text-slate-900 dark:text-slate-100">{sheetMeta.budgetTransfersTab || 'Tự động tạo khi chuyển'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Pending Local Records Notice */}
        {pendingLocalRecords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-800 dark:text-amber-300">
              Bạn có <strong>{pendingLocalRecords.length} giao dịch mới</strong> vừa nhập khi chưa nối mạng Sheet.
            </div>
            {sheetMeta && (accessToken || isConnectedViaWebApp) && (
              <button
                type="button"
                onClick={onPushPendingToSheet}
                disabled={isSyncing}
                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Đẩy {pendingLocalRecords.length} dòng chờ lên Google Sheet</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* DEVICE PIN SETTINGS (SEPARATE FROM API_SECRET_KEY) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Đổi mã PIN khóa thiết bị (4–6 số)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mã PIN chỉ dùng để mở khóa giao diện trên thiết bị này (lưu dưới dạng mã băm SHA-256 kèm salt), hoàn toàn tách biệt với <code>API_SECRET_KEY</code> ở trên.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePinSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          {hasConfiguredPin() && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Mã PIN hiện tại
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="4–6 chữ số"
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Mã PIN mới
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="4–6 chữ số"
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Xác nhận PIN mới
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Nhập lại PIN mới"
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPin || newPinInput.length < 4 || confirmPinInput.length < 4}
            className="w-full py-2 px-4 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
          >
            {isChangingPin ? 'Đang lưu...' : 'Cập nhật mã PIN'}
          </button>
        </form>

        {pinChangeStatus && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
              pinChangeStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            {pinChangeStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{pinChangeStatus.message}</span>
          </div>
        )}
      </section>
    </div>
  );
});

SheetSyncPanel.displayName = 'SheetSyncPanel';

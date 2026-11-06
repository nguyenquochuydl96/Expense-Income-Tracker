import React, { useState } from 'react';
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
  Globe,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { User } from 'firebase/auth';
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

  // Sync mode state
  const handleModeChange = (mode: 'webapp' | 'oauth') => {
    setActiveMode(mode);
    setConnectionMode(mode);
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
      const codeText = `// Mở file telegram-bot/Code.gs hoặc apps-script/Code.gs trong thư mục mã nguồn dự án để copy toàn bộ.`;
      await navigator.clipboard.writeText(codeText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
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
                      Xóa mã cũ trong <code>Code.gs</code> và dán mã nguồn từ thư mục <code className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold">telegram-bot/Code.gs</code> (hoặc <code className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold">apps-script/Code.gs</code>).
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
                      href="https://docs.google.com/spreadsheets/d/1CTSEC-J52yGD-VIxOuzyNZ8Qddg0bmOIzMSzRVM6ZTI/edit"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-2xs"
                    >
                      <span>Mở Google Sheet của bạn</span>
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
                      type="text"
                      placeholder="Dán link https://script.google.com/macros/s/.../exec vào đây..."
                      value={webAppUrlInput}
                      onChange={(e) => setWebAppUrlInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-emerald-300 dark:border-emerald-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                  <div className="sm:col-span-8 space-y-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Mã bảo vệ gia đình (Tùy chọn - Nếu bạn có đặt trong file Code.gs):
                    </label>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Để trống nếu không đặt mã bảo vệ..."
                        value={webAppKeyInput}
                        onChange={(e) => setWebAppKeyInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="submit"
                      disabled={isSyncing || !webAppUrlInput.trim()}
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ qua Web App API'}</span>
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
    </div>
  );
});

SheetSyncPanel.displayName = 'SheetSyncPanel';

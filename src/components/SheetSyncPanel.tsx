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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SpreadsheetMetadata } from '../services/googleSheetsService';
import { TransactionRecord } from '../types/finance';

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

export const SheetSyncPanel: React.FC<SheetSyncPanelProps> = ({
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
  const [localInput, setLocalInput] = useState(spreadsheetInput);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onChangeSpreadsheetInput(localInput);
    await onConnectAndSyncSheet(localInput);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Kết Nối &amp; Đồng Bộ Trực Tiếp Google Sheets
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Đọc trực tiếp các bảng <strong>Expenses</strong>, <strong>Income</strong>, <strong>Check tiền</strong> và tự động ghi nối tiếp dòng mới vào cuối bảng mà không làm thay đổi dữ liệu lịch sử cũ.
            </p>
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất bản sao CSV ({totalExpensesCount + totalIncomeCount} dòng)</span>
          </button>
        </div>

        {/* Step 1: Google Account Authentication */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Bước 1: Xác thực tài khoản Google
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Cấp quyền truy cập Google Sheets (với sự cho phép của bạn) để đọc và thêm dòng giao dịch mới.
              </p>

              <div className="mt-5">
                {!accessToken ? (
                  <div>
                    {user && (
                      <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Phiên đăng nhập Google đã hết hạn</span>
                        </div>
                        <div className="mt-1 text-[11px] text-amber-700">
                          Tài khoản <strong>{user.email || user.displayName}</strong>. Dữ liệu đã đồng bộ trước đó vẫn được lưu an toàn. Nhấn nút bên dưới để kết nối lại khi muốn đồng bộ thêm dữ liệu mới.
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={onGoogleLogin}
                      disabled={isLoggingIn}
                      className="gsi-material-button"
                    >
                      <div className="gsi-material-button-state"></div>
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg
                            version="1.1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            style={{ display: 'block' }}
                          >
                            <path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            ></path>
                            <path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            ></path>
                            <path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            ></path>
                            <path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            ></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents">
                          {isLoggingIn ? 'Đang đăng nhập...' : 'Sign in with Google'}
                        </span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">Đã kết nối tài khoản Google</span>
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5">
                        {user?.email || user?.displayName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onGoogleLogout}
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-700 border border-slate-200 rounded-md flex items-center gap-1 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Thoát</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
              Chế độ an toàn: Ứng dụng chỉ dùng lệnh <code className="font-mono-tabular text-slate-700">values.append</code> để nối dòng mới vào cuối bảng, tuyệt đối không xóa hay ghi đè dữ liệu cũ.
            </div>
          </div>

          {/* Step 2: Link Google Sheet URL / Spreadsheet ID */}
          <div className="lg:col-span-7 p-5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">
                Bước 2: Nhập đường dẫn (URL) hoặc ID file Google Sheet của bạn
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Dán đường link đầy đủ của file Google Sheet (ví dụ: <code className="font-mono-tabular">https://docs.google.com/spreadsheets/d/.../edit</code>) để đồng bộ cả 3 bảng <strong>Expenses</strong>, <strong>Income</strong> và <strong>Check tiền</strong>.
              </p>

              <form onSubmit={handleConnectSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Dán link Google Sheet hoặc Spreadsheet ID vào đây..."
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSyncing || !localInput.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Kết nối & Đồng bộ ngay'}</span>
                </button>
              </form>

              {syncError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {syncError}
                </div>
              )}

              {sheetMeta && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                      <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                      <span>File đang kết nối: {sheetMeta.title}</span>
                    </div>
                    {lastSyncedAt && (
                      <span className="text-[11px] font-mono-tabular text-slate-500">
                        Cập nhật lúc: {lastSyncedAt}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                    <span>
                      Bảng Chi tiêu: <strong className="text-slate-900">{sheetMeta.expensesTab}</strong> ({totalExpensesCount} dòng)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Bảng Thu nhập: <strong className="text-slate-900">{sheetMeta.incomeTab}</strong> ({totalIncomeCount} dòng)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Bảng Đối soát:{' '}
                      <strong className="text-slate-900">
                        {sheetMeta.checkTienTab || 'Chưa phát hiện'}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {pendingLocalRecords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-amber-800">
                  Bạn có <strong>{pendingLocalRecords.length} giao dịch mới</strong> vừa nhập khi chưa nối mạng Sheet.
                </div>
                {sheetMeta && accessToken && (
                  <button
                    type="button"
                    onClick={onPushPendingToSheet}
                    disabled={isSyncing}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Đẩy {pendingLocalRecords.length} dòng chờ lên Google Sheet</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

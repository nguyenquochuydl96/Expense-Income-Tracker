import React, { useState } from 'react';
import {
  X,
  Bot,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Smartphone,
  ArrowRightLeft,
  RotateCcw,
  CreditCard,
  Building2,
  Wallet
} from 'lucide-react';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetUrl?: string;
}

export const TelegramBotModal: React.FC<TelegramBotModalProps> = ({
  isOpen,
  onClose,
  spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1CTSEC-J52yGD-VIxOuzyNZ8Qddg0bmOIzMSzRVM6ZTI/edit',
}) => {
  const [activeTab, setActiveTab] = useState<'syntax' | 'guide'>('syntax');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (typeof index === 'number') {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } else {
      setIsCopiedCode(true);
      setTimeout(() => setIsCopiedCode(false), 2000);
    }
  };

  const cheatSheetItems = [
    {
      group: 'Chi tiêu hằng ngày',
      icon: <Smartphone className="w-4 h-4 text-emerald-600" />,
      examples: [
        { cmd: 'heo 50k an sang', note: 'Ăn uống: 50.000 đ | Người chi: Heo' },
        { cmd: 'meo 350k ao shopee', note: 'Shopping: 350.000 đ | Người chi: Mèo' },
        { cmd: 'do xang 70.000', note: 'Điện thoại/Xăng xe: 70.000 đ' },
        { cmd: '120k cafe voi ban', note: 'Ăn uống: 120.000 đ' },
      ],
    },
    {
      group: 'Phụ cấp BE Corp (Được hỗ trợ/Reimburse)',
      icon: <Building2 className="w-4 h-4 text-amber-600" />,
      examples: [
        { cmd: 'be 80k grab di lam', note: 'Điện thoại/Xăng xe: 80.000 đ | BE: 80.000 đ' },
        { cmd: 'heo 150k taxi di gap khach be', note: 'Điện thoại/Xăng xe: 150.000 đ | BE: 150.000 đ' },
      ],
    },
    {
      group: 'Quẹt thẻ tín dụng (Credit Card chu kỳ 25–24)',
      icon: <CreditCard className="w-4 h-4 text-purple-600" />,
      examples: [
        { cmd: 'meo 450k an lau credit', note: 'Ăn uống: 450.000 đ | Credit: 450.000 đ' },
        { cmd: '500k uniqlo cr', note: 'Shopping: 500.000 đ | Credit: 500.000 đ' },
      ],
    },
    {
      group: 'Chuyển ngân sách (Budget Transfer)',
      icon: <ArrowRightLeft className="w-4 h-4 text-indigo-600" />,
      examples: [
        { cmd: 'transfer 100k giai tri heo sang giai tri meo', note: 'Tự tạo 2 dòng đối ứng (-100k Heo, +100k Mèo)' },
        { cmd: 'chuyen 200k an uong sang shopping', note: 'Chuyển 200k từ Ăn uống sang Shopping' },
      ],
    },
    {
      group: 'Ghi nhận Thu nhập (Income)',
      icon: <Wallet className="w-4 h-4 text-blue-600" />,
      examples: [
        { cmd: 'income luong heo 28tr', note: 'Tab Income: Lương Heo +28.000.000 đ' },
        { cmd: 'thu 1.5tr ban man hinh cu', note: 'Tab Income: Bán hàng +1.500.000 đ' },
      ],
    },
    {
      group: 'Lệnh quản lý & Tra cứu',
      icon: <RotateCcw className="w-4 h-4 text-rose-600" />,
      examples: [
        { cmd: '/check', note: 'Xem số dư ví thực tế, tiền BE còn lại, nợ Credit' },
        { cmd: '/undo', note: 'Hoàn tác xóa ngay dòng vừa gõ nhầm khỏi Google Sheet' },
        { cmd: '/categories', note: 'Xem danh sách toàn bộ danh mục hợp lệ' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Bot Telegram Quick-Add</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  24/7 Miễn phí
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Nhập chi tiêu chỉ 2 giây qua chat • Tự động ghi thẳng vào Google Sheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-6 pt-2 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('syntax')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'syntax'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            💬 Cú pháp nhập nhanh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🚀 Hướng dẫn cài đặt 3 phút
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'syntax' ? (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Mẹo:</strong> 2 bạn có thể tạo 1 nhóm chat gồm <strong>Heo + Mèo + Bot</strong>. Bất cứ khi nào đi ăn hoặc thanh toán xong, chỉ cần gõ 1 câu vào nhóm là Google Sheet tự động ghi nhận!
                </div>
              </div>

              {cheatSheetItems.map((group, gIdx) => (
                <div key={gIdx} className="border border-slate-100 rounded-xl p-3.5 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 mb-2.5 font-semibold text-xs text-slate-700">
                    {group.icon}
                    <span>{group.group}</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.examples.map((item, eIdx) => {
                      const itemKey = gIdx * 10 + eIdx;
                      const isCopied = copiedIndex === itemKey;
                      return (
                        <div
                          key={eIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors group"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <code className="text-xs font-mono font-bold text-indigo-700">
                              {item.cmd}
                            </code>
                            <div className="text-[11px] text-slate-500 truncate">
                              ➔ {item.note}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.cmd, itemKey)}
                            title="Sao chép cú pháp"
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>100% Miễn phí &amp; Riêng tư:</strong> Bot chạy trực tiếp bằng <strong>Google Apps Script</strong> trên hạ tầng Google của bạn. Dữ liệu đi thẳng vào Google Sheet, không qua bất kỳ bên thứ 3 nào.
                </div>
              </div>

              {/* Step 1 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    1
                  </span>
                  Tạo Bot trên Telegram (1 phút)
                </div>
                <p>
                  1. Mở Telegram, tìm <strong>@BotFather</strong>.<br />
                  2. Nhắn tin <code>/newbot</code>.<br />
                  3. Đặt tên hiển thị (VD: <em>Heo Mèo Finance</em>) và username kết thúc bằng <em>bot</em> (VD: <em>heomeo_tracker_bot</em>).<br />
                  4. Copy mã <strong>Token</strong> được cung cấp (dạng <code>7123456789:AAFx...</code>).
                </p>
              </div>

              {/* Step 2 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  Mở Google Apps Script &amp; Dán mã nguồn (1 phút)
                </div>
                <p>
                  1. Mở file Google Sheet của bạn ➔ chọn menu <strong>Tiện ích mở rộng (Extensions)</strong> ➔ <strong>Apps Script</strong>.<br />
                  2. Xóa hết mã cũ trong file <code>Code.gs</code>.<br />
                  3. Copy toàn bộ mã trong file <code>telegram-bot/Code.gs</code> dán vào.<br />
                  4. Thay <code>TELEGRAM_BOT_TOKEN</code> bằng Token bạn vừa lấy ở Bước 1.<br />
                  5. Nhấn <code>Ctrl + S</code> để lưu lại.
                </p>
                <div className="pt-2">
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    Mở Google Sheet ngay <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 3 & 4 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  Triển khai Web App &amp; Kích hoạt Webhook (1 phút)
                </div>
                <p>
                  1. Bấm nút xanh <strong>Triển khai (Deploy)</strong> ➔ <strong>Tùy chọn triển khai mới (New deployment)</strong>.<br />
                  2. Chọn loại: <strong>Ứng dụng web (Web app)</strong>.<br />
                  3. Mục <em>Ai có quyền truy cập</em>: chọn <strong>Bất kỳ ai (Anyone)</strong> ⚠️.<br />
                  4. Bấm <strong>Triển khai</strong> ➔ Copy <strong>URL ứng dụng web</strong>.<br />
                  5. Quay lại mã dán vào dòng <code>WEBHOOK_URL</code> ➔ Chọn hàm <code>setWebhook</code> và bấm <strong>Chạy (Run)</strong>.<br />
                  🎉 <strong>Hoàn tất!</strong> Hãy gửi tin nhắn <code>heo 50k an sang</code> để kiểm tra!
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                💡 <strong>Tùy chọn AI (Gemini):</strong> Bạn có thể lấy API Key miễn phí tại <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline font-semibold">aistudio.google.com</a> và dán vào <code>GEMINI_API_KEY</code>. Khi đó bạn có thể nói chuyện hoàn toàn tự nhiên như người thật với bot!
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500">
            Mã nguồn lưu tại: <code className="font-mono text-indigo-700 font-semibold">telegram-bot/Code.gs</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

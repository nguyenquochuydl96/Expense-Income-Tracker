import React from 'react';
import { X, Smartphone, Download, Share, PlusSquare, CheckCircle2, Sparkles } from 'lucide-react';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallSuccess: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
}) => {
  if (!isOpen) return null;

  // Detect iOS
  const isIos =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        onInstallSuccess();
        onClose();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Icon */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="flex items-center -space-x-3 p-1.5 rounded-2xl bg-indigo-950 shadow-md mb-3 border border-indigo-900">
            <div className="w-12 h-12 rounded-full bg-rose-100 ring-2 ring-white/90 flex items-center justify-center shadow-xs z-10">
              <PigIcon className="w-7 h-7" />
            </div>
            <div className="w-12 h-12 rounded-full bg-[#FAF4EE] ring-2 ring-white/90 flex items-center justify-center shadow-xs z-0">
              <SiameseCatIcon className="w-7 h-7" />
            </div>
          </div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Cài đặt Heo &amp; Mèo vào điện thoại
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mở nhanh từ màn hình chính · Trải nghiệm toàn màn hình như ứng dụng native
          </p>
        </div>

        {/* Native Prompt Available (Android / Chrome / Edge) */}
        {deferredPrompt ? (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Thiết bị của bạn đã sẵn sàng cài đặt chỉ với 1 cú chạm!</span>
            </div>
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-950 hover:bg-indigo-900 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Cài đặt ngay vào màn hình chính</span>
            </button>
          </div>
        ) : isIos ? (
          /* iOS Safari Guide */
          <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>Hướng dẫn cho iPhone / iPad (Safari):</span>
            </div>
            <ol className="list-decimal pl-4 space-y-2 text-[11px] text-slate-600 leading-relaxed">
              <li>
                Ở thanh dưới cùng của Safari, bấm nút <strong>Chia sẻ (Share)</strong>{' '}
                <Share className="w-3.5 h-3.5 inline text-sky-600" />.
              </li>
              <li>
                Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>{' '}
                <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />.
              </li>
              <li>
                Bấm <strong>Thêm (Add)</strong> ở góc trên bên phải. App sẽ xuất hiện ngay trên màn hình điện thoại với biểu tượng Heo &amp; Mèo!
              </li>
            </ol>
          </div>
        ) : (
          /* General Desktop / Other browsers */
          <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Cách thêm vào màn hình chính:</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Trên trình duyệt điện thoại (Chrome/Cốc Cốc/Samsung Internet), mở menu <strong>⋮</strong> ở góc trên ➔ chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>.
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

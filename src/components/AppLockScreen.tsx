import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveStoredWebAppKey } from '../services/appsScriptService';

export const STORAGE_KEY_APP_UNLOCKED = 'heomeo_app_unlocked_v1';
export const STORAGE_KEY_CUSTOM_PIN = 'heomeo_custom_pin_v1';
export const DEFAULT_MASTER_PIN = '111196';

export function getEffectiveMasterPin(): string {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (custom && custom.trim().length >= 4) return custom.trim();
  } catch {
    // ignore
  }
  return DEFAULT_MASTER_PIN;
}

export function isDeviceUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_APP_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function lockDevice() {
  try {
    localStorage.removeItem(STORAGE_KEY_APP_UNLOCKED);
  } catch {
    // ignore
  }
}

interface AppLockScreenProps {
  onUnlock: () => void;
}

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const masterPin = getEffectiveMasterPin();

  const handleVerifyPin = useCallback(
    (enteredPin: string) => {
      if (enteredPin === masterPin) {
        setIsSuccess(true);
        setErrorMsg(null);
        if (rememberDevice) {
          try {
            localStorage.setItem(STORAGE_KEY_APP_UNLOCKED, 'true');
          } catch {
            // ignore
          }
        }
        // Save to Apps Script API Key storage as well
        saveStoredWebAppKey(enteredPin);

        setTimeout(() => {
          onUnlock();
        }, 400);
      } else {
        setIsShaking(true);
        setErrorMsg('Mã PIN không đúng, vui lòng thử lại');
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
      }
    },
    [masterPin, rememberDevice, onUnlock]
  );

  const handlePressDigit = useCallback(
    (digit: string) => {
      if (isSuccess || pin.length >= 6) return;
      setErrorMsg(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 6) {
        handleVerifyPin(nextPin);
      }
    },
    [pin, isSuccess, handleVerifyPin]
  );

  const handleDeleteDigit = useCallback(() => {
    if (isSuccess || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess, pin.length]);

  const handleClearAll = useCallback(() => {
    if (isSuccess) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePressDigit, handleDeleteDigit, handleClearAll]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Background glowing aura */}
      <div className="absolute top-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        {/* App Logo & Lock Icon */}
        <div className="relative mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-600 to-teal-400 p-0.5 shadow-xl shadow-indigo-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-3xl sm:text-4xl">
              🐷
            </div>
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-teal-500 border-2 border-slate-950 flex items-center justify-center shadow-md">
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-white" />
            )}
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
          Heo &amp; Mèo Finance
        </h1>
        <p className="text-xs text-slate-300 font-medium mb-6">
          Nhập mã PIN để mở khóa sổ tài chính
        </p>

        {/* 6-dot PIN Indicator */}
        <div
          className={`flex items-center justify-center gap-3.5 mb-6 transition-transform ${
            isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                  isSuccess
                    ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-400/50'
                    : isShaking
                    ? 'bg-rose-500 border-rose-500 scale-105'
                    : isFilled
                    ? 'bg-teal-400 border-teal-400 scale-110 shadow-md shadow-teal-400/40'
                    : 'bg-transparent border-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 sm:gap-3.5 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handlePressDigit(num)}
              className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Clear all, 0, Backspace */}
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
          >
            Xóa hết
          </button>

          <button
            type="button"
            onClick={() => handlePressDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDeleteDigit}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Remember device checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer mb-4 hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 text-teal-500 focus:ring-teal-400 bg-slate-900 cursor-pointer accent-teal-500"
          />
          <span>Ghi nhớ mở khóa trên thiết bị này</span>
        </label>

        {/* Hint button */}
        <button
          type="button"
          onClick={() => setShowHint(!showHint)}
          className="text-[11px] text-slate-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          {showHint ? 'Gợi ý: Ngày sinh nhật (11/11/96)' : 'Quên mã PIN?'}
        </button>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Bảo mật 2 lớp kết hợp Google Apps Script API</span>
        </div>
      </div>
    </div>
  );
};

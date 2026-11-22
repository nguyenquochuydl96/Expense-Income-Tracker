import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';
import { saveStoredWebAppKey } from '../services/appsScriptService';

export const STORAGE_KEY_APP_UNLOCKED = 'heomeo_app_unlocked_v1';
export const STORAGE_KEY_CUSTOM_PIN = 'heomeo_custom_pin_v1';
export const STORAGE_KEY_CUSTOM_PIN_HASH = 'heomeo_custom_pin_hash_v1';
export const STORAGE_KEY_FAILED_ATTEMPTS = 'heomeo_lock_failed_attempts_v1';
export const STORAGE_KEY_LOCKOUT_UNTIL = 'heomeo_lock_until_v1';
export const DEFAULT_MASTER_PIN_HASH = '11fbf75f3d8a3953f521d45de1762447bd2bd3737e0c30074e69948ef58585c7';
export const DEFAULT_PIN_LENGTH = 6;
export const APP_PIN_SALT = 'heomeo_salt_v1_secure_8f9c2d1e';
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  const salted = `${APP_PIN_SALT}:${normalized}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export function getCustomPin(): string | null {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (custom && custom.trim().length >= 4) return custom.trim();
  } catch {
    // ignore
  }
  return null;
}

export async function verifyPin(enteredPin: string): Promise<boolean> {
  const enteredHash = await hashPin(enteredPin);
  try {
    const customHash = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_HASH);
    if (customHash) {
      return enteredHash === customHash;
    }
    const customPlain = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN);
    if (customPlain && customPlain.trim().length >= 4) {
      const computedCustom = await hashPin(customPlain.trim());
      return enteredHash === computedCustom;
    }
  } catch {
    // ignore
  }
  return enteredHash === DEFAULT_MASTER_PIN_HASH;
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
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // Lockout verification timer
  useEffect(() => {
    const checkLockout = () => {
      try {
        const lockoutUntilStr = localStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL);
        if (lockoutUntilStr) {
          const lockoutUntil = parseInt(lockoutUntilStr, 10);
          const now = Date.now();
          if (lockoutUntil > now) {
            setLockoutRemaining(Math.ceil((lockoutUntil - now) / 1000));
            return;
          } else {
            localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
            localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
            setLockoutRemaining(0);
          }
        }
      } catch {
        // ignore
      }
      setLockoutRemaining(0);
    };

    checkLockout();
    const interval = window.setInterval(checkLockout, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleVerifyPin = useCallback(
    async (enteredPin: string) => {
      if (lockoutRemaining > 0) return;

      const isValid = await verifyPin(enteredPin);
      if (isValid) {
        setIsSuccess(true);
        setErrorMsg(null);
        try {
          localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
          localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
          if (rememberDevice) {
            localStorage.setItem(STORAGE_KEY_APP_UNLOCKED, 'true');
          }
        } catch {
          // ignore
        }
        // Save to Apps Script API Key storage as well
        saveStoredWebAppKey(enteredPin);

        const t1 = window.setTimeout(() => {
          onUnlock();
        }, 400);
        timersRef.current.push(t1);
      } else {
        setIsShaking(true);
        let nextFailed = 1;
        try {
          const currentFailed = parseInt(localStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS) || '0', 10) || 0;
          nextFailed = currentFailed + 1;
          localStorage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, String(nextFailed));
          if (nextFailed >= MAX_FAILED_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_DURATION_MS;
            localStorage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, String(until));
            setLockoutRemaining(30);
            setErrorMsg('Đã nhập sai quá 5 lần liên tiếp. Khóa tạm thời 30 giây.');
          } else {
            setErrorMsg(`Mã PIN không đúng (lần ${nextFailed}/${MAX_FAILED_ATTEMPTS})`);
          }
        } catch {
          setErrorMsg('Mã PIN không đúng, vui lòng thử lại');
        }

        const t2 = window.setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
        timersRef.current.push(t2);
      }
    },
    [lockoutRemaining, rememberDevice, onUnlock]
  );

  // Auto-verify when pin matches DEFAULT_PIN_LENGTH (6 digits) or custom pin length
  const handlePressDigit = useCallback(
    (digit: string) => {
      if (isSuccess || lockoutRemaining > 0 || pin.length >= 6) return;
      setErrorMsg(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      const customPin = getCustomPin();
      if (nextPin.length === DEFAULT_PIN_LENGTH || (customPin && nextPin.length === customPin.length)) {
        handleVerifyPin(nextPin);
      }
    },
    [pin, isSuccess, lockoutRemaining, handleVerifyPin]
  );

  const handleDeleteDigit = useCallback(() => {
    if (isSuccess || lockoutRemaining > 0 || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess, lockoutRemaining, pin.length]);

  const handleClearAll = useCallback(() => {
    if (isSuccess || lockoutRemaining > 0) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess, lockoutRemaining]);

  const handleSubmitCurrentPin = useCallback(() => {
    if (pin.length >= 4) {
      handleVerifyPin(pin);
    }
  }, [pin, handleVerifyPin]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutRemaining > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) {
          handleVerifyPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockoutRemaining, pin, handlePressDigit, handleDeleteDigit, handleClearAll, handleVerifyPin]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Background glowing aura */}
      <div className="absolute top-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        {/* App Logo & Lock Icon */}
        <div className="relative mb-4">
          <div className="flex items-center -space-x-3 p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl shadow-indigo-500/25">
            <div
              className="w-12 h-12 rounded-full bg-rose-100 ring-2 ring-white/80 flex items-center justify-center shadow-md z-10"
              title="Heo 🐷"
            >
              <PigIcon className="w-7 h-7" />
            </div>
            <div
              className="w-12 h-12 rounded-full bg-[#FAF4EE] ring-2 ring-white/80 flex items-center justify-center shadow-md z-0"
              title="Mèo Xiêm 🐱"
            >
              <SiameseCatIcon className="w-7 h-7" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-teal-500 border-2 border-slate-950 flex items-center justify-center shadow-md z-20">
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-white" />
            )}
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-0.5">
          Heo &amp; Mèo
        </h1>
        <p className="text-[11px] text-pink-200/90 font-medium mb-2">
          Sổ chi tiêu của ba mẹ Chuối, Đậu, Vịt
        </p>
        <p className="text-xs text-slate-300 font-medium mb-6">
          Nhập mã PIN (4–6 số) để mở khóa sổ chi tiêu
        </p>

        {/* 6-dot PIN Indicator (supports 4-6 digits) */}
        <div
          className={`flex items-center justify-center gap-3.5 mb-4 transition-transform ${
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

        {/* Lockout banner or Error message */}
        {lockoutRemaining > 0 ? (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-800/80 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Đã khóa tạm thời ({lockoutRemaining}s) do nhập sai nhiều lần</span>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="h-6 mb-4" />
        )}

        {/* Numeric Keypad */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 sm:gap-3.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={lockoutRemaining > 0 || isSuccess}
              onClick={() => handlePressDigit(num)}
              className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Backspace, 0, OK/Submit */}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess || pin.length === 0}
            onClick={handleDeleteDigit}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="w-5 h-5" />
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess}
            onClick={() => handlePressDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            disabled={lockoutRemaining > 0 || isSuccess || pin.length < 4}
            onClick={handleSubmitCurrentPin}
            className={`w-full aspect-square rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              pin.length >= 4 && lockoutRemaining === 0
                ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400/50 shadow-md shadow-teal-500/30 active:scale-95'
                : 'bg-white/5 text-slate-500 border-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            aria-label="Mở khóa"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Mở</span>
          </button>
        </div>

        {/* Clear all text button */}
        {pin.length > 0 && lockoutRemaining === 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] text-slate-400 hover:text-white underline underline-offset-4 mb-3 transition-colors cursor-pointer"
          >
            Xóa hết
          </button>
        )}

        {/* Remember device checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer mb-3 hover:text-white transition-colors">
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
          className="text-[11px] text-slate-400 hover:text-teal-300 underline underline-offset-4 transition-colors cursor-pointer mb-3"
        >
          {showHint ? 'Liên hệ Heo để được bật mí 😉' : 'Quên mã PIN?'}
        </button>

        {/* Security badge footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Mã hóa SHA-256 kết hợp Google Apps Script API</span>
        </div>
      </div>
    </div>
  );
};

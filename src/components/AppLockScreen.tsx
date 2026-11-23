import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { PigIcon, SiameseCatIcon } from '../utils/categoryIcons';
import { clearStoredAccessToken } from '../services/authStorage';

export const STORAGE_KEY_APP_UNLOCKED = 'heomeo_app_unlocked_v1';
export const STORAGE_KEY_CUSTOM_PIN_HASH = 'heomeo_custom_pin_hash_v1';
export const STORAGE_KEY_CUSTOM_PIN_LENGTH = 'heomeo_custom_pin_len_v1';
export const STORAGE_KEY_FAILED_ATTEMPTS = 'heomeo_lock_failed_attempts_v1';
export const STORAGE_KEY_LOCKOUT_UNTIL = 'heomeo_lock_until_v1';
const LEGACY_STORAGE_KEY_PLAINTEXT_PIN = 'heomeo_custom_pin_v1';

export const MIN_PIN_LENGTH = 4;
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

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}

/**
 * Migrate any legacy plaintext PIN in localStorage to SHA-256 hash and ALWAYS delete the plaintext key.
 */
export async function migrateAndPurgeLegacyPlaintextPin(): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    const legacyPlain = localStorage.getItem(LEGACY_STORAGE_KEY_PLAINTEXT_PIN);
    if (legacyPlain !== null) {
      const cleaned = legacyPlain.trim();
      const existingHash = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_HASH);
      if (!existingHash && isValidPinFormat(cleaned)) {
        const computed = await hashPin(cleaned);
        localStorage.setItem(STORAGE_KEY_CUSTOM_PIN_HASH, computed);
        localStorage.setItem(STORAGE_KEY_CUSTOM_PIN_LENGTH, String(cleaned.length));
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY_PLAINTEXT_PIN);
    }
  } catch {
    // ignore storage errors
  }
}

export function hasConfiguredPin(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const hash = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_HASH);
    return Boolean(hash && hash.trim().length > 0);
  } catch {
    return false;
  }
}

export function getConfiguredPinLength(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PIN_LENGTH;
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_LENGTH);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (parsed >= MIN_PIN_LENGTH && parsed <= DEFAULT_PIN_LENGTH) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PIN_LENGTH;
}

/**
 * Saves ONLY the salted SHA-256 hash and length (4-6) of the device lock PIN.
 * Completely independent from Apps Script API_SECRET_KEY.
 */
export async function savePinHash(pin: string): Promise<string> {
  const cleaned = pin.trim();
  if (!isValidPinFormat(cleaned)) {
    throw new Error('Mã PIN phải gồm 4 đến 6 chữ số.');
  }
  const hashed = await hashPin(cleaned);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_PIN_HASH, hashed);
    localStorage.setItem(STORAGE_KEY_CUSTOM_PIN_LENGTH, String(cleaned.length));
    localStorage.removeItem(LEGACY_STORAGE_KEY_PLAINTEXT_PIN);
    localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
  } catch {
    // ignore
  }
  return hashed;
}

export async function verifyPin(enteredPin: string): Promise<boolean> {
  await migrateAndPurgeLegacyPlaintextPin();
  const cleaned = enteredPin.trim();
  if (!cleaned) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    const storedHash = localStorage.getItem(STORAGE_KEY_CUSTOM_PIN_HASH);
    if (!storedHash || !storedHash.trim()) {
      return false;
    }
    const enteredHash = await hashPin(cleaned);
    return enteredHash === storedHash.trim();
  } catch {
    return false;
  }
}

export async function changePin(
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const cleanNew = newPin.trim();
  if (!isValidPinFormat(cleanNew)) {
    return { success: false, error: 'Mã PIN mới phải gồm từ 4 đến 6 chữ số.' };
  }

  if (hasConfiguredPin()) {
    const validCurrent = await verifyPin(currentPin);
    if (!validCurrent) {
      return { success: false, error: 'Mã PIN hiện tại không đúng.' };
    }
  }

  await savePinHash(cleanNew);
  return { success: true };
}

export function isDeviceUnlocked(): boolean {
  try {
    // Require both unlocked flag and a configured PIN hash so fresh devices always run first-time PIN setup
    return (
      hasConfiguredPin() &&
      localStorage.getItem(STORAGE_KEY_APP_UNLOCKED) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Locks the device UI and clears the RAM-only Google OAuth access token.
 * Preserves Web App URL and API_SECRET_KEY in localStorage for practical daily unlock UX.
 */
export function lockDevice() {
  clearStoredAccessToken();
  try {
    localStorage.removeItem(STORAGE_KEY_APP_UNLOCKED);
  } catch {
    // ignore
  }
}

interface AppLockScreenProps {
  onUnlock: () => void;
}

type LockScreenMode = 'unlock' | 'setup_enter' | 'setup_confirm';

export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const [mode, setMode] = useState<LockScreenMode>(() =>
    hasConfiguredPin() ? 'unlock' : 'setup_enter'
  );
  const [pin, setPin] = useState<string>('');
  const [firstSetupPin, setFirstSetupPin] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    let active = true;
    migrateAndPurgeLegacyPlaintextPin().then(() => {
      if (!active) return;
      if (hasConfiguredPin()) {
        setMode((prev) => (prev === 'setup_enter' ? 'unlock' : prev));
      }
    });
    return () => {
      active = false;
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // Lockout verification timer (applies in unlock mode)
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

  const triggerErrorShake = useCallback((message: string, clearPin = true) => {
    setErrorMsg(message);
    setIsShaking(true);
    const t = window.setTimeout(() => {
      setIsShaking(false);
      if (clearPin) setPin('');
    }, 550);
    timersRef.current.push(t);
  }, []);

  const completeUnlock = useCallback(() => {
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
    const t1 = window.setTimeout(() => {
      onUnlock();
    }, 380);
    timersRef.current.push(t1);
  }, [rememberDevice, onUnlock]);

  const handleVerifyPin = useCallback(
    async (enteredPin: string) => {
      if (lockoutRemaining > 0) return;

      const isValid = await verifyPin(enteredPin);
      if (isValid) {
        // PIN unlocks the device UI ONLY — never overwrites Apps Script API_SECRET_KEY
        completeUnlock();
      } else {
        setIsShaking(true);
        let nextFailed = 1;
        try {
          const currentFailed =
            parseInt(localStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS) || '0', 10) || 0;
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
    [lockoutRemaining, completeUnlock]
  );

  const handleSetupContinue = useCallback(
    async (enteredPin: string) => {
      if (!isValidPinFormat(enteredPin)) {
        triggerErrorShake('Mã PIN phải gồm từ 4 đến 6 chữ số.', false);
        return;
      }

      if (mode === 'setup_enter') {
        setFirstSetupPin(enteredPin);
        setPin('');
        setErrorMsg(null);
        setMode('setup_confirm');
        return;
      }

      if (mode === 'setup_confirm') {
        if (enteredPin !== firstSetupPin) {
          triggerErrorShake('Mã PIN xác nhận không khớp. Vui lòng nhập lại.');
          return;
        }
        await savePinHash(enteredPin);
        completeUnlock();
      }
    },
    [mode, firstSetupPin, triggerErrorShake, completeUnlock]
  );

  const handlePressDigit = useCallback(
    (digit: string) => {
      if (isSuccess || (mode === 'unlock' && lockoutRemaining > 0) || pin.length >= DEFAULT_PIN_LENGTH) {
        return;
      }
      setErrorMsg(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      if (mode === 'unlock') {
        const configuredLen = getConfiguredPinLength();
        if (nextPin.length === configuredLen) {
          handleVerifyPin(nextPin);
        }
      } else if (mode === 'setup_confirm' && nextPin.length === firstSetupPin.length) {
        handleSetupContinue(nextPin);
      }
    },
    [pin, isSuccess, mode, lockoutRemaining, firstSetupPin.length, handleVerifyPin, handleSetupContinue]
  );

  const handleDeleteDigit = useCallback(() => {
    if (isSuccess || (mode === 'unlock' && lockoutRemaining > 0) || pin.length === 0) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess, mode, lockoutRemaining, pin.length]);

  const handleClearAll = useCallback(() => {
    if (isSuccess || (mode === 'unlock' && lockoutRemaining > 0)) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess, mode, lockoutRemaining]);

  const handleSubmitCurrentPin = useCallback(() => {
    if (pin.length < MIN_PIN_LENGTH) return;
    if (mode === 'unlock') {
      handleVerifyPin(pin);
    } else {
      handleSetupContinue(pin);
    }
  }, [pin, mode, handleVerifyPin, handleSetupContinue]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'unlock' && lockoutRemaining > 0) return;
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
        if (pin.length >= MIN_PIN_LENGTH) {
          handleSubmitCurrentPin();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, lockoutRemaining, pin, handlePressDigit, handleDeleteDigit, handleClearAll, handleSubmitCurrentPin]);

  const isLockedOut = mode === 'unlock' && lockoutRemaining > 0;
  const dotCount = mode === 'setup_confirm' ? firstSetupPin.length : DEFAULT_PIN_LENGTH;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] select-none">
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
            ) : mode === 'unlock' ? (
              <Lock className="w-3.5 h-3.5 text-white" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-white" />
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

        {mode === 'setup_enter' ? (
          <div className="mb-5 space-y-1">
            <p className="text-sm font-semibold text-teal-300">
              Thiết lập mã PIN khóa thiết bị lần đầu
            </p>
            <p className="text-xs text-slate-300">
              Tạo mã PIN riêng (4–6 số) rồi bấm <strong>Tiếp</strong>. Mã PIN chỉ bảo vệ máy này, độc lập với khóa API Google Sheet.
            </p>
          </div>
        ) : mode === 'setup_confirm' ? (
          <div className="mb-5 space-y-1">
            <p className="text-sm font-semibold text-teal-300">
              Xác nhận lại mã PIN ({firstSetupPin.length} số)
            </p>
            <p className="text-xs text-slate-300">
              Nhập lại chính xác mã PIN bạn vừa tạo để hoàn tất
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-300 font-medium mb-6">
            Nhập mã PIN (4–6 số) để mở khóa sổ chi tiêu
          </p>
        )}

        {/* PIN Indicator dots */}
        <div
          className={`flex items-center justify-center gap-3.5 mb-4 transition-transform ${
            isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
          }`}
        >
          {Array.from({ length: dotCount }).map((_, idx) => {
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
        {isLockedOut ? (
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
              disabled={isLockedOut || isSuccess}
              onClick={() => handlePressDigit(num)}
              className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Row 4: Backspace, 0, OK/Submit */}
          <button
            type="button"
            disabled={isLockedOut || isSuccess || pin.length === 0}
            onClick={handleDeleteDigit}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            aria-label="Xóa 1 ký tự"
          >
            <Delete className="w-5 h-5" />
          </button>

          <button
            type="button"
            disabled={isLockedOut || isSuccess}
            onClick={() => handlePressDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/5 hover:bg-white/15 active:bg-teal-500/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-xl font-bold font-mono-tabular transition-all flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            disabled={isLockedOut || isSuccess || pin.length < MIN_PIN_LENGTH}
            onClick={handleSubmitCurrentPin}
            className={`w-full aspect-square rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              pin.length >= MIN_PIN_LENGTH && !isLockedOut
                ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400/50 shadow-md shadow-teal-500/30 active:scale-95'
                : 'bg-white/5 text-slate-500 border-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            aria-label={mode === 'setup_enter' ? 'Tiếp tục' : mode === 'setup_confirm' ? 'Lưu PIN' : 'Mở khóa'}
          >
            <ArrowRight className="w-4 h-4" />
            <span>{mode === 'setup_enter' ? 'Tiếp' : mode === 'setup_confirm' ? 'Lưu' : 'Mở'}</span>
          </button>
        </div>

        {/* Setup back button or Clear all button */}
        <div className="flex items-center justify-center gap-4 mb-3 min-h-[20px]">
          {mode === 'setup_confirm' && !isSuccess && (
            <button
              type="button"
              onClick={() => {
                setMode('setup_enter');
                setFirstSetupPin('');
                setPin('');
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Nhập lại mã mới</span>
            </button>
          )}
          {pin.length > 0 && !isLockedOut && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-slate-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              Xóa hết
            </button>
          )}
        </div>

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

        {/* Hint button (unlock mode only) */}
        {mode === 'unlock' && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-[11px] text-slate-400 hover:text-teal-300 underline underline-offset-4 transition-colors cursor-pointer mb-3 max-w-xs"
          >
            {showHint
              ? 'Mã PIN lưu riêng trên máy này (băm SHA-256). Nếu quên, hãy xóa dữ liệu trang web của trình duyệt để đặt lại PIN mới.'
              : 'Quên mã PIN?'}
          </button>
        )}

        {/* Security badge footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Mã PIN băm SHA-256 cục bộ · Độc lập với API Key</span>
        </div>
      </div>
    </div>
  );
};

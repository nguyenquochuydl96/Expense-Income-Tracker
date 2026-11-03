import { useState, useEffect } from 'react';

export const STORAGE_KEY_PRIVACY = 'heomeo_privacy_mode_v1';

let globalPrivacyMode = false;
try {
  globalPrivacyMode = localStorage.getItem(STORAGE_KEY_PRIVACY) === 'true';
} catch {
  globalPrivacyMode = false;
}

const listeners = new Set<(isPrivate: boolean) => void>();

export function isPrivacyActive(): boolean {
  return globalPrivacyMode;
}

export function setPrivacyMode(enabled: boolean) {
  globalPrivacyMode = enabled;
  try {
    localStorage.setItem(STORAGE_KEY_PRIVACY, String(enabled));
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn(enabled));
}

export function togglePrivacyMode(): boolean {
  const next = !globalPrivacyMode;
  setPrivacyMode(next);
  return next;
}

/**
 * Hook to consume and toggle privacy mode anywhere in the app
 */
export function usePrivacyMode() {
  const [isPrivate, setIsPrivate] = useState<boolean>(globalPrivacyMode);

  useEffect(() => {
    const handler = (newVal: boolean) => setIsPrivate(newVal);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    isPrivate,
    togglePrivacy: togglePrivacyMode,
  };
}

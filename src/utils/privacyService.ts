import { useState, useEffect } from 'react';

export const STORAGE_KEY_PRIVACY = 'heomeo_privacy_mode_v1';

// Mặc định luôn là TRUE (Ẩn số tiền) mỗi khi mở app hoặc tải lại trang
// Bảo vệ dữ liệu tài chính cá nhân khỏi người xung quanh khi mở ở cơ quan, văn phòng hay nơi công cộng
let globalPrivacyMode = true;

const listeners = new Set<(isPrivate: boolean) => void>();

export function isPrivacyActive(): boolean {
  return globalPrivacyMode;
}

export function setPrivacyMode(enabled: boolean) {
  globalPrivacyMode = enabled;
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

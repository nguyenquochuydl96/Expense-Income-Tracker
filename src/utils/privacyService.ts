import { useSyncExternalStore } from 'react';

export const STORAGE_KEY_PRIVACY = 'heomeo_privacy_mode_v1';

// Mặc định luôn là FALSE (Hiện số bình thường) mỗi khi mở app hoặc tải lại trang
// Chỉ ẩn tạm thời khi người dùng chủ động bấm "Ẩn số" trong phiên làm việc
let globalPrivacyMode = false;

const listeners = new Set<() => void>();

export function isPrivacyActive(): boolean {
  return globalPrivacyMode;
}

export function setPrivacyMode(enabled: boolean) {
  if (globalPrivacyMode !== enabled) {
    globalPrivacyMode = enabled;
    listeners.forEach((fn) => fn());
  }
}

export function togglePrivacyMode(): boolean {
  const next = !globalPrivacyMode;
  setPrivacyMode(next);
  return next;
}

function subscribePrivacy(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getPrivacySnapshot(): boolean {
  return globalPrivacyMode;
}

/**
 * Hook to consume and toggle privacy mode anywhere in the app
 */
export function usePrivacyMode() {
  const isPrivate = useSyncExternalStore(subscribePrivacy, getPrivacySnapshot, () => false);

  return {
    isPrivate,
    togglePrivacy: togglePrivacyMode,
  };
}

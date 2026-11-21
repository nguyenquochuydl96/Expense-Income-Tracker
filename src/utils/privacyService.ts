import { useSyncExternalStore } from 'react';

export const STORAGE_KEY_PRIVACY = 'heomeo_privacy_mode_v1';

// Mặc định luôn là TRUE (Ẩn số tiền) mỗi khi mở app hoặc tải lại trang
// Bảo vệ dữ liệu tài chính cá nhân khỏi người xung quanh khi mở ở cơ quan, văn phòng hay nơi công cộng
let globalPrivacyMode = true;

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
  const isPrivate = useSyncExternalStore(subscribePrivacy, getPrivacySnapshot, () => true);

  return {
    isPrivate,
    togglePrivacy: togglePrivacyMode,
  };
}

const LEGACY_TOKEN_KEY = 'heomeo_google_access_token_v1';
const LEGACY_TOKEN_EXPIRY_KEY = 'heomeo_google_token_expiry_v1';

// Strictly RAM-only OAuth access token storage (never persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedTokenExpiry: number | null = null;

/**
 * Proactively removes any legacy OAuth access token keys from localStorage.
 */
export const purgeLegacyLocalStorageTokens = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_EXPIRY_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

// Scrub legacy localStorage keys immediately on module load
purgeLegacyLocalStorageTokens();

export const saveAccessToken = (token: string, expiresInSecs = 3500) => {
  cachedAccessToken = token;
  cachedTokenExpiry = Date.now() + expiresInSecs * 1000;
  purgeLegacyLocalStorageTokens();
};

export const clearStoredAccessToken = () => {
  cachedAccessToken = null;
  cachedTokenExpiry = null;
  purgeLegacyLocalStorageTokens();
};

export const getStoredAccessToken = (): string | null => {
  purgeLegacyLocalStorageTokens();
  if (!cachedAccessToken || cachedTokenExpiry === null) {
    return null;
  }
  // Leave 2-minute safety buffer before expiration
  if (Date.now() < cachedTokenExpiry - 120000) {
    return cachedAccessToken;
  }
  clearStoredAccessToken();
  return null;
};

export const isStoredTokenExpired = (): boolean => {
  if (!cachedAccessToken || cachedTokenExpiry === null) return true;
  return Date.now() >= cachedTokenExpiry;
};

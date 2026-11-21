const TOKEN_KEY = 'heomeo_google_access_token_v1';
const TOKEN_EXPIRY_KEY = 'heomeo_google_token_expiry_v1';

let cachedAccessToken: string | null = null;

export const saveAccessToken = (token: string, expiresInSecs = 3500) => {
  cachedAccessToken = token;
  const expiresAt = Date.now() + expiresInSecs * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  } catch (e) {
    console.warn('Cannot persist access token to localStorage', e);
  }
};

export const clearStoredAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // ignore
  }
};

export const getStoredAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiryStr) return null;
    const expiry = Number(expiryStr);
    // If token hasn't expired (leave 2 min safety buffer)
    if (Date.now() < expiry - 120000) {
      cachedAccessToken = token;
      return token;
    }
    clearStoredAccessToken();
    return null;
  } catch {
    return null;
  }
};

export const isStoredTokenExpired = (): boolean => {
  try {
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryStr) return true;
    return Date.now() >= Number(expiryStr);
  } catch {
    return true;
  }
};

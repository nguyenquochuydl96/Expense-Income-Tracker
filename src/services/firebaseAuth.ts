import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  saveAccessToken,
  clearStoredAccessToken,
  getStoredAccessToken,
  isStoredTokenExpired,
} from './authStorage';

export {
  saveAccessToken,
  clearStoredAccessToken,
  getStoredAccessToken,
  isStoredTokenExpired,
};

export type { User };

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

let authInstance: ReturnType<typeof getAuth> | null = null;
let providerInstance: GoogleAuthProvider | null = null;

function getFirebaseAuth() {
  if (!authInstance) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    authInstance = getAuth(app);
  }
  return authInstance;
}

function getGoogleProvider() {
  if (!providerInstance) {
    providerInstance = new GoogleAuthProvider();
    SCOPES.forEach((scope) => providerInstance!.addScope(scope));
  }
  return providerInstance;
}

let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getStoredAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      clearStoredAccessToken();
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không lấy được quyền truy cập Google Sheets từ phiên đăng nhập.');
    }

    saveAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredAccessToken();
};

export const logout = async () => {
  const auth = getFirebaseAuth();
  await auth.signOut();
  clearStoredAccessToken();
};

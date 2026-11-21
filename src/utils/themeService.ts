import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';

export const STORAGE_KEY_THEME = 'heomeo_theme_mode_v1';

// Initial state resolution from URL params or localStorage
let currentMode: ThemeMode = 'light';
try {
  let paramMode: string | null = null;
  if (typeof window !== 'undefined' && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    paramMode = params.get('theme_mode') || params.get('theme');
  }

  if (paramMode === 'dark' || paramMode === 'light') {
    currentMode = paramMode;
  } else {
    const savedMode = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedMode === 'dark' || savedMode === 'light') {
      currentMode = savedMode;
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      currentMode = 'dark';
    } else {
      currentMode = 'light';
    }
  }
} catch {
  currentMode = 'light';
}

// Clean up legacy multi-theme palette if present
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('heomeo_theme_palette_v1');
  }
} catch {
  // ignore
}

// Apply class to HTML tag immediately
export function applyThemeToDom(mode: ThemeMode) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // Dynamically synchronize meta theme-color with active background (Kinlo Light #ffffff, Kinlo Dark #0f172a)
    try {
      const themeColor = mode === 'dark' ? '#0f172a' : '#ffffff';

      const metaTags = document.querySelectorAll('meta[name="theme-color"]');
      if (metaTags.length > 0) {
        metaTags.forEach((meta) => {
          meta.setAttribute('content', themeColor);
        });
      } else {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = themeColor;
        document.head.appendChild(meta);
      }
    } catch {
      // Ignore during SSR or tests
    }
  }
}

// Initial application on bundle load
applyThemeToDom(currentMode);

interface ThemeStateSnapshot {
  mode: ThemeMode;
}

let themeSnapshot: ThemeStateSnapshot = {
  mode: currentMode,
};

const themeListeners = new Set<() => void>();

function subscribeTheme(callback: () => void): () => void {
  themeListeners.add(callback);
  return () => {
    themeListeners.delete(callback);
  };
}

function getThemeSnapshot(): ThemeStateSnapshot {
  return themeSnapshot;
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode) {
  if (currentMode === mode) return;
  currentMode = mode;
  themeSnapshot = { mode: currentMode };
  applyThemeToDom(currentMode);
  try {
    localStorage.setItem(STORAGE_KEY_THEME, mode);
  } catch {
    // ignore
  }
  themeListeners.forEach((fn) => fn());
}

export function toggleThemeMode(): ThemeMode {
  const next = currentMode === 'light' ? 'dark' : 'light';
  setThemeMode(next);
  return next;
}

/**
 * Main theme hook: light / dark mode
 */
export function useThemeMode() {
  const { mode } = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => ({ mode: 'light' as ThemeMode })
  );

  return {
    mode,
    theme: mode,
    isDark: mode === 'dark',
    toggleTheme: toggleThemeMode,
    setTheme: setThemeMode,
  };
}

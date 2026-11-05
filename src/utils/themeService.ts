import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

export const STORAGE_KEY_THEME = 'heomeo_theme_mode_v1';

// Initial state resolution from localStorage
let currentMode: ThemeMode = 'light';
try {
  const savedMode = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedMode === 'dark' || savedMode === 'light') {
    currentMode = savedMode;
  } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    currentMode = 'dark';
  } else {
    currentMode = 'light';
  }
} catch {
  currentMode = 'light';
}

// Clean up legacy multi-theme palette key if present
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
    // Remove obsolete data-theme attribute
    document.documentElement.removeAttribute('data-theme');
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }
}

// Initial application on bundle load
applyThemeToDom(currentMode);

const modeListeners = new Set<(mode: ThemeMode) => void>();

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  applyThemeToDom(currentMode);
  try {
    localStorage.setItem(STORAGE_KEY_THEME, mode);
  } catch {
    // ignore
  }
  modeListeners.forEach((fn) => fn(mode));
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
  const [mode, setModeState] = useState<ThemeMode>(currentMode);

  useEffect(() => {
    const mHandler = (newMode: ThemeMode) => setModeState(newMode);
    modeListeners.add(mHandler);
    return () => {
      modeListeners.delete(mHandler);
    };
  }, []);

  return {
    mode,
    theme: mode,
    isDark: mode === 'dark',
    toggleTheme: toggleThemeMode,
    setTheme: setThemeMode,
  };
}

/**
 * Backward compatibility hook for useThemeSystem
 */
export function useThemeSystem() {
  const { mode, isDark, toggleTheme, setTheme } = useThemeMode();
  return {
    palette: 'natural',
    setPalette: () => {},
    mode,
    isDark,
    toggleMode: toggleTheme,
    setMode: setTheme,
    activeThemeConfig: {
      id: 'natural',
      name: 'Natural Organic Fintech',
      tagline: 'Giao diện tự nhiên, tinh tế, tối giản',
      icon: '🌿',
      accentColor: '#0EA5E9',
      secondaryColor: '#10B981',
      cardGlow: 'rgba(14, 165, 233, 0.15)',
    },
    availablePalettes: [],
  };
}

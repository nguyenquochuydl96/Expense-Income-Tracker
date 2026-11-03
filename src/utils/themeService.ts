import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

export const STORAGE_KEY_THEME = 'heomeo_theme_mode_v1';

let currentTheme: ThemeMode = 'light';
try {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  if (saved === 'dark' || saved === 'light') {
    currentTheme = saved;
  }
} catch {
  currentTheme = 'light';
}

// Apply class to html
export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

// Initial application
applyThemeToDom(currentTheme);

const themeListeners = new Set<(theme: ThemeMode) => void>();

export function getThemeMode(): ThemeMode {
  return currentTheme;
}

export function setThemeMode(theme: ThemeMode) {
  currentTheme = theme;
  applyThemeToDom(theme);
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch {
    // ignore
  }
  themeListeners.forEach((fn) => fn(theme));
}

export function toggleThemeMode(): ThemeMode {
  const next = currentTheme === 'light' ? 'dark' : 'light';
  setThemeMode(next);
  return next;
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(currentTheme);

  useEffect(() => {
    const handler = (newTheme: ThemeMode) => setTheme(newTheme);
    themeListeners.add(handler);
    return () => {
      themeListeners.delete(handler);
    };
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: toggleThemeMode,
    setTheme: setThemeMode,
  };
}

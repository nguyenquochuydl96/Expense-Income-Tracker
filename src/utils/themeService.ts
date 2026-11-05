import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemePreset = 'kinlo' | 'cofra';

export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  tagline: string;
  icon: string;
  accentColor: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  kinlo: {
    id: 'kinlo',
    name: 'Kinlo (Ocean)',
    tagline: 'Xanh mòng két, hào quang atmospheric ấm áp',
    icon: '🌿',
    accentColor: '#0e6c84',
  },
  cofra: {
    id: 'cofra',
    name: 'Cofra (Mono Luxe)',
    tagline: 'Tối giản đơn sắc đen trắng, tinh tế & tĩnh lặng',
    icon: '🏛️',
    accentColor: '#111111',
  },
};

export const STORAGE_KEY_THEME = 'heomeo_theme_mode_v1';
export const STORAGE_KEY_THEME_PRESET = 'heomeo_theme_preset_v1';

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

let currentPreset: ThemePreset = 'kinlo';
try {
  const savedPreset = localStorage.getItem(STORAGE_KEY_THEME_PRESET);
  if (savedPreset === 'cofra' || savedPreset === 'kinlo') {
    currentPreset = savedPreset;
  } else {
    currentPreset = 'kinlo';
  }
} catch {
  currentPreset = 'kinlo';
}

// Clean up legacy multi-theme palette key if present
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('heomeo_theme_palette_v1');
  }
} catch {
  // ignore
}

// Apply class and attribute to HTML tag immediately
export function applyThemeToDom(mode: ThemeMode, preset: ThemePreset) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme-preset', preset);
    root.removeAttribute('data-theme');
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }
}

// Initial application on bundle load
applyThemeToDom(currentMode, currentPreset);

const themeListeners = new Set<(state: { mode: ThemeMode; preset: ThemePreset }) => void>();

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function getThemePreset(): ThemePreset {
  return currentPreset;
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  applyThemeToDom(currentMode, currentPreset);
  try {
    localStorage.setItem(STORAGE_KEY_THEME, mode);
  } catch {
    // ignore
  }
  themeListeners.forEach((fn) => fn({ mode: currentMode, preset: currentPreset }));
}

export function setThemePreset(preset: ThemePreset) {
  currentPreset = preset;
  applyThemeToDom(currentMode, currentPreset);
  try {
    localStorage.setItem(STORAGE_KEY_THEME_PRESET, preset);
  } catch {
    // ignore
  }
  themeListeners.forEach((fn) => fn({ mode: currentMode, preset: currentPreset }));
}

export function toggleThemeMode(): ThemeMode {
  const next = currentMode === 'light' ? 'dark' : 'light';
  setThemeMode(next);
  return next;
}

export function toggleThemePreset(): ThemePreset {
  const next = currentPreset === 'kinlo' ? 'cofra' : 'kinlo';
  setThemePreset(next);
  return next;
}

/**
 * Main theme hook: light / dark mode + theme preset (kinlo / cofra)
 */
export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(currentMode);
  const [preset, setPresetState] = useState<ThemePreset>(currentPreset);

  useEffect(() => {
    const handler = (state: { mode: ThemeMode; preset: ThemePreset }) => {
      setModeState(state.mode);
      setPresetState(state.preset);
    };
    themeListeners.add(handler);
    return () => {
      themeListeners.delete(handler);
    };
  }, []);

  return {
    mode,
    preset,
    theme: mode,
    isDark: mode === 'dark',
    toggleTheme: toggleThemeMode,
    setTheme: setThemeMode,
    togglePreset: toggleThemePreset,
    setPreset: setThemePreset,
    activeConfig: THEME_PRESETS[preset],
    availablePresets: [THEME_PRESETS.kinlo, THEME_PRESETS.cofra],
  };
}

/**
 * Backward compatibility hook for useThemeSystem
 */
export function useThemeSystem() {
  const { mode, preset, isDark, toggleTheme, setTheme, togglePreset, setPreset, activeConfig, availablePresets } = useThemeMode();
  return {
    palette: preset,
    setPalette: setPreset,
    togglePalette: togglePreset,
    mode,
    isDark,
    toggleMode: toggleTheme,
    setMode: setTheme,
    activeThemeConfig: activeConfig,
    availablePalettes: availablePresets,
  };
}

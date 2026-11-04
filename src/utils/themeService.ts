import { useState, useEffect } from 'react';

export type ThemePalette = 'obsidian' | 'emerald' | 'oceanic' | 'espresso' | 'classic';
export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  id: ThemePalette;
  name: string;
  tagline: string;
  icon: string;
  accentColor: string;
  secondaryColor: string;
  cardGlow: string;
}

export const AVAILABLE_PALETTES: ThemeConfig[] = [
  {
    id: 'obsidian',
    name: 'Copilot Obsidian & Aurora',
    tagline: 'Fintech cao cấp, viền ánh cực quang (Apple Award)',
    icon: '✨',
    accentColor: '#06B6D4',
    secondaryColor: '#6366F1',
    cardGlow: 'rgba(6, 182, 212, 0.25)',
  },
  {
    id: 'emerald',
    name: 'Monarch Emerald & Gold',
    tagline: 'Xanh ngọc lục bảo & Vàng kim thịnh vượng',
    icon: '🍀',
    accentColor: '#10B981',
    secondaryColor: '#F59E0B',
    cardGlow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    id: 'oceanic',
    name: 'Oceanic Navy & Tangerine',
    tagline: 'Ngân hàng số Neobank dứt khoát, năng động',
    icon: '⚡',
    accentColor: '#FF6B00',
    secondaryColor: '#2563EB',
    cardGlow: 'rgba(255, 107, 0, 0.25)',
  },
  {
    id: 'espresso',
    name: 'Warm Canvas & Espresso',
    tagline: 'Sổ da thủ công & Cà phê ấm cúng thư thái',
    icon: '☕',
    accentColor: '#D97706',
    secondaryColor: '#EA580C',
    cardGlow: 'rgba(217, 119, 6, 0.25)',
  },
  {
    id: 'classic',
    name: 'Classic Slate & Blue',
    tagline: 'Giao diện truyền thống nguyên bản',
    icon: '🔷',
    accentColor: '#4F46E5',
    secondaryColor: '#0284C7',
    cardGlow: 'rgba(79, 70, 229, 0.25)',
  },
];

export const STORAGE_KEY_PALETTE = 'heomeo_theme_palette_v1';
export const STORAGE_KEY_THEME = 'heomeo_theme_mode_v1';

// Initial state resolution from localStorage
let currentPalette: ThemePalette = 'obsidian';
try {
  const savedPalette = localStorage.getItem(STORAGE_KEY_PALETTE);
  if (savedPalette && AVAILABLE_PALETTES.some((p) => p.id === savedPalette)) {
    currentPalette = savedPalette as ThemePalette;
  }
} catch {
  currentPalette = 'obsidian';
}

let currentMode: ThemeMode = 'dark';
try {
  const savedMode = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedMode === 'dark' || savedMode === 'light') {
    currentMode = savedMode;
  } else {
    // Default to dark mode for new users to experience the Obsidian palette
    currentMode = 'dark';
  }
} catch {
  currentMode = 'dark';
}

// Apply class and data-theme to HTML tag immediately
export function applyThemeToDom(palette: ThemePalette, mode: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', palette);
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
applyThemeToDom(currentPalette, currentMode);

const paletteListeners = new Set<(palette: ThemePalette) => void>();
const modeListeners = new Set<(mode: ThemeMode) => void>();

export function getThemePalette(): ThemePalette {
  return currentPalette;
}

export function setThemePalette(palette: ThemePalette) {
  currentPalette = palette;
  applyThemeToDom(currentPalette, currentMode);
  try {
    localStorage.setItem(STORAGE_KEY_PALETTE, palette);
  } catch {
    // ignore
  }
  paletteListeners.forEach((fn) => fn(palette));
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode) {
  currentMode = mode;
  applyThemeToDom(currentPalette, currentMode);
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
 * Full Theme System hook supporting both palette and light/dark modes
 */
export function useThemeSystem() {
  const [palette, setPaletteState] = useState<ThemePalette>(currentPalette);
  const [mode, setModeState] = useState<ThemeMode>(currentMode);

  useEffect(() => {
    const pHandler = (newPalette: ThemePalette) => setPaletteState(newPalette);
    const mHandler = (newMode: ThemeMode) => setModeState(newMode);

    paletteListeners.add(pHandler);
    modeListeners.add(mHandler);

    return () => {
      paletteListeners.delete(pHandler);
      modeListeners.delete(mHandler);
    };
  }, []);

  const activeThemeConfig =
    AVAILABLE_PALETTES.find((p) => p.id === palette) || AVAILABLE_PALETTES[0];

  return {
    palette,
    setPalette: setThemePalette,
    mode,
    isDark: mode === 'dark',
    toggleMode: toggleThemeMode,
    setMode: setThemeMode,
    activeThemeConfig,
    availablePalettes: AVAILABLE_PALETTES,
  };
}

/**
 * Backward compatibility hook for useThemeMode
 */
export function useThemeMode() {
  const { mode, isDark, toggleMode, setMode } = useThemeSystem();
  return {
    theme: mode,
    isDark,
    toggleTheme: toggleMode,
    setTheme: setMode,
  };
}

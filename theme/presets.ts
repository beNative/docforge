import type { ThemePaletteOverride, ThemePreset, ThemeModeSetting } from '../types';

export const DEFAULT_THEME_MODE: ThemeModeSetting = 'system';
export const DEFAULT_THEME_PRESET: ThemePreset = 'default';
export const DEFAULT_THEME_TEXT_CONTRAST = 1;
export const DEFAULT_THEME_SURFACE_TONE = 0.2;
export const DEFAULT_THEME_ACCENT_SATURATION = 1;
export const DEFAULT_THEME_USE_CUSTOM_COLORS = false;

export const DEFAULT_LIGHT_THEME: ThemePaletteOverride = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#171717',
  mutedText: '#525252',
  border: '#e5e7eb',
  accent: '#6366f1',
};

export const DEFAULT_DARK_THEME: ThemePaletteOverride = {
  background: '#171717',
  surface: '#262626',
  text: '#f5f5f5',
  mutedText: '#a3a3a3',
  border: '#404040',
  accent: '#818cf8',
};

const HIGH_CONTRAST_LIGHT: ThemePaletteOverride = {
  background: '#ffffff',
  surface: '#f4f4f5',
  text: '#050505',
  mutedText: '#1f2937',
  border: '#d4d4d8',
  accent: '#2563eb',
};

const HIGH_CONTRAST_DARK: ThemePaletteOverride = {
  background: '#050505',
  surface: '#111827',
  text: '#f9fafb',
  mutedText: '#cbd5f5',
  border: '#334155',
  accent: '#3b82f6',
};

const CALM_LIGHT: ThemePaletteOverride = {
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  mutedText: '#475569',
  border: '#cbd5f5',
  accent: '#14b8a6',
};

const CALM_DARK: ThemePaletteOverride = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#e2e8f0',
  mutedText: '#94a3b8',
  border: '#334155',
  accent: '#22d3ee',
};

export const THEME_PRESET_DEFINITIONS: Record<ThemePreset, {
  label: string;
  description: string;
  light: ThemePaletteOverride;
  dark: ThemePaletteOverride;
  recommended?: {
    textContrast?: number;
    surfaceTone?: number;
    accentSaturation?: number;
  };
}> = {
  'default': {
    label: 'Balanced',
    description: 'Original DocForge palette with even contrast for everyday use.',
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
    recommended: {
      textContrast: DEFAULT_THEME_TEXT_CONTRAST,
      surfaceTone: DEFAULT_THEME_SURFACE_TONE,
      accentSaturation: DEFAULT_THEME_ACCENT_SATURATION,
    },
  },
  'high-contrast': {
    label: 'High Contrast',
    description: 'Bold text and surfaces for low-vision accessibility.',
    light: HIGH_CONTRAST_LIGHT,
    dark: HIGH_CONTRAST_DARK,
    recommended: {
      textContrast: 1.25,
      surfaceTone: 0.25,
      accentSaturation: 1.1,
    },
  },
  'calm': {
    label: 'Calm',
    description: 'Cooler tones with softer surfaces for long sessions.',
    light: CALM_LIGHT,
    dark: CALM_DARK,
    recommended: {
      textContrast: 0.9,
      surfaceTone: 0.15,
      accentSaturation: 0.9,
    },
  },
};

import type { Settings, ThemePaletteOverride, ThemePreset } from '../types';
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_THEME_ACCENT_SATURATION,
  DEFAULT_THEME_SURFACE_TONE,
  DEFAULT_THEME_TEXT_CONTRAST,
  DEFAULT_THEME_USE_CUSTOM_COLORS,
  THEME_PRESET_DEFINITIONS,
} from '../theme/presets';

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const expandHex = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 4 && normalized.startsWith('#')) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
};

const normalizeHex = (value: string | undefined, fallback: string): string => {
  if (value && HEX_REGEX.test(value.trim())) {
    return expandHex(value.trim());
  }
  return fallback;
};

const componentSafe = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return value;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const expanded = expandHex(hex);
  const value = expanded.replace('#', '');
  const bigint = parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (component: number) => component.toString(16).padStart(2, '0');
  return `#${toHex(clamp(Math.round(componentSafe(r)), 0, 255))}${toHex(clamp(Math.round(componentSafe(g)), 0, 255))}${toHex(clamp(Math.round(componentSafe(b)), 0, 255))}`;
};

const toRgbString = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
};

const mixColors = (a: string, b: string, amount: number): string => {
  const ratio = clamp(amount, 0, 1);
  const colorA = hexToRgb(a);
  const colorB = hexToRgb(b);
  const mix = (channel: 'r' | 'g' | 'b') => componentSafe(colorA[channel] + (colorB[channel] - colorA[channel]) * ratio);
  return rgbToHex(mix('r'), mix('g'), mix('b'));
};

const adjustSaturation = (hex: string, factor: number): string => {
  const rgb = hexToRgb(hex);
  const average = (rgb.r + rgb.g + rgb.b) / 3;
  const scale = clamp(factor, 0, 2);
  const adjust = (channel: number) => componentSafe(average + (channel - average) * scale);
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
};

const adjustLightness = (hex: string, amount: number): string => {
  return mixColors(hex, amount >= 0 ? '#ffffff' : '#000000', Math.min(Math.abs(amount), 1));
};

const srgbToLinear = (value: number): number => {
  const channel = value / 255;
  if (channel <= 0.03928) {
    return channel / 12.92;
  }
  return Math.pow((channel + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrastRatio = (a: string, b: string): number => {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const bright = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return (bright + 0.05) / (dark + 0.05);
};

const ensureAccentContrast = (accent: string): { accent: string; text: string } => {
  const candidates = ['#ffffff', '#000000'];
  let bestText = candidates[0];
  let bestRatio = contrastRatio(accent, bestText);
  for (const candidate of candidates.slice(1)) {
    const ratio = contrastRatio(accent, candidate);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestText = candidate;
    }
  }

  let adjustedAccent = accent;
  if (bestRatio < 4.5) {
    const direction = bestText === '#ffffff' ? '#000000' : '#ffffff';
    for (let i = 0; i < 8 && bestRatio < 4.5; i += 1) {
      adjustedAccent = mixColors(adjustedAccent, direction, 0.08);
      bestRatio = contrastRatio(adjustedAccent, bestText);
    }
  }

  return { accent: adjustedAccent, text: bestText };
};

const sanitizePalette = (source: ThemePaletteOverride, fallback: ThemePaletteOverride): ThemePaletteOverride => {
  return {
    background: normalizeHex(source.background, fallback.background),
    surface: normalizeHex(source.surface, fallback.surface),
    text: normalizeHex(source.text, fallback.text),
    mutedText: normalizeHex(source.mutedText, fallback.mutedText),
    border: normalizeHex(source.border, fallback.border),
    accent: normalizeHex(source.accent, fallback.accent),
  };
};

const buildSelectArrowDataUri = (color: string): string => {
  const sanitized = expandHex(color).replace('#', '').toLowerCase();
  return `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23${sanitized}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
};

export interface ThemePreferences {
  preset: ThemePreset;
  useCustomColors: boolean;
  textContrast: number;
  surfaceTone: number;
  accentSaturation: number;
  light: ThemePaletteOverride;
  dark: ThemePaletteOverride;
}

const clonePalette = (palette: ThemePaletteOverride): ThemePaletteOverride => ({
  background: palette.background,
  surface: palette.surface,
  text: palette.text,
  mutedText: palette.mutedText,
  border: palette.border,
  accent: palette.accent,
});

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  preset: 'default',
  useCustomColors: DEFAULT_THEME_USE_CUSTOM_COLORS,
  textContrast: DEFAULT_THEME_TEXT_CONTRAST,
  surfaceTone: DEFAULT_THEME_SURFACE_TONE,
  accentSaturation: DEFAULT_THEME_ACCENT_SATURATION,
  light: clonePalette(DEFAULT_LIGHT_THEME),
  dark: clonePalette(DEFAULT_DARK_THEME),
};

export const preferencesFromSettings = (settings: Settings): ThemePreferences => ({
  preset: settings.themePreset ?? 'default',
  useCustomColors: settings.themeUseCustomColors ?? DEFAULT_THEME_USE_CUSTOM_COLORS,
  textContrast: settings.themeTextContrast ?? DEFAULT_THEME_TEXT_CONTRAST,
  surfaceTone: settings.themeSurfaceTone ?? DEFAULT_THEME_SURFACE_TONE,
  accentSaturation: settings.themeAccentSaturation ?? DEFAULT_THEME_ACCENT_SATURATION,
  light: clonePalette(settings.themeCustomLight ?? DEFAULT_LIGHT_THEME),
  dark: clonePalette(settings.themeCustomDark ?? DEFAULT_DARK_THEME),
});

const STATUS_LIGHT = {
  success: '#22c55e',
  warning: '#f97316',
  error: '#ef4444',
  info: '#3b82f6',
  debug: '#16a34a',
  destructiveText: '#b91c1c',
  destructiveBg: '#fee2e2',
  destructiveBgHover: '#fecaca',
  destructiveBorder: '#fca5a5',
};

const STATUS_DARK = {
  success: '#34d399',
  warning: '#fb923c',
  error: '#f87171',
  info: '#60a5fa',
  debug: '#22c55e',
  destructiveText: '#fca5a5',
  destructiveBg: '127 29 29 / 0.5',
  destructiveBgHover: '127 29 29 / 0.8',
  destructiveBorder: '#991b1b',
};

export const buildThemeVariables = (mode: 'light' | 'dark', preferences: ThemePreferences): Record<string, string> => {
  const preset = THEME_PRESET_DEFINITIONS[preferences.preset] ?? THEME_PRESET_DEFINITIONS['default'];
  const fallbackPalette = mode === 'light' ? preset.light : preset.dark;
  const basePalette = sanitizePalette(preferences.useCustomColors ? (mode === 'light' ? preferences.light : preferences.dark) : fallbackPalette, fallbackPalette);

  const accentSaturation = clamp(preferences.accentSaturation, 0.4, 1.6);
  const contrastValue = clamp(preferences.textContrast, 0.6, 1.4);
  const surfaceTone = clamp(preferences.surfaceTone, 0, 0.6);

  const accentSaturated = adjustSaturation(basePalette.accent, accentSaturation);
  const accentWithContrast = ensureAccentContrast(accentSaturated);
  const accentHover = mode === 'light' ? adjustLightness(accentWithContrast.accent, -0.12) : adjustLightness(accentWithContrast.accent, 0.18);

  const background = basePalette.background;
  const surfaceBase = basePalette.surface || mixColors(background, accentWithContrast.accent, mode === 'light' ? 0.05 : 0.1);
  const secondary = mixColors(surfaceBase, accentWithContrast.accent, surfaceTone * (mode === 'light' ? 0.35 : 0.25));

  const textMain = basePalette.text;
  const mutedSeed = basePalette.mutedText || mixColors(textMain, background, mode === 'light' ? 0.5 : 0.65);
  const mixAmount = clamp(0.58 - (contrastValue - 1) * 0.32, 0.15, 0.75);
  const textSecondary = mixColors(mutedSeed, background, clamp(contrastValue < 1 ? mixAmount + 0.1 : mixAmount - 0.1, 0.1, 0.85));

  const borderBase = basePalette.border || mixColors(background, textMain, mode === 'light' ? 0.12 : 0.18);
  const border = mixColors(borderBase, textMain, contrastValue > 1 ? 0.18 : 0.08);

  const tooltipBackground = mode === 'light' ? mixColors(textMain, '#000000', 0.05) : mixColors(background, '#000000', 0.7);
  const tooltipText = contrastRatio(tooltipBackground, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';

  const treeSelected = mixColors(background, accentWithContrast.accent, mode === 'light' ? 0.18 : 0.22);

  const statusSet = mode === 'light' ? STATUS_LIGHT : STATUS_DARK;

  const destructBg = statusSet.destructiveBg.startsWith('#')
    ? toRgbString(statusSet.destructiveBg)
    : statusSet.destructiveBg;
  const destructBgHover = statusSet.destructiveBgHover.startsWith('#')
    ? toRgbString(statusSet.destructiveBgHover)
    : statusSet.destructiveBgHover;

  return {
    'color-background': toRgbString(background),
    'color-secondary': toRgbString(secondary),
    'color-text-main': toRgbString(textMain),
    'color-text-secondary': toRgbString(textSecondary),
    'color-border': toRgbString(border),
    'color-accent': toRgbString(accentWithContrast.accent),
    'color-accent-hover': toRgbString(accentHover),
    'color-accent-text': toRgbString(accentWithContrast.text),
    'color-success': toRgbString(statusSet.success),
    'color-warning': toRgbString(statusSet.warning),
    'color-error': toRgbString(statusSet.error),
    'color-info': toRgbString(statusSet.info),
    'color-debug': toRgbString(statusSet.debug),
    'color-destructive-text': toRgbString(statusSet.destructiveText),
    'color-destructive-bg': destructBg,
    'color-destructive-bg-hover': destructBgHover,
    'color-destructive-border': toRgbString(statusSet.destructiveBorder),
    'color-modal-backdrop': mode === 'light' ? '0 0 0 / 0.45' : '0 0 0 / 0.7',
    'color-tooltip-bg': toRgbString(tooltipBackground),
    'color-tooltip-text': toRgbString(tooltipText),
    'color-tree-selected': toRgbString(treeSelected),
    'select-arrow-background': buildSelectArrowDataUri(textSecondary),
  };
};

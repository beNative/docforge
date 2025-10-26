import { Settings, ThemeColorOverrides, ThemeColorToken, ThemeContrastPreference, ThemeMode, ThemeTone } from '../types';

export type ThemePalette = {
  background: string;
  secondary: string;
  textMain: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentHover: string;
  accentText: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  debug: string;
  destructiveText: string;
  destructiveBg: string;
  destructiveBgHover: string;
  destructiveBorder: string;
  modalBackdrop: string;
  tooltipBg: string;
  tooltipText: string;
  treeSelected: string;
  selectArrowBackground: string;
};

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

const COLOR_TOKEN_MAP: Record<ThemeColorToken, keyof ThemePalette> = {
  background: 'background',
  secondary: 'secondary',
  textMain: 'textMain',
  textSecondary: 'textSecondary',
  accent: 'accent',
  accentText: 'accentText',
  border: 'border',
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const hexToRgba = (value: string): RgbaColor | null => {
  const hex = value.replace('#', '').trim();
  if (!/^([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
    return null;
  }
  const bigint = parseInt(hex.slice(0, 6), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  if (hex.length === 8) {
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return { r, g, b };
};

const rgbFromString = (value: string): RgbaColor | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  let parts: string[];
  let alpha: number | undefined;
  if (rgbMatch) {
    parts = rgbMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 3) {
      return null;
    }
    if (parts.length > 3) {
      alpha = Number.parseFloat(parts[3]);
    }
  } else {
    const [rgbPart, alphaPart] = trimmed.split('/').map((segment) => segment.trim());
    parts = rgbPart.split(/\s+/).filter(Boolean);
    if (parts.length !== 3) {
      return null;
    }
    if (alphaPart) {
      alpha = Number.parseFloat(alphaPart);
    }
  }
  const [r, g, b] = parts.map((part) => Number.parseFloat(part));
  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return null;
  }
  const normalized: RgbaColor = {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
  };
  if (alpha !== undefined && !Number.isNaN(alpha)) {
    normalized.a = clamp(alpha, 0, 1);
  }
  return normalized;
};

const cssColorToRgba = (value: string): RgbaColor | null => {
  if (!value) {
    return null;
  }
  if (value.trim().startsWith('url(')) {
    return null;
  }
  return hexToRgba(value) ?? rgbFromString(value);
};

const rgbaToCss = ({ r, g, b, a }: RgbaColor): string => {
  const red = clamp(Math.round(r), 0, 255);
  const green = clamp(Math.round(g), 0, 255);
  const blue = clamp(Math.round(b), 0, 255);
  if (a === undefined || Number.isNaN(a) || a >= 1) {
    return `${red} ${green} ${blue}`;
  }
  const alpha = Math.round(clamp(a, 0, 1) * 1000) / 1000;
  return `${red} ${green} ${blue} / ${alpha}`;
};

const componentToHex = (value: number): string => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');

const rgbaToHex = ({ r, g, b, a }: RgbaColor): string => {
  const alpha = a === undefined ? 1 : clamp(a, 0, 1);
  const alphaComponent = componentToHex(alpha * 255);
  const base = `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
  return alpha < 1 ? `${base}${alphaComponent}`.toUpperCase() : base.toUpperCase();
};

const mixColors = (first: RgbaColor, second: RgbaColor, amount: number): RgbaColor => {
  const clampedAmount = clamp(amount, 0, 1);
  const firstAlpha = first.a ?? 1;
  const secondAlpha = second.a ?? 1;
  return {
    r: first.r + (second.r - first.r) * clampedAmount,
    g: first.g + (second.g - first.g) * clampedAmount,
    b: first.b + (second.b - first.b) * clampedAmount,
    a: firstAlpha + (secondAlpha - firstAlpha) * clampedAmount,
  };
};

const rgbToHsl = ({ r, g, b }: RgbaColor): { h: number; s: number; l: number } => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      default:
        h = (rNorm - gNorm) / delta + 4;
    }
    h /= 6;
  }
  return { h, s, l };
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let temp = t;
  if (temp < 0) temp += 1;
  if (temp > 1) temp -= 1;
  if (temp < 1 / 6) return p + (q - p) * 6 * temp;
  if (temp < 1 / 2) return q;
  if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
  return p;
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }, alpha?: number): RgbaColor => {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: alpha,
  };
};

const adjustLightness = (value: string, delta: number): string => {
  const color = cssColorToRgba(value);
  if (!color) {
    return value;
  }
  const { h, s, l } = rgbToHsl(color);
  const adjusted = hslToRgb({ h, s, l: clamp(l + delta, 0, 1) }, color.a);
  return rgbaToCss(adjusted);
};

const relativeLuminance = ({ r, g, b }: RgbaColor): number => {
  const transform = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  const rLum = transform(r);
  const gLum = transform(g);
  const bLum = transform(b);
  return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
};

const contrastRatio = (first: RgbaColor, second: RgbaColor): number => {
  const lum1 = relativeLuminance(first);
  const lum2 = relativeLuminance(second);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
};

const ensureContrast = (value: string, background: string, minimum: number): string => {
  const foregroundColor = cssColorToRgba(value);
  const backgroundColor = cssColorToRgba(background);
  if (!foregroundColor || !backgroundColor) {
    return value;
  }
  let bestColor = foregroundColor;
  let bestRatio = contrastRatio(foregroundColor, backgroundColor);
  if (bestRatio >= minimum) {
    return rgbaToCss(foregroundColor);
  }
  const extremes: RgbaColor[] = [
    { r: 255, g: 255, b: 255, a: foregroundColor.a ?? 1 },
    { r: 0, g: 0, b: 0, a: foregroundColor.a ?? 1 },
  ];
  for (const extreme of extremes) {
    for (let step = 1; step <= 12; step += 1) {
      const amount = step / 12;
      const candidate = mixColors(foregroundColor, extreme, amount);
      const ratio = contrastRatio(candidate, backgroundColor);
      if (ratio > bestRatio) {
        bestColor = candidate;
        bestRatio = ratio;
      }
      if (ratio >= minimum) {
        return rgbaToCss(candidate);
      }
    }
  }
  return rgbaToCss(bestColor);
};

const DEFAULT_LIGHT_SELECT_ARROW = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23525252' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
const DEFAULT_DARK_SELECT_ARROW = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a3a3a3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

const buildSelectArrow = (color: string, fallback: string): string => {
  const parsed = cssColorToRgba(color);
  if (!parsed) {
    return fallback;
  }
  const hex = rgbaToHex({ ...parsed, a: 1 });
  const encoded = hex.replace('#', '%23');
  return `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='${encoded}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
};

const BASE_PALETTES: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '245 245 245',
    secondary: '255 255 255',
    textMain: '23 23 23',
    textSecondary: '82 82 82',
    border: '229 231 235',
    accent: '99 102 241',
    accentHover: '80 70 229',
    accentText: '255 255 255',
    success: '34 197 94',
    warning: '249 115 22',
    error: '239 68 68',
    info: '59 130 246',
    debug: '22 163 74',
    destructiveText: '185 28 28',
    destructiveBg: '254 226 226',
    destructiveBgHover: '254 202 202',
    destructiveBorder: '252 165 165',
    modalBackdrop: '0 0 0 / 0.5',
    tooltipBg: '23 23 23',
    tooltipText: '245 245 245',
    treeSelected: '212 212 212',
    selectArrowBackground: DEFAULT_LIGHT_SELECT_ARROW,
  },
  dark: {
    background: '23 23 23',
    secondary: '38 38 38',
    textMain: '245 245 245',
    textSecondary: '163 163 163',
    border: '64 64 64',
    accent: '129 140 248',
    accentHover: '99 102 241',
    accentText: '23 23 23',
    success: '34 197 94',
    warning: '249 115 22',
    error: '239 68 68',
    info: '59 130 246',
    debug: '22 163 74',
    destructiveText: '252 165 165',
    destructiveBg: '127 29 29 / 0.5',
    destructiveBgHover: '127 29 29 / 0.8',
    destructiveBorder: '153 27 27',
    modalBackdrop: '0 0 0 / 0.7',
    tooltipBg: '245 245 245',
    tooltipText: '23 23 23',
    treeSelected: '56 56 56',
    selectArrowBackground: DEFAULT_DARK_SELECT_ARROW,
  },
};

const TONE_OVERRIDES: Record<ThemeMode, Record<ThemeTone, Partial<ThemePalette>>> = {
  light: {
    neutral: {},
    warm: {
      background: '253 246 239',
      secondary: '255 240 228',
      textMain: '49 27 11',
      textSecondary: '139 94 52',
      border: '242 209 179',
      accent: '249 115 22',
      accentText: '255 255 255',
    },
    cool: {
      background: '241 245 255',
      secondary: '226 235 255',
      textMain: '15 23 42',
      textSecondary: '71 85 105',
      border: '199 210 254',
      accent: '37 99 235',
      accentText: '248 250 252',
    },
  },
  dark: {
    neutral: {},
    warm: {
      background: '31 22 18',
      secondary: '43 31 25',
      textMain: '245 224 214',
      textSecondary: '215 180 158',
      border: '91 54 42',
      accent: '244 162 97',
      accentText: '36 21 15',
    },
    cool: {
      background: '16 24 39',
      secondary: '24 34 53',
      textMain: '226 232 240',
      textSecondary: '148 163 184',
      border: '39 54 74',
      accent: '96 165 250',
      accentText: '11 17 32',
    },
  },
};

const applyOverrides = (palette: ThemePalette, overrides?: Partial<ThemePalette>): ThemePalette => {
  if (!overrides) {
    return palette;
  }
  const next = { ...palette };
  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      continue;
    }
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const paletteKey = key as keyof ThemePalette;
    if (paletteKey === 'selectArrowBackground') {
      next[paletteKey] = normalized;
    } else {
      const parsed = cssColorToRgba(normalized);
      next[paletteKey] = parsed ? rgbaToCss(parsed) : normalized;
    }
  }
  return next;
};

const applyThemeColorOverrides = (palette: ThemePalette, overrides: ThemeColorOverrides | undefined, theme: ThemeMode): ThemePalette => {
  if (!overrides) {
    return palette;
  }
  const themeOverrides = overrides[theme];
  if (!themeOverrides) {
    return palette;
  }
  const mapped: Partial<ThemePalette> = {};
  for (const [token, value] of Object.entries(themeOverrides)) {
    if (!value) {
      continue;
    }
    const paletteKey = COLOR_TOKEN_MAP[token as ThemeColorToken];
    if (!paletteKey) {
      continue;
    }
    const parsed = cssColorToRgba(value);
    mapped[paletteKey] = parsed ? rgbaToCss(parsed) : value;
  }
  return applyOverrides(palette, mapped);
};

const computeAccentHover = (accent: string, theme: ThemeMode): string => {
  const delta = theme === 'light' ? -0.12 : 0.12;
  return adjustLightness(accent, delta);
};

const computeTreeSelected = (background: string, theme: ThemeMode): string => {
  const delta = theme === 'light' ? -0.08 : 0.12;
  return adjustLightness(background, delta);
};

const applyContrastPreference = (palette: ThemePalette, theme: ThemeMode, preference: ThemeContrastPreference): ThemePalette => {
  const adjusted = { ...palette };
  const background = adjusted.background;
  if (preference === 'max') {
    const backgroundColor = cssColorToRgba(background);
    if (backgroundColor) {
      const white = { r: 255, g: 255, b: 255 };
      const black = { r: 0, g: 0, b: 0 };
      const whiteRatio = contrastRatio(white, backgroundColor);
      const blackRatio = contrastRatio(black, backgroundColor);
      const primary = whiteRatio >= blackRatio ? white : black;
      adjusted.textMain = rgbaToCss(primary);
      const secondaryCandidate = mixColors(primary, backgroundColor, 0.25);
      adjusted.textSecondary = ensureContrast(rgbaToCss(secondaryCandidate), background, 4.5);
    }
    adjusted.accentText = ensureContrast(adjusted.accentText, adjusted.accent, 7);
    return adjusted;
  }
  const minMain = preference === 'high' ? 7 : 4.5;
  const minSecondary = preference === 'high' ? 4.5 : 3.5;
  adjusted.textMain = ensureContrast(adjusted.textMain, background, minMain);
  adjusted.textSecondary = ensureContrast(adjusted.textSecondary, background, minSecondary);
  adjusted.accentText = ensureContrast(adjusted.accentText, adjusted.accent, 4.5);
  return adjusted;
};

export const computeThemePalette = (theme: ThemeMode, settings: Settings): ThemePalette => {
  const tone: ThemeTone = settings.themeTone?.[theme] ?? 'neutral';
  const base = { ...BASE_PALETTES[theme] };
  const toneOverrides = TONE_OVERRIDES[theme][tone];
  const withTone = applyOverrides(base, toneOverrides);
  const withCustom = applyThemeColorOverrides(withTone, settings.themeColorOverrides, theme);
  const paletteWithDerived: ThemePalette = {
    ...withCustom,
    accentHover: computeAccentHover(withCustom.accent, theme),
    treeSelected: computeTreeSelected(withCustom.background, theme),
    selectArrowBackground:
      theme === 'dark'
        ? buildSelectArrow(withCustom.textSecondary, DEFAULT_DARK_SELECT_ARROW)
        : buildSelectArrow(withCustom.textSecondary, DEFAULT_LIGHT_SELECT_ARROW),
  };
  paletteWithDerived.accentText = ensureContrast(paletteWithDerived.accentText, paletteWithDerived.accent, 4.5);
  return applyContrastPreference(paletteWithDerived, theme, settings.themeContrast ?? 'normal');
};

const CSS_VARIABLE_MAP: Record<keyof ThemePalette, string> = {
  background: 'color-background',
  secondary: 'color-secondary',
  textMain: 'color-text-main',
  textSecondary: 'color-text-secondary',
  border: 'color-border',
  accent: 'color-accent',
  accentHover: 'color-accent-hover',
  accentText: 'color-accent-text',
  success: 'color-success',
  warning: 'color-warning',
  error: 'color-error',
  info: 'color-info',
  debug: 'color-debug',
  destructiveText: 'color-destructive-text',
  destructiveBg: 'color-destructive-bg',
  destructiveBgHover: 'color-destructive-bg-hover',
  destructiveBorder: 'color-destructive-border',
  modalBackdrop: 'color-modal-backdrop',
  tooltipBg: 'color-tooltip-bg',
  tooltipText: 'color-tooltip-text',
  treeSelected: 'color-tree-selected',
  selectArrowBackground: 'select-arrow-background',
};

export const computeThemeVariables = (theme: ThemeMode, settings: Settings): Record<string, string> => {
  const palette = computeThemePalette(theme, settings);
  const entries = Object.entries(palette).map(([key, value]) => {
    const variable = CSS_VARIABLE_MAP[key as keyof ThemePalette];
    return [`--${variable}`, value] as const;
  });
  return Object.fromEntries(entries);
};

export const cssColorToHex = (value: string): string | null => {
  const parsed = cssColorToRgba(value);
  if (!parsed) {
    return null;
  }
  return rgbaToHex(parsed);
};

export const THEME_COLOR_TOKENS: ThemeColorToken[] = ['background', 'secondary', 'textMain', 'textSecondary', 'accent', 'accentText', 'border'];

export const THEME_SLOTS = [
  'color-background',
  'color-secondary',
  'color-text-main',
  'color-text-secondary',
  'color-border',
  'color-accent',
  'color-accent-hover',
  'color-accent-text',
  'color-success',
  'color-warning',
  'color-error',
  'color-info',
  'color-debug',
  'color-destructive-text',
  'color-destructive-bg',
  'color-destructive-bg-hover',
  'color-destructive-border',
  'color-modal-backdrop',
  'color-tooltip-bg',
  'color-tooltip-text',
  'color-tree-selected',
  'select-arrow-background',
] as const;

export type ThemeSlot = typeof THEME_SLOTS[number];

export type ThemeDefinition = Record<ThemeSlot, string>;

export type ThemeOverrides = Partial<Record<ThemeSlot, string>>;

export type ThemeId = 'light' | 'dark';

const baseLightTheme: ThemeDefinition = {
  'color-background': '245 245 245',
  'color-secondary': '255 255 255',
  'color-text-main': '23 23 23',
  'color-text-secondary': '82 82 82',
  'color-border': '229 231 235',
  'color-accent': '99 102 241',
  'color-accent-hover': '80 70 229',
  'color-accent-text': '255 255 255',
  'color-success': '34 197 94',
  'color-warning': '249 115 22',
  'color-error': '239 68 68',
  'color-info': '59 130 246',
  'color-debug': '22 163 74',
  'color-destructive-text': '185 28 28',
  'color-destructive-bg': '254 226 226',
  'color-destructive-bg-hover': '254 202 202',
  'color-destructive-border': '252 165 165',
  'color-modal-backdrop': '0 0 0 / 0.5',
  'color-tooltip-bg': '23 23 23',
  'color-tooltip-text': '245 245 245',
  'color-tree-selected': '212 212 212',
  'select-arrow-background':
    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23525252' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
};

export const lightThemeDefinition: ThemeDefinition = Object.freeze({
  ...baseLightTheme,
});

export const darkThemeDefinition: ThemeDefinition = Object.freeze({
  ...baseLightTheme,
  'color-background': '23 23 23',
  'color-secondary': '38 38 38',
  'color-text-main': '245 245 245',
  'color-text-secondary': '163 163 163',
  'color-border': '64 64 64',
  'color-accent': '129 140 248',
  'color-accent-hover': '99 102 241',
  'color-accent-text': '23 23 23',
  'color-destructive-text': '252 165 165',
  'color-destructive-bg': '127 29 29 / 0.5',
  'color-destructive-bg-hover': '127 29 29 / 0.8',
  'color-destructive-border': '153 27 27',
  'color-modal-backdrop': '0 0 0 / 0.7',
  'color-tooltip-bg': '245 245 245',
  'color-tooltip-text': '23 23 23',
  'color-tree-selected': '56 56 56',
  'select-arrow-background':
    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a3a3a3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
});

export const themeDefinitions: Record<ThemeId, ThemeDefinition> = Object.freeze({
  light: lightThemeDefinition,
  dark: darkThemeDefinition,
});

export const applyThemeTokens = (
  definition: ThemeDefinition,
  root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null,
): void => {
  if (!root) {
    return;
  }

  for (const [slot, value] of Object.entries(definition) as [ThemeSlot, string][]) {
    root.style.setProperty(`--${slot}`, value);
  }
};

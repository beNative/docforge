import { ThemeDefinition, ThemeId, applyThemeTokens, themeDefinitions } from '../themes/themeTokens';
import type { ThemePreference } from '../types';

type ThemePreferenceUpdate = Partial<Record<ThemeId, Partial<ThemePreference>>>;

const clampContrastOffset = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-255, Math.min(255, value));
};

const createDefaultPreference = (): ThemePreference => ({
  overrides: {},
  contrastOffset: 0,
});

const clonePreference = (preference: ThemePreference): ThemePreference => ({
  overrides: { ...preference.overrides },
  contrastOffset: preference.contrastOffset,
});

const sanitizePreference = (
  next: Partial<ThemePreference> | undefined,
  current: ThemePreference,
): ThemePreference => {
  if (!next) {
    return clonePreference(current);
  }

  const hasOverrides = Object.prototype.hasOwnProperty.call(next, 'overrides');
  const overrides = hasOverrides ? { ...(next.overrides ?? {}) } : { ...current.overrides };

  const hasContrast = Object.prototype.hasOwnProperty.call(next, 'contrastOffset');
  const contrastOffset = hasContrast ? clampContrastOffset(next.contrastOffset) : current.contrastOffset;

  return {
    overrides,
    contrastOffset,
  };
};

let storedPreferences: Record<ThemeId, ThemePreference> = {
  light: createDefaultPreference(),
  dark: createDefaultPreference(),
};

interface LastApplyState {
  themeId: ThemeId;
  root: HTMLElement | null;
  overrides?: Partial<ThemeDefinition>;
}

let lastApplyState: LastApplyState | null = null;

const RGB_WITH_OPTIONAL_ALPHA = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s*\/\s*(?:0|1|0?\.\d+|\d{1,3}%))?$/;

const applyContrastOffset = (value: string, offset: number): string => {
  if (!offset) {
    return value;
  }

  const match = RGB_WITH_OPTIONAL_ALPHA.exec(value.trim());
  if (!match) {
    return value;
  }

  const [, rawRed, rawGreen, rawBlue, alphaPart = ''] = match;
  const adjustComponent = (component: string) => {
    const numeric = Number(component);
    if (Number.isNaN(numeric)) {
      return component;
    }
    const adjusted = Math.max(0, Math.min(255, numeric + offset));
    return String(Math.round(adjusted));
  };

  const red = adjustComponent(rawRed);
  const green = adjustComponent(rawGreen);
  const blue = adjustComponent(rawBlue);

  return `${red} ${green} ${blue}${alphaPart}`;
};

const applyContrastToDefinition = (definition: ThemeDefinition, offset: number): ThemeDefinition => {
  if (!offset) {
    return { ...definition };
  }

  const adjustedEntries = Object.entries(definition).map(([slot, value]) => [
    slot,
    applyContrastOffset(value as string, offset),
  ]);

  return Object.fromEntries(adjustedEntries) as ThemeDefinition;
};

export const configureThemePreferences = (preferences: ThemePreferenceUpdate = {}): void => {
  storedPreferences = {
    light: sanitizePreference(preferences.light, storedPreferences.light),
    dark: sanitizePreference(preferences.dark, storedPreferences.dark),
  };

  if (lastApplyState) {
    applyTheme(lastApplyState.themeId, {
      root: lastApplyState.root,
      overrides: lastApplyState.overrides,
    });
  }
};

export interface ApplyThemeOptions {
  overrides?: Partial<ThemeDefinition>;
  root?: HTMLElement | null;
}

export const applyTheme = (
  themeId: ThemeId,
  options: ApplyThemeOptions = {},
): ThemeDefinition => {
  const {
    overrides: runtimeOverrides,
    root = typeof document !== 'undefined' ? document.documentElement : null,
  } = options;

  const preference = storedPreferences[themeId] ?? createDefaultPreference();
  const baseDefinition = themeDefinitions[themeId];
  const baseWithContrast = applyContrastToDefinition(baseDefinition, preference.contrastOffset);
  const mergedDefinition = {
    ...baseWithContrast,
    ...preference.overrides,
    ...(runtimeOverrides ?? {}),
  } as ThemeDefinition;

  applyThemeTokens(mergedDefinition, root);

  if (root) {
    root.classList.toggle('dark', themeId === 'dark');
  }

  lastApplyState = {
    themeId,
    root,
    overrides:
      runtimeOverrides && Object.keys(runtimeOverrides).length > 0
        ? { ...runtimeOverrides }
        : undefined,
  };

  return mergedDefinition;
};

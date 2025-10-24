import { ThemeDefinition, ThemeId, applyThemeTokens, themeDefinitions } from '../themes/themeTokens';

export interface ApplyThemeOptions {
  overrides?: Partial<ThemeDefinition>;
  root?: HTMLElement | null;
}

export const applyTheme = (
  themeId: ThemeId,
  options: ApplyThemeOptions = {},
): ThemeDefinition => {
  const { overrides, root = typeof document !== 'undefined' ? document.documentElement : null } = options;
  const baseDefinition = themeDefinitions[themeId];
  const mergedDefinition = {
    ...baseDefinition,
    ...overrides,
  } as ThemeDefinition;

  applyThemeTokens(mergedDefinition, root);

  if (root) {
    root.classList.toggle('dark', themeId === 'dark');
  }

  return mergedDefinition;
};

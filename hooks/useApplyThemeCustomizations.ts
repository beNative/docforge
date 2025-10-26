import { useEffect } from 'react';
import type { Settings, ThemeMode } from '../types';
import { computeThemeVariables } from '../services/themeCustomization';

export const useApplyThemeCustomizations = (theme: ThemeMode, settings: Settings, isReady: boolean) => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const root = document.documentElement;
    const variables = computeThemeVariables(theme, settings);
    Object.entries(variables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  }, [theme, settings, isReady]);
};

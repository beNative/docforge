import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLogger } from '../hooks/useLogger';
import type { ThemeModeSetting } from '../types';
import {
  DEFAULT_THEME_MODE,
  THEME_PRESET_DEFINITIONS,
} from '../theme/presets';
import {
  DEFAULT_THEME_PREFERENCES,
  ThemePreferences,
  buildThemeVariables,
} from '../services/themeEngine';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeModeSetting;
  preferences: ThemePreferences;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeModeSetting) => void;
  setThemePreferences: (preferences: ThemePreferences) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isValidMode = (value: string | null): value is ThemeModeSetting => {
  return value === 'system' || value === 'light' || value === 'dark';
};

const resolveInitialMode = (): ThemeModeSetting => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }
  const storedMode = localStorage.getItem('themeMode');
  if (isValidMode(storedMode)) {
    return storedMode;
  }
  const legacy = localStorage.getItem('theme');
  if (legacy === 'light' || legacy === 'dark') {
    return legacy;
  }
  return DEFAULT_THEME_MODE;
};

const systemTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const normalizePreferences = (preferences: ThemePreferences): ThemePreferences => {
  const preset = THEME_PRESET_DEFINITIONS[preferences.preset] ? preferences.preset : 'default';
  const fallbackLight = DEFAULT_THEME_PREFERENCES.light;
  const fallbackDark = DEFAULT_THEME_PREFERENCES.dark;
  const nextLight = preferences.light || fallbackLight;
  const nextDark = preferences.dark || fallbackDark;
  return {
    preset,
    useCustomColors: Boolean(preferences.useCustomColors),
    textContrast: Number.isFinite(preferences.textContrast) ? preferences.textContrast : DEFAULT_THEME_PREFERENCES.textContrast,
    surfaceTone: Number.isFinite(preferences.surfaceTone) ? preferences.surfaceTone : DEFAULT_THEME_PREFERENCES.surfaceTone,
    accentSaturation: Number.isFinite(preferences.accentSaturation) ? preferences.accentSaturation : DEFAULT_THEME_PREFERENCES.accentSaturation,
    light: {
      background: nextLight.background ?? fallbackLight.background,
      surface: nextLight.surface ?? fallbackLight.surface,
      text: nextLight.text ?? fallbackLight.text,
      mutedText: nextLight.mutedText ?? fallbackLight.mutedText,
      border: nextLight.border ?? fallbackLight.border,
      accent: nextLight.accent ?? fallbackLight.accent,
    },
    dark: {
      background: nextDark.background ?? fallbackDark.background,
      surface: nextDark.surface ?? fallbackDark.surface,
      text: nextDark.text ?? fallbackDark.text,
      mutedText: nextDark.mutedText ?? fallbackDark.mutedText,
      border: nextDark.border ?? fallbackDark.border,
      accent: nextDark.accent ?? fallbackDark.accent,
    },
  };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialMode = resolveInitialMode();
  const [themeMode, setThemeModeState] = useState<ThemeModeSetting>(initialMode);
  const [theme, setTheme] = useState<Theme>(initialMode === 'system' ? systemTheme() : initialMode);
  const [preferences, setPreferences] = useState<ThemePreferences>(DEFAULT_THEME_PREFERENCES);
  const { addLog } = useLogger();
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  const applyThemeVariables = useCallback((activeTheme: Theme, prefs: ThemePreferences) => {
    const resolved = buildThemeVariables(activeTheme, prefs);
    const root = document.documentElement;
    Object.entries(resolved).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryRef.current = media;
    const handleChange = (event: MediaQueryListEvent) => {
      if (themeMode === 'system') {
        const nextTheme = event.matches ? 'dark' : 'light';
        setTheme(nextTheme);
        applyThemeVariables(nextTheme, preferences);
        addLog('DEBUG', `System theme changed. Applying "${nextTheme}".`);
      }
    };
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [themeMode, applyThemeVariables, preferences, addLog]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('themeMode', themeMode);
    applyThemeVariables(theme, preferences);
    addLog('DEBUG', `Applied theme "${theme}" (mode: "${themeMode}") to document.`);
  }, [theme, themeMode, preferences, addLog, applyThemeVariables]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === 'light' ? 'dark' : 'light';
      setThemeModeState(nextTheme);
      addLog('INFO', `User toggled theme to "${nextTheme}".`);
      return nextTheme;
    });
  }, [addLog]);

  const handleSetThemeMode = useCallback((mode: ThemeModeSetting) => {
    setThemeModeState((prevMode) => {
      if (prevMode === mode) {
        return prevMode;
      }
      const resolvedTheme = mode === 'system' ? systemTheme() : mode;
      setTheme(resolvedTheme);
      addLog('INFO', `Theme mode changed to "${mode}".`);
      return mode;
    });
  }, [addLog]);

  const handleSetPreferences = useCallback((nextPreferences: ThemePreferences) => {
    setPreferences((prev) => {
      const normalized = normalizePreferences(nextPreferences);
      if (JSON.stringify(prev) === JSON.stringify(normalized)) {
        return prev;
      }
      addLog('DEBUG', 'Updated theme customization preferences.');
      return normalized;
    });
  }, [addLog]);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      preferences,
      toggleTheme,
      setThemeMode: handleSetThemeMode,
      setThemePreferences: handleSetPreferences,
    }),
    [theme, themeMode, preferences, toggleTheme, handleSetThemeMode, handleSetPreferences],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

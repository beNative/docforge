import React, {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLogger } from '../hooks/useLogger';
import { ThemeId } from '../themes/themeTokens';
import { applyTheme } from '../services/themeService';

type ThemeSource = 'storage' | 'system' | 'default';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  toggleTheme: () => void;
}

const resolveInitialTheme = (): { theme: ThemeId; source: ThemeSource } => {
  if (typeof window === 'undefined') {
    return { theme: 'light', source: 'default' };
  }

  const savedTheme = window.localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return { theme: savedTheme, source: 'storage' };
  }

  const prefersDark = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  if (prefersDark) {
    return { theme: 'dark', source: 'system' };
  }

  return { theme: 'light', source: 'default' };
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialThemeRef = useRef<{ theme: ThemeId; source: ThemeSource } | null>(null);
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const resolved = resolveInitialTheme();
    initialThemeRef.current = resolved;
    return resolved.theme;
  });
  const { addLog } = useLogger();

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (initialThemeRef.current) {
      const { theme: initialTheme, source } = initialThemeRef.current;
      if (source === 'storage') {
        addLog('DEBUG', `Theme loaded from localStorage: "${initialTheme}"`);
      } else if (source === 'system') {
        addLog('DEBUG', 'System preference for dark theme detected.');
      } else {
        addLog('DEBUG', 'Defaulting to light theme.');
      }
      initialThemeRef.current = null;
    }
  }, [addLog]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
    addLog('DEBUG', `Applied theme "${theme}" to document.`);
  }, [theme, addLog]);

  const setTheme = useCallback(
    (nextTheme: ThemeId) => {
      setThemeState((prevTheme) => {
        if (prevTheme === nextTheme) {
          addLog('DEBUG', `Theme "${nextTheme}" already applied.`);
          return prevTheme;
        }

        addLog('INFO', `Theme set to "${nextTheme}".`);
        return nextTheme;
      });
    },
    [addLog],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) => {
      const newTheme: ThemeId = prevTheme === 'light' ? 'dark' : 'light';
      addLog('INFO', `User toggled theme to "${newTheme}".`);
      return newTheme;
    });
  }, [addLog]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

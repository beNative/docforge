import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLogger } from '../hooks/useLogger';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light'); // Default to light, will be updated by effect
  const { addLog } = useLogger();

  // Effect to set initial theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let initialTheme: Theme = 'light';

    if (savedTheme) {
      initialTheme = savedTheme;
      addLog('DEBUG', `Theme loaded from localStorage: "${savedTheme}"`);
    } else if (prefersDark) {
      initialTheme = 'dark';
      addLog('DEBUG', 'System preference for dark theme detected.');
    } else {
      addLog('DEBUG', 'Defaulting to light theme.');
    }
    setTheme(initialTheme);
  }, [addLog]);

  // Effect to apply theme class to the document and save to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    addLog('DEBUG', `Applied theme "${theme}" to document.`);
  }, [theme, addLog]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      addLog('INFO', `User toggled theme to "${newTheme}".`);
      return newTheme;
    });
  }, [addLog]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

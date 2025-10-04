import React, { createContext, useContext } from 'react';
import type { Settings } from '../types';

type SettingsContextValue = {
  settings: Settings;
  saveSettings: (settings: Settings) => Promise<void>;
  loaded: boolean;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<React.PropsWithChildren<SettingsContextValue>> = ({
  settings,
  saveSettings,
  loaded,
  children,
}) => {
  return (
    <SettingsContext.Provider value={{ settings, saveSettings, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};

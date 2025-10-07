import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';
import { llmDiscoveryService } from '../services/llmDiscoveryService';
import { useWorkspaceEvents } from './useWorkspaceEvents';

// Fix: Use optional chaining which is now type-safe with the global declaration.
const isElectron = window.electronAPI;

export const useSettings = () => {
  const { addLog } = useLogger();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const loadAndEnhanceSettings = useCallback(async () => {
    let loadedSettingsFromDB = await repository.getAllSettings();

    // If no settings in DB, this is a true first run.
    if (Object.keys(loadedSettingsFromDB).length === 0) {
      await repository.saveAllSettings(DEFAULT_SETTINGS);
      loadedSettingsFromDB = DEFAULT_SETTINGS;
      addLog('INFO', 'Initialized default settings in the database.');
    }

    // Merge with defaults to ensure all properties exist for existing users after an update.
    const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedSettingsFromDB };

    // If provider name is missing but URL is present, try to discover it.
    if (mergedSettings.llmProviderUrl && !mergedSettings.llmProviderName) {
        addLog('DEBUG', 'LLM provider name is missing, attempting to discover it.');
        try {
            const services = await llmDiscoveryService.discoverServices();
            const matchingService = services.find(s => s.generateUrl === mergedSettings.llmProviderUrl);
            if (matchingService) {
                mergedSettings.llmProviderName = matchingService.name;
                mergedSettings.apiType = matchingService.apiType;
                addLog('INFO', `Discovered and set provider name to: "${matchingService.name}"`);
                // Save the enhanced settings back
                await repository.saveAllSettings(mergedSettings);
            } else {
                addLog('WARNING', `Could not find a matching running service for the saved URL: ${mergedSettings.llmProviderUrl}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog('ERROR', `Error during settings enhancement discovery: ${message}`);
        }
    }

    setSettings(mergedSettings);
    setLoaded(true);
    addLog('DEBUG', 'Settings loaded from database and merged with defaults.');
  }, [addLog]);

  useEffect(() => {
    loadAndEnhanceSettings();
  }, [loadAndEnhanceSettings]);

  useWorkspaceEvents(
    event => {
      if (event.type === 'workspace-activated') {
        setLoaded(false);
        loadAndEnhanceSettings();
      }
    },
    [loadAndEnhanceSettings],
  );

  // Effect to notify main process of prerelease setting changes
  useEffect(() => {
    // Fix: Use optional chaining which is now type-safe.
    if (loaded && isElectron && window.electronAPI?.updaterSetAllowPrerelease) {
      addLog('DEBUG', `Notifying main process: allowPrerelease is ${settings.allowPrerelease}`);
      // Fix: Use optional chaining.
      window.electronAPI.updaterSetAllowPrerelease(settings.allowPrerelease);
    }
  }, [settings.allowPrerelease, loaded, addLog]);

  const saveSettings = useCallback(async (newSettings: Settings) => {
    setSettings(newSettings);
    await repository.saveAllSettings(newSettings);
    addLog('INFO', 'Application settings updated and saved.');
  }, [addLog]);

  return { settings, saveSettings, loaded };
};
import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';
import { llmDiscoveryService } from '../services/llmDiscoveryService';

// Fix: Use optional chaining which is now type-safe with the global declaration.
const isElectron = window.electronAPI;

export const useSettings = () => {
  const { addLog } = useLogger();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadAndEnhanceSettings = async () => {
      let loadedSettings = await repository.getAllSettings();
      
      // If no settings in DB, could be first run or post-migration.
      if (Object.keys(loadedSettings).length === 0) {
        // We defer to the repository's migration logic to handle old settings.
        // For a true first run, we save the defaults.
        await repository.saveAllSettings(DEFAULT_SETTINGS);
        loadedSettings = DEFAULT_SETTINGS;
        addLog('INFO', 'Initialized default settings in the database.');
      }

      // If provider name is missing but URL is present, try to discover it.
      if (loadedSettings.llmProviderUrl && !loadedSettings.llmProviderName) {
          addLog('DEBUG', 'LLM provider name is missing, attempting to discover it.');
          try {
              const services = await llmDiscoveryService.discoverServices();
              const matchingService = services.find(s => s.generateUrl === loadedSettings.llmProviderUrl);
              if (matchingService) {
                  loadedSettings.llmProviderName = matchingService.name;
                  loadedSettings.apiType = matchingService.apiType;
                  addLog('INFO', `Discovered and set provider name to: "${matchingService.name}"`);
                  // Save the enhanced settings back
                  await repository.saveAllSettings(loadedSettings);
              } else {
                  addLog('WARNING', `Could not find a matching running service for the saved URL: ${loadedSettings.llmProviderUrl}`);
              }
          } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              addLog('ERROR', `Error during settings enhancement discovery: ${message}`);
          }
      }

      setSettings(loadedSettings as Settings);
      setLoaded(true);
      addLog('DEBUG', 'Settings loaded from database.');
    };

    loadAndEnhanceSettings();
  }, [addLog]);

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

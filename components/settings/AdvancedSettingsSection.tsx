import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import type { SectionProps } from './SettingsHelpers';
import { useLogger } from '../../hooks/useLogger';
import Button from '../Button';
import SettingRow from '../SettingRow';
import SettingsTreeEditor from '../SettingsTreeEditor';
import JsonEditor from '../JsonEditor';

export const AdvancedSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({
  settings,
  setCurrentSettings,
}) => {
  const { addLog } = useLogger();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jsonString, setJsonString] = useState(() => JSON.stringify(settings, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [mode, setMode] = useState<'tree' | 'json'>('tree');
  const [transferStatus, setTransferStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const editorSurfaceStyle = useMemo<React.CSSProperties>(
    () => ({
      minHeight: '24rem',
      height: 'clamp(24rem, 70vh, 44rem)',
      maxHeight: '44rem',
    }),
    []
  );

  useEffect(() => {
    setJsonString(JSON.stringify(settings, null, 2));
    setJsonError(null);
  }, [settings]);

  useEffect(() => {
    if (!transferStatus) {
      return;
    }
    const timeout = window.setTimeout(() => setTransferStatus(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [transferStatus]);

  const applyImportedSettings = useCallback(
    (content: string) => {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Settings file must contain a JSON object.');
        }
        const merged = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
        setCurrentSettings(merged);
        setTransferStatus({ type: 'success', message: 'Settings imported. Review changes and save to apply.' });
        addLog('INFO', 'User action: Imported settings from JSON.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import settings.';
        setTransferStatus({ type: 'error', message });
        addLog('ERROR', `Settings import failed: ${message}`);
      }
    },
    [addLog, setCurrentSettings]
  );

  const handleJsonChange = (value: string) => {
    setJsonString(value);
    try {
      const parsed = JSON.parse(value);
      setCurrentSettings(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON format.');
    }
  };

  const handleSettingChange = (path: (string | number)[], value: any) => {
    setCurrentSettings((prevSettings) => {
      // A safe way to deep-clone and update nested properties
      const newSettings = JSON.parse(JSON.stringify(prevSettings));
      let current: any = newSettings;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (current[key] === undefined || typeof current[key] !== 'object') {
          // This path is invalid, which shouldn't happen with the tree editor.
          // Return original state to be safe.
          return prevSettings;
        }
        current = current[key];
      }
      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  const handleExport = useCallback(async () => {
    const content = JSON.stringify(settings, null, 2);
    addLog('INFO', 'User action: Export settings to JSON.');
    if (window.electronAPI?.settingsExport) {
      const result = await window.electronAPI.settingsExport(content);
      if (result.success) {
        setTransferStatus({ type: 'success', message: 'Settings exported successfully.' });
        return;
      }
      if (result.canceled) {
        addLog('INFO', 'Settings export canceled by user.');
        return;
      }
      const message = result.error ?? 'Failed to export settings.';
      setTransferStatus({ type: 'error', message });
      addLog('ERROR', `Settings export failed: ${message}`);
      return;
    }

    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `docforge-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setTransferStatus({ type: 'success', message: 'Settings exported successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export settings.';
      setTransferStatus({ type: 'error', message });
      addLog('ERROR', `Settings export failed: ${message}`);
    }
  }, [addLog, settings]);

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        applyImportedSettings(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read settings file.';
        setTransferStatus({ type: 'error', message });
        addLog('ERROR', `Settings import failed: ${message}`);
      }
    },
    [addLog, applyImportedSettings]
  );

  const handleImport = useCallback(async () => {
    addLog('INFO', 'User action: Initiate settings import from JSON.');
    if (window.electronAPI?.settingsImport) {
      const result = await window.electronAPI.settingsImport();
      if (result.success && result.content) {
        applyImportedSettings(result.content);
      } else if (!result.success && result.error) {
        setTransferStatus({ type: 'error', message: result.error });
        addLog('ERROR', `Settings import failed: ${result.error}`);
      }
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [addLog, applyImportedSettings]);

  return (
    <section className="flex flex-col min-h-full pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Advanced</h2>
      <div className="flex flex-col gap-6 flex-1 min-h-0">
        <SettingRow label="Settings Transfer" description="Export the current configuration or import it from a JSON file.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExport} variant="secondary" className="px-3 py-1 text-xs">
                Export Settings
              </Button>
              <Button onClick={handleImport} variant="secondary" className="px-3 py-1 text-xs">
                Import Settings
              </Button>
            </div>
            {transferStatus && (
              <p className={`text-xs ${transferStatus.type === 'success' ? 'text-success' : 'text-error'}`}>
                {transferStatus.message}
              </p>
            )}
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileInputChange} />
          </div>
        </SettingRow>
        <SettingRow label="Settings Editor" description="Edit settings using an interactive tree or raw JSON for full control.">
          <div className="flex flex-col gap-3 w-full flex-1 min-h-0 self-stretch">
            <div className="flex justify-end">
              <div className="flex items-center p-1 bg-background rounded-lg border border-border-color">
                <button
                  onClick={() => setMode('tree')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'tree' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'
                  }`}
                >
                  Tree
                </button>
                <button
                  onClick={() => setMode('json')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'json' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              {mode === 'tree' ? (
                <SettingsTreeEditor settings={settings} onSettingChange={handleSettingChange} className="flex-1" style={editorSurfaceStyle} />
              ) : (
                <>
                  <JsonEditor value={jsonString} onChange={handleJsonChange} className="flex-1" style={editorSurfaceStyle} />
                  {jsonError && <p className="text-sm text-destructive-text">{jsonError}</p>}
                </>
              )}
            </div>
          </div>
        </SettingRow>
      </div>
    </section>
  );
};

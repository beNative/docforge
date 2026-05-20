import React, { useState, useCallback } from 'react';
import type { Settings } from '../../types';
import type { SectionProps } from './SettingsHelpers';
import { useLogger } from '../../hooks/useLogger';
import ToggleSwitch from '../ToggleSwitch';
import Button from '../Button';
import SettingRow from '../SettingRow';

export const GeneralSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({
  settings,
  setCurrentSettings,
}) => {
  const isOfflineRendererAvailable = typeof window !== 'undefined' && !!window.electronAPI?.renderPlantUML;
  const offlineRendererMessage = 'Offline rendering requires the desktop application with a local Java runtime.';
  const { addLog } = useLogger();
  const [isManualCheckRunning, setIsManualCheckRunning] = useState(false);
  const [manualCheckStatus, setManualCheckStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [manualCheckMessage, setManualCheckMessage] = useState<string | null>(null);
  const canManuallyCheckForUpdates = typeof window !== 'undefined' && !!window.electronAPI?.updaterCheckForUpdates;

  const handleManualUpdateCheck = useCallback(async () => {
    if (!window.electronAPI?.updaterCheckForUpdates) {
      setManualCheckStatus('error');
      setManualCheckMessage('Manual update checks are only available in the desktop application.');
      return;
    }

    setIsManualCheckRunning(true);
    setManualCheckStatus('idle');
    setManualCheckMessage(null);
    addLog('INFO', 'User action: Manual update check triggered.');

    try {
      const result = await window.electronAPI.updaterCheckForUpdates();
      if (result?.success) {
        if (result.updateAvailable) {
          const label = result.version ?? result.releaseName ?? 'latest';
          setManualCheckStatus('success');
          setManualCheckMessage(`Update ${label} found. Downloading will begin automatically.`);
        } else {
          setManualCheckStatus('success');
          setManualCheckMessage('You are running the latest version.');
        }
      } else {
        setManualCheckStatus('error');
        setManualCheckMessage(result?.error ?? 'Failed to check for updates.');
        if (result?.details) {
          addLog('DEBUG', `Manual update check details: ${result.details}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates.';
      setManualCheckStatus('error');
      setManualCheckMessage(message);
      addLog('ERROR', `Manual update check exception: ${message}`);
    } finally {
      setIsManualCheckRunning(false);
    }
  }, [addLog]);

  const effectiveManualCheckStatus = canManuallyCheckForUpdates ? manualCheckStatus : 'error';
  const manualCheckMessageClass =
    effectiveManualCheckStatus === 'error'
      ? 'text-error'
      : effectiveManualCheckStatus === 'success'
      ? 'text-success'
      : 'text-text-secondary';

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">General</h2>
      <div className="space-y-6">
        <SettingRow
          htmlFor="allowPrerelease"
          label="Pre-release Updates"
          description="Allow DocForge to download and install beta releases when available."
        >
          <ToggleSwitch
            id="allowPrerelease"
            checked={settings.allowPrerelease}
            onChange={(val) => setCurrentSettings((s) => ({ ...s, allowPrerelease: val }))}
          />
        </SettingRow>
        <SettingRow htmlFor="autoCheckForUpdates" label="Automatic Update Checks" description="Check for new releases whenever DocForge starts.">
          <ToggleSwitch
            id="autoCheckForUpdates"
            checked={settings.autoCheckForUpdates}
            onChange={(val) => setCurrentSettings((s) => ({ ...s, autoCheckForUpdates: val }))}
          />
        </SettingRow>
        <SettingRow
          htmlFor="autoInstallUpdates"
          label="Automatic Installation"
          description="When enabled, DocForge installs downloaded updates automatically the next time you restart."
        >
          <ToggleSwitch
            id="autoInstallUpdates"
            checked={settings.autoInstallUpdates}
            onChange={(val) => setCurrentSettings((s) => ({ ...s, autoInstallUpdates: val }))}
          />
        </SettingRow>
        <SettingRow label="Check for Updates" description="Run an update check immediately.">
          <div className="flex flex-col items-start md:items-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={handleManualUpdateCheck}
              isLoading={isManualCheckRunning}
              disabled={isManualCheckRunning || !canManuallyCheckForUpdates}
            >
              {isManualCheckRunning ? 'Checking…' : 'Check for Updates'}
            </Button>
            {(canManuallyCheckForUpdates ? manualCheckMessage : true) && (
              <p className={`text-xs text-left md:text-right ${manualCheckMessageClass}`}>
                {canManuallyCheckForUpdates ? manualCheckMessage : 'Manual update checks are only available in the desktop application.'}
              </p>
            )}
          </div>
        </SettingRow>
        <SettingRow
          htmlFor="autoSaveLogs"
          label="Auto-save Logs"
          description="Automatically save all logs to a daily file on your computer for debugging."
        >
          <ToggleSwitch id="autoSaveLogs" checked={settings.autoSaveLogs} onChange={(val) => setCurrentSettings((s) => ({ ...s, autoSaveLogs: val }))} />
        </SettingRow>
        <SettingRow
          htmlFor="plantumlRendererMode"
          label="PlantUML Rendering"
          description="Choose whether PlantUML diagrams are rendered via the public server or the local renderer."
        >
          <div className="flex flex-col items-end w-full md:items-end">
            <select
              id="plantumlRendererMode"
              value={settings.plantumlRendererMode}
              onChange={(event) =>
                setCurrentSettings((prev) => ({
                  ...prev,
                  plantumlRendererMode: event.target.value as Settings['plantumlRendererMode'],
                }))
              }
              className="w-full md:w-64 px-3 py-2 text-sm rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="remote">Remote (plantuml.com)</option>
              <option value="offline">Offline (local renderer)</option>
            </select>
            {!isOfflineRendererAvailable && (
              <p
                className={`mt-2 text-xs ${
                  settings.plantumlRendererMode === 'offline' ? 'text-destructive-text' : 'text-text-secondary'
                } text-right md:text-left md:w-full`}
              >
                {offlineRendererMessage}
              </p>
            )}
          </div>
        </SettingRow>
      </div>
    </section>
  );
};

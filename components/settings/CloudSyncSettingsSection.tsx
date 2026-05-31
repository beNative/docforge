import React, { useState, useCallback, useEffect } from 'react';
import type { Settings } from '../../types';
import type { SectionProps } from './SettingsHelpers';
import { useLogger } from '../../hooks/useLogger';
import ToggleSwitch from '../ToggleSwitch';
import Button from '../Button';
import SettingRow from '../SettingRow';
import ConflictResolutionModal from '../ConflictResolutionModal';
import IconButton from '../IconButton';

export const CloudSyncSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({
  settings,
  setCurrentSettings,
}) => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const { addLog } = useLogger();

  const [clientId, setClientId] = useState(settings.syncClientId || '');
  const [clientSecret, setClientSecret] = useState(settings.syncClientSecret || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncStatusTone, setSyncStatusTone] = useState<'info' | 'success' | 'error'>('info');

  const [conflictData, setConflictData] = useState<{
    localStats: any;
    remoteStats: any;
  } | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const [remoteDbs, setRemoteDbs] = useState<{ name: string; id: string; modifiedTime: string }[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [selectedDbName, setSelectedDbName] = useState(settings.syncDatabaseName || 'docforge.db');
  const [customDbNameInput, setCustomDbNameInput] = useState('');
  const [isCustomNaming, setIsCustomNaming] = useState(false);
  const [dbNameError, setDbNameError] = useState<string | null>(null);

  const isConnected = !!settings.syncGoogleEmail;

  const fetchRemoteDbs = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.syncListRemoteDatabases || !settings.syncGoogleEmail) return;
    setIsLoadingDbs(true);
    try {
      const result = await window.electronAPI.syncListRemoteDatabases();
      if (result.success && result.files) {
        setRemoteDbs(result.files);
      } else {
        console.warn('Failed to fetch remote databases:', result.error);
      }
    } catch (err) {
      console.error('Error fetching remote databases:', err);
    } finally {
      setIsLoadingDbs(false);
    }
  }, [isElectron, settings.syncGoogleEmail]);

  useEffect(() => {
    if (isConnected) {
      fetchRemoteDbs();
    }
  }, [isConnected, fetchRemoteDbs]);

  useEffect(() => {
    if (settings.syncDatabaseName) {
      setSelectedDbName(settings.syncDatabaseName);
    }
  }, [settings.syncDatabaseName]);

  // Sync state changes from main process
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onSyncStatus) return;

    const unsubscribe = window.electronAPI.onSyncStatus((payload) => {
      if (payload.status === 'syncing') {
        setIsSyncing(true);
        setSyncStatusTone('info');
        setSyncStatusMsg(payload.message || 'Syncing...');
      } else if (payload.status === 'conflict') {
        setIsSyncing(false);
        setSyncStatusTone('error');
        setSyncStatusMsg('Sync conflict detected.');
      } else if (payload.status === 'error') {
        setIsSyncing(false);
        setSyncStatusTone('error');
        setSyncStatusMsg(payload.message || 'Sync failed.');
      } else {
        setIsSyncing(false);
        setSyncStatusTone('success');
        setSyncStatusMsg(payload.message || 'Sync complete.');
      }
    });

    return unsubscribe;
  }, [isElectron]);

  // Sync Client ID & Secret back to currentSettings whenever they change
  const updateCredentials = useCallback(() => {
    setCurrentSettings((prev) => ({
      ...prev,
      syncClientId: clientId,
      syncClientSecret: clientSecret,
    }));
  }, [clientId, clientSecret, setCurrentSettings]);

  const handleConnect = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.syncGoogleConnect) return;
    if (!clientId.trim() || !clientSecret.trim()) return;

    setIsConnecting(true);
    setSyncStatusMsg('Connecting to Google Drive...');
    setSyncStatusTone('info');
    addLog('INFO', 'User action: Initiating Google Drive connection.');

    try {
      const result = await window.electronAPI.syncGoogleConnect(clientId.trim(), clientSecret.trim());
      if (result.success && result.email) {
        addLog('INFO', `Google Drive connected successfully to ${result.email}`);
        setCurrentSettings((prev) => ({
          ...prev,
          syncEnabled: true,
          syncGoogleEmail: result.email ?? null,
          syncClientId: clientId.trim(),
          syncClientSecret: clientSecret.trim(),
        }));
        setSyncStatusTone('success');
        setSyncStatusMsg(`Successfully connected to ${result.email}`);
      } else {
        const errorMsg = result.error || 'Connection failed.';
        addLog('ERROR', `Google Drive connection failed: ${errorMsg}`);
        setSyncStatusTone('error');
        setSyncStatusMsg(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Authentication failed.';
      addLog('ERROR', `Google Drive OAuth Exception: ${errorMsg}`);
      setSyncStatusTone('error');
      setSyncStatusMsg(errorMsg);
    } finally {
      setIsConnecting(false);
    }
  }, [isElectron, clientId, clientSecret, addLog, setCurrentSettings]);

  const handleDisconnect = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.syncGoogleDisconnect) return;

    setIsDisconnecting(true);
    addLog('INFO', 'User action: Disconnecting Google Drive.');

    try {
      const result = await window.electronAPI.syncGoogleDisconnect();
      if (result.success) {
        addLog('INFO', 'Google Drive disconnected.');
        setCurrentSettings((prev) => ({
          ...prev,
          syncEnabled: false,
          syncGoogleEmail: null,
          syncGoogleRefreshToken: null,
          syncLastCompletedAt: null,
        }));
        setClientId('');
        setClientSecret('');
        setSyncStatusMsg('Disconnected successfully.');
        setSyncStatusTone('success');
      } else {
        setSyncStatusTone('error');
        setSyncStatusMsg(result.error || 'Failed to disconnect.');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Disconnection failed.';
      setSyncStatusTone('error');
      setSyncStatusMsg(errorMsg);
    } finally {
      setIsDisconnecting(false);
    }
  }, [isElectron, addLog, setCurrentSettings]);

  const handleSyncNow = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.syncRun) return;

    setIsSyncing(true);
    setSyncStatusMsg('Synchronizing...');
    setSyncStatusTone('info');
    addLog('INFO', 'User action: Sync Now triggered.');

    try {
      const result = await window.electronAPI.syncRun();
      if (result.success) {
        if (result.code === 'conflict' && result.localStats && result.remoteStats) {
          setConflictData({
            localStats: result.localStats,
            remoteStats: result.remoteStats,
          });
          setSyncStatusMsg('Conflict detected between local and cloud databases.');
          setSyncStatusTone('error');
        } else {
          setSyncStatusTone('success');
          setSyncStatusMsg(result.message || 'Sync completed successfully.');
          
          // Fetch updated config details (like lastCompletedAt)
          const config = await window.electronAPI.syncGetConfig();
          setCurrentSettings((prev) => ({
            ...prev,
            syncLastCompletedAt: config.lastCompletedAt ?? null,
          }));
        }
      } else {
        setSyncStatusTone('error');
        setSyncStatusMsg(result.error || 'Synchronization failed.');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync execution failed.';
      setSyncStatusTone('error');
      setSyncStatusMsg(errorMsg);
    } finally {
      setIsSyncing(false);
    }
  }, [isElectron, addLog, setCurrentSettings]);

  const handleResolveConflict = useCallback(
    async (resolution: 'local' | 'remote') => {
      if (!isElectron || !window.electronAPI?.syncResolveConflict) return;

      setIsSyncing(true);
      setConflictData(null);
      setSyncStatusMsg(`Resolving conflict using ${resolution} database...`);
      setSyncStatusTone('info');
      addLog('INFO', `User action: Resolving conflict preferring ${resolution}.`);

      try {
        const result = await window.electronAPI.syncResolveConflict(resolution);
        if (result.success) {
          setSyncStatusTone('success');
          setSyncStatusMsg(result.message || 'Conflict resolved successfully.');
          
          const config = await window.electronAPI.syncGetConfig();
          setCurrentSettings((prev) => ({
            ...prev,
            syncLastCompletedAt: config.lastCompletedAt ?? null,
          }));
        } else {
          setSyncStatusTone('error');
          setSyncStatusMsg(result.error || 'Failed to resolve conflict.');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to resolve conflict.';
        setSyncStatusTone('error');
        setSyncStatusMsg(errorMsg);
      } finally {
        setIsSyncing(false);
      }
    },
    [isElectron, addLog, setCurrentSettings]
  );

  const isInputDisabled = isConnecting || isDisconnecting || isSyncing || isConnected;

  const toneClass =
    syncStatusTone === 'error'
      ? 'text-destructive-text'
      : syncStatusTone === 'success'
      ? 'text-success'
      : 'text-text-secondary';

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Cloud Sync</h2>
      
      {!isElectron && (
        <div className="p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive-text text-xs">
          Cloud synchronization is only supported in the desktop build of DocForge.
        </div>
      )}

      {/* Step-by-Step Setup Guide */}
      <div className="mb-6 p-4 rounded-lg bg-secondary/50 border border-border-color text-xs">
        <button
          type="button"
          onClick={() => setShowSetupGuide(!showSetupGuide)}
          className="flex items-center justify-between w-full font-medium text-text-main hover:text-primary transition-colors focus:outline-none"
        >
          <span className="flex items-center gap-2">
            <span className="text-sm">ℹ️</span> First-Time Setup & Google Drive API Guide
          </span>
          <span className="text-[10px] uppercase tracking-wider text-text-secondary">
            {showSetupGuide ? 'Hide Guide' : 'Show Guide'}
          </span>
        </button>
        
        {showSetupGuide && (
          <div className="mt-4 space-y-3 text-text-secondary leading-relaxed border-t border-border-color pt-3">
            <p>
              DocForge uses your own Google Cloud Console credentials to sync your SQLite database securely to a private, isolated application space on your Google Drive. Follow these steps to configure it:
            </p>
            
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Create a Google Cloud Project:</strong> Go to the{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Cloud Console
                </a>{' '}
                and create a new project.
              </li>
              <li>
                <strong>Enable the Google Drive API:</strong> Search for <strong>Google Drive API</strong> in the API Library, or go directly to{' '}
                <a
                  href="https://console.developers.google.com/apis/api/drive.googleapis.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-semibold"
                >
                  Enable Drive API
                </a>{' '}
                and click <strong>Enable</strong>. <em>(Failure to do this will cause "Forbidden" errors when syncing).</em>
              </li>
              <li>
                <strong>Configure OAuth Consent Screen:</strong> In your project, set up the OAuth Consent Screen (choose "External" for personal Gmail accounts). Add the scope{' '}
                <code className="bg-background px-1 py-0.5 rounded border border-border-color font-mono text-[10px]">
                  https://www.googleapis.com/auth/drive.appdata
                </code>{' '}
                and add your email as a <strong>Test User</strong> while the app is in Testing mode.
              </li>
              <li>
                <strong>Create OAuth Credentials:</strong> Go to the <strong>Credentials</strong> page, click <strong>Create Credentials</strong> &gt; <strong>OAuth Client ID</strong>, select <strong>Desktop Application</strong> as the Application Type, name it (e.g. "DocForge Sync"), and click Create.
              </li>
              <li>
                <strong>Copy Credentials:</strong> Enter the generated <strong>Client ID</strong> and <strong>Client Secret</strong> below. Whitespaces are trimmed automatically.
              </li>
              <li>
                <strong>Link Account:</strong> Click <strong>Connect Account</strong>. A local server will temporarily listen on{' '}
                <code className="bg-background px-1 py-0.5 rounded border border-border-color font-mono text-[10px]">
                  http://127.0.0.1:52080
                </code>{' '}
                to capture the authentication code from your browser.
              </li>
            </ol>

            <div className="p-3 rounded bg-primary/5 border border-primary/20 text-text-secondary mt-3">
              <h4 className="font-semibold text-text-main mb-1">🔒 Privacy & Sandbox Isolation</h4>
              DocForge requests access <em>only</em> to the isolated <strong>Application Data folder</strong> on your Google Drive. 
              The application has absolutely no access to your other folders, files, or documents in your main Google Drive.
            </div>
            
            <div className="p-3 rounded bg-destructive-bg/30 border border-destructive-border/50 text-text-secondary mt-2">
              <h4 className="font-semibold text-text-main mb-1">⚠️ Troubleshooting: "Drive search failed: Forbidden"</h4>
              If you receive this error when testing sync, it indicates that you have not enabled the <strong>Google Drive API</strong> inside your specific Google Cloud Console project. 
              Click <a href="https://console.developers.google.com/apis/api/drive.googleapis.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold">this link</a>, verify your project is selected in the top-left dropdown, and enable the API.
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Credentials Form */}
        <SettingRow
          htmlFor="clientId"
          label="Google Client ID"
          description="Enter your Google OAuth Desktop Client ID from the Google Cloud Console."
        >
          <input
            type="text"
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            onBlur={updateCredentials}
            disabled={isInputDisabled}
            className="w-full md:w-80 px-3 py-1.5 text-xs rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="OAuth Client ID"
          />
        </SettingRow>

        <SettingRow
          htmlFor="clientSecret"
          label="Google Client Secret"
          description="Enter your Google OAuth Client Secret corresponding to your Client ID."
        >
          <input
            type="password"
            id="clientSecret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            onBlur={updateCredentials}
            disabled={isInputDisabled}
            className="w-full md:w-80 px-3 py-1.5 text-xs rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="OAuth Client Secret"
          />
        </SettingRow>

        {/* OAuth Authentication Status */}
        <SettingRow
          label="Google Drive Link"
          description="Link or unlink DocForge to your personal Google account space."
        >
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium border border-success/35">
                  Connected: {settings.syncGoogleEmail}
                </span>
                <Button
                  variant="secondary"
                  onClick={handleDisconnect}
                  isLoading={isDisconnecting}
                  disabled={isDisconnecting || isSyncing}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleConnect}
                isLoading={isConnecting}
                disabled={isConnecting || isElectron === false || !clientId.trim() || !clientSecret.trim()}
              >
                Connect Account
              </Button>
            )}
          </div>
        </SettingRow>

        {/* Sync Controls (Visible only when connected) */}
        {isConnected && (
          <>
            <SettingRow
              htmlFor="syncEnabled"
              label="Enable Cloud Sync"
              description="Keep cloud synchronization active and auto-update metadata."
            >
              <ToggleSwitch
                id="syncEnabled"
                checked={settings.syncEnabled}
                onChange={(val) => setCurrentSettings((s) => ({ ...s, syncEnabled: val }))}
              />
            </SettingRow>

            <SettingRow
              htmlFor="syncDatabaseName"
              label="Google Drive Database"
              description="Select which remote database file to synchronize with on Google Drive, or create/name a new one."
            >
              <div className="flex flex-col gap-2 w-full md:w-80">
                {!isCustomNaming ? (
                  <div className="flex gap-2">
                    <select
                      id="syncDatabaseName"
                      value={selectedDbName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomNaming(true);
                          setCustomDbNameInput('');
                          setDbNameError('Database name must end with .db');
                        } else {
                          setSelectedDbName(val);
                          setCurrentSettings((prev) => ({
                            ...prev,
                            syncDatabaseName: val,
                          }));
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="docforge.db">docforge.db (Default)</option>
                      {selectedDbName !== 'docforge.db' && !remoteDbs.some(d => d.name === selectedDbName) && (
                        <option value={selectedDbName}>
                          {selectedDbName} (configured)
                        </option>
                      )}
                      {remoteDbs.map((dbFile) => {
                        if (dbFile.name === 'docforge.db') return null;
                        return (
                          <option key={dbFile.id} value={dbFile.name}>
                            {dbFile.name} (cloud)
                          </option>
                        );
                      })}
                      <option value="__custom__">+ Create / Use custom name...</option>
                    </select>
                    <IconButton
                      type="button"
                      onClick={fetchRemoteDbs}
                      disabled={isLoadingDbs}
                      tooltip="Refresh cloud database list"
                      tooltipPosition="top"
                      className="border border-border-color bg-background hover:bg-secondary text-text-main focus:ring-1 focus:ring-primary/50 flex items-center justify-center rounded-md h-8 w-8"
                    >
                      {isLoadingDbs ? (
                        <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        '🔄'
                      )}
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customDbNameInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomDbNameInput(val);
                          if (!val.trim()) {
                            setDbNameError('Database name cannot be empty');
                          } else if (!val.toLowerCase().endsWith('.db')) {
                            setDbNameError('Database name must end with .db');
                          } else {
                            setDbNameError(null);
                          }
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs rounded-md border ${
                          dbNameError ? 'border-destructive' : 'border-border-color'
                        } bg-background text-text-main focus:outline-none focus:ring-1 ${
                          dbNameError ? 'focus:ring-destructive/50' : 'focus:ring-primary/50'
                        }`}
                        placeholder="e.g. docforge-work.db"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!dbNameError && customDbNameInput.trim()) {
                            const finalName = customDbNameInput.trim();
                            setSelectedDbName(finalName);
                            setCurrentSettings((prev) => ({
                              ...prev,
                              syncDatabaseName: finalName,
                            }));
                            if (!remoteDbs.some(d => d.name === finalName)) {
                              setRemoteDbs(prev => [...prev, { name: finalName, id: 'temp-custom', modifiedTime: '' }]);
                            }
                            setIsCustomNaming(false);
                          }
                        }}
                        disabled={!!dbNameError}
                        className="px-3 py-1.5 text-xs font-semibold text-accent-text bg-primary rounded-md hover:bg-primary/95 disabled:opacity-50 focus:outline-none"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomNaming(false);
                          setDbNameError(null);
                        }}
                        className="px-3 py-1.5 text-xs rounded-md border border-border-color bg-background hover:bg-secondary text-text-main focus:outline-none"
                      >
                        Cancel
                      </button>
                    </div>
                    {dbNameError && (
                      <span className="text-[10px] text-destructive-text font-medium px-1">
                        ⚠️ {dbNameError}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </SettingRow>

            <SettingRow
              htmlFor="syncAutoOnOpenClose"
              label="Sync on Startup & Shutdown"
              description="Automatically perform sync passes when launching or quitting the application."
            >
              <ToggleSwitch
                id="syncAutoOnOpenClose"
                checked={settings.syncAutoOnOpenClose}
                onChange={(val) => setCurrentSettings((s) => ({ ...s, syncAutoOnOpenClose: val }))}
              />
            </SettingRow>

            <SettingRow
              htmlFor="syncConflictResolution"
              label="Conflict Resolution"
              description="Decide what to do if both the local and cloud databases have modified concurrently."
            >
              <select
                id="syncConflictResolution"
                value={settings.syncConflictResolution}
                onChange={(e) =>
                  setCurrentSettings((s) => ({
                    ...s,
                    syncConflictResolution: e.target.value as Settings['syncConflictResolution'],
                  }))
                }
                className="w-full md:w-64 px-3 py-1.5 text-xs rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="ask">Ask (Show comparison dialog)</option>
                <option value="prefer-local">Prefer Local (Overwrite Cloud)</option>
                <option value="prefer-cloud">Prefer Cloud (Overwrite Local)</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Synchronize Now"
              description={`Manually trigger database synchronization. ${
                settings.syncLastCompletedAt
                  ? `Last completed: ${new Date(settings.syncLastCompletedAt).toLocaleString()}`
                  : 'Never synced before.'
              }`}
            >
              <div className="flex flex-col items-end gap-2 w-full">
                <Button
                  variant="secondary"
                  onClick={handleSyncNow}
                  isLoading={isSyncing}
                  disabled={isSyncing || !settings.syncEnabled}
                >
                  Sync Now
                </Button>
              </div>
            </SettingRow>
          </>
        )}

        {/* Sync Status Logs / Messages */}
        {syncStatusMsg && (
          <div className="mt-4 p-3 rounded-md bg-secondary/50 border border-border-color text-xs flex justify-between items-center">
            <span className={toneClass}>{syncStatusMsg}</span>
            {isSyncing && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        )}
      </div>

      {/* Conflict Resolution Modal */}
      {conflictData && (
        <ConflictResolutionModal
          localStats={conflictData.localStats}
          remoteStats={conflictData.remoteStats}
          onResolve={handleResolveConflict}
          onClose={() => setConflictData(null)}
        />
      )}
    </section>
  );
};

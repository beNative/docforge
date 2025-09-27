import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Database ---
  dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
  dbGet: (sql: string, params?: any[]) => ipcRenderer.invoke('db:get', sql, params),
  dbRun: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
  dbIsNew: () => ipcRenderer.invoke('db:is-new'),
  dbMigrateFromJson: (data: any) => ipcRenderer.invoke('db:migrate-from-json', data),
  dbDuplicateNodes: (nodeIds: string[]) => ipcRenderer.invoke('db:duplicate-nodes', nodeIds),
  dbDeleteVersions: (documentId: number, versionIds: number[]) => ipcRenderer.invoke('db:delete-versions', documentId, versionIds),

  // --- Migration-related FS access ---
  legacyFileExists: (filename: string) => ipcRenderer.invoke('fs:legacy-file-exists', filename),
  readLegacyFile: (filename: string) => ipcRenderer.invoke('fs:read-legacy-file', filename),

  // --- App Info & Updates ---
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  getLogPath: () => ipcRenderer.invoke('app:get-log-path'),
  updaterSetAllowPrerelease: (allow: boolean) => ipcRenderer.send('updater:set-allow-prerelease', allow),
  onUpdateDownloaded: (callback: (version: string) => void) => {
    const handler = (_: IpcRendererEvent, version: string) => callback(version);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  quitAndInstallUpdate: () => ipcRenderer.send('updater:quit-and-install'),
  
  // --- Window Controls ---
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => {
    const handler = (_: IpcRendererEvent, state: { isMaximized: boolean }) => callback(state);
    ipcRenderer.on('window:state-change', handler);
    return () => ipcRenderer.removeListener('window:state-change', handler);
  },
  
  // --- Dialogs & Docs (keep original names for compatibility) ---
  saveLog: (defaultFilename: string, content: string) => ipcRenderer.invoke('dialog:save', {
      title: 'Save Log File',
      defaultPath: `docforge-log-${new Date().toISOString().split('T')[0]}.log`,
      filters: [{ name: 'Log Files', extensions: ['log'] }, { name: 'All Files', extensions: ['*'] }]
  }, content),
  
  settingsExport: (content: string) => ipcRenderer.invoke('dialog:save', {
      title: 'Export Settings',
      defaultPath: 'docforge_settings.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }]
  }, content),

  settingsImport: () => ipcRenderer.invoke('dialog:open', {
      title: 'Import Settings',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
  }),
  
  readDoc: (filename: string) => ipcRenderer.invoke('docs:read', filename),
});
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Database ---
  dbQuery: (sql: string, params?: any[], workspaceId?: string) => ipcRenderer.invoke('db:query', sql, params, workspaceId),
  dbGet: (sql: string, params?: any[], workspaceId?: string) => ipcRenderer.invoke('db:get', sql, params, workspaceId),
  dbRun: (sql: string, params?: any[], workspaceId?: string) => ipcRenderer.invoke('db:run', sql, params, workspaceId),
  dbIsNew: () => ipcRenderer.invoke('db:is-new'),
  dbMigrateFromJson: (data: any) => ipcRenderer.invoke('db:migrate-from-json', data),
  dbDuplicateNodes: (nodeIds: string[], workspaceId?: string) => ipcRenderer.invoke('db:duplicate-nodes', nodeIds, workspaceId),
  dbDeleteVersions: (documentId: number, versionIds: number[], workspaceId?: string) =>
    ipcRenderer.invoke('db:delete-versions', documentId, versionIds, workspaceId),
  dbBackup: (workspaceId?: string) => ipcRenderer.invoke('db:backup', workspaceId),
  dbIntegrityCheck: (workspaceId?: string) => ipcRenderer.invoke('db:integrity-check', workspaceId),
  dbVacuum: (workspaceId?: string) => ipcRenderer.invoke('db:vacuum', workspaceId),
  dbGetStats: (workspaceId?: string) => ipcRenderer.invoke('db:get-stats', workspaceId),
  dbGetPath: (workspaceId?: string) => ipcRenderer.invoke('db:get-path', workspaceId),
  dbListWorkspaces: () => ipcRenderer.invoke('db:list-workspaces'),
  dbCreateWorkspace: (name: string) => ipcRenderer.invoke('db:create-workspace', name),
  dbRenameWorkspace: (workspaceId: string, newName: string) => ipcRenderer.invoke('db:rename-workspace', workspaceId, newName),
  dbDeleteWorkspace: (workspaceId: string) => ipcRenderer.invoke('db:delete-workspace', workspaceId),
  dbSwitchWorkspace: (workspaceId: string) => ipcRenderer.invoke('db:switch-workspace', workspaceId),
  dbGetActiveWorkspace: () => ipcRenderer.invoke('db:get-active-workspace'),
  dbTransferNodes: (nodeIds: string[], targetWorkspaceId: string, targetParentId: string | null, sourceWorkspaceId?: string) =>
    ipcRenderer.invoke('db:transfer-nodes', nodeIds, targetWorkspaceId, targetParentId, sourceWorkspaceId),
  dbOpenWorkspaceConnection: (workspaceId: string) => ipcRenderer.invoke('db:open-workspace-connection', workspaceId),
  dbCloseWorkspaceConnection: (workspaceId: string) => ipcRenderer.invoke('db:close-workspace-connection', workspaceId),
  dbRefreshWorkspaceConnection: (workspaceId: string) => ipcRenderer.invoke('db:refresh-workspace-connection', workspaceId),
  dbOnWorkspaceEvent: (callback: (event: any) => void) => {
    const handler = (_: IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on('db:workspace-event', handler);
    return () => {
      ipcRenderer.removeListener('db:workspace-event', handler);
    };
  },
  dbImportFiles: (filesData: any[], targetParentId: string | null, workspaceId?: string) =>
    ipcRenderer.invoke('db:import-files', filesData, targetParentId, workspaceId),

  // --- Migration-related FS access ---
  legacyFileExists: (filename: string) => ipcRenderer.invoke('fs:legacy-file-exists', filename),
  readLegacyFile: (filename: string) => ipcRenderer.invoke('fs:read-legacy-file', filename),

  // --- App Info & Updates ---
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  getLogPath: () => ipcRenderer.invoke('app:get-log-path'),
  renderPlantUML: (diagram: string, format: 'svg' = 'svg') => ipcRenderer.invoke('plantuml:render-svg', diagram, format),
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

  // --- Python execution & environments ---
  pythonListEnvironments: () => ipcRenderer.invoke('python:list-envs'),
  pythonDetectInterpreters: () => ipcRenderer.invoke('python:detect-interpreters'),
  pythonCreateEnvironment: (options: any) => ipcRenderer.invoke('python:create-env', options),
  pythonUpdateEnvironment: (envId: string, updates: any) => ipcRenderer.invoke('python:update-env', envId, updates),
  pythonDeleteEnvironment: (envId: string) => ipcRenderer.invoke('python:delete-env', envId),
  pythonGetNodeSettings: (nodeId: string) => ipcRenderer.invoke('python:get-node-settings', nodeId),
  pythonSetNodeSettings: (nodeId: string, envId: string | null, autoDetect: boolean) => ipcRenderer.invoke('python:set-node-settings', nodeId, envId, autoDetect),
  pythonEnsureNodeEnv: (nodeId: string, defaults: any, interpreters?: any[]) => ipcRenderer.invoke('python:ensure-node-env', nodeId, defaults, interpreters),
  pythonRunScript: (payload: any) => ipcRenderer.invoke('python:run-script', payload),
  pythonGetRunsForNode: (nodeId: string, limit?: number) => ipcRenderer.invoke('python:get-runs-for-node', nodeId, limit),
  pythonGetRunLogs: (runId: string) => ipcRenderer.invoke('python:get-run-logs', runId),
  pythonGetRun: (runId: string) => ipcRenderer.invoke('python:get-run', runId),
  onPythonRunLog: (callback: (payload: any) => void) => {
    const handler = (_: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('python:run-log', handler);
    return () => ipcRenderer.removeListener('python:run-log', handler);
  },
  onPythonRunStatus: (callback: (payload: any) => void) => {
    const handler = (_: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('python:run-status', handler);
    return () => ipcRenderer.removeListener('python:run-status', handler);
  },
});

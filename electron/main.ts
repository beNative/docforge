// Fix: This file was previously a placeholder. This is the full implementation for the Electron main process.
import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
// Fix: Import 'platform' from 'process' for type-safe access to the current OS identifier.
import { platform } from 'process';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { autoUpdater } from 'electron-updater';
import { GitHubProvider } from 'electron-updater/out/providers/GitHubProvider';
import { databaseService } from './database';
import { pythonManager } from './pythonManager';
import log from 'electron-log/main';
import * as zlib from 'zlib';
import * as os from 'os';
import * as stream from 'stream';
import { promisify } from 'util';
import { spawn } from 'child_process';

// Fix: Inform TypeScript about the __dirname global variable provided by Node.js, which is present in a CommonJS-like environment.
declare const __dirname: string;

// Note: The type declaration for process.resourcesPath has been moved to types.ts to centralize global augmentations.
// This empty block is kept to satisfy the original file structure but the augmentation now happens in types.ts.
declare global {
  namespace NodeJS {
    interface Process {
      // The `resourcesPath` property is augmented in `types.ts`
      // FIX: The augmentation from types.ts was not being picked up.
      // Explicitly adding it here resolves the type error in this file.
      resourcesPath: string;
    }
  }
}

// --- electron-log setup ---
// Override console.log, console.error, etc. to write to a log file
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');
Object.assign(console, log.functions);
// Catch unhandled exceptions
log.catchErrors({
  showDialog: false, // We'll handle fatal errors in the renderer
  onError(error) {
    console.error('Unhandled exception:', error);
  }
});

console.log(`Log file will be written to: ${log.transports.file.getFile().path}`);

if (process.platform === 'win32') {
  const arch = process.arch === 'ia32' ? 'ia32' : process.arch === 'arm64' ? 'arm64' : 'x64';
  const channel = `win32-${arch}`;
  console.log(`Tracking Windows auto-update channel preference: ${channel}`);
  (autoUpdater as unknown as { __docforgeWindowsChannel?: string }).__docforgeWindowsChannel = channel;
}

let mainWindow: BrowserWindow | null;
let autoCheckEnabled = true;
let pendingAutoUpdateCheck: NodeJS.Timeout | null = null;

const cancelScheduledAutoUpdateCheck = () => {
  if (pendingAutoUpdateCheck) {
    clearTimeout(pendingAutoUpdateCheck);
    pendingAutoUpdateCheck = null;
  }
};

const scheduleAutoUpdateCheck = (delayMs = 3000) => {
  if (!autoCheckEnabled) {
    console.log('Automatic update checks are disabled; skipping schedule.');
    return;
  }

  cancelScheduledAutoUpdateCheck();

  pendingAutoUpdateCheck = setTimeout(async () => {
    pendingAutoUpdateCheck = null;
    if (!autoCheckEnabled) {
      console.log('Automatic update checks disabled before execution; skipping update check.');
      return;
    }

    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      console.error('Automatic update check failed:', error);
    }
  }, delayMs);
};

const buildUpdateErrorMessages = (error: unknown) => {
  const fallback = 'DocForge hit an unexpected problem while downloading the latest update. We\'ll retry automatically in the background.';
  let detailMessage: string;
  if (error instanceof Error) {
    const baseMessage = `${error.name}: ${error.message}`.trim();
    const stack = (error.stack ?? '').trim();
    detailMessage = stack && !stack.includes(baseMessage)
      ? `${baseMessage}\n${stack}`
      : (stack || baseMessage || 'Unknown error');
  } else if (typeof error === 'string') {
    detailMessage = error || 'Unknown error';
  } else {
    try {
      detailMessage = JSON.stringify(error) || 'Unknown error';
    } catch {
      detailMessage = 'Unknown error';
    }
  }

  const normalized = detailMessage.toLowerCase();

  let friendlyMessage = fallback;
  if (normalized.includes('latest.yml') || normalized.includes('app-update.yml')) {
    friendlyMessage = 'DocForge couldn\'t download the update manifest from GitHub yet. The release files may still be publishing, so we\'ll try again shortly.';
  } else if (normalized.includes('404')) {
    friendlyMessage = 'DocForge reached GitHub but the update files were unavailable. We\'ll retry automatically once they finish uploading.';
  } else if (normalized.includes('403') || normalized.includes('rate limit')) {
    friendlyMessage = 'GitHub temporarily rejected the update request. DocForge will pause for a moment and then try again.';
  } else if (
    normalized.includes('econnrefused') ||
    normalized.includes('getaddrinfo') ||
    normalized.includes('eai_again') ||
    normalized.includes('network') ||
    normalized.includes('offline')
  ) {
    friendlyMessage = 'DocForge couldn\'t reach GitHub to download the update. Please check your internet connection; we\'ll retry in the background.';
  } else if (normalized.includes('timeout') || normalized.includes('timed out')) {
    friendlyMessage = 'The connection to GitHub timed out while downloading the update. DocForge will automatically retry in a few minutes.';
  }

  return { friendlyMessage, detailMessage };
};

const broadcastPythonEvent = (channel: string, payload: any) => {
  const targets = BrowserWindow.getAllWindows();
  for (const window of targets) {
    try {
      window.webContents.send(channel, payload);
    } catch (error) {
      console.error(`Failed to forward Python event ${channel}:`, error);
    }
  }
};

pythonManager.events.on('run-log', (payload) => broadcastPythonEvent('python:run-log', payload));
pythonManager.events.on('run-status', (payload) => broadcastPythonEvent('python:run-status', payload));

// Work around GitHub returning HTTP 406 for JSON-only requests to the
// `/releases/latest` endpoint by resolving the latest tag via the REST API.
// We attempt to use the official "latest" endpoint first and then fall back to
// listing the most recent releases if that endpoint reports that no production
// release exists (HTTP 404). This avoids the auto-update check failing on
// startup while still respecting the expectation that only published,
// non-prerelease builds are considered when automatic updates are disabled for
// prerelease channels.
const originalGetLatestTagName = GitHubProvider.prototype.getLatestTagName;
GitHubProvider.prototype.getLatestTagName = async function (this: GitHubProvider, cancellationToken) {
    const { owner, repo, host } = this.options;
    const apiHost = !host || host === 'github.com' ? 'https://api.github.com' : `https://${host}`;
    const apiPathPrefix = host && !['github.com', 'api.github.com'].includes(host) ? '/api/v3' : '';

    const buildApiUrl = (suffix: string) => {
        const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
        return new URL(`${apiPathPrefix}${normalizedSuffix}`, apiHost);
    };

    const requestHeaders = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'docforge-auto-updater',
        'X-GitHub-Api-Version': '2022-11-28',
    } as const;

    const tryResolveFromLatestEndpoint = async (): Promise<string | null> => {
        try {
            const rawResponse = await this.httpRequest(
                buildApiUrl(`/repos/${owner}/${repo}/releases/latest`),
                requestHeaders,
                cancellationToken
            );

            if (!rawResponse) {
                return null;
            }

            const parsed = JSON.parse(rawResponse) as { tag_name?: string | null } | null;
            return parsed?.tag_name ?? null;
        } catch (error: unknown) {
            const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
                ? (error as { statusCode?: number }).statusCode
                : undefined;

            if (statusCode !== 404) {
                console.warn('Failed to query GitHub latest release endpoint for auto-update.', error);
            }

            return null;
        }
    };

    const tryResolveFromReleaseList = async (): Promise<string | null> => {
        try {
            const rawResponse = await this.httpRequest(
                buildApiUrl(`/repos/${owner}/${repo}/releases?per_page=15`),
                requestHeaders,
                cancellationToken
            );

            if (!rawResponse) {
                return null;
            }

            const releases = JSON.parse(rawResponse) as Array<{
                tag_name?: string | null;
                draft?: boolean | null;
                prerelease?: boolean | null;
            }>;

            for (const release of releases) {
                if (release?.tag_name && !release?.draft && !release?.prerelease) {
                    return release.tag_name;
                }
            }

            return null;
        } catch (error) {
            console.warn('Failed to query GitHub releases list for auto-update fallback.', error);
            return null;
        }
    };

    const latestTag = await tryResolveFromLatestEndpoint();
    if (latestTag) {
        return latestTag;
    }

    const fallbackTag = await tryResolveFromReleaseList();
    if (fallbackTag) {
        return fallbackTag;
    }

    console.warn('Falling back to the default electron-updater GitHub provider behaviour for tag resolution.');
    return originalGetLatestTagName.call(this, cancellationToken);
};

const originalChannelDescriptor = Object.getOwnPropertyDescriptor(GitHubProvider.prototype, 'channel');
if (originalChannelDescriptor?.get) {
    Object.defineProperty(GitHubProvider.prototype, 'channel', {
        get(this: GitHubProvider) {
            const forcedChannel = (this.updater as unknown as { __docforgeWindowsChannel?: string })?.__docforgeWindowsChannel;
            if (typeof forcedChannel === 'string' && forcedChannel.trim().length > 0) {
                try {
                    return this.getCustomChannelName(forcedChannel);
                } catch (error) {
                    console.warn('Failed to apply Windows-specific auto-update channel override. Falling back to default channel resolution.', error);
                }
            }

            return originalChannelDescriptor.get.call(this);
        },
    });
}

// --- Auto Updater Setup ---
// Note: For auto-updates to work, you need to configure `electron-builder` in package.json
// and sign your application.
autoUpdater.logger = log;
autoUpdater.autoDownload = true; // Enable auto-downloading of updates
autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version ?? info.releaseName ?? 'unknown version');
    mainWindow?.webContents.send('update:available', {
        version: info.version ?? null,
        releaseName: info.releaseName ?? null,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    });
});
autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
    });
});
autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version ?? info.releaseName ?? 'unknown version');
    mainWindow?.webContents.send('update:downloaded', {
        version: info.version ?? null,
        releaseName: info.releaseName ?? null,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    });
});
autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error);
    const { friendlyMessage, detailMessage } = buildUpdateErrorMessages(error);
    mainWindow?.webContents.send('update:error', { message: friendlyMessage, details: detailMessage });
    if (autoCheckEnabled) {
        console.log('Scheduling another automatic update check after a failure.');
        scheduleAutoUpdateCheck(5 * 60 * 1000);
    }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Use custom title bar on all platforms
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 13 }, // macOS specific
    webPreferences: {
      // Fix: Error on line 43 is resolved by declaring __dirname above.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false, // Don't show until ready
    backgroundColor: '#1a1a1a', // Match dark theme to avoid flash
  });
  
  // Load the index.html of the app.
  if (app.isPackaged) {
    // Fix: Error on line 54 is resolved by declaring __dirname above.
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:8080'); // Adjusted for esbuild serve common port
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Window state change events
  const sendWindowState = () => {
    if (mainWindow) {
      mainWindow.webContents.send('window:state-change', { isMaximized: mainWindow.isMaximized() });
    }
  };

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
}

app.on('ready', () => {
  try {
    databaseService.init();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('FATAL: Failed to initialize database.', error);
    // The renderer process will detect the failure when it tries to communicate
    // via IPC and will display the fatal error screen. We still create the window.
  }

  createWindow();

  try {
    const storedPreference = databaseService.getSetting('autoCheckForUpdates');
    if (typeof storedPreference === 'boolean') {
      autoCheckEnabled = storedPreference;
    } else if (typeof storedPreference !== 'undefined') {
      autoCheckEnabled = Boolean(storedPreference);
    }
  } catch (error) {
    console.error('Failed to read auto-update preference from settings:', error);
  }

  if (autoCheckEnabled) {
    scheduleAutoUpdateCheck();
  } else {
    console.log('Automatic update checks are disabled via settings.');
  }
});

app.on('window-all-closed', () => {
  databaseService.close();
  // Fix: Error on line 96 is resolved by importing 'platform' from 'process'.
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

// Database
ipcMain.handle('db:query', (_, sql, params) => databaseService.query(sql, params));
ipcMain.handle('db:get', (_, sql, params) => databaseService.get(sql, params));
ipcMain.handle('db:run', (_, sql, params) => databaseService.run(sql, params));
ipcMain.handle('db:is-new', () => databaseService.isNew());
ipcMain.handle('db:migrate-from-json', (_, data) => databaseService.migrateFromJson(data));
ipcMain.handle('db:duplicate-nodes', (_, nodeIds) => databaseService.duplicateNodes(nodeIds));
ipcMain.handle('db:insert-nodes-from-transfer', (_, payload, targetId, position) =>
  databaseService.insertNodesFromTransfer(payload, targetId, position)
);
ipcMain.handle('db:delete-versions', (_, documentId, versionIds) => databaseService.deleteVersions(documentId, versionIds));
ipcMain.handle('db:get-path', () => databaseService.getDbPath());
ipcMain.handle('db:load-from-path', (_, filePath: string) => databaseService.loadFromPath(filePath));
ipcMain.handle('db:create-new', async () => {
    if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
    }

    const defaultDirectory = path.join(app.getPath('documents'), 'DocForge');
    try {
        await fs.mkdir(defaultDirectory, { recursive: true });
    } catch (error) {
        console.warn('Failed to ensure default database directory exists.', error);
    }

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Create New DocForge Database',
        defaultPath: path.join(defaultDirectory, 'docforge.db'),
        buttonLabel: 'Create Database',
        filters: [
            { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
            { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['createDirectory', 'showHiddenFiles', 'dontAddToRecent'],
    });

    if (canceled || !filePath) {
        return { success: false, canceled: true };
    }

    let targetPath = filePath;
    if (!path.extname(targetPath)) {
        targetPath = `${targetPath}.db`;
    }

    try {
        await fs.stat(targetPath);
        return {
            success: false,
            error: 'A file already exists at the selected location. Please choose a different name for the new database.',
        };
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code && err.code !== 'ENOENT') {
            console.error('Failed to inspect target path for new database:', error);
            return {
                success: false,
                error: err.message || 'Unable to create a database at the selected location.',
            };
        }
    }

    const result = databaseService.loadFromPath(targetPath);
    if (!result.success) {
        console.error(`Failed to create database at ${targetPath}:`, result.error);
        return result;
    }

    const message = result.message ?? `Created new database at ${targetPath}`;
    return { ...result, message };
});
ipcMain.handle('db:select-and-load', async () => {
    if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select DocForge Database',
        properties: ['openFile'],
        filters: [
            { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    const [selectedPath] = filePaths;
    const result = databaseService.loadFromPath(selectedPath);
    if (!result.success) {
        console.error(`Failed to load database from ${selectedPath}:`, result.error);
    }
    return result;
});
ipcMain.handle('db:import-files', async (_, filesData, targetParentId) => {
    try {
        const result = databaseService.importFiles(filesData, targetParentId);
        return result;
    } catch (error) {
        console.error('File import failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to import files.' };
    }
});

ipcMain.handle('clipboard:read-text', async () => {
    try {
        const text = clipboard.readText();
        const formats = clipboard.availableFormats();
        const mimeType = formats.find(format => format.startsWith('text/')) ?? (text ? 'text/plain' : null);
        return { success: true, text, mimeType };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const normalized = message.toLowerCase();
        const errorCode = normalized.includes('denied') || normalized.includes('permission') ? 'permission-denied' : 'unexpected';
        return { success: false, error: message, errorCode };
    }
});

ipcMain.handle('db:backup', async () => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Compressed Database Backup',
        defaultPath: `docforge_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.db.gz`,
        filters: [{ name: 'Compressed Backup', extensions: ['gz'] }, { name: 'All Files', extensions: ['*'] }]
    });

    if (canceled || !filePath) {
        console.log('Database backup canceled by user.');
        return { success: true, message: 'Backup canceled by user.' };
    }

    const tempDbPath = path.join(os.tmpdir(), `docforge-temp-backup-${Date.now()}.db`);
    console.log(`Starting database backup to temporary file: ${tempDbPath}`);

    try {
        // 1. Backup to a temporary file
        await databaseService.backupDatabase(tempDbPath);
        console.log('Temporary backup file created successfully.');

        // 2. Gzip the temporary file to the final destination
        console.log(`Compressing backup to: ${filePath}`);
        const readStream = createReadStream(tempDbPath);
        const writeStream = createWriteStream(filePath);
        const gzip = zlib.createGzip();
        
        const pipeline = promisify(stream.pipeline);
        await pipeline(readStream, gzip, writeStream);

        console.log(`Successfully compressed backup to ${filePath}`);
        return { success: true, message: `Compressed backup saved to ${filePath}` };
    } catch (error) {
        console.error('Database backup and compression failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to save compressed backup.' };
    } finally {
        // 3. Clean up the temporary file
        try {
            await fs.unlink(tempDbPath);
            console.log(`Cleaned up temporary backup file: ${tempDbPath}`);
        } catch (cleanupError) {
            console.error(`Failed to clean up temporary backup file ${tempDbPath}:`, cleanupError);
            // Don't bubble this up to the user.
        }
    }
});

ipcMain.handle('db:integrity-check', async () => {
    try {
        const results = databaseService.runIntegrityCheck();
        return { success: true, results };
    } catch (error) {
        console.error('Integrity check failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run integrity check.' };
    }
});

ipcMain.handle('db:vacuum', async () => {
    try {
        databaseService.runVacuum();
        return { success: true };
    } catch (error) {
        console.error('Vacuum failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run vacuum.' };
    }
});

ipcMain.handle('db:get-stats', async () => {
    try {
        const stats = databaseService.getDatabaseStats();
        return { success: true, stats };
    } catch (error) {
        console.error('Failed to get DB stats:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to retrieve database statistics.' };
    }
});


// Legacy FS for migration
// Important: This path assumes a standard Electron userData structure.
// It navigates from the new app's userData to where the old app's data would be.
const getLegacyPath = (filename: string) => path.join(app.getPath('userData'), '..', 'PromptForge', filename);

ipcMain.handle('fs:legacy-file-exists', async (_, filename) => {
    try {
        await fs.access(getLegacyPath(filename));
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('fs:read-legacy-file', async (_, filename) => {
    try {
        const content = await fs.readFile(getLegacyPath(filename), 'utf-8');
        // Legacy data was just a JSON string in a file.
        return { success: true, data: content };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});


// App Info & Updates
ipcMain.handle('app:get-version', () => app.getVersion());
// Fix: Error on line 145 is resolved by importing 'platform' from 'process'.
ipcMain.handle('app:get-platform', () => platform);
ipcMain.handle('app:get-log-path', () => log.transports.file.getFile().path);

ipcMain.on('updater:set-allow-prerelease', (_, allow: boolean) => {
    autoUpdater.allowPrerelease = allow;
});
ipcMain.on('updater:set-auto-check-enabled', (_, enabled: boolean) => {
    autoCheckEnabled = enabled;
    if (enabled) {
        scheduleAutoUpdateCheck();
    } else {
        cancelScheduledAutoUpdateCheck();
    }
});
ipcMain.on('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.handle('updater:check-now', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        const updateInfo = result?.updateInfo;
        const version = updateInfo?.version ?? null;
        const releaseName = updateInfo?.releaseName ?? null;
        const currentVersion = app.getVersion();
        const updateAvailable = Boolean(version && version !== currentVersion);

        return {
            success: true,
            updateAvailable,
            version,
            releaseName,
        };
    } catch (error) {
        const { friendlyMessage, detailMessage } = buildUpdateErrorMessages(error);
        console.error('Manual update check failed:', error);
        return { success: false, error: friendlyMessage, details: detailMessage };
    }
});


// Window Controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window:close', () => mainWindow?.close());


// Dialogs
ipcMain.handle('dialog:save', async (_, options, content) => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
    if (canceled || !filePath) {
        return { success: false };
    }
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to save file.' };
    }
});

ipcMain.handle('nodes:export', async (_, content: string, options: { defaultFileName?: string } = {}) => {
    if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
    }

    const suggestedName = options.defaultFileName ?? `docforge-nodes-${new Date().toISOString().replace(/[:]/g, '-')}.dfnodes`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Nodes',
        defaultPath: suggestedName,
        filters: [
            { name: 'DocForge Node Export', extensions: ['dfnodes'] },
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (canceled || !filePath) {
        return { success: false };
    }

    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to save nodes export.' };
    }
});

ipcMain.handle('nodes:import', async () => {
    if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Nodes',
        filters: [
            { name: 'DocForge Node Export', extensions: ['dfnodes'] },
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) {
        return { success: false };
    }

    try {
        const content = await fs.readFile(filePaths[0], 'utf-8');
        return { success: true, content, path: filePaths[0] };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to read nodes export.' };
    }
});

ipcMain.handle('dialog:open', async (_, options) => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
    if (canceled || filePaths.length === 0) {
        return { success: false };
    }
    try {
        const content = await fs.readFile(filePaths[0], 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to read file.' };
    }
});

// Read packaged doc files
ipcMain.handle('docs:read', async (_, filename: string) => {
    try {
        const docPath = path.join(app.getAppPath(), 'docs', filename);
        const content = await fs.readFile(docPath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        console.error(`Failed to read doc: ${filename}`, error);
        return { success: false, error: error instanceof Error ? error.message : `Could not read ${filename}` };
    }
});

ipcMain.handle('plantuml:render-svg', async (_, diagram: string, format: 'svg' = 'svg') => {
    const trimmed = (diagram ?? '').trim();
    if (!trimmed) {
        return { success: false, error: 'Diagram content is empty.' };
    }

    if (format !== 'svg') {
        return { success: false, error: `Unsupported PlantUML format: ${format}` };
    }

    try {
        const jarPath = await resolvePlantUmlJar();

        return await new Promise<{ success: boolean; svg?: string; error?: string; details?: string }>((resolve) => {
            const child = spawn('java', ['-Djava.awt.headless=true', '-jar', jarPath, '-pipe', '-tsvg'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let svgOutput = '';
            let errorOutput = '';
            let resolved = false;

            const finalize = (payload: { success: boolean; svg?: string; error?: string; details?: string }) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(payload);
            };

            child.stdout.setEncoding('utf-8');
            child.stderr.setEncoding('utf-8');

            child.stdout.on('data', (chunk) => {
                svgOutput += chunk.toString();
            });

            child.stderr.on('data', (chunk) => {
                errorOutput += chunk.toString();
            });

            child.on('error', (err) => {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Failed to start the local PlantUML renderer process.';
                finalize({
                    success: false,
                    error: message,
                    details: errorOutput.trim() || undefined,
                });
            });

            child.on('close', (code) => {
                if (code === 0 && svgOutput.trim()) {
                    finalize({ success: true, svg: svgOutput });
                    return;
                }

                const exitDetails = errorOutput.trim();
                finalize({
                    success: false,
                    error: derivePlantumlFriendlyError(exitDetails, code ?? undefined),
                    details: exitDetails || (typeof code === 'number' ? `Renderer exited with code ${code}.` : undefined),
                });
            });

            child.stdin.on('error', (err) => {
                const message = err instanceof Error ? err.message : String(err);
                finalize({
                    success: false,
                    error: 'Failed to send diagram to the PlantUML renderer.',
                    details: message,
                });
            });

            child.stdin.end(trimmed);
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('PlantUML rendering failed:', error);
        return { success: false, error: message };
    }
});

let cachedPlantumlJarPath: string | null = null;
let plantumlJarLookupPromise: Promise<string> | null = null;

const PLANTUML_JAR_RELATIVE_PATH = path.join('assets', 'plantuml', 'plantuml.jar');

function derivePlantumlFriendlyError(details?: string | null, exitCode?: number): string {
    if (details) {
        const normalized = details.toLowerCase();

        if (normalized.includes('cannot run program') && normalized.includes('"dot"')) {
            return 'Graphviz (the "dot" executable) is required for the local PlantUML renderer. Install Graphviz or add it to your PATH.';
        }

        if (normalized.includes('graphviz') && normalized.includes('not found')) {
            return 'Graphviz binaries were not found. Install Graphviz to enable the local PlantUML renderer.';
        }

        if (normalized.includes('unsupportedclassversionerror')) {
            return 'The bundled PlantUML renderer requires a newer Java runtime. Update Java and try again.';
        }

        if (normalized.includes('could not find or load main class') || normalized.includes('classnotfoundexception')) {
            return 'The PlantUML renderer could not start. Ensure assets/plantuml/plantuml.jar is present and accessible.';
        }

        if (normalized.includes('permission denied')) {
            return 'The PlantUML renderer could not be executed because of missing file permissions.';
        }
    }

    if (typeof exitCode === 'number' && exitCode !== 0) {
        return `Local PlantUML renderer exited with code ${exitCode}.`;
    }

    return 'Local PlantUML renderer failed to produce output.';
}

function isPackagedAsarPath(filePath: string): boolean {
    return /\.asar($|[\\/])/.test(filePath);
}

async function ensurePlantumlJarExtracted(sourcePath: string): Promise<string> {
    if (!isPackagedAsarPath(sourcePath)) {
        return sourcePath;
    }

    const tempDir = path.join(app.getPath('temp'), 'docforge-plantuml');
    const destinationPath = path.join(tempDir, 'plantuml.jar');

    await fs.mkdir(tempDir, { recursive: true });

    let needsExtraction = true;
    try {
        const [sourceStats, destStats] = await Promise.all([fs.stat(sourcePath), fs.stat(destinationPath)]);
        if (sourceStats.size === destStats.size) {
            needsExtraction = false;
        }
    } catch {
        // Either the destination does not exist yet or we could not stat one of the files.
        needsExtraction = true;
    }

    if (!needsExtraction) {
        return destinationPath;
    }

    const pipeline = promisify(stream.pipeline);

    try {
        await pipeline(createReadStream(sourcePath), createWriteStream(destinationPath));
    } catch (error) {
        try {
            await fs.unlink(destinationPath);
        } catch {
            // Ignore cleanup failures; we'll retry extraction later if needed.
        }

        const message =
            error instanceof Error
                ? error.message
                : 'Failed to extract bundled PlantUML renderer from application archive.';
        throw new Error(`Unable to prepare PlantUML renderer: ${message}`);
    }

    return destinationPath;
}

async function resolvePlantUmlJar(): Promise<string> {
    if (cachedPlantumlJarPath) {
        return cachedPlantumlJarPath;
    }
    if (plantumlJarLookupPromise) {
        return plantumlJarLookupPromise;
    }

    const candidates = [
        path.join(app.getAppPath(), PLANTUML_JAR_RELATIVE_PATH),
        path.join(process.resourcesPath ?? '', PLANTUML_JAR_RELATIVE_PATH),
        path.join(__dirname, '..', PLANTUML_JAR_RELATIVE_PATH),
        path.join(__dirname, PLANTUML_JAR_RELATIVE_PATH),
    ].reduce<string[]>((paths, candidate) => {
        const normalized = path.normalize(candidate);
        if (!paths.includes(normalized)) {
            paths.push(normalized);
        }
        return paths;
    }, []);

    plantumlJarLookupPromise = (async () => {
        for (const candidate of candidates) {
            try {
                await fs.access(candidate);
                const usablePath = await ensurePlantumlJarExtracted(candidate);
                cachedPlantumlJarPath = usablePath;
                return usablePath;
            } catch {
                // Continue searching
            }
        }
        throw new Error(
            'Bundled PlantUML renderer is missing. Ensure assets/plantuml/plantuml.jar is included alongside the application.'
        );
    })();

    try {
        return await plantumlJarLookupPromise;
    } finally {
        plantumlJarLookupPromise = null;
    }
}

// Python environments & execution
ipcMain.handle('python:list-envs', async () => {
    return pythonManager.listEnvironments();
});

ipcMain.handle('python:detect-interpreters', async () => {
    return pythonManager.detectPythonInstallations();
});

ipcMain.handle('python:create-env', async (_, options) => {
    return pythonManager.createEnvironment(options);
});

ipcMain.handle('python:update-env', async (_, envId, updates) => {
    return pythonManager.updateEnvironment(envId, updates);
});

ipcMain.handle('python:delete-env', async (_, envId: string) => {
    await pythonManager.deleteEnvironment(envId);
    return { success: true };
});

ipcMain.handle('python:get-node-settings', async (_, nodeId: string) => {
    return pythonManager.getNodeSettings(nodeId);
});

ipcMain.handle('python:set-node-settings', async (_, nodeId: string, envId: string | null, autoDetect: boolean) => {
    return pythonManager.setNodeSettings(nodeId, envId, autoDetect);
});

ipcMain.handle('python:ensure-node-env', async (_, nodeId: string, defaults, interpreters) => {
    const resolvedInterpreters = Array.isArray(interpreters) && interpreters.length
        ? interpreters
        : await pythonManager.detectPythonInstallations();
    return pythonManager.ensureEnvironmentForNode(nodeId, defaults, resolvedInterpreters);
});

ipcMain.handle('python:run-script', async (_, payload) => {
    return pythonManager.runScript(payload);
});

ipcMain.handle('python:get-runs-for-node', async (_, nodeId: string, limit = 20) => {
    return pythonManager.getRunsForNode(nodeId, limit);
});

ipcMain.handle('python:get-run-logs', async (_, runId: string) => {
    return pythonManager.getRunLogs(runId);
});

ipcMain.handle('python:get-run', async (_, runId: string) => {
    return pythonManager.getRun(runId);
});

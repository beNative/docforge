// Fix: This file was previously a placeholder. This is the full implementation for the Electron main process.
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
// Fix: Import 'platform' from 'process' for type-safe access to the current OS identifier.
import { platform } from 'process';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { autoUpdater } from 'electron-updater';
import { databaseService } from './database';
import log from 'electron-log/main';
import * as zlib from 'zlib';
import * as os from 'os';
import * as stream from 'stream';
import { promisify } from 'util';

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

let mainWindow: BrowserWindow | null;

// --- Auto Updater Setup ---
// Note: For auto-updates to work, you need to configure `electron-builder` in package.json
// and sign your application.
autoUpdater.autoDownload = true; // Enable auto-downloading of updates
autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info.version);
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
  // Check for updates after window is created
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
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
ipcMain.handle('db:delete-versions', (_, documentId, versionIds) => databaseService.deleteVersions(documentId, versionIds));
ipcMain.handle('db:get-path', () => databaseService.getDbPath());
ipcMain.handle('db:import-files', async (_, filesData, targetParentId) => {
    try {
        const result = databaseService.importFiles(filesData, targetParentId);
        return result;
    } catch (error) {
        console.error('File import failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to import files.' };
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
ipcMain.on('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall();
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

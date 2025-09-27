// Fix: This file was previously a placeholder. This is the full implementation for the Electron main process.
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
// Fix: Import 'platform' from 'process' for type-safe access to the current OS identifier.
import { platform } from 'process';
import path from 'path';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';
import { databaseService } from './database';
import log from 'electron-log/main';

// Fix: Inform TypeScript about the __dirname global variable provided by Node.js, which is present in a CommonJS-like environment.
declare const __dirname: string;

// Note: The type declaration for process.resourcesPath has been moved to types.ts to centralize global augmentations.
// This empty block is kept to satisfy the original file structure but the augmentation now happens in types.ts.
declare global {
  namespace NodeJS {
    interface Process {
      // The `resourcesPath` property is augmented in `types.ts`
      // FIX: Add the type declaration here directly to resolve the build error for the main process.
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
        const docPath = app.isPackaged
            ? path.join(process.resourcesPath, 'docs', filename)
            : path.join(__dirname, '../../docs', filename);
        const content = await fs.readFile(docPath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        console.error(`Failed to read doc: ${filename}`, error);
        return { success: false, error: error instanceof Error ? error.message : `Could not read ${filename}` };
    }
});
// Fix: This file was previously a placeholder. This is the full implementation for the Electron main process.
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
// Fix: Import 'platform' from 'process' for type-safe access to the current OS identifier.
import { platform } from 'process';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { autoUpdater } from 'electron-updater';
import { databaseService } from './database';
import { pythonManager } from './pythonManager';
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

type PlantUmlGenerate = typeof import('node-plantuml')['generate'];

let plantumlGenerate: PlantUmlGenerate | null = null;
let resolvedPlantumlJarPath: string | null = null;
let plantumlInitializationError: string | null = null;
let plantumlResolutionWarningLogged = false;

const PLANTUML_RESOURCE_DIR = 'plantuml';

const buildPlantumlJarCandidates = (): string[] => {
  const candidates: string[] = [];

  if (process.env.PLANTUML_HOME) {
    candidates.push(process.env.PLANTUML_HOME);
  }

  candidates.push(path.join(process.resourcesPath, PLANTUML_RESOURCE_DIR, 'plantuml.jar'));

  try {
    const moduleRoot = path.dirname(require.resolve('node-plantuml/package.json'));
    candidates.push(path.join(moduleRoot, 'vendor', 'plantuml.jar'));
  } catch (error) {
    if (!plantumlResolutionWarningLogged) {
      console.warn('Unable to resolve node-plantuml package when locating PlantUML runtime.', error);
      plantumlResolutionWarningLogged = true;
    }
  }

  return candidates.filter((candidate, index, array) => candidate && array.indexOf(candidate) === index);
};

const ensurePlantumlRuntime = (): PlantUmlGenerate | null => {
  if (plantumlGenerate && resolvedPlantumlJarPath && existsSync(resolvedPlantumlJarPath)) {
    return plantumlGenerate;
  }

  const candidates = buildPlantumlJarCandidates();
  const jarPath = candidates.find((candidate) => existsSync(candidate)) ?? null;

  if (!jarPath) {
    plantumlInitializationError = `PlantUML runtime assets were not found. Checked: ${candidates.join(', ')}`;
    plantumlGenerate = null;
    resolvedPlantumlJarPath = null;
    return null;
  }

  process.env.PLANTUML_HOME = jarPath;
  resolvedPlantumlJarPath = jarPath;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('node-plantuml') as typeof import('node-plantuml');
    plantumlGenerate = module.generate;
    plantumlInitializationError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize PlantUML generator module.', error);
    plantumlGenerate = null;
    plantumlInitializationError = message;
  }

  return plantumlGenerate;
};

const formatPlantumlTroubleshootingDetails = (
  ...messages: Array<string | null | undefined>
): string => {
  const parts: string[] = [];

  for (const message of messages) {
    if (typeof message === 'string') {
      const trimmed = message.trim();
      if (trimmed && !parts.includes(trimmed)) {
        parts.push(trimmed);
      }
    }
  }

  if (resolvedPlantumlJarPath) {
    const jarMessage = `Resolved PlantUML jar: ${resolvedPlantumlJarPath}`;
    if (!parts.includes(jarMessage)) {
      parts.push(jarMessage);
    }
  }

  const fallback = 'Ensure Java is installed and restart DocForge, or switch back to the remote renderer in Settings.';
  if (!parts.includes(fallback)) {
    parts.push(fallback);
  }

  return parts.join('\n');
};

const isReadableStream = (candidate: unknown): candidate is stream.Readable => {
  return !!candidate
    && typeof (candidate as stream.Readable).on === 'function'
    && typeof (candidate as stream.Readable).setEncoding === 'function'
    && typeof (candidate as stream.Readable).removeAllListeners === 'function';
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

ipcMain.handle('plantuml:render-svg', async (_, diagram: string, format: 'svg' = 'svg') => {
    const trimmed = (diagram ?? '').trim();
    if (!trimmed) {
        return { success: false, error: 'Diagram content is empty.' };
    }

    if (format !== 'svg') {
        return { success: false, error: `Unsupported PlantUML format: ${format}` };
    }

    try {
        const generatorFn = ensurePlantumlRuntime();
        if (!generatorFn) {
            return {
                success: false,
                error: 'Local PlantUML renderer could not be initialized.',
                details: formatPlantumlTroubleshootingDetails(plantumlInitializationError),
            };
        }

        const generator = generatorFn(trimmed, { format: 'svg' });

        if (!generator || !isReadableStream(generator.out) || !isReadableStream(generator.err)) {
            console.error('PlantUML renderer returned unexpected streams. Local renderer may be unavailable.');
            return {
                success: false,
                error: 'Local PlantUML renderer is unavailable.',
                details: formatPlantumlTroubleshootingDetails(plantumlInitializationError),
            };
        }

        const { out, err } = generator;
        out.setEncoding('utf-8');
        err.setEncoding('utf-8');

        return await new Promise<{ success: boolean; svg?: string; error?: string; details?: string }>((resolve) => {
            let svgOutput = '';
            let errorOutput = '';

            const cleanup = () => {
                out.removeAllListeners();
                err.removeAllListeners();
            };

            const resolveWithError = (message: string) => {
                cleanup();
                resolve({
                    success: false,
                    error: message,
                    details: formatPlantumlTroubleshootingDetails(errorOutput.trim() || plantumlInitializationError),
                });
            };

            err.on('data', (chunk) => {
                errorOutput += chunk.toString();
            });

            out.on('data', (chunk) => {
                svgOutput += chunk.toString();
            });

            out.on('end', () => {
                cleanup();
                if (svgOutput.trim()) {
                    resolve({ success: true, svg: svgOutput });
                } else {
                    resolve({
                        success: false,
                        error: 'PlantUML renderer produced no SVG output.',
                        details: formatPlantumlTroubleshootingDetails(errorOutput.trim() || plantumlInitializationError),
                    });
                }
            });

            out.on('error', (streamError) => {
                const message = streamError instanceof Error ? streamError.message : String(streamError);
                resolveWithError(message);
            });

            err.on('error', (streamError) => {
                const message = streamError instanceof Error ? streamError.message : String(streamError);
                resolveWithError(message);
            });
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('PlantUML rendering failed:', error);
        return {
            success: false,
            error: message,
            details: formatPlantumlTroubleshootingDetails(plantumlInitializationError),
        };
    }
});

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


import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';
import { DatabaseService } from './database';

let mainWindow: BrowserWindow | null = null;
const dbService = new DatabaseService();

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: isMac ? 'hidden' : 'hidden',
        trafficLightPosition: { x: 15, y: 15 },
        show: false,
        backgroundColor: '#1a1a1a', // Match dark theme to avoid flash
    });
    
    // In production, load the index.html file. In development, you might use a dev server.
    // The esbuild config suggests a file-based approach.
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        autoUpdater.checkForUpdatesAndNotify();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // Window state change events
    const sendWindowState = () => {
        if (mainWindow) {
            mainWindow.webContents.send('window:state-change', {
                isMaximized: mainWindow.isMaximized(),
            });
        }
    };
    mainWindow.on('maximize', sendWindowState);
    mainWindow.on('unmaximize', sendWindowState);
}

// Basic menu for copy/paste etc.
const menuTemplate: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    ...(isMac ? [{
        label: app.name,
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }] : []) as Electron.MenuItemConstructorOptions[],
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac ? [
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Speech',
                    submenu: [
                        { role: 'startSpeaking' },
                        { role: 'stopSpeaking' }
                    ]
                }
            ] : [
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]) as Electron.MenuItemConstructorOptions[]
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
        ]
    }
];
Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));


app.on('ready', async () => {
    await dbService.init();
    createWindow();
});

app.on('window-all-closed', () => {
    if (!isMac) {
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
ipcMain.handle('db:query', (_, sql, params) => dbService.query(sql, params));
ipcMain.handle('db:get', (_, sql, params) => dbService.get(sql, params));
ipcMain.handle('db:run', (_, sql, params) => dbService.run(sql, params));
ipcMain.handle('db:is-new', () => dbService.isNew());
ipcMain.handle('db:migrate-from-json', (_, data) => dbService.migrateFromJson(data));

// App Info & Updates
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-platform', () => process.platform);

autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info.version);
});
ipcMain.on('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.on('updater:set-allow-prerelease', (_, allow) => {
    autoUpdater.allowPrerelease = allow;
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
    const { filePath } = await dialog.showSaveDialog(mainWindow, options);
    if (filePath) {
        try {
            await fs.writeFile(filePath, content, 'utf8');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
    return { success: false, error: 'Save dialog cancelled' };
});

ipcMain.handle('dialog:open', async (_, options) => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { filePaths } = await dialog.showOpenDialog(mainWindow, options);
    if (filePaths && filePaths.length > 0) {
        try {
            const content = await fs.readFile(filePaths[0], 'utf8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
    return { success: false, error: 'Open dialog cancelled' };
});

// FS Access (Legacy and Docs)
const userDataPath = app.getPath('userData');
ipcMain.handle('fs:legacy-file-exists', async (_, filename) => {
    try {
        await fs.access(path.join(userDataPath, filename));
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('fs:read-legacy-file', async (_, filename) => {
    try {
        const data = await fs.readFile(path.join(userDataPath, filename), 'utf8');
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle('docs:read', async (_, filename) => {
    try {
        // In a packaged app, files are in the resources directory. In dev, they're in the project root.
        const basePath = isDev ? process.cwd() : process.resourcesPath;
        const docPath = path.join(basePath, 'docs', filename);
        const content = await fs.readFile(docPath, 'utf8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

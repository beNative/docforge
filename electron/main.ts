import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { databaseService } from './database';
import { autoUpdater } from 'electron-updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 13 },
    backgroundColor: '#1e1e1e', // Match dark theme to avoid flash
  });

  // The esbuild config outputs to `dist`. In dev mode with `--watch`, it rebuilds there.
  // We assume index.html is copied to `dist` as part of the build process.
  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:state-change', { isMaximized: true }));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:state-change', { isMaximized: false }));

  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
};

app.whenReady().then(() => {
  try {
    databaseService.open();
  } catch (e) {
    console.error('FATAL: Could not open database. App will close.', e);
    dialog.showErrorBox('Database Error', 'Could not open the application database. See logs for details. The application will now close.');
    app.quit();
    return;
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  databaseService.close();
});

// --- IPC Handlers ---

// Database
ipcMain.handle('db:query', (_, sql, params) => databaseService.query(sql, params));
ipcMain.handle('db:get', (_, sql, params) => databaseService.get(sql, params));
ipcMain.handle('db:run', (_, sql, params) => databaseService.run(sql, params));
ipcMain.handle('db:is-new', () => databaseService.isNew);

ipcMain.handle('db:migrate-from-json', async (_, data) => {
    try {
        const { nodes, documents, docVersions, contentStore, templates, settings } = data;
        
        // Manual transaction control
        databaseService.run('BEGIN');
        try {
            // Clear tables
            ['nodes', 'documents', 'doc_versions', 'content_store', 'templates', 'settings'].forEach(table => {
                databaseService.run(`DELETE FROM ${table}`);
            });
            
            // Content Store
            const contentIdMap = new Map<string, number | bigint>();
            for (const content of contentStore) {
                const res = databaseService.run('INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)', [content.sha256_hex, content.text_content]);
                contentIdMap.set(content.sha256_hex, res.lastInsertRowid);
            }
            
            // Nodes
            for (const node of nodes) {
                databaseService.run('INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [node.node_id, node.parent_id, node.node_type, node.title, node.sort_order, node.created_at, node.updated_at]);
            }
            
            // Documents
            const docIdMap = new Map<string, number | bigint>();
            for (const doc of documents) {
                const res = databaseService.run('INSERT INTO documents (node_id, doc_type, language_hint) VALUES (?, ?, ?)', [doc.node_id, doc.doc_type, doc.language_hint]);
                docIdMap.set(doc.node_id, res.lastInsertRowid);
            }
            
            // Versions
            const versionsByNode = docVersions.reduce((acc: Record<string, any[]>, version: any) => {
                if (!acc[version.node_id]) acc[version.node_id] = [];
                acc[version.node_id].push(version);
                return acc;
            }, {});

            for (const nodeId in versionsByNode) {
                const nodeVersions = versionsByNode[nodeId].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                let latestVersionId: number | bigint | null = null;
                const documentId = docIdMap.get(nodeId);
                
                if (documentId) {
                    for (const version of nodeVersions) {
                        const contentId = contentIdMap.get(version.sha256_hex);
                        if (contentId) {
                            const res = databaseService.run('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)', [documentId, version.created_at, contentId]);
                            if (!latestVersionId) {
                                latestVersionId = res.lastInsertRowid;
                            }
                        }
                    }
                    if (latestVersionId) {
                        databaseService.run('UPDATE documents SET current_version_id = ? WHERE document_id = ?', [latestVersionId, documentId]);
                    }
                }
            }
            
            // Templates
            for (const t of templates) {
                databaseService.run('INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [t.template_id, t.title, t.content, t.created_at, t.updated_at]);
            }
            
            // Settings
            for (const s of settings) {
                databaseService.run('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
            }
            
            databaseService.run('COMMIT');
            return { success: true };
        } catch (error) {
            databaseService.run('ROLLBACK');
            throw error; // Re-throw to be caught by the outer catch block
        }
    } catch (error) {
        console.error("Migration from JSON failed in main process:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

// FS Handlers
ipcMain.handle('fs:legacy-file-exists', async (_, filename) => {
    // FIX: Move this call inside the handler to ensure it runs after app is ready.
    const userDataPath = app.getPath('userData');
    try {
        await fs.promises.access(path.join(userDataPath, `${filename}.json`));
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('fs:read-legacy-file', async (_, filename) => {
    // FIX: Move this call inside the handler to ensure it runs after app is ready.
    const userDataPath = app.getPath('userData');
    try {
        const content = await fs.promises.readFile(path.join(userDataPath, `${filename}.json`), 'utf-8');
        return { success: true, data: content };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

// App Info
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-platform', () => process.platform);

// Updater
autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info.version);
});
ipcMain.on('updater:set-allow-prerelease', (_, allow) => { autoUpdater.allowPrerelease = allow; });
ipcMain.on('updater:quit-and-install', () => { autoUpdater.quitAndInstall(); });

// Window Controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
ipcMain.on('window:close', () => mainWindow?.close());

// Dialogs & Docs
ipcMain.handle('dialog:save', async (_, options, content) => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
    if (!canceled && filePath) {
        try {
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    return { success: false, error: 'Save dialog canceled' };
});

ipcMain.handle('dialog:open', async (_, options) => {
    if (!mainWindow) return { success: false, error: 'Main window not available' };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options);
    if (!canceled && filePaths.length > 0) {
        try {
            const content = await fs.promises.readFile(filePaths[0], 'utf-8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    return { success: false, error: 'Open dialog canceled' };
});

ipcMain.handle('docs:read', async (_, filename) => {
    try {
        const basePath = isDev ? process.cwd() : (process as any).resourcesPath;
        const docPath = path.join(basePath, filename);
        const content = await fs.promises.readFile(docPath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: `Could not read doc file ${filename}: ${error instanceof Error ? error.message : String(error)}` };
    }
});
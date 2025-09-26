import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';
import { platform } from 'os';
import { databaseService } from './database';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:state-change', { isMaximized: true }));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:state-change', { isMaximized: false }));

  mainWindow.loadFile(path.join(__dirname, '../index.html'));
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

autoUpdater.logger = console;
autoUpdater.on('update-downloaded', (info) => {
  console.log(`Update downloaded: ${info.version}. Notifying renderer.`);
  mainWindow?.webContents.send('update:downloaded', info.version);
});

ipcMain.on('updater:set-allow-prerelease', (_, allow: boolean) => {
  autoUpdater.allowPrerelease = allow;
});
ipcMain.on('updater:quit-and-install', () => autoUpdater.quitAndInstall());

app.on('window-all-closed', () => {
  if (platform() !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  databaseService.close();
});

app.whenReady().then(() => {
  // Initialize the database
  try {
    databaseService.open();
  } catch (error) {
    console.error("Fatal: Could not initialize database. The application will close.");
    dialog.showErrorBox("Database Error", "Failed to initialize the application database. Please check file permissions or try reinstalling.");
    app.quit();
    return;
  }

  // Set up IPC handlers
  setupIpcHandlers();

  createWindow();

  // Handle auto-updater based on initial settings from DB
  try {
    const prereleaseSetting = databaseService.get("SELECT value FROM settings WHERE key = 'allowPrerelease'");
    autoUpdater.allowPrerelease = prereleaseSetting?.value === 'true';
    console.log(`Initial updater allowPrerelease set to: ${autoUpdater.allowPrerelease}`);
  } catch(e) {
    console.log("Could not read initial prerelease setting, defaulting to false.");
    autoUpdater.allowPrerelease = false;
  }

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function setupIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => platform());

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  ipcMain.handle('db:query', (_, sql, params) => databaseService.query(sql, params));
  ipcMain.handle('db:get', (_, sql, params) => databaseService.get(sql, params));
  ipcMain.handle('db:run', (_, sql, params) => databaseService.run(sql, params));
  ipcMain.handle('db:is-new', () => databaseService.isNew);

  ipcMain.handle('db:migrate-from-json', (_, data) => {
    console.log("Starting migration from JSON data...");
    const { nodes, documents, docVersions, contentStore, templates, settings } = data;
    
    const migrationTransaction = databaseService.transaction(() => {
        const insertNode = databaseService.run.bind(databaseService, "INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const insertDoc = databaseService.run.bind(databaseService, "INSERT INTO documents (node_id, doc_type, language_hint) VALUES (?, ?, ?)");
        const insertContent = databaseService.run.bind(databaseService, "INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)");
        const insertVersion = databaseService.run.bind(databaseService, "INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)");
        const updateDocVersion = databaseService.run.bind(databaseService, "UPDATE documents SET current_version_id = ? WHERE document_id = ?");
        const insertTemplate = databaseService.run.bind(databaseService, "INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
        const insertSetting = databaseService.run.bind(databaseService, "INSERT INTO settings (key, value) VALUES (?, ?)");
        const getContentId = databaseService.get.bind(databaseService, "SELECT content_id FROM content_store WHERE sha256_hex = ?");
        
        for (const content of contentStore) {
            insertContent([content.sha256_hex, content.text_content]);
        }
        for (const node of nodes) {
            insertNode([node.node_id, node.parent_id, node.node_type, node.title, node.sort_order, node.created_at, node.updated_at]);
        }
        for (const doc of documents) {
            const result = insertDoc([doc.node_id, doc.doc_type, doc.language_hint]);
            const documentId = result.lastInsertRowid;

            const versionsForThisDoc = docVersions.filter(v => v.node_id === doc.node_id);
            let latestVersionId: number | null = null;

            for (const version of versionsForThisDoc) {
                const content = getContentId([version.sha256_hex]);
                const versionResult = insertVersion([documentId, version.created_at, content.content_id]);
                if (latestVersionId === null) { // The first one we insert is the latest
                    latestVersionId = Number(versionResult.lastInsertRowid);
                }
            }
            if(latestVersionId) {
                updateDocVersion([latestVersionId, documentId]);
            }
        }
        for (const template of templates) {
            insertTemplate([template.template_id, template.title, template.content, template.created_at, template.updated_at]);
        }
        for (const setting of settings) {
            insertSetting([setting.key, setting.value]);
        }
    });

    try {
        migrationTransaction();
        console.log("JSON migration successful.");
        // Rename old files to prevent re-migration
        const userDataPath = app.getPath('userData');
        const oldFiles = [
            'promptforge_prompts.json', 'promptforge_templates.json', 
            'promptforge_prompt_versions.json', 'promptforge_settings.json'
        ];
        for (const file of oldFiles) {
            const oldPath = path.join(userDataPath, file);
            const newPath = path.join(userDataPath, `${file}.bak`);
            fs.rename(oldPath, newPath).catch(err => console.error(`Could not rename ${file}:`, err));
        }
        return { success: true };
    } catch (error) {
        console.error("JSON migration failed:", error);
        return { success: false, error: (error as Error).message };
    }
  });

  // --- File System Access for Legacy JSON files (Migration Only) ---
  const legacyDataPath = (filename: string) => path.join(app.getPath('userData'), filename);
  
  ipcMain.handle('fs:legacy-file-exists', async (_, filename: string) => {
    try {
        await fs.access(legacyDataPath(filename));
        return true;
    } catch {
        return false;
    }
  });

  ipcMain.handle('fs:read-legacy-file', async (_, filename: string) => {
    try {
      const data = await fs.readFile(legacyDataPath(filename), 'utf-8');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Handlers for dialogs and file I/O
  // Fix: Replaced Electron.SaveDialogOptions with `any` to resolve missing namespace error.
  ipcMain.handle('dialog:save', async (_, options: any, content: string) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { success: false, error: 'No focused window' };
    const { canceled, filePath } = await dialog.showSaveDialog(window, options);
    if (canceled || !filePath) return { success: false, error: 'Dialog was canceled.' };
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Fix: Replaced Electron.OpenDialogOptions with `any` to resolve missing namespace error.
  ipcMain.handle('dialog:open', async (_, options: any) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return { success: false, error: 'No focused window' };
    const { canceled, filePaths } = await dialog.showOpenDialog(window, options);
    if (canceled || filePaths.length === 0) return { success: false, error: 'Dialog was canceled.' };
    try {
      const content = await fs.readFile(filePaths[0], 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  ipcMain.handle('docs:read', async (_, filename: string) => {
    try {
      const filePath = isDev ? path.join(app.getAppPath(), filename) : path.join((process as any).resourcesPath, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
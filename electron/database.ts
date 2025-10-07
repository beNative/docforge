import { app } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs, { statSync } from 'fs';
import Database from 'better-sqlite3';
import { INITIAL_SCHEMA } from './schema';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
// Fix: Import types to use for casting
import type {
  Node,
  Document,
  DocVersion,
  DatabaseStats,
  DocType,
  ViewMode,
  ImportedNodeSummary,
  WorkspaceInfo,
  WorkspaceConnectionEvent,
} from '../types';

type WorkspaceRecord = {
  workspaceId: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
};

type NodePythonSettingsRow = {
  node_id: string;
  env_id: string | null;
  auto_detect_env: number;
  last_run_id: string | null;
  updated_at: string;
};

type TransferDocVersionRow = DocVersion & {
  sha256_hex: string;
  text_content: string | null;
  blob_content: Buffer | null;
};

type TransferNode = {
  node: Node;
  document?: (Document & { versions: TransferDocVersionRow[] });
  pythonSettings?: NodePythonSettingsRow;
  children: TransferNode[];
};

type WorkspaceConnectionEntry = {
  workspaceId: string;
  connection: Database.Database;
  openedAt: string;
};

const serviceEvents = new EventEmitter();
const connectionRegistry = new Map<string, WorkspaceConnectionEntry>();

let workspaceRecords: WorkspaceRecord[] = [];
let activeWorkspaceId: string | null = null;

const WORKSPACE_DIRECTORY = path.join(app.getPath('userData'), 'workspaces');
const WORKSPACE_METADATA_FILE = path.join(WORKSPACE_DIRECTORY, 'workspaces.json');
const DEFAULT_WORKSPACE_NAME = 'Main Workspace';

const DOCUMENT_SEARCH_OBJECTS_SQL = `
  DROP TRIGGER IF EXISTS document_search_after_document_insert;
  DROP TRIGGER IF EXISTS document_search_after_document_update;
  DROP TRIGGER IF EXISTS document_search_after_document_delete;
  DROP TRIGGER IF EXISTS document_search_after_node_title_update;
  DROP TABLE IF EXISTS document_search;
  CREATE VIRTUAL TABLE document_search USING fts5(
    document_id UNINDEXED,
    node_id UNINDEXED,
    title,
    body
  );
  CREATE TRIGGER document_search_after_document_insert
  AFTER INSERT ON documents
  BEGIN
    INSERT INTO document_search(rowid, document_id, node_id, title, body)
    VALUES (
      new.document_id,
      new.document_id,
      new.node_id,
      (SELECT title FROM nodes WHERE node_id = new.node_id),
      COALESCE((
        SELECT cs.text_content
        FROM doc_versions dv
        JOIN content_store cs ON dv.content_id = cs.content_id
        WHERE dv.version_id = new.current_version_id
      ), '')
    );
  END;
  CREATE TRIGGER document_search_after_document_update
  AFTER UPDATE OF current_version_id ON documents
  BEGIN
    DELETE FROM document_search WHERE rowid = new.document_id;
    INSERT INTO document_search(rowid, document_id, node_id, title, body)
    VALUES (
      new.document_id,
      new.document_id,
      new.node_id,
      (SELECT title FROM nodes WHERE node_id = new.node_id),
      COALESCE((
        SELECT cs.text_content
        FROM doc_versions dv
        JOIN content_store cs ON dv.content_id = cs.content_id
        WHERE dv.version_id = new.current_version_id
      ), '')
    );
  END;
  CREATE TRIGGER document_search_after_document_delete
  AFTER DELETE ON documents
  BEGIN
    DELETE FROM document_search WHERE rowid = old.document_id;
  END;
  CREATE TRIGGER document_search_after_node_title_update
  AFTER UPDATE OF title ON nodes
  WHEN new.node_type = 'document'
  BEGIN
    DELETE FROM document_search
    WHERE rowid = (
      SELECT document_id FROM documents WHERE node_id = new.node_id
    );
    INSERT INTO document_search(rowid, document_id, node_id, title, body)
    SELECT
      d.document_id,
      d.document_id,
      d.node_id,
      new.title,
      COALESCE(cs.text_content, '')
    FROM documents d
    LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
    LEFT JOIN content_store cs ON dv.content_id = cs.content_id
    WHERE d.node_id = new.node_id;
  END;
`;

const populateDocumentSearch = (connection: Database.Database) => {
  connection.exec('DELETE FROM document_search;');
  connection.exec(`
    INSERT INTO document_search(rowid, document_id, node_id, title, body)
    SELECT
      d.document_id,
      d.document_id,
      d.node_id,
      n.title,
      COALESCE(cs.text_content, '')
    FROM documents d
    JOIN nodes n ON d.node_id = n.node_id
    LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
    LEFT JOIN content_store cs ON dv.content_id = cs.content_id;
  `);
};

const ensureWorkspaceDirectory = () => {
  if (!fs.existsSync(WORKSPACE_DIRECTORY)) {
    fs.mkdirSync(WORKSPACE_DIRECTORY, { recursive: true });
  }
};

const getWorkspaceDbPath = (workspace: WorkspaceRecord): string =>
  path.join(WORKSPACE_DIRECTORY, workspace.fileName);

const loadWorkspaceMetadata = (): WorkspaceRecord[] => {
  if (!fs.existsSync(WORKSPACE_METADATA_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(WORKSPACE_METADATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as WorkspaceRecord[];
    return parsed.map(record => ({
      workspaceId: record.workspaceId,
      name: record.name,
      fileName: record.fileName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastOpenedAt: record.lastOpenedAt ?? null,
    }));
  } catch (error) {
    console.warn('Failed to read workspace metadata, starting with empty list.', error);
    return [];
  }
};

const persistWorkspaceMetadata = () => {
  ensureWorkspaceDirectory();
  try {
    fs.writeFileSync(
      WORKSPACE_METADATA_FILE,
      JSON.stringify(workspaceRecords, null, 2),
      'utf-8',
    );
  } catch (error) {
    console.error('Failed to persist workspace metadata:', error);
  }
};

const toWorkspaceInfo = (record: WorkspaceRecord): WorkspaceInfo => ({
  workspaceId: record.workspaceId,
  name: record.name,
  filePath: getWorkspaceDbPath(record),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  lastOpenedAt: record.lastOpenedAt,
  isActive: activeWorkspaceId === record.workspaceId,
  isOpen: connectionRegistry.has(record.workspaceId),
});

const selectWorkspaceToOpen = (): WorkspaceRecord | null => {
  if (workspaceRecords.length === 0) {
    return null;
  }

  const sorted = [...workspaceRecords].sort((a, b) => {
    if (a.lastOpenedAt && b.lastOpenedAt) {
      return a.lastOpenedAt > b.lastOpenedAt ? -1 : 1;
    }
    if (a.lastOpenedAt) return -1;
    if (b.lastOpenedAt) return 1;
    return a.createdAt > b.createdAt ? -1 : 1;
  });

  return sorted[0];
};

const getWorkspaceRecordOrThrow = (workspaceId: string): WorkspaceRecord => {
  const record = workspaceRecords.find(item => item.workspaceId === workspaceId);
  if (!record) {
    throw new Error(`Workspace with id ${workspaceId} was not found.`);
  }
  return record;
};

const emitWorkspaceEvent = (event: WorkspaceConnectionEvent['type'], record: WorkspaceRecord) => {
  const info = toWorkspaceInfo(record);
  serviceEvents.emit(event, info);
  serviceEvents.emit('workspace-event', { type: event, workspace: info });
};

const registerWorkspaceConnection = (workspace: WorkspaceRecord): Database.Database => {
  const existing = connectionRegistry.get(workspace.workspaceId);
  if (existing) {
    return existing.connection;
  }

  const connection = openWorkspaceConnection(workspace);
  connectionRegistry.set(workspace.workspaceId, {
    workspaceId: workspace.workspaceId,
    connection,
    openedAt: new Date().toISOString(),
  });

  emitWorkspaceEvent('workspace-opened', workspace);
  return connection;
};

const disposeWorkspaceConnection = (workspaceId: string) => {
  const entry = connectionRegistry.get(workspaceId);
  if (!entry) {
    return;
  }

  const workspace = getWorkspaceRecordOrThrow(workspaceId);

  try {
    entry.connection.close();
  } catch (error) {
    console.warn('Failed to close workspace connection:', error);
  }

  connectionRegistry.delete(workspaceId);
  emitWorkspaceEvent('workspace-closed', workspace);
};

const resolveConnection = (workspaceId?: string): { connection: Database.Database; workspace: WorkspaceRecord } => {
  const id = workspaceId ?? activeWorkspaceId;
  if (!id) {
    throw new Error('No active workspace is selected.');
  }

  const workspace = getWorkspaceRecordOrThrow(id);
  const existing = connectionRegistry.get(id);
  if (existing) {
    return { connection: existing.connection, workspace };
  }

  const connection = registerWorkspaceConnection(workspace);
  return { connection, workspace };
};

const reopenWorkspaceConnection = (workspaceId: string): Database.Database => {
  const workspace = getWorkspaceRecordOrThrow(workspaceId);
  disposeWorkspaceConnection(workspaceId);
  return registerWorkspaceConnection(workspace);
};

const closeAllConnections = () => {
  for (const workspaceId of Array.from(connectionRegistry.keys())) {
    disposeWorkspaceConnection(workspaceId);
  }
};

const withConnection = <T>(
  workspaceId: string | undefined,
  callback: (connection: Database.Database, workspace: WorkspaceRecord) => T,
): T => {
  const { connection, workspace } = resolveConnection(workspaceId);
  return callback(connection, workspace);
};

const prepareDatabaseConnection = (connection: Database.Database, isNew: boolean) => {
  if (isNew) {
    console.log('Database does not exist, creating new one...');
    connection.exec(INITIAL_SCHEMA);
    connection.pragma('user_version = 3');
    connection.exec('PRAGMA journal_mode = WAL;');
    connection.exec('PRAGMA foreign_keys = ON;');
    console.log('Database created and schema applied.');
    return;
  }

  console.log('Existing database found.');
  connection.exec('PRAGMA journal_mode = WAL;');
  connection.exec('PRAGMA foreign_keys = ON;');

  let currentVersion = connection.pragma('user_version', { simple: true }) as number;
  if (currentVersion < 1) {
    console.log(`Migrating schema from version ${currentVersion} to 1...`);
    try {
      const transaction = connection.transaction(() => {
        const columns = connection.prepare("PRAGMA table_info(documents)").all() as {name: string}[];
        const hasColumn = columns.some(col => col.name === 'default_view_mode');
        if (!hasColumn) {
          connection.exec('ALTER TABLE documents ADD COLUMN default_view_mode TEXT');
        }
        connection.pragma('user_version = 1');
      });
      transaction();
      currentVersion = 1;
      console.log('Migration to version 1 complete.');
    } catch (e) {
      console.error('Fatal: Failed to migrate database to version 1:', e);
    }
  }

  if (currentVersion < 2) {
    console.log(`Migrating schema from version ${currentVersion} to 2...`);
    try {
      const transaction = connection.transaction(() => {
        connection.exec(`
          CREATE TABLE IF NOT EXISTS python_environments (
            env_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            python_executable TEXT NOT NULL,
            python_version TEXT NOT NULL,
            managed INTEGER NOT NULL DEFAULT 1,
            config_json TEXT NOT NULL,
            working_directory TEXT,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        connection.exec(`
          CREATE TABLE IF NOT EXISTS python_execution_runs (
            run_id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
            env_id TEXT REFERENCES python_environments(env_id) ON DELETE SET NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            exit_code INTEGER,
            error_message TEXT,
            duration_ms INTEGER
          );
        `);

        connection.exec(`
          CREATE TABLE IF NOT EXISTS python_execution_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL REFERENCES python_execution_runs(run_id) ON DELETE CASCADE,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL
          );
        `);

        connection.exec(`
          CREATE TABLE IF NOT EXISTS node_python_settings (
            node_id TEXT PRIMARY KEY REFERENCES nodes(node_id) ON DELETE CASCADE,
            env_id TEXT REFERENCES python_environments(env_id) ON DELETE SET NULL,
            auto_detect_env INTEGER NOT NULL DEFAULT 1,
            last_run_id TEXT REFERENCES python_execution_runs(run_id) ON DELETE SET NULL,
            updated_at TEXT NOT NULL
          );
        `);

        connection.exec('CREATE INDEX IF NOT EXISTS idx_python_runs_node ON python_execution_runs(node_id);');
        connection.exec('CREATE INDEX IF NOT EXISTS idx_python_runs_env ON python_execution_runs(env_id);');
        connection.exec('CREATE INDEX IF NOT EXISTS idx_python_logs_run ON python_execution_logs(run_id);');

        connection.pragma('user_version = 2');
      });
      transaction();
      currentVersion = 2;
      console.log('Migration to version 2 complete.');
    } catch (e) {
      console.error('Fatal: Failed to migrate database to version 2:', e);
    }
  }

  if (currentVersion < 3) {
    console.log(`Migrating schema from version ${currentVersion} to 3...`);
    try {
      const transaction = connection.transaction(() => {
        connection.exec(DOCUMENT_SEARCH_OBJECTS_SQL);
        populateDocumentSearch(connection);
        connection.pragma('user_version = 3');
      });
      transaction();
      console.log('Migration to version 3 complete.');
    } catch (e) {
      console.error('Fatal: Failed to migrate database to version 3:', e);
    }
  }
};

const openWorkspaceConnection = (workspace: WorkspaceRecord): Database.Database => {
  ensureWorkspaceDirectory();
  const dbPath = getWorkspaceDbPath(workspace);
  const dbExists = fs.existsSync(dbPath);
  const connection = new Database(dbPath);
  prepareDatabaseConnection(connection, !dbExists);
  return connection;
};

// Helper function from languageService.ts, now inside database.ts to avoid cross-context dependencies
const mapExtensionToLanguageId_local = (extension: string | null): string => {
    if (!extension) return 'plaintext';
    switch (extension.toLowerCase()) {
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'html': case 'htm': return 'html';
        case 'css': return 'css';
        case 'json': return 'json';
        case 'md': case 'markdown': return 'markdown';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'cpp': case 'cxx': case 'h': case 'hpp': return 'cpp';
        case 'go': return 'go';
        case 'rs': return 'rust';
        case 'rb': return 'ruby';
        case 'php': return 'php';
        case 'sql': return 'sql';
        case 'xml': return 'xml';
        case 'yml': case 'yaml': return 'yaml';
        case 'pas': return 'pascal';
        case 'dfm':
        case 'lfm':
        case 'fmx':
        case 'ini':
            return 'ini';
        case 'application/pdf':
        case 'pdf':
            return 'pdf';
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'bmp':
        case 'webp':
        case 'svg':
        case 'svgz':
        case 'image/png':
        case 'image/jpg':
        case 'image/jpeg':
        case 'image/gif':
        case 'image/bmp':
        case 'image/webp':
        case 'image/svg':
        case 'image/svg+xml':
            return 'image';
        default: return 'plaintext';
    }
};

export const databaseService = {
  init() {
    ensureWorkspaceDirectory();
    closeAllConnections();
    workspaceRecords = loadWorkspaceMetadata();
    activeWorkspaceId = null;

    if (workspaceRecords.length === 0) {
      const now = new Date().toISOString();
      const workspaceId = uuidv4();
      const defaultRecord: WorkspaceRecord = {
        workspaceId,
        name: DEFAULT_WORKSPACE_NAME,
        fileName: `${workspaceId}.db`,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      };

      const connection = openWorkspaceConnection(defaultRecord);
      connection.close();

      workspaceRecords.push(defaultRecord);
      persistWorkspaceMetadata();
    }

    const workspaceToOpen = selectWorkspaceToOpen() ?? workspaceRecords[0];
    this.switchWorkspace(workspaceToOpen.workspaceId);
  },

  switchWorkspace(workspaceId: string): WorkspaceInfo {
    const target = getWorkspaceRecordOrThrow(workspaceId);
    registerWorkspaceConnection(target);

    const now = new Date().toISOString();
    target.lastOpenedAt = now;
    target.updatedAt = now;
    persistWorkspaceMetadata();

    const previousActive = activeWorkspaceId;
    activeWorkspaceId = target.workspaceId;

    if (previousActive !== target.workspaceId) {
      emitWorkspaceEvent('workspace-activated', target);
    } else {
      // Emit activation event even when re-selecting the same workspace to allow refresh flows.
      emitWorkspaceEvent('workspace-activated', target);
    }

    return toWorkspaceInfo(target);
  },

  openWorkspaceConnection(workspaceId: string): WorkspaceInfo {
    const target = getWorkspaceRecordOrThrow(workspaceId);
    registerWorkspaceConnection(target);
    return toWorkspaceInfo(target);
  },

  closeWorkspaceConnection(workspaceId: string): WorkspaceInfo {
    const target = getWorkspaceRecordOrThrow(workspaceId);
    disposeWorkspaceConnection(workspaceId);
    return toWorkspaceInfo(target);
  },

  refreshWorkspaceConnection(workspaceId: string): WorkspaceInfo {
    const target = getWorkspaceRecordOrThrow(workspaceId);
    reopenWorkspaceConnection(workspaceId);
    return toWorkspaceInfo(target);
  },

  listWorkspaces(): WorkspaceInfo[] {
    return workspaceRecords.map(toWorkspaceInfo);
  },

  createWorkspace(name: string): WorkspaceInfo {
    const trimmedName = name?.trim();
    const resolvedName = trimmedName && trimmedName.length > 0
      ? trimmedName
      : `Workspace ${workspaceRecords.length + 1}`;

    const now = new Date().toISOString();
    const workspaceId = uuidv4();
    const record: WorkspaceRecord = {
      workspaceId,
      name: resolvedName,
      fileName: `${workspaceId}.db`,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
    };

    const connection = openWorkspaceConnection(record);
    connection.close();

    workspaceRecords.push(record);
    persistWorkspaceMetadata();

    return toWorkspaceInfo(record);
  },

  renameWorkspace(workspaceId: string, newName: string): WorkspaceInfo {
    const record = workspaceRecords.find(item => item.workspaceId === workspaceId);
    if (!record) {
      throw new Error(`Workspace with id ${workspaceId} was not found.`);
    }

    const trimmed = newName?.trim();
    if (!trimmed) {
      throw new Error('Workspace name cannot be empty.');
    }

    record.name = trimmed;
    record.updatedAt = new Date().toISOString();
    persistWorkspaceMetadata();

    return toWorkspaceInfo(record);
  },

  deleteWorkspace(workspaceId: string): { success: boolean; error?: string } {
    const recordIndex = workspaceRecords.findIndex(item => item.workspaceId === workspaceId);
    if (recordIndex === -1) {
      return { success: false, error: `Workspace with id ${workspaceId} was not found.` };
    }

    if (activeWorkspaceId === workspaceId) {
      return { success: false, error: 'Cannot delete the active workspace.' };
    }

    disposeWorkspaceConnection(workspaceId);
    const [record] = workspaceRecords.splice(recordIndex, 1);
    persistWorkspaceMetadata();

    try {
      const dbPath = getWorkspaceDbPath(record);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (error) {
      console.warn('Failed to remove workspace database file:', error);
    }

    return { success: true };
  },

  getActiveWorkspace(): WorkspaceInfo | null {
    return activeWorkspaceId ? toWorkspaceInfo(getWorkspaceRecordOrThrow(activeWorkspaceId)) : null;
  },

  isNew(workspaceId?: string): boolean {
    const { connection } = resolveConnection(workspaceId);
    const tableCheck = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'").get();
    return !tableCheck;
  },

  query(sql: string, params: any[] = [], workspaceId?: string): any[] {
    const { connection } = resolveConnection(workspaceId);
    try {
      return connection.prepare(sql).all(...(params || []));
    } catch(e) {
      console.error("DB Query Error:", sql, params, e);
      throw e;
    }
  },

  get(sql: string, params: any[] = [], workspaceId?: string): any {
    const { connection } = resolveConnection(workspaceId);
    try {
      return connection.prepare(sql).get(...(params || []));
    } catch(e) {
      console.error("DB Get Error:", sql, params, e);
      throw e;
    }
  },

  run(sql: string, params: any[] = [], workspaceId?: string): Database.RunResult {
    const { connection } = resolveConnection(workspaceId);
    try {
      return connection.prepare(sql).run(...(params || []));
    } catch(e) {
      console.error("DB Run Error:", sql, params, e);
      throw e;
    }
  },

  migrateFromJson(data: any, workspaceId?: string): { success: boolean, error?: string } {
    return withConnection(workspaceId, (connection) => {
      const transaction = connection.transaction(() => {
        // Clear existing data for a clean migration slate.
        connection.exec('DELETE FROM settings;');
        connection.exec('DELETE FROM templates;');
        connection.exec('DELETE FROM doc_versions;');
        connection.exec('DELETE FROM content_store;');
        connection.exec('DELETE FROM documents;');
        connection.exec('DELETE FROM nodes;');

        // Insert Content
        const contentStmt = connection.prepare('INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)');
        const contentMap = new Map<string, number>();
        for (const item of data.contentStore) {
          const result = contentStmt.run(item.sha256_hex, item.text_content);
          contentMap.set(item.sha256_hex, Number(result.lastInsertRowid));
        }

        // Insert Nodes
        const nodeStmt = connection.prepare('INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const node of data.nodes) {
          nodeStmt.run(node.node_id, node.parent_id, node.node_type, node.title, node.sort_order, node.created_at, node.updated_at);
        }

        // Insert Documents and Versions
        const docStmt = connection.prepare('INSERT INTO documents (node_id, doc_type, language_hint, default_view_mode) VALUES (?, ?, ?, ?)');
        const versionStmt = connection.prepare('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)');
        const updateDocStmt = connection.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?');

        const docVersionsByNode = new Map<string, any[]>();
        for (const version of data.docVersions) {
          if (!docVersionsByNode.has(version.node_id)) docVersionsByNode.set(version.node_id, []);
          docVersionsByNode.get(version.node_id)!.push(version);
        }

        for (const doc of data.documents) {
          const docResult = docStmt.run(doc.node_id, doc.doc_type, doc.language_hint, doc.default_view_mode ?? null);
          const docId = Number(docResult.lastInsertRowid);

          const versions = docVersionsByNode.get(doc.node_id) || [];
          // Sort versions by date to find the latest one
          versions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          let latestVersionId: number | null = null;

          for (const version of versions) {
            const contentId = contentMap.get(version.sha256_hex);
            if (contentId) {
              const versionResult = versionStmt.run(docId, version.created_at, contentId);
              if (!latestVersionId) {
                latestVersionId = Number(versionResult.lastInsertRowid);
              }
            }
          }

          if (latestVersionId) {
            updateDocStmt.run(latestVersionId, docId);
          }
        }

        // Insert Templates
        const templateStmt = connection.prepare('INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        for (const template of data.templates) {
          templateStmt.run(template.template_id, template.title, template.content, template.created_at, template.updated_at);
        }

        // Insert Settings
        const settingsStmt = connection.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
        for (const setting of data.settings) {
          // The `transformLegacyData` in renderer has a bug where it uses String(value)
          // instead of JSON.stringify(value). This is problematic for empty strings,
          // which are not valid JSON. We store it as a stringified empty string
          // to be compatible with `JSON.parse` on the renderer side.
          const valueToStore = setting.value === '' ? '""' : JSON.stringify(setting.value);
          // Re-parsing what is essentially a stringified primitive to store a valid JSON string.
          try {
            const parsed = JSON.parse(setting.value);
            settingsStmt.run(setting.key, JSON.stringify(parsed));
          } catch {
            settingsStmt.run(setting.key, JSON.stringify(setting.value));
          }
        }

        populateDocumentSearch(connection);
      });

      try {
        transaction();
        return { success: true };
      } catch (error) {
        console.error('Migration transaction failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  },

  duplicateNodes(nodeIds: string[], workspaceId?: string): { success: boolean, error?: string } {
    return withConnection(workspaceId, (connection) => {
      const transaction = connection.transaction((ids: string[]) => {
        const recursiveDuplicate = (nodeId: string, newParentId: string | null, sortOrder: number): string => {
          const originalNode = connection.prepare('SELECT * FROM nodes WHERE node_id = ?').get(nodeId) as Node;
          if (!originalNode) return '';

          const newNodeId = uuidv4();
          const now = new Date().toISOString();

          connection.prepare(`
            INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(newNodeId, newParentId, originalNode.node_type, `Copy of ${originalNode.title}`, sortOrder, now, now);

          if (originalNode.node_type === 'document') {
            const originalDoc = connection.prepare('SELECT * FROM documents WHERE node_id = ?').get(nodeId) as Document;
            if (originalDoc) {
              const newDocResult = connection.prepare(`
                INSERT INTO documents (node_id, doc_type, language_hint, default_view_mode, current_version_id)
                VALUES (?, ?, ?, ?, NULL)
              `).run(newNodeId, originalDoc.doc_type, originalDoc.language_hint, originalDoc.default_view_mode);
              const newDocId = newDocResult.lastInsertRowid;

              const originalVersions = connection.prepare('SELECT * FROM doc_versions WHERE document_id = ?').all(originalDoc.document_id) as DocVersion[];
              const versionMap = new Map<number, number>();

              for (const version of originalVersions) {
                const newVersionResult = connection.prepare(`
                  INSERT INTO doc_versions (document_id, created_at, content_id)
                  VALUES (?, ?, ?)
                `).run(newDocId, version.created_at, version.content_id);
                versionMap.set(version.version_id, Number(newVersionResult.lastInsertRowid));
              }

              if (originalDoc.current_version_id && versionMap.has(originalDoc.current_version_id)) {
                const newCurrentVersionId = versionMap.get(originalDoc.current_version_id)!;
                connection.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newCurrentVersionId, newDocId);
              }
            }
          } else if (originalNode.node_type === 'folder') {
            const children = connection.prepare('SELECT * FROM nodes WHERE parent_id = ? ORDER BY sort_order').all(nodeId) as Node[];
            children.forEach((child, index) => {
              recursiveDuplicate(child.node_id, newNodeId, index);
            });
          }
          return newNodeId;
        };

        const parentGroups = new Map<string, { id: string; sort_order: number }[]>();
        for (const id of ids) {
          const node = connection.prepare('SELECT parent_id, sort_order FROM nodes WHERE node_id = ?').get(id) as { parent_id: string | null; sort_order: number };
          if (node) {
            const parentIdKey = node.parent_id || 'root';
            if (!parentGroups.has(parentIdKey)) parentGroups.set(parentIdKey, []);
            parentGroups.get(parentIdKey)!.push({ id, sort_order: node.sort_order });
          }
        }

        for (const [parentIdKey, nodesToDuplicate] of parentGroups.entries()) {
          const parentId = parentIdKey === 'root' ? null : parentIdKey;
          const maxSortOrderResult = connection.prepare(
            `SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${parentId ? '= ?' : 'IS NULL'}`
          ).get(parentId ? [parentId] : []) as { max_order: number | null };
          let nextSortOrder = (maxSortOrderResult?.max_order ?? -1) + 1;

          nodesToDuplicate.sort((a, b) => a.sort_order - b.sort_order);

          for (const node of nodesToDuplicate) {
            recursiveDuplicate(node.id, parentId, nextSortOrder);
            nextSortOrder++;
          }
        }
      });

      try {
        transaction(nodeIds);
        return { success: true };
      } catch (error) {
        console.error('Duplicate nodes transaction failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  },

  deleteVersions(documentId: number, versionIds: number[], workspaceId?: string): { success: boolean, error?: string } {
    return withConnection(workspaceId, (connection) => {
      if (versionIds.length === 0) {
        return { success: true };
      }

      const transaction = connection.transaction(() => {
        const docInfo = connection.prepare('SELECT current_version_id FROM documents WHERE document_id = ?').get(documentId) as { current_version_id: number | null };
        if (!docInfo) {
          throw new Error(`Document with id ${documentId} not found.`);
        }

        const currentVersionId = docInfo.current_version_id;
        const idsToDelete = new Set(versionIds);

        if (currentVersionId && idsToDelete.has(currentVersionId)) {
          const placeholders = versionIds.map(() => '?').join(',');
          const nextVersion = connection.prepare(`
            SELECT version_id FROM doc_versions
            WHERE document_id = ? AND version_id NOT IN (${placeholders})
            ORDER BY created_at DESC
            LIMIT 1
          `).get(documentId, ...versionIds) as { version_id: number } | undefined;

          const newCurrentVersionId = nextVersion ? nextVersion.version_id : null;
          connection.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newCurrentVersionId, documentId);
        }

        const deletePlaceholders = versionIds.map(() => '?').join(',');
        connection.prepare(`DELETE FROM doc_versions WHERE version_id IN (${deletePlaceholders})`).run(...versionIds);
      });

      try {
        transaction();
        return { success: true };
      } catch (error) {
        console.error('Delete versions transaction failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  },

  importFiles(
    filesData: { path: string; name: string; content: string }[],
    targetParentId: string | null,
    workspaceId?: string,
  ): { success: boolean; error?: string; createdNodes: ImportedNodeSummary[] } {
    return withConnection(workspaceId, (connection, workspace) => {
      const createdNodes: ImportedNodeSummary[] = [];
      const transaction = connection.transaction(() => {
        console.log(`Starting import transaction for ${filesData.length} files.`);
        const knownFolderPaths = new Map<string, string>();

        const getContentId = (content: string): number => {
          const sha = crypto.createHash('sha256').update(content).digest('hex');
          const contentRow = connection.prepare('SELECT content_id FROM content_store WHERE sha256_hex = ?').get(sha) as { content_id: number } | undefined;
          if (contentRow) {
            return contentRow.content_id;
          }
          const result = connection.prepare('INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)').run(sha, content);
          return Number(result.lastInsertRowid);
        };

        for (const file of filesData) {
          let currentParentId = targetParentId;
          const pathParts = file.path.split(/[\/\\]/).slice(0, -1);

          for (const part of pathParts) {
            if (!part) continue;
            const folderPathKey = `${currentParentId || 'root'}/${part}`;

            if (knownFolderPaths.has(folderPathKey)) {
              currentParentId = knownFolderPaths.get(folderPathKey)!;
            } else {
              const existingFolder = connection.prepare('SELECT node_id FROM nodes WHERE title = ? AND parent_id ' + (currentParentId ? '= ?' : 'IS NULL')).get(part, currentParentId) as { node_id: string } | undefined;

              if (existingFolder) {
                currentParentId = existingFolder.node_id;
              } else {
                const newFolderId = uuidv4();
                const now = new Date().toISOString();
                const maxSortOrderResult = connection.prepare(`SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${currentParentId ? '= ?' : 'IS NULL'}`).get(currentParentId) as { max_order: number | null };
                const sortOrder = (maxSortOrderResult?.max_order ?? -1) + 1;

                connection.prepare(`INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, 'folder', ?, ?, ?, ?)`).run(newFolderId, currentParentId, part, sortOrder, now, now);
                console.log(`Created folder "${part}" with id ${newFolderId}`);
                currentParentId = newFolderId;
              }
              knownFolderPaths.set(folderPathKey, currentParentId);
            }
          }

          const newNodeId = uuidv4();
          const now = new Date().toISOString();
          const maxSortOrderResult = connection.prepare(`SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${currentParentId ? '= ?' : 'IS NULL'}`).get(currentParentId) as { max_order: number | null };
          const sortOrder = (maxSortOrderResult?.max_order ?? -1) + 1;
          const extension = file.name.split('.').pop() || null;
          let languageHint = mapExtensionToLanguageId_local(extension);

          const trimmedContent = file.content.trim();
          const sample = trimmedContent.slice(0, 64).toLowerCase();
          const isPdf = languageHint === 'pdf' || sample.startsWith('data:application/pdf');
          const isSvgContent = sample.startsWith('<svg');
          const isImageDataUrl = sample.startsWith('data:image/');
          const isImage = languageHint === 'image' || isImageDataUrl || isSvgContent;

          if (isPdf) {
            languageHint = 'pdf';
          } else if (isImage) {
            languageHint = 'image';
          }

          const docType: DocType = isPdf ? 'pdf' : isImage ? 'image' : 'source_code';
          const defaultViewMode: ViewMode | null = docType === 'pdf' || docType === 'image' ? 'preview' : null;

          connection.prepare(`INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, 'document', ?, ?, ?, ?)`).run(newNodeId, currentParentId, file.name, sortOrder, now, now);
          const docResult = connection.prepare(`INSERT INTO documents (node_id, doc_type, language_hint, default_view_mode) VALUES (?, ?, ?, ?)`)
            .run(newNodeId, docType, languageHint, defaultViewMode);
          const documentId = Number(docResult.lastInsertRowid);

          const contentId = getContentId(file.content);
          const versionResult = connection.prepare('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)').run(documentId, now, contentId);
          const newVersionId = Number(versionResult.lastInsertRowid);
          connection.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newVersionId, documentId);

          createdNodes.push({
            nodeId: newNodeId,
            parentId: currentParentId ?? null,
            docType,
            languageHint,
            defaultViewMode,
            workspaceId: workspace.workspaceId,
          });
        }
      });

      try {
        transaction();
        return { success: true, createdNodes };
      } catch (error) {
        console.error('File import transaction failed:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error), createdNodes: [] };
      }
    });
  },
  transferNodesToWorkspace(
    nodeIds: string[],
    targetWorkspaceId: string,
    targetParentId: string | null,
    sourceWorkspaceId?: string,
  ): { success: boolean; createdNodeIds?: string[]; error?: string } {
    return withConnection(sourceWorkspaceId, (sourceConnection, sourceWorkspace) => {
      const uniqueIds = Array.from(new Set(nodeIds));
      if (uniqueIds.length === 0) {
        return { success: true, createdNodeIds: [] };
      }

      const targetWorkspace = getWorkspaceRecordOrThrow(targetWorkspaceId);
      if (targetWorkspace.workspaceId === sourceWorkspace.workspaceId) {
        return { success: false, error: 'Target workspace must be different from the source workspace.' };
      }

      let sourceOrderRows: { node_id: string; sort_order: number }[] = [];
      try {
        const stmt = sourceConnection.prepare('SELECT node_id, sort_order FROM nodes WHERE node_id = ?');
        sourceOrderRows = uniqueIds.map(id => {
          const row = stmt.get(id) as { node_id: string; sort_order: number } | undefined;
          if (!row) {
            throw new Error(`Node with id ${id} was not found in workspace ${sourceWorkspace.workspaceId}.`);
          }
          return row;
        });
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }

      sourceOrderRows.sort((a, b) => a.sort_order - b.sort_order);

      const collectTransferTree = (connection: Database.Database, nodeId: string): TransferNode => {
        const transferNode: TransferNode = {
          node: connection.prepare('SELECT * FROM nodes WHERE node_id = ?').get(nodeId) as Node,
          children: [],
        };

        if (transferNode.node.node_type === 'document') {
          transferNode.document = connection.prepare(`
            SELECT d.*, dv.version_id, dv.created_at, dv.content_id, cs.sha256_hex, cs.text_content, cs.blob_content
            FROM documents d
            LEFT JOIN doc_versions dv ON d.document_id = dv.document_id
            LEFT JOIN content_store cs ON dv.content_id = cs.content_id
            WHERE d.node_id = ?
          `).get(nodeId) as TransferNode['document'];
        }

        transferNode.pythonSettings = connection.prepare('SELECT * FROM node_python_settings WHERE node_id = ?').get(nodeId) as TransferNode['pythonSettings'];
        const childIds = connection.prepare('SELECT node_id FROM nodes WHERE parent_id = ? ORDER BY sort_order').all(nodeId) as { node_id: string }[];
        transferNode.children = childIds.map(child => collectTransferTree(connection, child.node_id));

        return transferNode;
      };

      let transferTrees: TransferNode[] = [];
      try {
        transferTrees = sourceOrderRows.map(row => collectTransferTree(sourceConnection, row.node_id));
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }

      const targetConnection = registerWorkspaceConnection(targetWorkspace);
      const createdNodeIds: string[] = [];

      try {
        if (targetParentId) {
          const parentExists = targetConnection.prepare('SELECT node_id FROM nodes WHERE node_id = ?').get(targetParentId) as { node_id: string } | undefined;
          if (!parentExists) {
            throw new Error('Target parent node does not exist in the destination workspace.');
          }
        }

        const maxSortOrderRow = targetConnection.prepare(`SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${targetParentId ? '= ?' : 'IS NULL'}`).get(targetParentId ? [targetParentId] : []) as { max_order: number | null };
        let nextSortOrder = (maxSortOrderRow?.max_order ?? -1) + 1;

        const contentIdCache = new Map<string, number>();
        const resolveContentId = (sha: string, text: string | null, blob: Buffer | null) => {
          if (contentIdCache.has(sha)) {
            return contentIdCache.get(sha)!;
          }
          const existing = targetConnection.prepare('SELECT content_id FROM content_store WHERE sha256_hex = ?').get(sha) as { content_id: number } | undefined;
          if (existing) {
            contentIdCache.set(sha, existing.content_id);
            return existing.content_id;
          }
          const insertResult = targetConnection.prepare('INSERT INTO content_store (sha256_hex, text_content, blob_content) VALUES (?, ?, ?)').run(sha, text ?? null, blob ?? null);
          const insertedId = Number(insertResult.lastInsertRowid);
          contentIdCache.set(sha, insertedId);
          return insertedId;
        };

        const insertTree = (tree: TransferNode, parentId: string | null, sortOrder: number): string => {
          const newNodeId = uuidv4();
          targetConnection.prepare('INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newNodeId, parentId, tree.node.node_type, tree.node.title, sortOrder, tree.node.created_at, tree.node.updated_at);

          if (tree.document) {
            const docInsert = targetConnection.prepare('INSERT INTO documents (node_id, doc_type, language_hint, default_view_mode, current_version_id) VALUES (?, ?, ?, ?, NULL)').run(newNodeId, tree.document.doc_type, tree.document.language_hint, tree.document.default_view_mode);
            const newDocumentId = Number(docInsert.lastInsertRowid);

            let newCurrentVersionId: number | null = null;
            for (const version of tree.document.versions) {
              const contentId = resolveContentId(version.sha256_hex, version.text_content ?? null, version.blob_content ?? null);
              const versionInsert = targetConnection.prepare('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)').run(newDocumentId, version.created_at, contentId);
              const newVersionId = Number(versionInsert.lastInsertRowid);
              if (tree.document.current_version_id === version.version_id) {
                newCurrentVersionId = newVersionId;
              }
            }

            if (newCurrentVersionId !== null) {
              targetConnection.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newCurrentVersionId, newDocumentId);
            }
          }

          if (tree.pythonSettings) {
            targetConnection.prepare('INSERT OR REPLACE INTO node_python_settings (node_id, env_id, auto_detect_env, last_run_id, updated_at) VALUES (?, ?, ?, ?, ?)').run(newNodeId, tree.pythonSettings.env_id, tree.pythonSettings.auto_detect_env, tree.pythonSettings.last_run_id, tree.pythonSettings.updated_at);
          }

          tree.children.forEach((child, index) => {
            insertTree(child, newNodeId, index);
          });

          return newNodeId;
        };

        const transaction = targetConnection.transaction(() => {
          for (const tree of transferTrees) {
            const insertedRootId = insertTree(tree, targetParentId, nextSortOrder++);
            createdNodeIds.push(insertedRootId);
          }
        });

        transaction();
        targetWorkspace.updatedAt = new Date().toISOString();
        persistWorkspaceMetadata();

        return { success: true, createdNodeIds };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  },
};
  getDbPath(workspaceId?: string): string {
    const id = workspaceId ?? activeWorkspaceId;
    if (!id) {
      throw new Error('No active workspace is selected.');
    }
    const workspace = getWorkspaceRecordOrThrow(id);
    return getWorkspaceDbPath(workspace);
  },

  async backupDatabase(filePath: string, workspaceId?: string): Promise<void> {
    const { connection } = resolveConnection(workspaceId);
    await connection.backup(filePath);
  },

  runIntegrityCheck(workspaceId?: string): string {
    const { connection } = resolveConnection(workspaceId);
    const results = connection.pragma('integrity_check');
    if (Array.isArray(results) && results.length === 1 && (results[0] as any).integrity_check === 'ok') {
      return 'ok';
    }
    return JSON.stringify(results, null, 2);
  },

  runVacuum(workspaceId?: string): void {
    const { connection } = resolveConnection(workspaceId);
    connection.exec('VACUUM;');
  },

  getDatabaseStats(workspaceId?: string): DatabaseStats {
    const { connection, workspace } = resolveConnection(workspaceId);
    const dbPath = getWorkspaceDbPath(workspace);
    const fileSize = statSync(dbPath).size;
    const pageSize = connection.pragma('page_size', { simple: true }) as number;
    const pageCount = connection.pragma('page_count', { simple: true }) as number;
    const schemaVersion = connection.pragma('schema_version', { simple: true }) as number;

    const tableNames = connection.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[];

    const tables = tableNames.map(({ name }) => {
      const rowCountResult = connection.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as { count: number };
      const indexes = connection.prepare(`PRAGMA index_list("${name}")`).all() as { name: string }[];

      return {
        name,
        rowCount: rowCountResult.count,
        indexes: indexes.map(i => i.name),
      };
    });

    return {
      fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
      pageSize,
      pageCount,
      schemaVersion,
      tables,
    };
  },

  events: serviceEvents,

  close() {
    closeAllConnections();
    activeWorkspaceId = null;
  }
};

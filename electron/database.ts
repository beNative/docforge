import { app } from 'electron';
import path from 'path';
import fs, { statSync } from 'fs';
import Database from 'better-sqlite3';
import { INITIAL_SCHEMA } from './schema';
import { v4 as uuidv4 } from 'uuid';
// Fix: Import types to use for casting
import type { Node, Document, DocVersion, DatabaseStats } from '../types';

let db: Database.Database;

const DB_FILE_NAME = 'docforge.db';
const DB_PATH = path.join(app.getPath('userData'), DB_FILE_NAME);

export const databaseService = {
  init() {
    const dbExists = fs.existsSync(DB_PATH);
    db = new Database(DB_PATH);

    if (!dbExists) {
      console.log('Database does not exist, creating new one...');
      db.exec(INITIAL_SCHEMA);
      // Set PRAGMAs for a new database
      db.pragma('user_version = 1');
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('Database created and schema applied.');
    } else {
      console.log('Existing database found.');
      // Ensure PRAGMAs are set for existing databases too
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
      
      // Run migrations
      const currentVersion = db.pragma('user_version', { simple: true }) as number;
      if (currentVersion < 1) {
        console.log(`Migrating schema from version ${currentVersion} to 1...`);
        try {
          const transaction = db.transaction(() => {
            const columns = db.prepare("PRAGMA table_info(documents)").all() as {name: string}[];
            const hasColumn = columns.some(col => col.name === 'default_view_mode');
            if (!hasColumn) {
              db.exec('ALTER TABLE documents ADD COLUMN default_view_mode TEXT');
            }
            db.pragma('user_version = 1');
          });
          transaction();
          console.log('Migration to version 1 complete.');
        } catch (e) {
          console.error('Fatal: Failed to migrate database to version 1:', e);
        }
      }
    }
  },

  isNew(): boolean {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'").get();
    return !tableCheck;
  },
  
  query(sql: string, params: any[] = []): any[] {
    try {
      return db.prepare(sql).all(...(params || []));
    } catch(e) {
      console.error("DB Query Error:", sql, params, e);
      throw e;
    }
  },

  get(sql: string, params: any[] = []): any {
    try {
      return db.prepare(sql).get(...(params || []));
    } catch(e) {
      console.error("DB Get Error:", sql, params, e);
      throw e;
    }
  },
  
  run(sql: string, params: any[] = []): Database.RunResult {
    try {
      return db.prepare(sql).run(...(params || []));
    } catch(e) {
      console.error("DB Run Error:", sql, params, e);
      throw e;
    }
  },

  migrateFromJson(data: any): { success: boolean, error?: string } {
    const transaction = db.transaction(() => {
        // Clear existing data for a clean migration slate.
        db.exec('DELETE FROM settings;');
        db.exec('DELETE FROM templates;');
        db.exec('DELETE FROM doc_versions;');
        db.exec('DELETE FROM content_store;');
        db.exec('DELETE FROM documents;');
        db.exec('DELETE FROM nodes;');

        // Insert Content
        const contentStmt = db.prepare('INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)');
        const contentMap = new Map<string, number>();
        for (const item of data.contentStore) {
            const result = contentStmt.run(item.sha256_hex, item.text_content);
            contentMap.set(item.sha256_hex, Number(result.lastInsertRowid));
        }

        // Insert Nodes
        const nodeStmt = db.prepare('INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const node of data.nodes) {
            nodeStmt.run(node.node_id, node.parent_id, node.node_type, node.title, node.sort_order, node.created_at, node.updated_at);
        }

        // Insert Documents and Versions
        const docStmt = db.prepare('INSERT INTO documents (node_id, doc_type, language_hint) VALUES (?, ?, ?)');
        const versionStmt = db.prepare('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)');
        const updateDocStmt = db.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?');

        const docVersionsByNode = new Map<string, any[]>();
        for(const version of data.docVersions) {
            if(!docVersionsByNode.has(version.node_id)) docVersionsByNode.set(version.node_id, []);
            docVersionsByNode.get(version.node_id)!.push(version);
        }

        for (const doc of data.documents) {
            const docResult = docStmt.run(doc.node_id, doc.doc_type, doc.language_hint);
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
        const templateStmt = db.prepare('INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        for (const template of data.templates) {
            templateStmt.run(template.template_id, template.title, template.content, template.created_at, template.updated_at);
        }

        // Insert Settings
        const settingsStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
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
    });

    try {
      transaction();
      return { success: true };
    } catch (error) {
      console.error('Migration transaction failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  
  duplicateNodes(nodeIds: string[]): { success: boolean, error?: string } {
    const transaction = db.transaction((ids: string[]) => {
      const _recursiveDuplicate = (nodeId: string, newParentId: string | null, sortOrder: number): string => {
        // Fix: Cast the result to the Node type to resolve property access errors.
        const originalNode = db.prepare('SELECT * FROM nodes WHERE node_id = ?').get(nodeId) as Node;
        if (!originalNode) return '';
  
        const newNodeId = uuidv4();
        const now = new Date().toISOString();
  
        db.prepare(`
          INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(newNodeId, newParentId, originalNode.node_type, `Copy of ${originalNode.title}`, sortOrder, now, now);
  
        if (originalNode.node_type === 'document') {
          // Fix: Cast the result to the Document type.
          const originalDoc = db.prepare('SELECT * FROM documents WHERE node_id = ?').get(nodeId) as Document;
          if (originalDoc) {
            const newDocResult = db.prepare(`
              INSERT INTO documents (node_id, doc_type, language_hint, current_version_id)
              VALUES (?, ?, ?, NULL)
            `).run(newNodeId, originalDoc.doc_type, originalDoc.language_hint);
            const newDocId = newDocResult.lastInsertRowid;
  
            // Fix: Cast the result to DocVersion array.
            const originalVersions = db.prepare('SELECT * FROM doc_versions WHERE document_id = ?').all(originalDoc.document_id) as DocVersion[];
            const versionMap = new Map<number, number>();
  
            for (const version of originalVersions) {
              const newVersionResult = db.prepare(`
                INSERT INTO doc_versions (document_id, created_at, content_id)
                VALUES (?, ?, ?)
              `).run(newDocId, version.created_at, version.content_id);
              versionMap.set(version.version_id, Number(newVersionResult.lastInsertRowid));
            }
  
            if (originalDoc.current_version_id && versionMap.has(originalDoc.current_version_id)) {
              const newCurrentVersionId = versionMap.get(originalDoc.current_version_id)!;
              db.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newCurrentVersionId, newDocId);
            }
          }
        } else if (originalNode.node_type === 'folder') {
          // Fix: Cast the result to Node array.
          const children = db.prepare('SELECT * FROM nodes WHERE parent_id = ? ORDER BY sort_order').all(nodeId) as Node[];
          children.forEach((child, index) => {
            _recursiveDuplicate(child.node_id, newNodeId, index);
          });
        }
        return newNodeId;
      };
  
      const parentGroups = new Map<string, { id: string, sort_order: number }[]>();
      for (const id of ids) {
        // Fix: Cast the result to a specific object type.
        const node = db.prepare('SELECT parent_id, sort_order FROM nodes WHERE node_id = ?').get(id) as { parent_id: string | null; sort_order: number; };
        if (node) {
          const parentIdKey = node.parent_id || 'root';
          if (!parentGroups.has(parentIdKey)) parentGroups.set(parentIdKey, []);
          parentGroups.get(parentIdKey)!.push({ id, sort_order: node.sort_order });
        }
      }
  
      for (const [parentIdKey, nodesToDuplicate] of parentGroups.entries()) {
        const parentId = parentIdKey === 'root' ? null : parentIdKey;
        // Fix: Cast the result to a specific object type.
        const maxSortOrderResult = db.prepare(
          `SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${parentId ? '= ?' : 'IS NULL'}`
        ).get(parentId ? [parentId] : []) as { max_order: number | null };
        let nextSortOrder = (maxSortOrderResult?.max_order ?? -1) + 1;
  
        // Sort nodes to duplicate by their original sort order to maintain relative position
        nodesToDuplicate.sort((a, b) => a.sort_order - b.sort_order);

        for (const node of nodesToDuplicate) {
          _recursiveDuplicate(node.id, parentId, nextSortOrder);
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
  },

  deleteVersions(documentId: number, versionIds: number[]): { success: boolean, error?: string } {
    if (versionIds.length === 0) {
      return { success: true };
    }

    const transaction = db.transaction(() => {
      const docInfo = db.prepare('SELECT current_version_id FROM documents WHERE document_id = ?').get(documentId) as { current_version_id: number | null };
      if (!docInfo) {
        throw new Error(`Document with id ${documentId} not found.`);
      }
      
      const currentVersionId = docInfo.current_version_id;
      const idsToDelete = new Set(versionIds);

      if (currentVersionId && idsToDelete.has(currentVersionId)) {
        const placeholders = versionIds.map(() => '?').join(',');
        const nextVersion = db.prepare(`
          SELECT version_id FROM doc_versions 
          WHERE document_id = ? AND version_id NOT IN (${placeholders})
          ORDER BY created_at DESC 
          LIMIT 1
        `).get(documentId, ...versionIds) as { version_id: number } | undefined;

        const newCurrentVersionId = nextVersion ? nextVersion.version_id : null;
        db.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?').run(newCurrentVersionId, documentId);
      }

      const deletePlaceholders = versionIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM doc_versions WHERE version_id IN (${deletePlaceholders})`).run(...versionIds);
    });

    try {
      transaction();
      return { success: true };
    } catch (error) {
      console.error('Delete versions transaction failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  getDbPath(): string {
    return DB_PATH;
  },

  async backupDatabase(filePath: string): Promise<void> {
    await db.backup(filePath);
  },

  runIntegrityCheck(): string {
    const results = db.pragma('integrity_check');
    if (Array.isArray(results) && results.length === 1 && (results[0] as any).integrity_check === 'ok') {
        return 'ok';
    }
    return JSON.stringify(results, null, 2);
  },

  runVacuum(): void {
    db.exec('VACUUM;');
  },

  getDatabaseStats(): DatabaseStats {
    const fileSize = statSync(DB_PATH).size;
    const pageSize = db.pragma('page_size', { simple: true }) as number;
    const pageCount = db.pragma('page_count', { simple: true }) as number;
    const schemaVersion = db.pragma('schema_version', { simple: true }) as number;

    const tableNames = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as {name: string}[];

    const tables = tableNames.map(({ name }) => {
        const rowCountResult = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as { count: number };
        const indexes = db.prepare(`PRAGMA index_list("${name}")`).all() as {name: string}[];

        return {
            name,
            rowCount: rowCountResult.count,
            indexes: indexes.map(i => i.name)
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

  close() {
    if (db) {
      db.close();
    }
  }
};
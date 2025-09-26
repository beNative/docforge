// Fix: This file was previously a placeholder. This is the full implementation for the database service.
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { INITIAL_SCHEMA } from './schema';

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
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('Database created and schema applied.');
    } else {
      console.log('Existing database found.');
      // Ensure PRAGMAs are set for existing databases too
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
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

  close() {
    if (db) {
      db.close();
    }
  }
};


import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { INITIAL_SCHEMA } from './schema';

// This is a simplified type mirroring what's sent from the renderer.
interface MigrationPayload {
    nodes: any[];
    documents: any[];
    docVersions: any[];
    contentStore: any[];
    templates: any[];
    settings: { key: string, value: string }[];
}

export class DatabaseService {
    private db: Database | null = null;
    private dbPath: string;
    private isNewDB: boolean = false;

    constructor() {
        const dbFolder = app.getPath('userData');
        if (!fs.existsSync(dbFolder)) {
            fs.mkdirSync(dbFolder, { recursive: true });
        }
        this.dbPath = path.join(dbFolder, 'docforge.sqlite3');
    }

    async init(): Promise<void> {
        this.isNewDB = !fs.existsSync(this.dbPath);
        
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec('PRAGMA journal_mode = WAL;');
        await this.db.exec('PRAGMA foreign_keys = ON;');

        if (this.isNewDB) {
            console.log('Database does not exist, creating new one...');
            await this.db.exec(INITIAL_SCHEMA);
            console.log('Database schema created.');
        } else {
            console.log('Opened existing database.');
        }
    }

    private ensureDb(): Database {
        if (!this.db) {
            throw new Error('Database is not initialized.');
        }
        return this.db;
    }

    isNew(): boolean {
        return this.isNewDB;
    }
    
    async query(sql: string, params: any[] = []): Promise<any[]> {
        const db = this.ensureDb();
        return db.all(sql, params);
    }

    async get(sql: string, params: any[] = []): Promise<any> {
        const db = this.ensureDb();
        return db.get(sql, params);
    }

    async run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number; }> {
        const db = this.ensureDb();
        const result = await db.run(sql, params);
        return {
            changes: result.changes ?? 0,
            lastInsertRowid: result.lastID ?? 0,
        };
    }
    
    async migrateFromJson(payload: MigrationPayload): Promise<{ success: boolean; error?: string }> {
        const db = this.ensureDb();
        try {
            await db.exec('BEGIN TRANSACTION');

            // 1. Content Store
            const contentStmt = await db.prepare('INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)');
            const shaToIdMap = new Map<string, number>();
            for (const item of payload.contentStore) {
                const res = await contentStmt.run(item.sha256_hex, item.text_content);
                if (res.lastID) shaToIdMap.set(item.sha256_hex, res.lastID);
            }
            await contentStmt.finalize();
            console.log(`Migrated ${payload.contentStore.length} content items.`);

            // 2. Nodes
            const nodeStmt = await db.prepare('INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const node of payload.nodes) {
                await nodeStmt.run(node.node_id, node.parent_id, node.node_type, node.title, node.sort_order, node.created_at, node.updated_at);
            }
            await nodeStmt.finalize();
            console.log(`Migrated ${payload.nodes.length} nodes.`);

            // 3. Documents
            const docStmt = await db.prepare('INSERT INTO documents (node_id, doc_type, language_hint) VALUES (?, ?, ?)');
            const nodeIdToDocIdMap = new Map<string, number>();
            for (const doc of payload.documents) {
                const res = await docStmt.run(doc.node_id, doc.doc_type, doc.language_hint);
                if (res.lastID) nodeIdToDocIdMap.set(doc.node_id, res.lastID);
            }
            await docStmt.finalize();
            console.log(`Migrated ${payload.documents.length} documents.`);

            // 4. Versions
            const versionStmt = await db.prepare('INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)');
            const docIdToVersions = new Map<number, { versionId: number, createdAt: string }[]>();
            for (const version of payload.docVersions) {
                const document_id = nodeIdToDocIdMap.get(version.node_id);
                const content_id = shaToIdMap.get(version.sha256_hex);
                if (document_id && content_id) {
                    const res = await versionStmt.run(document_id, version.created_at, content_id);
                    if (res.lastID) {
                        if (!docIdToVersions.has(document_id)) {
                            docIdToVersions.set(document_id, []);
                        }
                        docIdToVersions.get(document_id)!.push({ versionId: res.lastID, createdAt: version.created_at });
                    }
                }
            }
            await versionStmt.finalize();
            console.log(`Migrated ${payload.docVersions.length} versions.`);

            // 5. Update documents with latest version
            const updateDocStmt = await db.prepare('UPDATE documents SET current_version_id = ? WHERE document_id = ?');
            for (const [docId, versions] of docIdToVersions.entries()) {
                versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latestVersionId = versions[0]?.versionId;
                if (latestVersionId) {
                    await updateDocStmt.run(latestVersionId, docId);
                }
            }
            await updateDocStmt.finalize();

            // 6. Templates
            const templateStmt = await db.prepare('INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
            for (const t of payload.templates) {
                await templateStmt.run(t.template_id || t.id, t.title, t.content, t.created_at || t.createdAt, t.updated_at || t.updatedAt);
            }
            await templateStmt.finalize();
            console.log(`Migrated ${payload.templates.length} templates.`);

            // 7. Settings
            const settingsStmt = await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            for (const s of payload.settings) {
                await settingsStmt.run(s.key, s.value);
            }
            await settingsStmt.finalize();
            console.log(`Migrated ${payload.settings.length} settings.`);
            
            await db.exec('COMMIT');
            return { success: true };
        } catch (error) {
            await db.exec('ROLLBACK');
            const message = error instanceof Error ? error.message : String(error);
            console.error('Migration transaction failed:', message);
            return { success: false, error: message };
        }
    }
}

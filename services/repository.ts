import type { Node, Document, DocVersion, DocumentOrFolder, DocumentVersion, DocumentTemplate, Settings, ContentStore, ViewMode } from '../types';
import { cryptoService } from './cryptoService';
import { EXAMPLE_TEMPLATES, LOCAL_STORAGE_KEYS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

/**
 * Transforms legacy DocumentOrFolder[] data into the new normalized database schema.
 */
const transformLegacyData = async (
    legacyDocuments: DocumentOrFolder[], 
    // Fix: Correctly type legacy versions as `any[]` as their shape (camelCase) differs from the new `DocumentVersion` type (snake_case).
    legacyVersions: any[], 
    legacyTemplates: DocumentTemplate[],
    legacySettings: Settings
) => {
    const nodes: Omit<Node, 'children' | 'document'>[] = [];
    const documents: Omit<Document, 'content'>[] = [];
    const docVersions: (Omit<DocVersion, 'content'> & { node_id: string, sha256_hex: string })[] = [];
    const contentStoreMap = new Map<string, string>(); // sha256 -> content

    // Sort documents to ensure parents are processed before children (for sorting)
    const sortedDocuments = [...legacyDocuments].sort((a, b) => {
        if (a.parentId === null && b.parentId !== null) return -1;
        if (a.parentId !== null && b.parentId === null) return 1;
        return 0;
    });
    
    const siblingSortOrder = new Map<string, number>();

    for (const item of sortedDocuments) {
        const parentKey = item.parentId || 'root';
        const sortOrder = siblingSortOrder.get(parentKey) || 0;
        
        nodes.push({
            node_id: item.id,
            parent_id: item.parentId,
            node_type: item.type === 'document' ? 'document' : 'folder',
            title: item.title,
            sort_order: sortOrder,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
        });
        siblingSortOrder.set(parentKey, sortOrder + 1);

        if (item.type === 'document') {
            documents.push({
                document_id: 0, // placeholder
                node_id: item.id,
                doc_type: 'prompt',
                language_hint: null,
                default_view_mode: null,
                current_version_id: null, // placeholder
            });

            // Process current content
            if (item.content) {
                const sha = await cryptoService.sha256(item.content);
                if (!contentStoreMap.has(sha)) {
                    contentStoreMap.set(sha, item.content);
                }
                docVersions.push({
                    node_id: item.id,
                    sha256_hex: sha,
                    version_id: 0, // placeholder
                    document_id: 0, // placeholder
                    created_at: item.updatedAt,
                    content_id: 0, // placeholder
                });
            }
            
            // Process historical versions
            const history = legacyVersions.filter(v => v.promptId === item.id);
            for (const version of history) {
                if(version.content) {
                    const sha = await cryptoService.sha256(version.content);
                    if (!contentStoreMap.has(sha)) {
                        contentStoreMap.set(sha, version.content);
                    }
                    docVersions.push({
                        node_id: item.id,
                        sha256_hex: sha,
                        version_id: 0,
                        document_id: 0,
                        created_at: version.createdAt,
                        content_id: 0,
                    });
                }
            }
        }
    }

    const contentStore: Omit<ContentStore, 'content_id' | 'blob_content'>[] = [];
    for (const [sha, content] of contentStoreMap.entries()) {
        contentStore.push({ sha256_hex: sha, text_content: content });
    }
    
    const settings = Object.entries(legacySettings).map(([key, value]) => ({ key, value: String(value) }));

    return { nodes, documents, docVersions, contentStore, templates: legacyTemplates, settings };
};

export const repository = {
    _isInitialized: false,

    async init() {
        if (this._isInitialized) return;
        
        if (!window.electronAPI) {
            throw new Error("Electron API is not available. This application is designed to run in Electron.");
        }

        const isNewDb = await window.electronAPI.dbIsNew();
        const legacyPromptsExist = await window.electronAPI.legacyFileExists(LOCAL_STORAGE_KEYS.LEGACY_PROMPTS);

        if (isNewDb && legacyPromptsExist) {
            console.log("New database and legacy files found. Starting migration...");
            await this.migrateFromJson();
        }
        
        const templates = await this.getAllTemplates();
        if (templates.length === 0) {
            await this.addDefaultTemplates();
        }

        this._isInitialized = true;
    },

    async migrateFromJson() {
        try {
            const [promptsRes, versionsRes, templatesRes, settingsRes] = await Promise.all([
                window.electronAPI!.readLegacyFile(LOCAL_STORAGE_KEYS.LEGACY_PROMPTS),
                window.electronAPI!.readLegacyFile(LOCAL_STORAGE_KEYS.LEGACY_PROMPT_VERSIONS),
                window.electronAPI!.readLegacyFile(LOCAL_STORAGE_KEYS.LEGACY_TEMPLATES),
                window.electronAPI!.readLegacyFile(LOCAL_STORAGE_KEYS.LEGACY_SETTINGS),
            ]);

            const legacyDocuments = promptsRes.success ? JSON.parse(promptsRes.data!) as DocumentOrFolder[] : [];
            // Fix: Remove incorrect cast to `DocumentVersion[]`. Legacy data has a different shape.
            const legacyVersions = versionsRes.success ? JSON.parse(versionsRes.data!) : [];
            const legacyTemplates = templatesRes.success ? JSON.parse(templatesRes.data!) as DocumentTemplate[] : [];
            const legacySettings = settingsRes.success ? JSON.parse(settingsRes.data!) as Settings : {} as Settings;

            const payload = await transformLegacyData(legacyDocuments, legacyVersions, legacyTemplates, legacySettings);
            
            const result = await window.electronAPI!.dbMigrateFromJson(payload);
            if (!result.success) {
                throw new Error(result.error || 'Migration failed in main process.');
            }
            console.log("Migration from JSON completed successfully.");
        } catch (error) {
            console.error("Migration failed:", error);
            throw error;
        }
    },
    
    async addDefaultTemplates() {
        for (const template of EXAMPLE_TEMPLATES) {
            await this.addTemplate(template);
        }
        console.log("Added default templates to the database.");
    },

    async getNodeTree(): Promise<Node[]> {
        if (!window.electronAPI) return [];
        const flatNodes = await window.electronAPI.dbQuery(`
            SELECT 
                n.*, 
                d.document_id, d.doc_type, d.language_hint, d.default_view_mode, d.current_version_id,
                cs.text_content as content
            FROM nodes n
            LEFT JOIN documents d ON n.node_id = d.node_id
            LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
            LEFT JOIN content_store cs ON dv.content_id = cs.content_id
            ORDER BY n.sort_order
        `);
        
        const nodesById = new Map<string, Node>();
        const rootNodes: Node[] = [];

        for (const record of flatNodes) {
            const node: Node = {
                node_id: record.node_id,
                parent_id: record.parent_id,
                node_type: record.node_type,
                title: record.title,
                sort_order: record.sort_order,
                created_at: record.created_at,
                updated_at: record.updated_at,
                children: [],
                document: record.document_id ? {
                    document_id: record.document_id,
                    node_id: record.node_id,
                    doc_type: record.doc_type,
                    language_hint: record.language_hint,
                    default_view_mode: record.default_view_mode,
                    current_version_id: record.current_version_id,
                    content: record.content,
                } : undefined,
            };
            nodesById.set(node.node_id, node);
        }

        for (const node of nodesById.values()) {
            if (node.parent_id && nodesById.has(node.parent_id)) {
                nodesById.get(node.parent_id)!.children!.push(node);
            } else {
                rootNodes.push(node);
            }
        }
        return rootNodes;
    },

    async addNode(nodeData: Omit<Node, 'node_id' | 'sort_order' | 'created_at' | 'updated_at'>): Promise<Node> {
        const newNodeId = uuidv4();
        const now = new Date().toISOString();
        
        const maxSortOrderResult = await window.electronAPI!.dbGet(
            `SELECT MAX(sort_order) as max_order FROM nodes WHERE parent_id ${nodeData.parent_id ? '= ?' : 'IS NULL'}`,
            nodeData.parent_id ? [nodeData.parent_id] : []
        );
        const sortOrder = (maxSortOrderResult?.max_order ?? -1) + 1;

        await window.electronAPI!.dbRun(
            `INSERT INTO nodes (node_id, parent_id, node_type, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [newNodeId, nodeData.parent_id, nodeData.node_type, nodeData.title, sortOrder, now, now]
        );

        if (nodeData.node_type === 'document' && nodeData.document) {
            const docRes = await window.electronAPI!.dbRun(
                `INSERT INTO documents (node_id, doc_type, language_hint) VALUES (?, ?, ?)`,
                [newNodeId, nodeData.document.doc_type, nodeData.document.language_hint]
            );
            const documentId = docRes.lastInsertRowid;
            
            if (nodeData.document.content) {
                await this.updateDocumentContent(newNodeId, nodeData.document.content, documentId as number);
            }
        }

        const createdNode = await window.electronAPI!.dbGet(`SELECT * FROM nodes WHERE node_id = ?`, [newNodeId]);
        return createdNode as Node;
    },
    
    async updateNode(nodeId: string, updates: Partial<Pick<Node, 'title' | 'parent_id'> & { language_hint?: string | null; default_view_mode?: ViewMode | null }>) {
        const nodeUpdates: Partial<Pick<Node, 'title' | 'parent_id'>> = {};
        if (updates.title !== undefined) nodeUpdates.title = updates.title;
        if (updates.parent_id !== undefined) nodeUpdates.parent_id = updates.parent_id;
    
        const now = new Date().toISOString();
    
        if (Object.keys(nodeUpdates).length > 0) {
            const fields = Object.keys(nodeUpdates).map(key => `${key} = ?`).join(', ');
            const params = Object.values(nodeUpdates);
            await window.electronAPI!.dbRun(
                `UPDATE nodes SET ${fields}, updated_at = ? WHERE node_id = ?`,
                [...params, now, nodeId]
            );
        }
        
        if (updates.language_hint !== undefined) {
            await window.electronAPI!.dbRun(
                `UPDATE documents SET language_hint = ? WHERE node_id = ?`,
                [updates.language_hint, nodeId]
            );
            await window.electronAPI!.dbRun(`UPDATE nodes SET updated_at = ? WHERE node_id = ?`, [now, nodeId]);
        }
        
        if (updates.default_view_mode !== undefined) {
            await window.electronAPI!.dbRun(
                `UPDATE documents SET default_view_mode = ? WHERE node_id = ?`,
                [updates.default_view_mode, nodeId]
            );
            await window.electronAPI!.dbRun(`UPDATE nodes SET updated_at = ? WHERE node_id = ?`, [now, nodeId]);
        }
    },

    async updateDocumentContent(nodeId: string, newContent: string, documentId?: number) {
        let docId = documentId;
        if (!docId) {
            const doc = await window.electronAPI!.dbGet(`SELECT document_id FROM documents WHERE node_id = ?`, [nodeId]);
            if (!doc) throw new Error(`No document found for node ${nodeId}`);
            docId = doc.document_id;
        }

        const sha = await cryptoService.sha256(newContent);
        
        let content = await window.electronAPI!.dbGet(`SELECT content_id FROM content_store WHERE sha256_hex = ?`, [sha]);
        let contentId;
        if (content) {
            contentId = content.content_id;
        } else {
            const res = await window.electronAPI!.dbRun(`INSERT INTO content_store (sha256_hex, text_content) VALUES (?, ?)`, [sha, newContent]);
            contentId = res.lastInsertRowid;
        }

        const versionRes = await window.electronAPI!.dbRun(
            `INSERT INTO doc_versions (document_id, created_at, content_id) VALUES (?, ?, ?)`,
            [docId, new Date().toISOString(), contentId]
        );
        const newVersionId = versionRes.lastInsertRowid;
        
        await window.electronAPI!.dbRun(`UPDATE documents SET current_version_id = ? WHERE document_id = ?`, [newVersionId, docId]);
        await window.electronAPI!.dbRun(`UPDATE nodes SET updated_at = ? WHERE node_id = ?`, [new Date().toISOString(), nodeId]);
    },
    
    async deleteNode(nodeId: string) {
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id = ?`, [nodeId]);
    },

    async deleteNodes(nodeIds: string[]) {
        if (nodeIds.length === 0) return;
        const placeholders = nodeIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id IN (${placeholders})`, nodeIds);
    },

    async duplicateNodes(nodeIds: string[]) {
        if (!window.electronAPI?.dbDuplicateNodes) return;
        const result = await window.electronAPI.dbDuplicateNodes(nodeIds);
        if (!result.success) {
            throw new Error(result.error || 'Failed to duplicate nodes in the main process.');
        }
    },
    
    async moveNodes(draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') {
        const parentId = position === 'inside'
            ? targetId
            : (targetId ? (await window.electronAPI!.dbGet(`SELECT parent_id FROM nodes WHERE node_id = ?`, [targetId]))?.parent_id ?? null : null);
    
        const siblings = await window.electronAPI!.dbQuery(
            `SELECT node_id, sort_order FROM nodes WHERE parent_id ${parentId ? '= ?' : 'IS NULL'} ORDER BY sort_order`,
            parentId ? [parentId] : []
        );
    
        const draggedIdSet = new Set(draggedIds);
        const siblingsWithoutDragged = siblings.filter(s => !draggedIdSet.has(s.node_id));
    
        let targetIndex;
        if (position === 'inside') {
            targetIndex = siblingsWithoutDragged.length;
        } else if (targetId) {
            targetIndex = siblingsWithoutDragged.findIndex(s => s.node_id === targetId);
            if (targetIndex === -1) {
                targetIndex = siblingsWithoutDragged.length;
            } else if (position === 'after') {
                targetIndex++;
            }
        } else {
            targetIndex = siblingsWithoutDragged.length;
        }
        
        const itemsToInsert = draggedIds.map(id => ({ node_id: id, sort_order: -1 }));
        
        const finalOrder = [...siblingsWithoutDragged];
        finalOrder.splice(targetIndex, 0, ...itemsToInsert);
    
        for (let i = 0; i < finalOrder.length; i++) {
            const item = finalOrder[i];
            
            if (draggedIdSet.has(item.node_id)) {
                await window.electronAPI!.dbRun(
                    `UPDATE nodes SET parent_id = ?, sort_order = ? WHERE node_id = ?`,
                    [parentId, i, item.node_id]
                );
            } else {
                await window.electronAPI!.dbRun(
                    `UPDATE nodes SET sort_order = ? WHERE node_id = ?`,
                    [i, item.node_id]
                );
            }
        }
    },
    
    async getVersionsForNode(nodeId: string): Promise<DocVersion[]> {
        return window.electronAPI!.dbQuery(`
            SELECT dv.version_id, dv.document_id, dv.created_at, dv.content_id, cs.text_content as content
            FROM doc_versions dv
            JOIN content_store cs ON dv.content_id = cs.content_id
            JOIN documents d ON dv.document_id = d.document_id
            WHERE d.node_id = ?
            ORDER BY dv.created_at DESC
        `, [nodeId]);
    },

    async deleteDocVersions(documentId: number, versionIds: number[]): Promise<void> {
        if (versionIds.length === 0) return;
        if (!window.electronAPI?.dbDeleteVersions) {
            throw new Error("Version deletion is not supported in this environment.");
        }
        const result = await window.electronAPI.dbDeleteVersions(documentId, versionIds);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete versions in main process.');
        }
    },
    
    async getAllTemplates(): Promise<DocumentTemplate[]> {
        return window.electronAPI!.dbQuery(`SELECT * FROM templates ORDER BY title`);
    },
    
    async addTemplate(templateData: Omit<DocumentTemplate, 'template_id' | 'created_at' | 'updated_at'>): Promise<DocumentTemplate> {
        const newId = uuidv4();
        const now = new Date().toISOString();
        await window.electronAPI!.dbRun(
            `INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [newId, templateData.title, templateData.content, now, now]
        );
        return { ...templateData, template_id: newId, created_at: now, updated_at: now };
    },
    
    async updateTemplate(templateId: string, updates: Partial<Omit<DocumentTemplate, 'template_id'>>) {
         const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
         if(fields.length === 0) return;
         await window.electronAPI!.dbRun(
            `UPDATE templates SET ${fields}, updated_at = ? WHERE template_id = ?`,
            [...Object.values(updates), new Date().toISOString(), templateId]
        );
    },
    
    async deleteTemplate(templateId: string) {
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id = ?`, [templateId]);
    },

    async deleteTemplates(templateIds: string[]) {
        if (templateIds.length === 0) return;
        const placeholders = templateIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id IN (${placeholders})`, templateIds);
    },

    async getAllSettings(): Promise<Settings> {
        const rows = await window.electronAPI!.dbQuery(`SELECT key, value FROM settings`);
        const settings: any = {};
        for (const row of rows) {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch {
                settings[row.key] = row.value;
            }
        }
        return settings as Settings;
    },

    async saveAllSettings(settings: Settings) {
        for (const [key, value] of Object.entries(settings)) {
            await window.electronAPI!.dbRun(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                [key, JSON.stringify(value)]
            );
        }
    },

    async getDbPath(): Promise<string> {
        if (!window.electronAPI?.dbGetPath) throw new Error("getDbPath not supported.");
        return window.electronAPI.dbGetPath();
    },

    async backupDatabase() {
        if (!window.electronAPI?.dbBackup) throw new Error("Backup not supported.");
        return window.electronAPI.dbBackup();
    },

    async runIntegrityCheck() {
        if (!window.electronAPI?.dbIntegrityCheck) throw new Error("Integrity check not supported.");
        return window.electronAPI.dbIntegrityCheck();
    },

    async runVacuum() {
        if (!window.electronAPI?.dbVacuum) throw new Error("Vacuum not supported.");
        return window.electronAPI.dbVacuum();
    },

    async getDatabaseStats() {
        if (!window.electronAPI?.dbGetStats) throw new Error("DB stats not supported.");
        return window.electronAPI.dbGetStats();
    }
};
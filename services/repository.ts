import type { Node, Document, DocVersion, DocumentOrFolder, DocumentVersion, DocumentTemplate, Settings, ContentStore, ViewMode, DocType } from '../types';
import { cryptoService } from './cryptoService';
import { EXAMPLE_TEMPLATES, LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
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

const isElectronEnvironment = () => Boolean(window.electronAPI);

let fallbackDocumentIdCounter = 1;
let fallbackVersionIdCounter = 1;
let fallbackContentIdCounter = 1;
let fallbackTemplateCounter = 1;

const fallbackDocVersions = new Map<string, DocVersion[]>();
const fallbackDocumentIdToNodeId = new Map<number, string>();

const cloneDocVersion = (version: DocVersion): DocVersion => ({
    ...version,
    content: version.content,
});

const cloneNodeForReturn = (node: Node): Node => ({
    ...node,
    children: node.children ? node.children.map(cloneNodeForReturn) : [],
    document: node.document ? { ...node.document } : undefined,
    pythonSettings: node.pythonSettings ? { ...node.pythonSettings } : undefined,
});

const collectNodeAndDescendants = (node: Node): Node[] => {
    const allNodes = [node];
    if (node.children) {
        for (const child of node.children) {
            allNodes.push(...collectNodeAndDescendants(child));
        }
    }
    return allNodes;
};

const updateSortOrders = (nodes: Node[]) => {
    nodes.forEach((node, index) => {
        node.sort_order = index;
    });
};

const createDocVersion = (documentId: number, content: string, createdAt: string = new Date().toISOString()): DocVersion => ({
    version_id: fallbackVersionIdCounter++,
    document_id: documentId,
    created_at: createdAt,
    content_id: fallbackContentIdCounter++,
    content,
});

const createFallbackDocumentNode = (
    title: string,
    content: string,
    parentId: string | null,
    sortOrder: number,
    options: { docType?: DocType; languageHint?: string | null; defaultViewMode?: ViewMode | null } = {}
): Node => {
    const now = new Date().toISOString();
    const nodeId = uuidv4();
    const documentId = fallbackDocumentIdCounter++;
    const version = createDocVersion(documentId, content, now);

    const document: Document = {
        document_id: documentId,
        node_id: nodeId,
        doc_type: options.docType ?? 'prompt',
        language_hint: options.languageHint ?? 'markdown',
        default_view_mode: options.defaultViewMode ?? 'edit',
        current_version_id: version.version_id,
        content,
    };

    fallbackDocVersions.set(nodeId, [version]);
    fallbackDocumentIdToNodeId.set(documentId, nodeId);

    return {
        node_id: nodeId,
        parent_id: parentId,
        node_type: 'document',
        title,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
        children: [],
        document,
    };
};

const createFallbackFolderNode = (title: string, parentId: string | null, sortOrder: number): Node => {
    const now = new Date().toISOString();
    return {
        node_id: uuidv4(),
        parent_id: parentId,
        node_type: 'folder',
        title,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
        children: [],
    };
};

const createFallbackTemplates = (): DocumentTemplate[] => {
    const now = Date.now();
    return EXAMPLE_TEMPLATES.map((template, index) => {
        const timestamp = new Date(now - index * 60000).toISOString();
        return {
            template_id: `web-template-${index + 1}`,
            title: template.title,
            content: template.content,
            created_at: timestamp,
            updated_at: timestamp,
        };
    });
};

const createInitialFallbackNodes = (): Node[] => {
    fallbackDocVersions.clear();
    fallbackDocumentIdToNodeId.clear();
    fallbackDocumentIdCounter = 1;
    fallbackVersionIdCounter = 1;
    fallbackContentIdCounter = 1;

    const quickStart = createFallbackDocumentNode(
        'Quick Start Guide',
        '## Welcome to DocForge\n- Browse the sample workspace\n- Open prompts to preview the editor\n- Try the command palette with Ctrl/Cmd + K',
        null,
        0
    );

    const workspace = createFallbackFolderNode('Sample Workspace', null, 1);
    const ideasFolder = createFallbackFolderNode('Ideas', workspace.node_id, 0);
    const brainstorming = createFallbackDocumentNode(
        'Brainstorming Prompt',
        'Generate five feature ideas for {{product_name}} and outline why each idea is compelling.',
        ideasFolder.node_id,
        0
    );
    ideasFolder.children = [brainstorming];
    updateSortOrders(ideasFolder.children);

    const checklist = createFallbackDocumentNode(
        'Release Checklist',
        '1. Draft core prompts\n2. Review template coverage\n3. Collect feedback from the team',
        workspace.node_id,
        1
    );
    const notes = createFallbackDocumentNode(
        'Team Notes',
        'Capture meeting notes, decisions, and next steps right alongside your prompts.',
        workspace.node_id,
        2
    );

    workspace.children = [ideasFolder, checklist, notes];
    updateSortOrders(workspace.children);

    return [quickStart, workspace];
};

const fallbackState = {
    nodes: createInitialFallbackNodes(),
    templates: [] as DocumentTemplate[],
    settings: { ...DEFAULT_SETTINGS },
};

fallbackState.templates = createFallbackTemplates();
fallbackTemplateCounter = fallbackState.templates.length + 1;
updateSortOrders(fallbackState.nodes);

const findNodeWithParent = (nodeId: string, nodes: Node[], parent: Node | null = null): { node: Node; parent: Node | null } | null => {
    for (const node of nodes) {
        if (node.node_id === nodeId) {
            return { node, parent };
        }
        if (node.children) {
            const result = findNodeWithParent(nodeId, node.children, node);
            if (result) return result;
        }
    }
    return null;
};

const detachNode = (nodeId: string): Node | null => {
    const found = findNodeWithParent(nodeId, fallbackState.nodes);
    if (!found) return null;
    const { node, parent } = found;
    const siblings = parent ? parent.children! : fallbackState.nodes;
    const index = siblings.findIndex(n => n.node_id === nodeId);
    if (index === -1) return null;

    const [removed] = siblings.splice(index, 1);
    updateSortOrders(siblings);
    if (parent) {
        parent.updated_at = new Date().toISOString();
    }
    return removed;
};

const deleteNodeInternal = (nodeId: string) => {
    const removed = detachNode(nodeId);
    if (!removed) return;
    for (const node of collectNodeAndDescendants(removed)) {
        if (node.node_type === 'document' && node.document) {
            fallbackDocVersions.delete(node.node_id);
            fallbackDocumentIdToNodeId.delete(node.document.document_id);
        }
    }
};

const insertExistingNode = (node: Node, parentId: string | null, index?: number) => {
    let parentNode: Node | null = null;
    if (parentId) {
        const parentInfo = findNodeWithParent(parentId, fallbackState.nodes);
        if (!parentInfo) {
            throw new Error(`Parent node not found for ID ${parentId}`);
        }
        parentNode = parentInfo.node;
        parentNode.children = parentNode.children ?? [];
    }

    const siblings = parentNode ? parentNode.children! : fallbackState.nodes;
    const insertIndex = index !== undefined ? Math.max(0, Math.min(index, siblings.length)) : siblings.length;
    siblings.splice(insertIndex, 0, node);
    node.parent_id = parentId;
    updateSortOrders(siblings);

    const now = new Date().toISOString();
    node.updated_at = now;
    if (parentNode) {
        parentNode.updated_at = now;
    }
};

const cloneNodeForDuplicate = (source: Node, parentId: string | null): Node => {
    if (source.node_type === 'folder') {
        const folder = createFallbackFolderNode(source.title, parentId, 0);
        folder.children = (source.children ?? []).map((child, index) => {
            const clonedChild = cloneNodeForDuplicate(child, folder.node_id);
            clonedChild.sort_order = index;
            return clonedChild;
        });
        updateSortOrders(folder.children ?? []);
        return folder;
    }

    if (source.node_type === 'document' && source.document) {
        const content = source.document.content ?? '';
        const doc = createFallbackDocumentNode(
            source.title,
            content,
            parentId,
            0,
            {
                docType: source.document.doc_type,
                languageHint: source.document.language_hint,
                defaultViewMode: source.document.default_view_mode,
            }
        );

        const sourceVersions = fallbackDocVersions.get(source.node_id) ?? [];
        if (sourceVersions.length > 0) {
            const clonedVersions = sourceVersions.map(version => {
                const cloned = createDocVersion(doc.document!.document_id, version.content ?? '', version.created_at);
                return cloned;
            });
            fallbackDocVersions.set(doc.node_id, clonedVersions);
            const latest = clonedVersions[clonedVersions.length - 1];
            if (latest) {
                doc.document!.current_version_id = latest.version_id;
                doc.document!.content = latest.content;
            }
        }

        return doc;
    }

    return createFallbackFolderNode(source.title, parentId, 0);
};

const getFallbackVersionsDescending = (nodeId: string): DocVersion[] => {
    const versions = fallbackDocVersions.get(nodeId) ?? [];
    return versions.slice().reverse().map(cloneDocVersion);
};

const ensureElectron = () => {
    if (!window.electronAPI) {
        throw new Error('This feature is only available in the desktop application.');
    }
};

export const repository = {
    _isInitialized: false,

    async init() {
        if (this._isInitialized) return;

        if (!isElectronEnvironment()) {
            console.warn('Electron API is not available. Running in browser preview mode with an in-memory data store.');
            this._isInitialized = true;
            return;
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
        if (!isElectronEnvironment()) {
            console.warn('Skipping legacy data migration because the Electron API is unavailable.');
            return;
        }
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
        if (!isElectronEnvironment()) {
            if (fallbackState.templates.length === 0) {
                fallbackState.templates = createFallbackTemplates();
                fallbackTemplateCounter = fallbackState.templates.length + 1;
            }
            return;
        }
        for (const template of EXAMPLE_TEMPLATES) {
            await this.addTemplate(template);
        }
        console.log("Added default templates to the database.");
    },

    async getNodeTree(): Promise<Node[]> {
        if (!isElectronEnvironment()) {
            return fallbackState.nodes.map(cloneNodeForReturn);
        }
        const flatNodes = await window.electronAPI!.dbQuery(`
            SELECT
                n.*,
                d.document_id, d.doc_type, d.language_hint, d.default_view_mode, d.current_version_id,
                cs.text_content as content,
                ps.env_id as python_env_id,
                ps.auto_detect_env as python_auto_detect_env,
                ps.last_run_id as python_last_run_id
            FROM nodes n
            LEFT JOIN documents d ON n.node_id = d.node_id
            LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
            LEFT JOIN content_store cs ON dv.content_id = cs.content_id
            LEFT JOIN node_python_settings ps ON n.node_id = ps.node_id
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
                pythonSettings: record.python_env_id !== null || record.python_auto_detect_env !== null || record.python_last_run_id !== null ? {
                    nodeId: record.node_id,
                    envId: record.python_env_id,
                    autoDetectEnvironment: record.python_auto_detect_env === null ? true : Boolean(record.python_auto_detect_env),
                    lastUsedRunId: record.python_last_run_id,
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
        if (!isElectronEnvironment()) {
            if (nodeData.node_type === 'document') {
                const newDocumentNode = createFallbackDocumentNode(
                    nodeData.title,
                    nodeData.document?.content ?? '',
                    nodeData.parent_id ?? null,
                    0,
                    {
                        docType: nodeData.document?.doc_type,
                        languageHint: nodeData.document?.language_hint ?? null,
                        defaultViewMode: nodeData.document?.default_view_mode ?? null,
                    }
                );
                insertExistingNode(newDocumentNode, nodeData.parent_id ?? null);
                return cloneNodeForReturn(newDocumentNode);
            }

            const newFolderNode = createFallbackFolderNode(nodeData.title, nodeData.parent_id ?? null, 0);
            insertExistingNode(newFolderNode, nodeData.parent_id ?? null);
            return cloneNodeForReturn(newFolderNode);
        }

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
        if (!isElectronEnvironment()) {
            const found = findNodeWithParent(nodeId, fallbackState.nodes);
            if (!found) {
                throw new Error(`Node not found: ${nodeId}`);
            }

            let targetNode = found.node;
            const now = new Date().toISOString();

            if (updates.parent_id !== undefined && updates.parent_id !== targetNode.parent_id) {
                const detached = detachNode(nodeId);
                if (detached) {
                    targetNode = detached;
                    insertExistingNode(detached, updates.parent_id ?? null);
                }
            }

            if (updates.title !== undefined) {
                targetNode.title = updates.title;
            }

            if (targetNode.node_type === 'document' && targetNode.document) {
                if (updates.language_hint !== undefined) {
                    targetNode.document.language_hint = updates.language_hint;
                }
                if (updates.default_view_mode !== undefined) {
                    targetNode.document.default_view_mode = updates.default_view_mode ?? null;
                }
            }

            targetNode.updated_at = now;
            return;
        }

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
        if (!isElectronEnvironment()) {
            const found = findNodeWithParent(nodeId, fallbackState.nodes);
            if (!found || found.node.node_type !== 'document' || !found.node.document) {
                throw new Error(`Document node not found: ${nodeId}`);
            }

            const node = found.node;
            const document = node.document!;
            document.content = newContent;
            const now = new Date().toISOString();
            node.updated_at = now;
            const versions = fallbackDocVersions.get(nodeId) ?? [];
            const newVersion = createDocVersion(document.document_id, newContent, now);
            versions.push(newVersion);
            fallbackDocVersions.set(nodeId, versions);
            document.current_version_id = newVersion.version_id;
            return;
        }

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
        if (!isElectronEnvironment()) {
            deleteNodeInternal(nodeId);
            return;
        }
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id = ?`, [nodeId]);
    },

    async deleteNodes(nodeIds: string[]) {
        if (nodeIds.length === 0) return;
        if (!isElectronEnvironment()) {
            nodeIds.forEach(id => deleteNodeInternal(id));
            return;
        }
        const placeholders = nodeIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id IN (${placeholders})`, nodeIds);
    },

    async duplicateNodes(nodeIds: string[]) {
        if (!isElectronEnvironment()) {
            for (const nodeId of nodeIds) {
                const found = findNodeWithParent(nodeId, fallbackState.nodes);
                if (!found) continue;
                const { node, parent } = found;
                const siblings = parent ? parent.children! : fallbackState.nodes;
                const targetIndex = siblings.findIndex(n => n.node_id === nodeId);
                const clone = cloneNodeForDuplicate(node, parent ? parent.node_id : null);
                insertExistingNode(clone, parent ? parent.node_id : null, targetIndex + 1);
            }
            return;
        }
        if (!window.electronAPI?.dbDuplicateNodes) return;
        const result = await window.electronAPI.dbDuplicateNodes(nodeIds);
        if (!result.success) {
            throw new Error(result.error || 'Failed to duplicate nodes in the main process.');
        }
    },

    async moveNodes(draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') {
        if (!isElectronEnvironment()) {
            const movedNodes: Node[] = [];
            for (const id of draggedIds) {
                const detached = detachNode(id);
                if (detached) {
                    movedNodes.push(detached);
                }
            }

            let parentId: string | null = null;
            let insertIndex = 0;

            if (position === 'inside') {
                parentId = targetId ?? null;
                const parentInfo = parentId ? findNodeWithParent(parentId, fallbackState.nodes) : null;
                const siblings = parentInfo ? (parentInfo.node.children ?? (parentInfo.node.children = [])) : fallbackState.nodes;
                insertIndex = siblings.length;
            } else {
                if (targetId) {
                    const targetInfo = findNodeWithParent(targetId, fallbackState.nodes);
                    if (!targetInfo) {
                        throw new Error(`Target node not found: ${targetId}`);
                    }
                    parentId = targetInfo.parent ? targetInfo.parent.node_id : null;
                    const siblings = targetInfo.parent ? targetInfo.parent.children! : fallbackState.nodes;
                    const targetIndex = siblings.findIndex(s => s.node_id === targetId);
                    insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
                } else {
                    parentId = null;
                    insertIndex = position === 'before' ? 0 : fallbackState.nodes.length;
                }
            }

            movedNodes.forEach((node, index) => {
                insertExistingNode(node, parentId, insertIndex + index);
            });
            return;
        }

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
        if (!isElectronEnvironment()) {
            return getFallbackVersionsDescending(nodeId);
        }
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
        if (!isElectronEnvironment()) {
            const nodeId = fallbackDocumentIdToNodeId.get(documentId);
            if (!nodeId) return;
            const versions = fallbackDocVersions.get(nodeId) ?? [];
            const remaining = versions.filter(version => !versionIds.includes(version.version_id));
            fallbackDocVersions.set(nodeId, remaining);
            const found = findNodeWithParent(nodeId, fallbackState.nodes);
            if (found && found.node.document) {
                const latest = remaining[remaining.length - 1] ?? null;
                found.node.document.current_version_id = latest ? latest.version_id : null;
                found.node.document.content = latest?.content;
            }
            return;
        }
        if (!window.electronAPI?.dbDeleteVersions) {
            throw new Error("Version deletion is not supported in this environment.");
        }
        const result = await window.electronAPI.dbDeleteVersions(documentId, versionIds);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete versions in main process.');
        }
    },
    
    async getAllTemplates(): Promise<DocumentTemplate[]> {
        if (!isElectronEnvironment()) {
            return fallbackState.templates.map(template => ({ ...template }));
        }
        return window.electronAPI!.dbQuery(`SELECT * FROM templates ORDER BY title`);
    },
    
    async addTemplate(templateData: Omit<DocumentTemplate, 'template_id' | 'created_at' | 'updated_at'>): Promise<DocumentTemplate> {
        if (!isElectronEnvironment()) {
            const now = new Date().toISOString();
            const template: DocumentTemplate = {
                template_id: `web-template-${fallbackTemplateCounter++}`,
                title: templateData.title,
                content: templateData.content,
                created_at: now,
                updated_at: now,
            };
            fallbackState.templates.push(template);
            return { ...template };
        }
        const newId = uuidv4();
        const now = new Date().toISOString();
        await window.electronAPI!.dbRun(
            `INSERT INTO templates (template_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [newId, templateData.title, templateData.content, now, now]
        );
        return { ...templateData, template_id: newId, created_at: now, updated_at: now };
    },
    
    async updateTemplate(templateId: string, updates: Partial<Omit<DocumentTemplate, 'template_id'>>) {
        if (!isElectronEnvironment()) {
            const template = fallbackState.templates.find(t => t.template_id === templateId);
            if (!template) return;
            if (updates.title !== undefined) template.title = updates.title as string;
            if (updates.content !== undefined) template.content = updates.content as string;
            template.updated_at = new Date().toISOString();
            return;
        }
         const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
         if(fields.length === 0) return;
         await window.electronAPI!.dbRun(
            `UPDATE templates SET ${fields}, updated_at = ? WHERE template_id = ?`,
            [...Object.values(updates), new Date().toISOString(), templateId]
        );
    },

    async deleteTemplate(templateId: string) {
        if (!isElectronEnvironment()) {
            fallbackState.templates = fallbackState.templates.filter(t => t.template_id !== templateId);
            return;
        }
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id = ?`, [templateId]);
    },

    async deleteTemplates(templateIds: string[]) {
        if (templateIds.length === 0) return;
        if (!isElectronEnvironment()) {
            fallbackState.templates = fallbackState.templates.filter(t => !templateIds.includes(t.template_id));
            return;
        }
        const placeholders = templateIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id IN (${placeholders})`, templateIds);
    },

    async getAllSettings(): Promise<Settings> {
        if (!isElectronEnvironment()) {
            return JSON.parse(JSON.stringify(fallbackState.settings));
        }
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
        if (!isElectronEnvironment()) {
            fallbackState.settings = { ...settings };
            return;
        }
        for (const [key, value] of Object.entries(settings)) {
            await window.electronAPI!.dbRun(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                [key, JSON.stringify(value)]
            );
        }
    },

    async importFiles(filesData: {path: string, name: string, content: string}[], targetParentId: string | null) {
        if (!isElectronEnvironment()) {
            for (const file of filesData) {
                await this.addNode({
                    parent_id: targetParentId,
                    node_type: 'document',
                    title: file.name,
                    document: {
                        doc_type: 'prompt',
                        language_hint: 'markdown',
                        default_view_mode: 'edit',
                        current_version_id: null,
                        document_id: 0,
                        node_id: '',
                        content: file.content,
                    } as unknown as Document,
                } as any);
            }
            return;
        }
        if (!window.electronAPI?.dbImportFiles) {
            throw new Error("File import is not supported in this environment.");
        }
        const result = await window.electronAPI.dbImportFiles(filesData, targetParentId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to import files in main process.');
        }
    },

    async getDbPath(): Promise<string> {
        ensureElectron();
        if (!window.electronAPI?.dbGetPath) throw new Error("getDbPath not supported.");
        return window.electronAPI.dbGetPath();
    },

    async backupDatabase() {
        ensureElectron();
        if (!window.electronAPI?.dbBackup) throw new Error("Backup not supported.");
        return window.electronAPI.dbBackup();
    },

    async runIntegrityCheck() {
        ensureElectron();
        if (!window.electronAPI?.dbIntegrityCheck) throw new Error("Integrity check not supported.");
        return window.electronAPI.dbIntegrityCheck();
    },

    async runVacuum() {
        ensureElectron();
        if (!window.electronAPI?.dbVacuum) throw new Error("Vacuum not supported.");
        return window.electronAPI.dbVacuum();
    },

    async getDatabaseStats() {
        ensureElectron();
        if (!window.electronAPI?.dbGetStats) throw new Error("DB stats not supported.");
        return window.electronAPI.dbGetStats();
    }
};

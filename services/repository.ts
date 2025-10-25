import type {
  Node,
  Document,
  DocVersion,
  NodeType,
  DocType,
  DocumentOrFolder,
  DocumentVersion,
  DocumentTemplate,
  Settings,
  ContentStore,
  ViewMode,
  ImportedNodeSummary,
  DatabaseLoadResult,
  SerializedNodeForTransfer,
  DraggedNodeTransfer,
  ClassificationSummary,
  ClassificationSource,
} from '../types';
import { cryptoService } from './cryptoService';
import { DEFAULT_SETTINGS, EXAMPLE_TEMPLATES, LOCAL_STORAGE_KEYS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { classifyDocumentContent } from './classificationService';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

type BrowserState = {
    nodes: Node[];
    templates: DocumentTemplate[];
    settings: Settings;
    docVersions: Record<number, DocVersion[]>;
    nextDocumentId: number;
    nextVersionId: number;
};

const BROWSER_STATE_STORAGE_KEY = 'docforge:browser-state:v1';

const cloneNodeTree = (nodes: Node[]): Node[] =>
    nodes.map(node => ({
        ...node,
        document: node.document ? { ...node.document } : undefined,
        pythonSettings: node.pythonSettings ? { ...node.pythonSettings } : undefined,
        children: node.children ? cloneNodeTree(node.children) : undefined,
    }));

const cloneDocVersions = (versions: DocVersion[] = []): DocVersion[] =>
    versions.map(version => ({ ...version }));

const persistBrowserState = (state: BrowserState | null) => {
    if (typeof window === 'undefined' || !window.localStorage || !state) return;
    window.localStorage.setItem(BROWSER_STATE_STORAGE_KEY, JSON.stringify(state));
};

const sortNodeTree = (nodes: Node[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) {
        if (node.children) {
            sortNodeTree(node.children);
        }
    }
};

const createSampleBrowserState = (): BrowserState => {
    const now = new Date().toISOString();
    const rootId = 'sample-root';
    const documentNodeId = 'sample-doc';
    const documentId = 1;
    const versionId = 1;
    const sampleContent = '# Welcome to DocForge\n\nThis is a static dataset provided for browser preview mode.';

    const document: Document = {
        document_id: documentId,
        node_id: documentNodeId,
        doc_type: 'prompt',
        language_hint: 'markdown',
        default_view_mode: 'split-vertical',
        language_source: 'user',
        doc_type_source: 'user',
        classification_updated_at: now,
        current_version_id: versionId,
        content: sampleContent,
    };

    const documentNode: Node = {
        node_id: documentNodeId,
        parent_id: rootId,
        node_type: 'document',
        title: 'Getting Started',
        sort_order: 0,
        created_at: now,
        updated_at: now,
        document,
    };

    const rootNode: Node = {
        node_id: rootId,
        parent_id: null,
        node_type: 'folder',
        title: 'Sample Workspace',
        sort_order: 0,
        created_at: now,
        updated_at: now,
        children: [documentNode],
    };

    return {
        nodes: [rootNode],
        templates: EXAMPLE_TEMPLATES.map((template, index) => ({
            ...template,
            template_id: `sample-template-${index}`,
            created_at: now,
            updated_at: now,
        })),
        settings: { ...DEFAULT_SETTINGS },
        docVersions: {
            [documentId]: [
                {
                    version_id: versionId,
                    document_id: documentId,
                    created_at: now,
                    content_id: versionId,
                    content: sampleContent,
                },
            ],
        },
        nextDocumentId: documentId + 1,
        nextVersionId: versionId + 1,
    };
};

const loadBrowserState = (): BrowserState => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return createSampleBrowserState();
    }

    const raw = window.localStorage.getItem(BROWSER_STATE_STORAGE_KEY);
    if (!raw) {
        return createSampleBrowserState();
    }

    try {
        const parsed = JSON.parse(raw) as BrowserState;
        // Ensure arrays exist and sort orders are respected.
        sortNodeTree(parsed.nodes);
        return parsed;
    } catch {
        return createSampleBrowserState();
    }
};

let browserState: BrowserState | null = isElectron ? null : loadBrowserState();

const ensureBrowserState = (): BrowserState => {
    if (!browserState) {
        browserState = loadBrowserState();
    }
    return browserState;
};

const ensureChildrenArray = (node: Node): Node[] => {
    if (!node.children) {
        node.children = [];
    }
    return node.children;
};

const findNodeWithParent = (
    nodeId: string,
    nodes: Node[],
    parent: Node | null = null,
): { node: Node | null; parent: Node | null; index: number } => {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.node_id === nodeId) {
            return { node, parent, index: i };
        }
        if (node.children) {
            const result = findNodeWithParent(nodeId, node.children, node);
            if (result.node) {
                return result;
            }
        }
    }
    return { node: null, parent: null, index: -1 };
};

const removeNodeFromCollection = (collection: Node[], index: number) => {
    collection.splice(index, 1);
};

const collectDescendantNodeIds = (node: Node, accumulator: string[] = []): string[] => {
    accumulator.push(node.node_id);
    if (node.children) {
        for (const child of node.children) {
            collectDescendantNodeIds(child, accumulator);
        }
    }
    return accumulator;
};

const deleteDocumentData = (state: BrowserState, node: Node) => {
    if (node.document) {
        delete state.docVersions[node.document.document_id];
    }
    if (node.children) {
        for (const child of node.children) {
            deleteDocumentData(state, child);
        }
    }
};

const mapNodeTree = (nodes: Node[], mapper: (node: Node) => void) => {
    for (const node of nodes) {
        mapper(node);
        if (node.children) {
            mapNodeTree(node.children, mapper);
        }
    }
};

const escapeForLikePattern = (value: string): string => value.replace(/([\\%_])/g, '\\$1');

const createSnippetFromContent = (content: string, term: string, snippetLength: number = 160): string => {
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    if (!normalizedContent) {
        return '';
    }

    const lowerContent = normalizedContent.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerTerm);

    if (matchIndex === -1) {
        if (normalizedContent.length <= snippetLength) {
            return normalizedContent;
        }
        return `${normalizedContent.slice(0, snippetLength).trim()}…`;
    }

    const halfWindow = Math.max(0, Math.floor((snippetLength - lowerTerm.length) / 2));
    let start = Math.max(0, matchIndex - halfWindow);
    let end = Math.min(normalizedContent.length, matchIndex + lowerTerm.length + halfWindow);

    if (end - start > snippetLength) {
        end = start + snippetLength;
    }

    let snippet = normalizedContent.slice(start, end).trim();
    if (start > 0) {
        snippet = `…${snippet}`;
    }
    if (end < normalizedContent.length) {
        snippet = `${snippet}…`;
    }
    return snippet;
};

const duplicateNodeRecursive = (state: BrowserState, node: Node, newParentId: string | null, sortOrder: number): Node => {
    const now = new Date().toISOString();
    const clonedNode: Node = {
        ...node,
        node_id: uuidv4(),
        parent_id: newParentId,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
        document: node.document ? { ...node.document } : undefined,
        children: undefined,
    };

    if (clonedNode.document) {
        const newDocumentId = state.nextDocumentId++;
        const originalDocumentId = clonedNode.document.document_id;
        clonedNode.document = {
            ...clonedNode.document,
            document_id: newDocumentId,
            node_id: clonedNode.node_id,
            current_version_id: null,
        };
        const versions = state.docVersions[originalDocumentId] || [];
        const clonedVersions: DocVersion[] = versions.map(version => {
            const newVersionId = state.nextVersionId++;
            return {
                ...version,
                version_id: newVersionId,
                document_id: newDocumentId,
                content_id: newVersionId,
            };
        });
        if (clonedVersions.length > 0) {
            clonedNode.document.current_version_id = clonedVersions[clonedVersions.length - 1].version_id;
        } else if (clonedNode.document.content) {
            const versionId = state.nextVersionId++;
            clonedVersions.push({
                version_id: versionId,
                document_id: newDocumentId,
                created_at: now,
                content_id: versionId,
                content: clonedNode.document.content,
            });
            clonedNode.document.current_version_id = versionId;
        }
        state.docVersions[newDocumentId] = clonedVersions;
    }

    if (node.children) {
        clonedNode.children = node.children.map((child, index) =>
            duplicateNodeRecursive(state, child, clonedNode.node_id, index)
        );
    }

    return clonedNode;
};

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

export type RepositoryStartupTiming = {
    step: string;
    durationMs: number;
    success: boolean;
    detail?: string;
    error?: string;
};

const getTimestamp = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export const repository = {
    _isInitialized: false,

    async init(): Promise<RepositoryStartupTiming[]> {
        const timings: RepositoryStartupTiming[] = [];
        const runStartedAt = getTimestamp();

        const pushTiming = (entry: RepositoryStartupTiming) => {
            timings.push(entry);
            const formattedDuration = entry.durationMs.toFixed(1);
            const detailPart = entry.detail ? ` (${entry.detail})` : '';
            const baseMessage = `[Startup] ${entry.step} ${entry.success ? 'completed' : 'failed'} in ${formattedDuration}ms${detailPart}`;
            if (entry.success) {
                console.log(baseMessage);
            } else {
                const errorMessage = entry.error ? `${baseMessage}: ${entry.error}` : baseMessage;
                console.error(errorMessage);
            }
        };

        const withTimingsAttached = (error: unknown): Error => {
            if (error instanceof Error) {
                (error as Error & { startupTimings?: RepositoryStartupTiming[] }).startupTimings = timings.slice();
                return error;
            }
            const err = new Error(String(error));
            (err as Error & { startupTimings?: RepositoryStartupTiming[] }).startupTimings = timings.slice();
            return err;
        };

        const runStep = async <T>(
            step: string,
            fn: () => Promise<T> | T,
            detail?: (result: T) => string | undefined,
        ): Promise<T> => {
            const stepStartedAt = getTimestamp();
            try {
                const result = await fn();
                const durationMs = getTimestamp() - stepStartedAt;
                const detailValue = detail?.(result);
                pushTiming({ step, durationMs, success: true, detail: detailValue });
                return result;
            } catch (error) {
                const durationMs = getTimestamp() - stepStartedAt;
                const errorMessage = error instanceof Error ? error.message : String(error);
                pushTiming({ step, durationMs, success: false, error: errorMessage });
                throw withTimingsAttached(error);
            }
        };

        if (this._isInitialized) {
            pushTiming({
                step: 'Repository initialization',
                durationMs: 0,
                success: true,
                detail: 'Skipped (already initialized)',
            });
            return timings;
        }

        try {
            if (!isElectron) {
                await runStep('Load browser preview state', async () => {
                    ensureBrowserState();
                });
                console.warn('Repository initialized in browser preview mode. Data will not be persisted to a local database.');
                this._isInitialized = true;
            } else {
                if (!window.electronAPI) {
                    throw new Error("Electron API is not available. This application is designed to run in Electron.");
                }

                const isNewDb = await runStep(
                    'Check if database is new',
                    () => window.electronAPI!.dbIsNew(),
                    result => `result: ${result}`,
                );
                const legacyPromptsExist = await runStep(
                    'Check for legacy prompt data',
                    () => window.electronAPI!.legacyFileExists(LOCAL_STORAGE_KEYS.LEGACY_PROMPTS),
                    result => `result: ${result}`,
                );

                if (isNewDb && legacyPromptsExist) {
                    await runStep('Migrate legacy data', () => this.migrateFromJson());
                }

                const templates = await runStep(
                    'Load templates',
                    () => this.getAllTemplates(),
                    result => `count: ${result.length}`,
                );
                if (templates.length === 0) {
                    await runStep('Seed default templates', () => this.addDefaultTemplates());
                }

                this._isInitialized = true;
            }

            const totalDuration = getTimestamp() - runStartedAt;
            pushTiming({ step: 'Repository initialization total', durationMs: totalDuration, success: true });
            return timings;
        } catch (error) {
            throw withTimingsAttached(error);
        }
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
        if (!isElectron) {
            const state = ensureBrowserState();
            const cloned = cloneNodeTree(state.nodes);
            sortNodeTree(cloned);
            return cloned;
        }

        if (!window.electronAPI) return [];
        const flatNodes = await window.electronAPI.dbQuery(`
            SELECT
                n.*,
                d.document_id, d.doc_type, d.language_hint, d.language_source, d.doc_type_source, d.classification_updated_at, d.default_view_mode, d.current_version_id,
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
                    language_source: record.language_source ?? 'unknown',
                    doc_type_source: record.doc_type_source ?? 'unknown',
                    classification_updated_at: record.classification_updated_at ?? null,
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

    async searchDocumentsByBody(searchTerm: string, limit: number = 50): Promise<{ nodeId: string; snippet: string }[]> {
        const term = searchTerm.trim();
        if (!term) {
            return [];
        }

        if (limit <= 0) {
            return [];
        }

        if (!isElectron) {
            const state = ensureBrowserState();
            const lowerTerm = term.toLowerCase();
            const results: { nodeId: string; snippet: string }[] = [];
            mapNodeTree(state.nodes, node => {
                if (node.node_type !== 'document' || !node.document?.content) {
                    return;
                }
                const content = node.document.content;
                if (content.toLowerCase().includes(lowerTerm)) {
                    results.push({
                        nodeId: node.node_id,
                        snippet: createSnippetFromContent(content, term),
                    });
                }
            });
            return results.slice(0, Math.max(limit, 0));
        }

        if (!window.electronAPI) {
            return [];
        }

        const maxResults = Math.max(limit, 0) || 50;
        const reservedOperators = new Set(['AND', 'OR', 'NOT', 'NEAR']);
        const sanitizedTerms = (term.match(/\S+/g) ?? [])
            .map(part => part.replace(/[^\p{L}\p{N}]/gu, '').trim())
            .filter(token => token.length > 0 && !reservedOperators.has(token.toUpperCase()));
        const ftsQuery = sanitizedTerms.length > 0
            ? sanitizedTerms.map(token => `${token}*`).join(' ')
            : term.replace(/["'`*^]/g, '');

        try {
            const rows = await window.electronAPI.dbQuery(
                `
                SELECT node_id, title, body
                FROM document_search
                WHERE document_search MATCH ?
                ORDER BY bm25(document_search)
                LIMIT ?
            `,
                [ftsQuery, maxResults],
            );

            const seen = new Set<string>();

            return rows
                .filter(row => typeof row.node_id === 'string' && !seen.has(row.node_id))
                .map(row => {
                    seen.add(row.node_id);
                    const body = typeof row.body === 'string' ? row.body : '';
                    const title = typeof row.title === 'string' ? row.title : '';
                    const source = body.trim().length > 0 ? body : title;
                    const snippet = createSnippetFromContent(source, term) || title;
                    return {
                        nodeId: row.node_id,
                        snippet,
                    };
                });
        } catch (error) {
            console.warn('FTS query failed, falling back to LIKE search', error);

            const lowerTerm = term.toLowerCase();
            const pattern = `%${escapeForLikePattern(lowerTerm)}%`;

            const rows = await window.electronAPI.dbQuery(
                `
                SELECT
                  d.node_id AS node_id,
                  n.title AS title,
                  COALESCE(cs.text_content, '') AS body
                FROM documents d
                JOIN nodes n ON d.node_id = n.node_id
                LEFT JOIN doc_versions dv ON d.current_version_id = dv.version_id
                LEFT JOIN content_store cs ON dv.content_id = cs.content_id
                WHERE (
                  cs.text_content IS NOT NULL
                  AND cs.text_content != ''
                  AND LOWER(cs.text_content) LIKE ? ESCAPE '\\'
                ) OR LOWER(n.title) LIKE ? ESCAPE '\\'
                LIMIT ?
            `,
                [pattern, pattern, maxResults],
            );

            const seen = new Set<string>();

            return rows
                .filter(row => typeof row.node_id === 'string' && !seen.has(row.node_id))
                .map(row => {
                    seen.add(row.node_id);
                    const body = typeof row.body === 'string' ? row.body : '';
                    const title = typeof row.title === 'string' ? row.title : '';
                    const source = body.trim().length > 0 ? body : title;
                    const snippet = createSnippetFromContent(source, term) || title;
                    return {
                        nodeId: row.node_id,
                        snippet,
                    };
                });
        }
    },

    async addNode(nodeData: Omit<Node, 'node_id' | 'sort_order' | 'created_at' | 'updated_at'>): Promise<Node> {
        if (!isElectron) {
            const state = ensureBrowserState();
            const now = new Date().toISOString();
            const newNodeId = uuidv4();
            const baseNode: Node = {
                node_id: newNodeId,
                parent_id: nodeData.parent_id,
                node_type: nodeData.node_type,
                title: nodeData.title,
                sort_order: 0,
                created_at: now,
                updated_at: now,
            };

            let siblings: Node[];
            if (nodeData.parent_id) {
                const { node: parentNode } = findNodeWithParent(nodeData.parent_id, state.nodes);
                siblings = parentNode ? ensureChildrenArray(parentNode) : state.nodes;
                if (!parentNode) {
                    baseNode.parent_id = null;
                }
            } else {
                siblings = state.nodes;
            }

            baseNode.sort_order = siblings.length;

            if (nodeData.node_type === 'document') {
                const documentId = state.nextDocumentId++;
                const content = nodeData.document?.content ?? '';
                let versionId: number | null = null;
                if (content) {
                    versionId = state.nextVersionId++;
                }
                const docType = nodeData.document?.doc_type ?? 'prompt';
                const languageHint = nodeData.document?.language_hint ?? null;
                const languageSource = nodeData.document?.language_source ?? (languageHint ? 'user' : 'unknown');
                const docTypeSource = nodeData.document?.doc_type_source ?? (docType ? 'user' : 'unknown');
                const classificationUpdatedAt = nodeData.document?.classification_updated_at ?? (languageSource === 'auto' || docTypeSource === 'auto' ? now : null);
                baseNode.document = {
                    document_id: documentId,
                    node_id: newNodeId,
                    doc_type: docType,
                    language_hint: languageHint,
                    language_source: languageSource,
                    doc_type_source: docTypeSource,
                    classification_updated_at: classificationUpdatedAt,
                    default_view_mode: nodeData.document?.default_view_mode ?? null,
                    current_version_id: versionId,
                    content,
                };
                state.docVersions[documentId] = [];
                if (content && versionId) {
                    state.docVersions[documentId].push({
                        version_id: versionId,
                        document_id: documentId,
                        created_at: now,
                        content_id: versionId,
                        content,
                    });
                }
            }

            siblings.push(baseNode);
            persistBrowserState(state);
            return cloneNodeTree([baseNode])[0];
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
            const docType = nodeData.document.doc_type ?? 'prompt';
            const languageHint = nodeData.document.language_hint ?? null;
            const languageSource = nodeData.document.language_source ?? (languageHint ? 'user' : 'unknown');
            const docTypeSource = nodeData.document.doc_type_source ?? (docType ? 'user' : 'unknown');
            const classificationUpdatedAt = nodeData.document.classification_updated_at ?? (languageSource === 'auto' || docTypeSource === 'auto' ? now : null);
            const defaultViewMode = nodeData.document.default_view_mode ?? null;

            const docRes = await window.electronAPI!.dbRun(
                `INSERT INTO documents (node_id, doc_type, language_hint, language_source, doc_type_source, classification_updated_at, default_view_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newNodeId, docType, languageHint, languageSource, docTypeSource, classificationUpdatedAt, defaultViewMode]
            );
            const documentId = docRes.lastInsertRowid;

            if (nodeData.document.content) {
                await this.updateDocumentContent(newNodeId, nodeData.document.content, documentId as number);
            }
        }

        const createdNode = await window.electronAPI!.dbGet(`SELECT * FROM nodes WHERE node_id = ?`, [newNodeId]);
        return createdNode as Node;
    },
    async createDocumentFromClipboard({ parentId, content, title }: { parentId: string | null; content: string; title?: string | null; }): Promise<{ node: Node; summary: ClassificationSummary }> {
        const effectiveContent = content ?? '';
        const classification = classifyDocumentContent({ content: effectiveContent, title });
        const classificationTimestamp = new Date().toISOString();
        const resolvedTitle = title?.trim()?.length ? title.trim() : 'Clipboard Document';
        const newNode = await this.addNode({
            parent_id: parentId,
            node_type: 'document',
            title: resolvedTitle,
            document: {
                content: effectiveContent,
                doc_type: classification.docType,
                language_hint: classification.languageHint,
                language_source: classification.languageSource,
                doc_type_source: classification.docTypeSource,
                classification_updated_at: classificationTimestamp,
                default_view_mode: classification.defaultViewMode ?? null,
            } as any,
        });

        return { node: newNode, summary: classification.summary };
    },
    async updateNode(nodeId: string, updates: Partial<Pick<Node, 'title' | 'parent_id'> & { language_hint?: string | null; default_view_mode?: ViewMode | null }>) {
        if (!isElectron) {
            const state = ensureBrowserState();
            const result = findNodeWithParent(nodeId, state.nodes);
            if (!result.node) return;

            const now = new Date().toISOString();
            const node = result.node;
            if (updates.title !== undefined) {
                node.title = updates.title ?? node.title;
            }

            if (updates.parent_id !== undefined && updates.parent_id !== node.parent_id) {
                const currentCollection = result.parent ? ensureChildrenArray(result.parent) : state.nodes;
                currentCollection.splice(result.index, 1);
                currentCollection.forEach((child, index) => {
                    child.sort_order = index;
                });

                node.parent_id = updates.parent_id ?? null;
                const parentLookup = updates.parent_id ? findNodeWithParent(updates.parent_id, state.nodes) : { node: null, parent: null, index: -1 };
                const newParent = parentLookup.node;
                const targetCollection = newParent ? ensureChildrenArray(newParent) : state.nodes;
                node.sort_order = targetCollection.length;
                targetCollection.push(node);
            }

            if (node.document) {
                if (updates.language_hint !== undefined) {
                    node.document.language_hint = updates.language_hint;
                    node.document.language_source = 'user';
                    node.document.classification_updated_at = now;
                }
                if (updates.default_view_mode !== undefined) {
                    node.document.default_view_mode = updates.default_view_mode;
                }
            }

            node.updated_at = now;
            persistBrowserState(state);
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
                `UPDATE documents SET language_hint = ?, language_source = 'user', classification_updated_at = ? WHERE node_id = ?`,
                [updates.language_hint, now, nodeId]
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
        if (!isElectron) {
            const state = ensureBrowserState();
            const { node } = findNodeWithParent(nodeId, state.nodes);
            if (!node || !node.document) {
                throw new Error(`No document found for node ${nodeId}`);
            }

            const docId = node.document.document_id;
            const now = new Date().toISOString();
            node.document.content = newContent;
            const versionId = state.nextVersionId++;
            node.document.current_version_id = versionId;
            node.updated_at = now;

            const versions = state.docVersions[docId] ?? [];
            versions.push({
                version_id: versionId,
                document_id: docId,
                created_at: now,
                content_id: versionId,
                content: newContent,
            });
            state.docVersions[docId] = versions;
            persistBrowserState(state);
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
        if (!isElectron) {
            const state = ensureBrowserState();
            const result = findNodeWithParent(nodeId, state.nodes);
            if (!result.node) return;
            const collection = result.parent ? ensureChildrenArray(result.parent) : state.nodes;
            const [removed] = collection.splice(result.index, 1);
            if (removed) {
                deleteDocumentData(state, removed);
            }
            collection.forEach((child, index) => {
                child.sort_order = index;
            });
            persistBrowserState(state);
            return;
        }
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id = ?`, [nodeId]);
    },

    async deleteNodes(nodeIds: string[]) {
        if (nodeIds.length === 0) return;
        if (!isElectron) {
            for (const id of nodeIds) {
                await this.deleteNode(id);
            }
            return;
        }
        const placeholders = nodeIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM nodes WHERE node_id IN (${placeholders})`, nodeIds);
    },

    async duplicateNodes(nodeIds: string[]) {
        if (!isElectron) {
            const state = ensureBrowserState();
            for (const id of nodeIds) {
                const { node, parent } = findNodeWithParent(id, state.nodes);
                if (!node) continue;
                const targetCollection = parent ? ensureChildrenArray(parent) : state.nodes;
                const clone = duplicateNodeRecursive(state, node, parent ? parent.node_id : null, targetCollection.length);
                targetCollection.push(clone);
            }
            persistBrowserState(state);
            return;
        }
        if (!window.electronAPI?.dbDuplicateNodes) return;
        const result = await window.electronAPI.dbDuplicateNodes(nodeIds);
        if (!result.success) {
            throw new Error(result.error || 'Failed to duplicate nodes in the main process.');
        }
    },
    
    async moveNodes(draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') {
        if (!isElectron) {
            const state = ensureBrowserState();
            const extracted: Node[] = [];
            for (const id of draggedIds) {
                const result = findNodeWithParent(id, state.nodes);
                if (!result.node) continue;
                const sourceCollection = result.parent ? ensureChildrenArray(result.parent) : state.nodes;
                const [removed] = sourceCollection.splice(result.index, 1);
                if (removed) {
                    extracted.push(removed);
                }
                sourceCollection.forEach((child, index) => {
                    child.sort_order = index;
                });
            }

            let targetCollection: Node[];
            let insertIndex: number;

            if (position === 'inside') {
                const targetInfo = targetId ? findNodeWithParent(targetId, state.nodes) : { node: null, parent: null, index: -1 };
                const targetNode = targetInfo.node;
                targetCollection = targetNode ? ensureChildrenArray(targetNode) : state.nodes;
                insertIndex = targetCollection.length;
                const parentId = targetNode ? targetNode.node_id : null;
                for (const node of extracted) {
                    node.parent_id = parentId;
                }
            } else {
                const targetInfo = targetId ? findNodeWithParent(targetId, state.nodes) : { node: null, parent: null, index: -1 };
                targetCollection = targetInfo.parent ? ensureChildrenArray(targetInfo.parent) : state.nodes;
                if (!targetInfo.node) {
                    insertIndex = targetCollection.length;
                } else {
                    insertIndex = position === 'before' ? targetInfo.index : targetInfo.index + 1;
                }
                const parentId = targetInfo.parent ? targetInfo.parent.node_id : null;
                for (const node of extracted) {
                    node.parent_id = parentId;
                }
            }

            targetCollection.splice(insertIndex, 0, ...extracted);
            targetCollection.forEach((node, index) => {
                node.sort_order = index;
            });
            persistBrowserState(state);
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

    async importNodesFromTransfer(
        payload: DraggedNodeTransfer,
        targetId: string | null,
        position: 'before' | 'after' | 'inside'
    ): Promise<string[]> {
        const nodesToInsert = Array.isArray(payload?.nodes) ? payload.nodes : [];
        if (nodesToInsert.length === 0) {
            return [];
        }

        if (!isElectron) {
            const state = ensureBrowserState();

            const resolveTarget = () => {
                if (position === 'inside') {
                    const targetInfo = targetId ? findNodeWithParent(targetId, state.nodes) : { node: null, parent: null, index: -1 };
                    const targetNode = targetInfo.node;
                    const collection = targetNode ? ensureChildrenArray(targetNode) : state.nodes;
                    return {
                        collection,
                        parentId: targetNode ? targetNode.node_id : null,
                        insertIndex: collection.length,
                    };
                }

                const targetInfo = targetId ? findNodeWithParent(targetId, state.nodes) : { node: null, parent: null, index: -1 };
                const parentNode = targetInfo.parent;
                const collection = parentNode ? ensureChildrenArray(parentNode) : state.nodes;
                const insertIndex = targetInfo.node
                    ? (position === 'before' ? targetInfo.index : targetInfo.index + 1)
                    : collection.length;
                return {
                    collection,
                    parentId: parentNode ? parentNode.node_id : null,
                    insertIndex,
                };
            };

            const { collection, parentId, insertIndex } = resolveTarget();

            const allowedDocTypes: DocType[] = ['prompt', 'source_code', 'pdf', 'image'];
            const allowedViewModes: ViewMode[] = ['edit', 'preview', 'split-vertical', 'split-horizontal'];

            const createdIds: string[] = [];

            const insertRecursive = (
                node: SerializedNodeForTransfer,
                currentParentId: string | null,
                sortOrder: number,
                isRoot: boolean,
            ): Node => {
                const now = new Date().toISOString();
                const nodeType: NodeType = node.type === 'folder' ? 'folder' : 'document';
                const newNodeId = uuidv4();
                const baseNode: Node = {
                    node_id: newNodeId,
                    parent_id: currentParentId,
                    node_type: nodeType,
                    title: node.title ?? 'Untitled',
                    sort_order: sortOrder,
                    created_at: now,
                    updated_at: now,
                    children: [],
                };

                if (isRoot) {
                    createdIds.push(newNodeId);
                }

                if (nodeType === 'document') {
                    let docType: DocType | null = allowedDocTypes.includes(node.doc_type as DocType)
                        ? (node.doc_type as DocType)
                        : null;
                    let languageHint = typeof node.language_hint === 'string' && node.language_hint.trim().length > 0 ? node.language_hint : null;
                    let defaultViewMode = allowedViewModes.includes(node.default_view_mode as ViewMode)
                        ? (node.default_view_mode as ViewMode)
                        : null;

                    const incomingLanguageSource = (node.language_source as ClassificationSource | undefined) ?? null;
                    const incomingDocTypeSource = (node.doc_type_source as ClassificationSource | undefined) ?? null;
                    let languageSource: ClassificationSource = incomingLanguageSource ?? (languageHint ? 'imported' : 'unknown');
                    let docTypeSource: ClassificationSource = incomingDocTypeSource ?? (docType ? 'imported' : 'unknown');
                    let classificationUpdatedAt: string | null = typeof node.classification_updated_at === 'string'
                        ? node.classification_updated_at
                        : null;

                    const content = typeof node.content === 'string' ? node.content : '';
                    const shouldClassify = (!languageHint && incomingLanguageSource !== 'user') || (!docType && incomingDocTypeSource !== 'user');

                    if (shouldClassify) {
                        const classification = classifyDocumentContent({ content, title: node.title });
                        if (!languageHint) {
                            languageHint = classification.languageHint;
                            languageSource = classification.languageSource;
                        }
                        if (!docType) {
                            docType = classification.docType;
                            docTypeSource = classification.docTypeSource;
                        }
                        if (!defaultViewMode && classification.defaultViewMode) {
                            defaultViewMode = classification.defaultViewMode;
                        }
                        classificationUpdatedAt = new Date().toISOString();
                    }

                    const documentId = state.nextDocumentId++;
                    const effectiveContent = content;
                    let versionId: number | null = null;

                    if (!state.docVersions[documentId]) {
                        state.docVersions[documentId] = [];
                    }

                    if (effectiveContent) {
                        versionId = state.nextVersionId++;
                        state.docVersions[documentId].push({
                            version_id: versionId,
                            document_id: documentId,
                            created_at: now,
                            content_id: versionId,
                            content: effectiveContent,
                        });
                    }

                    baseNode.document = {
                        document_id: documentId,
                        node_id: newNodeId,
                        doc_type: docType ?? 'prompt',
                        language_hint: languageHint,
                        language_source: languageSource,
                        doc_type_source: docTypeSource,
                        classification_updated_at: classificationUpdatedAt,
                        default_view_mode: defaultViewMode,
                        current_version_id: versionId,
                        content: effectiveContent,
                    } as Document;
                }

                const children = Array.isArray(node.children) ? node.children : [];
                if (children.length > 0) {
                    baseNode.children = [];
                    children.forEach((child, index) => {
                        const childNode = insertRecursive(child, newNodeId, index, false);
                        baseNode.children!.push(childNode);
                    });
                } else {
                    if (baseNode.children && baseNode.children.length === 0) {
                        baseNode.children = undefined;
                    }
                }

                return baseNode;
            };

            const insertedNodes = nodesToInsert.map((node, index) => insertRecursive(node, parentId, insertIndex + index, true));

            collection.splice(insertIndex, 0, ...insertedNodes);
            collection.forEach((node, index) => {
                node.sort_order = index;
            });

            persistBrowserState(state);
            return createdIds;
        }

        if (!window.electronAPI?.dbInsertNodesFromTransfer) {
            throw new Error('Insert nodes from transfer is not supported in this environment.');
        }

        const result = await window.electronAPI.dbInsertNodesFromTransfer(payload, targetId, position);
        if (!result.success) {
            throw new Error(result.error || 'Failed to copy nodes from transfer payload.');
        }
        return result.createdNodeIds ?? [];
    },
    
    async getVersionsForNode(nodeId: string): Promise<DocVersion[]> {
        if (!isElectron) {
            const state = ensureBrowserState();
            const { node } = findNodeWithParent(nodeId, state.nodes);
            if (!node || !node.document) return [];
            const versions = state.docVersions[node.document.document_id] ?? [];
            return cloneDocVersions(versions).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
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
        if (!isElectron) {
            const state = ensureBrowserState();
            const existing = state.docVersions[documentId] ?? [];
            state.docVersions[documentId] = existing.filter(version => !versionIds.includes(version.version_id));
            const remaining = state.docVersions[documentId];
            mapNodeTree(state.nodes, node => {
                if (node.document?.document_id === documentId) {
                    const latest = remaining[remaining.length - 1] ?? null;
                    node.document.current_version_id = latest ? latest.version_id : null;
                    node.document.content = latest?.content;
                }
            });
            persistBrowserState(state);
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
        if (!isElectron) {
            const state = ensureBrowserState();
            return state.templates.map(template => ({ ...template }));
        }
        return window.electronAPI!.dbQuery(`SELECT * FROM templates ORDER BY title`);
    },

    async addTemplate(templateData: Omit<DocumentTemplate, 'template_id' | 'created_at' | 'updated_at'>): Promise<DocumentTemplate> {
        if (!isElectron) {
            const state = ensureBrowserState();
            const now = new Date().toISOString();
            const template: DocumentTemplate = {
                ...templateData,
                template_id: uuidv4(),
                created_at: now,
                updated_at: now,
            };
            state.templates.push(template);
            persistBrowserState(state);
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
        if (!isElectron) {
            const state = ensureBrowserState();
            const template = state.templates.find(t => t.template_id === templateId);
            if (!template || Object.keys(updates).length === 0) return;
            Object.assign(template, updates);
            template.updated_at = new Date().toISOString();
            persistBrowserState(state);
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
        if (!isElectron) {
            const state = ensureBrowserState();
            state.templates = state.templates.filter(t => t.template_id !== templateId);
            persistBrowserState(state);
            return;
        }
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id = ?`, [templateId]);
    },

    async deleteTemplates(templateIds: string[]) {
        if (templateIds.length === 0) return;
        if (!isElectron) {
            const state = ensureBrowserState();
            state.templates = state.templates.filter(t => !templateIds.includes(t.template_id));
            persistBrowserState(state);
            return;
        }
        const placeholders = templateIds.map(() => '?').join(',');
        await window.electronAPI!.dbRun(`DELETE FROM templates WHERE template_id IN (${placeholders})`, templateIds);
    },

    async getAllSettings(): Promise<Settings> {
        if (!isElectron) {
            const state = ensureBrowserState();
            return { ...state.settings };
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
        if (!isElectron) {
            const state = ensureBrowserState();
            state.settings = { ...settings };
            persistBrowserState(state);
            return;
        }
        for (const [key, value] of Object.entries(settings)) {
            await window.electronAPI!.dbRun(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                [key, JSON.stringify(value)]
            );
        }
    },

    async importFiles(filesData: {path: string, name: string, content: string}[], targetParentId: string | null): Promise<ImportedNodeSummary[]> {
        if (!window.electronAPI?.dbImportFiles) {
            throw new Error("File import is not supported in this environment.");
        }
        const result = await window.electronAPI.dbImportFiles(filesData, targetParentId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to import files in main process.');
        }
        return result.createdNodes ?? [];
    },

    async getDbPath(): Promise<string> {
        if (!window.electronAPI?.dbGetPath) throw new Error("getDbPath not supported.");
        return window.electronAPI.dbGetPath();
    },

    async loadDatabaseFromPath(filePath: string): Promise<DatabaseLoadResult> {
        if (!window.electronAPI?.dbLoadFromPath) throw new Error("Database loading not supported.");
        return window.electronAPI.dbLoadFromPath(filePath);
    },

    async createNewDatabase(): Promise<DatabaseLoadResult> {
        if (!window.electronAPI?.dbCreateNew) throw new Error("Database creation not supported.");
        return window.electronAPI.dbCreateNew();
    },

    async selectDatabaseFile(): Promise<DatabaseLoadResult> {
        if (!window.electronAPI?.dbSelectAndLoad) throw new Error("Database selection not supported.");
        return window.electronAPI.dbSelectAndLoad();
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

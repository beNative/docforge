import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useDocuments } from './hooks/usePrompts';
import { useTemplates } from './hooks/useTemplates';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { useLLMStatus } from './hooks/useLLMStatus';
import { useLogger } from './hooks/useLogger';
import Sidebar from './components/Sidebar';
import DocumentEditor from './components/PromptEditor';
import TemplateEditor from './components/TemplateEditor';
import { WelcomeScreen } from './components/WelcomeScreen';
import SettingsView from './components/SettingsView';
import StatusBar from './components/StatusBar';
import LoggerPanel from './components/LoggerPanel';
import CommandPalette from './components/CommandPalette';
import InfoView from './components/InfoView';
import UpdateNotification from './components/UpdateNotification';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import DocumentHistoryView from './components/PromptHistoryView';
import FolderOverview, { type FolderOverviewMetrics, type FolderSearchResult, type RecentDocumentSummary, type DocTypeCount, type LanguageCount } from './components/FolderOverview';
import { PlusIcon, FolderPlusIcon, TrashIcon, GearIcon, InfoIcon, TerminalIcon, DocumentDuplicateIcon, PencilIcon, CopyIcon, CommandIcon, CodeIcon, FolderDownIcon, FormatIcon, SparklesIcon } from './components/Icons';
import AboutModal from './components/AboutModal';
import Header from './components/Header';
import CustomTitleBar from './components/CustomTitleBar';
import ConfirmModal from './components/ConfirmModal';
import FatalError from './components/FatalError';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import NewCodeFileModal from './components/NewCodeFileModal';
import type { DocumentOrFolder, Command, LogMessage, DiscoveredLLMModel, DiscoveredLLMService, Settings, DocumentTemplate, ViewMode, DocType } from './types';
import { IconProvider } from './contexts/IconContext';
import { storageService } from './services/storageService';
import { llmDiscoveryService } from './services/llmDiscoveryService';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';
import { repository } from './services/repository';
import { DocumentNode } from './components/PromptTreeItem';
import { formatShortcut, getShortcutMap, formatShortcutForDisplay } from './services/shortcutService';

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;

const DEFAULT_LOGGER_HEIGHT = 288;
const MIN_LOGGER_HEIGHT = 100;

const isElectron = !!window.electronAPI;

type NavigableItem = { id: string; type: 'document' | 'folder' | 'template'; parentId: string | null; };

interface FileWithRelativePath extends File {
    readonly webkitRelativePath: string;
}

const App: React.FC = () => {
    const { addLog } = useLogger();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                await repository.init();
                addLog('INFO', 'Application repository initialized successfully.');
                setIsInitialized(true);
            } catch (error) {
                const message = `Fatal: Application initialization failed. ${error instanceof Error ? error.message : String(error)}`;
                addLog('ERROR', message);
                setInitError(message);
            }
        };
        initializeApp();
    }, [addLog]);

    if (initError) {
        return (
            <FatalError
                title="Error"
                header="Database Error"
                details="Could not open the application database. See logs for details. The application will now close."
            />
        );
    }

    if (!isInitialized) {
        return <div className="w-screen h-screen flex items-center justify-center bg-background"><p className="text-text-main">Initializing database...</p></div>;
    }

    return <MainApp />;
};

const MainApp: React.FC = () => {
    const { settings, saveSettings, loaded: settingsLoaded } = useSettings();
    const { items, addDocument, addFolder, updateItem, commitVersion, deleteItems, moveItems, getDescendantIds, duplicateItems, addDocumentsFromFiles } = useDocuments();
    const { templates, addTemplate, updateTemplate, deleteTemplate, deleteTemplates } = useTemplates();
    const { theme } = useTheme();
    
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState(new Set<string>());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
    const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
    const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

    const [view, setView] = useState<'editor' | 'info' | 'settings'>('editor');
    const [documentView, setDocumentView] = useState<'editor' | 'history'>('editor');
    const [isLoggerVisible, setIsLoggerVisible] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [commandPaletteSearch, setCommandPaletteSearch] = useState('');
    const [isCreateFromTemplateOpen, setCreateFromTemplateOpen] = useState(false);
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isNewCodeFileModalOpen, setIsNewCodeFileModalOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
    const [loggerPanelHeight, setLoggerPanelHeight] = useState(DEFAULT_LOGGER_HEIGHT);
    const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
    const [discoveredServices, setDiscoveredServices] = useState<DiscoveredLLMService[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [updateInfo, setUpdateInfo] = useState<{ ready: boolean; version: string | null }>({ ready: false, version: null });
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; position: { x: number, y: number }, items: MenuItem[] }>({ isOpen: false, position: { x: 0, y: 0 }, items: [] });
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [formatTrigger, setFormatTrigger] = useState(0);
    const [bodySearchMatches, setBodySearchMatches] = useState<Map<string, string>>(new Map());
    const [folderSearchTerm, setFolderSearchTerm] = useState('');
    const [folderBodySearchMatches, setFolderBodySearchMatches] = useState<Map<string, string>>(new Map());
    const [isFolderSearchLoading, setIsFolderSearchLoading] = useState(false);


    const isSidebarResizing = useRef(false);
    const isLoggerResizing = useRef(false);
    const commandPaletteTargetRef = useRef<HTMLDivElement>(null);
    const commandPaletteInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);
    const ensureNodeVisibleRef = useRef<(node: Pick<DocumentOrFolder, 'id' | 'type' | 'parentId'>) => void>();

    const llmStatus = useLLMStatus(settings.llmProviderUrl);
    const { logs, addLog } = useLogger();
    const lastLogRef = useRef<LogMessage | null>(null);

    useEffect(() => {
        if (settingsLoaded) {
            (document.documentElement.style as any).zoom = `${settings.uiScale / 100}`;
        }
    }, [settings.uiScale, settingsLoaded]);

    useEffect(() => {
        if (settingsLoaded) {
            document.documentElement.style.setProperty('--markdown-font-size', `${settings.markdownFontSize}px`);
            document.documentElement.style.setProperty('--markdown-line-height', String(settings.markdownLineHeight));
            document.documentElement.style.setProperty('--markdown-max-width', `${settings.markdownMaxWidth}px`);
            document.documentElement.style.setProperty('--markdown-heading-spacing', String(settings.markdownHeadingSpacing));
            document.documentElement.style.setProperty('--markdown-code-font-size', `${settings.markdownCodeFontSize}px`);
            const bodyFontFamily = (settings.markdownBodyFontFamily || 'Inter, sans-serif').trim() || 'Inter, sans-serif';
            const headingFontFamily = (settings.markdownHeadingFontFamily || bodyFontFamily).trim() || 'Inter, sans-serif';
            const codeFontFamily = (settings.markdownCodeFontFamily || "'JetBrains Mono', monospace").trim() || "'JetBrains Mono', monospace";
            const lightCodeBlockBackground = settings.markdownCodeBlockBackgroundLight.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight;
            const darkCodeBlockBackground = settings.markdownCodeBlockBackgroundDark.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark;
            document.documentElement.style.setProperty('--markdown-body-font-family', bodyFontFamily);
            document.documentElement.style.setProperty('--markdown-heading-font-family', headingFontFamily);
            document.documentElement.style.setProperty('--markdown-code-font-family', codeFontFamily);
            document.documentElement.style.setProperty('--markdown-content-padding', `${settings.markdownContentPadding}px`);
            document.documentElement.style.setProperty('--markdown-paragraph-spacing', String(settings.markdownParagraphSpacing));
            document.documentElement.style.setProperty('--markdown-code-block-background-light', lightCodeBlockBackground);
            document.documentElement.style.setProperty('--markdown-code-block-background-dark', darkCodeBlockBackground);
        }
    }, [settings.markdownFontSize, settings.markdownLineHeight, settings.markdownMaxWidth, settings.markdownHeadingSpacing, settings.markdownCodeFontSize, settings.markdownBodyFontFamily, settings.markdownHeadingFontFamily, settings.markdownCodeFontFamily, settings.markdownContentPadding, settings.markdownParagraphSpacing, settings.markdownCodeBlockBackgroundLight, settings.markdownCodeBlockBackgroundDark, settingsLoaded]);

    useEffect(() => {
        if (!settingsLoaded) {
            return;
        }
        const lightCodeBlockBackground = settings.markdownCodeBlockBackgroundLight.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight;
        const darkCodeBlockBackground = settings.markdownCodeBlockBackgroundDark.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark;
        const activeBackground = theme === 'dark' ? darkCodeBlockBackground : lightCodeBlockBackground;
        document.documentElement.style.setProperty('--markdown-code-block-background', activeBackground);
    }, [theme, settings.markdownCodeBlockBackgroundLight, settings.markdownCodeBlockBackgroundDark, settingsLoaded]);


    const itemsWithSearchMetadata = useMemo(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed || bodySearchMatches.size === 0) {
            return items;
        }
        return items.map(item => {
            const snippet = bodySearchMatches.get(item.id);
            return snippet ? { ...item, searchSnippet: snippet } : item;
        });
    }, [items, bodySearchMatches, searchTerm]);

    const activeNode = useMemo(() => {
        return itemsWithSearchMetadata.find(p => p.id === activeNodeId) || null;
    }, [itemsWithSearchMetadata, activeNodeId]);

    useEffect(() => {
        setFolderSearchTerm('');
        setFolderBodySearchMatches(new Map());
        setIsFolderSearchLoading(false);
    }, [activeNode?.id, activeNode?.type]);

    const activeTemplate = useMemo(() => {
        return templates.find(t => t.template_id === activeTemplateId) || null;
    }, [templates, activeTemplateId]);

    const activeDocument = useMemo(() => {
        return activeNode?.type === 'document' ? activeNode : null;
    }, [activeNode]);


    useEffect(() => {
        const term = searchTerm.trim();
        if (!term) {
            setBodySearchMatches(new Map());
            return;
        }

        let isCancelled = false;

        repository.searchDocumentsByBody(term, 200)
            .then(results => {
                if (!isCancelled) {
                    setBodySearchMatches(new Map(results.map(result => [result.nodeId, result.snippet])));
                }
            })
            .catch(error => {
                if (!isCancelled) {
                    console.error('Failed to search document bodies:', error);
                    setBodySearchMatches(new Map());
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [searchTerm]);

    useEffect(() => {
        if (!activeNode || activeNode.type !== 'folder') {
            return;
        }

        const term = folderSearchTerm.trim();
        if (!term) {
            setFolderBodySearchMatches(new Map());
            setIsFolderSearchLoading(false);
            return;
        }

        let isCancelled = false;
        setIsFolderSearchLoading(true);
        setFolderBodySearchMatches(new Map());

        repository.searchDocumentsByBody(term, 200)
            .then(results => {
                if (isCancelled) {
                    return;
                }
                const descendantIds = getDescendantIds(activeNode.id);
                const matches = new Map<string, string>();
                for (const result of results) {
                    if (descendantIds.has(result.nodeId)) {
                        matches.set(result.nodeId, result.snippet);
                    }
                }
                setFolderBodySearchMatches(matches);
            })
            .catch(error => {
                if (!isCancelled) {
                    console.error('Failed to search within folder:', error);
                    setFolderBodySearchMatches(new Map());
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsFolderSearchLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [activeNode, folderSearchTerm, getDescendantIds]);

    const { documentTree, navigableItems } = useMemo(() => {
        let itemsToBuildFrom = itemsWithSearchMetadata;
        if (searchTerm.trim()) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const visibleIds = new Set<string>();
            const originalItemsById: Map<string, DocumentOrFolder> = new Map(itemsWithSearchMetadata.map(i => [i.id, i]));
            const getAncestors = (itemId: string) => {
                let current = originalItemsById.get(itemId);
                while (current && current.parentId) {
                    visibleIds.add(current.parentId);
                    current = originalItemsById.get(current.parentId);
                }
            };
            const getDescendantIdsRecursive = (itemId: string): Set<string> => {
                const descendantIds = new Set<string>();
                const findChildren = (parentId: string) => {
                    itemsWithSearchMetadata.forEach(p => {
                        if (p.parentId === parentId) {
                            descendantIds.add(p.id);
                            if (p.type === 'folder') findChildren(p.id);
                        }
                    });
                };
                findChildren(itemId);
                return descendantIds;
            };
            itemsWithSearchMetadata.forEach(item => {
                const titleMatch = item.title.toLowerCase().includes(lowerCaseSearchTerm);
                const bodyMatch = Boolean(item.searchSnippet);
                if (titleMatch || bodyMatch) {
                    visibleIds.add(item.id);
                    getAncestors(item.id);
                    if (titleMatch && item.type === 'folder') {
                        getDescendantIdsRecursive(item.id).forEach(id => visibleIds.add(id));
                    }
                }
            });
            itemsToBuildFrom = itemsWithSearchMetadata.filter(item => visibleIds.has(item.id));
        }
        const itemsById = new Map<string, DocumentNode>(itemsToBuildFrom.map(p => [p.id, { ...p, children: [] }]));
        const rootNodes: DocumentNode[] = [];
        for (const item of itemsToBuildFrom) {
            const node = itemsById.get(item.id)!;
            if (item.parentId && itemsById.has(item.parentId)) {
                itemsById.get(item.parentId)!.children.push(node);
            } else {
                rootNodes.push(node);
            }
        }

        const finalTree = rootNodes;

        const displayExpandedIds = searchTerm.trim()
            ? new Set(itemsToBuildFrom.filter(i => i.type === 'folder').map(i => i.id))
            : expandedFolderIds;

        const flatList: NavigableItem[] = [];
        const flatten = (nodes: DocumentNode[]) => {
            for (const node of nodes) {
                flatList.push({ id: node.id, type: node.type, parentId: node.parentId });
                if (node.type === 'folder' && displayExpandedIds.has(node.id)) {
                    flatten(node.children);
                }
            }
        };
        flatten(finalTree);
        templates.forEach(t => flatList.push({ id: t.template_id, type: 'template', parentId: null }));

        return { documentTree: finalTree, navigableItems: flatList };
    }, [itemsWithSearchMetadata, templates, searchTerm, expandedFolderIds]);

    const { metrics: activeFolderMetrics, documents: activeFolderDocuments } = useMemo(() => {
        if (!activeNode || activeNode.type !== 'folder') {
            return { metrics: null as FolderOverviewMetrics | null, documents: [] as RecentDocumentSummary[] };
        }

        const parseDate = (value?: string | null): Date | null => {
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        };

        const formatNodeTitle = (node: { title: string; type: 'document' | 'folder' }) => {
            const trimmed = node.title.trim();
            if (trimmed) {
                return trimmed;
            }
            return node.type === 'folder' ? 'Untitled Folder' : 'Untitled Document';
        };

        const toTitleCase = (value: string) => {
            return value
                .split(/[-_\s]+/)
                .filter(Boolean)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        };

        const addDocTypeCount = (map: Map<DocType, number>, docType: DocType) => {
            map.set(docType, (map.get(docType) ?? 0) + 1);
        };

        const addLanguageCount = (
            map: Map<string, { label: string; count: number }>,
            value?: string | null,
        ) => {
            const trimmed = (value ?? '').trim();
            const key = trimmed ? trimmed.toLowerCase() : 'unknown';
            const label = trimmed ? toTitleCase(trimmed) : 'Unknown';
            const existing = map.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                map.set(key, { label, count: 1 });
            }
        };

        const finalizeDocTypeCounts = (map: Map<DocType, number>): DocTypeCount[] =>
            Array.from(map.entries())
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => {
                    if (a.count !== b.count) {
                        return b.count - a.count;
                    }
                    return a.type.localeCompare(b.type);
                });

        const finalizeLanguageCounts = (
            map: Map<string, { label: string; count: number }>,
        ): LanguageCount[] =>
            Array.from(map.values())
                .map(({ label, count }) => ({ label, count }))
                .sort((a, b) => {
                    if (a.count !== b.count) {
                        return b.count - a.count;
                    }
                    return a.label.localeCompare(b.label);
                });

        const computeFromTree = (folderNode: DocumentNode) => {
            const recordLatest = (() => {
                let latest: Date | null = null;
                return {
                    update(value?: string | null) {
                        const parsed = parseDate(value);
                        if (parsed && (!latest || parsed > latest)) {
                            latest = parsed;
                        }
                    },
                    getValue() {
                        return latest;
                    },
                };
            })();

            recordLatest.update(folderNode.updatedAt);

            const folderChildren = folderNode.children ?? [];
            const directDocumentCount = folderChildren.filter(child => child.type === 'document').length;
            const directFolderCount = folderChildren.filter(child => child.type === 'folder').length;

            let totalDocumentCount = 0;
            let totalFolderCount = 0;
            const stack: { node: DocumentNode; parentPath: string[] }[] = folderChildren.map(child => ({
                node: child,
                parentPath: [],
            }));
            const allDocuments: RecentDocumentSummary[] = [];
            const docTypeMap = new Map<DocType, number>();
            const languageMap = new Map<string, { label: string; count: number }>();

            while (stack.length > 0) {
                const { node: current, parentPath } = stack.pop()!;
                recordLatest.update(current.updatedAt);
                if (current.type === 'document') {
                    totalDocumentCount += 1;
                    const docType = (current.doc_type ?? 'prompt') as DocType;
                    addDocTypeCount(docTypeMap, docType);
                    addLanguageCount(languageMap, current.language_hint);
                    allDocuments.push({
                        id: current.id,
                        title: current.title,
                        updatedAt: current.updatedAt,
                        parentPath,
                        docType,
                        languageHint: current.language_hint ?? null,
                    });
                } else if (current.type === 'folder') {
                    totalFolderCount += 1;
                    const nextPath = [...parentPath, formatNodeTitle(current)];
                    const childNodes = current.children ?? [];
                    stack.push(...childNodes.map(child => ({ node: child, parentPath: nextPath })));
                }
            }

            const latestDate = recordLatest.getValue();
            const recentDocuments = [...allDocuments]
                .sort((a, b) => {
                    const aDate = parseDate(a.updatedAt)?.getTime() ?? 0;
                    const bDate = parseDate(b.updatedAt)?.getTime() ?? 0;
                    return bDate - aDate;
                })
                .slice(0, 5);

            return {
                metrics: {
                    directDocumentCount,
                    directFolderCount,
                    totalDocumentCount,
                    totalFolderCount,
                    totalItemCount: totalDocumentCount + totalFolderCount,
                    lastUpdated: latestDate ? latestDate.toISOString() : null,
                    recentDocuments,
                    docTypeCounts: finalizeDocTypeCounts(docTypeMap),
                    languageCounts: finalizeLanguageCounts(languageMap),
                },
                documents: allDocuments,
            };
        };

        const buildChildMap = () => {
            const map = new Map<string | null, DocumentOrFolder[]>();
            for (const item of items) {
                const key = item.parentId;
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key)!.push(item);
            }
            return map;
        };

        const computeFromList = () => {
            const childMap = buildChildMap();
            const directChildren = childMap.get(activeNode.id) ?? [];

            const recordLatest = (() => {
                let latest: Date | null = null;
                return {
                    update(value?: string | null) {
                        const parsed = parseDate(value);
                        if (parsed && (!latest || parsed > latest)) {
                            latest = parsed;
                        }
                    },
                    getValue() {
                        return latest;
                    },
                };
            })();

            recordLatest.update(activeNode.updatedAt);

            const directDocumentCount = directChildren.filter(child => child.type === 'document').length;
            const directFolderCount = directChildren.filter(child => child.type === 'folder').length;

            let totalDocumentCount = 0;
            let totalFolderCount = 0;
            const stack: { node: DocumentOrFolder; parentPath: string[] }[] = directChildren.map(child => ({
                node: child,
                parentPath: [],
            }));
            const allDocuments: RecentDocumentSummary[] = [];
            const docTypeMap = new Map<DocType, number>();
            const languageMap = new Map<string, { label: string; count: number }>();

            while (stack.length > 0) {
                const { node: current, parentPath } = stack.pop()!;
                recordLatest.update(current.updatedAt);
                if (current.type === 'document') {
                    totalDocumentCount += 1;
                    const docType = (current.doc_type ?? 'prompt') as DocType;
                    addDocTypeCount(docTypeMap, docType);
                    addLanguageCount(languageMap, current.language_hint);
                    allDocuments.push({
                        id: current.id,
                        title: current.title,
                        updatedAt: current.updatedAt,
                        parentPath,
                        docType,
                        languageHint: current.language_hint ?? null,
                    });
                } else {
                    totalFolderCount += 1;
                    const childItems = childMap.get(current.id) ?? [];
                    const nextPath = [...parentPath, formatNodeTitle(current)];
                    stack.push(...childItems.map(item => ({ node: item, parentPath: nextPath })));
                }
            }

            const latestDate = recordLatest.getValue();
            const recentDocuments = [...allDocuments]
                .sort((a, b) => {
                    const aDate = parseDate(a.updatedAt)?.getTime() ?? 0;
                    const bDate = parseDate(b.updatedAt)?.getTime() ?? 0;
                    return bDate - aDate;
                })
                .slice(0, 5);

            return {
                metrics: {
                    directDocumentCount,
                    directFolderCount,
                    totalDocumentCount,
                    totalFolderCount,
                    totalItemCount: totalDocumentCount + totalFolderCount,
                    lastUpdated: latestDate ? latestDate.toISOString() : null,
                    recentDocuments,
                    docTypeCounts: finalizeDocTypeCounts(docTypeMap),
                    languageCounts: finalizeLanguageCounts(languageMap),
                },
                documents: allDocuments,
            };
        };

        const findNodeInTree = (nodes: DocumentNode[]): DocumentNode | null => {
            for (const node of nodes) {
                if (node.id === activeNode.id) {
                    return node;
                }
                if (node.type === 'folder') {
                    const match = findNodeInTree(node.children);
                    if (match) {
                        return match;
                    }
                }
            }
            return null;
        };

        const folderNode = findNodeInTree(documentTree);
        if (folderNode) {
            return computeFromTree(folderNode);
        }
        return computeFromList();
    }, [activeNode, documentTree, items]);

    const folderSearchResults = useMemo<FolderSearchResult[]>(() => {
        if (!activeNode || activeNode.type !== 'folder') {
            return [];
        }

        const trimmed = folderSearchTerm.trim();
        if (!trimmed) {
            return [];
        }

        const lowerTerm = trimmed.toLowerCase();

        const parseToTimestamp = (value?: string | null) => {
            if (!value) {
                return 0;
            }
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        };

        const computeMatchScore = (fields: ('title' | 'body')[]) => {
            if (fields.length === 2) {
                return 0;
            }
            return fields[0] === 'title' ? 1 : 2;
        };

        type FolderSearchResultWithScore = FolderSearchResult & { matchScore: number; sortTimestamp: number; };

        const results: FolderSearchResultWithScore[] = [];

        for (const document of activeFolderDocuments) {
            const titleLower = document.title.toLowerCase();
            const hasTitleMatch = titleLower.includes(lowerTerm);
            const snippet = folderBodySearchMatches.get(document.id);
            const hasBodyMatch = Boolean(snippet);

            if (!hasTitleMatch && !hasBodyMatch) {
                continue;
            }

            const matchedFields: ('title' | 'body')[] = [];
            if (hasTitleMatch) {
                matchedFields.push('title');
            }
            if (hasBodyMatch) {
                matchedFields.push('body');
            }

            results.push({
                id: document.id,
                title: document.title,
                updatedAt: document.updatedAt,
                parentPath: document.parentPath,
                searchSnippet: snippet,
                matchedFields,
                matchScore: computeMatchScore(matchedFields),
                sortTimestamp: parseToTimestamp(document.updatedAt),
            });
        }

        return results
            .sort((a, b) => {
                if (a.matchScore !== b.matchScore) {
                    return a.matchScore - b.matchScore;
                }
                if (a.sortTimestamp !== b.sortTimestamp) {
                    return b.sortTimestamp - a.sortTimestamp;
                }
                return a.title.localeCompare(b.title);
            })
            .map(({ matchScore: _matchScore, sortTimestamp: _sortTimestamp, ...rest }) => rest);
    }, [activeNode, activeFolderDocuments, folderBodySearchMatches, folderSearchTerm]);

    useEffect(() => {
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(setAppVersion);
        }
    }, []);

    useEffect(() => {
        if (window.electronAPI?.onUpdateDownloaded) {
            const cleanup = window.electronAPI.onUpdateDownloaded((version) => {
                addLog('INFO', `Update version ${version} is ready to be installed.`);
                setUpdateInfo({ ready: true, version });
            });
            return cleanup;
        }
    }, [addLog]);


    useEffect(() => {
        storageService.load(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH).then(width => {
            if (typeof width === 'number') setSidebarWidth(width);
        });
        storageService.load(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, DEFAULT_LOGGER_HEIGHT).then(height => {
            if (typeof height === 'number') setLoggerPanelHeight(height);
        });
        storageService.load<string[]>(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, []).then(ids => {
            setExpandedFolderIds(new Set(ids));
        });
    }, []);

    useEffect(() => {
        if (settingsLoaded) { 
            storageService.save(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, Array.from(expandedFolderIds));
        }
    }, [expandedFolderIds, settingsLoaded]);

    useEffect(() => {
        if (items.length > 0 && activeNodeId === null && activeTemplateId === null) {
            const firstId = items[0].id;
            setActiveNodeId(firstId);
            setSelectedIds(new Set([firstId]));
            setLastClickedId(firstId);
        } else if (items.length === 0 && activeNodeId) {
            setActiveNodeId(null);
            setSelectedIds(new Set());
        }
    }, [items, activeNodeId, activeTemplateId]);

    const handleDetectServices = useCallback(async () => {
        addLog('INFO', 'User action: Detecting LLM services.');
        setIsDetecting(true);
        try {
            const services = await llmDiscoveryService.discoverServices();
            setDiscoveredServices(services);
        } catch (error) {
            addLog('ERROR', `Failed to discover services: ${error instanceof Error ? error.message : String(error)}`);
            setDiscoveredServices([]);
        } finally {
            setIsDetecting(false);
        }
    }, [addLog]);

    const handleDropFiles = useCallback(async (files: FileList, parentId: string | null) => {
        if (!files || files.length === 0) return;

        // Ensure the global drag overlay is cleared when files are dropped anywhere in the app.
        dragCounter.current = 0;
        setIsDraggingFile(false);

        const fileEntries = Array.from(files).map(file => {
            const f = file as FileWithRelativePath;
            return {
                path: f.webkitRelativePath || f.name,
                name: f.name,
                file: f,
            };
        });

        const importedNodes = await addDocumentsFromFiles(fileEntries, parentId);

        if (importedNodes.length > 0) {
            const imageNodes = importedNodes.filter(node => node.docType === 'image');
            const targetNode = imageNodes[imageNodes.length - 1] ?? importedNodes[importedNodes.length - 1];
            if (targetNode) {
                const nodeForReveal = { id: targetNode.nodeId, type: 'document' as const, parentId: targetNode.parentId };
                setActiveNodeId(targetNode.nodeId);
                setSelectedIds(new Set([targetNode.nodeId]));
                setLastClickedId(targetNode.nodeId);
                setActiveTemplateId(null);
                setDocumentView('editor');
                setView('editor');
                ensureNodeVisibleRef.current?.(nodeForReveal);
            }
        }
    }, [addDocumentsFromFiles, setActiveNodeId, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView]);

    const handleImportFilesIntoFolder = useCallback((files: FileList, parentId: string) => {
        if (!files || files.length === 0) {
            return;
        }

        const targetFolder = items.find(item => item.id === parentId && item.type === 'folder');
        const folderTitle = targetFolder?.title?.trim() || 'Untitled Folder';

        addLog('INFO', `User action: Import ${files.length} file(s) into folder "${folderTitle}".`);
        void handleDropFiles(files, parentId);
    }, [items, addLog, handleDropFiles]);

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) {
                e.preventDefault();
                dragCounter.current++;
                if (dragCounter.current === 1) {
                    setIsDraggingFile(true);
                    addLog('DEBUG', 'Drag operation with files started over the application window.');
                }
            }
        };

        const handleDragOver = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) {
                e.preventDefault();
            }
        };
        
        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current === 0) {
               setIsDraggingFile(false);
               addLog('DEBUG', 'Drag operation left application window.');
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current = 0;
            setIsDraggingFile(false);
            // Global drop is only handled if not caught by a more specific target
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                 const target = e.target as HTMLElement;
                 if (!target.closest('[data-item-id]') && !target.closest('[data-sidebar-drop-root]')) {
                    addLog('INFO', `${e.dataTransfer.files.length} file(s) dropped on the application window (root).`);
                    handleDropFiles(e.dataTransfer.files, null);
                }
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);
        
        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, [handleDropFiles, addLog]);

    useEffect(() => {
        handleDetectServices();
    }, [handleDetectServices]);


    useEffect(() => {
        const fetchModels = async () => {
            if (settings.apiType !== 'unknown' && settings.llmProviderUrl) {
                try {
                    const service = {
                        id: '', name: '',
                        apiType: settings.apiType,
                        modelsUrl: settings.apiType === 'ollama' 
                            ? new URL('/api/tags', settings.llmProviderUrl).href 
                            : new URL('/v1/models', settings.llmProviderUrl).href,
                        generateUrl: settings.llmProviderUrl
                    };
                    const models = await llmDiscoveryService.fetchModels(service);
                    setAvailableModels(models);
                } catch (error) {
                    addLog('ERROR', `Failed to fetch models for status bar: ${error instanceof Error ? error.message : String(error)}`);
                    setAvailableModels([]);
                }
            } else {
                setAvailableModels([]);
            }
        };
        if (settingsLoaded) {
            fetchModels();
        }
    }, [settings.llmProviderUrl, settings.apiType, settingsLoaded, addLog]);

    useEffect(() => {
        if (settings.autoSaveLogs && logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            if (latestLog !== lastLogRef.current) {
                lastLogRef.current = latestLog;
                const logContent = `[${latestLog.timestamp}] [${latestLog.level}] ${latestLog.message}\n`;
                storageService.appendLogToFile(logContent);
            }
        }
    }, [logs, settings.autoSaveLogs]);


    const getParentIdForNewItem = useCallback(() => {

        if (!activeNode) return null;
        return activeNode.type === 'folder' ? activeNode.id : activeNode.parentId;
    }, [activeNode]);

    const ensureNodeVisible = useCallback((node: Pick<DocumentOrFolder, 'id' | 'type' | 'parentId'>) => {
        const ancestry = new Map(items.map(item => [item.id, item.parentId ?? null]));
        setExpandedFolderIds(prev => {
            const next = new Set(prev);
            let current = node.parentId;
            while (current) {
                next.add(current);
                current = ancestry.get(current) ?? null;
            }
            if (node.type === 'folder') {
                next.add(node.id);
            }
            return next;
        });
        setPendingRevealId(node.id);
    }, [items, setPendingRevealId]);

    useEffect(() => {
        ensureNodeVisibleRef.current = ensureNodeVisible;
    }, [ensureNodeVisible]);

    const handleNewDocument = useCallback(async (parentId?: string | null) => {
        addLog('INFO', 'User action: Create New Document.');
        const effectiveParentId = parentId !== undefined ? parentId : getParentIdForNewItem();
        const newDoc = await addDocument({ parentId: effectiveParentId });
        ensureNodeVisible(newDoc);
        setActiveNodeId(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, getParentIdForNewItem, ensureNodeVisible, addLog]);
    
    const handleNewCodeFile = useCallback(async (filename: string) => {
        addLog('INFO', `User action: Create New Code File with name "${filename}".`);
        const languageHint = filename.split('.').pop() || null;
        const newDoc = await addDocument({
            parentId: getParentIdForNewItem(),
            title: filename,
            content: '',
            doc_type: 'source_code',
            language_hint: languageHint,
        });
        ensureNodeVisible(newDoc);
        setActiveNodeId(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, getParentIdForNewItem, ensureNodeVisible, addLog]);

    const handleNewFolder = useCallback(async (parentId?: string | null) => {
        addLog('INFO', 'User action: Create New Folder.');
        const effectiveParentId = parentId !== undefined ? parentId : getParentIdForNewItem();
        const newFolder = await addFolder(effectiveParentId);
        ensureNodeVisible(newFolder);
        setActiveNodeId(newFolder.id);
        setSelectedIds(new Set([newFolder.id]));
        setLastClickedId(newFolder.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addFolder, getParentIdForNewItem, ensureNodeVisible, addLog]);

    const handleNewRootFolder = useCallback(async () => {
        addLog('INFO', 'User action: Create New Root Folder.');
        await handleNewFolder(null);
    }, [handleNewFolder, addLog]);

    const handleNewSubfolder = useCallback(async () => {
        if (activeNode?.type === 'folder') {
            addLog('INFO', `User action: Create New Subfolder in "${activeNode.title}".`);
            await handleNewFolder(activeNode.id);
            setExpandedFolderIds(prev => new Set(prev).add(activeNode.id));
        }
    }, [handleNewFolder, activeNode, addLog]);

    const handleDuplicateSelection = useCallback(async () => {
        if (selectedIds.size > 0) {
            addLog('INFO', `User action: Duplicate ${selectedIds.size} selected item(s).`);
            await duplicateItems(Array.from(selectedIds));
        }
    }, [selectedIds, duplicateItems, addLog]);

    const handleNewTemplate = useCallback(async () => {
        addLog('INFO', 'User action: Create New Template.');
        const newTemplate = await addTemplate();
        setActiveTemplateId(newTemplate.template_id);
        setLastClickedId(newTemplate.template_id);
        setActiveNodeId(null);
        setSelectedIds(new Set());
        setView('editor');
    }, [addTemplate, addLog]);

    const handleCreateFromTemplate = useCallback(async (title: string, content: string) => {
        addLog('INFO', `User action: Create Document from Template, title: "${title}".`);
        const newDoc = await addDocument({ parentId: null, title, content });
        ensureNodeVisible(newDoc);
        setActiveNodeId(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, ensureNodeVisible, addLog]);

    const handleSelectNode = useCallback((id: string, e: React.MouseEvent) => {
        if (activeNodeId !== id) {
            setDocumentView('editor');
        }
        
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift && lastClickedId && navigableItems.length > 0) {
            const lastIndex = navigableItems.findIndex(i => i.id === lastClickedId);
            const currentIndex = navigableItems.findIndex(i => i.id === id);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const rangeIds = navigableItems.slice(start, end + 1).map(i => i.id);
                setSelectedIds(new Set(rangeIds));
            }
        } else if (isCtrl) {
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
                return newSet;
            });
            setLastClickedId(id);
        } else {
            setSelectedIds(new Set([id]));
            setLastClickedId(id);
        }

        setActiveNodeId(id);
        setActiveTemplateId(null);
        setView('editor');
    }, [activeNodeId, lastClickedId, navigableItems]);
    
    const handleSelectTemplate = (id: string) => {
        setActiveTemplateId(id);
        setActiveNodeId(null);
        setSelectedIds(new Set([id]));
        setLastClickedId(id);
        setView('editor');
    };
    
    const handleSaveDocumentTitle = (updatedDoc: Partial<Omit<DocumentOrFolder, 'id' | 'content'>>) => {
        if (activeNodeId) {
            updateItem(activeNodeId, updatedDoc);
        }
    };

    const handleLanguageChange = useCallback((newLanguage: string) => {
        if (activeNodeId && activeNode?.type === 'document') {
            addLog('INFO', `User action: Change language for document "${activeNode?.title}" to "${newLanguage}".`);
            updateItem(activeNodeId, { language_hint: newLanguage });
        }
    }, [activeNodeId, activeNode, updateItem, addLog]);

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        if (activeNodeId && activeNode?.type === 'document') {
            addLog('INFO', `User action: Set default view for document "${activeNode?.title}" to "${mode}".`);
            updateItem(activeNodeId, { default_view_mode: mode });
        }
    }, [activeNodeId, activeNode, updateItem, addLog]);

    const handleCommitVersion = useCallback((content: string) => {
        if (activeNodeId) {
            return commitVersion(activeNodeId, content);
        }
        return Promise.resolve();
    }, [activeNodeId, commitVersion]);
    
    const handleSaveTemplate = (updatedTemplate: Partial<Omit<DocumentTemplate, 'template_id'>>) => {
        if (activeTemplateId) {
            updateTemplate(activeTemplateId, updatedTemplate);
        }
    };
    
    const handleRenameNode = (id: string, title: string) => {
        updateItem(id, { title });
    };

    const handleStartRenamingNode = useCallback((id: string) => {
        const target = items.find(item => item.id === id) ?? null;
        if (target) {
            const trimmedTitle = target.title?.trim();
            const fallbackTitle = target.type === 'folder' ? 'Untitled Folder' : 'Untitled Document';
            const displayTitle = trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : fallbackTitle;
            addLog('INFO', `User action: Rename ${target.type} "${displayTitle}".`);
            ensureNodeVisible({ id: target.id, type: target.type, parentId: target.parentId ?? null });
        } else {
            addLog('INFO', 'User action: Rename item.');
        }
        setRenamingNodeId(id);
    }, [items, addLog, ensureNodeVisible]);

    const handleRenameTemplate = (id: string, title: string) => {
        updateTemplate(id, { title });
    };
    
    const handleCopyNodeContent = useCallback(async (nodeId: string) => {
        const item = items.find(p => p.id === nodeId);
        if (item && item.type === 'document' && item.content) {
            try {
                await navigator.clipboard.writeText(item.content);
                addLog('INFO', `Content of document "${item.title}" copied to clipboard.`);
            } catch (err) {
                addLog('ERROR', `Failed to copy to clipboard: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        } else if (item?.type === 'folder') {
            addLog('WARNING', 'Cannot copy content of a folder.');
        } else {
            addLog('WARNING', 'Cannot copy content of an empty document.');
        }
    }, [items, addLog]);

    const handleModelChange = (modelId: string) => {
        addLog('INFO', `User action: Set LLM model to "${modelId}".`);
        saveSettings({ ...settings, llmModelName: modelId });
    };
    
    const handleProviderChange = useCallback(async (serviceId: string) => {
        const selectedService = discoveredServices.find(s => s.id === serviceId);
        if (!selectedService) return;

        try {
            const models = await llmDiscoveryService.fetchModels(selectedService);
            const newModelName = models.length > 0 ? models[0].id : '';
            
            saveSettings({
                ...settings,
                llmProviderUrl: selectedService.generateUrl,
                llmProviderName: selectedService.name,
                apiType: selectedService.apiType,
                llmModelName: newModelName,
            });
            addLog('INFO', `Switched LLM provider to ${selectedService.name}.`);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addLog('ERROR', `Failed to switch provider: ${message}`);
        }
    }, [discoveredServices, settings, saveSettings, addLog]);

    const handleDeleteSelection = useCallback(async (idsToDelete: Set<string>, options?: { force?: boolean }) => {
        const force = options?.force || false;
    
        if (idsToDelete.size === 0) return;
    
        const allItemsById = new Map(items.map(i => [i.id, i]));
        const topLevelNodeIds = [...idsToDelete].filter(id => {
            const node = allItemsById.get(id);
            return node && (!node.parentId || !idsToDelete.has(node.parentId));
        });
    
        const templateIdsToDelete = [...idsToDelete].filter(id => templates.some(t => t.template_id === id));
    
        const totalItems = topLevelNodeIds.length + templateIdsToDelete.length;
        if (totalItems === 0) return;
    
        const performDelete = async () => {
            addLog('INFO', `Executing delete for ${totalItems} item(s).`);
            if (topLevelNodeIds.length > 0) {
                await deleteItems(topLevelNodeIds);
            }
            if (templateIdsToDelete.length > 0) {
                await deleteTemplates(templateIdsToDelete);
            }
    
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                idsToDelete.forEach(id => newSet.delete(id));
                return newSet;
            });
            if (lastClickedId && idsToDelete.has(lastClickedId)) {
                setLastClickedId(null);
            }
            
            if (activeNodeId && idsToDelete.has(activeNodeId)) {
                setActiveNodeId(null);
            }
            if (activeTemplateId && idsToDelete.has(activeTemplateId)) {
                setActiveTemplateId(null);
            }
        };
    
        if (force) {
            addLog('WARNING', `User action: Force deleting ${totalItems} item(s).`);
            await performDelete();
        } else {
            setConfirmAction({
                title: `Delete ${totalItems} item(s)`,
                message: <>Are you sure you want to permanently delete {totalItems} selected item(s)? This action cannot be undone.</>,
                onConfirm: () => {
                    addLog('INFO', 'User confirmed deletion.');
                    performDelete();
                    setConfirmAction(null);
                }
            });
        }
    }, [items, templates, deleteItems, deleteTemplates, activeNodeId, activeTemplateId, lastClickedId, addLog]);

    const handleDeleteNode = useCallback((id: string, shiftKey: boolean = false) => {
        const itemToDelete = items.find(p => p.id === id);
        if (!itemToDelete) return;
        addLog('INFO', `User action: Delete node "${itemToDelete.title}" (ID: ${id}).`);

        const idsToDelete = selectedIds.has(id) ? selectedIds : new Set([id]);
        
        handleDeleteSelection(idsToDelete, { force: shiftKey });
    }, [items, selectedIds, handleDeleteSelection, addLog]);

    const handleDeleteTemplate = useCallback((id: string, shiftKey: boolean = false) => {
        const templateToDelete = templates.find(t => t.template_id === id);
        if (!templateToDelete) return;
        addLog('INFO', `User action: Delete template "${templateToDelete.title}" (ID: ${id}).`);

        const idsToDelete = selectedIds.has(id) ? selectedIds : new Set([id]);

        handleDeleteSelection(idsToDelete, { force: shiftKey });
    }, [templates, selectedIds, handleDeleteSelection, addLog]);

    const handleToggleExpand = (id: string) => {
        setExpandedFolderIds(prev => {
          const newSet = new Set(prev);
          const isExpanding = !newSet.has(id);
          addLog('DEBUG', `User action: Toggled folder ${isExpanding ? 'expansion' : 'collapse'} for ID: ${id}.`);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return newSet;
        });
    };

    const handleExpandAll = () => {
        addLog('INFO', 'User action: Expand All Folders.');
        const allFolderIds = items.filter(item => item.type === 'folder').map(item => item.id);
        setExpandedFolderIds(new Set(allFolderIds));
    };

    const handleCollapseAll = () => {
        addLog('INFO', 'User action: Collapse All Folders.');
        setExpandedFolderIds(new Set());
    };

    const toggleSettingsView = () => {
        addLog('INFO', `User action: Toggled settings view ${view === 'settings' ? 'off' : 'on'}.`);
        setView(v => v === 'settings' ? 'editor' : 'settings');
    };

    const handleRestoreDocumentVersion = useCallback((documentId: string, content: string) => {
        const doc = items.find(p => p.id === documentId);
        if (doc) {
            commitVersion(documentId, content);
            addLog('INFO', `Restored document "${doc.title}" to a previous version.`);
            setDocumentView('editor');
        }
    }, [items, commitVersion, addLog]);

    const handleOpenCommandPalette = useCallback(() => {
        addLog('INFO', 'User action: Opened command palette.');
        setIsCommandPaletteOpen(true);
    }, [addLog]);

    const handleCloseCommandPalette = useCallback(() => {
        setIsCommandPaletteOpen(false);
        setCommandPaletteSearch('');
    }, []);
    
    const handleToggleCommandPalette = useCallback(() => {
        addLog('INFO', `User action: Toggled command palette ${isCommandPaletteOpen ? 'off' : 'on'}.`);
        setIsCommandPaletteOpen(prev => {
            const isOpen = !prev;
            if (isOpen) {
                setTimeout(() => {
                    commandPaletteInputRef.current?.focus();
                    commandPaletteInputRef.current?.select();
                }, 0);
            } else {
                commandPaletteInputRef.current?.blur();
            }
            return isOpen;
        });
    }, [addLog, isCommandPaletteOpen]);
    
    const handleOpenNewCodeFileModal = useCallback(() => {
        addLog('INFO', 'User action: Open "New Code File" modal.');
        setIsNewCodeFileModalOpen(true);
    }, [addLog]);

    const handleOpenAbout = useCallback(() => {
        addLog('INFO', 'User action: Opened About dialog.');
        setIsAboutModalOpen(true);
    }, [addLog]);

    const handleCloseAbout = useCallback(() => {
        addLog('INFO', 'User action: Closed About dialog.');
        setIsAboutModalOpen(false);
    }, [addLog]);

    const handleFormatDocument = useCallback(() => {
        const activeDoc = items.find(p => p.id === activeNodeId);
        if (activeDoc && activeDoc.type === 'document' && view === 'editor') {
          const language = activeDoc.language_hint || 'plaintext';
          const isFormattable = ['javascript', 'typescript', 'json', 'html', 'css', 'xml', 'yaml'].includes(language);
          if (isFormattable) {
            addLog('INFO', `User action: Format document "${activeDoc.title}".`);
            setFormatTrigger(c => c + 1);
          } else {
            addLog('WARNING', `Attempted to format an unformattable document type: ${language}`);
          }
        }
    }, [items, activeNodeId, view, addLog]);

    const commands: Command[] = useMemo(() => [
        { id: 'new-document', name: 'Create New Document', action: () => handleNewDocument(), category: 'File', icon: PlusIcon, shortcut: ['Control', 'N'], keywords: 'add create file' },
        { id: 'new-code-file', name: 'Create New Code File', action: handleOpenNewCodeFileModal, category: 'File', icon: CodeIcon, shortcut: ['Control', 'Shift', 'N'], keywords: 'add create script' },
        { id: 'new-folder', name: 'Create New Folder', action: handleNewRootFolder, category: 'File', icon: FolderPlusIcon, keywords: 'add create directory' },
        { id: 'new-template', name: 'Create New Template', action: handleNewTemplate, category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create template' },
        { id: 'new-from-template', name: 'New Document from Template...', action: () => { addLog('INFO', 'Command: New Document from Template.'); setCreateFromTemplateOpen(true); }, category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create file instance' },
        { id: 'duplicate-item', name: 'Duplicate Selection', action: handleDuplicateSelection, category: 'File', icon: CopyIcon, keywords: 'copy clone' },
        { id: 'delete-item', name: 'Delete Selection', action: () => handleDeleteSelection(selectedIds), category: 'File', icon: TrashIcon, keywords: 'remove discard' },
        { id: 'format-document', name: 'Format Document', action: handleFormatDocument, category: 'Editor', icon: FormatIcon, shortcut: ['Control', 'Shift', 'F'], keywords: 'beautify pretty print clean code' },
        { id: 'toggle-command-palette', name: 'Toggle Command Palette', action: handleToggleCommandPalette, category: 'View', icon: CommandIcon, shortcut: ['Control', 'Shift', 'P'], keywords: 'find action go to' },
        { id: 'toggle-editor', name: 'Switch to Editor View', action: () => { addLog('INFO', 'Command: Switch to Editor View.'); setView('editor'); }, category: 'View', icon: PencilIcon, keywords: 'main document' },
        { id: 'toggle-settings', name: 'Toggle Settings View', action: toggleSettingsView, category: 'View', icon: GearIcon, keywords: 'configure options' },
        { id: 'toggle-info', name: 'Toggle Info View', action: () => { addLog('INFO', 'Command: Toggle Info View.'); setView(v => v === 'info' ? 'editor' : 'info'); }, category: 'View', icon: InfoIcon, keywords: 'help docs readme' },
        { id: 'open-about', name: 'About DocForge', action: handleOpenAbout, category: 'Help', icon: SparklesIcon, keywords: 'about credits information' },
        { id: 'toggle-logs', name: 'Toggle Logs Panel', action: () => { addLog('INFO', 'Command: Toggle Logs Panel.'); setIsLoggerVisible(v => !v); }, category: 'View', icon: TerminalIcon, keywords: 'debug console' },
    ], [handleNewDocument, handleOpenNewCodeFileModal, handleNewRootFolder, handleDeleteSelection, handleNewTemplate, toggleSettingsView, handleDuplicateSelection, selectedIds, addLog, handleToggleCommandPalette, handleFormatDocument, handleOpenAbout]);

    const enrichedCommands = useMemo(() => {
      return commands.map(command => {
          const custom = settings.customShortcuts[command.id];
          const effectiveShortcut = custom !== undefined ? custom : command.shortcut;
          return {
              ...command,
              shortcutString: effectiveShortcut ? formatShortcutForDisplay(effectiveShortcut) : undefined,
          };
      });
    }, [commands, settings.customShortcuts]);

    const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        addLog('DEBUG', `User action: Opened context menu on ${nodeId ? `node ${nodeId}`: 'root'}.`);

        let currentSelection = selectedIds;
        if (nodeId && !selectedIds.has(nodeId)) {
            const newSelection = new Set([nodeId]);
            setSelectedIds(newSelection);
            setLastClickedId(nodeId);
            currentSelection = newSelection;
        }

        const menuItems: MenuItem[] = [];
        const selectedNodes = items.filter(item => currentSelection.has(item.id));
        const hasDocuments = selectedNodes.some(n => n.type === 'document');
        const firstSelectedNode = nodeId ? items.find(i => i.id === nodeId) : null;
        const parentIdForNewItem = firstSelectedNode?.type === 'folder' ? firstSelectedNode.id : firstSelectedNode?.parentId ?? null;
        
        const getCommand = (id: string) => enrichedCommands.find(c => c.id === id);

        const newFromTemplateAction = () => {
            addLog('INFO', 'Context Menu: New Document from Template.');
            setCreateFromTemplateOpen(true);
        };

        if (nodeId) { // Clicked on an item
            const isDocument = firstSelectedNode?.type === 'document';
            const language = isDocument ? firstSelectedNode.language_hint || 'plaintext' : '';
            const isFormattable = ['javascript', 'typescript', 'json', 'html', 'css', 'xml', 'yaml'].includes(language);

            menuItems.push(
                { label: 'New Document', icon: PlusIcon, action: () => handleNewDocument(parentIdForNewItem), shortcut: getCommand('new-document')?.shortcutString },
                { label: 'New Code File', icon: CodeIcon, action: handleOpenNewCodeFileModal, shortcut: getCommand('new-code-file')?.shortcutString },
                { label: 'New Folder', icon: FolderPlusIcon, action: () => handleNewFolder(parentIdForNewItem), shortcut: getCommand('new-folder')?.shortcutString },
                { label: 'New from Template...', icon: DocumentDuplicateIcon, action: newFromTemplateAction, shortcut: getCommand('new-from-template')?.shortcutString },
                { type: 'separator' },
                { label: 'Format', icon: FormatIcon, action: handleFormatDocument, disabled: !isFormattable || currentSelection.size !== 1, shortcut: getCommand('format-document')?.shortcutString },
                { label: 'Rename', icon: PencilIcon, action: () => handleStartRenamingNode(nodeId), disabled: currentSelection.size !== 1 },
                { label: 'Duplicate', icon: DocumentDuplicateIcon, action: handleDuplicateSelection, disabled: currentSelection.size === 0, shortcut: getCommand('duplicate-item')?.shortcutString },
                { type: 'separator' },
                { label: 'Copy Content', icon: CopyIcon, action: () => hasDocuments && handleCopyNodeContent(selectedNodes.find(n => n.type === 'document')!.id), disabled: !hasDocuments},
                { type: 'separator' },
                { label: 'Delete', icon: TrashIcon, action: () => handleDeleteSelection(currentSelection), disabled: currentSelection.size === 0, shortcut: getCommand('delete-item')?.shortcutString }
            );
        } else { // Clicked on empty space
             menuItems.push(
                { label: 'New Document', icon: PlusIcon, action: () => handleNewDocument(null), shortcut: getCommand('new-document')?.shortcutString },
                { label: 'New Code File', icon: CodeIcon, action: handleOpenNewCodeFileModal, shortcut: getCommand('new-code-file')?.shortcutString },
                { label: 'New Folder', icon: FolderPlusIcon, action: () => handleNewFolder(null), shortcut: getCommand('new-folder')?.shortcutString },
                { label: 'New from Template...', icon: DocumentDuplicateIcon, action: newFromTemplateAction, shortcut: getCommand('new-from-template')?.shortcutString }
            );
        }

        setContextMenu({
            isOpen: true,
            position: { x: e.clientX, y: e.clientY },
            items: menuItems
        });
    }, [selectedIds, items, handleNewDocument, handleNewFolder, handleDuplicateSelection, handleDeleteSelection, handleCopyNodeContent, addLog, enrichedCommands, handleOpenNewCodeFileModal, handleFormatDocument, handleStartRenamingNode]);


    const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isSidebarResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const handleLoggerMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isLoggerResizing.current = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }, []);
    
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        const zoomFactor = settings.uiScale / 100;

        if (isSidebarResizing.current) {
            const mainContentMinWidth = 300;
            const newWidth = e.clientX / zoomFactor;
            const calculatedMaxWidth = (window.innerWidth / zoomFactor) - mainContentMinWidth;
            
            const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, calculatedMaxWidth));
            setSidebarWidth(clampedWidth);
        }
        if (isLoggerResizing.current) {
            const mainContentMinHeight = 200;
            const newHeight = (window.innerHeight - e.clientY) / zoomFactor;
            const calculatedMaxHeight = (window.innerHeight / zoomFactor) - mainContentMinHeight;
            
            const clampedHeight = Math.max(MIN_LOGGER_HEIGHT, Math.min(newHeight, calculatedMaxHeight));
            setLoggerPanelHeight(clampedHeight);
        }
    }, [settings.uiScale]);

    const handleGlobalMouseUp = useCallback(() => {
        if (isSidebarResizing.current) {
            isSidebarResizing.current = false;
            storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, sidebarWidth);
        }
        if (isLoggerResizing.current) {
            isLoggerResizing.current = false;
            storageService.save(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, loggerPanelHeight);
        }
        
        if (document.body.style.cursor !== 'default') {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    }, [sidebarWidth, loggerPanelHeight]);
    
    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);
    
     useEffect(() => {
        const shortcutMap = getShortcutMap(commands, settings.customShortcuts);
        
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) && activeEl !== commandPaletteInputRef.current) {
                return;
            }

            const shortcut = formatShortcut(e);
            const command = shortcutMap.get(shortcut);
            
            if (command) {
                e.preventDefault();
                command.action();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [commands, settings.customShortcuts]);

    const getSupportedIconSet = (iconSet: Settings['iconSet']): 'heroicons' | 'lucide' | 'feather' | 'tabler' | 'material' => {
        const supportedSets: Array<Settings['iconSet']> = ['heroicons', 'lucide', 'feather', 'tabler', 'material'];
        if (supportedSets.includes(iconSet)) {
            return iconSet;
        }
        return 'heroicons';
    };

    if (!settingsLoaded) {
        return <div className="w-screen h-screen flex items-center justify-center bg-background"><p className="text-text-main">Loading application...</p></div>;
    }

    const renderMainContent = () => {
        if (view === 'info') return <InfoView />;
        if (view === 'settings') return <SettingsView settings={settings} onSave={saveSettings} discoveredServices={discoveredServices} onDetectServices={handleDetectServices} isDetecting={isDetecting} commands={enrichedCommands} />;
        
        if (activeTemplate) {
            return <TemplateEditor 
                key={activeTemplate.template_id}
                template={activeTemplate}
                onSave={handleSaveTemplate}
                onDelete={handleDeleteTemplate}
            />
        }
        if (activeNode) {
            if (activeNode.type === 'document') {
                if (documentView === 'history') {
                    return (
                        <DocumentHistoryView
                            document={activeNode}
                            onBackToEditor={() => setDocumentView('editor')}
                            onRestore={(content) => handleRestoreDocumentVersion(activeNode.id, content)}
                            settings={settings}
                        />
                    );
                }
                return (
                    <DocumentEditor 
                        key={activeNode.id}
                        documentNode={activeNode}
                        onSave={handleSaveDocumentTitle}
                        onCommitVersion={handleCommitVersion}
                        onDelete={handleDeleteNode}
                        settings={settings}
                        onShowHistory={() => setDocumentView('history')}
                        onLanguageChange={handleLanguageChange}
                        onViewModeChange={handleViewModeChange}
                        formatTrigger={formatTrigger}
                    />
                );
            }
            if (activeNode.type === 'folder') {
                const fallbackMetrics: FolderOverviewMetrics = {
                    directDocumentCount: 0,
                    directFolderCount: 0,
                    totalDocumentCount: 0,
                    totalFolderCount: 0,
                    totalItemCount: 0,
                    lastUpdated: activeNode.updatedAt,
                    recentDocuments: [],
                    docTypeCounts: [],
                    languageCounts: [],
                };
                return (
                    <FolderOverview
                        key={activeNode.id}
                        folder={activeNode}
                        metrics={activeFolderMetrics ?? fallbackMetrics}
                        onNewDocument={(parentId) => handleNewDocument(parentId)}
                        onNewSubfolder={(parentId) => handleNewFolder(parentId)}
                        onImportFiles={handleImportFilesIntoFolder}
                        onRenameFolderTitle={handleRenameNode}
                        folderSearchTerm={folderSearchTerm}
                        onFolderSearchTermChange={setFolderSearchTerm}
                        searchResults={folderSearchResults}
                        isSearchLoading={isFolderSearchLoading}
                    />
                );
            }
        }
        return <WelcomeScreen onNewDocument={() => handleNewDocument()} />;
    };

    const headerProps = {
        onToggleSettingsView: toggleSettingsView,
        onToggleInfoView: () => { addLog('INFO', `User action: Toggled info view ${view === 'info' ? 'off' : 'on'}.`); setView(v => v === 'info' ? 'editor' : 'info'); },
        onShowEditorView: () => { addLog('INFO', 'User action: Switched to editor view.'); setView('editor'); },
        onToggleLogger: () => { addLog('INFO', `User action: Toggled logger panel ${isLoggerVisible ? 'off' : 'on'}.`); setIsLoggerVisible(v => !v); },
        onOpenCommandPalette: handleOpenCommandPalette,
        onOpenAbout: handleOpenAbout,
        isInfoViewActive: view === 'info',
        isSettingsViewActive: view === 'settings',
        isEditorViewActive: view === 'editor',
        commands: enrichedCommands,
    };

    return (
        <IconProvider value={{ iconSet: getSupportedIconSet(settings.iconSet) }}>
            <div className="flex flex-col h-full font-sans bg-background text-text-main antialiased overflow-hidden">
                {isElectron ? (
                    <CustomTitleBar
                        {...headerProps}
                        commandPaletteTargetRef={commandPaletteTargetRef}
                        searchTerm={commandPaletteSearch}
                        onSearchTermChange={setCommandPaletteSearch}
                        commandPaletteInputRef={commandPaletteInputRef}
                    />
                ) : (
                    <Header {...headerProps} />
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 flex overflow-hidden min-h-0">
                        {view === 'editor' ? (
                            <>
                                <aside 
                                    style={{ width: `${sidebarWidth}px` }} 
                                    className="bg-secondary border-r border-border-color flex flex-col flex-shrink-0"
                                >
                                    <Sidebar
                                        documents={itemsWithSearchMetadata}
                                        documentTree={documentTree}
                                        navigableItems={navigableItems}
                                        selectedIds={selectedIds}
                                        setSelectedIds={setSelectedIds}
                                        lastClickedId={lastClickedId}
                                        setLastClickedId={setLastClickedId}
                                        activeNodeId={activeNodeId}
                                        onSelectNode={handleSelectNode}
                                        onDeleteSelection={handleDeleteSelection}
                                        onDeleteNode={handleDeleteNode}
                                        onRenameNode={handleRenameNode}
                                        onMoveNode={moveItems}
                                        onDropFiles={handleDropFiles}
                                        onNewDocument={() => handleNewDocument()}
                                        onNewRootFolder={handleNewRootFolder}
                                        onNewSubfolder={handleNewSubfolder}
                                        onNewCodeFile={handleOpenNewCodeFileModal}
                                        onDuplicateSelection={handleDuplicateSelection}
                                        onCopyNodeContent={handleCopyNodeContent}
                                        expandedFolderIds={expandedFolderIds}
                                        onToggleExpand={handleToggleExpand}
                                        onExpandAll={handleExpandAll}
                                        onCollapseAll={handleCollapseAll}
                                        searchTerm={searchTerm}
                                        setSearchTerm={setSearchTerm}
                                        onContextMenu={handleContextMenu}
                                        renamingNodeId={renamingNodeId}
                                        onRenameComplete={() => setRenamingNodeId(null)}
                                        commands={enrichedCommands}
                                        pendingRevealId={pendingRevealId}
                                        onRevealHandled={() => setPendingRevealId(null)}
                                        templates={templates}
                                        activeTemplateId={activeTemplateId}
                                        onSelectTemplate={handleSelectTemplate}
                                        onDeleteTemplate={handleDeleteTemplate}
                                        onRenameTemplate={handleRenameTemplate}
                                        onNewTemplate={handleNewTemplate}
                                        onNewFromTemplate={() => setCreateFromTemplateOpen(true)}
                                        documentTreeIndent={settings.documentTreeIndent}
                                        documentTreeVerticalSpacing={settings.documentTreeVerticalSpacing}
                                    />
                                </aside>
                                <div 
                                    onMouseDown={handleSidebarMouseDown}
                                    className="w-1.5 cursor-col-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
                                />
                                <section className="flex-1 flex flex-col overflow-hidden bg-background">
                                    {renderMainContent()}
                                </section>
                            </>
                        ) : (
                            <section className="flex-1 flex flex-col overflow-hidden bg-background">
                                {renderMainContent()}
                            </section>
                        )}
                    </main>
                    <LoggerPanel 
                        isVisible={isLoggerVisible} 
                        onToggleVisibility={() => setIsLoggerVisible(v => !v)}
                        height={loggerPanelHeight}
                        onResizeStart={handleLoggerMouseDown}
                    />
                </div>
                <StatusBar 
                    status={llmStatus}
                    modelName={settings.llmModelName}
                    llmProviderName={settings.llmProviderName}
                    llmProviderUrl={settings.llmProviderUrl}
                    documentCount={items.filter(i => i.type === 'document').length}
                    lastSaved={activeDocument?.updatedAt}
                    availableModels={availableModels}
                    onModelChange={handleModelChange}
                    discoveredServices={discoveredServices}
                    onProviderChange={handleProviderChange}
                    appVersion={appVersion}
                />
            </div>
            
            {isDraggingFile && (
                <div className="fixed inset-0 bg-primary/20 border-4 border-dashed border-primary flex flex-col items-center justify-center pointer-events-none z-50">
                    <FolderDownIcon className="w-24 h-24 text-primary/80 mb-4" />
                    <p className="text-2xl font-bold text-primary-text bg-primary/80 px-4 py-2 rounded-md">Drop files to import</p>
                </div>
            )}

            <CommandPalette 
                isOpen={isCommandPaletteOpen} 
                onClose={handleCloseCommandPalette}
                commands={enrichedCommands}
                targetRef={commandPaletteTargetRef}
                searchTerm={commandPaletteSearch}
                onExecute={() => {
                    setIsCommandPaletteOpen(false);
                    setCommandPaletteSearch('');
                }}
            />
             <ContextMenu {...contextMenu} onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))} />

            {isCreateFromTemplateOpen && (
                <CreateFromTemplateModal
                    templates={templates}
                    onClose={() => setCreateFromTemplateOpen(false)}
                    onCreate={handleCreateFromTemplate}
                />
            )}
            
            {isNewCodeFileModalOpen && (
                <NewCodeFileModal
                    onClose={() => setIsNewCodeFileModalOpen(false)}
                    onCreate={handleNewCodeFile}
                />
            )}

            {isAboutModalOpen && (
                <AboutModal onClose={handleCloseAbout} />
            )}

            {updateInfo.ready && window.electronAPI?.quitAndInstallUpdate && (
                <UpdateNotification
                    version={updateInfo.version!}
                    onInstall={() => window.electronAPI!.quitAndInstallUpdate!()}
                    onClose={() => setUpdateInfo({ ready: false, version: null })}
                />
            )}

            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => { addLog('INFO', 'User cancelled action.'); setConfirmAction(null); }}
                />
            )}
        </IconProvider>
    );
};

export default App;


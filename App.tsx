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
import DocumentTabs from './components/DocumentTabs';
import TemplateEditor from './components/TemplateEditor';
import { WelcomeScreen } from './components/WelcomeScreen';
import SettingsView from './components/SettingsView';
import StatusBar from './components/StatusBar';
import LoggerPanel from './components/LoggerPanel';
import CommandPalette from './components/CommandPalette';
import InfoView from './components/InfoView';
import InfoModal from './components/InfoModal';
import UpdateNotification from './components/UpdateNotification';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import DocumentHistoryView from './components/PromptHistoryView';
import FolderOverview, { type FolderOverviewMetrics, type FolderSearchResult, type RecentDocumentSummary, type DocTypeCount, type LanguageCount } from './components/FolderOverview';
import { PlusIcon, FolderPlusIcon, TrashIcon, GearIcon, InfoIcon, TerminalIcon, DocumentDuplicateIcon, PencilIcon, CopyIcon, CommandIcon, CodeIcon, FolderDownIcon, FormatIcon, SparklesIcon, SaveIcon, CheckIcon, DatabaseIcon, ExpandAllIcon, CollapseAllIcon, ArrowUpIcon, ArrowDownIcon } from './components/Icons';
import AboutModal from './components/AboutModal';
import Header from './components/Header';
import CustomTitleBar from './components/CustomTitleBar';
import ConfirmModal from './components/ConfirmModal';
import FatalError from './components/FatalError';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import NewCodeFileModal from './components/NewCodeFileModal';
import type { DocumentOrFolder, Command, LogMessage, DiscoveredLLMModel, DiscoveredLLMService, Settings, DocumentTemplate, ViewMode, DocType, DraggedNodeTransfer, UpdateAvailableInfo, PreviewMetadata } from './types';
import { IconProvider } from './contexts/IconContext';
import { storageService } from './services/storageService';
import { llmDiscoveryService } from './services/llmDiscoveryService';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';
import { repository, type RepositoryStartupTiming } from './services/repository';
import { DocumentNode } from './components/PromptTreeItem';
import { formatShortcut, getShortcutMap, formatShortcutForDisplay } from './services/shortcutService';
import { readClipboardText, ClipboardPermissionError, ClipboardUnavailableError } from './services/clipboardService';

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;

const DEFAULT_LOGGER_HEIGHT = 288;
const MIN_LOGGER_HEIGHT = 100;

const PREVIEW_INITIAL_SCALE = 1;
const PREVIEW_MIN_SCALE = 0.25;
const PREVIEW_MAX_SCALE = 5;
const PREVIEW_ZOOM_STEP = 0.25;

const isElectron = !!window.electronAPI;

const resolveClipboardHelpUrl = (): string | null => {
    if (typeof navigator === 'undefined') {
        return null;
    }
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) {
        return 'https://support.apple.com/guide/mac-help/share-the-clipboard-mchlp1145/mac';
    }
    if (userAgent.includes('windows')) {
        return 'https://support.microsoft.com/en-us/windows/manage-app-permissions-0ee78007-2d3b-c9a6-f53f-f05d2f63f177';
    }
    if (userAgent.includes('linux')) {
        return 'https://help.ubuntu.com/stable/ubuntu-help/privacy-applications.html';
    }
    return null;
};

type NavigableItem = { id: string; type: 'document' | 'folder' | 'template'; parentId: string | null; };

interface FileWithRelativePath extends File {
    readonly webkitRelativePath: string;
}

const App: React.FC = () => {
    const { addLog } = useLogger();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    useEffect(() => {
        const logStartupTimings = (timings: RepositoryStartupTiming[]) => {
            timings.forEach(timing => {
                const detailPart = timing.detail ? ` (${timing.detail})` : '';
                const duration = timing.durationMs.toFixed(1);
                const message = `[Startup] ${timing.step} ${timing.success ? 'completed' : 'failed'} in ${duration}ms${detailPart}`;
                const finalMessage = timing.error ? `${message} Error: ${timing.error}` : message;
                addLog(timing.success ? 'INFO' : 'ERROR', finalMessage);
            });
        };

        const initializeApp = async () => {
            try {
                const timings = await repository.init();
                logStartupTimings(timings);
                addLog('INFO', 'Application repository initialized successfully.');
                setIsInitialized(true);
            } catch (error) {
                const timings = (error as Error & { startupTimings?: RepositoryStartupTiming[] }).startupTimings;
                if (timings) {
                    logStartupTimings(timings);
                }
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

type TabState = {
    activeId: string | null;
    order: string[];
};

type DatabaseStatusTone = 'info' | 'success' | 'error' | 'neutral';

interface DatabaseStatusState {
    message: string;
    tone: DatabaseStatusTone;
}

const findNodeAndSiblingsInTree = (nodes: DocumentNode[], id: string): { node: DocumentNode; siblings: DocumentNode[] } | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return { node, siblings: nodes };
        }
        if (node.type === 'folder' && node.children.length > 0) {
            const found = findNodeAndSiblingsInTree(node.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

type UpdateStatus = 'idle' | 'downloading' | 'downloaded' | 'error';

interface UpdateToastState {
    status: UpdateStatus;
    version: string | null;
    releaseName: string | null;
    progress: number;
    bytesTransferred: number | null;
    bytesTotal: number | null;
    visible: boolean;
    snoozed: boolean;
    errorMessage: string | null;
    errorDetails: string | null;
}

const MainApp: React.FC = () => {
    const { settings, saveSettings, loaded: settingsLoaded } = useSettings();
    const { items, addDocument, addFolder, updateItem, commitVersion, deleteItems, moveItems, getDescendantIds, duplicateItems, addDocumentsFromFiles, importNodesFromTransfer, createDocumentFromClipboard, isLoading: areDocumentsLoading } = useDocuments();
    const { templates, addTemplate, updateTemplate, deleteTemplate, deleteTemplates } = useTemplates();
    const { theme } = useTheme();
    
    const [tabState, setTabState] = useState<TabState>({ activeId: null, order: [] });
    const [selectedIds, setSelectedIds] = useState(new Set<string>());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
    const [hasLoadedExpandedFolders, setHasLoadedExpandedFolders] = useState(false);
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
    const [updateToast, setUpdateToast] = useState<UpdateToastState>({
        status: 'idle',
        version: null,
        releaseName: null,
        progress: 0,
        bytesTransferred: null,
        bytesTotal: null,
        visible: false,
        snoozed: false,
        errorMessage: null,
        errorDetails: null,
    });
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);
    const [clipboardNotice, setClipboardNotice] = useState<{ title: string; message: React.ReactNode; helpUrl?: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; position: { x: number, y: number }, items: MenuItem[] }>({ isOpen: false, position: { x: 0, y: 0 }, items: [] });
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [formatTrigger, setFormatTrigger] = useState(0);
    const [bodySearchMatches, setBodySearchMatches] = useState<Map<string, string>>(new Map());
    const [folderSearchTerm, setFolderSearchTerm] = useState('');
    const [folderBodySearchMatches, setFolderBodySearchMatches] = useState<Map<string, string>>(new Map());
    const [isFolderSearchLoading, setIsFolderSearchLoading] = useState(false);
    const [databasePath, setDatabasePath] = useState<string | null>(null);
    const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatusState | null>(null);
    const [isDatabaseBusy, setIsDatabaseBusy] = useState(false);
    const [isRestoringActiveDocument, setIsRestoringActiveDocument] = useState(true);
    const [hasRestoredActiveDocument, setHasRestoredActiveDocument] = useState(false);
    const [previewScale, setPreviewScale] = useState(PREVIEW_INITIAL_SCALE);
    const [previewResetSignal, setPreviewResetSignal] = useState(0);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [isPreviewZoomReady, setIsPreviewZoomReady] = useState(false);
    const [previewMetadata, setPreviewMetadata] = useState<PreviewMetadata | null>(null);

    useEffect(() => {
        if (!isPreviewVisible) {
            setPreviewMetadata(null);
        }
    }, [isPreviewVisible]);

    useEffect(() => {
        if (view !== 'editor') {
            setPreviewMetadata(null);
        }
    }, [view]);

    const activeNodeId = tabState.activeId;
    const openDocumentIds = tabState.order;
    const storedActiveDocumentIdRef = useRef<string | null>(null);

    const clampPreviewScale = useCallback((value: number) => {
        return Math.min(Math.max(value, PREVIEW_MIN_SCALE), PREVIEW_MAX_SCALE);
    }, []);

    const handlePreviewScaleChange = useCallback((value: number) => {
        setPreviewScale(clampPreviewScale(value));
    }, [clampPreviewScale]);

    const handlePreviewZoomIn = useCallback(() => {
        setPreviewScale(prev => clampPreviewScale(prev * (1 + PREVIEW_ZOOM_STEP)));
    }, [clampPreviewScale]);

    const handlePreviewZoomOut = useCallback(() => {
        setPreviewScale(prev => clampPreviewScale(prev / (1 + PREVIEW_ZOOM_STEP)));
    }, [clampPreviewScale]);

    const handlePreviewReset = useCallback(() => {
        setPreviewScale(PREVIEW_INITIAL_SCALE);
        setPreviewResetSignal(prev => prev + 1);
    }, []);

    const activateDocumentTab = useCallback((documentId: string) => {
        setTabState(prev => {
            const exists = prev.order.includes(documentId);
            if (prev.activeId === documentId && exists) {
                return prev;
            }
            const nextOrder = exists ? prev.order : [...prev.order, documentId];
            return { order: nextOrder, activeId: documentId };
        });
    }, []);

    const setActiveItem = useCallback((id: string | null) => {
        setTabState(prev => {
            if (prev.activeId === id) {
                return prev;
            }
            return { order: prev.order, activeId: id };
        });
    }, []);

    const closeDocumentTab = useCallback((documentId: string) => {
        setTabState(prev => {
            if (!prev.order.includes(documentId)) {
                return prev;
            }
            const nextOrder = prev.order.filter(id => id !== documentId);
            const nextActive = prev.activeId === documentId
                ? (nextOrder[nextOrder.length - 1] ?? null)
                : prev.activeId;
            return { order: nextOrder, activeId: nextActive };
        });
    }, []);

    const closeOtherDocumentTabs = useCallback((documentId: string) => {
        setTabState(prev => {
            if (!prev.order.includes(documentId)) {
                return prev;
            }
            return { order: [documentId], activeId: documentId };
        });
    }, []);

    const closeDocumentTabsToRight = useCallback((documentId: string) => {
        setTabState(prev => {
            const index = prev.order.indexOf(documentId);
            if (index === -1) {
                return prev;
            }
            const nextOrder = prev.order.slice(0, index + 1);
            const nextActive = prev.activeId && nextOrder.includes(prev.activeId)
                ? prev.activeId
                : documentId;
            return { order: nextOrder, activeId: nextActive };
        });
    }, []);

    const reorderDocumentTabs = useCallback((fromIndex: number, toIndex: number) => {
        setTabState(prev => {
            if (fromIndex === toIndex) {
                return prev;
            }
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.order.length || toIndex >= prev.order.length) {
                return prev;
            }
            const nextOrder = [...prev.order];
            const [moved] = nextOrder.splice(fromIndex, 1);
            nextOrder.splice(toIndex, 0, moved);
            return { order: nextOrder, activeId: prev.activeId };
        });
    }, []);


    const isSidebarResizing = useRef(false);
    const isLoggerResizing = useRef(false);
    const commandPaletteTargetRef = useRef<HTMLDivElement>(null);
    const commandPaletteInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);
    const ensureNodeVisibleRef = useRef<(node: Pick<DocumentOrFolder, 'id' | 'type' | 'parentId'>) => void>();

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

    const llmStatus = useLLMStatus(settings.llmProviderUrl);
    const { logs, addLog } = useLogger();
    const lastLogRef = useRef<LogMessage | null>(null);

    useEffect(() => {
        if (!isElectron || !window.electronAPI?.dbGetPath) {
            setDatabaseStatus({ message: 'Database actions unavailable in this environment.', tone: 'info' });
            return;
        }

        let isCancelled = false;
        const loadPath = async () => {
            try {
                const path = await repository.getDbPath();
                if (isCancelled) {
                    return;
                }
                setDatabasePath(path);
                setDatabaseStatus(prev => prev ?? { message: 'Database ready', tone: 'info' });
            } catch (error) {
                if (isCancelled) {
                    return;
                }
                const message = error instanceof Error ? error.message : 'Unable to determine database location.';
                addLog('ERROR', `Failed to determine database path: ${message}`);
                setDatabaseStatus({ message, tone: 'error' });
            }
        };

        loadPath();

        return () => {
            isCancelled = true;
        };
    }, [addLog]);

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
        return itemsWithSearchMetadata.find(p => p.id === tabState.activeId) || null;
    }, [itemsWithSearchMetadata, tabState.activeId]);

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
        if (!activeDocument) {
            setPreviewMetadata(null);
        }
    }, [activeDocument]);

    const documentItems = useMemo(() => items.filter(item => item.type === 'document'), [items]);
    const activeDocumentId = activeDocument?.id ?? null;

    useEffect(() => {
        setPreviewScale(PREVIEW_INITIAL_SCALE);
        setPreviewResetSignal(prev => prev + 1);
    }, [activeNode?.id, activeNode?.type]);

    useEffect(() => {
        if (view !== 'editor' || documentView !== 'editor') {
            setIsPreviewVisible(false);
            setIsPreviewZoomReady(false);
        }
    }, [documentView, view]);

    useEffect(() => {
        let isCancelled = false;
        storageService.load<string | null>(LOCAL_STORAGE_KEYS.ACTIVE_DOCUMENT_ID, null).then(savedId => {
            if (isCancelled) {
                return;
            }
            storedActiveDocumentIdRef.current = savedId;
            setIsRestoringActiveDocument(false);
        });

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        if (isRestoringActiveDocument || hasRestoredActiveDocument || !hasLoadedExpandedFolders) {
            return;
        }

        const savedId = storedActiveDocumentIdRef.current;
        if (!savedId) {
            storedActiveDocumentIdRef.current = null;
            setHasRestoredActiveDocument(true);
            return;
        }

        if (items.length === 0) {
            if (areDocumentsLoading) {
                return;
            }
            storedActiveDocumentIdRef.current = null;
            setHasRestoredActiveDocument(true);
            return;
        }

        const target = items.find(item => item.id === savedId && item.type === 'document');
        if (!target) {
            storedActiveDocumentIdRef.current = null;
            setHasRestoredActiveDocument(true);
            return;
        }

        ensureNodeVisibleRef.current?.(target);
        setActiveTemplateId(null);
        setView('editor');
        setDocumentView('editor');
        activateDocumentTab(savedId);
        setSelectedIds(new Set([savedId]));
        setLastClickedId(savedId);
        storedActiveDocumentIdRef.current = null;
        setHasRestoredActiveDocument(true);
    }, [isRestoringActiveDocument, hasRestoredActiveDocument, items, activateDocumentTab, areDocumentsLoading, hasLoadedExpandedFolders, ensureNodeVisibleRef]);

    useEffect(() => {
        if (!hasRestoredActiveDocument) {
            return;
        }

        storageService.save(LOCAL_STORAGE_KEYS.ACTIVE_DOCUMENT_ID, activeDocumentId);
    }, [activeDocumentId, hasRestoredActiveDocument]);


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

    const getPrimarySelectionId = useCallback((): string | null => {
        if (lastClickedId && selectedIds.has(lastClickedId)) {
            return lastClickedId;
        }
        const iterator = selectedIds.values().next();
        return iterator.done ? null : iterator.value;
    }, [lastClickedId, selectedIds]);

    const handleDocumentTreeSelectAll = useCallback(() => {
        setSelectedIds(new Set(navigableItems.map(item => item.id)));
    }, [navigableItems, setSelectedIds]);

    const handleMoveSelectionUp = useCallback(() => {
        const primaryId = getPrimarySelectionId();
        if (!primaryId) {
            return;
        }
        const result = findNodeAndSiblingsInTree(documentTree, primaryId);
        if (!result) {
            return;
        }
        const { siblings } = result;
        const index = siblings.findIndex(sibling => sibling.id === primaryId);
        if (index > 0) {
            const targetSiblingId = siblings[index - 1].id;
            addLog('INFO', `User action: Move node ${primaryId} up in document tree via keyboard.`);
            void moveItems([primaryId], targetSiblingId, 'before');
        }
    }, [getPrimarySelectionId, documentTree, moveItems, addLog]);

    const handleMoveSelectionDown = useCallback(() => {
        const primaryId = getPrimarySelectionId();
        if (!primaryId) {
            return;
        }
        const result = findNodeAndSiblingsInTree(documentTree, primaryId);
        if (!result) {
            return;
        }
        const { siblings } = result;
        const index = siblings.findIndex(sibling => sibling.id === primaryId);
        if (index !== -1 && index < siblings.length - 1) {
            const targetSiblingId = siblings[index + 1].id;
            addLog('INFO', `User action: Move node ${primaryId} down in document tree via keyboard.`);
            void moveItems([primaryId], targetSiblingId, 'after');
        }
    }, [getPrimarySelectionId, documentTree, moveItems, addLog]);

    const handleCopyNodeContent = useCallback(async (nodeId: string) => {
        const item = items.find(p => p.id === nodeId);
        if (!item) {
            addLog('WARNING', 'Cannot copy content of an unknown item.');
            return;
        }

        if (item.type === 'folder') {
            addLog('WARNING', 'Cannot copy content of a folder.');
            return;
        }

        if (!item.content) {
            addLog('WARNING', 'Cannot copy content of an empty document.');
            return;
        }

        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard) {
                throw new Error('Clipboard API is unavailable in this environment.');
            }
            await navigator.clipboard.writeText(item.content);
            addLog('INFO', `Content of document "${item.title}" copied to clipboard.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            addLog('ERROR', `Failed to copy to clipboard: ${message}`);
        }
    }, [items, addLog]);

    const handleCopySelectionContent = useCallback(() => {
        const doc = items.find(item => selectedIds.has(item.id) && item.type === 'document');
        if (!doc) {
            return;
        }
        void handleCopyNodeContent(doc.id);
    }, [items, selectedIds, handleCopyNodeContent]);

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
        if (!window.electronAPI) {
            return;
        }

        const cleanups: (() => void)[] = [];
        const {
            onUpdateAvailable,
            onUpdateDownloadProgress,
            onUpdateDownloaded,
            onUpdateError,
        } = window.electronAPI;

        if (onUpdateAvailable) {
            cleanups.push(onUpdateAvailable((info) => {
                const versionLabel = info.version ?? info.releaseName ?? 'latest';
                addLog('INFO', `Update ${versionLabel} detected. Downloading in the background.`);
                setUpdateToast(prev => ({
                    ...prev,
                    status: 'downloading',
                    version: info.version ?? prev.version ?? null,
                    releaseName: info.releaseName ?? prev.releaseName ?? null,
                    progress: 0,
                    bytesTransferred: null,
                    bytesTotal: null,
                    visible: true,
                    snoozed: false,
                    errorMessage: null,
                    errorDetails: null,
                }));
            }));
        }

        if (onUpdateDownloadProgress) {
            cleanups.push(onUpdateDownloadProgress((progress) => {
                setUpdateToast(prev => ({
                    ...prev,
                    status: 'downloading',
                    progress: Number.isFinite(progress.percent) ? progress.percent : prev.progress,
                    bytesTransferred: Number.isFinite(progress.transferred) ? progress.transferred : prev.bytesTransferred,
                    bytesTotal: Number.isFinite(progress.total) ? progress.total : prev.bytesTotal,
                    visible: prev.snoozed ? prev.visible : true,
                    snoozed: prev.snoozed,
                    errorMessage: null,
                    errorDetails: null,
                }));
            }));
        }

        if (onUpdateDownloaded) {
            cleanups.push(onUpdateDownloaded((payload: string | UpdateAvailableInfo) => {
                const versionLabel = typeof payload === 'string'
                    ? payload
                    : payload.version ?? payload.releaseName ?? 'latest';
                addLog('INFO', `Update version ${versionLabel} is ready to be installed.`);
                setUpdateToast(prev => {
                    const version = typeof payload === 'string'
                        ? payload
                        : payload.version ?? prev.version ?? payload.releaseName ?? prev.releaseName ?? null;
                    const releaseName = typeof payload === 'string'
                        ? prev.releaseName
                        : payload.releaseName ?? prev.releaseName ?? null;

                    return {
                        ...prev,
                        status: 'downloaded',
                        version,
                        releaseName,
                        progress: 100,
                        bytesTransferred: prev.bytesTotal ?? prev.bytesTransferred ?? null,
                        bytesTotal: prev.bytesTotal ?? prev.bytesTransferred ?? null,
                        visible: true,
                        snoozed: false,
                        errorMessage: null,
                        errorDetails: null,
                    };
                });
            }));
        }

        if (onUpdateError) {
            cleanups.push(onUpdateError((payload) => {
                const message = typeof payload === 'string'
                    ? payload
                    : payload?.message ?? 'Something went wrong while checking for updates.';
                const details = typeof payload === 'string'
                    ? payload
                    : payload?.details ?? null;
                addLog('ERROR', `Auto-update error: ${details ?? message}`);
                setUpdateToast(prev => ({
                    ...prev,
                    status: 'error',
                    visible: true,
                    snoozed: false,
                    errorMessage: message,
                    errorDetails: details,
                }));
            }));
        }

        return () => {
            cleanups.forEach(dispose => {
                try {
                    dispose();
                } catch (error) {
                    console.error('Failed to cleanup update listener', error);
                }
            });
        };
    }, [addLog]);


    useEffect(() => {
        storageService.load(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH).then(width => {
            if (typeof width === 'number') setSidebarWidth(width);
        });
        storageService.load(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, DEFAULT_LOGGER_HEIGHT).then(height => {
            if (typeof height === 'number') setLoggerPanelHeight(height);
        });

        let isCancelled = false;

        storageService
            .load<string[]>(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, [])
            .then(ids => {
                if (isCancelled) {
                    return;
                }
                setExpandedFolderIds(new Set(ids));
            })
            .catch(() => {
                // Loading failed; we'll fall back to the default empty set.
            })
            .finally(() => {
                if (!isCancelled) {
                    setHasLoadedExpandedFolders(true);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        if (settingsLoaded && hasLoadedExpandedFolders) {
            storageService.save(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, Array.from(expandedFolderIds));
        }
    }, [expandedFolderIds, settingsLoaded, hasLoadedExpandedFolders]);

    useEffect(() => {
        if (isRestoringActiveDocument || !hasRestoredActiveDocument) {
            return;
        }

        if (items.length === 0) {
            if (openDocumentIds.length > 0 || activeNodeId !== null) {
                setTabState({ activeId: null, order: [] });
            }
            setSelectedIds(new Set());
            setLastClickedId(null);
            return;
        }

        if (activeTemplateId !== null) {
            return;
        }

        if (activeNodeId === null) {
            const firstItem = items[0];
            if (firstItem.type === 'document') {
                activateDocumentTab(firstItem.id);
            } else {
                setActiveItem(firstItem.id);
            }
            setSelectedIds(new Set([firstItem.id]));
            setLastClickedId(firstItem.id);
        }
    }, [items, activeNodeId, activeTemplateId, openDocumentIds.length, activateDocumentTab, setActiveItem, isRestoringActiveDocument, hasRestoredActiveDocument]);

    useEffect(() => {
        const documentIds = new Set(items.filter(item => item.type === 'document').map(item => item.id));
        const allItemIds = new Set(items.map(item => item.id));
        setTabState(prev => {
            const filteredOrder = prev.order.filter(id => documentIds.has(id));
            const orderChanged = filteredOrder.length !== prev.order.length;
            let nextActive = prev.activeId;
            if (nextActive && !allItemIds.has(nextActive)) {
                nextActive = filteredOrder[filteredOrder.length - 1] ?? null;
            }
            if (!orderChanged && nextActive === prev.activeId) {
                return prev;
            }
            return {
                order: orderChanged ? filteredOrder : prev.order,
                activeId: nextActive,
            };
        });
    }, [items]);

    useEffect(() => {
        if (activeTemplateId !== null) {
            return;
        }
        if (activeNodeId && !items.some(item => item.id === activeNodeId)) {
            const fallbackId = openDocumentIds[openDocumentIds.length - 1] ?? null;
            if (fallbackId) {
                setSelectedIds(new Set([fallbackId]));
                setLastClickedId(fallbackId);
                activateDocumentTab(fallbackId);
            } else {
                setSelectedIds(new Set());
                setLastClickedId(null);
                setActiveItem(null);
            }
        }
    }, [items, activeNodeId, activeTemplateId, openDocumentIds, activateDocumentTab, setActiveItem, setSelectedIds, setLastClickedId]);

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
                activateDocumentTab(targetNode.nodeId);
                setSelectedIds(new Set([targetNode.nodeId]));
                setLastClickedId(targetNode.nodeId);
                setActiveTemplateId(null);
                setDocumentView('editor');
                setView('editor');
                ensureNodeVisibleRef.current?.(nodeForReveal);
            }
        }
    }, [addDocumentsFromFiles, activateDocumentTab, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView]);

    const handleImportNodesFromTransfer = useCallback(async (
        payload: DraggedNodeTransfer,
        targetId: string | null,
        position: 'before' | 'after' | 'inside'
    ) => {
        try {
            const createdIds = await importNodesFromTransfer(payload, targetId, position);
            if (createdIds.length === 0) {
                return;
            }

            const selection = new Set(createdIds);
            setSelectedIds(selection);
            const lastCreatedId = createdIds[createdIds.length - 1];
            setLastClickedId(lastCreatedId);
            setActiveTemplateId(null);

            let parentIdForReveal: string | null = null;
            if (position === 'inside') {
                parentIdForReveal = targetId;
            } else if (targetId) {
                const targetItem = items.find(item => item.id === targetId);
                parentIdForReveal = targetItem?.parentId ?? null;
            }

            const rootPairs = createdIds.map((id, index) => ({ id, node: payload.nodes?.[index] }));
            const lastDocument = [...rootPairs].reverse().find(pair => pair.node?.type === 'document');

            if (lastDocument) {
                activateDocumentTab(lastDocument.id);
                setDocumentView('editor');
                setView('editor');
                ensureNodeVisibleRef.current?.({ id: lastDocument.id, type: 'document', parentId: parentIdForReveal });
            } else {
                ensureNodeVisibleRef.current?.({ id: lastCreatedId, type: 'folder', parentId: parentIdForReveal });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog('ERROR', `Failed to import nodes from drag payload: ${message}`);
        }
    }, [importNodesFromTransfer, items, activateDocumentTab, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView, ensureNodeVisibleRef, addLog]);

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

    const handleNavigateToNode = useCallback((nodeId: string) => {
        const target = items.find(item => item.id === nodeId);
        if (!target) {
            return;
        }

        ensureNodeVisible(target);
        setActiveTemplateId(null);
        setView('editor');
        setDocumentView('editor');

        if (target.type === 'document') {
            activateDocumentTab(nodeId);
        } else {
            setActiveItem(nodeId);
        }

        setSelectedIds(new Set([nodeId]));
        setLastClickedId(nodeId);
    }, [items, ensureNodeVisible, activateDocumentTab, setActiveItem]);

    const handleNewDocument = useCallback(async (parentId?: string | null) => {
        addLog('INFO', 'User action: Create New Document.');
        const effectiveParentId = parentId !== undefined ? parentId : getParentIdForNewItem();
        const newDoc = await addDocument({ parentId: effectiveParentId });
        ensureNodeVisible(newDoc);
        activateDocumentTab(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
        setRenamingNodeId(newDoc.id);
    }, [addDocument, getParentIdForNewItem, ensureNodeVisible, addLog, activateDocumentTab]);

    const handleNewDocumentFromClipboard = useCallback(async (parentId?: string | null) => {
        addLog('INFO', 'User action: Create New Document from Clipboard.');
        const effectiveParentId = parentId !== undefined ? parentId : getParentIdForNewItem();
        try {
            const { text, warnings: clipboardWarnings, mimeType } = await readClipboardText();
            if (!text || text.trim().length === 0) {
                const message = 'Clipboard is empty or does not contain text content to import.';
                addLog('WARNING', message);
                setClipboardNotice({ title: 'Clipboard Empty', message });
                return;
            }

            const result = await createDocumentFromClipboard({ parentId: effectiveParentId, content: text });
            const { summary } = result;
            const newDoc = result.item;

            clipboardWarnings.forEach(warning => addLog('WARNING', warning));

            ensureNodeVisible(newDoc);
            activateDocumentTab(newDoc.id);
            setSelectedIds(new Set([newDoc.id]));
            setLastClickedId(newDoc.id);
            setActiveTemplateId(null);
            setDocumentView('editor');
            setView('editor');

            const detectedLanguage = summary.languageHint ?? 'unknown';
            const mimeDescriptor = mimeType ?? 'text/plain';
            addLog(
                'INFO',
                `Created document from clipboard (${mimeDescriptor}) classified as ${summary.docType}/${detectedLanguage} (${summary.primaryMatch}).`
            );
        } catch (error) {
            if (error instanceof ClipboardPermissionError) {
                const helpUrl = resolveClipboardHelpUrl();
                addLog('ERROR', `Clipboard access denied: ${error.message}`);
                setClipboardNotice({
                    title: 'Clipboard Permission Required',
                    message: (
                        <div className="space-y-3">
                            <p>DocForge needs permission to read your clipboard before it can create a document.</p>
                            <p className="text-xs text-text-secondary">Grant clipboard access in your operating system settings, then try again.</p>
                        </div>
                    ),
                    helpUrl,
                });
                return;
            }

            if (error instanceof ClipboardUnavailableError) {
                addLog('ERROR', `Clipboard access is not available: ${error.message}`);
                setClipboardNotice({
                    title: 'Clipboard Access Unavailable',
                    message: 'DocForge could not access the clipboard in this environment. Try running the desktop app or enable clipboard APIs for this browser.',
                });
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            addLog('ERROR', `Failed to create document from clipboard: ${message}`);
            setClipboardNotice({
                title: 'Clipboard Import Failed',
                message: `Something went wrong while importing from the clipboard: ${message}`,
            });
        }
    }, [createDocumentFromClipboard, getParentIdForNewItem, ensureNodeVisible, activateDocumentTab, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView, addLog]);

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
        activateDocumentTab(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, getParentIdForNewItem, ensureNodeVisible, addLog, activateDocumentTab]);

    const handleNewFolder = useCallback(async (parentId?: string | null) => {
        addLog('INFO', 'User action: Create New Folder.');
        const effectiveParentId = parentId !== undefined ? parentId : getParentIdForNewItem();
        const newFolder = await addFolder(effectiveParentId);
        ensureNodeVisible(newFolder);
        setActiveItem(newFolder.id);
        setSelectedIds(new Set([newFolder.id]));
        setLastClickedId(newFolder.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
        setRenamingNodeId(newFolder.id);
    }, [addFolder, getParentIdForNewItem, ensureNodeVisible, addLog, setActiveItem]);

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
        setActiveItem(null);
        setSelectedIds(new Set());
        setView('editor');
    }, [addTemplate, addLog, setActiveItem]);

    const handleCreateFromTemplate = useCallback(async (title: string, content: string) => {
        addLog('INFO', `User action: Create Document from Template, title: "${title}".`);
        const newDoc = await addDocument({ parentId: null, title, content });
        ensureNodeVisible(newDoc);
        activateDocumentTab(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, ensureNodeVisible, addLog, activateDocumentTab]);

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

        const selectedNode = items.find(item => item.id === id);
        if (selectedNode?.type === 'document') {
            activateDocumentTab(id);
        } else {
            setActiveItem(id);
        }
        setActiveTemplateId(null);
        setView('editor');
    }, [activeNodeId, lastClickedId, navigableItems, items, activateDocumentTab, setActiveItem]);

    const handleSelectTemplate = (id: string) => {
        setActiveTemplateId(id);
        setActiveItem(null);
        setSelectedIds(new Set([id]));
        setLastClickedId(id);
        setView('editor');
    };

    const handleActivateTab = useCallback((id: string) => {
        const node = items.find(item => item.id === id);
        if (!node || node.type !== 'document') {
            closeDocumentTab(id);
            return;
        }
        activateDocumentTab(id);
        setSelectedIds(new Set([id]));
        setLastClickedId(id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [items, activateDocumentTab, closeDocumentTab, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView]);

    const handleCloseTab = useCallback((id: string) => {
        if (!openDocumentIds.includes(id)) {
            return;
        }
        const nextOrder = openDocumentIds.filter(tabId => tabId !== id);
        const wasActive = activeNodeId === id;
        const nextActive = wasActive ? (nextOrder[nextOrder.length - 1] ?? null) : activeNodeId;

        closeDocumentTab(id);

        if (wasActive) {
            if (nextActive) {
                setSelectedIds(new Set([nextActive]));
                setLastClickedId(nextActive);
                setActiveTemplateId(null);
                setDocumentView('editor');
                setView('editor');
            } else {
                setSelectedIds(new Set());
                setLastClickedId(null);
            }
        } else {
            setSelectedIds(prev => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            if (lastClickedId === id) {
                setLastClickedId(null);
            }
        }
    }, [openDocumentIds, activeNodeId, closeDocumentTab, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView, lastClickedId]);

    const handleCloseOtherTabs = useCallback((id: string) => {
        if (!openDocumentIds.includes(id)) {
            return;
        }
        closeOtherDocumentTabs(id);
        setSelectedIds(new Set([id]));
        setLastClickedId(id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [openDocumentIds, closeOtherDocumentTabs, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView]);

    const handleCloseTabsToRight = useCallback((id: string) => {
        const index = openDocumentIds.indexOf(id);
        if (index === -1) {
            return;
        }
        const closingIds = openDocumentIds.slice(index + 1);
        closeDocumentTabsToRight(id);
        if (closingIds.length === 0) {
            return;
        }

        const activeClosed = activeNodeId ? closingIds.includes(activeNodeId) : false;
        if (activeClosed) {
            setSelectedIds(new Set([id]));
            setLastClickedId(id);
            setActiveTemplateId(null);
            setDocumentView('editor');
            setView('editor');
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                closingIds.forEach(tabId => next.delete(tabId));
                return next;
            });
            if (lastClickedId && closingIds.includes(lastClickedId)) {
                setLastClickedId(id);
            }
        }
    }, [openDocumentIds, activeNodeId, closeDocumentTabsToRight, setSelectedIds, setLastClickedId, setActiveTemplateId, setDocumentView, setView, lastClickedId]);
    
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

    const handleRenameSelection = useCallback(() => {
        let targetId: string | null = null;

        if (selectedIds.size === 1) {
            [targetId] = Array.from(selectedIds);
        } else if (selectedIds.size === 0) {
            targetId = lastClickedId;
        }

        if (!targetId && activeNodeId) {
            targetId = activeNodeId;
        }

        if (!targetId) {
            return;
        }

        const target = items.find(item => item.id === targetId);

        if (!target || (target.type !== 'document' && target.type !== 'folder')) {
            return;
        }

        handleStartRenamingNode(targetId);
    }, [selectedIds, lastClickedId, activeNodeId, items, handleStartRenamingNode]);
    
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

            const filteredOrder = tabState.order.filter(id => !idsToDelete.has(id));
            const wasActiveDeleted = activeNodeId ? idsToDelete.has(activeNodeId) : false;
            const nextActive = wasActiveDeleted ? (filteredOrder[filteredOrder.length - 1] ?? null) : activeNodeId;

            setTabState(prev => {
                const nextOrder = prev.order.filter(id => !idsToDelete.has(id));
                let nextActiveId = prev.activeId;
                if (nextActiveId && idsToDelete.has(nextActiveId)) {
                    nextActiveId = nextOrder[nextOrder.length - 1] ?? null;
                }
                return { order: nextOrder, activeId: nextActiveId };
            });

            if (wasActiveDeleted) {
                if (nextActive) {
                    setSelectedIds(new Set([nextActive]));
                    setLastClickedId(nextActive);
                    setActiveTemplateId(null);
                    setDocumentView('editor');
                    setView('editor');
                } else {
                    setSelectedIds(new Set());
                    setLastClickedId(null);
                }
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
    }, [items, templates, deleteItems, deleteTemplates, activeNodeId, activeTemplateId, lastClickedId, addLog, tabState.order, setActiveTemplateId, setDocumentView, setView]);

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

    const handleUpdateToastClose = useCallback(() => {
        setUpdateToast(prev => {
            if (prev.status === 'error') {
                return {
                    status: 'idle',
                    version: prev.version,
                    releaseName: prev.releaseName,
                    progress: 0,
                    bytesTransferred: null,
                    bytesTotal: null,
                    visible: false,
                    snoozed: false,
                    errorMessage: null,
                    errorDetails: null,
                };
            }

            return {
                ...prev,
                visible: false,
                snoozed: true,
                errorMessage: null,
                errorDetails: null,
            };
        });
    }, []);

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

    const updateDatabaseStatus = useCallback((message: string, tone: DatabaseStatusTone = 'info') => {
        setDatabaseStatus({ message, tone });
    }, []);

    const handleSelectDatabaseFile = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.dbSelectAndLoad) {
            updateDatabaseStatus('Selecting a database requires the desktop application.', 'error');
            return;
        }
        if (isDatabaseBusy) {
            return;
        }

        setIsDatabaseBusy(true);
        updateDatabaseStatus('Select a SQLite database to load...', 'info');

        try {
            const result = await repository.selectDatabaseFile();
            if (!result.success) {
                if (result.canceled) {
                    updateDatabaseStatus('Database selection cancelled.', 'info');
                    return;
                }
                const message = result.error || 'Failed to load the selected database file.';
                addLog('ERROR', `Database change failed: ${message}`);
                updateDatabaseStatus(message, 'error');
                return;
            }

            if (result.path) {
                setDatabasePath(result.path);
            }

            const successMessage = result.message ?? 'Database location updated. Reloading interface...';
            addLog('INFO', successMessage);
            updateDatabaseStatus(successMessage, 'success');

            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load the selected database file.';
            addLog('ERROR', `Database change failed: ${message}`);
            updateDatabaseStatus(message, 'error');
        } finally {
            setIsDatabaseBusy(false);
        }
    }, [addLog, isDatabaseBusy, updateDatabaseStatus]);

    const handleCreateNewDatabase = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.dbCreateNew) {
            updateDatabaseStatus('Creating a database requires the desktop application.', 'error');
            return;
        }
        if (isDatabaseBusy) {
            return;
        }

        setIsDatabaseBusy(true);
        updateDatabaseStatus('Choose where to save the new database...', 'info');

        try {
            const result = await repository.createNewDatabase();
            if (!result.success) {
                if (result.canceled) {
                    updateDatabaseStatus('Database creation cancelled.', 'info');
                    return;
                }
                const message = result.error || 'Failed to create a new database file.';
                addLog('ERROR', `Database creation failed: ${message}`);
                updateDatabaseStatus(message, 'error');
                return;
            }

            if (result.path) {
                setDatabasePath(result.path);
            }

            const successMessage = result.message ?? 'New database created. Reloading interface...';
            addLog('INFO', successMessage);
            updateDatabaseStatus(successMessage, 'success');

            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create a new database file.';
            addLog('ERROR', `Database creation failed: ${message}`);
            updateDatabaseStatus(message, 'error');
        } finally {
            setIsDatabaseBusy(false);
        }
    }, [addLog, isDatabaseBusy, updateDatabaseStatus]);

    const handleBackupDatabase = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.dbBackup) {
            updateDatabaseStatus('Database backups are unavailable in this environment.', 'error');
            return;
        }
        if (isDatabaseBusy) {
            return;
        }

        setIsDatabaseBusy(true);
        updateDatabaseStatus('Creating database backup...', 'info');

        try {
            const result = await repository.backupDatabase();
            if (result.success) {
                const message = result.message || 'Database backup completed successfully.';
                addLog('INFO', message);
                updateDatabaseStatus(message, 'success');
            } else {
                const message = result.error || 'Database backup failed.';
                addLog('ERROR', message);
                updateDatabaseStatus(message, 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Database backup failed.';
            addLog('ERROR', `Database backup failed: ${message}`);
            updateDatabaseStatus(message, 'error');
        } finally {
            setIsDatabaseBusy(false);
        }
    }, [addLog, isDatabaseBusy, updateDatabaseStatus]);

    const handleDatabaseIntegrityCheck = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.dbIntegrityCheck) {
            updateDatabaseStatus('Integrity checks require the desktop application.', 'error');
            return;
        }
        if (isDatabaseBusy) {
            return;
        }

        setIsDatabaseBusy(true);
        updateDatabaseStatus('Running database integrity check...', 'info');

        try {
            const result = await repository.runIntegrityCheck();
            if (result.success) {
                const message = result.results || 'Integrity check completed successfully.';
                addLog('INFO', message);
                updateDatabaseStatus(message, 'success');
            } else {
                const message = result.error || 'Integrity check failed.';
                addLog('ERROR', message);
                updateDatabaseStatus(message, 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Integrity check failed.';
            addLog('ERROR', `Integrity check failed: ${message}`);
            updateDatabaseStatus(message, 'error');
        } finally {
            setIsDatabaseBusy(false);
        }
    }, [addLog, isDatabaseBusy, updateDatabaseStatus]);

    const handleDatabaseVacuum = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.dbVacuum) {
            updateDatabaseStatus('Vacuum requires the desktop application.', 'error');
            return;
        }
        if (isDatabaseBusy) {
            return;
        }

        setIsDatabaseBusy(true);
        updateDatabaseStatus('Vacuuming database pages...', 'info');

        try {
            const result = await repository.runVacuum();
            if (result.success) {
                const message = 'Database vacuum completed successfully.';
                addLog('INFO', message);
                updateDatabaseStatus(message, 'success');
            } else {
                const message = result.error || 'Vacuum operation failed.';
                addLog('ERROR', message);
                updateDatabaseStatus(message, 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Vacuum operation failed.';
            addLog('ERROR', `Vacuum operation failed: ${message}`);
            updateDatabaseStatus(message, 'error');
        } finally {
            setIsDatabaseBusy(false);
        }
    }, [addLog, isDatabaseBusy, updateDatabaseStatus]);

    const databaseMenuItems = useMemo<MenuItem[]>(() => {
        if (!isElectron) {
            return [
                { label: 'Database management is unavailable in the browser preview.', action: () => undefined, disabled: true },
            ];
        }

        return [
            { label: 'Create New Database…', action: handleCreateNewDatabase, icon: DatabaseIcon, disabled: isDatabaseBusy },
            { label: 'Open Database…', action: handleSelectDatabaseFile, icon: FolderDownIcon, disabled: isDatabaseBusy },
            { label: 'Back Up Database…', action: handleBackupDatabase, icon: SaveIcon, disabled: isDatabaseBusy },
            { type: 'separator' },
            { label: 'Run Integrity Check', action: handleDatabaseIntegrityCheck, icon: CheckIcon, disabled: isDatabaseBusy },
            { label: 'Vacuum Database', action: handleDatabaseVacuum, icon: SparklesIcon, disabled: isDatabaseBusy },
        ];
    }, [handleCreateNewDatabase, handleSelectDatabaseFile, handleBackupDatabase, handleDatabaseIntegrityCheck, handleDatabaseVacuum, isDatabaseBusy]);

    const handleDatabaseMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (databaseMenuItems.length === 0) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = {
            x: event.clientX || rect.left,
            y: rect.bottom + 4,
        };

        setContextMenu({
            isOpen: true,
            position,
            items: databaseMenuItems,
        });
    }, [databaseMenuItems, setContextMenu]);

    const commands: Command[] = useMemo(() => [
        { id: 'new-document', name: 'Create New Document', action: () => handleNewDocument(), category: 'File', icon: PlusIcon, shortcut: ['Control', 'N'], keywords: 'add create file' },
        { id: 'new-from-clipboard', name: 'New from Clipboard', action: () => { addLog('INFO', 'Command: New document from clipboard.'); void handleNewDocumentFromClipboard(); }, category: 'File', icon: CopyIcon, shortcut: ['Control', 'Alt', 'V'], keywords: 'clipboard import paste new' },
        { id: 'new-code-file', name: 'Create New Code File', action: handleOpenNewCodeFileModal, category: 'File', icon: CodeIcon, shortcut: ['Control', 'Shift', 'N'], keywords: 'add create script' },
        { id: 'new-folder', name: 'Create New Folder', action: handleNewRootFolder, category: 'File', icon: FolderPlusIcon, shortcut: ['Control', 'Alt', 'N'], keywords: 'add create directory' },
        { id: 'new-subfolder', name: 'Create New Subfolder', action: handleNewSubfolder, category: 'File', icon: FolderDownIcon, shortcut: ['Control', 'Alt', 'Shift', 'N'], keywords: 'add create directory child' },
        { id: 'new-template', name: 'Create New Template', action: handleNewTemplate, category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create template' },
        { id: 'new-from-template', name: 'New Document from Template...', action: () => { addLog('INFO', 'Command: New Document from Template.'); setCreateFromTemplateOpen(true); }, category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create file instance' },
        { id: 'duplicate-item', name: 'Duplicate Selection', action: handleDuplicateSelection, category: 'File', icon: CopyIcon, shortcut: ['Control', 'D'], keywords: 'copy clone' },
        { id: 'rename-item', name: 'Rename Selected Item', action: handleRenameSelection, category: 'File', icon: PencilIcon, shortcut: ['F2'], keywords: 'rename edit title' },
        { id: 'delete-item', name: 'Delete Selection', action: () => handleDeleteSelection(selectedIds), category: 'File', icon: TrashIcon, shortcut: ['Delete'], keywords: 'remove discard' },
        { id: 'document-tree-select-all', name: 'Select All Tree Items', action: handleDocumentTreeSelectAll, category: 'Document Tree', icon: CheckIcon, shortcut: ['Control', 'A'], keywords: 'select highlight all tree' },
        { id: 'document-tree-expand-all', name: 'Expand All Tree Folders', action: handleExpandAll, category: 'Document Tree', icon: ExpandAllIcon, shortcut: ['Control', 'Alt', 'ArrowRight'], keywords: 'open folders tree expand' },
        { id: 'document-tree-collapse-all', name: 'Collapse All Tree Folders', action: handleCollapseAll, category: 'Document Tree', icon: CollapseAllIcon, shortcut: ['Control', 'Alt', 'ArrowLeft'], keywords: 'close folders tree collapse' },
        { id: 'document-tree-move-selection-up', name: 'Move Selection Up', action: handleMoveSelectionUp, category: 'Document Tree', icon: ArrowUpIcon, shortcut: ['Alt', 'ArrowUp'], keywords: 'reorder move up tree' },
        { id: 'document-tree-move-selection-down', name: 'Move Selection Down', action: handleMoveSelectionDown, category: 'Document Tree', icon: ArrowDownIcon, shortcut: ['Alt', 'ArrowDown'], keywords: 'reorder move down tree' },
        { id: 'document-tree-copy-content', name: 'Copy Document Content', action: handleCopySelectionContent, category: 'Document Tree', icon: CopyIcon, shortcut: ['Control', 'Shift', 'C'], keywords: 'copy clipboard tree content' },
        { id: 'format-document', name: 'Format Document', action: handleFormatDocument, category: 'Editor', icon: FormatIcon, shortcut: ['Control', 'Shift', 'F'], keywords: 'beautify pretty print clean code' },
        { id: 'toggle-command-palette', name: 'Toggle Command Palette', action: handleToggleCommandPalette, category: 'View', icon: CommandIcon, shortcut: ['Control', 'Shift', 'P'], keywords: 'find action go to' },
        { id: 'toggle-editor', name: 'Switch to Editor View', action: () => { addLog('INFO', 'Command: Switch to Editor View.'); setView('editor'); }, category: 'View', icon: PencilIcon, keywords: 'main document' },
        { id: 'toggle-settings', name: 'Toggle Settings View', action: toggleSettingsView, category: 'View', icon: GearIcon, keywords: 'configure options' },
        { id: 'toggle-info', name: 'Toggle Info View', action: () => { addLog('INFO', 'Command: Toggle Info View.'); setView(v => v === 'info' ? 'editor' : 'info'); }, category: 'View', icon: InfoIcon, keywords: 'help docs readme' },
        { id: 'open-about', name: 'About DocForge', action: handleOpenAbout, category: 'Help', icon: SparklesIcon, keywords: 'about credits information' },
        { id: 'toggle-logs', name: 'Toggle Logs Panel', action: () => { addLog('INFO', 'Command: Toggle Logs Panel.'); setIsLoggerVisible(v => !v); }, category: 'View', icon: TerminalIcon, keywords: 'debug console' },
    ], [handleNewDocument, handleOpenNewCodeFileModal, handleNewRootFolder, handleNewSubfolder, handleDeleteSelection, handleNewTemplate, toggleSettingsView, handleDuplicateSelection, handleRenameSelection, selectedIds, addLog, handleToggleCommandPalette, handleFormatDocument, handleOpenAbout, handleNewDocumentFromClipboard, handleDocumentTreeSelectAll, handleExpandAll, handleCollapseAll, handleMoveSelectionUp, handleMoveSelectionDown, handleCopySelectionContent]);

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
                { label: 'New from Clipboard', icon: CopyIcon, action: () => { void handleNewDocumentFromClipboard(parentIdForNewItem); }, shortcut: getCommand('new-from-clipboard')?.shortcutString },
                { label: 'New Code File', icon: CodeIcon, action: handleOpenNewCodeFileModal, shortcut: getCommand('new-code-file')?.shortcutString },
                { label: 'New Folder', icon: FolderPlusIcon, action: () => handleNewFolder(parentIdForNewItem), shortcut: getCommand('new-folder')?.shortcutString },
                { label: 'New from Template...', icon: DocumentDuplicateIcon, action: newFromTemplateAction, shortcut: getCommand('new-from-template')?.shortcutString },
                { type: 'separator' },
                { label: 'Format', icon: FormatIcon, action: handleFormatDocument, disabled: !isFormattable || currentSelection.size !== 1, shortcut: getCommand('format-document')?.shortcutString },
                { label: 'Rename', icon: PencilIcon, action: () => handleStartRenamingNode(nodeId), disabled: currentSelection.size !== 1, shortcut: getCommand('rename-item')?.shortcutString },
                { label: 'Duplicate', icon: DocumentDuplicateIcon, action: handleDuplicateSelection, disabled: currentSelection.size === 0, shortcut: getCommand('duplicate-item')?.shortcutString },
                { type: 'separator' },
                { label: 'Copy Content', icon: CopyIcon, action: () => hasDocuments && handleCopyNodeContent(selectedNodes.find(n => n.type === 'document')!.id), disabled: !hasDocuments},
                { type: 'separator' },
                { label: 'Delete', icon: TrashIcon, action: () => handleDeleteSelection(currentSelection), disabled: currentSelection.size === 0, shortcut: getCommand('delete-item')?.shortcutString }
            );
        } else { // Clicked on empty space
             menuItems.push(
                { label: 'New Document', icon: PlusIcon, action: () => handleNewDocument(null), shortcut: getCommand('new-document')?.shortcutString },
                { label: 'New from Clipboard', icon: CopyIcon, action: () => { void handleNewDocumentFromClipboard(null); }, shortcut: getCommand('new-from-clipboard')?.shortcutString },
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
    }, [selectedIds, items, handleNewDocument, handleNewFolder, handleDuplicateSelection, handleDeleteSelection, handleCopyNodeContent, addLog, enrichedCommands, handleOpenNewCodeFileModal, handleFormatDocument, handleStartRenamingNode, handleNewDocumentFromClipboard]);


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
            const shortcut = formatShortcut(e);
            const command = shortcutMap.get(shortcut);

            const activeEl = document.activeElement;
            const isFormElement = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
            const isPaletteInput = activeEl === commandPaletteInputRef.current;
            const isCommandPaletteToggle = command?.id === 'toggle-command-palette';

            if (isFormElement && !isPaletteInput && !isCommandPaletteToggle) {
                return;
            }

            if (command?.category === 'Document Tree') {
                const target = e.target as HTMLElement | null;
                const isWithinSidebar = target?.closest('[data-component="document-tree-sidebar"]');
                if (!isWithinSidebar) {
                    return;
                }
            }

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
        if (view === 'info') return <InfoView settings={settings} />;
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
                        previewScale={previewScale}
                        onPreviewScaleChange={handlePreviewScaleChange}
                        previewMinScale={PREVIEW_MIN_SCALE}
                        previewMaxScale={PREVIEW_MAX_SCALE}
                        previewZoomStep={PREVIEW_ZOOM_STEP}
                        previewInitialScale={PREVIEW_INITIAL_SCALE}
                        previewResetSignal={previewResetSignal}
                        onPreviewVisibilityChange={setIsPreviewVisible}
                        onPreviewZoomAvailabilityChange={setIsPreviewZoomReady}
                        onPreviewMetadataChange={setPreviewMetadata}
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
                            onNewFromClipboard={(parentId) => { void handleNewDocumentFromClipboard(parentId); }}
                            onNewSubfolder={(parentId) => handleNewFolder(parentId)}
                            onImportFiles={handleImportFilesIntoFolder}
                            onRenameFolderTitle={handleRenameNode}
                            onNavigateToNode={handleNavigateToNode}
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

    const shouldShowUpdateToast = updateToast.visible && updateToast.status !== 'idle';
    const updateVersionLabel = updateToast.version ?? updateToast.releaseName ?? 'latest';
    const updateToastStatus: 'downloading' | 'downloaded' | 'error' = updateToast.status === 'idle'
        ? 'downloading'
        : updateToast.status;

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
                                        activeDocumentId={activeDocumentId}
                                        openDocumentIds={openDocumentIds}
                                        onSelectNode={handleSelectNode}
                                        onDeleteSelection={handleDeleteSelection}
                                        onDeleteNode={handleDeleteNode}
                                        onRenameNode={handleRenameNode}
                                        onMoveNode={moveItems}
                                        onImportNodes={handleImportNodesFromTransfer}
                                        onDropFiles={handleDropFiles}
                                        onNewDocument={() => handleNewDocument()}
                                        onNewRootFolder={handleNewRootFolder}
                                        onNewSubfolder={handleNewSubfolder}
                                        onNewCodeFile={handleOpenNewCodeFileModal}
                                        onNewFromClipboard={() => { void handleNewDocumentFromClipboard(); }}
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
                                        customShortcuts={settings.customShortcuts}
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
                                    {openDocumentIds.length > 0 && (
                                        <DocumentTabs
                                            documents={documentItems}
                                            openDocumentIds={openDocumentIds}
                                            activeDocumentId={activeDocumentId}
                                            onSelectTab={handleActivateTab}
                                            onCloseTab={handleCloseTab}
                                            onCloseOthers={handleCloseOtherTabs}
                                            onCloseTabsToRight={handleCloseTabsToRight}
                                            onReorderTabs={reorderDocumentTabs}
                                        />
                                    )}
                                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                        {renderMainContent()}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <section className="flex-1 flex flex-col overflow-hidden bg-background">
                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                    {renderMainContent()}
                                </div>
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
                    databasePath={databasePath}
                    databaseStatus={databaseStatus}
                    onDatabaseMenu={handleDatabaseMenu}
                    onOpenAbout={handleOpenAbout}
                    previewScale={previewScale}
                    onPreviewZoomIn={handlePreviewZoomIn}
                    onPreviewZoomOut={handlePreviewZoomOut}
                    onPreviewReset={handlePreviewReset}
                    isPreviewZoomAvailable={isPreviewVisible && isPreviewZoomReady}
                    previewMinScale={PREVIEW_MIN_SCALE}
                    previewMaxScale={PREVIEW_MAX_SCALE}
                    previewInitialScale={PREVIEW_INITIAL_SCALE}
                    previewMetadata={previewMetadata}
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

            {shouldShowUpdateToast && (
                <UpdateNotification
                    status={updateToastStatus}
                    versionLabel={updateVersionLabel}
                    progress={updateToast.progress}
                    bytesTransferred={updateToast.bytesTransferred ?? undefined}
                    bytesTotal={updateToast.bytesTotal ?? undefined}
                    errorMessage={updateToast.errorMessage ?? undefined}
                    errorDetails={updateToast.errorDetails ?? undefined}
                    onInstall={updateToast.status === 'downloaded' && window.electronAPI?.quitAndInstallUpdate
                        ? () => window.electronAPI!.quitAndInstallUpdate!()
                        : undefined}
                    onClose={handleUpdateToastClose}
                />
            )}

            {clipboardNotice && (
                <InfoModal
                    title={clipboardNotice.title}
                    message={clipboardNotice.message}
                    onClose={() => setClipboardNotice(null)}
                    primaryAction={clipboardNotice.helpUrl
                        ? {
                            label: 'View instructions',
                            onClick: () => {
                                if (clipboardNotice.helpUrl) {
                                    window.open(clipboardNotice.helpUrl, '_blank', 'noopener');
                                }
                                setClipboardNotice(null);
                            },
                        }
                        : undefined}
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


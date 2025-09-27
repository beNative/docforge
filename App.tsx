import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
// Hooks
// Fix: Import the correct, implemented hook `useNodes` instead of the empty `usePrompts`.
import { useDocuments } from './hooks/usePrompts';
import { useTemplates } from './hooks/useTemplates';
import { useSettings } from './hooks/useSettings';
import { useLLMStatus } from './hooks/useLLMStatus';
import { useLogger } from './hooks/useLogger';
// Components
import Sidebar from './components/Sidebar';
import DocumentEditor from './components/PromptEditor';
import TemplateEditor from './components/TemplateEditor';
import { WelcomeScreen } from './components/WelcomeScreen';
// Fix: Add default import for SettingsView
import SettingsView from './components/SettingsView';
import StatusBar from './components/StatusBar';
import LoggerPanel from './components/LoggerPanel';
import CommandPalette from './components/CommandPalette';
import InfoView from './components/InfoView';
import UpdateNotification from './components/UpdateNotification';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import DocumentHistoryView from './components/PromptHistoryView';
import { PlusIcon, FolderPlusIcon, TrashIcon, GearIcon, InfoIcon, TerminalIcon, DocumentDuplicateIcon, PencilIcon, CopyIcon } from './components/Icons';
import Header from './components/Header';
import CustomTitleBar from './components/CustomTitleBar';
import ConfirmModal from './components/ConfirmModal';
import FatalError from './components/FatalError';
// Types
// Fix: Correctly import DocumentOrFolder which is now defined in types.ts
import type { DocumentOrFolder, Command, LogMessage, DiscoveredLLMModel, DiscoveredLLMService, Settings, DocumentTemplate } from './types';
// Context
import { IconProvider } from './contexts/IconContext';
// Services & Constants
// Fix: Correct import for storageService
import { storageService } from './services/storageService';
import { llmDiscoveryService } from './services/llmDiscoveryService';
import { LOCAL_STORAGE_KEYS } from './constants';
import { repository } from './services/repository';
import { DocumentNode } from './components/PromptTreeItem';

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 200;

const DEFAULT_LOGGER_HEIGHT = 288;
const MIN_LOGGER_HEIGHT = 100;

// Fix: Use optional chaining which is now type-safe with the global declaration.
const isElectron = !!window.electronAPI;

type NavigableItem = { id: string; type: 'document' | 'folder' | 'template'; parentId: string | null; };

const App: React.FC = () => {
    const { addLog } = useLogger();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    // Effect for initializing the repository and migrating data
    useEffect(() => {
        const initializeApp = async () => {
            try {
                await repository.init();
                addLog('INFO', 'Application repository initialized successfully.');
                setIsInitialized(true);
            } catch (error) {
                const message = `Fatal: Application initialization failed. ${error instanceof Error ? error.message : String(error)}`;
                // Log to the in-memory React logger
                addLog('ERROR', message);
                // The main process will have already logged this to a file.
                // We just need to trigger the UI error state.
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
    // State Hooks
    const { settings, saveSettings, loaded: settingsLoaded } = useSettings();
    const { items, addDocument, addFolder, updateItem, commitVersion, deleteItems, moveItems, getDescendantIds, duplicateItems } = useDocuments();
    const { templates, addTemplate, updateTemplate, deleteTemplate, deleteTemplates } = useTemplates();
    
    // Active Item State
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState(new Set<string>());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());

    // UI State
    const [view, setView] = useState<'editor' | 'info' | 'settings'>('editor');
    const [documentView, setDocumentView] = useState<'editor' | 'history'>('editor');
    const [isLoggerVisible, setIsLoggerVisible] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [commandPaletteSearch, setCommandPaletteSearch] = useState('');
    const [isCreateFromTemplateOpen, setCreateFromTemplateOpen] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
    const [loggerPanelHeight, setLoggerPanelHeight] = useState(DEFAULT_LOGGER_HEIGHT);
    const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
    const [discoveredServices, setDiscoveredServices] = useState<DiscoveredLLMService[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [updateInfo, setUpdateInfo] = useState<{ ready: boolean; version: string | null }>({ ready: false, version: null });
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');


    const isSidebarResizing = useRef(false);
    const isLoggerResizing = useRef(false);
    const commandPaletteTargetRef = useRef<HTMLDivElement>(null);
    const commandPaletteInputRef = useRef<HTMLInputElement>(null);

    const llmStatus = useLLMStatus(settings.llmProviderUrl);
    const { logs, addLog } = useLogger();
    const lastLogRef = useRef<LogMessage | null>(null);

    // Effect to apply UI scaling
    useEffect(() => {
        if (settingsLoaded) {
            (document.documentElement.style as any).zoom = `${settings.uiScale / 100}`;
        }
    }, [settings.uiScale, settingsLoaded]);

    // Derived State
    const activeNode = useMemo(() => {
        return items.find(p => p.id === activeNodeId) || null;
    }, [items, activeNodeId]);

    const activeTemplate = useMemo(() => {
        return templates.find(t => t.template_id === activeTemplateId) || null;
    }, [templates, activeTemplateId]);

    const activeDocument = useMemo(() => {
        return activeNode?.type === 'document' ? activeNode : null;
    }, [activeNode]);

    const { documentTree, navigableItems } = useMemo(() => {
        let itemsToBuildFrom = items;
        if (searchTerm.trim()) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const visibleIds = new Set<string>();
            const originalItemsById: Map<string, DocumentOrFolder> = new Map(items.map(i => [i.id, i]));
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
                    items.forEach(p => { if (p.parentId === parentId) { descendantIds.add(p.id); if (p.type === 'folder') findChildren(p.id); } });
                };
                findChildren(itemId);
                return descendantIds;
            };
            items.forEach(item => {
                if (item.title.toLowerCase().includes(lowerCaseSearchTerm)) {
                    visibleIds.add(item.id);
                    getAncestors(item.id);
                    if (item.type === 'folder') getDescendantIdsRecursive(item.id).forEach(id => visibleIds.add(id));
                }
            });
            itemsToBuildFrom = items.filter(item => visibleIds.has(item.id));
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
    }, [items, templates, searchTerm, expandedFolderIds]);

    // Get app version
    useEffect(() => {
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(setAppVersion);
        }
    }, []);

    // Listen for downloaded updates from the main process
    useEffect(() => {
        if (window.electronAPI?.onUpdateDownloaded) {
            const cleanup = window.electronAPI.onUpdateDownloaded((version) => {
                addLog('INFO', `Update version ${version} is ready to be installed.`);
                setUpdateInfo({ ready: true, version });
            });
            return cleanup;
        }
    }, [addLog]);


    // Load panel sizes and expanded folders from storage on initial render
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

    // Save expanded IDs to storage whenever they change
    useEffect(() => {
        if (settingsLoaded) { 
            storageService.save(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, Array.from(expandedFolderIds));
        }
    }, [expandedFolderIds, settingsLoaded]);

    // Select the first item on load or when items change
    useEffect(() => {
        if (items.length > 0 && activeNodeId === null && activeTemplateId === null) {
            const firstId = items[0].id;
            setActiveNodeId(firstId);
            setSelectedIds(new Set([firstId]));
        } else if (items.length === 0 && activeNodeId) {
            setActiveNodeId(null);
            setSelectedIds(new Set());
        }
    }, [items, activeNodeId, activeTemplateId]);

    // Service Discovery logic
    const handleDetectServices = useCallback(async () => {
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

    useEffect(() => {
        handleDetectServices();
    }, [handleDetectServices]);


    // Fetch available models for the status bar dropdown
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

    // Effect for auto-saving logs
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


    // Handlers
    const getParentIdForNewItem = useCallback(() => {
        if (!activeNode) return null;
        return activeNode.type === 'folder' ? activeNode.id : activeNode.parentId;
    }, [activeNode]);

    const handleNewDocument = useCallback(async () => {
        const parentId = getParentIdForNewItem();
        const newDoc = await addDocument({ parentId });
        setActiveNodeId(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument, getParentIdForNewItem]);
    
    const handleNewRootFolder = useCallback(async () => {
        const newFolder = await addFolder(null);
        setActiveNodeId(newFolder.id);
        setSelectedIds(new Set([newFolder.id]));
        setLastClickedId(newFolder.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addFolder]);

    const handleNewSubfolder = useCallback(async () => {
        if (activeNode?.type === 'folder') {
            const newFolder = await addFolder(activeNode.id, 'New Folder');
            setActiveNodeId(newFolder.id);
            setSelectedIds(new Set([newFolder.id]));
            setLastClickedId(newFolder.id);
            setExpandedFolderIds(prev => new Set(prev).add(activeNode.id));
        }
    }, [addFolder, activeNode]);

    const handleDuplicateSelection = useCallback(async () => {
        if (selectedIds.size > 0) {
            await duplicateItems(Array.from(selectedIds));
        }
    }, [selectedIds, duplicateItems]);

    const handleNewTemplate = useCallback(async () => {
        const newTemplate = await addTemplate();
        setActiveTemplateId(newTemplate.template_id);
        setLastClickedId(newTemplate.template_id);
        setActiveNodeId(null);
        setSelectedIds(new Set());
        setView('editor');
    }, [addTemplate]);

    const handleCreateFromTemplate = useCallback(async (title: string, content: string) => {
        const newDoc = await addDocument({ parentId: null, title, content });
        setActiveNodeId(newDoc.id);
        setSelectedIds(new Set([newDoc.id]));
        setLastClickedId(newDoc.id);
        setActiveTemplateId(null);
        setDocumentView('editor');
        setView('editor');
    }, [addDocument]);

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

    const handleCommitVersion = (content: string) => {
        if (activeNodeId) {
            commitVersion(activeNodeId, content);
        }
    };
    
    const handleSaveTemplate = (updatedTemplate: Partial<Omit<DocumentTemplate, 'template_id'>>) => {
        if (activeTemplateId) {
            updateTemplate(activeTemplateId, updatedTemplate);
        }
    };
    
    const handleRenameNode = (id: string, title: string) => {
        updateItem(id, { title });
    };

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
            await performDelete();
        } else {
            setConfirmAction({
                title: `Delete ${totalItems} item(s)`,
                message: <>Are you sure you want to permanently delete {totalItems} selected item(s)? This action cannot be undone.</>,
                onConfirm: () => {
                    performDelete();
                    setConfirmAction(null);
                }
            });
        }
    }, [items, templates, deleteItems, deleteTemplates, activeNodeId, activeTemplateId, lastClickedId]);

    const handleDeleteNode = useCallback((id: string, shiftKey: boolean = false) => {
        const itemToDelete = items.find(p => p.id === id);
        if (!itemToDelete) return;

        const idsToDelete = selectedIds.has(id) ? selectedIds : new Set([id]);
        
        handleDeleteSelection(idsToDelete, { force: shiftKey });
    }, [items, selectedIds, handleDeleteSelection]);

    const handleDeleteTemplate = useCallback((id: string, shiftKey: boolean = false) => {
        const templateToDelete = templates.find(t => t.template_id === id);
        if (!templateToDelete) return;

        const idsToDelete = selectedIds.has(id) ? selectedIds : new Set([id]);

        handleDeleteSelection(idsToDelete, { force: shiftKey });
    }, [templates, selectedIds, handleDeleteSelection]);

    const handleToggleExpand = (id: string) => {
        setExpandedFolderIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return newSet;
        });
    };

    const toggleSettingsView = () => {
        setView(v => v === 'settings' ? 'editor' : 'settings')
    }

    const handleRestoreDocumentVersion = useCallback((documentId: string, content: string) => {
        const doc = items.find(p => p.id === documentId);
        if (doc) {
            commitVersion(documentId, content);
            addLog('INFO', `Restored document "${doc.title}" to a previous version.`);
            setDocumentView('editor');
        }
    }, [items, commitVersion, addLog]);


    // --- Resizable Panels Logic ---
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
    // --- End Resizable Panels Logic ---
    
    const handleOpenCommandPalette = useCallback(() => {
        setIsCommandPaletteOpen(true);
    }, []);

    const handleCloseCommandPalette = useCallback(() => {
        setIsCommandPaletteOpen(false);
        setCommandPaletteSearch('');
    }, []);
    
    const handleToggleCommandPalette = useCallback(() => {
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
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrl = isMac ? e.metaKey : e.ctrlKey;

            if (isCtrl && e.key === 'n') {
                e.preventDefault();
                handleNewDocument();
            }
            if (isCtrl && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                handleToggleCommandPalette();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNewDocument, handleToggleCommandPalette]);
    
    // Command Palette Commands
    const commands: Command[] = useMemo(() => [
        { id: 'new-document', name: 'Create New Document', action: handleNewDocument, category: 'File', icon: PlusIcon, shortcut: ['Ctrl', 'N'], keywords: 'add create file' },
        { id: 'new-folder', name: 'Create New Folder', action: handleNewRootFolder, category: 'File', icon: FolderPlusIcon, keywords: 'add create directory' },
        { id: 'new-template', name: 'Create New Template', action: handleNewTemplate, category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create template' },
        { id: 'new-from-template', name: 'New Document from Template...', action: () => setCreateFromTemplateOpen(true), category: 'File', icon: DocumentDuplicateIcon, keywords: 'add create file instance' },
        { id: 'duplicate-item', name: 'Duplicate Selection', action: handleDuplicateSelection, category: 'File', icon: CopyIcon, keywords: 'copy clone' },
        { id: 'delete-item', name: 'Delete Selection', action: () => handleDeleteSelection(selectedIds), category: 'File', icon: TrashIcon, keywords: 'remove discard' },
        { id: 'toggle-editor', name: 'Switch to Editor View', action: () => setView('editor'), category: 'View', icon: PencilIcon, keywords: 'main document' },
        { id: 'toggle-settings', name: 'Toggle Settings View', action: toggleSettingsView, category: 'View', icon: GearIcon, keywords: 'configure options' },
        { id: 'toggle-info', name: 'Toggle Info View', action: () => setView(v => v === 'info' ? 'editor' : 'info'), category: 'View', icon: InfoIcon, keywords: 'help docs readme' },
        { id: 'toggle-logs', name: 'Toggle Logs Panel', action: () => setIsLoggerVisible(v => !v), category: 'View', icon: TerminalIcon, keywords: 'debug console' },
    ], [handleNewDocument, handleNewRootFolder, handleDeleteSelection, handleNewTemplate, toggleSettingsView, handleDuplicateSelection, selectedIds]);

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
        if (view === 'settings') return <SettingsView settings={settings} onSave={saveSettings} discoveredServices={discoveredServices} onDetectServices={handleDetectServices} isDetecting={isDetecting} />;
        
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
                        />
                    );
                }
                return (
                    <DocumentEditor 
                        key={activeNode.id}
                        document={activeNode}
                        onSave={handleSaveDocumentTitle}
                        onCommitVersion={handleCommitVersion}
                        onDelete={handleDeleteNode}
                        settings={settings}
                        onShowHistory={() => setDocumentView('history')}
                    />
                );
            }
            return <WelcomeScreen onNewDocument={handleNewDocument} />;
        }
        return <WelcomeScreen onNewDocument={handleNewDocument} />;
    };

    const headerProps = {
        onToggleSettingsView: toggleSettingsView,
        onToggleInfoView: () => setView(v => v === 'info' ? 'editor' : 'info'),
        onShowEditorView: () => setView('editor'),
        onToggleLogger: () => setIsLoggerVisible(v => !v),
        onOpenCommandPalette: handleOpenCommandPalette,
        isInfoViewActive: view === 'info',
        isSettingsViewActive: view === 'settings',
        isEditorViewActive: view === 'editor',
    };

    return (
        <IconProvider value={{ iconSet: getSupportedIconSet(settings.iconSet) }}>
            <div className="flex flex-col h-full font-sans bg-background text-text-main antialiased">
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
                <main className="flex-1 flex overflow-hidden">
                    {view === 'editor' && (
                        <>
                             <aside 
                                style={{ width: `${sidebarWidth}px` }} 
                                className="bg-secondary border-r border-border-color flex flex-col flex-shrink-0"
                            >
                                <Sidebar 
                                    documents={items}
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
                                    onNewDocument={handleNewDocument}
                                    onNewRootFolder={handleNewRootFolder}
                                    onNewSubfolder={handleNewSubfolder}
                                    onDuplicateSelection={handleDuplicateSelection}
                                    onCopyNodeContent={handleCopyNodeContent}
                                    expandedFolderIds={expandedFolderIds}
                                    onToggleExpand={handleToggleExpand}
                                    searchTerm={searchTerm}
                                    setSearchTerm={setSearchTerm}

                                    templates={templates}
                                    activeTemplateId={activeTemplateId}
                                    onSelectTemplate={handleSelectTemplate}
                                    onDeleteTemplate={handleDeleteTemplate}
                                    onRenameTemplate={handleRenameTemplate}
                                    onNewTemplate={handleNewTemplate}
                                    onNewFromTemplate={() => setCreateFromTemplateOpen(true)}
                                />
                            </aside>
                            <div 
                                onMouseDown={handleSidebarMouseDown}
                                className="w-1.5 cursor-col-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
                            />
                        </>
                    )}
                    <section className="flex-1 flex flex-col overflow-y-auto bg-background">
                        {renderMainContent()}
                    </section>
                </main>
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
            
            <LoggerPanel 
                isVisible={isLoggerVisible} 
                onToggleVisibility={() => setIsLoggerVisible(v => !v)}
                height={loggerPanelHeight}
                onResizeStart={handleLoggerMouseDown}
            />
            <CommandPalette 
                isOpen={isCommandPaletteOpen} 
                onClose={handleCloseCommandPalette}
                commands={commands}
                targetRef={commandPaletteTargetRef}
                searchTerm={commandPaletteSearch}
                onExecute={() => {
                    setIsCommandPaletteOpen(false);
                    setCommandPaletteSearch('');
                }}
            />

            {isCreateFromTemplateOpen && (
                <CreateFromTemplateModal
                    templates={templates}
                    onClose={() => setCreateFromTemplateOpen(false)}
                    onCreate={handleCreateFromTemplate}
                />
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
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </IconProvider>
    );
};

export default App;
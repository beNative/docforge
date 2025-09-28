import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { DocumentOrFolder, Settings, Command, DiscoveredLLMService, DiscoveredLLMModel, DocumentTemplate } from './types';
import { useDocuments } from './hooks/usePrompts';
import { useSettings } from './hooks/useSettings';
import { useLogger } from './hooks/useLogger';
import { useTemplates } from './hooks/useTemplates';
import { useLLMStatus } from './hooks/useLLMStatus';
import { useLocalStorage } from './hooks/useLocalStorage';
import { llmDiscoveryService } from './services/llmDiscoveryService';
import { getShortcutMap, formatShortcut, formatShortcutForDisplay } from './services/shortcutService';
import { LOCAL_STORAGE_KEYS } from './constants';
import Sidebar from './components/Sidebar';
import DocumentEditor from './components/PromptEditor';
import { WelcomeScreen } from './components/WelcomeScreen';
import SettingsView from './components/SettingsView';
import InfoView from './components/InfoView';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import LoggerPanel from './components/LoggerPanel';
import CustomTitleBar from './components/CustomTitleBar';
import DocumentHistoryView from './components/PromptHistoryView';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import CommandPalette from './components/CommandPalette';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import ConfirmModal from './components/ConfirmModal';
import UpdateNotification from './components/UpdateNotification';
import FatalError from './components/FatalError';

import {
  PlusIcon, FolderPlusIcon, TrashIcon, SparklesIcon, CommandIcon,
  GearIcon, InfoIcon, TerminalIcon, DocumentDuplicateIcon, HistoryIcon,
  SaveIcon, ExpandAllIcon, CollapseAllIcon
} from './components/Icons';

const isElectron = window.electronAPI;

const App: React.FC = () => {
  const { addLog } = useLogger();

  // =================================================================
  // Data Hooks
  // =================================================================
  const { settings, saveSettings, loaded: settingsLoaded } = useSettings();
  const { items, addDocument, addFolder, updateItem, commitVersion, deleteItem, deleteItems, moveItems, getDescendantIds, refresh: refreshDocuments, duplicateItems } = useDocuments();
  const { templates, addTemplate, updateTemplate, deleteTemplate, deleteTemplates } = useTemplates();
  const llmStatus = useLLMStatus(settings.llmProviderUrl);

  // =================================================================
  // State Management
  // =================================================================

  // View State
  const [activeView, setActiveView] = useState<'editor' | 'settings' | 'info' | 'history'>('editor');
  const [isLoggerVisible, setIsLoggerVisible] = useState(false);
  const [fatalError, setFatalError] = useState<{ title: string; header: string; details: string} | null>(null);

  // Update Notification
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null);
  useEffect(() => {
    if (isElectron) {
      const removeListener = isElectron.onUpdateDownloaded((version) => {
        addLog('INFO', `Update version ${version} downloaded.`);
        setUpdateInfo({ version });
      });
      return () => removeListener();
    }
  }, [addLog]);

  // Discovered LLM services and models
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredLLMService[]>([]);
  const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Document Tree State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useLocalStorage<Set<string>>(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, new Set());
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

  // Template State
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  // Modals & Popovers
  const [isCreateFromTemplateModalOpen, setIsCreateFromTemplateModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ onConfirm: () => void; message: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const commandPaletteButtonRef = useRef<HTMLButtonElement>(null);

  // UI Resizing State
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, 280);
  const [loggerHeight, setLoggerHeight] = useLocalStorage(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, 200);
  const isResizingSidebar = useRef(false);
  const isResizingLogger = useRef(false);
  
  // App Info
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    isElectron?.getAppVersion().then(setAppVersion);
  }, []);

  // =================================================================
  // Memos and Derived State
  // =================================================================
  const selectedItem = useMemo(() => {
    const lastSelectedId = Array.from(selectedIds).pop();
    return items.find(item => item.id === (focusedItemId || lastSelectedId));
  }, [items, selectedIds, focusedItemId]);

  const activeDocument = useMemo(() => {
    if (activeView === 'editor' && selectedItem?.type === 'document') return selectedItem;
    if (activeView === 'history' && selectedItem?.type === 'document') return selectedItem;
    return null;
  }, [activeView, selectedItem]);

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.template_id === activeTemplateId);
  }, [templates, activeTemplateId]);


  // =================================================================
  // Effects
  // =================================================================

  // Global Mouse Move/Up for Resizing
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingSidebar.current) {
      setSidebarWidth(prev => Math.max(200, Math.min(600, prev + e.movementX)));
    }
    if (isResizingLogger.current) {
      setLoggerHeight(prev => Math.max(100, Math.min(window.innerHeight / 2, prev - e.movementY)));
    }
  }, [setSidebarWidth, setLoggerHeight]);

  const handleGlobalMouseUp = useCallback(() => {
    isResizingSidebar.current = false;
    isResizingLogger.current = false;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);
  
  // Initial repository load
  useEffect(() => {
    const initRepo = async () => {
      try {
        await repository.init();
        await refreshDocuments();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog('ERROR', `Fatal: Repository initialization failed: ${message}`);
        setFatalError({
          title: 'Database Error',
          header: 'Could not initialize the application database.',
          details: 'The database file might be corrupted, locked by another process, or inaccessible due to permissions. Please try restarting the application.',
        });
      }
    };
    initRepo();
  }, [addLog, refreshDocuments]);


  // =================================================================
  // Callbacks and Handlers
  // =================================================================

  const handleDetectServices = useCallback(async () => {
    setIsDetecting(true);
    try {
      const services = await llmDiscoveryService.discoverServices();
      setDiscoveredServices(services);
    } catch (error) {
      addLog('ERROR', `Failed to discover LLM services: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDetecting(false);
    }
  }, [addLog]);

  useEffect(() => {
    handleDetectServices();
  }, [handleDetectServices]);

  useEffect(() => {
    const fetchModels = async () => {
      const currentService = discoveredServices.find(s => s.generateUrl === settings.llmProviderUrl);
      if (currentService) {
        try {
          const models = await llmDiscoveryService.fetchModels(currentService);
          setAvailableModels(models);
        } catch (e) {
          setAvailableModels([]);
        }
      } else {
        setAvailableModels([]);
      }
    };
    fetchModels();
  }, [settings.llmProviderUrl, discoveredServices]);

  const handleSelectNode = useCallback((id: string, e: React.MouseEvent) => {
    const isCtrl = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    setContextMenu(null);
    setFocusedItemId(id);
    
    if (isShift) {
        // Logic to select a range of items
    } else if (isCtrl) {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    } else {
        setSelectedIds(new Set([id]));
        const item = items.find(i => i.id === id);
        if (item?.type === 'document') {
            setActiveView('editor');
            setActiveTemplateId(null);
        }
    }
  }, [items]);

  const handleAddDocument = useCallback(async (parentId: string | null) => {
    const newDoc = await addDocument({ parentId });
    setFocusedItemId(newDoc.id);
    setSelectedIds(new Set([newDoc.id]));
    setActiveView('editor');
    setActiveTemplateId(null);
  }, [addDocument]);

  const handleAddFolder = useCallback(async (parentId: string | null) => {
    const newFolder = await addFolder(parentId);
    setFocusedItemId(newFolder.id);
    setSelectedIds(new Set([newFolder.id]));
    setRenamingNodeId(newFolder.id);
  }, [addFolder]);
  
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    isResizingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
  };
  
  const handleLoggerResizeStart = (e: React.MouseEvent) => {
    isResizingLogger.current = true;
    document.body.style.cursor = 'row-resize';
  };
  
  const handleShowHistory = useCallback(() => {
    if (activeDocument) {
      setActiveView('history');
    }
  }, [activeDocument]);

  // Command Palette and Shortcuts
  const commands = useMemo<Command[]>(() => [
    { id: 'app.newDocument', name: 'New Document', category: 'File', icon: PlusIcon, action: () => handleAddDocument(null), shortcut: ['Control', 'N'] },
    { id: 'app.newFolder', name: 'New Folder', category: 'File', icon: FolderPlusIcon, action: () => handleAddFolder(null), shortcut: ['Control', 'Shift', 'N'] },
    { id: 'app.saveVersion', name: 'Save Version', category: 'File', icon: SaveIcon, action: () => { if(activeDocument) commitVersion(activeDocument.id, activeDocument.content || '') }, shortcut: ['Control', 'S']},
    { id: 'app.toggleCommandPalette', name: 'Command Palette', category: 'General', icon: CommandIcon, action: () => setCommandPaletteOpen(p => !p), shortcut: ['Control', 'Shift', 'P']},
    { id: 'app.toggleSettings', name: 'Toggle Settings', category: 'General', icon: GearIcon, action: () => setActiveView(v => v === 'settings' ? 'editor' : 'settings') },
    { id: 'app.toggleInfo', name: 'Toggle Info', category: 'General', icon: InfoIcon, action: () => setActiveView(v => v === 'info' ? 'editor' : 'info') },
    { id: 'app.toggleLogs', name: 'Toggle Logs', category: 'General', icon: TerminalIcon, action: () => setIsLoggerVisible(v => !v) },
    { id: 'doc.delete', name: 'Delete Item', category: 'Document', icon: TrashIcon, action: () => { if (selectedIds.size > 0) deleteItems(Array.from(selectedIds)) }, shortcut: ['Delete']},
    { id: 'doc.duplicate', name: 'Duplicate Item', category: 'Document', icon: DocumentDuplicateIcon, action: () => { if (selectedIds.size > 0) duplicateItems(Array.from(selectedIds)) }, shortcut: ['Control', 'D']},
    { id: 'doc.refine', name: 'Refine with AI', category: 'Document', icon: SparklesIcon, action: () => { /* This needs to be triggered from editor */ }},
    { id: 'doc.history', name: 'View History', category: 'Document', icon: HistoryIcon, action: handleShowHistory },
    { id: 'sidebar.expandAll', name: 'Expand All Folders', category: 'Sidebar', icon: ExpandAllIcon, action: () => setExpandedIds(new Set(items.filter(i => i.type === 'folder').map(i => i.id))) },
    { id: 'sidebar.collapseAll', name: 'Collapse All Folders', category: 'Sidebar', icon: CollapseAllIcon, action: () => setExpandedIds(new Set()) }
  ], [handleAddDocument, handleAddFolder, activeDocument, commitVersion, selectedIds, deleteItems, duplicateItems, handleShowHistory, setExpandedIds, items]);

  const shortcutMap = useMemo(() => getShortcutMap(commands, settings.customShortcuts), [commands, settings.customShortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
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
  }, [shortcutMap]);

  if (!settingsLoaded) {
    return <div className="w-screen h-screen bg-background" />; // Splash screen
  }
  
  if (fatalError) {
    return <FatalError {...fatalError} />;
  }
  
  const isEditorViewActive = activeView === 'editor' && !!activeDocument && !activeTemplate;
  const isInfoViewActive = activeView === 'info';
  const isSettingsViewActive = activeView === 'settings';

  return (
    <div className="w-screen h-screen flex flex-col bg-background text-text-main text-base font-sans antialiased overflow-hidden" style={{ fontSize: `${settings.uiScale / 100}rem` }}>
      <CustomTitleBar />
      <Header
        onToggleSettingsView={() => setActiveView(v => v === 'settings' ? 'editor' : 'settings')}
        onToggleInfoView={() => setActiveView(v => v === 'info' ? 'editor' : 'info')}
        onShowEditorView={() => setActiveView('editor')}
        onToggleLogger={() => setIsLoggerVisible(v => !v)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        isInfoViewActive={isInfoViewActive}
        isSettingsViewActive={isSettingsViewActive}
        isEditorViewActive={isEditorViewActive}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          width={sidebarWidth}
          onResizeStart={handleSidebarResizeStart}
          items={items}
          templates={templates}
          selectedIds={selectedIds}
          focusedItemId={focusedItemId}
          activeTemplateId={activeTemplateId}
          expandedIds={expandedIds}
          renamingNodeId={renamingNodeId}
          onAddDocument={handleAddDocument}
          onAddFolder={handleAddFolder}
          onSelectNode={handleSelectNode}
          onDeleteNode={(id) => deleteItems([id])}
          onRenameNode={updateItem}
          onMoveNode={moveItems}
          onCopyNodeContent={(id) => { /* copy content */ }}
          onToggleExpand={(id) => setExpandedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;})}
          onMoveUp={(id) => { /* move up */ }}
          onMoveDown={(id) => { /* move down */ }}
          onContextMenu={(e, id) => { /* context menu */ }}
          onRenameComplete={() => setRenamingNodeId(null)}
          onSelectTemplate={(id) => {
             setActiveTemplateId(id);
             setSelectedIds(new Set());
             setActiveView('editor');
          }}
          onDeleteTemplate={(id) => deleteTemplate(id)}
          onRenameTemplate={updateTemplate}
          onAddTemplate={async () => {
            const newTpl = await addTemplate();
            setActiveTemplateId(newTpl.template_id);
            setActiveView('editor');
          }}
        />
        <main className="flex-1 flex flex-col overflow-y-auto">
          {activeView === 'editor' && (
            activeDocument ? <DocumentEditor document={activeDocument} onSave={updateItem} onCommitVersion={(content) => commitVersion(activeDocument.id, content)} onDelete={deleteItem} settings={settings} onShowHistory={handleShowHistory} />
            : activeTemplate ? <TemplateEditor template={activeTemplate} onSave={updateTemplate} onDelete={deleteTemplate} />
            : <WelcomeScreen onNewDocument={() => handleAddDocument(null)} />
          )}
          {activeView === 'settings' && <SettingsView settings={settings} onSave={saveSettings} discoveredServices={discoveredServices} onDetectServices={handleDetectServices} isDetecting={isDetecting} commands={commands}/>}
          {activeView === 'info' && <InfoView />}
          {activeView === 'history' && activeDocument && <DocumentHistoryView document={activeDocument} onBackToEditor={() => setActiveView('editor')} onRestore={(content) => commitVersion(activeDocument.id, content)}/>}
        </main>
      </div>
      <LoggerPanel isVisible={isLoggerVisible} onToggleVisibility={() => setIsLoggerVisible(v => !v)} height={loggerHeight} onResizeStart={handleLoggerResizeStart} />
      <StatusBar
        status={llmStatus}
        modelName={settings.llmModelName}
        llmProviderName={settings.llmProviderName}
        llmProviderUrl={settings.llmProviderUrl}
        documentCount={items.length}
        lastSaved={items.length > 0 ? items[0].updatedAt : undefined}
        availableModels={availableModels}
        onModelChange={(modelId) => saveSettings({...settings, llmModelName: modelId})}
        discoveredServices={discoveredServices}
        onProviderChange={(serviceId) => {
          const service = discoveredServices.find(s => s.id === serviceId);
          if (service) saveSettings({...settings, llmProviderUrl: service.generateUrl, llmProviderName: service.name, apiType: service.apiType, llmModelName: ''});
        }}
        appVersion={appVersion}
      />
      {contextMenu && <ContextMenu isOpen={true} position={{ x: contextMenu.x, y: contextMenu.y }} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      <div ref={commandPaletteButtonRef}>
        <CommandPalette 
          isOpen={isCommandPaletteOpen} 
          onClose={() => setCommandPaletteOpen(false)}
          commands={commands}
          targetRef={commandPaletteButtonRef}
          searchTerm=""
          onExecute={() => setCommandPaletteOpen(false)}
        />
      </div>
      {isCreateFromTemplateModalOpen && <CreateFromTemplateModal templates={templates} onCreate={(title, content) => addDocument({parentId: null, title, content})} onClose={() => setIsCreateFromTemplateModalOpen(false)} />}
      {confirmDelete && <ConfirmModal title="Confirm Deletion" message={confirmDelete.message} onConfirm={confirmDelete.onConfirm} onCancel={() => setConfirmDelete(null)} />}
      {updateInfo && <UpdateNotification version={updateInfo.version} onInstall={() => isElectron?.quitAndInstallUpdate()} onClose={() => setUpdateInfo(null)} />}
    </div>
  );
};

export default App;

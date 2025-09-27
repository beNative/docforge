import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDocuments } from './hooks/usePrompts';
import { useTemplates } from './hooks/useTemplates';
import { useSettings } from './hooks/useSettings';
import { useLogger } from './hooks/useLogger';
import { useLLMStatus } from './hooks/useLLMStatus';
import { llmDiscoveryService } from './services/llmDiscoveryService';
import { storageService } from './services/storageService';
import { repository } from './services/repository';

import Sidebar from './components/Sidebar';
import PromptEditor from './components/PromptEditor';
import TemplateEditor from './components/TemplateEditor';
import SettingsView from './components/SettingsView';
import InfoView from './components/InfoView';
import { WelcomeScreen } from './components/WelcomeScreen';
import StatusBar from './components/StatusBar';
import LoggerPanel from './components/LoggerPanel';
import ConfirmModal from './components/ConfirmModal';
import CreateFromTemplateModal from './components/CreateFromTemplateModal';
import PromptHistoryModal from './components/PromptHistoryModal';
import CustomTitleBar from './components/CustomTitleBar';
import UpdateNotification from './components/UpdateNotification';
import CommandPalette from './components/CommandPalette';
import FatalError from './components/FatalError';

import { LOCAL_STORAGE_KEYS } from './constants';
import type { Command, DiscoveredLLMModel, DiscoveredLLMService, Settings } from './types';
import { DatabaseIcon, FileIcon, FolderPlusIcon, GearIcon, HistoryIcon, InfoIcon, PlusIcon, SunIcon, TerminalIcon, TrashIcon, DocumentDuplicateIcon } from './components/Icons';
import { useTheme } from './hooks/useTheme';

type View = 'editor' | 'settings' | 'info';
type EditorPane = 'prompt' | 'template';
type DeletionTarget = { type: 'document' | 'template'; id: string };

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 280;

const MIN_LOGGER_HEIGHT = 40;
const MAX_LOGGER_HEIGHT = 500;
const DEFAULT_LOGGER_HEIGHT = 200;

function App() {
  // Initialization and Error Handling
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const { addLog } = useLogger();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await repository.init();
        addLog('INFO', 'Repository initialized successfully.');
        setIsInitialized(true);
      } catch (error) {
        const err = error as Error;
        console.error("Initialization failed:", err);
        addLog('ERROR', `Fatal initialization error: ${err.message}`);
        setInitError(err);
      }
    };
    initializeApp();
  }, [addLog]);

  // Hooks
  const { settings, saveSettings, loaded: settingsLoaded } = useSettings();
  const { items, addDocument, addFolder, updateItem, commitVersion, deleteItem, moveItems, getDescendantIds, refresh: refreshItems, duplicateItems } = useDocuments();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  
  // View & Selection State
  const [activeView, setActiveView] = useState<View>('editor');
  const [editorPane, setEditorPane] = useState<EditorPane>('prompt');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // UI State
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [loggerHeight, setLoggerHeight] = useState(DEFAULT_LOGGER_HEIGHT);
  const [isLoggerVisible, setIsLoggerVisible] = useState(false);
  const [isResizingLogger, setIsResizingLogger] = useState(false);

  // Modal State
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [historyPromptId, setHistoryPromptId] = useState<string | null>(null);
  
  // Update Notification State
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('');

  // LLM Discovery State
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredLLMService[]>([]);
  const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
  const [isDetectingServices, setIsDetectingServices] = useState(false);
  const llmStatus = useLLMStatus(settings.llmProviderUrl);
  
  // Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteSearch, setCommandPaletteSearch] = useState('');
  const commandPaletteTargetRef = useRef<HTMLDivElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);

  // Memos for derived state
  const lastSelectedItem = useMemo(() => {
    const lastId = Array.from(selectedIds).pop();
    return items.find(i => i.id === lastId);
  }, [items, selectedIds]);

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.template_id === activeTemplateId);
  }, [templates, activeTemplateId]);
  
  const historyPrompt = useMemo(() => {
      return historyPromptId ? items.find(p => p.id === historyPromptId) : null;
  }, [historyPromptId, items]);

  // Effects
  // Load UI state from storage
  useEffect(() => {
    storageService.load(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH).then(setSidebarWidth);
    storageService.load(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, DEFAULT_LOGGER_HEIGHT).then(setLoggerHeight);
    window.electronAPI?.getAppVersion().then(setAppVersion);
  }, []);

  // Apply UI scale from settings
  useEffect(() => {
    if (settingsLoaded) {
      document.documentElement.style.zoom = `${settings.uiScale / 100}`;
    }
  }, [settings.uiScale, settingsLoaded]);
  
  // Update listener
  useEffect(() => {
    if (window.electronAPI?.onUpdateDownloaded) {
      const cleanup = window.electronAPI.onUpdateDownloaded((version) => {
        addLog('INFO', `Update version ${version} downloaded.`);
        setUpdateVersion(version);
      });
      return cleanup;
    }
  }, [addLog]);

  // Handlers
  const handleSelectPrompt = useCallback((id: string, e: React.MouseEvent) => {
    setActiveView('editor');
    setEditorPane('prompt');
    setFocusedItemId(id);
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);
  
  const handleSelectTemplate = useCallback((id: string) => {
    setActiveView('editor');
    setEditorPane('template');
    setActiveTemplateId(id);
    setSelectedIds(new Set());
  }, []);

  const handleNewItem = useCallback(async (type: 'document' | 'folder' | 'template') => {
    let parentId: string | null = null;
    if (lastSelectedItem) {
      parentId = lastSelectedItem.type === 'folder' ? lastSelectedItem.id : lastSelectedItem.parentId;
    }

    if (type === 'document') {
      const newDoc = await addDocument({ parentId });
      setSelectedIds(new Set([newDoc.id]));
      setFocusedItemId(newDoc.id);
      setEditorPane('prompt');
      setActiveView('editor');
    } else if (type === 'folder') {
      const newFolder = await addFolder(parentId);
      setSelectedIds(new Set([newFolder.id]));
      setFocusedItemId(newFolder.id);
      setEditorPane('prompt');
      setActiveView('editor');
    } else if (type === 'template') {
      const newTpl = await addTemplate();
      setActiveTemplateId(newTpl.template_id);
      setEditorPane('template');
      setActiveView('editor');
    }
  }, [addDocument, addFolder, addTemplate, lastSelectedItem]);

  const handleConfirmDeletion = useCallback(async () => {
    if (!deletionTarget) return;

    if (deletionTarget.type === 'document') {
        const idsToDelete = Array.from(selectedIds);
        const descendantIds = new Set<string>();
        idsToDelete.forEach(id => {
            getDescendantIds(id).forEach(descId => descendantIds.add(descId));
        });
        const allIds = [...idsToDelete, ...Array.from(descendantIds)];
        
        for(const id of allIds) {
            await deleteItem(id);
        }
        
        setSelectedIds(new Set());
        setFocusedItemId(null);
    } else if (deletionTarget.type === 'template') {
        await deleteTemplate(deletionTarget.id);
        if (activeTemplateId === deletionTarget.id) {
            setActiveTemplateId(null);
        }
    }
    setDeletionTarget(null);
  }, [deletionTarget, activeTemplateId, deleteItem, deleteTemplate, getDescendantIds, selectedIds]);

  const handleCreateFromTemplate = useCallback(async (title: string, content: string) => {
    let parentId: string | null = null;
    if (lastSelectedItem) {
        parentId = lastSelectedItem.type === 'folder' ? lastSelectedItem.id : lastSelectedItem.parentId;
    }
    const newDoc = await addDocument({ parentId, title, content });
    setSelectedIds(new Set([newDoc.id]));
    setFocusedItemId(newDoc.id);
    setEditorPane('prompt');
    setActiveView('editor');
  }, [addDocument, lastSelectedItem]);
  
  // Resizing handlers...
  const startResizeSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizeLogger = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLogger(true);
  }, []);
  
  const stopResizing = useCallback(() => {
    if(isResizingSidebar) {
        storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_WIDTH, sidebarWidth);
    }
    if(isResizingLogger) {
        storageService.save(LOCAL_STORAGE_KEYS.LOGGER_PANEL_HEIGHT, loggerHeight);
    }
    setIsResizingSidebar(false);
    setIsResizingLogger(false);
  }, [isResizingSidebar, isResizingLogger, sidebarWidth, loggerHeight]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(e.clientX, MAX_SIDEBAR_WIDTH));
      setSidebarWidth(newWidth);
    }
    if (isResizingLogger) {
      const newHeight = Math.max(MIN_LOGGER_HEIGHT, Math.min(window.innerHeight - e.clientY, MAX_LOGGER_HEIGHT));
      setLoggerHeight(newHeight);
    }
  }, [isResizingSidebar, isResizingLogger]);

  useEffect(() => {
    if (isResizingSidebar || isResizingLogger) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResizing);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', stopResizing);
      };
    }
  }, [isResizingSidebar, isResizingLogger, handleResize, stopResizing]);

  const handleDetectServices = useCallback(async () => {
    setIsDetectingServices(true);
    addLog('INFO', 'Detecting local LLM services...');
    try {
      const services = await llmDiscoveryService.discoverServices();
      setDiscoveredServices(services);
      addLog('INFO', `Found ${services.length} services.`);
      if(services.length > 0 && !services.find(s => s.generateUrl === settings.llmProviderUrl)) {
          const firstService = services[0];
          const newSettings: Settings = {...settings, llmProviderUrl: firstService.generateUrl, llmProviderName: firstService.name, apiType: firstService.apiType, llmModelName: ''};
          await saveSettings(newSettings);
          addLog('INFO', `Auto-selected first discovered service: ${firstService.name}`);
      }
    } catch(error) {
      addLog('ERROR', `Error detecting LLM services: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDetectingServices(false);
    }
  }, [addLog, saveSettings, settings]);

  const handleProviderChange = async (serviceId: string) => {
    const service = discoveredServices.find(s => s.id === serviceId);
    if(service) {
      await saveSettings({...settings, llmProviderUrl: service.generateUrl, llmProviderName: service.name, apiType: service.apiType, llmModelName: ''});
    }
  };

  const handleModelChange = async (modelName: string) => {
    await saveSettings({...settings, llmModelName: modelName});
  };

  useEffect(() => {
    const fetchModelsForCurrentService = async () => {
        const currentService = discoveredServices.find(s => s.generateUrl === settings.llmProviderUrl);
        if (currentService) {
            try {
                const models = await llmDiscoveryService.fetchModels(currentService);
                setAvailableModels(models);
            } catch (error) {
                setAvailableModels([]);
            }
        } else {
            setAvailableModels([]);
        }
    }
    fetchModelsForCurrentService();
  }, [discoveredServices, settings.llmProviderUrl]);


  const openCommandPalette = () => {
    if (!isCommandPaletteOpen) {
      setCommandPaletteSearch('');
      setIsCommandPaletteOpen(true);
    }
  };
  
  const closeCommandPalette = () => {
    setIsCommandPaletteOpen(false);
    commandPaletteInputRef.current?.blur();
  };

  const executeCommand = () => {
    closeCommandPalette();
  };
  
  const commands = useMemo<Command[]>(() => [
    { id: 'new-doc', name: 'New Document', action: () => handleNewItem('document'), category: 'File', icon: PlusIcon, shortcut: ['Ctrl', 'N'] },
    { id: 'new-folder', name: 'New Folder', action: () => handleNewItem('folder'), category: 'File', icon: FolderPlusIcon },
    { id: 'new-template', name: 'New Template', action: () => handleNewItem('template'), category: 'File', icon: DocumentDuplicateIcon },
    { id: 'create-from-template', name: 'Create from Template...', action: () => setIsTemplateModalOpen(true), category: 'File', icon: FileIcon, keywords: 'instance' },
    { id: 'delete-item', name: 'Delete Selected Item(s)', action: () => { if(editorPane === 'prompt' && lastSelectedItem) { setDeletionTarget({ type: 'document', id: lastSelectedItem.id })} else if(editorPane === 'template' && activeTemplate) { setDeletionTarget({ type: 'template', id: activeTemplate.template_id }) } }, category: 'Edit', icon: TrashIcon, shortcut: ['Del'] },
    { id: 'view-history', name: 'View History', action: () => lastSelectedItem && setHistoryPromptId(lastSelectedItem.id), category: 'View', icon: HistoryIcon },
    { id: 'toggle-theme', name: 'Toggle Theme', action: toggleTheme, category: 'View', icon: SunIcon, keywords: 'dark light mode' },
    { id: 'toggle-logs', name: 'Toggle Logs Panel', action: () => setIsLoggerVisible(v => !v), category: 'View', icon: TerminalIcon },
    { id: 'show-settings', name: 'Open Settings', action: () => setActiveView('settings'), category: 'Application', icon: GearIcon },
    { id: 'show-info', name: 'Show Application Info', action: () => setActiveView('info'), category: 'Application', icon: InfoIcon },
    { id: 'force-reload', name: 'Force Reload Data', action: () => { refreshItems(); }, category: 'Application', icon: DatabaseIcon },
  ], [handleNewItem, editorPane, lastSelectedItem, activeTemplate, refreshItems, toggleTheme]);

  const renderMainContent = () => {
    if (activeView === 'settings') {
      return <SettingsView settings={settings} onSave={saveSettings} discoveredServices={discoveredServices} onDetectServices={handleDetectServices} isDetecting={isDetectingServices} />;
    }
    if (activeView === 'info') {
      return <InfoView />;
    }
    // 'editor' view
    if (editorPane === 'prompt') {
      if (lastSelectedItem && lastSelectedItem.type === 'document') {
        return <PromptEditor 
          key={lastSelectedItem.id}
          prompt={lastSelectedItem} 
          settings={settings}
          onSave={updates => updateItem(lastSelectedItem.id, updates)}
          onCommitVersion={(content) => commitVersion(lastSelectedItem.id, content)}
          onDelete={() => setDeletionTarget({ type: 'document', id: lastSelectedItem.id })}
          onShowHistory={() => setHistoryPromptId(lastSelectedItem.id)}
        />;
      }
      return <WelcomeScreen onNewPrompt={() => handleNewItem('document')} />;
    }
    if (editorPane === 'template') {
      if (activeTemplate) {
        return <TemplateEditor 
          key={activeTemplate.template_id}
          template={activeTemplate}
          onSave={(updates) => updateTemplate(activeTemplate.template_id, updates)}
          onDelete={() => setDeletionTarget({ type: 'template', id: activeTemplate.template_id })}
        />
      }
      return <WelcomeScreen onNewPrompt={() => handleNewItem('template')} />; // A bit of a misnomer, but fine for placeholder
    }
  };

  // Fatal Error handling
  if (initError) {
    return (
      <FatalError
        title="Application Failed to Start"
        header="A critical error occurred during initialization."
        details={`The application could not start correctly. This usually happens if the database file is corrupted or inaccessible. Please check the logs for more details. Error: ${initError.message}`}
      />
    );
  }

  if (!isInitialized) {
    return null; // Could return a loading spinner here
  }

  return (
    <div className="flex flex-col h-screen bg-background font-sans antialiased overflow-hidden">
        <CustomTitleBar
          onToggleSettingsView={() => setActiveView(v => v === 'settings' ? 'editor' : 'settings')}
          onToggleInfoView={() => setActiveView(v => v === 'info' ? 'editor' : 'info')}
          onShowEditorView={() => setActiveView('editor')}
          onToggleLogger={() => setIsLoggerVisible(v => !v)}
          onOpenCommandPalette={openCommandPalette}
          isInfoViewActive={activeView === 'info'}
          isSettingsViewActive={activeView === 'settings'}
          isEditorViewActive={activeView === 'editor'}
          commandPaletteTargetRef={commandPaletteTargetRef}
          commandPaletteInputRef={commandPaletteInputRef}
          searchTerm={commandPaletteSearch}
          onSearchTermChange={setCommandPaletteSearch}
        />
        <div className="flex-1 flex overflow-hidden">
            <Sidebar
                width={sidebarWidth}
                onResizeStart={startResizeSidebar}
                items={items}
                templates={templates}
                selectedIds={selectedIds}
                focusedItemId={focusedItemId}
                setFocusedItemId={setFocusedItemId}
                activeTemplateId={activeTemplateId}
                onSelectPrompt={handleSelectPrompt}
                onSelectTemplate={handleSelectTemplate}
                onNewDocument={() => handleNewItem('document')}
                onNewFolder={() => handleNewItem('folder')}
                onNewTemplate={() => handleNewItem('template')}
                onRenameItem={(id, title) => updateItem(id, { title })}
                onDeleteItem={(id) => setDeletionTarget({type: 'document', id})}
                onDeleteTemplate={(id) => setDeletionTarget({type: 'template', id})}
                onMoveItems={moveItems}
                onDuplicateItems={duplicateItems}
                onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
            />
            <main className="flex-1 flex flex-col min-w-0">
                {renderMainContent()}
            </main>
        </div>
        <StatusBar
          status={llmStatus}
          modelName={settings.llmModelName}
          llmProviderName={settings.llmProviderName}
          llmProviderUrl={settings.llmProviderUrl}
          promptCount={items.filter(i => i.type === 'document').length}
          lastSaved={lastSelectedItem?.updatedAt}
          availableModels={availableModels}
          onModelChange={handleModelChange}
          discoveredServices={discoveredServices}
          onProviderChange={handleProviderChange}
          appVersion={appVersion}
        />

        <LoggerPanel
          isVisible={isLoggerVisible}
          onToggleVisibility={() => setIsLoggerVisible(false)}
          height={loggerHeight}
          onResizeStart={startResizeLogger}
        />
        
        {/* Modals */}
        {deletionTarget && (
            <ConfirmModal
                title={`Delete ${deletionTarget.type === 'document' ? `${selectedIds.size} item(s)` : 'Template'}`}
                message={
                  <>
                    <p className="font-semibold text-text-main mb-2">Are you sure you want to proceed?</p>
                    {deletionTarget.type === 'document' && <p>This will permanently delete the selected item(s) and all their contents. This action cannot be undone.</p>}
                    {deletionTarget.type === 'template' && <p>This will permanently delete the template. This action cannot be undone.</p>}
                  </>
                }
                onConfirm={handleConfirmDeletion}
                onCancel={() => setDeletionTarget(null)}
                confirmText="Delete"
                confirmVariant="destructive"
            />
        )}
        {isTemplateModalOpen && (
            <CreateFromTemplateModal
                templates={templates}
                onClose={() => setIsTemplateModalOpen(false)}
                onCreate={handleCreateFromTemplate}
            />
        )}
        {historyPrompt && (
          <PromptHistoryModal
            prompt={historyPrompt}
            onClose={() => setHistoryPromptId(null)}
            onRestore={(content) => {
              commitVersion(historyPrompt.id, content);
              setHistoryPromptId(null);
            }}
          />
        )}
        {updateVersion && (
          <UpdateNotification
            version={updateVersion}
            onInstall={() => window.electronAPI?.quitAndInstallUpdate()}
            onClose={() => setUpdateVersion(null)}
          />
        )}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={closeCommandPalette}
          commands={commands}
          targetRef={commandPaletteTargetRef}
          searchTerm={commandPaletteSearch}
          onExecute={executeCommand}
        />
    </div>
  );
}

export default App;

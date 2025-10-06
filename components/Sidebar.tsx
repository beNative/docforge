
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import DocumentList from './PromptList';
import TemplateList from './TemplateList';
import type { DocumentOrFolder, DocumentTemplate, Command } from '../types';
import IconButton from './IconButton';
import { FolderPlusIcon, PlusIcon, SearchIcon, DocumentDuplicateIcon, ChevronDownIcon, ChevronRightIcon, ExpandAllIcon, CollapseAllIcon, CodeIcon } from './Icons';
import { DocumentNode } from './PromptTreeItem';
import { storageService } from '../services/storageService';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { useLogger } from '../hooks/useLogger';

type NavigableItem = { id: string; type: 'document' | 'folder' | 'template'; parentId: string | null; };

interface SidebarProps {
  documents: DocumentOrFolder[];
  documentTree: DocumentNode[];
  navigableItems: NavigableItem[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastClickedId: string | null;
  setLastClickedId: React.Dispatch<React.SetStateAction<string | null>>;
  activeNodeId: string | null;
  openDocumentIds: Set<string>;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteSelection: (ids: Set<string>, options?: { force?: boolean }) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onDropFiles: (files: FileList, parentId: string | null) => void;
  onNewDocument: () => void;
  onNewRootFolder: () => void;
  onNewSubfolder: () => void;
  onNewCodeFile: () => void;
  onDuplicateSelection: () => void;
  onCopyNodeContent: (id: string) => void;
  expandedFolderIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string | null) => void;
  renamingNodeId: string | null;
  onRenameComplete: () => void;
  commands: Command[];

  templates: DocumentTemplate[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string, shiftKey?: boolean) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
  onNewTemplate: () => void;
  onNewFromTemplate: () => void;
  documentTreeIndent: number;
  documentTreeVerticalSpacing: number;
}

const DEFAULT_TEMPLATES_PANEL_HEIGHT = 160;
const MIN_TEMPLATES_PANEL_HEIGHT = 80;

// Helper function to find a node and its siblings in a tree structure
const findNodeAndSiblings = (nodes: DocumentNode[], id: string): {node: DocumentNode, siblings: DocumentNode[]} | null => {
    for (const node of nodes) {
        if (node.id === id) {
            return { node, siblings: nodes };
        }
        if (node.type === 'folder' && node.children.length > 0) {
            const found = findNodeAndSiblings(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { documentTree, navigableItems, searchTerm, setSearchTerm, setSelectedIds, lastClickedId, setLastClickedId, onContextMenu, renamingNodeId, onRenameComplete, onExpandAll, onCollapseAll, commands, pendingRevealId, onRevealHandled } = props;
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [isTemplatesCollapsed, setIsTemplatesCollapsed] = useState(false);
  const [templatesPanelHeight, setTemplatesPanelHeight] = useState(DEFAULT_TEMPLATES_PANEL_HEIGHT);
  const { addLog } = useLogger();


  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingTemplates = useRef(false);

  // Effect to manage focus state
  useEffect(() => {
    const activeItem = props.activeNodeId || props.activeTemplateId;
    if (activeItem && navigableItems.some(item => item.id === activeItem)) {
      if (focusedItemId !== activeItem) {
        setFocusedItemId(activeItem);
      }
      return;
    }

    if (!focusedItemId || !navigableItems.some(item => item.id === focusedItemId)) {
      setFocusedItemId(navigableItems[0]?.id || null);
    }
  }, [navigableItems, focusedItemId, props.activeNodeId, props.activeTemplateId]);

  // Effect to scroll focused item into view
  useEffect(() => {
    if (focusedItemId && sidebarRef.current) {
        const element = sidebarRef.current.querySelector(`[data-item-id='${focusedItemId}']`);
        element?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedItemId]);

  useEffect(() => {
    if (!pendingRevealId || !sidebarRef.current) {
        return;
    }

    const raf = requestAnimationFrame(() => {
        const element = sidebarRef.current?.querySelector(`[data-item-id='${pendingRevealId}']`) as HTMLElement | null;
        if (element) {
            element.scrollIntoView({ block: 'center' });
            setFocusedItemId(pendingRevealId);
            onRevealHandled();
        }
    });

    return () => cancelAnimationFrame(raf);
  }, [pendingRevealId, documentTree, onRevealHandled]);


  // --- Load initial layout state from storage ---
  useEffect(() => {
    storageService.load<boolean>(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_COLLAPSED, false).then(setIsTemplatesCollapsed);
    storageService.load<number>(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_PANEL_HEIGHT, DEFAULT_TEMPLATES_PANEL_HEIGHT).then(setTemplatesPanelHeight);
  }, []);

  // --- Collapse/Expand Logic ---
  const handleToggleCollapse = () => {
    const newCollapsedState = !isTemplatesCollapsed;
    addLog('INFO', `User action: Toggled templates panel ${newCollapsedState ? 'collapsed' : 'expanded'}.`);
    setIsTemplatesCollapsed(newCollapsedState);
    storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_COLLAPSED, newCollapsedState);
  };
  
  // --- Resizing Logic for Templates Panel ---
  const handleTemplatesResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingTemplates.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingTemplates.current || !sidebarRef.current) return;
    
    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const newHeight = sidebarRect.bottom - e.clientY;
    const maxTemplatesPanelHeight = sidebarRect.height - 200; // Ensure docs panel has at least 200px
    
    const clampedHeight = Math.max(MIN_TEMPLATES_PANEL_HEIGHT, Math.min(newHeight, maxTemplatesPanelHeight));
    setTemplatesPanelHeight(clampedHeight);
  }, []);

  const handleGlobalMouseUp = useCallback(() => {
    if (isResizingTemplates.current) {
      isResizingTemplates.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      // Use a function for setState to get the latest value for saving
      setTemplatesPanelHeight(currentHeight => {
        storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_PANEL_HEIGHT, currentHeight);
        return currentHeight;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);


  const handleMoveUp = useCallback((id: string) => {
      const result = findNodeAndSiblings(documentTree, id);
      if (!result) return;
      
      const { siblings } = result;
      const index = siblings.findIndex(s => s.id === id);
      
      if (index > 0) {
          const targetSiblingId = siblings[index - 1].id;
          props.onMoveNode([id], targetSiblingId, 'before');
      }
  }, [documentTree, props.onMoveNode]);
  
  const handleMoveDown = useCallback((id: string) => {
      const result = findNodeAndSiblings(documentTree, id);
      if (!result) return;
      
      const { siblings } = result;
      const index = siblings.findIndex(s => s.id === id);
      
      if (index < siblings.length - 1) {
          const targetSiblingId = siblings[index + 1].id;
          props.onMoveNode([id], targetSiblingId, 'after');
      }
  }, [documentTree, props.onMoveNode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const interactiveElement = target.closest('input, textarea, select, [contenteditable="true"]');
      if (interactiveElement) {
        return;
      }
    }

    if (navigableItems.length === 0) return;
    const key = e.key;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (isCtrl && (key === 'a' || key === 'A')) {
      e.preventDefault();
      setSelectedIds(new Set(navigableItems.map(i => i.id)));
      return;
    }

    if (key === 'Delete' || (key === 'Backspace' && !isMac)) {
      e.preventDefault();
      if (props.selectedIds.size > 0) {
        props.onDeleteSelection(props.selectedIds, { force: e.shiftKey });
      }
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
        return;
    }
    
    e.preventDefault();

    const currentItem = navigableItems.find(item => item.id === focusedItemId);

    if (!currentItem) {
      if (navigableItems.length > 0) {
        setFocusedItemId(navigableItems[0].id);
      }
      return;
    }

    const currentIndex = navigableItems.indexOf(currentItem);

    const selectItem = (item: NavigableItem) => {
        if (item.type === 'template') {
            props.onSelectTemplate(item.id);
        } else {
            props.onSelectNode(item.id, { ctrlKey: isCtrl } as React.MouseEvent);
        }
    };

    switch (key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        const direction = key === 'ArrowUp' ? -1 : 1;
        const nextIndex = Math.max(0, Math.min(navigableItems.length - 1, currentIndex + direction));
        const newItem = navigableItems[nextIndex];
        
        if (e.shiftKey) {
          const anchorId = lastClickedId || focusedItemId;
          const anchorIndex = navigableItems.findIndex(i => i.id === anchorId);
          if (anchorIndex !== -1) {
            const start = Math.min(anchorIndex, nextIndex);
            const end = Math.max(anchorIndex, nextIndex);
            const rangeIds = navigableItems.slice(start, end + 1).map(i => i.id);
            setSelectedIds(new Set(rangeIds));
          }
        } else {
          setSelectedIds(new Set([newItem.id]));
          setLastClickedId(newItem.id);
        }
        
        setFocusedItemId(newItem.id);
        if (newItem.type === 'template') {
          props.onSelectTemplate(newItem.id);
        } else {
          props.onSelectNode(newItem.id, { } as React.MouseEvent);
        }
        break;
      }
      case 'ArrowRight': {
        if (currentItem.type === 'folder' && !props.expandedFolderIds.has(currentItem.id)) {
          props.onToggleExpand(currentItem.id);
        }
        break;
      }
      case 'ArrowLeft': {
        if (currentItem.type === 'folder' && props.expandedFolderIds.has(currentItem.id)) {
          props.onToggleExpand(currentItem.id);
        } else if (currentItem.parentId) {
          const parentItem = navigableItems.find(item => item.id === currentItem.parentId);
          if (parentItem) {
            setFocusedItemId(parentItem.id);
            selectItem(parentItem);
          }
        }
        break;
      }
      case 'Enter': {
        selectItem(currentItem);
        break;
      }
    }
  };
  
  const getTooltip = (commandId: string, baseText: string) => {
    const command = commands.find(c => c.id === commandId);
    return command?.shortcutString ? `${baseText} (${command.shortcutString})` : baseText;
  };


  return (
    <div ref={sidebarRef} onKeyDown={handleKeyDown} tabIndex={0} className="h-full flex flex-col focus:outline-none">
      <div className="h-7 px-2 flex items-center flex-shrink-0 border-b border-border-color">
        <div className="relative w-full">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border-color rounded-md pl-9 pr-3 py-1 text-xs text-text-main focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary"
            />
        </div>
      </div>

        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Documents Panel */}
            <div className="flex-1 flex flex-col min-h-0">
                <header className="flex items-center justify-between p-1 flex-shrink-0 sticky top-0 bg-secondary z-10">
                    <h2 className="text-xs font-semibold text-text-secondary px-2 tracking-wider uppercase">Documents</h2>
                    <div className="flex items-center gap-0.5">
                    <IconButton onClick={onExpandAll} tooltip="Expand All" size="xs" tooltipPosition="bottom">
                        <ExpandAllIcon className="w-4 h-4" />
                    </IconButton>
                    <IconButton onClick={onCollapseAll} tooltip="Collapse All" size="xs" tooltipPosition="bottom">
                        <CollapseAllIcon className="w-4 h-4" />
                    </IconButton>
                    <div className="h-5 w-px bg-border-color mx-1"></div>
                     <IconButton onClick={props.onNewFromTemplate} tooltip={getTooltip('new-from-template', 'New from Template')} size="xs" tooltipPosition="bottom">
                        <DocumentDuplicateIcon className="w-4 h-4" />
                    </IconButton>
                    <IconButton onClick={props.onNewDocument} tooltip={getTooltip('new-document', 'New Document')} size="xs" tooltipPosition="bottom">
                        <PlusIcon className="w-4 h-4" />
                    </IconButton>
                    <IconButton onClick={props.onNewCodeFile} tooltip={getTooltip('new-code-file', 'New Code File')} size="xs" tooltipPosition="bottom">
                        <CodeIcon className="w-4 h-4" />
                    </IconButton>
                    <IconButton onClick={props.onNewRootFolder} tooltip={getTooltip('new-folder', 'New Root Folder')} size="xs" tooltipPosition="bottom">
                        <FolderPlusIcon className="w-4 h-4" />
                    </IconButton>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                <DocumentList
                    tree={documentTree}
                    documents={props.documents}
                    selectedIds={props.selectedIds}
                    focusedItemId={focusedItemId}
                    openDocumentIds={props.openDocumentIds}
                    indentPerLevel={props.documentTreeIndent}
                    verticalSpacing={props.documentTreeVerticalSpacing}
                    onSelectNode={props.onSelectNode}
                    onDeleteNode={props.onDeleteNode}
                    onRenameNode={props.onRenameNode}
                    onMoveNode={props.onMoveNode}
                    onDropFiles={props.onDropFiles}
                    onCopyNodeContent={props.onCopyNodeContent}
                    searchTerm={searchTerm}
                    expandedIds={props.expandedFolderIds}
                    onToggleExpand={props.onToggleExpand}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onContextMenu={onContextMenu}
                    renamingNodeId={renamingNodeId}
                    onRenameComplete={onRenameComplete}
                />
                </div>
            </div>
            
            {!isTemplatesCollapsed && (
                <div
                    onMouseDown={handleTemplatesResizeStart}
                    className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200 z-10"
                />
            )}

            {/* Templates Panel */}
            <div className="flex-shrink-0 border-t border-border-color">
                <header className={`flex items-center justify-between p-1 flex-shrink-0`}>
                    <div className="flex items-center gap-1">
                        <IconButton onClick={handleToggleCollapse} tooltip={isTemplatesCollapsed ? "Show Templates" : "Hide Templates"} size="sm">
                            {isTemplatesCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </IconButton>
                        <h2 className="text-xs font-semibold text-text-secondary px-2 tracking-wider uppercase">Templates</h2>
                    </div>
                    {!isTemplatesCollapsed && (
                    <div className="flex items-center gap-1">
                        <IconButton onClick={props.onNewTemplate} tooltip={getTooltip('new-template', 'New Template')} size="xs" tooltipPosition="bottom">
                            <PlusIcon className="w-4 h-4" />
                        </IconButton>
                    </div>
                    )}
                </header>
                {!isTemplatesCollapsed && (
                <div style={{ height: `${templatesPanelHeight}px` }} className="overflow-y-auto px-2">
                    <TemplateList 
                        templates={props.templates}
                        activeTemplateId={props.activeTemplateId}
                        focusedItemId={focusedItemId}
                        onSelectTemplate={props.onSelectTemplate}
                        onDeleteTemplate={props.onDeleteTemplate}
                        onRenameTemplate={props.onRenameTemplate}
                    />
                </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Sidebar;

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import DocumentList from './PromptList';
import TemplateList from './TemplateList';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder, DocumentTemplate } from '../types';
import IconButton from './IconButton';
import { FolderPlusIcon, PlusIcon, SearchIcon, DocumentDuplicateIcon, FolderDownIcon, ChevronDownIcon, ChevronRightIcon } from './Icons';
import Button from './Button';
import { DocumentNode } from './PromptTreeItem';
import { storageService } from '../services/storageService';
import { LOCAL_STORAGE_KEYS } from '../constants';

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
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteSelection: (ids: Set<string>, options?: { force?: boolean }) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onNewDocument: () => void;
  onNewRootFolder: () => void;
  onNewSubfolder: () => void;
  onDuplicateSelection: () => void;
  onCopyNodeContent: (id: string) => void;
  expandedFolderIds: Set<string>;
  onToggleExpand: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  templates: DocumentTemplate[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string, shiftKey?: boolean) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
  onNewTemplate: () => void;
  onNewFromTemplate: () => void;
}

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

const DEFAULT_DOCS_PANEL_HEIGHT_PERCENT = 60;
const MIN_PANEL_HEIGHT = 100;

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { documentTree, navigableItems, searchTerm, setSearchTerm, setSelectedIds, lastClickedId, setLastClickedId } = props;
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [docsPanelHeight, setDocsPanelHeight] = useState<number | null>(null);
  const [isTemplatesCollapsed, setIsTemplatesCollapsed] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  
  const activeNode = useMemo(() => {
    return props.documents.find(p => p.id === props.activeNodeId) || null;
  }, [props.documents, props.activeNodeId]);


  // Effect to manage focus state
  useEffect(() => {
    if (!focusedItemId || !navigableItems.some(item => item.id === focusedItemId)) {
      const activeItem = props.activeNodeId || props.activeTemplateId;
      if (activeItem && navigableItems.some(item => item.id === activeItem)) {
        setFocusedItemId(activeItem);
      } else {
        setFocusedItemId(navigableItems[0]?.id || null);
      }
    }
  }, [navigableItems, focusedItemId, props.activeNodeId, props.activeTemplateId]);

  // Effect to scroll focused item into view
  useEffect(() => {
    if (focusedItemId && sidebarRef.current) {
        const element = sidebarRef.current.querySelector(`[data-item-id='${focusedItemId}']`);
        element?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedItemId]);

  // --- Load initial layout state from storage ---
  useEffect(() => {
    storageService.load<number | null>(LOCAL_STORAGE_KEYS.SIDEBAR_DOCS_PANEL_HEIGHT, null).then(height => {
        setDocsPanelHeight(height);
    });
    storageService.load<boolean>(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_COLLAPSED, false).then(collapsed => {
        setIsTemplatesCollapsed(collapsed);
    });
  }, []);

  // --- Resizing Logic ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        if (docsPanelHeight !== null) {
            storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_DOCS_PANEL_HEIGHT, docsPanelHeight);
        }
    }
  }, [docsPanelHeight]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !sidebarContentRef.current) return;
    
    const rect = sidebarContentRef.current.getBoundingClientRect();
    const newHeight = e.clientY - rect.top;
    const totalHeight = rect.height;

    const clampedHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(newHeight, totalHeight - MIN_PANEL_HEIGHT));

    setDocsPanelHeight(clampedHeight);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // --- Collapse/Expand Logic ---
  const handleToggleCollapse = () => {
    const newCollapsedState = !isTemplatesCollapsed;
    setIsTemplatesCollapsed(newCollapsedState);
    storageService.save(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_COLLAPSED, newCollapsedState);
  };
  
  const finalDocsPanelHeight = useMemo(() => {
    if (isTemplatesCollapsed) return 'auto';
    if (docsPanelHeight !== null) return `${docsPanelHeight}px`;
    if (sidebarContentRef.current) {
        return `${sidebarContentRef.current.clientHeight * (DEFAULT_DOCS_PANEL_HEIGHT_PERCENT / 100)}px`;
    }
    return `${DEFAULT_DOCS_PANEL_HEIGHT_PERCENT}%`;
  }, [docsPanelHeight, isTemplatesCollapsed]);

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


  return (
    <div ref={sidebarRef} onKeyDown={handleKeyDown} tabIndex={0} className="h-full flex flex-col focus:outline-none">
      <div className="px-2 pt-2 pb-2 flex-shrink-0 border-b border-border-color">
        <div className="relative">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border-color rounded-md pl-9 pr-3 py-1.5 text-sm text-text-main focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary"
            />
        </div>
      </div>

      <div ref={sidebarContentRef} className="flex-1 flex flex-col overflow-hidden">
        {/* --- Documents Panel --- */}
        <div
          style={{ height: finalDocsPanelHeight }}
          className={`flex flex-col ${isTemplatesCollapsed ? 'flex-1' : ''}`}
        >
          <header className="flex items-center justify-between p-2 flex-shrink-0 sticky top-0 bg-secondary z-10">
              <h2 className="text-sm font-semibold text-text-secondary px-2 tracking-wider uppercase">Documents</h2>
              <div className="flex items-center gap-1">
              <IconButton onClick={props.onNewDocument} tooltip="New Document (Ctrl+N)" size="sm" tooltipPosition="bottom">
                  <PlusIcon />
              </IconButton>
              <IconButton onClick={props.onNewRootFolder} tooltip="New Root Folder" size="sm" tooltipPosition="bottom">
                  <FolderPlusIcon />
              </IconButton>
              <IconButton onClick={props.onNewSubfolder} disabled={!activeNode || activeNode.type !== 'folder'} tooltip="New Subfolder" size="sm" tooltipPosition="bottom">
                  <FolderDownIcon />
              </IconButton>
              <IconButton onClick={props.onDuplicateSelection} disabled={props.selectedIds.size === 0} tooltip="Duplicate Selection" size="sm" tooltipPosition="bottom">
                  <DocumentDuplicateIcon />
              </IconButton>
              </div>
          </header>
          <div className="flex-1 overflow-y-auto">
            <DocumentList 
                tree={documentTree}
                documents={props.documents}
                selectedIds={props.selectedIds}
                focusedItemId={focusedItemId}
                onSelectNode={props.onSelectNode}
                onDeleteNode={props.onDeleteNode}
                onRenameNode={props.onRenameNode}
                onMoveNode={props.onMoveNode}
                onCopyNodeContent={props.onCopyNodeContent}
                searchTerm={searchTerm}
                expandedIds={props.expandedFolderIds}
                onToggleExpand={props.onToggleExpand}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
            />
          </div>
        </div>
        
        {!isTemplatesCollapsed && (
            <div
                onMouseDown={handleMouseDown}
                className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200 z-10"
            />
        )}
        
        {/* --- Templates Panel (Header + List) --- */}
        <div className={`flex flex-col ${!isTemplatesCollapsed ? 'flex-1' : ''} overflow-hidden`}>
          <header className={`flex items-center justify-between p-2 flex-shrink-0 ${isTemplatesCollapsed ? 'border-t border-border-color' : 'pt-2'}`}>
              <div className="flex items-center gap-1">
                  <IconButton onClick={handleToggleCollapse} tooltip={isTemplatesCollapsed ? "Show Templates" : "Hide Templates"} size="sm">
                      {isTemplatesCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                  </IconButton>
                  <h2 className="text-sm font-semibold text-text-secondary px-2 tracking-wider uppercase">Templates</h2>
              </div>
              {!isTemplatesCollapsed && (
                <div className="flex items-center gap-1">
                    <IconButton onClick={props.onNewTemplate} tooltip="New Template" size="sm" tooltipPosition="bottom">
                        <DocumentDuplicateIcon />
                    </IconButton>
                </div>
              )}
          </header>
          {!isTemplatesCollapsed && (
            <div className="flex-1 overflow-y-auto px-2">
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
      
       <div className="p-2 border-t border-border-color">
            <Button onClick={props.onNewFromTemplate} variant="secondary" className="w-full">
                <PlusIcon className="w-4 h-4 mr-2" />
                New from Template...
            </Button>
        </div>
    </div>
  );
};

export default Sidebar;
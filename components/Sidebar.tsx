import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PromptList from './PromptList';
import TemplateList from './TemplateList';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder, PromptTemplate } from '../types';
import IconButton from './IconButton';
import { FolderPlusIcon, PlusIcon, SearchIcon, DocumentDuplicateIcon, FolderDownIcon } from './Icons';
import Button from './Button';
import { PromptNode } from './PromptTreeItem';

type NavigableItem = { id: string; type: 'document' | 'folder' | 'template'; parentId: string | null; };

interface SidebarProps {
  prompts: DocumentOrFolder[];
  promptTree: PromptNode[];
  navigableItems: NavigableItem[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastClickedId: string | null;
  setLastClickedId: React.Dispatch<React.SetStateAction<string | null>>;
  activePromptId: string | null;
  onSelectPrompt: (id: string, e: React.MouseEvent) => void;
  onDeleteSelection: () => void;
  onRenamePrompt: (id: string, newTitle: string) => void;
  onMovePrompt: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onNewPrompt: () => void;
  onNewRootFolder: () => void;
  onNewSubfolder: () => void;
  onDuplicateSelection: () => void;
  onCopyPromptContent: (id: string) => void;
  expandedFolderIds: Set<string>;
  onToggleExpand: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  templates: PromptTemplate[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
  onNewTemplate: () => void;
  onNewFromTemplate: () => void;
}

// Helper function to find a node and its siblings in a tree structure
const findNodeAndSiblings = (nodes: PromptNode[], id: string): {node: PromptNode, siblings: PromptNode[]} | null => {
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
  const { promptTree, navigableItems, searchTerm, setSearchTerm, setSelectedIds, lastClickedId, setLastClickedId } = props;
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const activeNode = useMemo(() => {
    return props.prompts.find(p => p.id === props.activePromptId) || null;
  }, [props.prompts, props.activePromptId]);


  // Effect to manage focus state
  useEffect(() => {
    if (!focusedItemId || !navigableItems.some(item => item.id === focusedItemId)) {
      const activeItem = props.activePromptId || props.activeTemplateId;
      if (activeItem && navigableItems.some(item => item.id === activeItem)) {
        setFocusedItemId(activeItem);
      } else {
        setFocusedItemId(navigableItems[0]?.id || null);
      }
    }
  }, [navigableItems, focusedItemId, props.activePromptId, props.activeTemplateId]);

  // Effect to scroll focused item into view
  useEffect(() => {
    if (focusedItemId && sidebarRef.current) {
        const element = sidebarRef.current.querySelector(`[data-item-id='${focusedItemId}']`);
        element?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedItemId]);

  const handleMoveUp = useCallback((id: string) => {
      const result = findNodeAndSiblings(promptTree, id);
      if (!result) return;
      
      const { siblings } = result;
      const index = siblings.findIndex(s => s.id === id);
      
      if (index > 0) {
          const targetSiblingId = siblings[index - 1].id;
          props.onMovePrompt([id], targetSiblingId, 'before');
      }
  }, [promptTree, props.onMovePrompt]);
  
  const handleMoveDown = useCallback((id: string) => {
      const result = findNodeAndSiblings(promptTree, id);
      if (!result) return;
      
      const { siblings } = result;
      const index = siblings.findIndex(s => s.id === id);
      
      if (index < siblings.length - 1) {
          const targetSiblingId = siblings[index + 1].id;
          props.onMovePrompt([id], targetSiblingId, 'after');
      }
  }, [promptTree, props.onMovePrompt]);

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
        props.onDeleteSelection();
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
            props.onSelectPrompt(item.id, { ctrlKey: isCtrl } as React.MouseEvent);
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
          props.onSelectPrompt(newItem.id, { } as React.MouseEvent);
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
      <div className="flex-1 overflow-y-auto">
        {/* --- Prompts Section --- */}
        <header className="flex items-center justify-between p-2 flex-shrink-0 sticky top-0 bg-secondary z-10">
            <h2 className="text-sm font-semibold text-text-secondary px-2 tracking-wider uppercase">Documents</h2>
            <div className="flex items-center gap-1">
            <IconButton onClick={props.onNewPrompt} tooltip="New Document (Ctrl+N)" size="sm" tooltipPosition="bottom">
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
        <PromptList 
            tree={promptTree}
            prompts={props.prompts}
            selectedIds={props.selectedIds}
            focusedItemId={focusedItemId}
            onSelectNode={props.onSelectPrompt}
            onDeleteNode={props.onDeleteSelection}
            onRenameNode={props.onRenamePrompt}
            onMoveNode={props.onMovePrompt}
            onCopyNodeContent={props.onCopyPromptContent}
            searchTerm={searchTerm}
            expandedIds={props.expandedFolderIds}
            onToggleExpand={props.onToggleExpand}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
        />

        {/* --- Templates Section --- */}
        <header className="flex items-center justify-between p-2 mt-4 pt-4 border-t border-border-color flex-shrink-0">
            <h2 className="text-sm font-semibold text-text-secondary px-2 tracking-wider uppercase">Templates</h2>
            <div className="flex items-center gap-1">
                <IconButton onClick={props.onNewTemplate} tooltip="New Template" size="sm" tooltipPosition="bottom">
                    <DocumentDuplicateIcon />
                </IconButton>
            </div>
        </header>
        <div className="px-2">
            <TemplateList 
                templates={props.templates}
                activeTemplateId={props.activeTemplateId}
                focusedItemId={focusedItemId}
                onSelectTemplate={props.onSelectTemplate}
                onDeleteTemplate={props.onDeleteTemplate}
                onRenameTemplate={props.onRenameTemplate}
            />
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

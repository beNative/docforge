import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PromptList from './PromptList';
import TemplateList from './TemplateList';
// Fix: Correctly import the PromptOrFolder type.
import type { PromptOrFolder, PromptTemplate } from '../types';
import IconButton from './IconButton';
import { FolderPlusIcon, PlusIcon, SearchIcon, DocumentDuplicateIcon } from './Icons';
import Button from './Button';
import { PromptNode } from './PromptTreeItem';

interface SidebarProps {
  prompts: PromptOrFolder[];
  selectedIds: Set<string>;
  activePromptId: string | null;
  onSelectPrompt: (id: string, e: React.MouseEvent) => void;
  onDeletePrompt: (id: string) => void;
  onRenamePrompt: (id: string, newTitle: string) => void;
  onMovePrompt: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onNewPrompt: () => void;
  onNewFolder: () => void;
  onCopyPromptContent: (id: string) => void;
  expandedFolderIds: Set<string>;
  onToggleExpand: (id: string) => void;

  templates: PromptTemplate[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
  onNewTemplate: () => void;
  onNewFromTemplate: () => void;
}

type NavigableItem = { id: string; type: 'prompt' | 'folder' | 'template'; parentId: string | null; };

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
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { promptTree, navigableItems } = useMemo(() => {
    // --- Build Prompt Tree ---
    let itemsToBuildFrom = props.prompts;
    if (searchTerm.trim()) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const visibleIds = new Set<string>();
        const originalItemsById: Map<string, PromptOrFolder> = new Map(props.prompts.map(i => [i.id, i]));
        const getAncestors = (itemId: string) => {
            let current = originalItemsById.get(itemId);
            while (current && current.parentId) {
              visibleIds.add(current.parentId);
              current = originalItemsById.get(current.parentId);
            }
        };
        const getDescendantIds = (itemId: string): Set<string> => {
            const descendantIds = new Set<string>();
            const findChildren = (parentId: string) => {
                props.prompts.forEach(p => { if (p.parentId === parentId) { descendantIds.add(p.id); if (p.type === 'folder') findChildren(p.id); } });
            };
            findChildren(itemId);
            return descendantIds;
        };
        props.prompts.forEach(item => {
            if (item.title.toLowerCase().includes(lowerCaseSearchTerm)) {
                visibleIds.add(item.id);
                getAncestors(item.id);
                if (item.type === 'folder') getDescendantIds(item.id).forEach(id => visibleIds.add(id));
            }
        });
        itemsToBuildFrom = props.prompts.filter(item => visibleIds.has(item.id));
    }
    const itemsById = new Map<string, PromptNode>(itemsToBuildFrom.map(p => [p.id, { ...p, children: [] }]));
    const rootNodes: PromptNode[] = [];
    for (const item of itemsToBuildFrom) {
        const node = itemsById.get(item.id)!;
        if (item.parentId && itemsById.has(item.parentId)) {
            itemsById.get(item.parentId)!.children.push(node);
        } else {
            rootNodes.push(node);
        }
    }
    
    // The visual order should respect the array order from props, so we no longer sort here.
    const finalTree = rootNodes;

    // --- Flatten for Navigation ---
    const displayExpandedIds = searchTerm.trim() 
        ? new Set(itemsToBuildFrom.filter(i => i.type === 'folder').map(i => i.id)) 
        : props.expandedFolderIds;

    const flatList: NavigableItem[] = [];
    const flatten = (nodes: PromptNode[]) => {
      for (const node of nodes) {
        // Fix: PromptNode extends PromptOrFolder, so it has id, type, and parentId.
        flatList.push({ id: node.id, type: node.type, parentId: node.parentId });
        if (node.type === 'folder' && displayExpandedIds.has(node.id)) {
          flatten(node.children);
        }
      }
    };
    flatten(finalTree);
    props.templates.forEach(t => flatList.push({ id: t.template_id, type: 'template', parentId: null }));

    return { promptTree: finalTree, navigableItems: flatList };
  }, [props.prompts, props.templates, searchTerm, props.expandedFolderIds]);

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
            // Pass a fake event that won't trigger multi-select.
            props.onSelectPrompt(item.id, {} as React.MouseEvent);
        }
    };

    switch (key) {
      case 'ArrowUp': {
        const prevIndex = Math.max(0, currentIndex - 1);
        const newItem = navigableItems[prevIndex];
        setFocusedItemId(newItem.id);
        selectItem(newItem);
        break;
      }
      case 'ArrowDown': {
        const nextIndex = Math.min(navigableItems.length - 1, currentIndex + 1);
        const newItem = navigableItems[nextIndex];
        setFocusedItemId(newItem.id);
        selectItem(newItem);
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
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border-color rounded-md pl-9 pr-3 py-1.5 text-sm text-text-main focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary"
            />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* --- Prompts Section --- */}
        <header className="flex items-center justify-between p-2 flex-shrink-0">
            <h2 className="text-sm font-semibold text-text-secondary px-2 tracking-wider uppercase">Prompts</h2>
            <div className="flex items-center gap-1">
            <IconButton onClick={props.onNewFolder} tooltip="New Root Folder" size="sm" tooltipPosition="bottom">
                <FolderPlusIcon />
            </IconButton>
            <IconButton onClick={props.onNewPrompt} tooltip="New Prompt (Ctrl+N)" size="sm" tooltipPosition="bottom">
                <PlusIcon />
            </IconButton>
            </div>
        </header>
        <PromptList 
            tree={promptTree}
            prompts={props.prompts}
            selectedIds={props.selectedIds}
            focusedItemId={focusedItemId}
            onSelectNode={props.onSelectPrompt}
            onDeleteNode={props.onDeletePrompt}
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
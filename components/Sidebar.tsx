import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { DocumentOrFolder, DocumentTemplate } from '../types';
import DocumentList from './PromptList';
import TemplateList from './TemplateList';
import IconButton from './IconButton';
import { PlusIcon, FolderPlusIcon, SearchIcon, ChevronDownIcon, ChevronRightIcon } from './Icons';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { useLocalStorage } from '../hooks/useLocalStorage';

// The DocumentNode interface and buildTree function are needed for the DocumentList.
// They are placed here to be co-located with the logic that uses them.
export interface DocumentNode extends DocumentOrFolder {
  children: DocumentNode[];
}

export const buildTree = (items: DocumentOrFolder[], rootParentId: string | null = null): DocumentNode[] => {
  const childrenOf = new Map<string | null, DocumentOrFolder[]>();
  items.forEach(item => {
    const parentId = item.parentId || null;
    if (!childrenOf.has(parentId)) {
      childrenOf.set(parentId, []);
    }
    childrenOf.get(parentId)!.push(item);
  });

  const build = (parentId: string | null): DocumentNode[] => {
    const children = childrenOf.get(parentId) || [];
    // The items from the repository are already sorted, so we can rely on their order.
    return children.map(item => ({
      ...item,
      children: build(item.id),
    }));
  };

  return build(rootParentId);
};


// It filters the flat list and then rebuilds the tree.
const filterAndBuildTree = (items: DocumentOrFolder[], searchTerm: string): DocumentNode[] => {
    if (!searchTerm.trim()) {
      return buildTree(items);
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const filteredItems = items.filter(item => item.title.toLowerCase().includes(lowercasedTerm));
    
    const itemMap = new Map(items.map(i => [i.id, i]));
    const visibleIds = new Set<string>();

    filteredItems.forEach(item => {
        let current: DocumentOrFolder | undefined = item;
        while(current) {
            if (visibleIds.has(current.id)) break;
            visibleIds.add(current.id);
            current = current.parentId ? itemMap.get(current.parentId) : undefined;
        }
    });
    
    const visibleItems = items.filter(i => visibleIds.has(i.id));
    return buildTree(visibleItems);
};

interface SidebarProps {
  items: DocumentOrFolder[];
  templates: DocumentTemplate[];
  selectedIds: Set<string>;
  focusedItemId: string | null;
  activeTemplateId: string | null;
  expandedIds: Set<string>;
  renamingNodeId: string | null;
  width: number;
  onAddDocument: (parentId: string | null) => void;
  onAddFolder: (parentId: string | null) => void;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: "before" | "after" | "inside") => void;
  onCopyNodeContent: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string | null) => void;
  onRenameComplete: () => void;
  onSelectTemplate: (id: string | null) => void;
  onDeleteTemplate: (id: string, shiftKey: boolean) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
  onAddTemplate: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
}


const Sidebar: React.FC<SidebarProps> = (props) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [templatesCollapsed, setTemplatesCollapsed] = useLocalStorage(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_COLLAPSED, false);
    const [templatesPanelHeight, setTemplatesPanelHeight] = useLocalStorage(LOCAL_STORAGE_KEYS.SIDEBAR_TEMPLATES_PANEL_HEIGHT, 200);
    const isResizingTemplates = useRef(false);

    const filteredTree = useMemo(() => filterAndBuildTree(props.items, searchTerm), [props.items, searchTerm]);

    const handleTemplatesResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingTemplates.current = true;
    };
    
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingTemplates.current) {
            const newHeight = window.innerHeight - e.clientY;
            setTemplatesPanelHeight(Math.max(50, Math.min(window.innerHeight - 200, newHeight)));
        }
    }, [setTemplatesPanelHeight]);

    const handleGlobalMouseUp = useCallback(() => {
        isResizingTemplates.current = false;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);


    return (
        <aside
            style={{ width: `${props.width}px` }}
            className="flex-shrink-0 bg-secondary border-r border-border-color flex flex-col h-full relative"
        >
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Documents Section */}
                <div className="p-2 border-b border-border-color">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-text-main px-2">Documents</h2>
                        <div className="flex items-center">
                            <IconButton onClick={() => props.onAddFolder(null)} tooltip="New Folder" size="sm" variant="ghost">
                                <FolderPlusIcon className="w-5 h-5" />
                            </IconButton>
                            <IconButton onClick={() => props.onAddDocument(null)} tooltip="New Document" size="sm" variant="ghost">
                                <PlusIcon className="w-5 h-5" />
                            </IconButton>
                        </div>
                    </div>
                    <div className="relative">
                        <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-border-color rounded-md pl-9 pr-3 py-1.5 text-sm text-text-main focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                </div>
                <DocumentList
                    tree={filteredTree}
                    documents={props.items}
                    selectedIds={props.selectedIds}
                    focusedItemId={props.focusedItemId}
                    expandedIds={props.expandedIds}
                    onSelectNode={props.onSelectNode}
                    onDeleteNode={props.onDeleteNode}
                    onRenameNode={props.onRenameNode}
                    onMoveNode={props.onMoveNode}
                    onCopyNodeContent={props.onCopyNodeContent}
                    searchTerm={searchTerm}
                    onToggleExpand={props.onToggleExpand}
                    onMoveUp={props.onMoveUp}
                    onMoveDown={props.onMoveDown}
                    onContextMenu={props.onContextMenu}
                    renamingNodeId={props.renamingNodeId}
                    onRenameComplete={props.onRenameComplete}
                />
            </div>
            {/* Resizer */}
             <div
                onMouseDown={handleTemplatesResizeStart}
                className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
            />
            {/* Templates Section */}
            <div
                style={{ height: templatesCollapsed ? 'auto' : `${templatesPanelHeight}px` }}
                className="flex-shrink-0 flex flex-col"
            >
                <div className="p-2 border-b border-border-color">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setTemplatesCollapsed(c => !c)} className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-text-main rounded-md hover:bg-border-color/50 w-full text-left">
                            {templatesCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                            <span>Templates</span>
                        </button>
                        {!templatesCollapsed && (
                            <IconButton onClick={props.onAddTemplate} tooltip="New Template" size="sm" variant="ghost">
                                <PlusIcon className="w-5 h-5" />
                            </IconButton>
                        )}
                    </div>
                </div>
                {!templatesCollapsed && (
                    <div className="flex-1 p-2 overflow-y-auto">
                        <TemplateList
                            templates={props.templates}
                            activeTemplateId={props.activeTemplateId}
                            focusedItemId={null} // Templates don't share focus with documents for now
                            onSelectTemplate={props.onSelectTemplate}
                            onDeleteTemplate={props.onDeleteTemplate}
                            onRenameTemplate={props.onRenameTemplate}
                        />
                    </div>
                )}
            </div>
            {/* Sidebar Resizer */}
            <div onMouseDown={props.onResizeStart} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary transition-colors z-10" />
        </aside>
    );
};
export default Sidebar;

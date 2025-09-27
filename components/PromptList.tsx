import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { DocumentOrFolder } from '../types';
import PromptTreeItem, { PromptNode } from './PromptTreeItem';
import { SearchIcon } from './Icons';

interface PromptListProps {
  items: DocumentOrFolder[];
  selectedIds: Set<string>;
  focusedItemId: string | null;
  setFocusedItemId: (id: string | null) => void;
  expandedIds: Set<string>;
  setExpandedIds: (updater: React.SetStateAction<Set<string>>) => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onMove: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onDuplicate: (ids: string[]) => void;
}

const buildTree = (items: DocumentOrFolder[], parentId: string | null = null): PromptNode[] => {
  return items
    .filter(item => item.parentId === parentId)
    .map(item => ({
      ...item,
      children: buildTree(items, item.id),
    }));
};

const filterTree = (nodes: PromptNode[], searchTerm: string, expandedIds: Set<string>, setExpandedIds: (updater: React.SetStateAction<Set<string>>) => void): { filtered: PromptNode[], found: boolean } => {
  if (!searchTerm) return { filtered: nodes, found: true };
  const lowercasedTerm = searchTerm.toLowerCase();
  
  const newExpandedIds = new Set<string>();

  const filter = (node: PromptNode): PromptNode | null => {
    const childrenResult = node.children.map(filter).filter((n): n is PromptNode => n !== null);
    
    const isMatch = node.title.toLowerCase().includes(lowercasedTerm);
    
    if (isMatch || childrenResult.length > 0) {
        if(childrenResult.length > 0) {
            newExpandedIds.add(node.id);
        }
        return { ...node, children: childrenResult };
    }
    
    return null;
  };
  
  const filtered = nodes.map(filter).filter((n): n is PromptNode => n !== null);
  
  useEffect(() => {
    if(searchTerm){
        setExpandedIds(newExpandedIds);
    }
  }, [searchTerm, setExpandedIds]);


  return { filtered, found: filtered.length > 0 };
};

const flattenTreeForNav = (nodes: PromptNode[]): string[] => {
    const result: string[] = [];
    const traverse = (node: PromptNode) => {
        result.push(node.id);
        if (node.children) {
            node.children.forEach(traverse);
        }
    };
    nodes.forEach(traverse);
    return result;
};


const PromptList: React.FC<PromptListProps> = (props) => {
  const { items, selectedIds, onSelect, onDelete, onRename, onMove, onDuplicate, expandedIds, setExpandedIds, focusedItemId, setFocusedItemId } = props;
  const [searchTerm, setSearchTerm] = useState('');
  const [dropTarget, setDropTarget] = useState<'root' | null>(null);

  const listRef = useRef<HTMLUListElement>(null);

  const tree = useMemo(() => buildTree(items), [items]);
  
  const { filtered, found } = useMemo(() => filterTree(tree, searchTerm, expandedIds, setExpandedIds), [tree, searchTerm, expandedIds, setExpandedIds]);
  
  const visibleItemIds = useMemo(() => flattenTreeForNav(filtered), [filtered]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, [setExpandedIds]);
  
  const handleKeyboardNav = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'F2', ' '].includes(e.key)) return;
    
    if (!focusedItemId && visibleItemIds.length > 0) {
        setFocusedItemId(visibleItemIds[0]);
        return;
    }

    const currentIndex = visibleItemIds.findIndex(id => id === focusedItemId);
    if (currentIndex === -1) return;

    e.preventDefault();

    switch (e.key) {
      case 'ArrowUp': {
        const nextIndex = Math.max(0, currentIndex - 1);
        setFocusedItemId(visibleItemIds[nextIndex]);
        break;
      }
      case 'ArrowDown': {
        const nextIndex = Math.min(visibleItemIds.length - 1, currentIndex + 1);
        setFocusedItemId(visibleItemIds[nextIndex]);
        break;
      }
      case 'ArrowRight': {
        const focusedItem = items.find(i => i.id === focusedItemId);
        if (focusedItem?.type === 'folder' && !expandedIds.has(focusedItemId!)) {
            handleToggleExpand(focusedItemId!);
        }
        break;
      }
      case 'ArrowLeft': {
        const focusedItem = items.find(i => i.id === focusedItemId);
        if (focusedItem?.type === 'folder' && expandedIds.has(focusedItemId!)) {
            handleToggleExpand(focusedItemId!);
        }
        break;
      }
    }
  }, [focusedItemId, visibleItemIds, setFocusedItemId, items, expandedIds, handleToggleExpand]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget('root');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedIdsJSON = e.dataTransfer.getData('application/json');
    if (draggedIdsJSON) {
      const draggedIds = JSON.parse(draggedIdsJSON);
      onMove(draggedIds, null, 'inside');
    }
    setDropTarget(null);
  };
  
  return (
    <div className="flex-1 flex flex-col" onKeyDown={handleKeyboardNav} tabIndex={-1}>
        <div className="px-1 mb-2">
            <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                <input
                    type="text"
                    placeholder="Filter..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-background border border-border-color rounded-md pl-7 pr-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>
        </div>
      <div 
        className="flex-1 overflow-y-auto px-1"
        onDragOver={handleDragOver}
        onDragLeave={() => setDropTarget(null)}
        onDrop={handleDrop}
      >
        <ul ref={listRef} className={`relative h-full ${dropTarget === 'root' ? 'bg-primary/10' : ''}`}>
            {filtered.map((node, index) => (
            <PromptTreeItem
                key={node.id}
                node={node}
                level={0}
                selectedIds={selectedIds}
                focusedItemId={focusedItemId}
                expandedIds={expandedIds}
                onSelectNode={onSelect}
                onDeleteNode={onDelete}
                onRenameNode={onRename}
                onMoveNode={onMove}
                onToggleExpand={handleToggleExpand}
                onCopyNodeContent={() => navigator.clipboard.writeText(node.content || '')}
                searchTerm={searchTerm}
                onMoveUp={() => { /* Placeholder */ }}
                onMoveDown={() => { /* Placeholder */ }}
                canMoveUp={index > 0}
                canMoveDown={index < filtered.length - 1}
            />
            ))}
            {items.length === 0 && (
                <li className="text-center text-text-secondary p-4 text-sm">
                    No documents yet.
                </li>
            )}
            {items.length > 0 && searchTerm && !found && (
                <li className="text-center text-text-secondary p-4 text-sm">
                    No matching documents.
                </li>
            )}
        </ul>
      </div>
    </div>
  );
};

export default PromptList;

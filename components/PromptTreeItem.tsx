import React, { useState, useRef, useEffect } from 'react';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder } from '../types';
import IconButton from './IconButton';
import { FileIcon, FolderIcon, FolderOpenIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, CodeIcon } from './Icons';

export interface DocumentNode extends DocumentOrFolder {
  children: DocumentNode[];
}

interface DocumentTreeItemProps {
  node: DocumentNode;
  level: number;
  selectedIds: Set<string>;
  focusedItemId: string | null;
  expandedIds: Set<string>;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onDropFiles: (files: FileList, parentId: string | null) => void;
  onToggleExpand: (id: string) => void;
  onCopyNodeContent: (id: string) => void;
  searchTerm: string;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onContextMenu: (e: React.MouseEvent, nodeId: string | null) => void;
  renamingNodeId: string | null;
  onRenameComplete: () => void;
}

// Helper function to determine drop position based on mouse coordinates within an element
const getDropPosition = (
  e: React.DragEvent,
  isFolder: boolean,
  itemEl: HTMLElement | null
): 'before' | 'after' | 'inside' | null => {
  if (!itemEl) return null;

  const rect = itemEl.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (height === 0) return null; // Avoid division by zero

  if (isFolder) {
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  } else {
    if (y < height * 0.5) return 'before';
    return 'after';
  }
};


const DocumentTreeItem: React.FC<DocumentTreeItemProps> = (props) => {
  const {
    node,
    level,
    selectedIds,
    focusedItemId,
    expandedIds,
    onSelectNode,
    onDeleteNode,
    onRenameNode,
    onMoveNode,
    onDropFiles,
    onToggleExpand,
    onCopyNodeContent,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    onContextMenu,
    renamingNodeId,
    onRenameComplete
  } = props;
  
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.title);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);

  const isSelected = selectedIds.has(node.id);
  const isFocused = focusedItemId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isFolder = node.type === 'folder';
  const isCodeFile = node.doc_type === 'source_code';
  
  useEffect(() => {
    if (renamingNodeId === node.id) {
      setIsRenaming(true);
      onRenameComplete();
    }
  }, [renamingNodeId, node.id, onRenameComplete]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);
  
  useEffect(() => {
    if (isRenaming && !isSelected) {
      setIsRenaming(false);
    }
  }, [isSelected, isRenaming]);

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== node.title) {
      onRenameNode(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    else if (e.key === 'Escape') setIsRenaming(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const draggedIds = Array.from(selectedIds.has(node.id) ? selectedIds : new Set([node.id]));
    e.dataTransfer.setData('application/json', JSON.stringify(draggedIds));
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/json')) {
        const position = getDropPosition(e, isFolder, itemRef.current);
        if (position !== dropPosition) {
            setDropPosition(position);
        }
    }
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Re-enabled to prevent event from bubbling to root drop handler

    const finalDropPosition = getDropPosition(e, isFolder, itemRef.current);
    setDropPosition(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const parentId = finalDropPosition === 'inside' ? node.id : node.parentId;
        onDropFiles(e.dataTransfer.files, parentId);
        return;
    }

    const draggedIdsJSON = e.dataTransfer.getData('application/json');
    if (draggedIdsJSON && finalDropPosition) {
        const draggedIds = JSON.parse(draggedIdsJSON);
        if (!draggedIds.includes(node.id)) { // Prevent dropping on itself
            onMoveNode(draggedIds, node.id, finalDropPosition);
            // Auto-expand folder on drop for better UX
            if (finalDropPosition === 'inside' && isFolder && !isExpanded) {
                onToggleExpand(node.id);
            }
        }
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.id);
  }

  return (
    <li
      ref={itemRef}
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      style={{ paddingLeft: `${level * 10}px` }}
      className="relative"
      data-item-id={node.id}
    >
        <div
            onClick={(e) => !isRenaming && onSelectNode(node.id, e)}
            onDoubleClick={(e) => !isRenaming && handleRenameStart(e)}
            className={`w-full text-left px-1 py-0.5 rounded-md group flex justify-between items-center transition-colors duration-150 text-xs relative focus:outline-none ${
                isSelected ? 'bg-tree-selected text-text-main' : 'hover:bg-border-color/30 text-text-secondary hover:text-text-main'
            } ${isFocused ? 'ring-2 ring-primary ring-offset-[-2px] ring-offset-secondary' : ''}`}
        >
            <div className="flex items-center gap-1 flex-1 truncate">
                {isFolder && node.children.length > 0 ? (
                    <button onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }} className="-ml-1 p-0.5 rounded hover:bg-border-color">
                        {isExpanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                    </button>
                ) : (
                    <div className="w-4" /> // Spacer for alignment
                )}

                {isFolder ? (
                    isExpanded ? <FolderOpenIcon className="w-3.5 h-3.5 flex-shrink-0" /> : <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                    isCodeFile ? <CodeIcon className="w-3.5 h-3.5 flex-shrink-0" /> : <FileIcon className="w-3.5 h-3.5 flex-shrink-0" />
                )}

                {isRenaming ? (
                    <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={handleRenameKeyDown}
                        className="w-full text-left text-xs px-1 py-0.5 rounded-md bg-background text-text-main border border-border-color focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                ) : (
                    <span className="truncate flex-1 px-1">{node.title}</span>
                )}
            </div>

            {!isRenaming && (
                <div className={`transition-opacity pr-1 flex items-center ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <IconButton onClick={(e) => { e.stopPropagation(); onMoveUp(node.id); }} tooltip="Move Up" size="xs" variant="ghost" disabled={!canMoveUp}>
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton onClick={(e) => { e.stopPropagation(); onMoveDown(node.id); }} tooltip="Move Down" size="xs" variant="ghost" disabled={!canMoveDown}>
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                    </IconButton>
                    {!isFolder && (
                        <IconButton onClick={(e) => { e.stopPropagation(); onCopyNodeContent(node.id); }} tooltip="Copy Content" size="xs" variant="ghost">
                            <CopyIcon className="w-3.5 h-3.5" />
                        </IconButton>
                    )}
                    <IconButton onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id, e.shiftKey); }} tooltip="Delete" size="xs" variant="destructive">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </IconButton>
                </div>
            )}
        </div>
        
        {dropPosition && <div className={`absolute left-0 right-0 h-0.5 bg-primary pointer-events-none ${
            dropPosition === 'before' ? 'top-0' : dropPosition === 'after' ? 'bottom-0' : ''
        }`} />}
        {dropPosition === 'inside' && <div className="absolute inset-0 border-2 border-primary rounded-md pointer-events-none bg-primary/10" />}

        {isFolder && isExpanded && (
            <ul>
                {node.children.map((childNode, index) => (
                    <DocumentTreeItem 
                        key={childNode.id} 
                        {...props} 
                        node={childNode} 
                        level={level + 1}
                        canMoveUp={index > 0}
                        canMoveDown={index < node.children.length - 1}
                    />
                ))}
            </ul>
        )}
    </li>
  );
};

export default DocumentTreeItem;
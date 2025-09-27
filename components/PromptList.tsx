import React, { useState } from 'react';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder } from '../types';
import DocumentTreeItem, { DocumentNode } from './PromptTreeItem';

interface DocumentListProps {
  tree: DocumentNode[];
  documents: DocumentOrFolder[]; // needed for the empty state check
  selectedIds: Set<string>;
  focusedItemId: string | null;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onCopyNodeContent: (id: string) => void;
  searchTerm: string;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string | null) => void;
  renamingNodeId: string | null;
  onRenameComplete: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
  tree, documents, selectedIds, focusedItemId, onSelectNode, onDeleteNode, onRenameNode, onMoveNode, onCopyNodeContent, searchTerm, expandedIds, onToggleExpand, onMoveUp, onMoveDown, onContextMenu, renamingNodeId, onRenameComplete
}) => {
  const [isRootDropping, setIsRootDropping] = useState(false);
  
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDropping(false);
    
    // Ensure we don't handle drops that were meant for a child item.
    const target = e.target as HTMLElement;
    if (target.closest('li[draggable="true"]')) {
      return;
    }
    
    const draggedIdsJSON = e.dataTransfer.getData('application/json');
    if (draggedIdsJSON) {
        const draggedIds = JSON.parse(draggedIdsJSON);
        // Dropping in the root area means targetId is null and position is 'inside' the root.
        onMoveNode(draggedIds, null, 'inside');
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (!target.closest('li[draggable="true"]')) {
        e.dataTransfer.dropEffect = 'move';
        setIsRootDropping(true);
      }
  };

  const handleRootDragLeave = () => {
    setIsRootDropping(false);
  };
  
  const handleRootContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('li[draggable="true"]')) {
      return;
    }
    onContextMenu(e, null);
  };


  const displayExpandedIds = searchTerm.trim() 
      ? new Set(documents.filter(i => i.type === 'folder').map(i => i.id)) 
      : expandedIds;

  return (
    <div 
        className="relative flex-1"
        onDrop={handleRootDrop}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onContextMenu={handleRootContextMenu}
    >
        <ul className="space-y-0.5 p-2">
        {tree.map((node, index) => (
            <DocumentTreeItem
                key={node.id}
                node={node}
                level={0}
                selectedIds={selectedIds}
                focusedItemId={focusedItemId}
                expandedIds={displayExpandedIds}
                onSelectNode={onSelectNode}
                onDeleteNode={onDeleteNode}
                onRenameNode={onRenameNode}
                onMoveNode={onMoveNode}
                onToggleExpand={onToggleExpand}
                onCopyNodeContent={onCopyNodeContent}
                searchTerm={searchTerm}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                canMoveUp={index > 0}
                canMoveDown={index < tree.length - 1}
                onContextMenu={onContextMenu}
                renamingNodeId={renamingNodeId}
                onRenameComplete={onRenameComplete}
            />
        ))}
        {documents.length === 0 && (
            <li className="text-center text-text-secondary p-4 text-sm">
                No documents or folders yet.
            </li>
        )}
        {documents.length > 0 && tree.length === 0 && (
            <li className="text-center text-text-secondary p-4 text-sm">
                No results found for "{searchTerm}".
            </li>
        )}
        </ul>
        {isRootDropping && (
          <div className="absolute inset-2 bg-primary/10 border-2 border-dashed border-primary rounded-md pointer-events-none flex items-center justify-center">
             <span className="text-sm font-semibold text-primary">Move to Root</span>
          </div>
        )}
    </div>
  );
};

export default DocumentList;

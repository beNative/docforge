import React, { useMemo, useState } from 'react';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder } from '../types';
import DocumentTreeItem, { DocumentNode } from './PromptTreeItem';

interface DocumentListProps {
  tree: DocumentNode[];
  documents: DocumentOrFolder[]; // needed for the empty state check
  selectedIds: Set<string>;
  focusedItemId: string | null;
  indentPerLevel: number;
  verticalSpacing: number;
  openDocumentIds: string[];
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onDropFiles: (files: FileList, parentId: string | null) => void;
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
  tree,
  documents,
  selectedIds,
  focusedItemId,
  indentPerLevel,
  verticalSpacing,
  openDocumentIds,
  onSelectNode,
  onDeleteNode,
  onRenameNode,
  onMoveNode,
  onDropFiles,
  onCopyNodeContent,
  searchTerm,
  expandedIds,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onContextMenu,
  renamingNodeId,
  onRenameComplete
}) => {
  // Fix: Corrected useState declaration syntax from `=>` to `=`. This resolves all subsequent "cannot find name" errors.
  const [isRootDropping, setIsRootDropping] = useState(false);
  const openDocumentIdSet = useMemo(() => new Set(openDocumentIds), [openDocumentIds]);
  
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // e.stopPropagation(); // Removed to allow event to bubble to App.tsx to reset drag state
    setIsRootDropping(false);
    
    // Ensure we don't handle drops that were meant for a child item.
    const target = e.target as HTMLElement;
    if (target.closest('li[draggable="true"]')) {
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDropFiles(e.dataTransfer.files, null);
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
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/json')) {
        const target = e.target as HTMLElement;
        if (!target.closest('li[draggable="true"]')) {
            e.dataTransfer.dropEffect = 'move';
            setIsRootDropping(true);
        }
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleRootDragLeave = () => {
    setIsRootDropping(false);
  };
  
  const handleRootContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Prevent root context menu if clicking on a draggable item
    if (target.closest('li[draggable="true"]')) {
      return;
    }
    e.preventDefault();
    onContextMenu(e, null);
  };


  const displayExpandedIds = searchTerm.trim() 
      ? new Set(documents.filter(i => i.type === 'folder').map(i => i.id)) 
      : expandedIds;

  return (
    <div 
        data-sidebar-drop-root
        className="relative flex-1"
        onDrop={handleRootDrop}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onContextMenu={handleRootContextMenu}
    >
        <ul className="space-y-0 p-1 m-0 list-none">
        {tree.map((node, index) => (
            <DocumentTreeItem
                key={node.id}
                node={node}
                level={0}
                indentPerLevel={indentPerLevel}
                verticalSpacing={verticalSpacing}
                openDocumentIds={openDocumentIdSet}
                selectedIds={selectedIds}
                focusedItemId={focusedItemId}
                expandedIds={displayExpandedIds}
                onSelectNode={onSelectNode}
                onDeleteNode={onDeleteNode}
                onRenameNode={onRenameNode}
                onMoveNode={onMoveNode}
                onDropFiles={onDropFiles}
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
            <li className="text-center text-text-secondary p-4 text-xs">
                No documents or folders yet.
            </li>
        )}
        {documents.length > 0 && tree.length === 0 && (
            <li className="text-center text-text-secondary p-4 text-xs">
                No results found for "{searchTerm}".
            </li>
        )}
        </ul>
        {isRootDropping && (
          <div className="absolute inset-2 bg-primary/10 border-2 border-dashed border-primary rounded-md pointer-events-none flex items-center justify-center">
             <span className="text-xs font-semibold text-primary">Move to Root</span>
          </div>
        )}
    </div>
  );
};

export default DocumentList;
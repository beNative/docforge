import React, { useState, useMemo, useCallback } from 'react';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder, DraggedNodeTransfer, SerializedNodeForTransfer } from '../types';
import DocumentTreeItem, { DocumentNode, DOCFORGE_DRAG_MIME } from './PromptTreeItem';

interface DocumentListProps {
  tree: DocumentNode[];
  documents: DocumentOrFolder[]; // needed for the empty state check
  selectedIds: Set<string>;
  focusedItemId: string | null;
  indentPerLevel: number;
  verticalSpacing: number;
  openDocumentIds: Set<string>;
  activeDocumentId: string | null;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey?: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onImportNodes: (payload: DraggedNodeTransfer, targetId: string | null, position: 'before' | 'after' | 'inside') => void | Promise<void>;
  onDropFiles: (files: FileList, parentId: string | null) => void;
  onCopyNodeContent: (id: string) => void;
  copyContentTooltip: string;
  onSaveNodeToFile: (id: string) => void;
  saveToFileTooltip: string;
  onToggleLock: (id: string, locked: boolean) => void | Promise<void>;
  getToggleLockTooltip: (locked: boolean) => string;
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
  activeDocumentId,
  onSelectNode,
  onDeleteNode,
  onRenameNode,
  onMoveNode,
  onImportNodes,
  onDropFiles,
  onCopyNodeContent,
  copyContentTooltip,
  onSaveNodeToFile,
  saveToFileTooltip,
  onToggleLock,
  getToggleLockTooltip,
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
  
  const nodeLookup = useMemo(() => {
    const map = new Map<string, DocumentNode>();
    const traverse = (nodes: DocumentNode[]) => {
        for (const node of nodes) {
            map.set(node.id, node);
            if (node.children.length > 0) {
                traverse(node.children);
            }
        }
    };
    traverse(tree);
    return map;
  }, [tree]);

  const parentLookup = useMemo(() => {
    const map = new Map<string, string | null>();
    const traverse = (nodes: DocumentNode[], parentId: string | null) => {
        for (const node of nodes) {
            map.set(node.id, parentId);
            if (node.children.length > 0) {
                traverse(node.children, node.id);
            }
        }
    };
    traverse(tree, null);
    return map;
  }, [tree]);

  const serializeNode = useCallback(function serialize(node: DocumentNode): SerializedNodeForTransfer {
    const children = node.children.length > 0 ? node.children.map(serialize) : undefined;
    return {
      type: node.type,
      title: node.title,
      content: node.content,
      doc_type: node.doc_type,
      language_hint: node.language_hint ?? null,
      default_view_mode: node.default_view_mode ?? null,
      children,
    };
  }, []);

  const buildTransferPayload = useCallback((ids: string[]): DraggedNodeTransfer | null => {
    if (!ids.length) {
      return null;
    }
    const idSet = new Set(ids);
    const rootIds = ids.filter(id => {
      let current = parentLookup.get(id) ?? null;
      while (current) {
        if (idSet.has(current)) {
          return false;
        }
        current = parentLookup.get(current) ?? null;
      }
      return true;
    });

    const nodes = rootIds
      .map(id => nodeLookup.get(id))
      .filter((node): node is DocumentNode => Boolean(node))
      .map(serializeNode);

    if (nodes.length === 0) {
      return null;
    }

    return {
      schema: 'docforge/nodes',
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes,
    };
  }, [nodeLookup, parentLookup, serializeNode]);

  const isKnownNodeId = useCallback((id: string) => nodeLookup.has(id), [nodeLookup]);

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
      try {
        const draggedIds = JSON.parse(draggedIdsJSON);
        const hasKnownIds = Array.isArray(draggedIds) && draggedIds.length > 0 && draggedIds.every(isKnownNodeId);
        if (hasKnownIds) {
          onMoveNode(draggedIds, null, 'inside');
          return;
        }
      } catch (error) {
        console.warn('Failed to parse local drag payload for root drop:', error);
      }
    }

    const transferData = e.dataTransfer.getData(DOCFORGE_DRAG_MIME);
    if (transferData) {
      try {
        const payload = JSON.parse(transferData) as DraggedNodeTransfer;
        onImportNodes(payload, null, 'inside');
      } catch (error) {
        console.warn('Failed to parse DocForge drag payload for root drop:', error);
      }
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (
      e.dataTransfer.types.includes('Files') ||
      e.dataTransfer.types.includes(DOCFORGE_DRAG_MIME) ||
      e.dataTransfer.types.includes('application/json')
    ) {
      const target = e.target as HTMLElement;
      if (!target.closest('li[draggable="true"]')) {
        let hasKnownLocalIds = false;
        if (e.dataTransfer.types.includes('application/json')) {
          try {
            const raw = e.dataTransfer.getData('application/json');
            const parsed = JSON.parse(raw);
            hasKnownLocalIds = Array.isArray(parsed) && parsed.length > 0 && parsed.every(isKnownNodeId);
          } catch {
            hasKnownLocalIds = false;
          }
        }
        const hasDocforgePayload = e.dataTransfer.types.includes(DOCFORGE_DRAG_MIME);
        const hasFiles = e.dataTransfer.types.includes('Files');
        const shouldCopy = hasFiles || (hasDocforgePayload && !hasKnownLocalIds);
        e.dataTransfer.dropEffect = shouldCopy ? 'copy' : 'move';
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
                openDocumentIds={openDocumentIds}
                activeDocumentId={activeDocumentId}
                selectedIds={selectedIds}
                focusedItemId={focusedItemId}
                expandedIds={displayExpandedIds}
                onSelectNode={onSelectNode}
                onDeleteNode={onDeleteNode}
                onRenameNode={onRenameNode}
                onMoveNode={onMoveNode}
                onImportNodes={onImportNodes}
                onRequestNodeExport={buildTransferPayload}
                onDropFiles={onDropFiles}
                onToggleExpand={onToggleExpand}
                onCopyNodeContent={onCopyNodeContent}
                copyContentTooltip={copyContentTooltip}
                onToggleLock={onToggleLock}
                getToggleLockTooltip={getToggleLockTooltip}
                onSaveNodeToFile={onSaveNodeToFile}
                saveToFileTooltip={saveToFileTooltip}
                searchTerm={searchTerm}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                canMoveUp={index > 0}
                canMoveDown={index < tree.length - 1}
                onContextMenu={onContextMenu}
                renamingNodeId={renamingNodeId}
                onRenameComplete={onRenameComplete}
                isKnownNodeId={isKnownNodeId}
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
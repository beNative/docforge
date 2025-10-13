import { useCallback, useMemo } from 'react';
import type { Node, DocumentOrFolder, DocType, ImportedNodeSummary } from '../types';
import { useNodes } from './useNodes';
import { mapExtensionToLanguageId } from '../services/languageService';

/**
 * Adapter function to convert the new `Node` data structure
 * to the legacy `DocumentOrFolder` structure that UI components still use.
 */
const nodeToDocumentOrFolder = (node: Node): DocumentOrFolder => ({
  id: node.node_id,
  type: node.node_type,
  title: node.title,
  content: node.document?.content,
  createdAt: node.created_at,
  updatedAt: node.updated_at,
  parentId: node.parent_id,
  doc_type: node.document?.doc_type,
  language_hint: node.document?.language_hint,
  default_view_mode: node.document?.default_view_mode,
});

/**
 * Recursively flattens the node tree into a simple array.
 */
const flattenNodes = (nodes: Node[]): Node[] => {
    return nodes.reduce<Node[]>((acc, node) => {
        acc.push(node);
        if (node.children) {
            acc.push(...flattenNodes(node.children));
        }
        return acc;
    }, []);
};

/**
 * Recursively finds all descendant IDs for a given node ID.
 */
const getDescendantIdsRecursive = (nodeId: string, allNodes: Node[]): Set<string> => {
    const children = allNodes.filter(n => n.parent_id === nodeId);
    const descendantIds = new Set<string>();
    for (const child of children) {
        descendantIds.add(child.node_id);
        const grandchildrenIds = getDescendantIdsRecursive(child.node_id, allNodes);
        grandchildrenIds.forEach(id => descendantIds.add(id));
    }
    return descendantIds;
};

/**
 * A hook that adapts the new `useNodes` hook to the legacy API expected by `App.tsx`.
 * This allows the UI to function without a full refactor of all components.
 */
export const useDocuments = () => {
  const { nodes, addNode, updateNode, deleteNode, deleteNodes, moveNodes, updateDocumentContent, refreshNodes, duplicateNodes, importFiles, importNodesFromTransfer, addLog, isLoading } = useNodes();

  const allNodesFlat = useMemo(() => flattenNodes(nodes), [nodes]);
  const items: DocumentOrFolder[] = useMemo(() => allNodesFlat.map(nodeToDocumentOrFolder), [allNodesFlat]);

  const addDocument = useCallback(async ({ parentId, title = 'New Document', content = '', doc_type = 'prompt', language_hint = 'markdown' }: { parentId: string | null, title?: string, content?: string, doc_type?: DocType, language_hint?: string | null }) => {
    const resolvedLanguage = mapExtensionToLanguageId(language_hint);
    const shouldPreviewByDefault = doc_type === 'pdf' || doc_type === 'image' || resolvedLanguage === 'pdf' || resolvedLanguage === 'image';
    const defaultViewMode = shouldPreviewByDefault ? 'preview' : undefined;
    const newNode = await addNode({
      parent_id: parentId,
      node_type: 'document',
      title,
      document: { content, doc_type, language_hint: resolvedLanguage, default_view_mode: defaultViewMode } as any,
    });
    return nodeToDocumentOrFolder(newNode);
  }, [addNode]);

  const addFolder = useCallback(async (parentId: string | null, title: string = 'New Folder') => {
    const newNode = await addNode({
      parent_id: parentId,
      node_type: 'folder',
      title,
    });
    return nodeToDocumentOrFolder(newNode);
  }, [addNode]);

  const updateItem = useCallback(async (id: string, updates: Partial<Omit<DocumentOrFolder, 'id' | 'content'>>) => {
    const nodeUpdates: Parameters<typeof updateNode>[1] = {};
    if (updates.title !== undefined) nodeUpdates.title = updates.title;
    if (updates.parentId !== undefined) nodeUpdates.parent_id = updates.parentId;
    if (updates.language_hint !== undefined) nodeUpdates.language_hint = updates.language_hint;
    if (updates.default_view_mode !== undefined) nodeUpdates.default_view_mode = updates.default_view_mode;

    if (Object.keys(nodeUpdates).length > 0) {
        await updateNode(id, nodeUpdates);
    }
  }, [updateNode]);

  const commitVersion = useCallback(async (nodeId: string, content: string) => {
      await updateDocumentContent(nodeId, content);
      // After committing a new version, we need to refresh to get the new content.
      await refreshNodes();
  }, [updateDocumentContent, refreshNodes]);

  const deleteItem = useCallback(async (id: string) => {
      await deleteNode(id);
      // The `useNodes` hook handles refreshing the state.
  }, [deleteNode]);

  const deleteItems = useCallback(async (ids: string[]) => {
    await deleteNodes(ids);
  }, [deleteNodes]);

  const duplicateItems = useCallback(async (ids: string[]) => {
      await duplicateNodes(ids);
  }, [duplicateNodes]);

  const moveItems = useCallback(async (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => {
      await moveNodes(draggedIds, targetId, position);
  }, [moveNodes]);

  const addDocumentsFromFiles = useCallback(async (
    files: { path: string; name: string; file: File }[],
    targetNodeId: string | null
  ): Promise<ImportedNodeSummary[]> => {
    addLog('INFO', `Importing ${files.length} files...`);

    const fileReadPromises = files.map(entry => {
      return new Promise<{ path: string; name: string; content: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ path: entry.path, name: entry.name, content: reader.result as string });
        reader.onerror = (error) => reject(error);

        const fileName = entry.name.toLowerCase();
        const mimeType = entry.file.type;
        const extension = fileName.split('.').pop() || '';
        const isPdf = (mimeType && mimeType.includes('pdf')) || extension === 'pdf';
        const isSvg = extension === 'svg' || extension === 'svgz' || mimeType === 'image/svg+xml';
        const isImage =
          (!isSvg && !!mimeType && mimeType.startsWith('image/')) ||
          ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].some(ext => extension === ext);

        const shouldReadAsDataUrl = isPdf || isImage;

        if (shouldReadAsDataUrl) {
          reader.readAsDataURL(entry.file);
        } else {
          reader.readAsText(entry.file);
        }
      });
    });

    try {
      const filesData = await Promise.all(fileReadPromises);
      const createdNodes = await importFiles(filesData, targetNodeId);
      addLog('INFO', 'File import process completed successfully in the backend.');
      await refreshNodes();
      return createdNodes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `File import failed: ${message}`);
      return [];
    }
  }, [addLog, importFiles, refreshNodes]);

  const getDescendantIds = useCallback((nodeId: string): Set<string> => {
      return getDescendantIdsRecursive(nodeId, allNodesFlat);
  }, [allNodesFlat]);

  return { items, addDocument, addFolder, updateItem, commitVersion, deleteItem, deleteItems, moveItems, getDescendantIds, refresh: refreshNodes, duplicateItems, addDocumentsFromFiles, importNodesFromTransfer, isLoading };
};

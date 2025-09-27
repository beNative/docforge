import { useCallback, useMemo } from 'react';
import type { Node, DocumentOrFolder } from '../types';
import { useNodes } from './useNodes';

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
  const { nodes, addNode, updateNode, deleteNode, moveNodes, updateDocumentContent, refreshNodes, duplicateNodes } = useNodes();

  const allNodesFlat = useMemo(() => flattenNodes(nodes), [nodes]);
  const items: DocumentOrFolder[] = useMemo(() => allNodesFlat.map(nodeToDocumentOrFolder), [allNodesFlat]);

  const addDocument = useCallback(async ({ parentId, title = 'New Document', content = '' }: { parentId: string | null, title?: string, content?: string }) => {
    const newNode = await addNode({
      parent_id: parentId,
      node_type: 'document',
      title,
      document: { content, doc_type: 'prompt' } as any,
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
    // This function now only handles metadata like title and parentId.
    if (updates.title !== undefined || updates.parentId !== undefined) {
        await updateNode(id, { title: updates.title, parent_id: updates.parentId });
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

  const duplicateItems = useCallback(async (ids: string[]) => {
      await duplicateNodes(ids);
  }, [duplicateNodes]);

  const moveItems = useCallback(async (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => {
      await moveNodes(draggedIds, targetId, position);
  }, [moveNodes]);

  const getDescendantIds = useCallback((nodeId: string): Set<string> => {
      return getDescendantIdsRecursive(nodeId, allNodesFlat);
  }, [allNodesFlat]);

  return { items, addDocument, addFolder, updateItem, commitVersion, deleteItem, moveItems, getDescendantIds, refresh: refreshNodes, duplicateItems };
};
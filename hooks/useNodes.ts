import { useState, useEffect, useCallback } from 'react';
import type { Node, ViewMode, ImportedNodeSummary, DraggedNodeTransfer, ClassificationSummary } from '../types';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';

export const useNodes = () => {
  const { addLog } = useLogger();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshNodes = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const fetchedNodes = await repository.getNodeTree();
      setNodes(fetchedNodes);
      addLog('DEBUG', 'Node tree refreshed from database.');
    } catch (error) {
      addLog('ERROR', `Failed to refresh nodes: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    refreshNodes();
  }, [refreshNodes]);

  const addNode = useCallback(async (node: Omit<Node, 'node_id' | 'sort_order' | 'created_at' | 'updated_at'>): Promise<Node> => {
    const newNode = await repository.addNode(node);
    addLog('INFO', `New ${node.node_type} created with title: "${node.title}"`);
    await refreshNodes(true); // Refresh to get correct sorting and structure
    return newNode;
  }, [addLog, refreshNodes]);

  const updateNode = useCallback(async (nodeId: string, updates: Partial<Pick<Node, 'title' | 'parent_id'> & { language_hint?: string | null; default_view_mode?: ViewMode | null }>) => {
    await repository.updateNode(nodeId, updates);
    addLog('DEBUG', `Node updated with ID: ${nodeId}. Refreshing tree.`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const deleteNode = useCallback(async (nodeId: string) => {
    await repository.deleteNode(nodeId);
    addLog('INFO', `Deleted node and its descendants starting from root ID: ${nodeId}`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const deleteNodes = useCallback(async (nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    await repository.deleteNodes(nodeIds);
    addLog('INFO', `Deleted ${nodeIds.length} node(s) and their descendants.`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const duplicateNodes = useCallback(async (nodeIds: string[]) => {
    await repository.duplicateNodes(nodeIds);
    addLog('INFO', `Duplicated ${nodeIds.length} item(s).`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const moveNodes = useCallback(async (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => {
    await repository.moveNodes(draggedIds, targetId, position);
    addLog('INFO', `Moved ${draggedIds.length} item(s).`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const updateDocumentContent = useCallback(async (nodeId: string, newContent: string): Promise<void> => {
    await repository.updateDocumentContent(nodeId, newContent);

    setNodes(currentNodes => {
      const updateNodeInTree = (nodes: Node[]): Node[] => {
        return nodes.map(node => {
          if (node.node_id === nodeId) {
            return {
              ...node,
              document: node.document ? { ...node.document, content: newContent } : undefined
            };
          }
          if (node.children) {
            return { ...node, children: updateNodeInTree(node.children) };
          }
          return node;
        });
      };
      return updateNodeInTree(currentNodes);
    });

    addLog('DEBUG', `Content for node ${nodeId} saved.`);
  }, [addLog]);

  const importFiles = useCallback(
    async (
      filesData: { path: string; name: string; content: string }[],
      targetParentId: string | null
    ): Promise<ImportedNodeSummary[]> => {
      return repository.importFiles(filesData, targetParentId);
    },
    []
  );

  const importNodesFromTransfer = useCallback(
    async (payload: DraggedNodeTransfer, targetId: string | null, position: 'before' | 'after' | 'inside') => {
      const createdIds = await repository.importNodesFromTransfer(payload, targetId, position);
      addLog('INFO', `Copied ${createdIds.length} item(s) from external workspace.`);
      await refreshNodes(true);
      return createdIds;
    },
    [addLog, refreshNodes]
  );

  const setNodeLock = useCallback(async (nodeId: string, locked: boolean) => {
    await repository.setNodeLock(nodeId, locked);
    addLog('DEBUG', `Set lock state for node ${nodeId} to ${locked ? 'locked' : 'unlocked'}.`);
    await refreshNodes(true);
  }, [addLog, refreshNodes]);

  const createDocumentFromClipboard = useCallback(async (
    payload: { parentId: string | null; content: string; title?: string | null }
  ): Promise<{ node: Node; summary: ClassificationSummary }> => {
    const result = await repository.createDocumentFromClipboard(payload);
    const summary = result.summary;
    addLog(
      'INFO',
      `Clipboard import classified as ${summary.docType}/${summary.languageHint ?? 'unknown'} (${summary.primaryMatch})`
    );
    if (summary.warnings.length > 0) {
      summary.warnings.forEach(warning => addLog('WARNING', warning));
    }
    await refreshNodes(true);
    return result;
  }, [addLog, refreshNodes]);

  return { nodes, isLoading, refreshNodes, addNode, updateNode, deleteNode, deleteNodes, moveNodes, updateDocumentContent, duplicateNodes, importFiles, importNodesFromTransfer, createDocumentFromClipboard, setNodeLock, addLog };
};

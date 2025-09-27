import { useState, useEffect, useCallback } from 'react';
import type { Node } from '../types';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';

export const useNodes = () => {
  const { addLog } = useLogger();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshNodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedNodes = await repository.getNodeTree();
      setNodes(fetchedNodes);
      addLog('DEBUG', 'Node tree refreshed from database.');
    } catch (error) {
      addLog('ERROR', `Failed to refresh nodes: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    refreshNodes();
  }, [refreshNodes]);

  const addNode = useCallback(async (node: Omit<Node, 'node_id' | 'sort_order' | 'created_at' | 'updated_at'>): Promise<Node> => {
    const newNode = await repository.addNode(node);
    addLog('INFO', `New ${node.node_type} created with title: "${node.title}"`);
    await refreshNodes(); // Refresh to get correct sorting and structure
    return newNode;
  }, [addLog, refreshNodes]);

  const updateNode = useCallback(async (nodeId: string, updates: Partial<Pick<Node, 'title' | 'parent_id'>>) => {
    await repository.updateNode(nodeId, updates);
    addLog('DEBUG', `Node updated with ID: ${nodeId}`);
    
    // Optimistic update for faster UI feedback on title change
    setNodes(prevNodes => {
        const updateRecursively = (items: Node[]): Node[] => {
            return items.map(item => {
                if (item.node_id === nodeId) {
                    return { ...item, ...updates };
                }
                if (item.children) {
                    return { ...item, children: updateRecursively(item.children) };
                }
                return item;
            });
        };
        return updateRecursively(prevNodes);
    });
    // Still refresh for structural changes or to ensure consistency
    if (updates.parent_id !== undefined) {
       await refreshNodes();
    }
  }, [addLog, refreshNodes]);

  const deleteNode = useCallback(async (nodeId: string) => {
    await repository.deleteNode(nodeId);
    addLog('INFO', `Deleted node and its descendants starting from root ID: ${nodeId}`);
    await refreshNodes();
  }, [addLog, refreshNodes]);

  const duplicateNodes = useCallback(async (nodeIds: string[]) => {
    await repository.duplicateNodes(nodeIds);
    addLog('INFO', `Duplicated ${nodeIds.length} item(s).`);
    await refreshNodes();
  }, [addLog, refreshNodes]);

  const moveNodes = useCallback(async (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => {
    await repository.moveNodes(draggedIds, targetId, position);
    addLog('INFO', `Moved ${draggedIds.length} item(s).`);
    await refreshNodes();
  }, [addLog, refreshNodes]);
  
  const updateDocumentContent = useCallback(async (nodeId: string, newContent: string): Promise<void> => {
      await repository.updateDocumentContent(nodeId, newContent);
      addLog('DEBUG', `Content for node ${nodeId} saved.`);
  }, [addLog]);

  return { nodes, isLoading, refreshNodes, addNode, updateNode, deleteNode, moveNodes, updateDocumentContent, duplicateNodes };
};
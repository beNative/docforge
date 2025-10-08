import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { repository } from '../services/repository';
import type { WorkspaceInfo } from '../types';
import { useWorkspaceEvents } from './useWorkspaceEvents';

type RefreshOptions = {
  silent?: boolean;
};

export const useWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshWorkspaces = useCallback(async (options: RefreshOptions = {}) => {
    const { silent = false } = options;
    if (!silent && isMountedRef.current) {
      setIsLoading(true);
    }

    try {
      const list = await repository.listWorkspaces();
      if (!isMountedRef.current) {
        return list;
      }
      setWorkspaces(list);
      setError(null);
      return list;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isMountedRef.current) {
        setError(message);
      }
      throw err;
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const activeWorkspaceId = useMemo(() => {
    const active = workspaces.find(workspace => workspace.isActive);
    return active ? active.workspaceId : null;
  }, [workspaces]);

  useEffect(() => {
    refreshWorkspaces().catch(() => {
      /* handled through error state */
    });
  }, [refreshWorkspaces]);

  useWorkspaceEvents(() => {
    refreshWorkspaces({ silent: true }).catch(() => {
      /* handled through error state */
    });
  }, [refreshWorkspaces]);

  const wrapOperation = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        const result = await operation();
        await refreshWorkspaces({ silent: true });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMountedRef.current) {
          setError(message);
        }
        throw err;
      }
    },
    [refreshWorkspaces],
  );

  const createWorkspace = useCallback(
    (name: string) => wrapOperation(() => repository.createWorkspace(name)),
    [wrapOperation],
  );

  const switchWorkspace = useCallback(
    (workspaceId: string) => wrapOperation(() => repository.switchWorkspace(workspaceId)),
    [wrapOperation],
  );

  const renameWorkspace = useCallback(
    (workspaceId: string, newName: string) => wrapOperation(() => repository.renameWorkspace(workspaceId, newName)),
    [wrapOperation],
  );

  const deleteWorkspace = useCallback(
    (workspaceId: string) => wrapOperation(() => repository.deleteWorkspace(workspaceId)),
    [wrapOperation],
  );

  const openWorkspaceConnection = useCallback(
    (workspaceId: string) => wrapOperation(() => repository.openWorkspaceConnection(workspaceId)),
    [wrapOperation],
  );

  const closeWorkspaceConnection = useCallback(
    (workspaceId: string) => wrapOperation(() => repository.closeWorkspaceConnection(workspaceId)),
    [wrapOperation],
  );

  const refreshWorkspaceConnection = useCallback(
    (workspaceId: string) => wrapOperation(() => repository.refreshWorkspaceConnection(workspaceId)),
    [wrapOperation],
  );

  return {
    workspaces,
    activeWorkspaceId,
    isLoading,
    error,
    refreshWorkspaces,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
    openWorkspaceConnection,
    closeWorkspaceConnection,
    refreshWorkspaceConnection,
  };
};

export type UseWorkspacesReturn = ReturnType<typeof useWorkspaces>;

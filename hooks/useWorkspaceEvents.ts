import { useEffect, type DependencyList } from 'react';
import type { WorkspaceConnectionEvent } from '../types';

export const useWorkspaceEvents = (
  handler: (event: WorkspaceConnectionEvent) => void,
  deps: DependencyList = [],
) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.dbOnWorkspaceEvent) {
      return;
    }
    const unsubscribe = window.electronAPI.dbOnWorkspaceEvent(handler);
    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

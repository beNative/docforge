import { useState, useCallback } from 'react';

export const useHistoryState = <T>(initialState: T) => {
  const [state, setStateInternal] = useState({
    history: [initialState],
    currentIndex: 0,
  });

  const { history, currentIndex } = state;

  // Fix: Add an optional `options` parameter to allow replacing the history stack.
  const setState = useCallback((newState: T | ((prevState: T) => T), options?: { history?: 'push' | 'replace' }) => {
    setStateInternal(prevState => {
      const resolvedState = typeof newState === 'function'
        ? (newState as (prevState: T) => T)(prevState.history[prevState.currentIndex])
        : newState;

      if (options?.history === 'replace') {
        return {
          history: [resolvedState],
          currentIndex: 0,
        };
      }

      if (resolvedState === prevState.history[prevState.currentIndex]) {
        return prevState; // No change
      }

      const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
      newHistory.push(resolvedState);
      return {
        history: newHistory,
        currentIndex: newHistory.length - 1,
      };
    });
  }, []); // Empty dependency array makes this function stable

  const undo = useCallback(() => {
    setStateInternal(prevState => (prevState.currentIndex > 0
      ? { ...prevState, currentIndex: prevState.currentIndex - 1 }
      : prevState));
  }, []); // Empty dependency array makes this function stable

  const redo = useCallback(() => {
    setStateInternal(prevState => (prevState.currentIndex < prevState.history.length - 1
      ? { ...prevState, currentIndex: prevState.currentIndex + 1 }
      : prevState));
  }, []); // Empty dependency array makes this function stable

  return {
    state: history[currentIndex],
    setState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
};

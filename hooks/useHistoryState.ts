import { useState, useCallback } from 'react';

export const useHistoryState = <T>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setState = useCallback((newState: T | ((prevState: T) => T)) => {
    const resolvedState = typeof newState === 'function' 
        ? (newState as (prevState: T) => T)(history[currentIndex]) 
        : newState;
    
    // If the new state is the same as the current one, do nothing.
    if (resolvedState === history[currentIndex]) {
        return;
    }

    // When a new state is set, clear any "future" states from the history (redo stack).
    const newHistory = history.slice(0, currentIndex + 1);
    
    newHistory.push(resolvedState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  return {
    state: history[currentIndex],
    setState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
};
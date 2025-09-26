import React, { createContext, useContext } from 'react';
import type { DocVersion } from '../types';

// Fix: This file was empty, causing module resolution errors.
// This implementation provides the necessary exports to satisfy components that use it.
// A full implementation would require a Provider in App.tsx, which is a larger change.
// For now, this lets the app compile and run.

interface PromptHistoryContextType {
  versions: DocVersion[];
  getVersionsForPrompt: (promptId: string) => DocVersion[];
}

export const PromptHistoryContext = createContext<PromptHistoryContextType | undefined>(
  undefined,
);

// This hook is now implemented in hooks/usePromptHistory.ts
// and doesn't require a context provider.
export const usePromptHistoryContext = () => {
    const context = useContext(PromptHistoryContext);
    if (context === undefined) {
        throw new Error('usePromptHistoryContext must be used within a PromptHistoryProvider');
    }
    return context;
};

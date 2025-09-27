import React, { createContext, useContext } from 'react';
import type { DocVersion } from '../types';

// Fix: This file was empty, causing module resolution errors.
// This implementation provides the necessary exports to satisfy components that use it.
// A full implementation would require a Provider in App.tsx, which is a larger change.
// For now, this lets the app compile and run.

interface DocumentHistoryContextType {
  versions: DocVersion[];
  getVersionsForDocument: (documentId: string) => DocVersion[];
}

export const DocumentHistoryContext = createContext<DocumentHistoryContextType | undefined>(
  undefined,
);

// This hook is now implemented in hooks/useDocumentHistory.ts
// and doesn't require a context provider.
export const useDocumentHistoryContext = () => {
    const context = useContext(DocumentHistoryContext);
    if (context === undefined) {
        throw new Error('useDocumentHistoryContext must be used within a DocumentHistoryProvider');
    }
    return context;
};
import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { LogLevel } from '../types';

interface UseDocumentAutoSaveOptions {
  documentId: string;
  content: string;
  title: string;
  isDirty: boolean;
  isSaving: boolean;
  onCommitVersion: (documentId: string, content: string) => Promise<void> | void;
  addLog: (level: LogLevel, message: string) => void;
  skipRef?: MutableRefObject<boolean>;
}

export const useDocumentAutoSave = ({
  documentId,
  content,
  title,
  isDirty,
  isSaving,
  onCommitVersion,
  addLog,
  skipRef,
}: UseDocumentAutoSaveOptions) => {
  const latestRef = useRef({ content, title, isDirty, isSaving });
  const localSkipRef = useRef(false);

  latestRef.current.content = content;
  latestRef.current.title = title;
  latestRef.current.isDirty = isDirty;
  latestRef.current.isSaving = isSaving;

  const skipNextAutoSave = useCallback(() => {
    localSkipRef.current = true;
    if (skipRef) {
      skipRef.current = true;
    }
  }, [skipRef]);

  useEffect(() => {
    return () => {
      if (skipRef?.current) {
        skipRef.current = false;
        return;
      }
      if (localSkipRef.current) {
        localSkipRef.current = false;
        return;
      }

      const snapshot = latestRef.current;
      if (!snapshot.isDirty || snapshot.isSaving) {
        return;
      }

      addLog('INFO', `Auto-saving changes for document "${snapshot.title}" before leaving.`);
      Promise.resolve(onCommitVersion(documentId, snapshot.content)).catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        addLog('ERROR', `Auto-save failed for document "${snapshot.title}": ${message}`);
      });
    };
  }, [documentId, onCommitVersion, addLog, skipRef]);

  return { skipNextAutoSave };
};
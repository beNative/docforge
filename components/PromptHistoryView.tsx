import React, { useState, useMemo, useRef, useEffect } from 'react';
// Fix: Import correct types. DocumentVersion is an alias for DocVersion now.
import type { DocumentOrFolder, DocumentVersion as Version } from '../types';
// Fix: Import the new standalone hook.
import { useDocumentHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import DiffViewer from './DiffViewer';
import { CheckIcon, CopyIcon, UndoIcon, ArrowLeftIcon, TrashIcon } from './Icons';
import IconButton from './IconButton';
import ConfirmModal from './ConfirmModal';

interface DocumentHistoryViewProps {
  document: DocumentOrFolder;
  onBackToEditor: () => void;
  onRestore: (content: string) => void;
}

const DocumentHistoryView: React.FC<DocumentHistoryViewProps> = ({ document, onBackToEditor, onRestore }) => {
  const { versions, deleteVersions } = useDocumentHistory(document.id);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<number>>(new Set());
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const versionsWithCurrent = useMemo(() => {
    const historyVersions = versions.map(v => ({
      ...v,
      id: String(v.version_id), 
      documentId: document.id, 
      createdAt: v.created_at 
    }));

    return [
      {
          id: 'current',
          documentId: document.id,
          content: document.content || '',
          createdAt: document.updatedAt,
          version_id: -1,
          document_id: -1,
          content_id: -1,
      },
      ...historyVersions
    ];
  }, [document, versions]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const selectedVersion = versionsWithCurrent[selectedIndex];
  const previousVersion = versionsWithCurrent[selectedIndex + 1];

  const handleCopy = async (content: string) => {
    try {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy content:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleToggleVersionSelection = (versionId: number) => {
    if (versionId === -1) return;
    setSelectedVersionIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(versionId)) {
            newSet.delete(versionId);
        } else {
            newSet.add(versionId);
        }
        return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    await deleteVersions(Array.from(selectedVersionIds));
    setSelectedVersionIds(new Set());
    setSelectedIndex(0); // Reset selection to current after delete
    setLastSelectedIndex(0);
    setIsConfirmingDelete(false);
  };

  const handleVersionClick = (e: React.MouseEvent, index: number) => {
    const versionId = versionsWithCurrent[index].version_id;
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isShift && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeIds = versionsWithCurrent.slice(start, end + 1)
            .map(v => v.version_id)
            .filter(id => id !== -1);
        setSelectedVersionIds(new Set(rangeIds));
    } else if (isCtrl) {
        handleToggleVersionSelection(versionId);
        setLastSelectedIndex(index);
    } else {
        setSelectedVersionIds(versionId !== -1 ? new Set([versionId]) : new Set());
        setLastSelectedIndex(index);
    }
    setSelectedIndex(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { key, shiftKey, metaKey, ctrlKey } = e;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlCmd = isMac ? metaKey : ctrlKey;

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = key === 'ArrowUp'
        ? Math.max(0, selectedIndex - 1)
        : Math.min(versionsWithCurrent.length - 1, selectedIndex + 1);

      if (shiftKey) {
        const anchor = lastSelectedIndex === null ? selectedIndex : lastSelectedIndex;
        const start = Math.min(anchor, newIndex);
        const end = Math.max(anchor, newIndex);
        const rangeIds = versionsWithCurrent.slice(start, end + 1)
          .map(v => v.version_id).filter(id => id !== -1);
        setSelectedVersionIds(new Set(rangeIds));
      } else {
        setSelectedVersionIds(new Set());
        setLastSelectedIndex(newIndex);
      }
      setSelectedIndex(newIndex);
    } else if (key === ' ') {
      e.preventDefault();
      handleToggleVersionSelection(versionsWithCurrent[selectedIndex].version_id);
    } else if (isCtrlCmd && (key === 'a' || key === 'A')) {
      e.preventDefault();
      const allIds = versionsWithCurrent.map(v => v.version_id).filter(id => id !== -1);
      setSelectedVersionIds(new Set(allIds));
    } else if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      if (selectedVersionIds.size > 0) {
        setIsConfirmingDelete(true);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
        <header className="flex justify-between items-center px-6 py-6 gap-4 flex-shrink-0 border-b border-border-color bg-secondary">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-text-main truncate">
                    History for "{document.title}"
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={onBackToEditor} variant="secondary">
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back to Editor
                </Button>
            </div>
        </header>

        <div className="flex-1 flex gap-6 overflow-hidden p-6 bg-secondary">
            <aside className="w-1/3 max-w-xs border-r border-border-color pr-6 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Versions</h3>
                    <Button 
                        variant="destructive" 
                        disabled={selectedVersionIds.size === 0}
                        onClick={() => setIsConfirmingDelete(true)}
                    >
                       <TrashIcon className="w-4 h-4 mr-2" />
                       Delete ({selectedVersionIds.size})
                    </Button>
                </div>
                <ul ref={listRef} onKeyDown={handleKeyDown} tabIndex={0} className="space-y-1 overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary rounded-md">
                    {versionsWithCurrent.map((version, index) => {
                        const isFocused = selectedIndex === index;
                        const isSelected = selectedVersionIds.has(version.version_id);
                        return (
                            <li key={version.id}>
                                <button
                                    onClick={(e) => handleVersionClick(e, index)}
                                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                                        isFocused
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : isSelected
                                        ? 'bg-border-color'
                                        : 'text-text-secondary hover:bg-border-color/50 hover:text-text-main'
                                    }`}
                                >
                                    <span className="block">{formatDate(version.createdAt)}</span>
                                    <span className="text-xs opacity-80">{index === 0 ? '(Current Version)' : `Version ${versionsWithCurrent.length - 1 - index}`}</span>
                                </button>
                            </li>
                        );
                    })}
                     {versionsWithCurrent.length <= 1 && (
                        <li className="text-sm text-text-secondary p-2 text-center">No history found.</li>
                    )}
                </ul>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold">Changes in this version</h3>
                        <p className="text-sm text-text-secondary">
                            {selectedIndex === versionsWithCurrent.length - 1 ? 'This is the first version.' : 'Compared to the previous version.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconButton onClick={() => handleCopy(selectedVersion.content)} tooltip={isCopied ? "Copied!" : "Copy Content"}>
                            {isCopied ? <CheckIcon className="w-5 h-5 text-success" /> : <CopyIcon className="w-5 h-5" />}
                        </IconButton>
                        <Button onClick={() => onRestore(selectedVersion.content)} disabled={selectedIndex === 0} variant="secondary">
                            <UndoIcon className="w-4 h-4 mr-2"/>
                            Restore this version
                        </Button>
                    </div>
                </div>
                
                <DiffViewer
                    oldText={previousVersion ? previousVersion.content : ''}
                    newText={selectedVersion.content}
                />
            </main>
        </div>
        {isConfirmingDelete && (
            <ConfirmModal
                title="Delete Versions"
                message={<>Are you sure you want to permanently delete {selectedVersionIds.size} version(s)? This action cannot be undone.</>}
                onConfirm={handleDeleteSelected}
                onCancel={() => setIsConfirmingDelete(false)}
            />
        )}
    </div>
  );
};

export default DocumentHistoryView;
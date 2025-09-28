import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { DocumentOrFolder } from '../types';
import { useDocumentHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import MonacoDiffEditor from './MonacoDiffEditor';
import { CheckIcon, CopyIcon, UndoIcon, ArrowLeftIcon, TrashIcon } from './Icons';
import IconButton from './IconButton';
import ConfirmModal from './ConfirmModal';
import { useLogger } from '../hooks/useLogger';

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
  const { addLog } = useLogger();
  
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
  
  const [compareAIndex, setCompareAIndex] = useState(0);
  const [compareBIndex, setCompareBIndex] = useState(versionsWithCurrent.length > 1 ? 1 : 0);

  const { newerVersion, olderVersion } = useMemo(() => {
    const newerIdx = Math.min(compareAIndex, compareBIndex);
    const olderIdx = Math.max(compareAIndex, compareBIndex);
    return { 
      newerVersion: versionsWithCurrent[newerIdx],
      olderVersion: versionsWithCurrent[olderIdx] || null
    };
  }, [compareAIndex, compareBIndex, versionsWithCurrent]);

  const handleCopy = async () => {
    if (!newerVersion) return;
    try {
        await navigator.clipboard.writeText(newerVersion.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy content:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleToggleVersionSelection = (versionId: number) => {
    if (versionId === -1) return; // Cannot select 'Current' for deletion
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
    setCompareAIndex(0); // Reset comparison to current
    setCompareBIndex(versionsWithCurrent.length > 1 ? 1 : 0);
    setIsConfirmingDelete(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
        <header className="flex justify-between items-center px-4 h-7 gap-4 flex-shrink-0 border-b border-border-color bg-secondary">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-sm font-semibold text-text-main truncate">
                    History for "{document.title}"
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <IconButton onClick={() => { addLog('INFO', `User action: Back to editor from history for document "${document.title}".`); onBackToEditor(); }} variant="ghost" size="sm" tooltip="Back to Editor">
                    <ArrowLeftIcon className="w-4 h-4" />
                </IconButton>
            </div>
        </header>

        <div className="flex-1 flex gap-4 overflow-hidden p-4 bg-secondary">
            <aside className="w-1/3 max-w-sm border-r border-border-color pr-4 flex flex-col">
                <div className="flex justify-between items-center mb-1.5 flex-shrink-0 h-7">
                    <h3 className="text-xs font-semibold px-1.5">Versions</h3>
                    <Button 
                        variant="destructive"
                        className="px-1.5 py-0.5 text-[11px]"
                        disabled={selectedVersionIds.size === 0}
                        onClick={() => {
                            addLog('INFO', `User action: Delete ${selectedVersionIds.size} version(s) for document "${document.title}".`);
                            setIsConfirmingDelete(true);
                        }}
                    >
                       <TrashIcon className="w-3 h-3 mr-1" />
                       Delete ({selectedVersionIds.size})
                    </Button>
                </div>
                <ul className="space-y-1 overflow-y-auto -mr-2 pr-2">
                    {versionsWithCurrent.map((version, index) => {
                        const isA = compareAIndex === index;
                        const isB = compareBIndex === index;
                        return (
                            <li key={version.id}>
                                <div className={`w-full text-left p-1 rounded-md transition-colors flex items-center justify-between ${isA || isB ? 'bg-primary/5' : 'hover:bg-border-color/20'}`}>
                                    <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          className="form-checkbox h-3 w-3 rounded-sm text-primary bg-background border-border-color focus:ring-primary disabled:opacity-50"
                                          checked={selectedVersionIds.has(version.version_id)}
                                          onChange={() => handleToggleVersionSelection(version.version_id)}
                                          disabled={version.version_id === -1}
                                        />
                                        <div>
                                            <span className="block text-[11px] font-medium text-text-main">{formatDate(version.createdAt)}</span>
                                            <span className="text-[10px] text-text-secondary">{index === 0 ? '(Current Version)' : `Version ${versionsWithCurrent.length - 1 - index}`}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => compareBIndex !== index && setCompareAIndex(index)} 
                                          title="Set as 'A' for comparison"
                                          className={`w-4 h-4 text-[10px] rounded-full font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-secondary ${isA ? 'bg-primary text-primary-text focus:ring-primary' : 'bg-border-color text-text-secondary hover:bg-border-color focus:ring-text-secondary'}`}
                                        >A</button>
                                        <button 
                                          onClick={() => compareAIndex !== index && setCompareBIndex(index)} 
                                          title="Set as 'B' for comparison"
                                          className={`w-4 h-4 text-[10px] rounded-full font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-secondary ${isB ? 'bg-destructive-bg text-destructive-text focus:ring-destructive-text' : 'bg-border-color text-text-secondary hover:bg-border-color focus:ring-text-secondary'}`}
                                        >B</button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                     {versionsWithCurrent.length <= 1 && (
                        <li className="text-xs text-text-secondary p-2 text-center">No history found.</li>
                    )}
                </ul>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-1.5 flex-shrink-0 h-7">
                    <div>
                        <h3 className="text-xs font-semibold">Comparison</h3>
                        <p className="text-[11px] text-text-secondary">
                           Comparing version from <span className="font-semibold text-text-main">{formatDate(newerVersion.createdAt)}</span> with <span className="font-semibold text-text-main">{olderVersion ? formatDate(olderVersion.createdAt) : 'None'}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconButton onClick={handleCopy} tooltip={isCopied ? "Copied!" : "Copy Newer Version Content"} size="sm">
                            {isCopied ? <CheckIcon className="w-4 h-4 text-success" /> : <CopyIcon className="w-4 h-4" />}
                        </IconButton>
                        <Button onClick={() => { addLog('INFO', `User action: Restore version for document "${document.title}".`); onRestore(newerVersion.content); }} disabled={newerVersion.version_id === -1} variant="secondary" className="px-1.5 py-0.5 text-[11px]">
                            <UndoIcon className="w-3 h-3 mr-1.5"/>
                            Restore Newer Version
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0">
                    <MonacoDiffEditor
                        oldText={olderVersion ? olderVersion.content : ''}
                        newText={newerVersion ? newerVersion.content : ''}
                        language={document.language_hint || 'plaintext'}
                    />
                </div>
            </main>
        </div>
        {isConfirmingDelete && (
            <ConfirmModal
                title="Delete Versions"
                message={<>Are you sure you want to permanently delete {selectedVersionIds.size} version(s)? This action cannot be undone.</>}
                onConfirm={() => {
                    addLog('INFO', 'User confirmed version deletion.');
                    handleDeleteSelected();
                }}
                onCancel={() => {
                    addLog('INFO', 'User cancelled version deletion.');
                    setIsConfirmingDelete(false);
                }}
            />
        )}
    </div>
  );
};

export default DocumentHistoryView;
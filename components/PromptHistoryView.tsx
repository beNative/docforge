import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { DocumentOrFolder, Settings } from '../types';
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
  settings: Settings;
}

const MIN_VERSIONS_PANEL_WIDTH = 240;
const MIN_COMPARISON_PANEL_WIDTH = 300;
const DEFAULT_VERSIONS_PANEL_WIDTH = 320;

const DocumentHistoryView: React.FC<DocumentHistoryViewProps> = ({ document, onBackToEditor, onRestore, settings }) => {
  const { versions, deleteVersions } = useDocumentHistory(document.id);
  const [isCopied, setIsCopied] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<number>>(new Set());
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { addLog } = useLogger();
  const listRef = useRef<HTMLUListElement>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [versionsPanelWidth, setVersionsPanelWidth] = useState(DEFAULT_VERSIONS_PANEL_WIDTH);
  const isResizing = useRef(false);
  const resizeStartInfo = useRef<{ startX: number; startWidth: number } | null>(null);
  
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
  const [diffRenderMode, setDiffRenderMode] = useState<'side-by-side' | 'inline'>('side-by-side');

  useEffect(() => {
    setFocusedIndex(0);
  }, [versions]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStartInfo.current = {
        startX: e.clientX,
        startWidth: versionsPanelWidth,
    };
    window.document.body.style.cursor = 'col-resize';
    window.document.body.style.userSelect = 'none';
  }, [versionsPanelWidth]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizing.current || !resizeStartInfo.current) return;

      const deltaX = e.clientX - resizeStartInfo.current.startX;
      const newWidth = resizeStartInfo.current.startWidth + deltaX;
      
      const maxWidth = window.innerWidth - MIN_COMPARISON_PANEL_WIDTH;
      const clampedWidth = Math.max(MIN_VERSIONS_PANEL_WIDTH, Math.min(newWidth, maxWidth));
      setVersionsPanelWidth(clampedWidth);
  }, []);
  
  const handleGlobalMouseUp = useCallback(() => {
      if (isResizing.current) {
          isResizing.current = false;
          resizeStartInfo.current = null;
          window.document.body.style.cursor = 'default';
          window.document.body.style.userSelect = 'auto';
      }
  }, []);

  useEffect(() => {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);


  const { newerVersion, olderVersion } = useMemo(() => {
    const newerIdx = Math.min(compareAIndex, compareBIndex);
    const olderIdx = Math.max(compareAIndex, compareBIndex);
    return { 
      newerVersion: versionsWithCurrent[newerIdx],
      olderVersion: versionsWithCurrent[olderIdx] || null
    };
  }, [compareAIndex, compareBIndex, versionsWithCurrent]);

  const focusedVersion = useMemo(() => versionsWithCurrent[focusedIndex], [focusedIndex, versionsWithCurrent]);
  const focusedContent = focusedVersion?.content ?? '';
  const newerContent = newerVersion?.content ?? '';
  const olderContent = olderVersion?.content ?? '';
  const newerCreatedAt = newerVersion ? formatDate(newerVersion.createdAt) : 'Unknown';
  const olderCreatedAt = olderVersion ? formatDate(olderVersion.createdAt) : 'None';

  const handleCopy = async () => {
    if (!focusedVersion) return;
    try {
        await navigator.clipboard.writeText(focusedContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy content:', err);
    }
  };

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

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
    setCompareAIndex(0);
    setCompareBIndex(versionsWithCurrent.length > 1 ? 1 : 0);
    setIsConfirmingDelete(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = versionsWithCurrent.length;
    if (totalItems === 0) return;

    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const focused = versionsWithCurrent[focusedIndex];
        if (focused) {
            handleToggleVersionSelection(focused.version_id);
        }
        return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        const newIndex = Math.max(0, Math.min(totalItems - 1, focusedIndex + direction));

        if (newIndex === focusedIndex) return;

        if (e.shiftKey) {
            const anchor = selectionAnchor ?? focusedIndex;
            if (selectionAnchor === null) {
              setSelectionAnchor(focusedIndex);
            }

            const start = Math.min(anchor, newIndex);
            const end = Math.max(anchor, newIndex);

            const newSelectedIds = new Set<number>();
            for (let i = start; i <= end; i++) {
                const version = versionsWithCurrent[i];
                if (version && version.version_id !== -1) {
                    newSelectedIds.add(version.version_id);
                }
            }
            setSelectedVersionIds(newSelectedIds);
        } else {
            setSelectionAnchor(newIndex);
        }

        setFocusedIndex(newIndex);
    }
  };

  useEffect(() => {
    const itemElement = listRef.current?.querySelector(`[data-index="${focusedIndex}"]`);
    itemElement?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
    });
  }, [focusedIndex]);
  
  useEffect(() => {
    setTimeout(() => {
        listRef.current?.focus();
    }, 100);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
        <header className="flex justify-between items-center px-4 h-7 gap-4 flex-shrink-0 border-b border-border-color bg-secondary">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-sm font-semibold text-text-main truncate">
                    History for "{document.title}"
                </h1>
            </div>
            <div className="flex items-center gap-1">
                <IconButton onClick={() => { addLog('INFO', `User action: Back to editor from history for document "${document.title}".`); onBackToEditor(); }} variant="ghost" size="xs" tooltip="Back to Editor">
                    <ArrowLeftIcon className="w-4 h-4" />
                </IconButton>
            </div>
        </header>

        <div className="flex-1 flex overflow-hidden bg-secondary">
            <aside style={{ width: `${versionsPanelWidth}px` }} className="flex flex-col flex-shrink-0 border-r border-border-color">
                <div className="flex justify-between items-center flex-shrink-0 h-7 px-4 border-b border-border-color">
                    <h3 className="text-xs font-semibold">Versions</h3>
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
                <div className="flex-1 overflow-y-auto p-2">
                    <ul ref={listRef} onKeyDown={handleKeyDown} tabIndex={0} className="space-y-1 focus:outline-none">
                        {versionsWithCurrent.map((version, index) => {
                            const isA = compareAIndex === index;
                            const isB = compareBIndex === index;
                            const isFocused = focusedIndex === index;
                            return (
                                <li key={version.id} data-index={index}>
                                    <div 
                                        onClick={() => {
                                        setFocusedIndex(index);
                                        setSelectionAnchor(index);
                                        }}
                                        className={`w-full text-left p-1 rounded-md transition-colors flex items-center justify-between cursor-pointer relative ${
                                            isA || isB ? 'bg-primary/5' : isFocused ? 'bg-border-color/30' : 'hover:bg-border-color/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                            type="checkbox"
                                            className="form-checkbox h-3 w-3 rounded-sm text-primary bg-background border-border-color focus:ring-primary disabled:opacity-50"
                                            checked={selectedVersionIds.has(version.version_id)}
                                            onChange={() => handleToggleVersionSelection(version.version_id)}
                                            disabled={version.version_id === -1}
                                            onClick={(e) => e.stopPropagation()}
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
                </div>
            </aside>
            <div onMouseDown={handleMouseDown} className="w-1.5 cursor-col-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200" />
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center flex-shrink-0 h-7 px-4 border-b border-border-color">
                    <div className="flex items-baseline gap-2 text-[11px] text-text-secondary flex-wrap">
                        <h3 className="text-xs font-semibold text-text-main m-0">Comparison</h3>
                        <span>Comparing A (<span className="font-semibold text-text-main">{newerCreatedAt}</span>) with B (<span className="font-semibold text-text-main">{olderCreatedAt}</span>)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5 bg-background border border-border-color rounded-md px-1 py-0.5">
                            <button
                                type="button"
                                onClick={() => setDiffRenderMode('side-by-side')}
                                className={`text-[11px] px-1.5 py-0.5 rounded ${diffRenderMode === 'side-by-side' ? 'bg-secondary text-primary font-semibold' : 'text-text-secondary hover:text-text-main'}`}
                            >
                                Split
                            </button>
                            <button
                                type="button"
                                onClick={() => setDiffRenderMode('inline')}
                                className={`text-[11px] px-1.5 py-0.5 rounded ${diffRenderMode === 'inline' ? 'bg-secondary text-primary font-semibold' : 'text-text-secondary hover:text-text-main'}`}
                            >
                                Inline
                            </button>
                        </div>
                        <IconButton onClick={handleCopy} tooltip={isCopied ? "Copied!" : "Copy Selected Version"} size="xs">
                            {isCopied ? <CheckIcon className="w-4 h-4 text-success" /> : <CopyIcon className="w-4 h-4" />}
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                addLog('INFO', `User action: Restore version for document "${document.title}".`);
                                onRestore(focusedContent);
                            }}
                            disabled={focusedIndex === 0}
                            tooltip="Restore Selected Version"
                            size="xs"
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <UndoIcon className="w-4 h-4" />
                        </IconButton>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0">
                    <MonacoDiffEditor
                        oldText={olderContent}
                        newText={newerContent}
                        language={document.language_hint || 'plaintext'}
                        renderMode={diffRenderMode}
                        readOnly
                        fontFamily={settings.editorFontFamily}
                        fontSize={settings.editorFontSize}
                        activeLineHighlightColorLight={settings.editorActiveLineHighlightColor}
                        activeLineHighlightColorDark={settings.editorActiveLineHighlightColorDark}
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
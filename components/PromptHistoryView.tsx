import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { DocumentOrFolder } from '../types';
import { usePromptHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import DiffViewer from './DiffViewer';
import { CheckIcon, CopyIcon, UndoIcon, ArrowLeftIcon, TrashIcon } from './Icons';
import IconButton from './IconButton';
import ConfirmModal from './ConfirmModal';
import ToggleSwitch from './ToggleSwitch';

interface PromptHistoryViewProps {
  prompt: DocumentOrFolder;
  onBackToEditor: () => void;
  onRestore: (content: string) => void;
}

const PromptHistoryView: React.FC<PromptHistoryViewProps> = ({ prompt, onBackToEditor, onRestore }) => {
  const { versions, deleteVersions } = usePromptHistory(prompt.id);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<number>>(new Set());
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const versionsWithCurrent = useMemo(() => {
    const historyVersions = versions.map(v => ({
      ...v,
      id: String(v.version_id), 
      promptId: prompt.id, 
      createdAt: v.created_at 
    }));

    return [
      {
          id: 'current',
          promptId: prompt.id,
          content: prompt.content || '',
          createdAt: prompt.updatedAt,
          version_id: -1,
          document_id: -1, // This is a client-side concept
          content_id: -1,
      },
      ...historyVersions
    ];
  }, [prompt, versions]);

  const [primarySelectedIndex, setPrimarySelectedIndex] = useState(0);
  const [secondarySelectedIndex, setSecondarySelectedIndex] = useState<number | null>(null);
  const [compareToCurrent, setCompareToCurrent] = useState(false);
  const [lastActionIndex, setLastActionIndex] = useState<number>(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const { oldVersion, newVersion, diffHeaderText } = useMemo(() => {
    let newV, oldV;
    let headerText;

    const getVersionName = (index: number) => {
      if (index === 0) return 'Current Version';
      return `Version ${versionsWithCurrent.length - 1 - index}`;
    };

    if (compareToCurrent) {
        newV = { content: prompt.content || '', createdAt: new Date().toISOString() };
        oldV = versionsWithCurrent[primarySelectedIndex];
        headerText = <>Comparing <strong>Current Editor Content</strong> vs. <strong>{getVersionName(primarySelectedIndex)}</strong></>;
    } else {
        newV = versionsWithCurrent[primarySelectedIndex];
        oldV = secondarySelectedIndex !== null 
            ? versionsWithCurrent[secondarySelectedIndex] 
            : versionsWithCurrent[primarySelectedIndex + 1];
        
        if (secondarySelectedIndex !== null) {
            headerText = <>Comparing <strong>{getVersionName(primarySelectedIndex)}</strong> vs. <strong>{getVersionName(secondarySelectedIndex)}</strong></>;
        } else {
            headerText = <>Changes in <strong>{getVersionName(primarySelectedIndex)}</strong></>;
        }
    }
    
    return { 
        oldVersion: oldV, 
        newVersion: newV,
        diffHeaderText
    };
}, [primarySelectedIndex, secondarySelectedIndex, compareToCurrent, versionsWithCurrent, prompt.content]);


  const handleCopy = async (content: string) => {
    if (!content) return;
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
    setPrimarySelectedIndex(0);
    setSecondarySelectedIndex(null);
    setLastActionIndex(0);
    setIsConfirmingDelete(false);
  };

  const handleVersionClick = (e: React.MouseEvent, index: number) => {
    const isCtrl = e.ctrlKey || e.metaKey;

    setCompareToCurrent(false);
    
    if (isCtrl) {
      if (index === primarySelectedIndex) return; // Can't compare a version to itself
      setSecondarySelectedIndex(prev => prev === index ? null : index);
    } else {
      setPrimarySelectedIndex(index);
      setSecondarySelectedIndex(null);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { key, shiftKey, metaKey, ctrlKey } = e;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlCmd = isMac ? metaKey : ctrlKey;

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = key === 'ArrowUp'
        ? Math.max(0, primarySelectedIndex - 1)
        : Math.min(versionsWithCurrent.length - 1, primarySelectedIndex + 1);

      setPrimarySelectedIndex(newIndex);
      setSecondarySelectedIndex(null); // Reset secondary selection on navigation
      setCompareToCurrent(false);

      if (shiftKey) {
        const start = Math.min(lastActionIndex, newIndex);
        const end = Math.max(lastActionIndex, newIndex);
        const rangeIds = versionsWithCurrent.slice(start, end + 1)
          .map(v => v.version_id).filter(id => id !== -1);
        setSelectedVersionIds(new Set(rangeIds));
      } else {
        setLastActionIndex(newIndex);
      }
    } else if (key === ' ') {
      e.preventDefault();
      handleToggleVersionSelection(versionsWithCurrent[primarySelectedIndex].version_id);
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
  
  const handleCompareToggle = (isChecked: boolean) => {
    setCompareToCurrent(isChecked);
    if (isChecked) {
        setSecondarySelectedIndex(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto h-full">
        <header className="flex justify-between items-center px-6 py-6 gap-4 flex-shrink-0 border-b border-border-color bg-secondary">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-text-main truncate">
                    History for "{prompt.title}"
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
                <ul ref={listRef} onKeyDown={handleKeyDown} tabIndex={0} className="space-y-1 overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary rounded-md p-1 -m-1">
                    {versionsWithCurrent.map((version, index) => {
                        const isPrimary = primarySelectedIndex === index;
                        const isSecondary = secondarySelectedIndex === index;
                        const isSelectedForDelete = selectedVersionIds.has(version.version_id);
                        
                        let bgClass = 'hover:bg-border-color/50 hover:text-text-main';
                        if (isPrimary) bgClass = 'bg-primary/10 text-primary font-semibold';
                        else if (isSelectedForDelete) bgClass = 'bg-border-color text-text-main';

                        return (
                            <li key={version.id}>
                                <button
                                    onClick={(e) => handleVersionClick(e, index)}
                                    className={`relative w-full text-left p-2 rounded-md text-sm transition-colors ${bgClass}`}
                                >
                                    {isSecondary && <div className="absolute inset-0 ring-2 ring-blue-500 rounded-md pointer-events-none"></div>}
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
                        <h3 className="text-lg font-semibold">{diffHeaderText}</h3>
                        <div className="flex items-center gap-3 mt-2">
                            <label htmlFor="compare-current-toggle" className="text-sm font-medium text-text-secondary">Compare to Current</label>
                            <ToggleSwitch id="compare-current-toggle" checked={compareToCurrent} onChange={handleCompareToggle} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconButton onClick={() => handleCopy(newVersion?.content || '')} tooltip={isCopied ? "Copied!" : "Copy Content"}>
                            {isCopied ? <CheckIcon className="w-5 h-5 text-success" /> : <CopyIcon className="w-5 h-5" />}
                        </IconButton>
                        <Button onClick={() => onRestore(newVersion.content)} disabled={primarySelectedIndex === 0 && !compareToCurrent} variant="secondary">
                            <UndoIcon className="w-4 h-4 mr-2"/>
                            Restore this version
                        </Button>
                    </div>
                </div>
                
                <DiffViewer
                    oldText={oldVersion?.content || ''}
                    newText={newVersion?.content || ''}
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

export default PromptHistoryView;

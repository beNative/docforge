import React, { useState, useMemo } from 'react';
// Fix: Import correct types. PromptVersion is an alias for DocVersion now.
import type { DocumentOrFolder, PromptVersion as Version } from '../types';
// Fix: Import the new standalone hook.
import { usePromptHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import DiffViewer from './DiffViewer';
import { CheckIcon, CopyIcon, UndoIcon, ArrowLeftIcon, TrashIcon } from './Icons';
import IconButton from './IconButton';
import ConfirmModal from './ConfirmModal';

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
          document_id: -1,
          content_id: -1,
      },
      ...historyVersions
    ];
  }, [prompt, versions]);

  const [selectedIndex, setSelectedIndex] = useState(0);

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
    setIsConfirmingDelete(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
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
                    {/* Fix: Removed invalid 'size' prop from Button component. */}
                    <Button 
                        variant="destructive" 
                        disabled={selectedVersionIds.size === 0}
                        onClick={() => setIsConfirmingDelete(true)}
                    >
                       <TrashIcon className="w-4 h-4 mr-2" />
                       Delete Selected
                    </Button>
                </div>
                <ul className="space-y-1 overflow-y-auto">
                    {versionsWithCurrent.map((version, index) => (
                    <li key={version.id} className="flex items-center gap-2">
                        {index > 0 && (
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={selectedVersionIds.has(version.version_id)}
                                onChange={() => handleToggleVersionSelection(version.version_id)}
                            />
                        )}
                        <button
                        onClick={() => setSelectedIndex(index)}
                        className={`w-full text-left p-2 rounded-md text-sm transition-colors ${index === 0 ? 'ml-6' : ''} ${
                            selectedIndex === index
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-text-secondary hover:bg-border-color/50 hover:text-text-main'
                        }`}
                        >
                        <span className="block">{formatDate(version.createdAt)}</span>
                        <span className="text-xs opacity-80">{index === 0 ? '(Current Version)' : `Version ${versionsWithCurrent.length - 1 - index}`}</span>
                        </button>
                    </li>
                    ))}
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

export default PromptHistoryView;
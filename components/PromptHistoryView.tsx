import React, { useState, useMemo } from 'react';
// Fix: Import correct types. PromptVersion is an alias for DocVersion now.
import type { DocumentOrFolder, PromptVersion as Version } from '../types';
// Fix: Import the new standalone hook.
import { usePromptHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import DiffViewer from './DiffViewer';
import { CheckIcon, CopyIcon, UndoIcon, ArrowLeftIcon } from './Icons';
import IconButton from './IconButton';

interface PromptHistoryViewProps {
  prompt: DocumentOrFolder;
  onBackToEditor: () => void;
  onRestore: (content: string) => void;
}

const PromptHistoryView: React.FC<PromptHistoryViewProps> = ({ prompt, onBackToEditor, onRestore }) => {
  const { versions } = usePromptHistory(prompt.id);
  const [isCopied, setIsCopied] = useState(false);
  
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
            <aside className="w-1/3 max-w-xs border-r border-border-color pr-6 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-3">Versions</h3>
                <ul className="space-y-1">
                    {versionsWithCurrent.map((version, index) => (
                    <li key={version.id}>
                        <button
                        onClick={() => setSelectedIndex(index)}
                        className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
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
    </div>
  );
};

export default PromptHistoryView;
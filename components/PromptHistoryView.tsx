import React, { useState, useMemo } from 'react';
import type { DocumentOrFolder } from '../types';
import { usePromptHistory } from '../hooks/usePromptHistory';
import Button from './Button';
import DiffViewer from './DiffViewer';
import { ArrowLeftIcon, CheckIcon, CopyIcon, UndoIcon } from './Icons';
import IconButton from './IconButton';

interface PromptHistoryViewProps {
  prompt: DocumentOrFolder;
  onBack: () => void;
  onRestore: (content: string) => void;
}

const PromptHistoryView: React.FC<PromptHistoryViewProps> = ({ prompt, onBack, onRestore }) => {
  const { versions } = usePromptHistory(prompt.id);
  const [isCopied, setIsCopied] = useState(false);
  
  const versionsWithCurrent = useMemo(() => [
    {
        id: 'current',
        promptId: prompt.id,
        content: prompt.content || '',
        createdAt: prompt.updatedAt,
        version_id: -1, document_id: -1, content_id: -1, // placeholders
    },
    ...versions.map(v => ({ ...v, id: String(v.version_id), promptId: prompt.id, createdAt: v.created_at }))
  ], [prompt, versions]);

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
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
        <header className="flex justify-between items-center px-6 py-4 border-b border-border-color flex-shrink-0">
            <div className="flex items-center gap-4">
                <IconButton onClick={onBack} tooltip="Back to Editor">
                    <ArrowLeftIcon />
                </IconButton>
                <h1 className="text-2xl font-semibold text-text-main truncate">
                    History for "{prompt.title}"
                </h1>
            </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
            <aside className="w-1/3 max-w-xs border-r border-border-color p-4 overflow-y-auto bg-secondary">
                <h3 className="text-lg font-semibold mb-3 px-2">Versions</h3>
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
                        <span className="text-xs opacity-80">{index === 0 ? '(Current)' : `Version ${versionsWithCurrent.length - 1 - index}`}</span>
                        </button>
                    </li>
                    ))}
                </ul>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold">Changes in this version</h3>
                        <p className="text-sm text-text-secondary">Compared to the previous version</p>
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
                
                <div className="flex-1 overflow-auto">
                    <DiffViewer
                        oldText={previousVersion ? previousVersion.content : ''}
                        newText={selectedVersion.content}
                    />
                </div>
            </main>
        </div>
    </div>
  );
};

export default PromptHistoryView;

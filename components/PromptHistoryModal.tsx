import React, { useState, useMemo } from 'react';
// Fix: Import correct types. DocumentVersion is an alias for DocVersion now.
import type { DocumentOrFolder, DocumentVersion as Version } from '../types';
// Fix: Import the new standalone hook.
import { useDocumentHistory } from '../hooks/usePromptHistory';
import Modal from './Modal';
import Button from './Button';
import MonacoDiffEditor from './MonacoDiffEditor';
import { CheckIcon, CopyIcon, UndoIcon } from './Icons';
import IconButton from './IconButton';

interface DocumentHistoryModalProps {
  document: DocumentOrFolder;
  onClose: () => void;
  onRestore: (content: string) => void;
}

const DocumentHistoryModal: React.FC<DocumentHistoryModalProps> = ({ document, onClose, onRestore }) => {
  const { versions } = useDocumentHistory(document.id);
  const [isCopied, setIsCopied] = useState(false);
  
  const versionsWithCurrent = useMemo(() => [
    {
        id: 'current',
        documentId: document.id,
        content: document.content || '',
        createdAt: document.updatedAt,
        version_id: -1,
        document_id: -1,
        content_id: -1,
    },
    ...versions.map(v => ({ ...v, id: String(v.version_id), documentId: document.id, createdAt: v.created_at }))
  ], [document, versions]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedVersion = versionsWithCurrent[selectedIndex];
  const previousVersion = versionsWithCurrent[selectedIndex + 1];
  const selectedVersionContent = selectedVersion?.content ?? '';
  const previousVersionContent = previousVersion?.content ?? '';

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
    <Modal onClose={onClose} title={`History for "${document.title}"`}>
      <div className="p-6 text-text-main flex gap-6 max-h-[80vh]">
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
          </ul>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold">Changes in this version</h3>
                    <p className="text-sm text-text-secondary">Compared to the previous version</p>
                </div>
                 <div className="flex items-center gap-2">
                    <IconButton onClick={() => handleCopy(selectedVersionContent)} tooltip={isCopied ? "Copied!" : "Copy Content"}>
                        {isCopied ? <CheckIcon className="w-5 h-5 text-success" /> : <CopyIcon className="w-5 h-5" />}
                    </IconButton>
                    <Button onClick={() => onRestore(selectedVersionContent)} disabled={selectedIndex === 0} variant="secondary">
                        <UndoIcon className="w-4 h-4 mr-2"/>
                        Restore this version
                    </Button>
                 </div>
            </div>
            
            <div className="flex-1 min-h-0">
              <MonacoDiffEditor
                  oldText={previousVersionContent}
                  newText={selectedVersionContent}
                  language={document.language_hint || 'plaintext'}
              />
            </div>
        </main>
      </div>
    </Modal>
  );
};

export default DocumentHistoryModal;
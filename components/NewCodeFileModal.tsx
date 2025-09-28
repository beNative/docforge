import React, { useState, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useLogger } from '../hooks/useLogger';

interface NewCodeFileModalProps {
  onCreate: (filename: string) => void;
  onClose: () => void;
}

const NewCodeFileModal: React.FC<NewCodeFileModalProps> = ({ onCreate, onClose }) => {
    const [filename, setFilename] = useState('');
    const createButtonRef = useRef<HTMLButtonElement>(null);
    const { addLog } = useLogger();

    const isFormValid = filename.trim() !== '' && filename.includes('.');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isFormValid) {
            onCreate(filename.trim());
            onClose();
        }
    };

    return (
        <Modal onClose={() => { addLog('INFO', 'User action: Canceled "New Code File" dialog.'); onClose(); }} title="Create New Code File" initialFocusRef={createButtonRef}>
            <form onSubmit={handleSubmit}>
                <div className="p-6 text-text-main space-y-4">
                    <div>
                        <label htmlFor="filename-input" className="block text-sm font-medium text-text-secondary mb-1">
                            Filename
                        </label>
                        <input
                            id="filename-input"
                            type="text"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            placeholder="e.g., script.js, styles.css"
                            className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                         <p className="text-xs text-text-secondary mt-2">
                            Please provide a full filename with an extension to determine the language for syntax highlighting.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
                    <Button onClick={onClose} variant="secondary" type="button">
                        Cancel
                    </Button>
                    <Button ref={createButtonRef} type="submit" variant="primary" disabled={!isFormValid}>
                        Create File
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default NewCodeFileModal;
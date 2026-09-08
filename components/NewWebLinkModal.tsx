import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useLogger } from '../hooks/useLogger';
import { getCleanTitleFromUrl } from './dragDropUtils';

interface NewWebLinkModalProps {
  onCreate: (url: string, title?: string) => void;
  onClose: () => void;
}

const NewWebLinkModal: React.FC<NewWebLinkModalProps> = ({ onCreate, onClose }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useLogger();

  const trimmedUrl = url.trim();
  const isValidUrl = trimmedUrl !== '' && (
    /^https?:\/\/\S+/i.test(trimmedUrl) ||
    /^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/\S*)?$/i.test(trimmedUrl) ||
    /^file:\/\/\S+/i.test(trimmedUrl)
  );

  // Auto-suggest title when URL changes if user hasn't manually typed a custom title
  useEffect(() => {
    if (!hasManuallyEditedTitle && trimmedUrl) {
      const candidateUrl = !/^https?:\/\//i.test(trimmedUrl) && !/^file:\/\//i.test(trimmedUrl)
        ? `http://${trimmedUrl}`
        : trimmedUrl;
      const cleanTitle = getCleanTitleFromUrl(candidateUrl);
      setTitle(cleanTitle);
    }
  }, [trimmedUrl, hasManuallyEditedTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidUrl) {
      let finalUrl = trimmedUrl;
      if (!/^https?:\/\//i.test(finalUrl) && !/^file:\/\//i.test(finalUrl)) {
        // Default to http for localhost/ip, https for domains
        if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i.test(finalUrl)) {
          finalUrl = `http://${finalUrl}`;
        } else {
          finalUrl = `https://${finalUrl}`;
        }
      }
      onCreate(finalUrl, title.trim() || undefined);
      onClose();
    }
  };

  return (
    <Modal
      onClose={() => {
        addLog('INFO', 'User action: Canceled "New Web Link" dialog.');
        onClose();
      }}
      title="Create New Web Link"
      initialFocusRef={urlInputRef}
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6 text-text-main space-y-4">
          <div>
            <label htmlFor="weblink-url-input" className="block text-sm font-medium text-text-secondary mb-1">
              Web Address (URL)
            </label>
            <input
              ref={urlInputRef}
              id="weblink-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. https://github.com or localhost:3000"
              className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
              autoFocus
            />
            <p className="text-xs text-text-secondary mt-1.5">
              Enter any web URL or local server address (e.g. http://localhost:5173).
            </p>
          </div>

          <div>
            <label htmlFor="weblink-title-input" className="block text-sm font-medium text-text-secondary mb-1">
              Title <span className="text-xs text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              id="weblink-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasManuallyEditedTitle(true);
              }}
              placeholder="Document title"
              className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button onClick={onClose} variant="secondary" type="button">
            Cancel
          </Button>
          <Button ref={createButtonRef} type="submit" variant="primary" disabled={!isValidUrl}>
            Create Link
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewWebLinkModal;

import React, { useRef, useState, useEffect } from 'react';
import Modal from '../Modal';
import Button from '../Button';

interface LinkModalProps {
    isOpen: boolean;
    initialUrl: string;
    onSubmit: (url: string) => void;
    onRemove: () => void;
    onClose: () => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({ isOpen, initialUrl, onSubmit, onRemove, onClose }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState(initialUrl);

    useEffect(() => {
        setUrl(initialUrl);
    }, [initialUrl]);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit(url);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <Modal onClose={onClose} title="Insert link" initialFocusRef={inputRef}>
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-3">
                    <label className="block text-sm font-semibold text-text-main" htmlFor="link-url-input">
                        Link URL
                    </label>
                    <input
                        id="link-url-input"
                        ref={inputRef}
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        required
                        value={url}
                        onChange={event => setUrl(event.target.value)}
                        className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="https://example.com"
                    />
                    <p className="text-xs text-text-secondary">
                        Enter a valid URL. If you omit the protocol, https:// will be added automatically.
                    </p>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" variant="secondary" onClick={onRemove}>
                        Remove link
                    </Button>
                    <Button type="submit">Save link</Button>
                </div>
            </form>
        </Modal>
    );
};

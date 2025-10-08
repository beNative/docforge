import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface WorkspaceFormModalProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  defaultValue?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

const WorkspaceFormModal: React.FC<WorkspaceFormModalProps> = ({
  isOpen,
  title,
  confirmLabel,
  defaultValue = '',
  onSubmit,
  onClose,
}) => {
  const [name, setName] = useState(defaultValue);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Modal onClose={onClose} title={title} initialFocusRef={confirmButtonRef}>
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-3">
          <label htmlFor="workspace-name" className="block text-sm font-medium text-text-secondary">
            Workspace name
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="My workspace"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button ref={confirmButtonRef} type="submit" variant="primary" disabled={name.trim().length === 0}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default WorkspaceFormModal;

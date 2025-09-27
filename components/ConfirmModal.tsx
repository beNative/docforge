import React, { useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { WarningIcon } from './Icons';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'destructive';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive',
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal onClose={onCancel} title={title} initialFocusRef={confirmButtonRef}>
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-warning/10 text-warning rounded-full flex items-center justify-center">
              <WarningIcon className="w-6 h-6" />
            </div>
            <div className="text-sm text-text-secondary pt-1">
              {message}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button onClick={onCancel} variant="secondary" type="button">
            {cancelText}
          </Button>
          <Button ref={confirmButtonRef} type="submit" variant={confirmVariant}>
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ConfirmModal;
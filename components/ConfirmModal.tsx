import React from 'react';
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
  return (
    <Modal onClose={onCancel} title={title}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-warning/10 text-warning rounded-full flex items-center justify-center">
            <WarningIcon className="w-6 h-6" />
          </div>
          <div className="text-sm text-text-secondary pt-1">
            {message}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={onCancel} variant="secondary">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant={confirmVariant}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;

import React from 'react';
import Modal from './Modal';
import Button from './Button';

interface InfoModalProps {
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const InfoModal: React.FC<InfoModalProps> = ({ title, message, onClose, primaryAction }) => {
  return (
    <Modal onClose={onClose} title={title}>
      <div className="p-6 text-sm text-text-secondary space-y-4">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
        <Button onClick={onClose} variant="secondary" type="button">
          Close
        </Button>
        {primaryAction && (
          <Button
            onClick={() => {
              primaryAction.onClick();
            }}
            variant="primary"
            type="button"
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default InfoModal;

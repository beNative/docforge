import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { XIcon } from './Icons';
import IconButton from './IconButton';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

const Modal: React.FC<ModalProps> = ({ onClose, children, title, initialFocusRef }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Effect for focus trapping
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      const modalNode = modalRef.current;
      if (!modalNode) return;

      // Prioritize the explicitly passed ref for initial focus
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        // Fallback: find all focusable elements and focus the first one
        const focusableElements = modalNode.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }, 0); // Use a timeout to ensure the DOM is ready for focus

    // Focus trapping logic for Tab key
    const modalNode = modalRef.current;
    if (!modalNode) return () => clearTimeout(focusTimer);
    
    const focusableElements = modalNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return () => clearTimeout(focusTimer);

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else { // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    modalNode.addEventListener('keydown', handleTabKey);

    return () => {
        clearTimeout(focusTimer);
        if (modalNode) {
            modalNode.removeEventListener('keydown', handleTabKey);
        }
    };
  }, [onClose, initialFocusRef]);

  const modalContent = (
    <div
      className="fixed inset-0 bg-modal-backdrop flex items-center justify-center z-40"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        className="bg-secondary rounded-lg shadow-xl w-full max-w-xl mx-4 border border-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-color">
          <h2 className="text-lg font-semibold text-text-main">{title}</h2>
          <IconButton onClick={onClose} tooltip="Close" size="sm" variant="ghost" className="-mr-2">
            <XIcon className="w-5 h-5" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  return ReactDOM.createPortal(modalContent, overlayRoot);
};

export default Modal;
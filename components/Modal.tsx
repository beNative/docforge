import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

const Modal: React.FC<ModalProps> = ({ onClose, children, title }) => {
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
    const modalNode = modalRef.current;
    if (!modalNode) return;

    // Find all focusable elements within the modal
    const focusableElements = modalNode.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const autoFocusElement = modalNode.querySelector<HTMLElement>('[autoFocus]');

    // Focus the element with autoFocus, otherwise fall back to the first focusable element.
    if (autoFocusElement) {
      autoFocusElement.focus();
    } else if (firstElement) {
        firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !lastElement || !firstElement) return;

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
    
    // We attach the listener to the modal node itself. It will catch bubbling keydown events.
    modalNode.addEventListener('keydown', handleTabKey);

    return () => {
        if (modalNode) {
            modalNode.removeEventListener('keydown', handleTabKey);
        }
    };
  }, []); // Empty array ensures this runs once when the modal mounts

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
          <button onClick={onClose} className="text-text-secondary hover:text-text-main text-2xl leading-none">&times;</button>
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
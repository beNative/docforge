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
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    return () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        // Delay focus restoration to ensure the modal has been fully removed from the DOM.
        window.setTimeout(() => {
          previouslyFocusedElement.focus();
        }, 0);
      }
    };
  }, []);

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

  // Effect for setting initial focus - RUNS ONLY ONCE
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
    }, 50); // Small delay to ensure render

    return () => clearTimeout(focusTimer);
  }, []); // Empty dependency array ensures this runs only on mount

  // Effect for focus trapping (Tab key)
  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modalNode = modalRef.current;
      if (!modalNode) return;

      // Re-query focusable elements every time Tab is pressed to handle dynamic content changes
      const focusableElements = modalNode.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

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

    // Attach listener to the specific modal node if possible, or window/document if needed for trapping.
    // Attaching to modalNode is better for containment, but we need to ensure the modal has focus.
    // For a robust trap, listening on the modal node is good IF the focus is inside.
    const modalNode = modalRef.current;
    if (modalNode) {
      modalNode.addEventListener('keydown', handleTabKey);
    }

    return () => {
      if (modalNode) {
        modalNode.removeEventListener('keydown', handleTabKey);
      }
    };
  }, []); // Run once to attach handlers

  const modalContent = (
    <div
      className="fixed inset-0 bg-modal-backdrop flex items-center justify-center z-40"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        className="bg-secondary rounded-sm w-full max-w-xl mx-4 border border-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-border-color">
          <h2 className="text-base font-semibold text-text-main">{title}</h2>
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
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export type MenuItem = {
  label: string;
  action: () => void;
  icon?: React.FC<{ className?: string }>;
  disabled?: boolean;
  shortcut?: string;
} | { type: 'separator' };

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            onClose();
        }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  
  const menuStyle: React.CSSProperties = {
    top: position.y,
    left: position.x,
  };

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="fixed z-50 w-56 rounded-md bg-secondary p-1.5 shadow-2xl border border-border-color animate-fade-in-fast"
    >
      <ul className="space-y-1">
        {/* Fix: Restructured the type guard to check for a property on the desired object type directly, which ensures proper type narrowing for the MenuItem union. */}
        {items.map((item, index) => {
          if ('label' in item) {
            const { label, action, icon: Icon, disabled, shortcut } = item;

            return (
              <li key={label}>
                <button
                  onClick={() => { if(!disabled) { action(); onClose(); } }}
                  disabled={disabled}
                  className="w-full flex items-center justify-between text-left px-2 py-1.5 text-xs rounded-md transition-colors text-text-main disabled:text-text-secondary/50 disabled:cursor-not-allowed hover:bg-primary hover:text-primary-text focus:bg-primary focus:text-primary-text focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{label}</span>
                  </div>
                  {shortcut && <span className="text-xs text-text-secondary">{shortcut}</span>}
                </button>
              </li>
            );
          } else {
            return <li key={`separator-${index}`} className="h-px bg-border-color my-1.5" />;
          }
        })}
      </ul>
      <style>{`
        @keyframes fade-in-fast {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-fast {
            animation: fade-in-fast 0.1s ease-out forwards;
        }
      `}</style>
    </div>,
    overlayRoot
  );
};

export default ContextMenu;
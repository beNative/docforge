import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export type MenuItem =
  | {
      label: string;
      action?: () => void;
      icon?: React.FC<{ className?: string }>;
      disabled?: boolean;
      shortcut?: string;
      children?: MenuItem[];
    }
  | { type: 'separator' };

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}

const EDGE_MARGIN = 8;

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<{ depth: number; index: number } | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; maxHeight: number; overflowY: React.CSSProperties['overflowY'] }>({
    top: position.y,
    left: position.x,
    maxHeight: 0,
    overflowY: 'visible',
  });

  const recalculatePosition = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    const maxHeight = Math.max(innerHeight - EDGE_MARGIN * 2, 0);

    let left = rect.left;
    let top = rect.top;

    if (rect.right > innerWidth - EDGE_MARGIN) {
      left = Math.max(EDGE_MARGIN, innerWidth - rect.width - EDGE_MARGIN);
    }
    if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    }

    if (rect.bottom > innerHeight - EDGE_MARGIN) {
      top = Math.max(EDGE_MARGIN, innerHeight - rect.height - EDGE_MARGIN);
    }
    if (top < EDGE_MARGIN) {
      top = EDGE_MARGIN;
    }

    const overflowY: React.CSSProperties['overflowY'] = rect.height > maxHeight ? 'auto' : 'visible';

    setMenuStyle((previous) => {
      if (
        previous.top === top &&
        previous.left === left &&
        previous.maxHeight === maxHeight &&
        previous.overflowY === overflowY
      ) {
        return previous;
      }

      return {
        top,
        left,
        maxHeight,
        overflowY,
      };
    });
  }, []);

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

  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    setMenuStyle((previous) => {
      if (previous.top === position.y && previous.left === position.x) {
        return previous;
      }

      return {
        top: position.y,
        left: position.x,
        maxHeight: previous.maxHeight,
        overflowY: previous.overflowY,
      };
    });

    const frame = requestAnimationFrame(() => {
      recalculatePosition();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, position.x, position.y, recalculatePosition]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => {
      recalculatePosition();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, items, recalculatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      recalculatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, recalculatePosition]);

  if (!isOpen) return null;

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  const renderMenuItems = (menuItems: MenuItem[], depth = 0) => (
    <ul className="space-y-1">
      {menuItems.map((item, index) => {
        if ('type' in item) {
          return <li key={`separator-${depth}-${index}`} className="h-px bg-border-color my-1.5" />;
        }

        const { label, action, icon: Icon, disabled, shortcut, children } = item;
        const hasChildren = Array.isArray(children) && children.length > 0;
        const isSubmenuActive = activeSubmenu?.depth === depth && activeSubmenu.index === index;

        return (
          <li
            key={`${label}-${depth}-${index}`}
            className="relative"
            onMouseEnter={() => setActiveSubmenu({ depth, index })}
            onMouseLeave={() => setActiveSubmenu(prev => (prev?.depth === depth && prev.index === index ? null : prev))}
          >
            <button
              onClick={() => {
                if (!disabled && action && !hasChildren) {
                  action();
                  onClose();
                }
              }}
              disabled={disabled}
              className="w-full flex items-center justify-between text-left px-2 py-1.5 text-xs rounded-md transition-colors text-text-main disabled:text-text-secondary/50 disabled:cursor-not-allowed hover:bg-primary hover:text-primary-text focus:bg-primary focus:text-primary-text focus:outline-none"
            >
              <div className="flex items-center gap-3">
                {Icon && <Icon className="w-4 h-4" />}
                <span>{label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                {shortcut && <span>{shortcut}</span>}
                {hasChildren && <span aria-hidden="true">›</span>}
              </div>
            </button>
            {hasChildren && isSubmenuActive && (
              <div className="absolute top-0 left-full ml-1">
                <div className="w-[16rem] rounded-md bg-secondary p-1.5 shadow-2xl border border-border-color animate-fade-in-fast">
                  {renderMenuItems(children, depth + 1)}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        top: menuStyle.top,
        left: menuStyle.left,
        maxHeight: menuStyle.maxHeight ? menuStyle.maxHeight : undefined,
        overflowY: menuStyle.overflowY,
      }}
      className="fixed z-50 w-[16.8rem] rounded-md bg-secondary p-1.5 shadow-2xl border border-border-color animate-fade-in-fast"
    >
      {renderMenuItems(items)}
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
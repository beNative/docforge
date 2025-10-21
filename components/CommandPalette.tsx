import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { Command } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  targetRef: React.RefObject<HTMLElement>;
  searchTerm: string;
  onExecute: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands, targetRef, searchTerm, onExecute }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const paletteRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredCommands = useMemo(() => {
    const sorted = [...commands].sort((a, b) => a.category.localeCompare(b.category));
    if (!searchTerm.trim()) {
      return sorted;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return sorted.filter(
      (command) =>
        command.name.toLowerCase().includes(lowercasedTerm) ||
        command.keywords?.toLowerCase().includes(lowercasedTerm)
    );
  }, [commands, searchTerm]);

  // Reset index when search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && targetRef.current) {
      const zoomFactor = parseFloat((getComputedStyle(document.documentElement) as any).zoom || '1');
      const targetEl = targetRef.current;
      
      // Use a hybrid approach for robustness under CSS zoom.
      // getBoundingClientRect for position (is scaled by zoom).
      // offsetWidth for dimensions (is true layout value, not scaled).
      const scaledTargetRect = targetEl.getBoundingClientRect();
      
      const top = (scaledTargetRect.bottom / zoomFactor) + 4;
      const left = scaledTargetRect.left / zoomFactor;
      const width = targetEl.offsetWidth;

      setStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
      });
    }
  }, [isOpen, targetRef]);


  // Scroll the selected item into view
  useEffect(() => {
    if (isOpen && listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands, isOpen]);

  // Handle closing on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(event.target as Node) && targetRef.current && !targetRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, targetRef]);

  // Handle keyboard navigation (listens on the window when open)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (filteredCommands.length === 0 && !['Escape', 'Enter'].includes(e.key)) return;

        switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
            break;
        case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            break;
        case 'Enter': {
            e.preventDefault();
            const command = filteredCommands[selectedIndex];
            if (command) {
                command.action();
                onExecute();
            }
            break;
        }
        case 'Escape':
            e.preventDefault();
            onClose();
            break;
        default:
            break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [isOpen, onClose, onExecute, filteredCommands, selectedIndex]);

  const renderCommands = () => {
    let lastCategory: string | undefined = undefined;

    return filteredCommands.map((command, index) => {
      const categoryHeader = command.category !== lastCategory ? (
          <li key={`category-${command.category}`} className="text-xs font-semibold text-text-secondary uppercase px-2 pt-3 pb-1.5 sticky top-0 bg-secondary">
            {command.category}
          </li>
        ) : null;
        lastCategory = command.category;
      
      const isSelected = selectedIndex === index;

      return (
        <React.Fragment key={command.id}>
            {categoryHeader}
            <li
            data-index={index}
            onClick={() => {
                command.action();
                onExecute();
            }}
            className={`flex items-center justify-between px-2 py-1.5 mx-1 rounded-md cursor-pointer text-xs ${
                isSelected ? 'bg-primary text-primary-text' : 'text-text-main hover:bg-border-color/50'
            }`}
            >
            <div className="flex items-center gap-3">
                <command.icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-primary-text/90' : 'text-text-secondary'}`} />
                <span className="truncate">{command.name}</span>
            </div>
            {command.shortcutString && (
              <kbd className={`px-1.5 py-0.5 text-xs rounded font-sans transition-colors ${isSelected ? 'bg-primary/80 text-primary-text' : 'bg-border-color text-text-secondary'}`}>
                {command.shortcutString}
              </kbd>
            )}
            </li>
        </React.Fragment>
      );
    });
  };

  const overlayRoot = document.getElementById('overlay-root');
  if (!isOpen || !targetRef.current || !overlayRoot) {
    return null;
  }

  const paletteContent = (
    <div
      ref={paletteRef}
      style={style}
      className="bg-secondary rounded-lg shadow-2xl border border-border-color flex flex-col overflow-hidden max-h-[60vh] z-50 animate-fade-in"
    >
      <ul ref={listRef} className="flex-1 overflow-y-auto py-2">
        {filteredCommands.length > 0 ? (
          renderCommands()
        ) : (
          <li className="p-6 text-center text-sm text-text-secondary">No matching commands found.</li>
        )}
      </ul>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.1s ease-out forwards;
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(paletteContent, overlayRoot);
};

export default CommandPalette;
import React, { useState, useEffect, useRef } from 'react';
import type { Command } from '../types';
import { formatShortcutForDisplay } from '../services/shortcutService';

interface KeybindingInputProps {
  onSet: (shortcut: string[]) => void;
  onCancel: () => void;
  conflict: Command | null;
  focusBoundaryRef?: React.RefObject<HTMLElement>;
}

export const KeybindingInput: React.FC<KeybindingInputProps> = ({ onSet, onCancel, conflict, focusBoundaryRef }) => {
  const [keys, setKeys] = useState<string[]>([]);
  const fallbackBoundaryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Backspace' || e.key === 'Delete') {
        setKeys([]);
        onSet([]);
        onCancel();
        return;
      }

      const newKeys: string[] = [];
      if (e.ctrlKey) newKeys.push('Control');
      if (e.metaKey) newKeys.push('Meta');
      if (e.altKey) newKeys.push('Alt');
      if (e.shiftKey) newKeys.push('Shift');

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
        newKeys.push(key);
        onSet(newKeys);
        onCancel(); // Close input after setting
      } else {
        setKeys(newKeys);
      }
    };

    const handleBlur = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget as Node | null;
      const boundary = focusBoundaryRef?.current ?? fallbackBoundaryRef.current;
      if (nextTarget && boundary?.contains(nextTarget)) {
        return;
      }
      onCancel();
    };

    const inputEl = inputRef.current;
    if (inputEl) {
      inputEl.focus();
      inputEl.addEventListener('keydown', handleKeyDown);
      inputEl.addEventListener('blur', handleBlur);
    }

    return () => {
      if (inputEl) {
        inputEl.removeEventListener('keydown', handleKeyDown);
        inputEl.removeEventListener('blur', handleBlur);
      }
    };
  }, [onSet, onCancel, focusBoundaryRef]);

  return (
    <div ref={fallbackBoundaryRef} className="flex flex-col items-end">
      <div
        ref={inputRef}
        tabIndex={0}
        className={`flex items-center h-8 px-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          conflict ? 'border-destructive-border' : 'border-border-color'
        }`}
      >
        <span className="text-text-secondary">
          {keys.length > 0 ? formatShortcutForDisplay(keys) : 'Press desired keys...'}
        </span>
      </div>
      {conflict && (
        <p className="text-xs text-destructive-text mt-1">
          Conflicts with: "{conflict.name}"
        </p>
      )}
    </div>
  );
};

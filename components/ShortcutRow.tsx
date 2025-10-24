import React, { useState, useMemo, useRef } from 'react';
import type { Settings, Command } from '../types';
import { PencilIcon, UndoIcon, TrashIcon, XIcon } from './Icons';
import IconButton from './IconButton';
import { KeybindingInput } from './KeybindingInput';
import { Keycap } from './Keycap';
import { formatShortcutForDisplay } from '../services/shortcutService';

interface ShortcutRowProps {
  command: Command;
  commands: Command[];
  settings: Settings;
  setCurrentSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const ShortcutRow: React.FC<ShortcutRowProps> = ({ command, commands, settings, setCurrentSettings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [conflict, setConflict] = useState<Command | null>(null);
  const editorBoundaryRef = useRef<HTMLDivElement>(null);

  const customShortcut = settings.customShortcuts[command.id];
  const effectiveShortcut = useMemo(
    () => (customShortcut !== undefined ? customShortcut : command.shortcut),
    [customShortcut, command.shortcut]
  );
  const hasShortcut = !!(effectiveShortcut && effectiveShortcut.length > 0);
  const isCustomized = customShortcut !== undefined;

  const handleShortcutChange = (newShortcut: string[]) => {
    const newShortcutString = newShortcut.join('+');
    let conflictingCommand: Command | null = null;

    for (const cmd of commands) {
      if (cmd.id === command.id) continue;

      const custom = settings.customShortcuts[cmd.id];
      const effective = custom !== undefined ? custom : cmd.shortcut;

      if (effective && effective.join('+') === newShortcutString) {
        conflictingCommand = cmd;
        break;
      }
    }

    setConflict(conflictingCommand);

    setCurrentSettings(prev => {
      const newCustomShortcuts = { ...prev.customShortcuts };
      newCustomShortcuts[command.id] = newShortcut;
      return { ...prev, customShortcuts: newCustomShortcuts };
    });
  };

  const handleReset = () => {
    setCurrentSettings(prev => {
      const newCustomShortcuts = { ...prev.customShortcuts };
      delete newCustomShortcuts[command.id];
      return { ...prev, customShortcuts: newCustomShortcuts };
    });
    setConflict(null);
    setIsEditing(false);
  };

  const handleClear = () => {
    handleShortcutChange([]);
    setIsEditing(false);
  };

  const toggleEditing = () => {
    if (isEditing) {
      setIsEditing(false);
      setConflict(null);
    } else {
      setIsEditing(true);
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-1.5">
      <IconButton
        onClick={toggleEditing}
        tooltip={isEditing ? 'Cancel Editing' : 'Edit Shortcut'}
        size="sm"
        variant="ghost"
      >
        {isEditing ? <XIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
      </IconButton>
      {isCustomized && (
        <IconButton onClick={handleReset} tooltip="Reset to Default" size="sm" variant="ghost">
          <UndoIcon className="w-4 h-4" />
        </IconButton>
      )}
      <IconButton
        onClick={handleClear}
        tooltip="Clear Shortcut"
        size="sm"
        variant="ghost"
        disabled={!hasShortcut}
      >
        <TrashIcon className="w-4 h-4" />
      </IconButton>
    </div>
  );

  return (
    <div className={`flex items-center justify-between px-2 py-1 rounded-md transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-border-color/30'}`}>
      <span className="text-xs text-text-main flex-1">{command.name}</span>
      <div className="flex items-center gap-2" ref={editorBoundaryRef}>
        {isEditing ? (
          <KeybindingInput
            onSet={handleShortcutChange}
            onCancel={() => {
              setIsEditing(false);
              setConflict(null);
            }}
            conflict={conflict}
            focusBoundaryRef={editorBoundaryRef}
          />
        ) : (
          <div className="flex items-center gap-1.5 h-8">
            {hasShortcut && effectiveShortcut ? (
              <Keycap>{formatShortcutForDisplay(effectiveShortcut)}</Keycap>
            ) : (
              <span className="text-xs text-text-secondary px-2">Not set</span>
            )}
          </div>
        )}
        {actionButtons}
      </div>
    </div>
  );
};

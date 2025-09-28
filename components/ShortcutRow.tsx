import React, { useState, useMemo } from 'react';
import type { Settings, Command } from '../types';
import { PencilIcon, UndoIcon } from './Icons';
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

  const customShortcut = settings.customShortcuts[command.id];
  const effectiveShortcut = useMemo(() => customShortcut !== undefined ? customShortcut : command.shortcut, [customShortcut, command.shortcut]);
  const isCustomized = customShortcut !== undefined;

  const handleShortcutChange = (newShortcut: string[]) => {
    // Find if the new shortcut conflicts with any other command
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

    // Update settings if no conflict or if user confirms override (implicit for now)
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
  };
  
  return (
    <div className={`flex items-center justify-between p-2 rounded-md transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-border-color/30'}`}>
      <span className="text-sm text-text-main flex-1">{command.name}</span>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <KeybindingInput
            onSet={handleShortcutChange}
            onCancel={() => setIsEditing(false)}
            conflict={conflict}
          />
        ) : (
          <>
            <div className="flex items-center gap-1.5 h-8">
              {effectiveShortcut && effectiveShortcut.length > 0 ? (
                <Keycap>{formatShortcutForDisplay(effectiveShortcut)}</Keycap>
              ) : (
                <span className="text-xs text-text-secondary px-2">Not set</span>
              )}
            </div>
            <IconButton onClick={() => setIsEditing(true)} tooltip="Edit Shortcut" size="sm" variant="ghost">
              <PencilIcon className="w-4 h-4" />
            </IconButton>
            {isCustomized && (
              <IconButton onClick={handleReset} tooltip="Reset to Default" size="sm" variant="ghost">
                <UndoIcon className="w-4 h-4" />
              </IconButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};
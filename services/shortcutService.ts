import type { Command, Settings } from '../types';

export interface ShortcutLikeEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Formats a keyboard event into a consistent string representation.
 * e.g., "Control+Shift+P"
 */
export const formatShortcut = (e: ShortcutLikeEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  
  // Add the main key, avoiding modifiers
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
    parts.push(key);
  }
  
  return parts.join('+');
};

export const matchesShortcut = (
  event: ShortcutLikeEvent,
  shortcut?: string[],
  options?: { allowExtraShift?: boolean }
): boolean => {
  if (!shortcut || shortcut.length === 0) {
    return false;
  }

  const expected = shortcut.join('+');
  const actual = formatShortcut(event);
  if (actual === expected) {
    return true;
  }

  if (options?.allowExtraShift && event.shiftKey && !shortcut.includes('Shift')) {
    const withoutShift = formatShortcut({ ...event, shiftKey: false });
    return withoutShift === expected;
  }

  return false;
};

/**
 * Formats an array of keys into a user-friendly, compact display string.
 * e.g., ["Control", "N"] -> "Ctrl+N"
 */
export const formatShortcutForDisplay = (keys: string[]): string => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const formattedKeys = keys.map(key => {
        if (isMac) {
            switch (key) {
                case 'Control': return '⌃';
                case 'Meta': return '⌘';
                case 'Alt': return '⌥';
                case 'Shift': return '⇧';
                default: return key.toUpperCase();
            }
        } else {
            switch (key) {
                case 'Control': return 'Ctrl';
                case 'Meta': return 'Win';
                case 'Alt': return 'Alt';
                case 'Shift': return 'Shift';
                default: return key.toUpperCase();
            }
        }
    });
    return formattedKeys.join('+');
};


/**
 * Builds a map from a shortcut string to a Command object.
 * This map is used for efficient lookup in the keydown event handler.
 */
export const getShortcutMap = (
  commands: Command[], 
  customShortcuts: Settings['customShortcuts']
): Map<string, Command> => {
  const shortcutMap = new Map<string, Command>();

  for (const command of commands) {
    const custom = customShortcuts[command.id];
    const shortcutKeys = custom !== undefined ? custom : command.shortcut;

    if (shortcutKeys && shortcutKeys.length > 0) {
      const shortcutString = shortcutKeys.join('+');
      shortcutMap.set(shortcutString, command);
    }
  }

  return shortcutMap;
};
import type { Command, Settings } from '../../types';

export interface MonacoKeybindingDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultShortcut: string[];
  monacoCommandId: string;
  keywords?: string;
}

export const MONACO_KEYBINDING_DEFINITIONS: MonacoKeybindingDefinition[] = [
  {
    id: 'monaco.toggleLineComment',
    name: 'Toggle Line Comment',
    description: 'Add or remove line comments for the current selection.',
    category: 'Basic Editing',
    defaultShortcut: ['Control', '/'],
    monacoCommandId: 'editor.action.commentLine',
    keywords: 'comment code',
  },
  {
    id: 'monaco.toggleBlockComment',
    name: 'Toggle Block Comment',
    description: 'Wrap the current selection with block comment markers.',
    category: 'Basic Editing',
    defaultShortcut: ['Shift', 'Alt', 'A'],
    monacoCommandId: 'editor.action.blockComment',
    keywords: 'comment block',
  },
  {
    id: 'monaco.insertLineBelow',
    name: 'Insert Line Below',
    description: 'Insert a new line below the current line.',
    category: 'Basic Editing',
    defaultShortcut: ['Control', 'Enter'],
    monacoCommandId: 'editor.action.insertLineAfter',
    keywords: 'newline below',
  },
  {
    id: 'monaco.insertLineAbove',
    name: 'Insert Line Above',
    description: 'Insert a new line above the current line.',
    category: 'Basic Editing',
    defaultShortcut: ['Control', 'Shift', 'Enter'],
    monacoCommandId: 'editor.action.insertLineBefore',
    keywords: 'newline above',
  },
  {
    id: 'monaco.moveLineUp',
    name: 'Move Line Up',
    description: 'Move the current line or selection one line up.',
    category: 'Line Operations',
    defaultShortcut: ['Alt', 'ArrowUp'],
    monacoCommandId: 'editor.action.moveLinesUpAction',
    keywords: 'line up',
  },
  {
    id: 'monaco.moveLineDown',
    name: 'Move Line Down',
    description: 'Move the current line or selection one line down.',
    category: 'Line Operations',
    defaultShortcut: ['Alt', 'ArrowDown'],
    monacoCommandId: 'editor.action.moveLinesDownAction',
    keywords: 'line down',
  },
  {
    id: 'monaco.copyLineUp',
    name: 'Copy Line Up',
    description: 'Duplicate the current line or selection above.',
    category: 'Line Operations',
    defaultShortcut: ['Shift', 'Alt', 'ArrowUp'],
    monacoCommandId: 'editor.action.copyLinesUpAction',
    keywords: 'duplicate up',
  },
  {
    id: 'monaco.copyLineDown',
    name: 'Copy Line Down',
    description: 'Duplicate the current line or selection below.',
    category: 'Line Operations',
    defaultShortcut: ['Shift', 'Alt', 'ArrowDown'],
    monacoCommandId: 'editor.action.copyLinesDownAction',
    keywords: 'duplicate down',
  },
  {
    id: 'monaco.deleteLine',
    name: 'Delete Line',
    description: 'Delete the current line.',
    category: 'Line Operations',
    defaultShortcut: ['Control', 'Shift', 'K'],
    monacoCommandId: 'editor.action.deleteLines',
    keywords: 'remove line',
  },
  {
    id: 'monaco.cursorAbove',
    name: 'Add Cursor Above',
    description: 'Add an additional cursor above the current cursor.',
    category: 'Multi-Cursor',
    defaultShortcut: ['Control', 'Alt', 'ArrowUp'],
    monacoCommandId: 'editor.action.insertCursorAbove',
    keywords: 'multi cursor',
  },
  {
    id: 'monaco.cursorBelow',
    name: 'Add Cursor Below',
    description: 'Add an additional cursor below the current cursor.',
    category: 'Multi-Cursor',
    defaultShortcut: ['Control', 'Alt', 'ArrowDown'],
    monacoCommandId: 'editor.action.insertCursorBelow',
    keywords: 'multi cursor',
  },
  {
    id: 'monaco.addSelectionNextMatch',
    name: 'Add Next Occurrence',
    description: 'Add the next occurrence of the current selection.',
    category: 'Multi-Cursor',
    defaultShortcut: ['Control', 'D'],
    monacoCommandId: 'editor.action.addSelectionToNextFindMatch',
    keywords: 'multi cursor next',
  },
  {
    id: 'monaco.selectHighlights',
    name: 'Select All Occurrences',
    description: 'Select all occurrences of the current selection.',
    category: 'Multi-Cursor',
    defaultShortcut: ['Control', 'Shift', 'L'],
    monacoCommandId: 'editor.action.selectHighlights',
    keywords: 'multi cursor all',
  },
  {
    id: 'monaco.selectLine',
    name: 'Select Current Line',
    description: 'Select the entire current line.',
    category: 'Selection',
    defaultShortcut: ['Control', 'L'],
    monacoCommandId: 'expandLineSelection',
    keywords: 'select line',
  },
  {
    id: 'monaco.formatDocument',
    name: 'Format Document (Editor)',
    description: 'Format the entire document from within the editor.',
    category: 'Formatting',
    defaultShortcut: ['Shift', 'Alt', 'F'],
    monacoCommandId: 'editor.action.formatDocument',
    keywords: 'format beautify',
  },
];

export const resolveMonacoShortcut = (settings: Settings, definition: MonacoKeybindingDefinition): string[] => {
  const custom = settings.customShortcuts[definition.id];
  return custom && custom.length > 0 ? custom : definition.defaultShortcut;
};

export const getMonacoDefinition = (id: string): MonacoKeybindingDefinition | undefined => {
  return MONACO_KEYBINDING_DEFINITIONS.find(definition => definition.id === id);
};

export const createMonacoCommands = (): Command[] => {
  return MONACO_KEYBINDING_DEFINITIONS.map((definition) => {
    const command: Command = {
      id: definition.id,
      name: definition.name,
      action: () => {},
      category: definition.category,
      icon: () => null,
      shortcut: definition.defaultShortcut,
      monacoCommandId: definition.monacoCommandId,
    };
    if (definition.keywords) {
      command.keywords = definition.keywords;
    }
    return command;
  });
};


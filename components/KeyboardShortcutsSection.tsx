import React, { useState, useMemo } from 'react';
import type { Settings, Command } from '../types';
import { SearchIcon } from './Icons';
import { ShortcutRow } from './ShortcutRow';
import { Keycap } from './Keycap';
import { formatShortcutForDisplay } from '../services/shortcutService';

// --- Editor Shortcuts Data & Read-Only Component ---

interface EditorShortcut {
    description: string;
    keys: string[];
}

const editorShortcutGroups: { category: string; shortcuts: EditorShortcut[] }[] = [
    {
        category: 'Basic Editing',
        shortcuts: [
            { description: 'Cut line (empty selection)', keys: ['Control', 'X'] },
            { description: 'Copy line (empty selection)', keys: ['Control', 'C'] },
            { description: 'Delete line', keys: ['Control', 'Shift', 'K'] },
            { description: 'Insert line below', keys: ['Control', 'Enter'] },
            { description: 'Insert line above', keys: ['Control', 'Shift', 'Enter'] },
            { description: 'Move line up', keys: ['Alt', 'ArrowUp'] },
            { description: 'Move line down', keys: ['Alt', 'ArrowDown'] },
            { description: 'Copy line up', keys: ['Shift', 'Alt', 'ArrowUp'] },
            { description: 'Copy line down', keys: ['Shift', 'Alt', 'ArrowDown'] },
            { description: 'Undo', keys: ['Control', 'Z'] },
            { description: 'Redo', keys: ['Control', 'Y'] },
            { description: 'Toggle line comment', keys: ['Control', '/'] },
            { description: 'Toggle block comment', keys: ['Shift', 'Alt', 'A'] },
        ]
    },
    {
        category: 'Multi-Cursor and Selection',
        shortcuts: [
            { description: 'Insert cursor above', keys: ['Control', 'Alt', 'ArrowUp'] },
            { description: 'Insert cursor below', keys: ['Control', 'Alt', 'ArrowDown'] },
            { description: 'Add next occurrence to selection', keys: ['Control', 'D'] },
            { description: 'Select current line', keys: ['Control', 'L'] },
            { description: 'Select all occurrences of selection', keys: ['Control', 'Shift', 'L'] },
        ]
    },
    {
        category: 'Navigation',
        shortcuts: [
            { description: 'Go to File...', keys: ['Control', 'P'] },
            { description: 'Go to beginning of file', keys: ['Control', 'Home'] },
            { description: 'Go to end of file', keys: ['Control', 'End'] },
            { description: 'Go to definition', keys: ['F12'] },
        ]
    },
];

const ReadOnlyShortcutRow: React.FC<{ description: string; keys: string[] }> = ({ description, keys }) => (
  <div className="flex items-center justify-between px-2 py-1 rounded-md">
    <span className="text-xs text-text-main flex-1">{description}</span>
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 h-8">
        <Keycap>{formatShortcutForDisplay(keys)}</Keycap>
      </div>
    </div>
  </div>
);


interface KeyboardShortcutsSectionProps {
    settings: Settings;
    setCurrentSettings: React.Dispatch<React.SetStateAction<Settings>>;
    commands: Command[];
    sectionRef: (el: HTMLDivElement | null) => void;
}

const KeyboardShortcutsSection: React.FC<KeyboardShortcutsSectionProps> = ({ settings, setCurrentSettings, commands, sectionRef }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAndGroupedCommands = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        
        const filtered = commands.filter(command => {
            const customShortcut = settings.customShortcuts[command.id];
            const effectiveShortcut = customShortcut !== undefined ? customShortcut : command.shortcut;
            const shortcutString = effectiveShortcut ? effectiveShortcut.join('+').toLowerCase() : '';

            return command.name.toLowerCase().includes(lowercasedTerm) || shortcutString.includes(lowercasedTerm);
        });

        // FIX: The `reduce` method was causing a type error. This has been resolved by explicitly typing the accumulator and the initial value.
        return filtered.reduce((acc: Record<string, Command[]>, command) => {
            const category = command.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(command);
            return acc;
        }, {} as Record<string, Command[]>);
    }, [commands, searchTerm, settings.customShortcuts]);

    const filteredEditorShortcuts = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        if (!lowercasedTerm) {
            return editorShortcutGroups;
        }

        return editorShortcutGroups.map(group => ({
            ...group,
            shortcuts: group.shortcuts.filter(shortcut =>
                shortcut.description.toLowerCase().includes(lowercasedTerm) ||
                shortcut.keys.join('+').toLowerCase().includes(lowercasedTerm)
            )
        })).filter(group => group.shortcuts.length > 0);
    }, [searchTerm]);

    const hasAppResults = Object.keys(filteredAndGroupedCommands).length > 0;
    const hasEditorResults = filteredEditorShortcuts.length > 0;

    return (
        <div id="shortcuts" ref={sectionRef} className="py-6">
            <h2 className="text-lg font-semibold text-text-main mb-1">Keyboard Shortcuts</h2>
            <p className="text-xs text-text-secondary mb-4">Customize keyboard shortcuts for application actions.</p>
            
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 py-3 -my-3">
                 <div className="relative">
                    <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by command or keybinding..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-secondary border border-border-color rounded-md pl-9 pr-3 py-1.5 text-xs text-text-main focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary"
                    />
                </div>
            </div>

            <div className="mt-6 space-y-6">
                {/* FIX: Replaced `Object.entries` with `Object.keys` to avoid potential type issues with older TypeScript configurations where `Object.entries` might not be defined. */}
                {hasAppResults && Object.keys(filteredAndGroupedCommands).map(category => {
                    const cmds = filteredAndGroupedCommands[category];
                    return (
                        <div key={category}>
                            <h3 className="text-base font-semibold text-text-main mb-3">{category}</h3>
                            <div>
                                {cmds.map(command => (
                                    <ShortcutRow
                                        key={command.id}
                                        command={command}
                                        commands={commands}
                                        settings={settings}
                                        setCurrentSettings={setCurrentSettings}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {hasEditorResults && (
                <div className="mt-8 pt-6 border-t border-border-color">
                    <h2 className="text-lg font-semibold text-text-main mb-1">Editor Keybindings</h2>
                    <p className="text-xs text-text-secondary mb-4">These are common shortcuts for the text editor and are not customizable here.</p>
                    <div className="space-y-6">
                        {filteredEditorShortcuts.map(group => (
                            <div key={group.category}>
                                <h3 className="text-base font-semibold text-text-main mb-3">{group.category}</h3>
                                <div>
                                    {group.shortcuts.map(shortcut => (
                                        <ReadOnlyShortcutRow
                                            key={shortcut.description}
                                            description={shortcut.description}
                                            keys={shortcut.keys}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!hasAppResults && !hasEditorResults && (
                <p className="text-center text-text-secondary py-8">No shortcuts found for "{searchTerm}".</p>
            )}
        </div>
    );
};

export default KeyboardShortcutsSection;
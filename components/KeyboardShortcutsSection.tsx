import React, { useState, useMemo } from 'react';
import type { Settings, Command } from '../types';
import { SearchIcon } from './Icons';
import { ShortcutRow } from './ShortcutRow';
import { createMonacoCommands } from '../services/editor/monacoKeybindings';

interface KeyboardShortcutsSectionProps {
    settings: Settings;
    setCurrentSettings: React.Dispatch<React.SetStateAction<Settings>>;
    commands: Command[];
    sectionRef: (el: HTMLDivElement | null) => void;
}

const KeyboardShortcutsSection: React.FC<KeyboardShortcutsSectionProps> = ({ settings, setCurrentSettings, commands, sectionRef }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const editorCommands = useMemo(() => createMonacoCommands(), []);
    const combinedCommands = useMemo(() => [...commands, ...editorCommands], [commands, editorCommands]);

    const filterCommands = (items: Command[]) => {
        const lowercasedTerm = searchTerm.toLowerCase();
        if (!lowercasedTerm) {
            return items;
        }

        return items.filter(command => {
            const customShortcut = settings.customShortcuts[command.id];
            const effectiveShortcut = customShortcut !== undefined ? customShortcut : command.shortcut;
            const shortcutString = effectiveShortcut ? effectiveShortcut.join('+').toLowerCase() : '';
            const keywords = command.keywords?.toLowerCase() ?? '';

            return (
                command.name.toLowerCase().includes(lowercasedTerm) ||
                shortcutString.includes(lowercasedTerm) ||
                keywords.includes(lowercasedTerm)
            );
        });
    };

    const filteredAppCommands = useMemo(() => filterCommands(commands), [commands, searchTerm, settings.customShortcuts]);
    const filteredEditorCommands = useMemo(() => filterCommands(editorCommands), [editorCommands, searchTerm, settings.customShortcuts]);

    const groupedAppCommands = useMemo(() => {
        return filteredAppCommands.reduce((acc: Record<string, Command[]>, command) => {
            const category = command.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(command);
            return acc;
        }, {} as Record<string, Command[]>);
    }, [filteredAppCommands]);

    const groupedEditorCommands = useMemo(() => {
        return filteredEditorCommands.reduce((acc: Record<string, Command[]>, command) => {
            const category = command.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(command);
            return acc;
        }, {} as Record<string, Command[]>);
    }, [filteredEditorCommands]);

    const hasAppResults = Object.keys(groupedAppCommands).length > 0;
    const hasEditorResults = Object.keys(groupedEditorCommands).length > 0;

    return (
        <div id="shortcuts" ref={sectionRef} className="py-6">
            <h2 className="text-lg font-semibold text-text-main mb-1">Keyboard Shortcuts</h2>
            <p className="text-xs text-text-secondary mb-4">Customize shortcuts for application commands and Monaco editor keybindings.</p>
            
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
                {hasAppResults && Object.keys(groupedAppCommands).map(category => {
                    const cmds = groupedAppCommands[category];
                    return (
                        <div key={`app-${category}`}>
                            <h3 className="text-base font-semibold text-text-main mb-3">{category}</h3>
                            <div>
                                {cmds.map(command => (
                                    <ShortcutRow
                                        key={command.id}
                                        command={command}
                                        commands={combinedCommands}
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
                    <p className="text-xs text-text-secondary mb-4">Tailor Monaco editor commands to match your preferred shortcuts.</p>
                    <div className="space-y-6">
                        {Object.keys(groupedEditorCommands).map(category => {
                            const cmds = groupedEditorCommands[category];
                            return (
                                <div key={`editor-${category}`}>
                                    <h3 className="text-base font-semibold text-text-main mb-3">{category}</h3>
                                    <div>
                                        {cmds.map(command => (
                                            <ShortcutRow
                                                key={command.id}
                                                command={command}
                                                commands={combinedCommands}
                                                settings={settings}
                                                setCurrentSettings={setCurrentSettings}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
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

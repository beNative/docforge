import React, { useState, useMemo } from 'react';
import type { Settings, Command } from '../types';
import { SearchIcon } from './Icons';
import { ShortcutRow } from './ShortcutRow';

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

        // Fix: Explicitly type the generic for the 'reduce' method to ensure correct type inference.
        return filtered.reduce<Record<string, Command[]>>((acc, command) => {
            const category = command.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(command);
            return acc;
        }, {});
    }, [commands, searchTerm, settings.customShortcuts]);

    return (
        <div id="shortcuts" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-2">Keyboard Shortcuts</h2>
            <p className="text-sm text-text-secondary mb-6">Customize keyboard shortcuts for all actions.</p>
            
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 py-3 -my-3">
                 <div className="relative">
                    <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by command or keybinding..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-secondary border border-border-color rounded-md pl-9 pr-3 py-2 text-sm text-text-main focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary"
                    />
                </div>
            </div>

            <div className="mt-6 space-y-6">
                {Object.entries(filteredAndGroupedCommands).map(([category, cmds]) => (
                    <div key={category}>
                        <h3 className="text-base font-semibold text-text-main mb-3">{category}</h3>
                        <div className="space-y-2">
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
                ))}
                {Object.keys(filteredAndGroupedCommands).length === 0 && (
                    <p className="text-center text-text-secondary py-8">No shortcuts found for "{searchTerm}".</p>
                )}
            </div>
        </div>
    );
};

export default KeyboardShortcutsSection;
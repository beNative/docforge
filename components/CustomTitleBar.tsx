import React, { useState, useEffect, useCallback } from 'react';
import IconButton from './IconButton';
import { GearIcon, InfoIcon, CommandIcon, TerminalIcon, SearchIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon, PencilIcon } from './Icons';
import ThemeToggleButton from './ThemeToggleButton';
import { useLogger } from '../hooks/useLogger';

// info

interface CustomTitleBarProps {
  onToggleSettingsView: () => void;
  onToggleInfoView: () => void;
  onShowEditorView: () => void;
  onToggleLogger: () => void;
  onOpenCommandPalette: () => void;
  isInfoViewActive: boolean;
  isSettingsViewActive: boolean;
  isEditorViewActive: boolean;
  commandPaletteTargetRef: React.RefObject<HTMLDivElement>;
  commandPaletteInputRef: React.RefObject<HTMLInputElement>;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

interface CommandPaletteSearchProps {
    commandPaletteTargetRef: React.RefObject<HTMLDivElement>;
    inputRef: React.RefObject<HTMLInputElement>;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    onOpenCommandPalette: () => void;
}

const CommandPaletteSearch: React.FC<CommandPaletteSearchProps> = ({ 
    commandPaletteTargetRef, inputRef, searchTerm, onSearchTermChange, onOpenCommandPalette 
}) => (
    <div 
        ref={commandPaletteTargetRef}
        className="not-draggable flex-1 max-w-lg mx-auto h-8 px-3 rounded-md bg-background border border-border-color hover:border-primary/50 flex items-center gap-2 relative"
    >
        <SearchIcon className="w-4 h-4 text-text-secondary" />
        <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onFocus={onOpenCommandPalette}
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-secondary focus:outline-none"
        />
        <span className="text-xs text-text-secondary bg-border-color/50 px-1.5 py-0.5 rounded">Ctrl+Shift+P</span>
    </div>
);

const WindowControls: React.FC<{ platform: string, isMaximized: boolean }> = ({ platform, isMaximized }) => {
  const { addLog } = useLogger();
  // Fix: Use optional chaining, which is now type-safe.
  const handleMinimize = () => { addLog('INFO', 'User action: Minimize window.'); window.electronAPI?.minimizeWindow(); };
  const handleMaximize = () => { addLog('INFO', `User action: ${isMaximized ? 'Restore' : 'Maximize'} window.`); window.electronAPI?.maximizeWindow(); };
  const handleClose = () => { addLog('INFO', 'User action: Close window.'); window.electronAPI?.closeWindow(); };

  // Fix: Check for electronAPI existence.
  if (!window.electronAPI) return null;

  const buttonClass = "not-draggable w-12 h-8 flex items-center justify-center transition-colors hover:bg-border-color/50 focus:outline-none";
  const closeButtonClass = `${buttonClass} hover:bg-red-500 hover:text-white`;

  const controls = (
    <div className="flex items-center">
      <button onClick={handleMinimize} className={buttonClass}><MinimizeIcon className="w-4 h-4" /></button>
      <button onClick={handleMaximize} className={buttonClass}>
        {isMaximized ? <RestoreIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
      </button>
      <button onClick={handleClose} className={closeButtonClass}><CloseIcon className="w-4 h-4" /></button>
    </div>
  );

  return <>{controls}</>;
};

const CustomTitleBar: React.FC<CustomTitleBarProps> = ({ 
    onToggleSettingsView, onToggleInfoView, onShowEditorView, onToggleLogger, onOpenCommandPalette, 
    isInfoViewActive, isSettingsViewActive, isEditorViewActive, commandPaletteTargetRef, commandPaletteInputRef, searchTerm, onSearchTermChange
}) => {
    const [platform, setPlatform] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // Fix: Use optional chaining.
        if (window.electronAPI) {
            window.electronAPI.getPlatform().then(setPlatform);
            const cleanup = window.electronAPI.onWindowStateChange((state) => {
                setIsMaximized(state.isMaximized);
            });
            return cleanup;
        }
    }, []);
    
    return (
        <header className="draggable flex items-center justify-between h-10 flex-shrink-0 bg-secondary border-b border-border-color z-30 text-text-main">
            <div className={`flex items-center flex-1 ${platform === 'darwin' ? 'pl-20' : 'pl-2'}`}>
                <TerminalIcon className="w-5 h-5 text-primary mr-2" />
                <span className="font-semibold text-sm">DocForge</span>
            </div>

            <div className="flex-1 flex justify-center">
                <CommandPaletteSearch 
                    commandPaletteTargetRef={commandPaletteTargetRef}
                    inputRef={commandPaletteInputRef}
                    searchTerm={searchTerm}
                    onSearchTermChange={onSearchTermChange}
                    onOpenCommandPalette={onOpenCommandPalette}
                />
            </div>

            <div className="flex items-center gap-1 flex-1 justify-end">
                <IconButton onClick={onShowEditorView} tooltip="Editor" size="sm" className={`not-draggable ${isEditorViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
                    <PencilIcon className="w-5 h-5" />
                </IconButton>
                <IconButton onClick={onToggleInfoView} tooltip="Info" size="sm" className={`not-draggable ${isInfoViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
                    <InfoIcon className="w-5 h-5" />
                </IconButton>
                <IconButton onClick={onToggleLogger} tooltip="Logs" size="sm" className="not-draggable" tooltipPosition="bottom">
                    <TerminalIcon className="w-5 h-5" />
                </IconButton>
                <ThemeToggleButton size="sm" tooltipPosition="bottom" className="not-draggable" />
                <IconButton onClick={onToggleSettingsView} tooltip="Settings" size="sm" className={`not-draggable ${isSettingsViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
                    <GearIcon className="w-5 h-5" />
                </IconButton>
            </div>
            
            <WindowControls platform={platform} isMaximized={isMaximized} />
        </header>
    );
};

export default CustomTitleBar;
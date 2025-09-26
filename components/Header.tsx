

import React from 'react';
import IconButton from './IconButton';
import { GearIcon, InfoIcon, CommandIcon, TerminalIcon, PencilIcon } from './Icons';
import ThemeToggleButton from './ThemeToggleButton';

interface HeaderProps {
  onToggleSettingsView: () => void;
  onToggleInfoView: () => void;
  onShowEditorView: () => void;
  onToggleLogger: () => void;
  onOpenCommandPalette: () => void;
  isInfoViewActive: boolean;
  isSettingsViewActive: boolean;
  isEditorViewActive: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  onToggleSettingsView, 
  onToggleInfoView, 
  onShowEditorView,
  onToggleLogger, 
  onOpenCommandPalette, 
  isInfoViewActive, 
  isSettingsViewActive,
  isEditorViewActive
}) => {
  return (
    <header className="flex items-center justify-between px-3 h-14 flex-shrink-0 bg-secondary border-b border-border-color z-30">
      <div className="flex items-center gap-3">
        <TerminalIcon className="w-6 h-6 text-primary"/>
        <h1 className="text-lg font-semibold text-text-main tracking-wide">DocForge</h1>
      </div>
      <div className="flex items-center gap-1">
        <IconButton onClick={onOpenCommandPalette} tooltip="Command Palette (Ctrl+Shift+P)" tooltipPosition="bottom">
          <CommandIcon />
        </IconButton>
        <IconButton onClick={onShowEditorView} tooltip="Editor" className={`${isEditorViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <PencilIcon />
        </IconButton>
        <IconButton onClick={onToggleInfoView} tooltip="Info" className={`${isInfoViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <InfoIcon />
        </IconButton>
        <IconButton onClick={onToggleLogger} tooltip="Logs" tooltipPosition="bottom">
          <TerminalIcon />
        </IconButton>
        <ThemeToggleButton />
        <IconButton onClick={onToggleSettingsView} tooltip="Settings" className={`${isSettingsViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <GearIcon />
        </IconButton>
      </div>
    </header>
  );
};

export default Header;
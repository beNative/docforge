import React from 'react';
import IconButton from './IconButton';
import { GearIcon, InfoIcon, CommandIcon, TerminalIcon, PencilIcon } from './Icons';
import ThemeToggleButton from './ThemeToggleButton';
import type { Command } from '../types';

interface HeaderProps {
  onToggleSettingsView: () => void;
  onToggleInfoView: () => void;
  onShowEditorView: () => void;
  onToggleLogger: () => void;
  onOpenCommandPalette: () => void;
  isInfoViewActive: boolean;
  isSettingsViewActive: boolean;
  isEditorViewActive: boolean;
  commands: Command[];
}

const Header: React.FC<HeaderProps> = ({ 
  onToggleSettingsView, 
  onToggleInfoView, 
  onShowEditorView,
  onToggleLogger, 
  onOpenCommandPalette, 
  isInfoViewActive, 
  isSettingsViewActive,
  isEditorViewActive,
  commands
}) => {
  const getTooltip = (commandId: string, baseText: string) => {
    const command = commands.find(c => c.id === commandId);
    return command?.shortcutString ? `${baseText} (${command.shortcutString})` : baseText;
  };

  return (
    <header className="flex items-center justify-between px-3 h-11 flex-shrink-0 bg-secondary border-b border-border-color z-30">
      <div className="flex items-center gap-3">
        <TerminalIcon className="w-6 h-6 text-primary"/>
        <h1 className="text-base font-semibold text-text-main tracking-wide">DocForge</h1>
      </div>
      <div className="flex items-center gap-1">
        <IconButton onClick={onOpenCommandPalette} tooltip={getTooltip('toggle-command-palette', 'Command Palette')} tooltipPosition="bottom">
          <CommandIcon />
        </IconButton>
        <IconButton onClick={onShowEditorView} tooltip={getTooltip('toggle-editor', 'Editor')} className={`${isEditorViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <PencilIcon />
        </IconButton>
        <IconButton onClick={onToggleInfoView} tooltip={getTooltip('toggle-info', 'Info')} className={`${isInfoViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <InfoIcon />
        </IconButton>
        <IconButton onClick={onToggleLogger} tooltip={getTooltip('toggle-logs', 'Logs')} tooltipPosition="bottom">
          <TerminalIcon />
        </IconButton>
        <ThemeToggleButton />
        <IconButton onClick={onToggleSettingsView} tooltip={getTooltip('toggle-settings', 'Settings')} className={`${isSettingsViewActive ? 'bg-primary/10 text-primary' : ''}`} tooltipPosition="bottom">
          <GearIcon />
        </IconButton>
      </div>
    </header>
  );
};

export default Header;
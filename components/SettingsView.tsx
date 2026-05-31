import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Settings, DiscoveredLLMService, Command } from '../types';
import {
  SparklesIcon,
  FileIcon,
  SunIcon,
  GearIcon,
  DatabaseIcon,
  KeyboardIcon,
  TerminalIcon,
  CloudIcon,
} from './Icons';
import Button from './Button';
import KeyboardShortcutsSection from './KeyboardShortcutsSection';
import { useLogger } from '../hooks/useLogger';

// Modular settings components
import { ProviderSettingsSection } from './settings/ProviderSettingsSection';
import { ChatSettingsSection } from './settings/ChatSettingsSection';
import { RagSettingsSection } from './settings/RagSettingsSection';
import { AppearanceSettingsSection } from './settings/AppearanceSettingsSection';
import { PythonSettingsSection } from './settings/PythonSettingsSection';
import { ScriptDefaultsSection } from './settings/ScriptDefaultsSection';
import { GeneralSettingsSection } from './settings/GeneralSettingsSection';
import { DatabaseSettingsSection } from './settings/DatabaseSettingsSection';
import { CloudSyncSettingsSection } from './settings/CloudSyncSettingsSection';
import { AdvancedSettingsSection } from './settings/AdvancedSettingsSection';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  discoveredServices: DiscoveredLLMService[];
  onDetectServices: () => void;
  isDetecting: boolean;
  commands: Command[];
}

type SettingsCategory =
  | 'provider'
  | 'chat'
  | 'rag'
  | 'appearance'
  | 'shortcuts'
  | 'python'
  | 'shell'
  | 'powershell'
  | 'general'
  | 'database'
  | 'sync'
  | 'advanced';

const categories: { id: SettingsCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'provider', label: 'LLM Provider', icon: SparklesIcon },
  { id: 'chat', label: 'AI Chat', icon: SparklesIcon },
  { id: 'rag', label: 'RAG / Embeddings', icon: DatabaseIcon },
  { id: 'appearance', label: 'Appearance', icon: SunIcon },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: KeyboardIcon },
  { id: 'python', label: 'Python', icon: TerminalIcon },
  { id: 'shell', label: 'Shell', icon: TerminalIcon },
  { id: 'powershell', label: 'PowerShell', icon: TerminalIcon },
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'database', label: 'Database', icon: DatabaseIcon },
  { id: 'sync', label: 'Cloud Sync', icon: CloudIcon },
  { id: 'advanced', label: 'Advanced', icon: FileIcon },
];

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSave,
  discoveredServices,
  onDetectServices,
  isDetecting,
  commands,
}) => {
  const [currentSettings, setCurrentSettings] = useState<Settings>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [visibleCategory, setVisibleCategory] = useState<SettingsCategory>('provider');
  const { addLog } = useLogger();

  const [pythonValidationError, setPythonValidationError] = useState<string | null>(null);
  const [shellValidationError, setShellValidationError] = useState<string | null>(null);
  const [powershellValidationError, setPowershellValidationError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(currentSettings));
  }, [settings, currentSettings]);

  const handleSave = useCallback(() => {
    addLog('INFO', 'User action: Save settings.');
    onSave(currentSettings);
  }, [addLog, onSave, currentSettings]);

  const handleNavClick = useCallback((id: SettingsCategory) => {
    setVisibleCategory(id);
  }, []);

  const navButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const validationMessage = pythonValidationError ?? shellValidationError ?? powershellValidationError;
  const isSaveDisabled = !isDirty || !!validationMessage;

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === visibleCategory) ?? categories[0],
    [visibleCategory]
  );

  const handleNavKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const total = categories.length;
      let nextIndex = index;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          nextIndex = Math.max(0, index - 1);
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          nextIndex = Math.min(total - 1, index + 1);
          break;
        case 'PageUp':
        case 'Home':
          nextIndex = 0;
          break;
        case 'PageDown':
        case 'End':
          nextIndex = total - 1;
          break;
        case 'Enter':
        case ' ': // Space
        case 'Spacebar':
          event.preventDefault();
          handleNavClick(categories[index].id);
          return;
        default:
          return;
      }

      if (nextIndex !== index) {
        event.preventDefault();
        handleNavClick(categories[nextIndex].id);
        navButtonRefs.current[nextIndex]?.focus();
      }
    },
    [handleNavClick]
  );

  const renderActiveSection = () => {
    switch (activeCategory.id) {
      case 'provider':
        return (
          <ProviderSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            discoveredServices={discoveredServices}
            onDetectServices={onDetectServices}
            isDetecting={isDetecting}
          />
        );
      case 'chat':
        return (
          <ChatSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
          />
        );
      case 'rag':
        return (
          <RagSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            discoveredServices={discoveredServices}
          />
        );
      case 'appearance':
        return (
          <AppearanceSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
          />
        );
      case 'shortcuts':
        return (
          <KeyboardShortcutsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            commands={commands}
          />
        );
      case 'python':
        return (
          <PythonSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            onValidationChange={setPythonValidationError}
          />
        );
      case 'shell':
        return (
          <ScriptDefaultsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            target="shell"
            onValidationChange={setShellValidationError}
          />
        );
      case 'powershell':
        return (
          <ScriptDefaultsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
            target="powershell"
            onValidationChange={setPowershellValidationError}
          />
        );
      case 'general':
        return (
          <GeneralSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
          />
        );
      case 'database':
        return <DatabaseSettingsSection />;
      case 'sync':
        return (
          <CloudSyncSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
          />
        );
      case 'advanced':
        return (
          <AdvancedSettingsSection
            settings={currentSettings}
            setCurrentSettings={setCurrentSettings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="flex items-center justify-between px-4 h-7 border-b border-border-color bg-secondary flex-shrink-0">
        <h1 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Settings</h1>
        <div className="flex items-center gap-2">
          {validationMessage && (
            <p className="text-[10px] text-destructive-text max-w-xs text-right leading-tight">
              Settings error: {validationMessage}
            </p>
          )}
          <Button onClick={handleSave} disabled={isSaveDisabled} variant="primary" className="whitespace-nowrap">
            {isDirty ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <nav className="w-48 p-4 border-r border-border-color bg-secondary/50">
          <ul className="space-y-1">
            {categories.map(({ id, label, icon: Icon }, index) => (
              <li key={id}>
                <button
                  ref={(element) => {
                    navButtonRefs.current[index] = element;
                  }}
                  onKeyDown={(event) => handleNavKeyDown(event, index)}
                  onClick={() => handleNavClick(id)}
                  className={`w-full flex items-center gap-3 px-2 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                    visibleCategory === id
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-border-color/50 hover:text-text-main'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 flex flex-col bg-secondary">
          <div className="flex-1 overflow-y-auto px-6 py-3">
            <div className="min-h-full flex flex-col">{renderActiveSection()}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsView;

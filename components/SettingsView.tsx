import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Settings, DiscoveredLLMService, DiscoveredLLMModel, DatabaseStats, Command, PythonEnvironmentConfig, PythonPackageSpec } from '../types';
import { llmDiscoveryService } from '../services/llmDiscoveryService';
import { DEFAULT_SETTINGS } from '../constants';
import { SparklesIcon, FileIcon, SunIcon, GearIcon, DatabaseIcon, SaveIcon, CheckIcon, KeyboardIcon, TerminalIcon, RefreshIcon, PlusIcon } from './Icons';
import * as HeroIcons from './iconsets/Heroicons';
import * as LucideIcons from './iconsets/Lucide';
import * as FeatherIcons from './iconsets/Feather';
import * as TablerIcons from './iconsets/Tabler';
import * as MaterialIcons from './iconsets/Material';
import Spinner from './Spinner';
import Button from './Button';
import JsonEditor from './JsonEditor';
import Modal from './Modal';
import { repository } from '../services/repository';
import ToggleSwitch from './ToggleSwitch';
import SettingRow from './SettingRow';
import SettingsTreeEditor from './SettingsTreeEditor';
import { useLogger } from '../hooks/useLogger';
import KeyboardShortcutsSection from './KeyboardShortcutsSection';
import { usePythonEnvironments } from '../hooks/usePythonEnvironments';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  discoveredServices: DiscoveredLLMService[];
  onDetectServices: () => void;
  isDetecting: boolean;
  commands: Command[];
}

type SettingsCategory = 'provider' | 'appearance' | 'shortcuts' | 'python' | 'general' | 'database' | 'advanced';

const categories: { id: SettingsCategory; label: string; icon: React.FC<{className?: string}> }[] = [
  { id: 'provider', label: 'LLM Provider', icon: SparklesIcon },
  { id: 'appearance', label: 'Appearance', icon: SunIcon },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: KeyboardIcon },
  { id: 'python', label: 'Python', icon: TerminalIcon },
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'database', label: 'Database', icon: DatabaseIcon },
  { id: 'advanced', label: 'Advanced', icon: FileIcon },
];


type FontField = 'markdownBodyFontFamily' | 'markdownHeadingFontFamily' | 'markdownCodeFontFamily' | 'editorFontFamily';
type PlatformId = 'mac' | 'windows' | 'linux' | 'generic';

interface FontOption {
  label: string;
  value: string;
}

const detectPlatform = (): PlatformId => {
  if (typeof navigator === 'undefined') {
    return 'generic';
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'generic';
};

const FONT_PRESETS: Record<FontField, Record<PlatformId, string[]>> = {
  markdownBodyFontFamily: {
    generic: ['Inter, sans-serif', 'System UI, sans-serif', 'Georgia, serif'],
    mac: ['SF Pro Text, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'],
    windows: ['Segoe UI, sans-serif', 'Calibri, sans-serif'],
    linux: ['Ubuntu, sans-serif', 'Cantarell, sans-serif'],
  },
  markdownHeadingFontFamily: {
    generic: ['Inter, sans-serif', 'Source Serif Pro, serif'],
    mac: ['SF Pro Display, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'],
    windows: ['Segoe UI Semibold, sans-serif', 'Cambria, serif'],
    linux: ['Ubuntu Condensed, sans-serif', 'Cantarell, sans-serif'],
  },
  markdownCodeFontFamily: {
    generic: ['"JetBrains Mono", monospace', '"Fira Code", monospace'],
    mac: ['"SF Mono", monospace', '"Menlo", monospace'],
    windows: ['"Cascadia Code", monospace', '"Consolas", monospace'],
    linux: ['"Ubuntu Mono", monospace', '"DejaVu Sans Mono", monospace'],
  },
  editorFontFamily: {
    generic: ['"Fira Code", monospace', '"Source Code Pro", monospace'],
    mac: ['"SF Mono", monospace', '"Menlo", monospace'],
    windows: ['"Consolas", monospace', '"Cascadia Code", monospace'],
    linux: ['"Ubuntu Mono", monospace', '"DejaVu Sans Mono", monospace'],
  },
};

const serializePackageSpecs = (packages: PythonPackageSpec[]): string => {
  return packages
    .map((pkg) => {
      if (!pkg.version) {
        return pkg.name;
      }
      const version = pkg.version.trim();
      if (!version) {
        return pkg.name;
      }
      return /^(==|>=|<=|!=|~=|>|<)/.test(version) ? `${pkg.name}${version}` : `${pkg.name}==${version}`;
    })
    .join('\n');
};

const parsePackagesInput = (input: string): PythonPackageSpec[] => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const specs: PythonPackageSpec[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(==|>=|<=|!=|~=|>|<)?\s*(.*)?$/);
    if (!match) {
      specs.push({ name: line });
      continue;
    }
    const [, name, operator, remainder] = match;
    const versionPart = operator ? `${operator}${(remainder || '').trim()}` : undefined;
    specs.push(versionPart ? { name, version: versionPart } : { name });
  }
  return specs;
};

const parseEnvironmentJson = (value: string): Record<string, string> => {
  if (!value.trim()) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Environment variables must be a JSON object.');
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(parsed)) {
    result[String(key)] = val === undefined || val === null ? '' : String(val);
  }
  return result;
};

const buildFontOptions = (field: FontField, platform: PlatformId): FontOption[] => {
  const presets = FONT_PRESETS[field];
  const ordered = [
    DEFAULT_SETTINGS[field],
    ...(presets?.generic ?? []),
    ...(presets?.[platform] ?? []),
  ].filter(Boolean);

  const unique: string[] = [];
  ordered.forEach((value) => {
    const normalized = value.trim();
    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }
  });

  return unique.map((value) => {
    const primary = value.split(',')[0].replace(/["']/g, '').trim();
    return { label: primary || value, value };
  });
};

interface FontFamilySelectorProps {
  id: string;
  label: string;
  description: string;
  value: string;
  placeholder: string;
  helperText?: string;
  options: FontOption[];
  defaultValue: string;
  onChange: (font: string) => void;
}

const FontFamilySelector: React.FC<FontFamilySelectorProps> = ({
  id,
  label,
  description,
  value,
  placeholder,
  helperText,
  options,
  defaultValue,
  onChange,
}) => {
  const normalizedValue = (value || '').trim();
  const matchingOption = options.find((option) => option.value === normalizedValue);
  const previewFamily = normalizedValue || placeholder || defaultValue;

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (next) {
      onChange(next.trim());
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <SettingRow label={label} description={description}>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-recommended`}>
              Recommended
            </label>
            <div className="relative">
              <select
                id={`${id}-recommended`}
                value={matchingOption ? matchingOption.value : ''}
                onChange={handleSelect}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8"
              >
                <option value="">Choose a font</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary text-xs">
                ▼
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-custom`}>
              Custom value
            </label>
            <input
              id={`${id}-custom`}
              type="text"
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder || defaultValue}
              className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {helperText && (
              <p className="text-xs text-text-secondary mt-1">{helperText}</p>
            )}
          </div>
        </div>
        <div className="md:w-64 border border-border-color rounded-lg p-4 bg-secondary/40 space-y-3">
          <p className="text-xs font-semibold text-text-secondary tracking-[0.2em] uppercase">Preview</p>
          <div className="rounded-md bg-background border border-border-color px-3 py-3">
            <p className="text-sm text-text-main" style={{ fontFamily: previewFamily }}>
              The quick brown fox jumps over the lazy dog.
            </p>
            <p className="text-xs text-text-secondary mt-2" style={{ fontFamily: previewFamily }}>
              0123456789 • Aa Bb Cc
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            Reset to default
          </button>
        </div>
      </div>
    </SettingRow>
  );
};
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

  const isSaveDisabled = !isDirty || !!pythonValidationError;

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
            {...{
              settings: currentSettings,
              setCurrentSettings,
              discoveredServices,
              onDetectServices,
              isDetecting,
            }}
          />
        );
      case 'appearance':
        return <AppearanceSettingsSection {...{ settings: currentSettings, setCurrentSettings }} />;
      case 'shortcuts':
        return (
          <KeyboardShortcutsSection
            {...{
              settings: currentSettings,
              setCurrentSettings,
              commands,
            }}
          />
        );
      case 'python':
        return (
          <PythonSettingsSection
            {...{
              settings: currentSettings,
              setCurrentSettings,
              onValidationChange: setPythonValidationError,
            }}
          />
        );
      case 'general':
        return <GeneralSettingsSection {...{ settings: currentSettings, setCurrentSettings }} />;
      case 'database':
        return <DatabaseSettingsSection />;
      case 'advanced':
        return <AdvancedSettingsSection {...{ settings: currentSettings, setCurrentSettings }} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="flex items-center justify-between px-4 h-7 border-b border-border-color bg-secondary flex-shrink-0">
        <h1 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Settings</h1>
        <div className="flex items-center gap-2">
          {pythonValidationError && (
            <p className="text-[10px] text-destructive-text max-w-xs text-right leading-tight">
              Python settings error: {pythonValidationError}
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
            <div className="min-h-full flex flex-col">
              {renderActiveSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};


// --- SETTINGS SECTIONS ---

interface SectionProps {
    settings: Settings;
    setCurrentSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const ProviderSettingsSection: React.FC<SectionProps & { discoveredServices: DiscoveredLLMService[], onDetectServices: () => void, isDetecting: boolean }> = ({ settings, setCurrentSettings, discoveredServices, onDetectServices, isDetecting }) => {
    const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [detectionError, setDetectionError] = useState<string | null>(null);

    useEffect(() => {
        onDetectServices();
    }, [onDetectServices]);
    
    useEffect(() => {
        if (!isDetecting && discoveredServices.length === 0) {
           setDetectionError('No local LLM services found. Ensure Ollama or a compatible service is running.');
        } else {
           setDetectionError(null);
        }
    }, [isDetecting, discoveredServices]);

    useEffect(() => {
        const fetchModelsForCurrentService = async () => {
            const currentService = discoveredServices.find(s => s.generateUrl === settings.llmProviderUrl);
            if (currentService) {
                setIsFetchingModels(true);
                try {
                    const models = await llmDiscoveryService.fetchModels(currentService);
                    setAvailableModels(models);
                } catch (error) {
                    console.error("Failed to fetch models for current service:", error);
                    setAvailableModels([]);
                } finally {
                    setIsFetchingModels(false);
                }
            } else {
                setAvailableModels([]);
            }
        }
        fetchModelsForCurrentService();
    }, [discoveredServices, settings.llmProviderUrl]);


    const handleServiceChange = async (serviceId: string) => {
        const selectedService = discoveredServices.find(s => s.id === serviceId);
        if (!selectedService) return;

        setCurrentSettings(prev => ({ 
            ...prev, 
            llmProviderUrl: selectedService.generateUrl, 
            llmProviderName: selectedService.name,
            apiType: selectedService.apiType, 
            llmModelName: '' 
        }));
    };
    
    const selectedService = discoveredServices.find(s => s.generateUrl === settings.llmProviderUrl);

    return (
        <section className="pt-2 pb-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">LLM Provider</h2>
            <div className="space-y-6">
                <SettingRow label="Detect Services" description="Scan for locally running LLM services like Ollama and LM Studio.">
                    <div className="w-60">
                        <Button onClick={onDetectServices} disabled={isDetecting} variant="secondary" isLoading={isDetecting} className="w-full">
                            {isDetecting ? 'Detecting...' : 'Re-Detect Services'}
                        </Button>
                        {detectionError && <p className="text-center text-xs text-destructive-text mt-2">{detectionError}</p>}
                    </div>
                </SettingRow>
                <SettingRow label="Detected Service" description="Choose a running service to connect to for AI features.">
                    <select
                        id="llmService"
                        value={selectedService?.id || ''}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        disabled={discoveredServices.length === 0}
                        className="w-60 p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                    >
                        <option value="" disabled>{discoveredServices.length > 0 ? 'Select a service' : 'No services detected'}</option>
                        {discoveredServices.map(service => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                    </select>
                </SettingRow>
                <SettingRow label="Model Name" description="Select which model to use for generating titles and refining documents.">
                     <div className="relative w-60">
                       <select
                            id="llmModelName"
                            value={settings.llmModelName}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, llmModelName: e.target.value }))}
                            disabled={!selectedService || availableModels.length === 0}
                            className="w-full p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                        >
                            <option value="" disabled>{!selectedService ? 'Select service first' : 'Select a model'}</option>
                            {availableModels.map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                        </select>
                        {isFetchingModels && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></div>}
                    </div>
                </SettingRow>
            </div>
        </section>
    );
};

const AppearanceSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({ settings, setCurrentSettings }) => {
    const CardButton: React.FC<{name: string, value: any, children: React.ReactNode, onClick: (value: any) => void, isSelected: boolean}> = ({ name, value, children, onClick, isSelected }) => (

        <button
            onClick={() => onClick(value)}
            className={`p-3 rounded-lg border-2 text-center transition-all w-full flex-1 ${ isSelected ? 'border-primary bg-primary/5' : 'border-border-color bg-secondary hover:border-primary/50' }`}
        >
            <div className="flex items-center justify-around text-text-secondary p-2 bg-background rounded-md mb-2">
                {children}
            </div>
            <h4 className="font-semibold text-text-main text-xs">{name}</h4>
        </button>
    );
    const platform = useMemo(detectPlatform, []);
    const handleFontChange = useCallback((field: FontField, fontFamily: string) => {
        setCurrentSettings(prev => ({ ...prev, [field]: fontFamily.trim() }));
    }, [setCurrentSettings]);
    const bodyFontOptions = useMemo(() => buildFontOptions('markdownBodyFontFamily', platform), [platform]);
    const headingFontOptions = useMemo(() => buildFontOptions('markdownHeadingFontFamily', platform), [platform]);
    const codeFontOptions = useMemo(() => buildFontOptions('markdownCodeFontFamily', platform), [platform]);
    const editorFontOptions = useMemo(() => buildFontOptions('editorFontFamily', platform), [platform]);
    const lightCodeBlockBackground = settings.markdownCodeBlockBackgroundLight.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight;
    const darkCodeBlockBackground = settings.markdownCodeBlockBackgroundDark.trim() || DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark;
    const trimmedHighlightColorLight = settings.editorActiveLineHighlightColor.trim();
    const resolvedHighlightColorLight = trimmedHighlightColorLight || DEFAULT_SETTINGS.editorActiveLineHighlightColor;
    const isHighlightHexLight = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(resolvedHighlightColorLight);
    const highlightColorPickerValueLight = isHighlightHexLight ? resolvedHighlightColorLight : DEFAULT_SETTINGS.editorActiveLineHighlightColor;
    const highlightColorDisplayLight = isHighlightHexLight ? resolvedHighlightColorLight.toUpperCase() : resolvedHighlightColorLight;
    const trimmedHighlightColorDark = settings.editorActiveLineHighlightColorDark.trim();
    const resolvedHighlightColorDark = trimmedHighlightColorDark || DEFAULT_SETTINGS.editorActiveLineHighlightColorDark;
    const isHighlightHexDark = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(resolvedHighlightColorDark);
    const highlightColorPickerValueDark = isHighlightHexDark ? resolvedHighlightColorDark : DEFAULT_SETTINGS.editorActiveLineHighlightColorDark;
    const highlightColorDisplayDark = isHighlightHexDark ? resolvedHighlightColorDark.toUpperCase() : resolvedHighlightColorDark;



    return (
        <section className="pt-2 pb-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">Appearance</h2>
            <div className="space-y-6">
                <SettingRow label="Interface Scale" description="Adjust the size of all UI elements in the application.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="uiScale"
                            type="range"
                            min="50"
                            max="200"
                            step="10"
                            value={settings.uiScale}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, uiScale: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.uiScale}%</span>
                    </div>
                </SettingRow>
                <SettingRow label="Document Tree Row Spacing" description="Adjust the vertical padding used for each entry in the sidebar tree.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="documentTreeVerticalSpacing"
                            type="range"
                            min="0"
                            max="16"
                            step="1"
                            value={settings.documentTreeVerticalSpacing}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, documentTreeVerticalSpacing: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.documentTreeVerticalSpacing}px</span>
                    </div>
                </SettingRow>
                <SettingRow label="Document Tree Indent" description="Control how far nested folders and documents are indented.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="documentTreeIndent"
                            type="range"
                            min="0"
                            max="32"
                            step="1"
                            value={settings.documentTreeIndent}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, documentTreeIndent: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.documentTreeIndent}px</span>
                    </div>
                </SettingRow>
                <SettingRow label="Icon Set" description="Customize the look of icons throughout the application.">
                    <div className="grid grid-cols-3 gap-3 w-80">
                         <CardButton name="Heroicons" value="heroicons" isSelected={settings.iconSet === 'heroicons'} onClick={(v) => setCurrentSettings(s => ({...s, iconSet: v}))}>
                            <HeroIcons.PlusIcon className="w-5 h-5" /> <HeroIcons.SparklesIcon className="w-5 h-5" /> <HeroIcons.FolderIcon className="w-5 h-5" />
                        </CardButton>
                        <CardButton name="Lucide" value="lucide" isSelected={settings.iconSet === 'lucide'} onClick={(v) => setCurrentSettings(s => ({...s, iconSet: v}))}>
                            <LucideIcons.PlusIcon className="w-5 h-5" /> <LucideIcons.SparklesIcon className="w-5 h-5" /> <LucideIcons.FolderIcon className="w-5 h-5" />
                        </CardButton>
                        <CardButton name="Feather" value="feather" isSelected={settings.iconSet === 'feather'} onClick={(v) => setCurrentSettings(s => ({...s, iconSet: v}))}>
                            <FeatherIcons.PlusIcon className="w-5 h-5" /> <FeatherIcons.SparklesIcon className="w-5 h-5" /> <FeatherIcons.FolderIcon className="w-5 h-5" />
                        </CardButton>
                        <CardButton name="Tabler" value="tabler" isSelected={settings.iconSet === 'tabler'} onClick={(v) => setCurrentSettings(s => ({...s, iconSet: v}))}>
                            <TablerIcons.PlusIcon className="w-5 h-5" /> <TablerIcons.SparklesIcon className="w-5 h-5" /> <TablerIcons.FolderIcon className="w-5 h-5" />
                        </CardButton>
                        <CardButton name="Material" value="material" isSelected={settings.iconSet === 'material'} onClick={(v) => setCurrentSettings(s => ({...s, iconSet: v}))}>
                             <MaterialIcons.PlusIcon className="w-5 h-5" /> <MaterialIcons.SparklesIcon className="w-5 h-5" /> <MaterialIcons.FolderIcon className="w-5 h-5" />
                        </CardButton>
                    </div>
                </SettingRow>
                <SettingRow label="Markdown Font Size" description="Adjust the base font size for the Markdown preview.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownFontSize"
                            type="range"
                            min="7"
                            max="40"
                            step="1"
                            value={settings.markdownFontSize}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownFontSize: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownFontSize}px</span>
                    </div>
                </SettingRow>
                <SettingRow label="Markdown Line Height" description="Control the spacing between lines of text for better readability.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownLineHeight"
                            type="range"
                            min="1.2"
                            max="2.2"
                            step="0.1"
                            value={settings.markdownLineHeight}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownLineHeight: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownLineHeight.toFixed(1)}</span>
                    </div>
                </SettingRow>
                <SettingRow label="Markdown Heading Spacing" description="Control the vertical space above headings to tighten or relax sections.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownHeadingSpacing"
                            type="range"
                            min="1.0"
                            max="4.0"
                            step="0.1"
                            value={settings.markdownHeadingSpacing}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownHeadingSpacing: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownHeadingSpacing.toFixed(1)}x</span>
                    </div>
                </SettingRow>
                <SettingRow label="Markdown Paragraph Spacing" description="Adjust the space between paragraphs and block elements.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownParagraphSpacing"
                            type="range"
                            min="0.4"
                            max="2.0"
                            step="0.05"
                            value={settings.markdownParagraphSpacing}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownParagraphSpacing: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownParagraphSpacing.toFixed(2)}x</span>
                    </div>
                </SettingRow>
                <SettingRow label="Markdown Max Width" description="Set the maximum width of the text content to improve line length.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownMaxWidth"
                            type="range"
                            min="500"
                            max="4000"
                            step="20"
                            value={settings.markdownMaxWidth}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownMaxWidth: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownMaxWidth}px</span>
                    </div>
                </SettingRow>
                <SettingRow label="Document Vertical Padding" description="Control the padding above and below the rendered document.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownContentPadding"
                            type="range"
                            min="0"
                            max="240"
                            step="4"
                            value={settings.markdownContentPadding}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownContentPadding: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownContentPadding}px</span>
                    </div>
                </SettingRow>
                <SettingRow label="Code Block Font Size" description="Adjust the font size used inside fenced code blocks.">
                    <div className="flex items-center gap-4 w-60">
                        <input
                            id="markdownCodeFontSize"
                            type="range"
                            min="8"
                            max="32"
                            step="1"
                            value={settings.markdownCodeFontSize}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, markdownCodeFontSize: Number(e.target.value) }))}
                            className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                        />
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">{settings.markdownCodeFontSize}px</span>
                    </div>
                </SettingRow>
                                <FontFamilySelector
                  id="markdownBodyFontFamily"
                  label="Body Font Family"
                  description="Typography used for paragraphs and general text."
                  value={settings.markdownBodyFontFamily}
                  placeholder="System UI, sans-serif"
                  options={bodyFontOptions}
                  defaultValue={DEFAULT_SETTINGS.markdownBodyFontFamily}
                  onChange={(font) => handleFontChange('markdownBodyFontFamily', font)}
                  helperText="Applies to paragraphs, lists, and regular text."
                />
                <FontFamilySelector
                  id="markdownHeadingFontFamily"
                  label="Heading Font Family"
                  description="Choose a font family for headings or leave blank to inherit the body font."
                  value={settings.markdownHeadingFontFamily}
                  placeholder="Inter, sans-serif"
                  options={headingFontOptions}
                  defaultValue={DEFAULT_SETTINGS.markdownHeadingFontFamily}
                  onChange={(font) => handleFontChange('markdownHeadingFontFamily', font)}
                  helperText="Leave blank to reuse the body font."
                />
                <FontFamilySelector
                  id="markdownCodeFontFamily"
                  label="Code Font Family"
                  description="Set the font used for inline code and code blocks."
                  value={settings.markdownCodeFontFamily}
                  placeholder="'JetBrains Mono', monospace"
                  options={codeFontOptions}
                  defaultValue={DEFAULT_SETTINGS.markdownCodeFontFamily}
                  onChange={(font) => handleFontChange('markdownCodeFontFamily', font)}
                  helperText="Also applies to the Markdown preview's code blocks."
                />
                <SettingRow
                  label="Editor Font Size"
                  description="Set the default font size for the code editor."
                  htmlFor="editorFontSize"
                >
                  <div className="flex items-center gap-4 w-60">
                    <input
                      id="editorFontSize"
                      type="range"
                      min="10"
                      max="32"
                      step="1"
                      value={settings.editorFontSize}
                      onChange={(e) => setCurrentSettings((prev) => ({ ...prev, editorFontSize: Number(e.target.value) }))}
                      className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer range-slider"
                    />
                    <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right text-xs">
                      {settings.editorFontSize}px
                    </span>
                  </div>
                </SettingRow>
                <FontFamilySelector
                  id="editorFontFamily"
                  label="Editor Font Family"
                  description="Choose the default font used in the Monaco-powered text editors."
                  value={settings.editorFontFamily}
                  placeholder="Consolas, 'Courier New', monospace"
                  options={editorFontOptions}
                  defaultValue={DEFAULT_SETTINGS.editorFontFamily}
                  onChange={(font) => handleFontChange('editorFontFamily', font)}
                  helperText="Affects both the primary editor and diff viewer."
                />
                <SettingRow
                  label="Active Line Highlight (Light Theme)"
                  description="Customize the background color used for the active line in Monaco editors when using the light theme."
                  htmlFor="editorActiveLineHighlightColor"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        id="editorActiveLineHighlightColor"
                        type="color"
                        value={highlightColorPickerValueLight}
                        onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: event.target.value }))}
                        className="h-10 w-14 rounded-md border border-border-color bg-background cursor-pointer"
                      />
                      <span className="font-mono text-xs text-text-secondary break-all">
                        {highlightColorDisplayLight}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: DEFAULT_SETTINGS.editorActiveLineHighlightColor }))}
                      >
                        Reset
                      </Button>
                    </div>
                    <input
                      type="text"
                      value={settings.editorActiveLineHighlightColor}
                      onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColor: event.target.value }))}
                      placeholder={DEFAULT_SETTINGS.editorActiveLineHighlightColor}
                      className="w-full p-2 text-sm border border-border-color rounded-md bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <p className="text-xs text-text-secondary">
                      Enter any valid CSS color value, such as #fff59d, #fff59d80, or rgba(255,255,0,0.3).
                    </p>
                  </div>
                </SettingRow>
                <SettingRow
                  label="Active Line Highlight (Dark Theme)"
                  description="Customize the active line background for Monaco editors when using the dark theme."
                  htmlFor="editorActiveLineHighlightColorDark"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        id="editorActiveLineHighlightColorDark"
                        type="color"
                        value={highlightColorPickerValueDark}
                        onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColorDark: event.target.value }))}
                        className="h-10 w-14 rounded-md border border-border-color bg-background cursor-pointer"
                      />
                      <span className="font-mono text-xs text-text-secondary break-all">
                        {highlightColorDisplayDark}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColorDark: DEFAULT_SETTINGS.editorActiveLineHighlightColorDark }))}
                      >
                        Reset
                      </Button>
                    </div>
                    <input
                      type="text"
                      value={settings.editorActiveLineHighlightColorDark}
                      onChange={(event) => setCurrentSettings((prev) => ({ ...prev, editorActiveLineHighlightColorDark: event.target.value }))}
                      placeholder={DEFAULT_SETTINGS.editorActiveLineHighlightColorDark}
                      className="w-full p-2 text-sm border border-border-color rounded-md bg-background text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <p className="text-xs text-text-secondary">
                      Enter any valid CSS color value, such as #2a2d2e, #2a2d2ecc, or rgba(42,45,46,0.5).
                    </p>
                  </div>
                </SettingRow>
                <SettingRow
                  label="Code Block Background (Light Theme)"
                  description="Adjust the background color for Markdown code blocks when using the light theme."
                  htmlFor="markdownCodeBlockBackgroundLight"
                >
                  <div className="flex items-center gap-3">
                    <input
                      id="markdownCodeBlockBackgroundLight"
                      type="color"
                      value={lightCodeBlockBackground}
                      onChange={(event) => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundLight: event.target.value }))}
                      className="h-10 w-14 rounded-md border border-border-color bg-background cursor-pointer"
                    />
                    <span className="font-mono text-xs text-text-secondary">
                      {lightCodeBlockBackground.toUpperCase()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundLight: DEFAULT_SETTINGS.markdownCodeBlockBackgroundLight }))}
                    >
                      Reset
                    </Button>
                  </div>
                </SettingRow>
                <SettingRow
                  label="Code Block Background (Dark Theme)"
                  description="Adjust the background color for Markdown code blocks when using the dark theme."
                  htmlFor="markdownCodeBlockBackgroundDark"
                >
                  <div className="flex items-center gap-3">
                    <input
                      id="markdownCodeBlockBackgroundDark"
                      type="color"
                      value={darkCodeBlockBackground}
                      onChange={(event) => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundDark: event.target.value }))}
                      className="h-10 w-14 rounded-md border border-border-color bg-background cursor-pointer"
                    />
                    <span className="font-mono text-xs text-text-secondary">
                      {darkCodeBlockBackground.toUpperCase()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setCurrentSettings((prev) => ({ ...prev, markdownCodeBlockBackgroundDark: DEFAULT_SETTINGS.markdownCodeBlockBackgroundDark }))}
                    >
                      Reset
                    </Button>
                  </div>
                </SettingRow>
            </div>
        </section>
    );
};


interface PythonSectionProps extends SectionProps {
  onValidationChange?: (message: string | null) => void;
}

const PythonSettingsSection: React.FC<PythonSectionProps> = ({ settings, setCurrentSettings, onValidationChange }) => {
  const { addLog } = useLogger();
  const {
    environments,
    interpreters,
    isLoading,
    isDetecting,
    refreshEnvironments,
    refreshInterpreters,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
  } = usePythonEnvironments();

  type EnvironmentFormState = {
    name: string;
    interpreterPath: string;
    customInterpreter: string;
    useCustomInterpreter: boolean;
    managed: boolean;
    packagesText: string;
    envVarJson: string;
    workingDirectory: string;
    description: string;
  };

  const createInitialFormState = useCallback<() => EnvironmentFormState>(() => ({
    name: `Environment (${settings.pythonDefaults.targetPythonVersion})`,
    interpreterPath: interpreters[0]?.path ?? '',
    customInterpreter: '',
    useCustomInterpreter: interpreters.length === 0,
    managed: true,
    packagesText: serializePackageSpecs(settings.pythonDefaults.basePackages),
    envVarJson: JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2),
    workingDirectory: settings.pythonDefaults.workingDirectory ?? settings.pythonWorkingDirectory ?? '',
    description: '',
  }), [interpreters, settings.pythonDefaults, settings.pythonWorkingDirectory]);

  const [packagesInput, setPackagesInput] = useState(() => serializePackageSpecs(settings.pythonDefaults.basePackages));
  const [envVarJson, setEnvVarJson] = useState(() => JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2));
  const [envVarError, setEnvVarError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<EnvironmentFormState>(() => createInitialFormState());
  const [editingEnv, setEditingEnv] = useState<PythonEnvironmentConfig | null>(null);
  const [formEnvVarError, setFormEnvVarError] = useState<string | null>(null);

  useEffect(() => {
    onValidationChange?.(envVarError);
  }, [envVarError, onValidationChange]);

  useEffect(() => () => {
    onValidationChange?.(null);
  }, [onValidationChange]);

  useEffect(() => {
    setPackagesInput(serializePackageSpecs(settings.pythonDefaults.basePackages));
  }, [settings.pythonDefaults.basePackages]);

  useEffect(() => {
    setEnvVarJson(JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2));
    setEnvVarError(null);
  }, [settings.pythonDefaults.environmentVariables]);

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) {
      setFormState(createInitialFormState());
    }
  }, [createInitialFormState, isCreateOpen, isEditOpen]);

  const handlePackagesChange = (value: string) => {
    setPackagesInput(value);
    const parsed = parsePackagesInput(value);
    setCurrentSettings((prev) => ({
      ...prev,
      pythonDefaults: { ...prev.pythonDefaults, basePackages: parsed },
    }));
  };

  const handleEnvVarChange = (value: string) => {
    setEnvVarJson(value);
    try {
      const parsed = parseEnvironmentJson(value);
      setCurrentSettings((prev) => ({
        ...prev,
        pythonDefaults: { ...prev.pythonDefaults, environmentVariables: parsed },
      }));
      setEnvVarError(null);
    } catch (error) {
      setEnvVarError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleFormEnvVarChange = (value: string) => {
    setFormState((prev) => ({ ...prev, envVarJson: value }));
    try {
      parseEnvironmentJson(value);
      setFormEnvVarError(null);
    } catch (error) {
      setFormEnvVarError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConsoleThemeChange = (theme: 'light' | 'dark') => {
    setCurrentSettings((prev) => ({ ...prev, pythonConsoleTheme: theme }));
  };

  const handleWorkingDirectoryChange = (value: string) => {
    const trimmed = value.trim();
    setCurrentSettings((prev) => ({
      ...prev,
      pythonWorkingDirectory: trimmed ? trimmed : null,
      pythonDefaults: { ...prev.pythonDefaults, workingDirectory: trimmed ? trimmed : null },
    }));
  };

  const openCreateModal = () => {
    setFormState(createInitialFormState());
    setFormError(null);
    setFormEnvVarError(null);
    setCreateOpen(true);
    refreshInterpreters();
  };

  const openEditModal = (env: PythonEnvironmentConfig) => {
    setEditingEnv(env);
    setFormState({
      name: env.name,
      interpreterPath: env.pythonExecutable,
      customInterpreter: '',
      useCustomInterpreter: false,
      managed: env.managed,
      packagesText: serializePackageSpecs(env.packages),
      envVarJson: JSON.stringify(env.environmentVariables, null, 2),
      workingDirectory: env.workingDirectory ?? '',
      description: env.description ?? '',
    });
    setFormError(null);
    setFormEnvVarError(null);
    setEditOpen(true);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditOpen(false);
    setEditingEnv(null);
    setFormError(null);
    setFormEnvVarError(null);
  };

  const resolveInterpreterPath = (): string => {
    if (formState.useCustomInterpreter) {
      return formState.customInterpreter.trim();
    }
    return formState.interpreterPath;
  };

  const submitCreateEnvironment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formEnvVarError) {
        throw new Error(formEnvVarError);
      }
      const interpreter = resolveInterpreterPath();
      if (!interpreter) {
        throw new Error('Select or enter a Python interpreter.');
      }
      const packages = parsePackagesInput(formState.packagesText);
      const envVars = parseEnvironmentJson(formState.envVarJson);
      const environment = await createEnvironment({
        name: formState.name.trim() || `Environment (${settings.pythonDefaults.targetPythonVersion})`,
        pythonExecutable: interpreter,
        packages,
        environmentVariables: envVars,
        workingDirectory: formState.workingDirectory.trim() || null,
        description: formState.description.trim() || null,
        managed: formState.managed,
      });
      addLog('INFO', `Created Python environment "${environment.name}".`);
      closeModals();
      await refreshEnvironments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUpdateEnvironment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEnv) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formEnvVarError) {
        throw new Error(formEnvVarError);
      }
      const packages = parsePackagesInput(formState.packagesText);
      const envVars = parseEnvironmentJson(formState.envVarJson);
      const updated = await updateEnvironment(editingEnv.envId, {
        name: formState.name.trim(),
        packages,
        environmentVariables: envVars,
        workingDirectory: formState.workingDirectory.trim() || null,
        description: formState.description.trim() || null,
      });
      addLog('INFO', `Updated Python environment "${updated.name}".`);
      closeModals();
      await refreshEnvironments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEnvironment = async (env: PythonEnvironmentConfig) => {
    const confirmed = window.confirm(`Delete environment "${env.name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteEnvironment(env.envId);
    addLog('INFO', `Deleted Python environment "${env.name}".`);
    refreshEnvironments();
  };

  const interpreterValue = formState.useCustomInterpreter ? 'custom' : formState.interpreterPath;

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Python Execution</h2>
      <p className="text-xs text-text-secondary max-w-3xl mb-6">
        Configure how DocForge prepares isolated Python environments. These defaults are applied when auto-creating a virtual
        environment for a document and can be overridden per environment.
      </p>
      <div className="space-y-6">
        <SettingRow label="Target Python Version" description="Preferred Python version when creating new virtual environments.">
          <input
            type="text"
            value={settings.pythonDefaults.targetPythonVersion}
            onChange={(e) => setCurrentSettings((prev) => ({
              ...prev,
              pythonDefaults: { ...prev.pythonDefaults, targetPythonVersion: e.target.value.trim() },
            }))}
            className="w-40 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="3.11"
          />
        </SettingRow>
        <SettingRow label="Default Packages" description="One package per line. Versions can use ==, >=, <=, etc.">
          <textarea
            value={packagesInput}
            onChange={(e) => handlePackagesChange(e.target.value)}
            className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="numpy
pandas
requests"
          />
        </SettingRow>
        <SettingRow label="Default Environment Variables" description="JSON object defining environment variables applied to every run.">
          <textarea
            value={envVarJson}
            onChange={(e) => handleEnvVarChange(e.target.value)}
            className="w-full h-32 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          {envVarError && <p className="text-xs text-destructive-text mt-2">{envVarError}</p>}
        </SettingRow>
        <SettingRow label="Default Working Directory" description="Optional directory used when running scripts if no environment-specific directory is set.">
          <input
            type="text"
            value={settings.pythonWorkingDirectory ?? ''}
            onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="/path/to/projects"
          />
        </SettingRow>
        <SettingRow label="Console Theme" description="Theme used for the dedicated Python output window.">
          <select
            value={settings.pythonConsoleTheme}
            onChange={(e) => handleConsoleThemeChange(e.target.value as 'light' | 'dark')}
            className="w-40 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </SettingRow>
        <div className="border border-border-color rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-secondary/40">
            <div>
              <p className="text-sm font-semibold text-text-main">Managed Environments</p>
              <p className="text-xs text-text-secondary">Create reusable Python virtual environments with curated packages.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => { refreshEnvironments(); refreshInterpreters(); }} isLoading={isLoading || isDetecting}>
                <RefreshIcon className="w-4 h-4 mr-1" /> Refresh
              </Button>
              <Button onClick={openCreateModal}><PlusIcon className="w-4 h-4 mr-1" /> New Environment</Button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {environments.length === 0 ? (
              <p className="text-xs text-text-secondary">No environments configured yet.</p>
            ) : (
              environments.map((env) => (
                <div key={env.envId} className="border border-border-color rounded-md p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-text-main">{env.name}</p>
                      <p className="text-xs text-text-secondary">Python {env.pythonVersion} • {env.managed ? 'Managed' : 'External'}</p>
                      <p className="text-xs text-text-secondary break-all mt-1">{env.pythonExecutable}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => openEditModal(env)}>Configure</Button>
                      <Button variant="destructive" onClick={() => handleDeleteEnvironment(env)}>Delete</Button>
                    </div>
                  </div>
                  {(env.description || env.workingDirectory) && (
                    <div className="mt-2 text-xs text-text-secondary space-y-1">
                      {env.description && <p>{env.description}</p>}
                      {env.workingDirectory && <p>Working directory: {env.workingDirectory}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <Modal title="Create Python Environment" onClose={closeModals}>
          <form onSubmit={submitCreateEnvironment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Environment name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Interpreter</label>
              <select
                value={interpreterValue}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setFormState((prev) => ({ ...prev, useCustomInterpreter: true }));
                  } else {
                    setFormState((prev) => ({ ...prev, useCustomInterpreter: false, interpreterPath: e.target.value }));
                  }
                }}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select detected interpreter</option>
                {interpreters.map((interp) => (
                  <option key={interp.path} value={interp.path}>{interp.displayName}</option>
                ))}
                <option value="custom">Use custom path…</option>
              </select>
              {formState.useCustomInterpreter && (
                <input
                  type="text"
                  value={formState.customInterpreter}
                  onChange={(e) => setFormState((prev) => ({ ...prev, customInterpreter: e.target.value }))}
                  className="mt-2 w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="/usr/bin/python3"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="managed-env"
                type="checkbox"
                checked={formState.managed}
                onChange={(e) => setFormState((prev) => ({ ...prev, managed: e.target.checked }))}
                className="w-4 h-4 text-primary border-border-color rounded"
              />
              <label htmlFor="managed-env" className="text-xs text-text-secondary">Create an isolated virtual environment managed by DocForge.</label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Packages</label>
              <textarea
                value={formState.packagesText}
                onChange={(e) => setFormState((prev) => ({ ...prev, packagesText: e.target.value }))}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Variables (JSON)</label>
              <textarea
                value={formState.envVarJson}
                onChange={(e) => handleFormEnvVarChange(e.target.value)}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              {formEnvVarError && (
                <p className="text-xs text-destructive-text mt-1">{formEnvVarError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Working Directory</label>
              <input
                type="text"
                value={formState.workingDirectory}
                onChange={(e) => setFormState((prev) => ({ ...prev, workingDirectory: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full h-20 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {formError && <p className="text-xs text-destructive-text">{formError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={closeModals}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || !!formEnvVarError}>
                Create Environment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {isEditOpen && editingEnv && (
        <Modal title={`Configure ${editingEnv.name}`} onClose={closeModals}>
          <form onSubmit={submitUpdateEnvironment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Python Executable</label>
              <input
                type="text"
                value={editingEnv.pythonExecutable}
                readOnly
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Packages</label>
              <textarea
                value={formState.packagesText}
                onChange={(e) => setFormState((prev) => ({ ...prev, packagesText: e.target.value }))}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Variables (JSON)</label>
              <textarea
                value={formState.envVarJson}
                onChange={(e) => handleFormEnvVarChange(e.target.value)}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              {formEnvVarError && (
                <p className="text-xs text-destructive-text mt-1">{formEnvVarError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Working Directory</label>
              <input
                type="text"
                value={formState.workingDirectory}
                onChange={(e) => setFormState((prev) => ({ ...prev, workingDirectory: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full h-20 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {formError && <p className="text-xs text-destructive-text">{formError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={closeModals}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || !!formEnvVarError}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};

const GeneralSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({ settings, setCurrentSettings }) => {
    const isOfflineRendererAvailable = typeof window !== 'undefined' && !!window.electronAPI?.renderPlantUML;
    const offlineRendererMessage = 'Offline rendering requires the desktop application with a local Java runtime.';
    const { addLog } = useLogger();
    const [isManualCheckRunning, setIsManualCheckRunning] = useState(false);
    const [manualCheckStatus, setManualCheckStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [manualCheckMessage, setManualCheckMessage] = useState<string | null>(null);
    const canManuallyCheckForUpdates = typeof window !== 'undefined' && !!window.electronAPI?.updaterCheckForUpdates;

    const handleManualUpdateCheck = useCallback(async () => {
        if (!window.electronAPI?.updaterCheckForUpdates) {
            setManualCheckStatus('error');
            setManualCheckMessage('Manual update checks are only available in the desktop application.');
            return;
        }

        setIsManualCheckRunning(true);
        setManualCheckStatus('idle');
        setManualCheckMessage(null);
        addLog('INFO', 'User action: Manual update check triggered.');

        try {
            const result = await window.electronAPI.updaterCheckForUpdates();
            if (result?.success) {
                if (result.updateAvailable) {
                    const label = result.version ?? result.releaseName ?? 'latest';
                    setManualCheckStatus('success');
                    setManualCheckMessage(`Update ${label} found. Downloading will begin automatically.`);
                } else {
                    setManualCheckStatus('success');
                    setManualCheckMessage('You are running the latest version.');
                }
            } else {
                setManualCheckStatus('error');
                setManualCheckMessage(result?.error ?? 'Failed to check for updates.');
                if (result?.details) {
                    addLog('DEBUG', `Manual update check details: ${result.details}`);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to check for updates.';
            setManualCheckStatus('error');
            setManualCheckMessage(message);
            addLog('ERROR', `Manual update check exception: ${message}`);
        } finally {
            setIsManualCheckRunning(false);
        }
    }, [addLog]);

    const effectiveManualCheckStatus = canManuallyCheckForUpdates ? manualCheckStatus : 'error';
    const manualCheckMessageClass = effectiveManualCheckStatus === 'error'
        ? 'text-error'
        : effectiveManualCheckStatus === 'success'
            ? 'text-success'
            : 'text-text-secondary';
    return (
        <section className="pt-2 pb-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">General</h2>
            <div className="space-y-6">
                <SettingRow htmlFor="allowPrerelease" label="Pre-release Updates" description="Allow DocForge to download and install beta releases when available.">
                    <ToggleSwitch id="allowPrerelease" checked={settings.allowPrerelease} onChange={(val) => setCurrentSettings(s => ({...s, allowPrerelease: val}))} />
                </SettingRow>
                <SettingRow htmlFor="autoCheckForUpdates" label="Automatic Update Checks" description="Check for new releases whenever DocForge starts.">
                    <ToggleSwitch id="autoCheckForUpdates" checked={settings.autoCheckForUpdates} onChange={(val) => setCurrentSettings(s => ({...s, autoCheckForUpdates: val}))} />
                </SettingRow>
                <SettingRow label="Check for Updates" description="Run an update check immediately.">
                    <div className="flex flex-col items-start md:items-end gap-2 w-full">
                        <Button variant="secondary" onClick={handleManualUpdateCheck} isLoading={isManualCheckRunning} disabled={isManualCheckRunning || !canManuallyCheckForUpdates}>
                            {isManualCheckRunning ? 'Checking…' : 'Check for Updates'}
                        </Button>
                        {(canManuallyCheckForUpdates ? manualCheckMessage : true) && (
                            <p className={`text-xs text-left md:text-right ${manualCheckMessageClass}`}>
                                {canManuallyCheckForUpdates ? manualCheckMessage : 'Manual update checks are only available in the desktop application.'}
                            </p>
                        )}
                    </div>
                </SettingRow>
                <SettingRow htmlFor="autoSaveLogs" label="Auto-save Logs" description="Automatically save all logs to a daily file on your computer for debugging.">
                    <ToggleSwitch id="autoSaveLogs" checked={settings.autoSaveLogs} onChange={(val) => setCurrentSettings(s => ({...s, autoSaveLogs: val}))} />
                </SettingRow>
                <SettingRow
                    htmlFor="plantumlRendererMode"
                    label="PlantUML Rendering"
                    description="Choose whether PlantUML diagrams are rendered via the public server or the local renderer."
                >
                    <div className="flex flex-col items-end w-full md:items-end">
                        <select
                            id="plantumlRendererMode"
                            value={settings.plantumlRendererMode}
                            onChange={(event) => setCurrentSettings(prev => ({
                                ...prev,
                                plantumlRendererMode: event.target.value as Settings['plantumlRendererMode'],
                            }))}
                            className="w-full md:w-64 px-3 py-2 text-sm rounded-md border border-border-color bg-background text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="remote">Remote (plantuml.com)</option>
                            <option value="offline">Offline (local renderer)</option>
                        </select>
                        {!isOfflineRendererAvailable && (
                            <p className={`mt-2 text-xs ${settings.plantumlRendererMode === 'offline' ? 'text-destructive-text' : 'text-text-secondary'} text-right md:text-left md:w-full`}>
                                {offlineRendererMessage}
                            </p>
                        )}
                    </div>
                </SettingRow>
            </div>
        </section>
    );
};

const DatabaseSettingsSection: React.FC = () => {
    const [dbPath, setDbPath] = useState<string>('Loading...');
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isSwitchingDb, setIsSwitchingDb] = useState(false);
    const [isCreatingDb, setIsCreatingDb] = useState(false);
    const [operation, setOperation] = useState<{
        name: 'backup' | 'integrity' | 'vacuum' | 'switch' | 'create';
        status: 'running' | 'success' | 'error';
        message?: string;
    } | null>(null);
    const { addLog } = useLogger();

    const loadData = useCallback(async () => {
        setIsLoadingStats(true);
        setOperation(null);
        try {
            const path = await repository.getDbPath();
            setDbPath(path);
            const statsResult = await repository.getDatabaseStats();
            if (statsResult.success) {
                setStats(statsResult.stats || null);
            } else {
                setOperation({ name: 'integrity', status: 'error', message: statsResult.error || 'Failed to load stats.' });
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setOperation({ name: 'integrity', status: 'error', message });
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleBackup = async () => {
        addLog('INFO', 'User action: Initiate database backup.');
        setOperation({ name: 'backup', status: 'running' });
        const result = await repository.backupDatabase();
        if (result.success) {
            setOperation({ name: 'backup', status: 'success', message: result.message || 'Backup successful.' });
        } else {
            setOperation({ name: 'backup', status: 'error', message: result.error || 'Backup failed.' });
        }
    };

    const handleIntegrityCheck = async () => {
        addLog('INFO', 'User action: Initiate database integrity check.');
        setOperation({ name: 'integrity', status: 'running' });
        const result = await repository.runIntegrityCheck();
        if (result.success) {
            const message = result.results === 'ok' ? 'Integrity check passed.' : `Integrity check found issues: ${result.results}`;
            setOperation({ name: 'integrity', status: 'success', message });
        } else {
            setOperation({ name: 'integrity', status: 'error', message: result.error || 'Integrity check failed.' });
        }
    };

    const handleVacuum = async () => {
        addLog('INFO', 'User action: Initiate database vacuum (optimize).');
        setOperation({ name: 'vacuum', status: 'running' });
        const result = await repository.runVacuum();
        if (result.success) {
            setOperation({ name: 'vacuum', status: 'success', message: 'Database optimized successfully.' });
            await loadData(); // Reload stats to show size change
        } else {
            setOperation({ name: 'vacuum', status: 'error', message: result.error || 'Optimization failed.' });
        }
    };

    const handleChangeDatabase = async () => {
        addLog('INFO', 'User action: Change database location.');
        setOperation(null);
        setIsSwitchingDb(true);
        try {
            const result = await repository.selectDatabaseFile();
            if (!result.success) {
                if (result.canceled) {
                    return;
                }
                const message = result.error || 'Failed to load the selected database file.';
                addLog('ERROR', `Database change failed: ${message}`);
                setOperation({ name: 'switch', status: 'error', message });
                return;
            }

            if (result.path) {
                setDbPath(result.path);
            }

            const successMessage = `${result.message ?? 'Database location updated.'} Reloading interface...`;
            addLog('INFO', successMessage);
            setOperation({ name: 'switch', status: 'success', message: successMessage });

            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to change database location.';
            addLog('ERROR', `Database change failed: ${message}`);
            setOperation({ name: 'switch', status: 'error', message });
        } finally {
            setIsSwitchingDb(false);
        }
    };

    const handleCreateDatabase = async () => {
        addLog('INFO', 'User action: Create a brand new database file.');
        setOperation({ name: 'create', status: 'running' });
        setIsCreatingDb(true);
        try {
            const result = await repository.createNewDatabase();
            if (!result.success) {
                if (result.canceled) {
                    setOperation(null);
                    return;
                }
                const message = result.error || 'Failed to create a new database file.';
                addLog('ERROR', `Database creation failed: ${message}`);
                setOperation({ name: 'create', status: 'error', message });
                return;
            }

            if (result.path) {
                setDbPath(result.path);
            }

            const message = `${result.message ?? 'New database created.'} Reloading interface...`;
            addLog('INFO', message);
            setOperation({ name: 'create', status: 'success', message });

            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create a new database file.';
            addLog('ERROR', `Database creation failed: ${message}`);
            setOperation({ name: 'create', status: 'error', message });
        } finally {
            setIsCreatingDb(false);
        }
    };

    return (
        <section className="pt-2 pb-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">Database Management</h2>
            <div className="space-y-6">
                <SettingRow label="Database File" description="This file contains all your documents, folders, and history.">
                    <div className="w-full flex flex-col md:flex-row md:items-center gap-2">
                        <div className="text-sm text-text-main bg-background px-3 py-2 rounded-md border border-border-color w-full font-mono text-xs select-all break-all md:flex-1">
                            {dbPath}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button onClick={handleCreateDatabase} variant="primary" isLoading={isCreatingDb} disabled={isSwitchingDb || isCreatingDb}>
                                <DatabaseIcon className="w-4 h-4 mr-2" /> New Database
                            </Button>
                            <Button onClick={handleChangeDatabase} variant="secondary" isLoading={isSwitchingDb} disabled={isSwitchingDb || isCreatingDb}>
                                Change Location
                            </Button>
                        </div>
                    </div>
                </SettingRow>
                <SettingRow label="Operations" description="Perform maintenance tasks on the application database.">
                    <div className="flex flex-col items-end w-full gap-2">
                        <div className="flex items-center gap-2">
                            <Button onClick={handleBackup} variant="secondary" isLoading={operation?.name === 'backup' && operation.status === 'running'}>
                                <SaveIcon className="w-4 h-4 mr-2" /> Backup
                            </Button>
                            <Button onClick={handleIntegrityCheck} variant="secondary" isLoading={operation?.name === 'integrity' && operation.status === 'running'}>
                                <CheckIcon className="w-4 h-4 mr-2" /> Check Integrity
                            </Button>
                            <Button onClick={handleVacuum} variant="secondary" isLoading={operation?.name === 'vacuum' && operation.status === 'running'}>
                                <SparklesIcon className="w-4 h-4 mr-2" /> Vacuum
                            </Button>
                        </div>
                        {operation && (
                            <p className={`text-xs mt-2 text-right ${operation.status === 'error' ? 'text-error' : 'text-success'}`}>
                                {operation.message}
                            </p>
                        )}
                    </div>
                </SettingRow>
                <SettingRow label="Statistics" description="An overview of the database contents and size.">
                    {isLoadingStats ? (
                        <Spinner />
                    ) : !stats ? (
                        <p className="text-sm text-error">Could not load stats.</p>
                    ) : (
                        <div className="w-full space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-background p-3 rounded-md border border-border-color">
                                    <strong>File Size:</strong> {stats.fileSize}
                                </div>
                                <div className="bg-background p-3 rounded-md border border-border-color">
                                    <strong>Schema Version:</strong> {stats.schemaVersion}
                                </div>
                                <div className="bg-background p-3 rounded-md border border-border-color">
                                    <strong>Page Size:</strong> {stats.pageSize} bytes
                                </div>
                                <div className="bg-background p-3 rounded-md border border-border-color">
                                    <strong>Page Count:</strong> {stats.pageCount}
                                </div>
                            </div>
                            <div className="w-full overflow-hidden border border-border-color rounded-md">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-background">
                                        <tr>
                                            <th className="p-2 font-semibold">Table</th>
                                            <th className="p-2 font-semibold text-right">Rows</th>
                                            <th className="p-2 font-semibold">Indexes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-color">
                                        {stats.tables.map((table) => (
                                            <tr key={table.name} className="bg-secondary">
                                                <td className="p-2 font-mono">{table.name}</td>
                                                <td className="p-2 font-mono text-right">{table.rowCount}</td>
                                                <td className="p-2 font-mono text-xs text-text-secondary">
                                                    {table.indexes.join(', ') || 'none'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </SettingRow>
            </div>
        </section>
    );
};

const AdvancedSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings'>> = ({ settings, setCurrentSettings }) => {
    const { addLog } = useLogger();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [jsonString, setJsonString] = useState(() => JSON.stringify(settings, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [mode, setMode] = useState<'tree' | 'json'>('tree');
    const [transferStatus, setTransferStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const editorSurfaceStyle = useMemo<React.CSSProperties>(
        () => ({
            minHeight: '24rem',
            height: 'clamp(24rem, 70vh, 44rem)',
            maxHeight: '44rem',
        }),
        [],
    );

    useEffect(() => {
        setJsonString(JSON.stringify(settings, null, 2));
        setJsonError(null);
    },[settings]);

    useEffect(() => {
        if (!transferStatus) {
            return;
        }
        const timeout = window.setTimeout(() => setTransferStatus(null), 5000);
        return () => window.clearTimeout(timeout);
    }, [transferStatus]);

    const applyImportedSettings = useCallback((content: string) => {
        try {
            const parsed = JSON.parse(content);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('Settings file must contain a JSON object.');
            }
            const merged = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
            setCurrentSettings(merged);
            setTransferStatus({ type: 'success', message: 'Settings imported. Review changes and save to apply.' });
            addLog('INFO', 'User action: Imported settings from JSON.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import settings.';
            setTransferStatus({ type: 'error', message });
            addLog('ERROR', `Settings import failed: ${message}`);
        }
    }, [addLog, setCurrentSettings]);

    const handleJsonChange = (value: string) => {
        setJsonString(value);
        try {
            const parsed = JSON.parse(value);
            setCurrentSettings(parsed);
            setJsonError(null);
        } catch (error) {
            setJsonError(error instanceof Error ? error.message : 'Invalid JSON format.');
        }
    };
    
    const handleSettingChange = (path: (string | number)[], value: any) => {
      setCurrentSettings(prevSettings => {
          // A safe way to deep-clone and update nested properties
          const newSettings = JSON.parse(JSON.stringify(prevSettings));
          let current: any = newSettings;
          for (let i = 0; i < path.length - 1; i++) {
              const key = path[i];
              if (current[key] === undefined || typeof current[key] !== 'object') {
                  // This path is invalid, which shouldn't happen with the tree editor.
                  // Return original state to be safe.
                  return prevSettings;
              }
              current = current[key];
          }
          current[path[path.length - 1]] = value;
          return newSettings;
      });
    };

    const handleExport = useCallback(async () => {
        const content = JSON.stringify(settings, null, 2);
        addLog('INFO', 'User action: Export settings to JSON.');
        if (window.electronAPI?.settingsExport) {
            const result = await window.electronAPI.settingsExport(content);
            if (result.success) {
                setTransferStatus({ type: 'success', message: 'Settings exported successfully.' });
                return;
            }
            const message = result.error ?? 'Failed to export settings.';
            setTransferStatus({ type: 'error', message });
            addLog('ERROR', `Settings export failed: ${message}`);
            return;
        }

        try {
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `docforge-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setTransferStatus({ type: 'success', message: 'Settings exported successfully.' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export settings.';
            setTransferStatus({ type: 'error', message });
            addLog('ERROR', `Settings export failed: ${message}`);
        }
    }, [addLog, settings]);

    const handleImport = useCallback(async () => {
        addLog('INFO', 'User action: Initiate settings import from JSON.');
        if (window.electronAPI?.settingsImport) {
            const result = await window.electronAPI.settingsImport();
            if (result.success && result.content) {
                applyImportedSettings(result.content);
            } else if (!result.success && result.error) {
                setTransferStatus({ type: 'error', message: result.error });
                addLog('ERROR', `Settings import failed: ${result.error}`);
            }
            return;
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    }, [addLog, applyImportedSettings]);

    const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const text = await file.text();
            applyImportedSettings(text);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to read settings file.';
            setTransferStatus({ type: 'error', message });
            addLog('ERROR', `Settings import failed: ${message}`);
        }
    }, [addLog, applyImportedSettings]);

    return (
        <section className="flex flex-col min-h-full pt-2 pb-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">Advanced</h2>
            <div className="flex flex-col gap-6 flex-1 min-h-0">
                <SettingRow label="Settings Transfer" description="Export the current configuration or import it from a JSON file.">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleExport} variant="secondary" size="sm">
                                Export Settings
                            </Button>
                            <Button onClick={handleImport} variant="secondary" size="sm">
                                Import Settings
                            </Button>
                        </div>
                        {transferStatus && (
                            <p className={`text-xs ${transferStatus.type === 'success' ? 'text-success' : 'text-error'}`}>
                                {transferStatus.message}
                            </p>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={handleFileInputChange}
                        />
                    </div>
                </SettingRow>
                <SettingRow label="Settings Editor" description="Edit settings using an interactive tree or raw JSON for full control.">
                    <div className="flex flex-col gap-3 w-full flex-1 min-h-0 self-stretch">
                        <div className="flex justify-end">
                            <div className="flex items-center p-1 bg-background rounded-lg border border-border-color">
                                <button
                                    onClick={() => setMode('tree')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'tree' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'}`}
                                >
                                    Tree
                                </button>
                                <button
                                    onClick={() => setMode('json')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'json' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'}`}
                                >
                                    JSON
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col gap-2">
                            {mode === 'tree' ? (
                                <SettingsTreeEditor
                                    settings={settings}
                                    onSettingChange={handleSettingChange}
                                    className="flex-1"
                                    style={editorSurfaceStyle}
                                />
                            ) : (
                                <>
                                    <JsonEditor
                                        value={jsonString}
                                        onChange={handleJsonChange}
                                        className="flex-1"
                                        style={editorSurfaceStyle}
                                    />
                                    {jsonError && <p className="text-sm text-destructive-text">{jsonError}</p>}
                                </>
                            )}
                        </div>
                    </div>
                </SettingRow>
            </div>
        </section>
    );
};


export default SettingsView;

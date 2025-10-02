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
import SettingsGroupCard from './SettingsGroupCard';
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
    <SettingRow label={label} description={description} contentVariant="soft">
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

  const sectionRefs = useRef<Partial<Record<SettingsCategory, HTMLDivElement | null>>>({});
  const mainPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(currentSettings));
  }, [settings, currentSettings]);

  useEffect(() => {
    const panel = mainPanelRef.current;
    if (!panel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCategory(entry.target.id as SettingsCategory);
          }
        });
      },
      {
        root: panel,
        rootMargin: '-40% 0px -60% 0px',
        threshold: 0,
      }
    );

    const sections = Object.values(sectionRefs.current).filter(
      (section): section is HTMLDivElement => Boolean(section)
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
      observer.disconnect();
    };
  }, []);

  const handleSave = useCallback(() => {
    addLog('INFO', 'User action: Save settings.');
    onSave(currentSettings);
  }, [addLog, onSave, currentSettings]);

  const handleNavClick = useCallback((id: SettingsCategory) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setVisibleCategory(id);
  }, []);

  const isSaveDisabled = !isDirty || !!pythonValidationError;

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="flex justify-between items-center p-4 border-b border-border-color flex-shrink-0">
        <h1 className="text-xl font-semibold text-text-main">Settings</h1>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleSave} disabled={isSaveDisabled} variant="primary">
            {isDirty ? 'Save Changes' : 'Saved'}
          </Button>
          {pythonValidationError && (
            <p className="text-[10px] text-destructive-text max-w-xs text-right">
              Python settings error: {pythonValidationError}
            </p>
          )}
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <nav className="w-48 p-4 border-r border-border-color bg-secondary/50">
          <ul className="space-y-1">
            {categories.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => handleNavClick(id)}
                  className={`w-full flex items-center gap-3 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
        <main ref={mainPanelRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 divide-y divide-border-color/50">
            <ProviderSettingsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                discoveredServices,
                onDetectServices,
                isDetecting,
                sectionRef: (el) => (sectionRefs.current.provider = el),
              }}
            />
            <AppearanceSettingsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                sectionRef: (el) => (sectionRefs.current.appearance = el),
              }}
            />
            <KeyboardShortcutsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                commands,
                sectionRef: (el) => (sectionRefs.current.shortcuts = el),
              }}
            />
            <PythonSettingsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                sectionRef: (el) => (sectionRefs.current.python = el),
                onValidationChange: setPythonValidationError,
              }}
            />
            <GeneralSettingsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                sectionRef: (el) => (sectionRefs.current.general = el),
              }}
            />
            <DatabaseSettingsSection {...{ sectionRef: (el) => (sectionRefs.current.database = el) }} />
            <AdvancedSettingsSection
              {...{
                settings: currentSettings,
                setCurrentSettings,
                sectionRef: (el) => (sectionRefs.current.advanced = el),
              }}
            />
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
    sectionRef: (el: HTMLDivElement | null) => void;
}

const ProviderSettingsSection: React.FC<SectionProps & { discoveredServices: DiscoveredLLMService[], onDetectServices: () => void, isDetecting: boolean }> = ({ settings, setCurrentSettings, discoveredServices, onDetectServices, isDetecting, sectionRef }) => {
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
        <section id="provider" ref={sectionRef} className="py-6 space-y-8">
            <SettingsGroupCard
                title="LLM Provider"
                description="Connect DocForge to local discovery services and choose which language model powers AI-assisted workflows."
                icon={<SparklesIcon className="w-5 h-5" />}
            >
                <SettingRow
                    label="Detect Services"
                    description="Scan for locally running LLM services like Ollama and LM Studio."
                    inlineDescription={
                        detectionError
                            ? <span className="text-destructive-text">{detectionError}</span>
                            : 'Run discovery again whenever you start a new local service or change network access.'
                    }
                    contentVariant="soft"
                >
                    <Button
                        onClick={onDetectServices}
                        disabled={isDetecting}
                        variant="secondary"
                        isLoading={isDetecting}
                        className="w-full sm:w-60"
                    >
                        {isDetecting ? 'Detecting…' : 'Re-Detect Services'}
                    </Button>
                </SettingRow>
                <SettingRow
                    label="Detected Service"
                    description="Choose a running service to connect to for AI features."
                    inlineDescription="Only active services appear here. Configure remote providers from the Advanced settings if needed."
                    contentVariant="soft"
                >
                    <select
                        id="llmService"
                        value={selectedService?.id || ''}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        disabled={discoveredServices.length === 0}
                        className="w-full sm:w-60 p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                    >
                        <option value="" disabled>{discoveredServices.length > 0 ? 'Select a service' : 'No services detected'}</option>
                        {discoveredServices.map(service => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                    </select>
                </SettingRow>
                <SettingRow
                    label="Model Name"
                    description="Select which model to use for generating titles and refining documents."
                    inlineDescription="Model availability refreshes automatically after you select a provider."
                    contentVariant="soft"
                >
                    <div className="relative w-full sm:w-60">
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
            </SettingsGroupCard>
        </section>
    );
};

const AppearanceSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
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



    return (
        <section id="appearance" ref={sectionRef} className="py-6 space-y-8">
            <SettingsGroupCard
                title="Interface"
                description="Tune the overall scale of DocForge and pick an icon family that matches your workflow."
                icon={<SunIcon className="w-5 h-5" />}
            >
                <SettingRow
                    label="Interface Scale"
                    description="Adjust the size of all UI elements in the application."
                    inlineDescription="Higher values boost readability on high-density displays while lower values create a denser layout."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Icon Set"
                    description="Customize the look of icons throughout the application."
                    inlineDescription="Icon previews reflect the current theme to help you compare contrast and weight."
                    contentVariant="soft"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 w-full">
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
            </SettingsGroupCard>

            <SettingsGroupCard
                title="Markdown Layout"
                description="Control the typography, spacing, and readable width of generated documents."
            >
                <SettingRow
                    label="Markdown Font Size"
                    description="Adjust the base font size for the Markdown preview."
                    inlineDescription="Use smaller sizes for dense dashboards or larger values for presentation views."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Markdown Line Height"
                    description="Control the spacing between lines of text for better readability."
                    inlineDescription="Increased line spacing helps when presenting documentation on large displays."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Markdown Heading Spacing"
                    description="Control the vertical space above headings to tighten or relax sections."
                    inlineDescription="Helpful when preparing compact reports where headings need more breathing room."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Markdown Paragraph Spacing"
                    description="Adjust the space between paragraphs and block elements."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Markdown Max Width"
                    description="Set the maximum width of the text content to improve line length."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                    label="Document Vertical Padding"
                    description="Control the padding above and below the rendered document."
                    contentVariant="soft"
                >
                    <div className="flex items-center gap-4 w-full sm:w-64">
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
            </SettingsGroupCard>

            <SettingsGroupCard
                title="Typography"
                description="Choose font families used across the Markdown preview and the editor interface."
            >
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
            </SettingsGroupCard>

            <SettingsGroupCard
                title="Code Presentation"
                description="Align code-focused areas with your preferred density and theme."
            >
                <SettingRow
                  label="Code Block Font Size"
                  description="Adjust the font size used inside fenced code blocks."
                  contentVariant="soft"
                >
                  <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                  label="Editor Font Size"
                  description="Set the default font size for the code editor."
                  htmlFor="editorFontSize"
                  contentVariant="soft"
                >
                  <div className="flex items-center gap-4 w-full sm:w-64">
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
                <SettingRow
                  label="Code Block Background (Light Theme)"
                  description="Adjust the background color for Markdown code blocks when using the light theme."
                  htmlFor="markdownCodeBlockBackgroundLight"
                  contentVariant="soft"
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
                  contentVariant="soft"
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
            </SettingsGroupCard>
        </section>
    );
};


interface PythonSectionProps extends SectionProps {
  onValidationChange?: (message: string | null) => void;
}

const PythonSettingsSection: React.FC<PythonSectionProps> = ({ settings, setCurrentSettings, sectionRef, onValidationChange }) => {
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
    <section id="python" ref={sectionRef} className="py-6 space-y-8">
      <SettingsGroupCard
        title="Python Execution"
        description="Configure how DocForge prepares isolated Python environments. These defaults apply when a document automatically provisions a virtual environment."
        icon={<TerminalIcon className="w-5 h-5" />}
      >
        <SettingRow
          label="Target Python Version"
          description="Preferred Python version when creating new virtual environments."
          inlineDescription="Use semantic version ranges (e.g. 3.11) to align with your interpreters."
          contentVariant="soft"
        >
          <input
            type="text"
            value={settings.pythonDefaults.targetPythonVersion}
            onChange={(e) => setCurrentSettings((prev) => ({
              ...prev,
              pythonDefaults: { ...prev.pythonDefaults, targetPythonVersion: e.target.value.trim() },
            }))}
            className="w-full sm:w-64 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="3.11"
          />
        </SettingRow>
        <SettingRow
          label="Default Packages"
          description="One package per line. Versions can use ==, >=, <=, etc."
          inlineDescription="DocForge installs these packages whenever it bootstraps a managed environment."
          contentVariant="soft"
        >
          <textarea
            value={packagesInput}
            onChange={(e) => handlePackagesChange(e.target.value)}
            className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="numpy\npandas\nrequests"
          />
        </SettingRow>
        <SettingRow
          label="Default Environment Variables"
          description="JSON object defining environment variables applied to every run."
          inlineDescription={
            envVarError ? <span className="text-destructive-text">{envVarError}</span> : 'Provide a JSON object with string values to share credentials or toggles across runs.'
          }
          contentVariant="soft"
        >
          <textarea
            value={envVarJson}
            onChange={(e) => handleEnvVarChange(e.target.value)}
            className="w-full h-32 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </SettingRow>
        <SettingRow
          label="Default Working Directory"
          description="Optional directory used when running scripts if no environment-specific directory is set."
          inlineDescription="Leave blank to execute scripts from the document location."
          contentVariant="soft"
        >
          <input
            type="text"
            value={settings.pythonWorkingDirectory ?? ''}
            onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="/path/to/projects"
          />
        </SettingRow>
        <SettingRow
          label="Console Theme"
          description="Theme used for the dedicated Python output window."
          inlineDescription="Switch to light mode for brighter projectors or dark mode for contrast-rich coding sessions."
          contentVariant="soft"
        >
          <select
            value={settings.pythonConsoleTheme}
            onChange={(e) => handleConsoleThemeChange(e.target.value as 'light' | 'dark')}
            className="w-full sm:w-64 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </SettingRow>
      </SettingsGroupCard>

      <SettingsGroupCard
        title="Managed Environments"
        description="Create reusable Python virtual environments with curated packages."
        headerAction={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => { refreshEnvironments(); refreshInterpreters(); }}
              isLoading={isLoading || isDetecting}
            >
              <RefreshIcon className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button onClick={openCreateModal}>
              <PlusIcon className="w-4 h-4 mr-1" /> New Environment
            </Button>
          </div>
        }
        contentClassName="space-y-4"
        tone="muted"
      >
        {environments.length === 0 ? (
          <p className="text-xs text-text-secondary">No environments configured yet.</p>
        ) : (
          environments.map((env) => (
            <div key={env.envId} className="border border-border-color rounded-xl p-4 bg-secondary/40">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-text-main">{env.name}</p>
                  <p className="text-xs text-text-secondary">Python {env.pythonVersion} • {env.managed ? 'Managed' : 'External'}</p>
                  <p className="text-xs text-text-secondary break-all">{env.pythonExecutable}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => openEditModal(env)}>Edit</Button>
                  <Button variant="secondary" onClick={() => handleDeleteEnvironment(env)} className="text-destructive-text border-destructive-border">Delete</Button>
                </div>
              </div>
              {env.description && <p className="text-xs text-text-secondary mt-2">{env.description}</p>}
              {env.packages.length > 0 && (
                <p className="text-xs text-text-secondary mt-2">Packages: {env.packages.map((pkg) => pkg.version ? `${pkg.name}${pkg.version}` : pkg.name).join(', ')}</p>
              )}
            </div>
          ))
        )}
      </SettingsGroupCard>

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

const GeneralSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
    return (
        <section id="general" ref={sectionRef} className="py-6 space-y-8">
            <SettingsGroupCard
                title="General"
                description="Global preferences that control updates and background maintenance."
                icon={<GearIcon className="w-5 h-5" />}
            >
                <SettingRow
                    htmlFor="allowPrerelease"
                    label="Receive Pre-releases"
                    description="Get notified about new beta versions and test features early."
                    inlineDescription="Pre-release builds may include experimental features and occasional instability."
                    contentVariant="soft"
                    align="center"
                >
                    <ToggleSwitch id="allowPrerelease" checked={settings.allowPrerelease} onChange={(val) => setCurrentSettings(s => ({...s, allowPrerelease: val}))} />
                </SettingRow>
                <SettingRow
                    htmlFor="autoSaveLogs"
                    label="Auto-save Logs"
                    description="Automatically save all logs to a daily file on your computer for debugging."
                    inlineDescription="Logs are stored locally and rotated daily to simplify troubleshooting."
                    contentVariant="soft"
                    align="center"
                >
                    <ToggleSwitch id="autoSaveLogs" checked={settings.autoSaveLogs} onChange={(val) => setCurrentSettings(s => ({...s, autoSaveLogs: val}))} />
                </SettingRow>
            </SettingsGroupCard>
        </section>
    );
};

const DatabaseSettingsSection: React.FC<{sectionRef: (el: HTMLDivElement | null) => void}> = ({ sectionRef }) => {
    const [dbPath, setDbPath] = useState<string>('Loading...');
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [operation, setOperation] = useState<{
        name: 'backup' | 'integrity' | 'vacuum';
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
    
    const operationInlineDescription = operation
        ? operation.status === 'running'
            ? 'Maintenance task running…'
            : operation.message
        : 'Run maintenance tasks periodically to keep the database responsive.';

    const operationClass = operation?.status === 'error'
        ? 'text-destructive-text'
        : operation?.status === 'success'
            ? 'text-success'
            : 'text-text-secondary';

    return (
         <section id="database" ref={sectionRef} className="py-6 space-y-8">
            <SettingsGroupCard
                title="Database Management"
                description="Inspect the local database, trigger maintenance tasks, and monitor storage usage."
                icon={<DatabaseIcon className="w-5 h-5" />}
            >
                <SettingRow
                    label="Database File"
                    description="This file contains all your documents, folders, and history."
                    inlineDescription="Copy the path to back up or move the database to a new location."
                    contentVariant="soft"
                >
                    <div className="text-sm text-text-main bg-background px-3 py-2 rounded-md border border-border-color w-full font-mono text-xs select-all break-all">
                        {dbPath}
                    </div>
                </SettingRow>
                <SettingRow
                    label="Operations"
                    description="Perform maintenance tasks on the application database."
                    inlineDescription={<span className={`text-xs ${operationClass}`}>{operationInlineDescription}</span>}
                    contentVariant="soft"
                    align="center"
                >
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleBackup} variant="secondary" isLoading={operation?.name === 'backup' && operation.status === 'running'}><SaveIcon className="w-4 h-4 mr-2" /> Backup</Button>
                        <Button onClick={handleIntegrityCheck} variant="secondary" isLoading={operation?.name === 'integrity' && operation.status === 'running'}><CheckIcon className="w-4 h-4 mr-2" /> Check Integrity</Button>
                        <Button onClick={handleVacuum} variant="secondary" isLoading={operation?.name === 'vacuum' && operation.status === 'running'}><SparklesIcon className="w-4 h-4 mr-2" /> Vacuum</Button>
                    </div>
                </SettingRow>
                <SettingRow
                    label="Statistics"
                    description="An overview of the database contents and size."
                    contentVariant="soft"
                    contentClassName="block"
                >
                     {isLoadingStats ? <Spinner/> : !stats ? <p className="text-sm text-destructive-text">Could not load stats.</p> : (
                        <div className="w-full space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div className="bg-background p-3 rounded-md border border-border-color"><strong>File Size:</strong> {stats.fileSize}</div>
                                <div className="bg-background p-3 rounded-md border border-border-color"><strong>Schema Version:</strong> {stats.schemaVersion}</div>
                                <div className="bg-background p-3 rounded-md border border-border-color"><strong>Page Size:</strong> {stats.pageSize} bytes</div>
                                <div className="bg-background p-3 rounded-md border border-border-color"><strong>Page Count:</strong> {stats.pageCount}</div>
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
                                        {stats.tables.map(table => (
                                            <tr key={table.name} className="bg-secondary">
                                                <td className="p-2 font-mono">{table.name}</td>
                                                <td className="p-2 font-mono text-right">{table.rowCount}</td>
                                                <td className="p-2 font-mono text-xs text-text-secondary">{table.indexes.join(', ') || 'none'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                     )}
                </SettingRow>
            </SettingsGroupCard>
        </section>
    );
};

const AdvancedSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
    const [jsonString, setJsonString] = useState(() => JSON.stringify(settings, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [mode, setMode] = useState<'tree' | 'json'>('tree');

    useEffect(() => {
        setJsonString(JSON.stringify(settings, null, 2));
        setJsonError(null);
    },[settings]);

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

    return (
         <section id="advanced" ref={sectionRef} className="py-6 space-y-8">
            <SettingsGroupCard
                title="Advanced"
                description="Directly edit the configuration tree or raw JSON when you need precise control."
                icon={<FileIcon className="w-5 h-5" />}
            >
                <SettingRow
                    label="Settings Editor"
                    description="Edit settings using an interactive tree or raw JSON for full control."
                    inlineDescription="Switch between the visual tree editor and raw JSON to inspect or copy configuration snippets."
                    contentVariant="soft"
                    contentClassName="block"
                >
                    <div className="w-full">
                        <div className="flex justify-end mb-2">
                            <div className="flex items-center p-1 bg-background rounded-lg border border-border-color">
                                <button onClick={() => setMode('tree')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'tree' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'}`}>
                                    Tree
                                </button>
                                <button onClick={() => setMode('json')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'json' ? 'bg-secondary text-primary' : 'text-text-secondary hover:bg-border-color/50'}`}>
                                    JSON
                                </button>
                            </div>
                        </div>

                        {mode === 'tree' ? (
                            <SettingsTreeEditor settings={settings} onSettingChange={handleSettingChange} />
                        ) : (
                            <div>
                                <JsonEditor value={jsonString} onChange={handleJsonChange} />
                                {jsonError && <p className="text-sm text-destructive-text mt-2">{jsonError}</p>}
                            </div>
                        )}
                    </div>
                </SettingRow>
            </SettingsGroupCard>
        </section>
    );
};


export default SettingsView;

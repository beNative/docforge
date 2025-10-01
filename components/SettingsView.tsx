import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Settings, DiscoveredLLMService, DiscoveredLLMModel, DatabaseStats, Command } from '../types';
import { llmDiscoveryService } from '../services/llmDiscoveryService';
import { DEFAULT_SETTINGS } from '../constants';
import { SparklesIcon, FileIcon, SunIcon, GearIcon, DatabaseIcon, SaveIcon, CheckIcon, KeyboardIcon } from './Icons';
import * as HeroIcons from './iconsets/Heroicons';
import * as LucideIcons from './iconsets/Lucide';
import * as FeatherIcons from './iconsets/Feather';
import * as TablerIcons from './iconsets/Tabler';
import * as MaterialIcons from './iconsets/Material';
import Spinner from './Spinner';
import Button from './Button';
import JsonEditor from './JsonEditor';
import { repository } from '../services/repository';
import ToggleSwitch from './ToggleSwitch';
import SettingRow from './SettingRow';
import SettingsTreeEditor from './SettingsTreeEditor';
import { useLogger } from '../hooks/useLogger';
import KeyboardShortcutsSection from './KeyboardShortcutsSection';

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  discoveredServices: DiscoveredLLMService[];
  onDetectServices: () => void;
  isDetecting: boolean;
  commands: Command[];
}

type SettingsCategory = 'provider' | 'appearance' | 'shortcuts' | 'general' | 'database' | 'advanced';

const categories: { id: SettingsCategory; label: string; icon: React.FC<{className?: string}> }[] = [
  { id: 'provider', label: 'LLM Provider', icon: SparklesIcon },
  { id: 'appearance', label: 'Appearance', icon: SunIcon },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: KeyboardIcon },
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'database', label: 'Database', icon: DatabaseIcon },
  { id: 'advanced', label: 'Advanced', icon: FileIcon },
];


type FontField = 'markdownBodyFontFamily' | 'markdownHeadingFontFamily' | 'markdownCodeFontFamily';
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
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-recommended`}>Recommended</label>
            <select
              id={`${id}-recommended`}
              value={matchingOption ? matchingOption.value : ''}
              onChange={handleSelect}
              className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
            >
              <option value="">Choose a font…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-custom`}>Custom value</label>
            <input
              id={`${id}-custom`}
              type="text"
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {helperText && <p className="text-xs text-text-secondary mt-1">{helperText}</p>}
          </div>
        </div>
        <div className="md:w-64 bg-secondary/60 border border-border-color rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Preview</div>
          <div
            className="rounded-md bg-background border border-border-color px-3 py-3 text-sm text-text-main"
            style={{ fontFamily: previewFamily }}
          >
            The quick brown fox jumps over the lazy dog 0123456789.
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


const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, discoveredServices, onDetectServices, isDetecting, commands }) => {
  const [currentSettings, setCurrentSettings] = useState<Settings>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [visibleCategory, setVisibleCategory] = useState<SettingsCategory>('provider');
  const { addLog } = useLogger();

  // Fix: Use Partial for the record type to allow an empty object as the initial value for the ref.
  const sectionRefs = useRef<Partial<Record<SettingsCategory, HTMLDivElement | null>>>({});
  const mainPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(settings) !== JSON.stringify(currentSettings));
  }, [settings, currentSettings]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCategory(entry.target.id as SettingsCategory);
          }
        });
      },
      {
        root: mainPanelRef.current,
        rootMargin: '-40% 0px -60% 0px',
        threshold: 0,
      }
    );

    const refs = sectionRefs.current;
    Object.values(refs).forEach((ref) => {
      if (ref instanceof Element) observer.observe(ref);
    });

    return () => {
      Object.values(refs).forEach((ref) => {
        if (ref instanceof Element) observer.unobserve(ref);
      });
    };
  }, []);

  const handleSave = () => {
    addLog('INFO', 'User action: Save settings.');
    onSave(currentSettings);
  };
  
  const handleNavClick = (id: SettingsCategory) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="flex justify-between items-center p-4 border-b border-border-color flex-shrink-0">
        <h1 className="text-xl font-semibold text-text-main">Settings</h1>
        <Button
            onClick={handleSave}
            disabled={!isDirty}
            variant="primary"
          >
            {isDirty ? 'Save Changes' : 'Saved'}
        </Button>
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
            <ProviderSettingsSection {...{ settings: currentSettings, setCurrentSettings, discoveredServices, onDetectServices, isDetecting, sectionRef: el => sectionRefs.current.provider = el }} />
            <AppearanceSettingsSection {...{ settings: currentSettings, setCurrentSettings, sectionRef: el => sectionRefs.current.appearance = el }} />
            <KeyboardShortcutsSection {...{ settings: currentSettings, setCurrentSettings, commands, sectionRef: el => sectionRefs.current.shortcuts = el }} />
            <GeneralSettingsSection {...{ settings: currentSettings, setCurrentSettings, sectionRef: el => sectionRefs.current.general = el }} />
            <DatabaseSettingsSection {...{ sectionRef: el => sectionRefs.current.database = el }} />
            <AdvancedSettingsSection {...{ settings: currentSettings, setCurrentSettings, sectionRef: el => sectionRefs.current.advanced = el }} />
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
        <div id="provider" ref={sectionRef} className="py-6">
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
        </div>
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



    return (
        <div id="appearance" ref={sectionRef} className="py-6">
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
            </div>
        </div>
    );
};

const GeneralSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
    return (
         <div id="general" ref={sectionRef} className="py-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">General</h2>
            <div className="space-y-6">
                 <SettingRow htmlFor="allowPrerelease" label="Receive Pre-releases" description="Get notified about new beta versions and test features early.">
                    <ToggleSwitch id="allowPrerelease" checked={settings.allowPrerelease} onChange={(val) => setCurrentSettings(s => ({...s, allowPrerelease: val}))} />
                </SettingRow>
                 <SettingRow htmlFor="autoSaveLogs" label="Auto-save Logs" description="Automatically save all logs to a daily file on your computer for debugging.">
                    <ToggleSwitch id="autoSaveLogs" checked={settings.autoSaveLogs} onChange={(val) => setCurrentSettings(s => ({...s, autoSaveLogs: val}))} />
                </SettingRow>
            </div>
        </div>
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
    
    return (
         <div id="database" ref={sectionRef} className="py-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">Database Management</h2>
            <div className="space-y-6">
                 <SettingRow label="Database File" description="This file contains all your documents, folders, and history.">
                    <div className="text-sm text-text-main bg-background px-3 py-2 rounded-md border border-border-color w-full font-mono text-xs select-all break-all">
                        {dbPath}
                    </div>
                </SettingRow>
                <SettingRow label="Operations" description="Perform maintenance tasks on the application database.">
                    <div className="flex flex-col items-end w-full gap-2">
                        <div className="flex items-center gap-2">
                            <Button onClick={handleBackup} variant="secondary" isLoading={operation?.name === 'backup' && operation.status === 'running'}><SaveIcon className="w-4 h-4 mr-2" /> Backup</Button>
                            <Button onClick={handleIntegrityCheck} variant="secondary" isLoading={operation?.name === 'integrity' && operation.status === 'running'}><CheckIcon className="w-4 h-4 mr-2" /> Check Integrity</Button>
                            <Button onClick={handleVacuum} variant="secondary" isLoading={operation?.name === 'vacuum' && operation.status === 'running'}><SparklesIcon className="w-4 h-4 mr-2" /> Vacuum</Button>
                        </div>
                        {operation && (
                            <p className={`text-xs mt-2 text-right ${operation.status === 'error' ? 'text-error' : 'text-success'}`}>{operation.message}</p>
                        )}
                    </div>
                </SettingRow>
                <SettingRow label="Statistics" description="An overview of the database contents and size.">
                     {isLoadingStats ? <Spinner/> : !stats ? <p className="text-sm text-error">Could not load stats.</p> : (
                        <div className="w-full space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
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
            </div>
        </div>
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
         <div id="advanced" ref={sectionRef} className="py-6">
            <h2 className="text-lg font-semibold text-text-main mb-4">Advanced</h2>
            <div className="space-y-6">
                <SettingRow label="Settings Editor" description="Edit settings using an interactive tree or raw JSON for full control.">
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
            </div>
        </div>
    );
};


export default SettingsView;

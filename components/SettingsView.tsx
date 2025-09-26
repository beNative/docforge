import React, { useState, useEffect, useRef } from 'react';
import type { Settings, DiscoveredLLMService, DiscoveredLLMModel } from '../types';
import { llmDiscoveryService } from '../services/llmDiscoveryService';
import { SparklesIcon, FileIcon, SunIcon, GearIcon, DatabaseIcon } from './Icons';
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

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  discoveredServices: DiscoveredLLMService[];
  onDetectServices: () => void;
  isDetecting: boolean;
}

type SettingsCategory = 'provider' | 'appearance' | 'general' | 'database' | 'advanced';

const categories: { id: SettingsCategory; label: string; icon: React.FC<{className?: string}> }[] = [
  { id: 'provider', label: 'LLM Provider', icon: SparklesIcon },
  { id: 'appearance', label: 'Appearance', icon: SunIcon },
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'database', label: 'Database', icon: DatabaseIcon },
  { id: 'advanced', label: 'Advanced', icon: FileIcon },
];

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, discoveredServices, onDetectServices, isDetecting }) => {
  const [currentSettings, setCurrentSettings] = useState<Settings>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [visibleCategory, setVisibleCategory] = useState<SettingsCategory>('provider');

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
    onSave(currentSettings);
  };
  
  const handleNavClick = (id: SettingsCategory) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="flex justify-between items-center p-6 border-b border-border-color flex-shrink-0">
        <h1 className="text-2xl font-semibold text-text-main">Settings</h1>
        <Button
            onClick={handleSave}
            disabled={!isDirty}
            variant="primary"
          >
            {isDirty ? 'Save Changes' : 'Saved'}
        </Button>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <nav className="w-56 p-4 border-r border-border-color bg-secondary/50">
          <ul className="space-y-1">
            {categories.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => handleNavClick(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    visibleCategory === id
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-border-color/50 hover:text-text-main'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main ref={mainPanelRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-12 divide-y divide-border-color/50">
            <ProviderSettingsSection {...{ settings: currentSettings, setCurrentSettings, discoveredServices, onDetectServices, isDetecting, sectionRef: el => sectionRefs.current.provider = el }} />
            <AppearanceSettingsSection {...{ settings: currentSettings, setCurrentSettings, sectionRef: el => sectionRefs.current.appearance = el }} />
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
        <div id="provider" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-6">LLM Provider</h2>
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
                        className="w-60 p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                    >
                        <option value="" disabled>{discoveredServices.length > 0 ? 'Select a service' : 'No services detected'}</option>
                        {discoveredServices.map(service => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                    </select>
                </SettingRow>
                <SettingRow label="Model Name" description="Select which model to use for generating titles and refining prompts.">
                     <div className="relative w-60">
                       <select
                            id="llmModelName"
                            value={settings.llmModelName}
                            onChange={(e) => setCurrentSettings(prev => ({ ...prev, llmModelName: e.target.value }))}
                            disabled={!selectedService || availableModels.length === 0}
                            className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
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
            <h4 className="font-semibold text-text-main text-sm">{name}</h4>
        </button>
    );

    return (
        <div id="appearance" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-6">Appearance</h2>
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
                        <span className="font-semibold text-text-main tabular-nums min-w-[50px] text-right">{settings.uiScale}%</span>
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
            </div>
        </div>
    );
};

const GeneralSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
    return (
         <div id="general" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-6">General</h2>
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
    return (
         <div id="database" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-6">Database</h2>
            <div className="space-y-6">
                 <SettingRow label="Database File" description="The application's data is stored in a local SQLite database file.">
                    <div className="text-sm text-text-main bg-background px-3 py-2 rounded-md border border-border-color w-full">
                        <p>Location: (managed by the application)</p>
                        <p className="mt-1 text-xs text-text-secondary">This file contains all your prompts, folders, and history.</p>
                    </div>
                </SettingRow>
            </div>
        </div>
    );
};

const AdvancedSettingsSection: React.FC<Pick<SectionProps, 'settings' | 'setCurrentSettings' | 'sectionRef'>> = ({ settings, setCurrentSettings, sectionRef }) => {
    const [jsonString, setJsonString] = useState(() => JSON.stringify(settings, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

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
    
    return (
         <div id="advanced" ref={sectionRef} className="py-10">
            <h2 className="text-xl font-semibold text-text-main mb-6">Advanced</h2>
            <div className="space-y-6">
                 <SettingRow label="JSON Editor" description="Directly edit the settings object. Changes here will be reflected above and saved when you click 'Save Changes'.">
                    <div>
                        <JsonEditor value={jsonString} onChange={handleJsonChange} />
                        {jsonError && <p className="text-sm text-destructive-text mt-2">{jsonError}</p>}
                    </div>
                </SettingRow>
            </div>
        </div>
    );
};


export default SettingsView;
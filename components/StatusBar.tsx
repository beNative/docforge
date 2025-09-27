import React from 'react';
import type { LLMStatus, DiscoveredLLMModel, DiscoveredLLMService } from '../types';

interface StatusBarProps {
  status: LLMStatus;
  modelName: string;
  llmProviderName: string;
  llmProviderUrl: string;
  documentCount: number;
  lastSaved?: string;
  availableModels: DiscoveredLLMModel[];
  onModelChange: (modelId: string) => void;
  discoveredServices: DiscoveredLLMService[];
  onProviderChange: (serviceId: string) => void;
  appVersion: string;
}

const statusConfig: Record<LLMStatus, { text: string; color: string; tooltip: string }> = {
  checking: {
    text: 'Checking...',
    color: 'bg-warning',
    tooltip: 'Attempting to connect to the local LLM provider.',
  },
  connected: {
    text: 'Connected',
    color: 'bg-success',
    tooltip: 'Successfully connected to the local LLM provider.',
  },
  error: {
    text: 'Connection Error',
    color: 'bg-error',
    tooltip: 'Failed to connect. Check your settings and ensure the provider is running.',
  },
};

const StatusBar: React.FC<StatusBarProps> = ({ 
    status, modelName, llmProviderName, llmProviderUrl, documentCount, lastSaved, availableModels, onModelChange, discoveredServices, onProviderChange, appVersion
}) => {
  const { text, color, tooltip } = statusConfig[status];
  const selectedService = discoveredServices.find(s => s.generateUrl === llmProviderUrl);

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Not saved yet';
    try {
      return new Date(isoString).toLocaleTimeString();
    } catch {
      return 'Invalid date';
    }
  };

  const selectStyles: React.CSSProperties = {
      maxWidth: '200px', 
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: 'right 0.2rem center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '1.2em 1.2em',
  };
  
  return (
    <footer className="flex items-center justify-between px-4 h-8 bg-secondary border-t border-border-color text-xs text-text-secondary flex-shrink-0 z-30">
      <div className="flex items-center gap-4">
        <div className="relative group flex items-center gap-2 cursor-default">
          <div className={`w-2 h-2 rounded-full ${color}`}></div>
          <span className="font-medium">{text}</span>
          <span className="absolute bottom-full z-50 mb-2 w-max px-2 py-1 text-xs text-tooltip-text bg-tooltip-bg rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {tooltip}
          </span>
        </div>
        <div className="h-4 w-px bg-border-color"></div>
        <div className="flex items-center gap-1">
          <label htmlFor="status-bar-provider-select" className="shrink-0">Provider:</label>
           <select
            id="status-bar-provider-select"
            value={selectedService?.id || ''}
            onChange={(e) => onProviderChange(e.target.value)}
            disabled={discoveredServices.length === 0}
            className="bg-transparent font-semibold text-text-main rounded-md p-1 -m-1 hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-5"
            style={selectStyles}
          >
            {llmProviderName && !selectedService && <option value="" disabled>{llmProviderName}</option>}
            {discoveredServices.map(service => (
              <option key={service.id} value={service.id} className="bg-secondary text-text-main">{service.name}</option>
            ))}
            {discoveredServices.length === 0 && <option value="">{llmProviderName || 'N/A'}</option>}
          </select>
        </div>
        <div className="h-4 w-px bg-border-color"></div>
        <div className="flex items-center gap-1">
          <label htmlFor="status-bar-model-select" className="shrink-0">Model:</label>
          <select
            id="status-bar-model-select"
            value={modelName}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={availableModels.length === 0}
            className="bg-transparent font-semibold text-text-main rounded-md p-1 -m-1 hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-5"
            style={selectStyles}
          >
            {availableModels.length > 0 ? (
              availableModels.map(model => (
                <option key={model.id} value={model.id} className="bg-secondary text-text-main">{model.name}</option>
              ))
            ) : (
              <option value="">{modelName || 'N/A'}</option>
            )}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span>Documents: <span className="font-semibold text-text-main">{documentCount}</span></span>
        <div className="h-4 w-px bg-border-color"></div>
        <span>Last Saved: <span className="font-semibold text-text-main">{formatTimestamp(lastSaved)}</span></span>
        {appVersion && <div className="h-4 w-px bg-border-color"></div>}
        {appVersion && <span>v{appVersion}</span>}
      </div>
    </footer>
  );
};

export default StatusBar;
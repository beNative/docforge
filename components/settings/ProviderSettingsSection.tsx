import React, { useState, useEffect } from 'react';
import type { DiscoveredLLMService, DiscoveredLLMModel } from '../../types';
import type { SectionProps } from './SettingsHelpers';
import { llmDiscoveryService } from '../../services/llmDiscoveryService';
import Button from '../Button';
import Spinner from '../Spinner';
import SettingRow from '../SettingRow';

interface ProviderSettingsSectionProps extends SectionProps {
  discoveredServices: DiscoveredLLMService[];
  onDetectServices: () => void;
  isDetecting: boolean;
}

export const ProviderSettingsSection: React.FC<ProviderSettingsSectionProps> = ({
  settings,
  setCurrentSettings,
  discoveredServices,
  onDetectServices,
  isDetecting,
}) => {
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
      const currentService = discoveredServices.find((s) => s.generateUrl === settings.llmProviderUrl);
      if (currentService) {
        setIsFetchingModels(true);
        try {
          const models = await llmDiscoveryService.fetchModels(currentService);
          setAvailableModels(models);
        } catch (error) {
          console.error('Failed to fetch models for current service:', error);
          setAvailableModels([]);
        } finally {
          setIsFetchingModels(false);
        }
      } else {
        setAvailableModels([]);
      }
    };
    fetchModelsForCurrentService();
  }, [discoveredServices, settings.llmProviderUrl]);

  const handleServiceChange = async (serviceId: string) => {
    const selectedService = discoveredServices.find((s) => s.id === serviceId);
    if (!selectedService) return;

    setCurrentSettings((prev) => ({
      ...prev,
      llmProviderUrl: selectedService.generateUrl,
      llmProviderName: selectedService.name,
      apiType: selectedService.apiType,
      llmModelName: '',
    }));
  };

  const selectedService = discoveredServices.find((s) => s.generateUrl === settings.llmProviderUrl);

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
            <option value="" disabled>
              {discoveredServices.length > 0 ? 'Select a service' : 'No services detected'}
            </option>
            {discoveredServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Model Name" description="Select which model to use for generating titles and refining documents.">
          <div className="relative w-60">
            <select
              id="llmModelName"
              value={settings.llmModelName}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, llmModelName: e.target.value }))}
              disabled={!selectedService || availableModels.length === 0}
              className="w-full p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
            >
              <option value="" disabled>
                {!selectedService ? 'Select service first' : 'Select a model'}
              </option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            {isFetchingModels && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner />
              </div>
            )}
          </div>
        </SettingRow>
      </div>
    </section>
  );
};

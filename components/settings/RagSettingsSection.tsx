import React, { useState, useEffect } from 'react';
import type { DiscoveredLLMService, DiscoveredLLMModel } from '../../types';
import type { SectionProps } from './SettingsHelpers';
import { llmDiscoveryService } from '../../services/llmDiscoveryService';
import { ragService } from '../../services/ragService';
import Button from '../Button';
import Spinner from '../Spinner';
import SettingRow from '../SettingRow';

interface RagSettingsSectionProps extends SectionProps {
  discoveredServices: DiscoveredLLMService[];
}

export const RagSettingsSection: React.FC<RagSettingsSectionProps> = ({
  settings,
  setCurrentSettings,
  discoveredServices,
}) => {
  const [availableModels, setAvailableModels] = useState<DiscoveredLLMModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    const fetchModelsForRagService = async () => {
      const currentService = discoveredServices.find((s) => s.generateUrl === settings.ragEmbeddingProviderUrl);
      if (currentService) {
        setIsFetchingModels(true);
        try {
          const models = await llmDiscoveryService.fetchModels(currentService);
          setAvailableModels(models);
        } catch (error) {
          console.error('Failed to fetch models for RAG service:', error);
          setAvailableModels([]);
        } finally {
          setIsFetchingModels(false);
        }
      } else {
        setAvailableModels([]);
      }
    };
    fetchModelsForRagService();
  }, [discoveredServices, settings.ragEmbeddingProviderUrl]);

  return (
    <section className="pt-2 pb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-text-main">RAG / Embeddings</h2>
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
          Local Vector Search
        </span>
      </div>
      <p className="text-xs text-text-tertiary mb-6">
        Configure how DocForge indexes your documents for semantic search and chat. We recommend using <strong>Ollama</strong> with{' '}
        <strong>nomic-embed-text</strong> for a fast, private, and free experience.
      </p>

      <div className="space-y-6">
        <SettingRow
          label="Embedding Provider"
          description="The service used to generate vector embeddings. Choose a running service from the list."
        >
          <select
            id="ragProvider"
            value={discoveredServices.find((s) => s.generateUrl === settings.ragEmbeddingProviderUrl)?.id || ''}
            onChange={(e) => {
              const service = discoveredServices.find((s) => s.id === e.target.value);
              if (service) {
                setCurrentSettings((prev) => ({ ...prev, ragEmbeddingProviderUrl: service.generateUrl }));
              }
            }}
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

        <SettingRow
          label="Embedding Model"
          description="The specific model used for embeddings. 'nomic-embed-text' is highly recommended."
        >
          <div className="flex flex-col gap-2 w-60">
            <div className="relative w-full">
              <select
                id="ragModel"
                value={availableModels.some((m) => m.id === settings.ragEmbeddingModelName) ? settings.ragEmbeddingModelName : ''}
                onChange={(e) => setCurrentSettings((prev) => ({ ...prev, ragEmbeddingModelName: e.target.value }))}
                disabled={availableModels.length === 0}
                className="w-full p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
              >
                <option value="" disabled>
                  {availableModels.length > 0 ? 'Select a model' : 'No models found'}
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

            <div className="space-y-1">
              <label className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">Manual Model Name</label>
              <input
                type="text"
                value={settings.ragEmbeddingModelName}
                onChange={(e) => setCurrentSettings((prev) => ({ ...prev, ragEmbeddingModelName: e.target.value }))}
                placeholder="e.g. nomic-embed-text"
                className="w-full p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <Button
              onClick={async () => {
                const btn = document.activeElement as HTMLButtonElement;
                if (btn) btn.disabled = true;
                try {
                  await ragService.search('test connection', settings);
                  alert('Connection successful! The model is responsive.');
                } catch (err: any) {
                  alert('Connection failed: ' + (err.message || String(err)));
                } finally {
                  if (btn) btn.disabled = false;
                }
              }}
              variant="secondary"
              className="w-full mt-2"
            >
              Test Connection
            </Button>
          </div>
          <p className="text-[10px] text-text-tertiary mt-2 italic">
            Don't see your model? Run <code>ollama pull nomic-embed-text</code> in your terminal.
          </p>
        </SettingRow>

        <SettingRow label="Custom Provider URL" description="Manually override the embedding provider URL if it wasn't detected.">
          <input
            type="text"
            value={settings.ragEmbeddingProviderUrl}
            onChange={(e) => setCurrentSettings((prev) => ({ ...prev, ragEmbeddingProviderUrl: e.target.value }))}
            placeholder="http://localhost:11434"
            className="w-60 p-2 text-xs rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </SettingRow>
        <SettingRow
          label="Maximum Context Sources"
          description="Number of document chunks to retrieve as context for each question. More sources provide more information but use more LLM tokens."
        >
          <div className="flex items-center gap-4 w-60">
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={settings.ragContextLimit}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, ragContextLimit: parseInt(e.target.value, 10) }))}
              className="flex-1 h-1.5 bg-border-color rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-xs font-mono text-primary w-4">{settings.ragContextLimit}</span>
          </div>
        </SettingRow>
        <SettingRow
          label="Similarity Threshold"
          description="Controls retrieval strictness. Lower values are stricter (fewer, higher quality results). Higher values are more inclusive (more, potentially noisier results). Default is 1.4."
        >
          <div className="flex items-center gap-4 w-60">
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={settings.ragSimilarityThreshold}
              onChange={(e) => setCurrentSettings((prev) => ({ ...prev, ragSimilarityThreshold: parseFloat(e.target.value) }))}
              className="flex-1 h-1.5 bg-border-color rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-xs font-mono text-primary w-8">{settings.ragSimilarityThreshold.toFixed(1)}</span>
          </div>
        </SettingRow>
      </div>
    </section>
  );
};

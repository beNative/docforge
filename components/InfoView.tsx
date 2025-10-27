import React, { useState, useEffect } from 'react';
import PreviewPane from './PreviewPane';
import Spinner from './Spinner';
import { useLogger } from '../hooks/useLogger';
import type { Settings } from '../types';

type DocTab = 'Readme' | 'Functional Manual' | 'Technical Manual' | 'Version Log';

const docFiles: Record<DocTab, string> = {
  'Readme': 'README.md',
  'Functional Manual': 'FUNCTIONAL_MANUAL.md',
  'Technical Manual': 'TECHNICAL_MANUAL.md',
  'Version Log': 'VERSION_LOG.md',
};

interface InfoViewProps {
  settings: Settings;
  previewScale: number;
  onPreviewScaleChange: (scale: number) => void;
  previewZoomOptions?: {
    minScale?: number;
    maxScale?: number;
    zoomStep?: number;
    initialScale?: number;
  };
  previewResetSignal?: number;
  onPreviewVisibilityChange?: (isVisible: boolean) => void;
  onPreviewZoomAvailabilityChange?: (isAvailable: boolean) => void;
}

const InfoView: React.FC<InfoViewProps> = ({
  settings,
  previewScale,
  onPreviewScaleChange,
  previewZoomOptions,
  previewResetSignal,
  onPreviewVisibilityChange,
  onPreviewZoomAvailabilityChange,
}) => {
  const [activeTab, setActiveTab] = useState<DocTab>('Readme');
  const [documents, setDocuments] = useState<Record<DocTab, string>>({
    'Readme': 'Loading...',
    'Functional Manual': 'Loading...',
    'Technical Manual': 'Loading...',
    'Version Log': 'Loading...',
  });
  const [error, setError] = useState<string | null>(null);
  const { addLog } = useLogger();

  useEffect(() => {
    const fetchDocs = async () => {
      const isElectron = window.electronAPI;
      try {
        const docPromises = (Object.keys(docFiles) as DocTab[]).map(async (tab) => {
          const filename = docFiles[tab];
          let text = '';

          if (isElectron) {
            const result = await window.electronAPI!.readDoc(filename);
            if (result.success === true) {
              text = result.content;
            } else {
              throw new Error(result.error || `Failed to load ${filename} from main process.`);
            }
          } else {
            const response = await fetch(`./${filename}`);
            if (!response.ok) {
              throw new Error(`Failed to load ${filename} (${response.status} ${response.statusText})`);
            }
            text = await response.text();
          }
          return { tab, text };
        });

        const loadedDocs = await Promise.all(docPromises);

        const newDocumentsState = loadedDocs.reduce((acc, { tab, text }) => {
          acc[tab] = text;
          return acc;
        }, {} as Record<DocTab, string>);
        
        setDocuments(newDocumentsState);

      } catch (err) {
        if (err instanceof Error) {
            console.error("Error fetching documents:", err);
            setError(`Could not load documentation. Error: ${err.message}`);
            const errorState = (Object.keys(docFiles) as DocTab[]).reduce((acc, tab) => {
                acc[tab] = `# Error\nFailed to load content for ${tab}.`;
                return acc;
            }, {} as Record<DocTab, string>);
            setDocuments(errorState);
        }
      }
    };

    fetchDocs();
  }, []);

  useEffect(() => {
    onPreviewVisibilityChange?.(true);
    return () => {
      onPreviewVisibilityChange?.(false);
      onPreviewZoomAvailabilityChange?.(false);
    };
  }, [onPreviewVisibilityChange, onPreviewZoomAvailabilityChange]);

  const activeTabContent = documents[activeTab];
  const isLoadingActiveTab = activeTabContent === 'Loading...';

  useEffect(() => {
    if (isLoadingActiveTab) {
      onPreviewZoomAvailabilityChange?.(false);
    }
  }, [isLoadingActiveTab, onPreviewZoomAvailabilityChange]);

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden min-h-0">
      <header className="flex items-center justify-between px-4 h-7 border-b border-border-color bg-secondary flex-shrink-0">
        <h1 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Application Information</h1>
        <nav className="flex items-center gap-1">
          {(Object.keys(docFiles) as DocTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-6 px-3 text-[11px] font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-border-color/40 hover:text-text-main'
              }`}>
              {tab}
            </button>
          ))}
        </nav>
      </header>
      {error && <div className="mx-4 mt-3 text-[11px] text-destructive-text p-2 bg-destructive-bg/80 rounded-md">{error}</div>}
      <div className="flex-1 bg-secondary overflow-y-auto mt-2 border-t border-border-color">
        {isLoadingActiveTab ? (
          <div className="flex items-center justify-center h-full text-text-secondary gap-2 text-[11px]">
            <Spinner />
            <span>Loading documentation...</span>
          </div>
        ) : (
          <PreviewPane
            content={activeTabContent}
            language="markdown"
            addLog={addLog}
            settings={settings}
            previewScale={previewScale}
            onPreviewScaleChange={onPreviewScaleChange}
            previewZoomOptions={previewZoomOptions}
            previewResetSignal={previewResetSignal}
            onPreviewZoomAvailabilityChange={onPreviewZoomAvailabilityChange}
          />
        )}
      </div>
    </div>
  );
};

export default InfoView;

import React, { useMemo } from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { PlantUMLDiagram } from './plantumlDiagram';

interface PlantUMLPreviewProps {
  content: string;
  settings: Settings;
}

const PlantUMLPreview: React.FC<PlantUMLPreviewProps> = ({ content, settings }) => {
  const trimmed = useMemo(() => content.trim(), [content]);

  return (
    <div className="df-plantuml-preview" role="document">
      <PlantUMLDiagram code={trimmed} mode={settings.plantumlRendererMode} />
      <style>{`
        .df-plantuml-preview {
          width: 100%;
          height: 100%;
          overflow: auto;
          background: rgb(var(--color-secondary));
          display: flex;
          justify-content: center;
          padding: clamp(1.5rem, 4vw, 3rem);
        }

        .df-plantuml {
          border: 1px solid rgba(var(--color-border), 0.9);
          border-radius: 0.9rem;
          background: rgba(var(--color-background), 0.75);
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin: 0 auto;
          text-align: center;
          width: min(100%, 960px);
        }

        .df-plantuml img,
        .df-plantuml svg {
          width: 100%;
          height: auto;
        }

        .df-plantuml-loading {
          font-size: 0.95rem;
          color: rgba(var(--color-text-secondary), 0.95);
        }

        .df-plantuml-error {
          margin-top: 0.75rem;
          font-size: 0.9rem;
          color: rgb(var(--color-destructive-text));
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-start;
          text-align: left;
        }

        .df-plantuml-error__details {
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
};

export class PlantUMLRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    const normalized = languageId.toLowerCase();
    return normalized === 'plantuml' || normalized === 'puml' || normalized === 'uml';
  }

  async render(
    content: string,
    addLog?: (level: LogLevel, message: string) => void,
    _languageId?: string | null,
    settings?: Settings,
  ): Promise<{ output: React.ReactElement; error?: string }> {
    const effectiveSettings = settings ?? DEFAULT_SETTINGS;

    if (!content.trim()) {
      addLog?.('WARN', 'PlantUML document has no content to render.');
    }

    return {
      output: <PlantUMLPreview content={content} settings={effectiveSettings} />,
    };
  }
}


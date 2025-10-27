import React, { useMemo } from 'react';
import type { IRenderer, RendererRenderOptions } from './IRenderer';
import type { LogLevel, Settings } from '../../types';
import ZoomPanContainer from '../../components/ZoomPanContainer';

interface HtmlPreviewProps {
  content: string;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ content }) => {
  const fullHtml = useMemo(
    () =>
      `<html><head><style>body { color-scheme: light dark; font-family: sans-serif; padding: 1rem; }</style></head><body>${content}</body></html>`,
    [content],
  );

  return (
    <ZoomPanContainer
      className="w-full h-full"
      contentClassName="w-full h-full origin-top flex"
      wrapperClassName="items-stretch justify-center"
      disablePan
      role="document"
    >
      <iframe
        srcDoc={fullHtml}
        sandbox="allow-scripts" // Allow scripts for dynamic previews, but be mindful of security implications.
        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
        title="HTML Preview"
      />
    </ZoomPanContainer>
  );
};

export class HtmlRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'html';
  }

  async render(
    content: string,
    addLog?: (level: LogLevel, message: string) => void,
    _languageId?: string | null,
    _settings?: Settings,
    _options?: RendererRenderOptions,
  ): Promise<{ output: React.ReactElement; error?: string }> {
    return {
      output: <HtmlPreview content={content} />,
    };
  }
}

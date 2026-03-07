import React, { useMemo } from 'react';
import type { IRenderer, RendererRenderOptions } from './IRenderer';
import type { LogLevel, Settings } from '../../types';
import { usePreviewZoom } from '../../contexts/PreviewZoomContext';

interface HtmlPreviewProps {
  content: string;
}

/**
 * Inner component that receives scale as a prop.
 * This ensures React properly re-renders when scale changes.
 */
const HtmlPreviewInner: React.FC<{ content: string; scale: number }> = ({ content, scale }) => {
  const fullHtml = useMemo(
    () =>
      `<html><head><style>body { color-scheme: light dark; font-family: sans-serif; padding: 1rem; margin: 0; }</style></head><body>${content}</body></html>`,
    [content],
  );

  // Apply CSS zoom directly to the iframe element
  const iframeStyle: React.CSSProperties = useMemo(() => ({
    width: '100%',
    height: '100%',
    minHeight: '100vh',
    border: 'none',
    backgroundColor: 'transparent',
    zoom: scale,
    transformOrigin: 'top left',
  }), [scale]);

  return (
    <div className="w-full h-full overflow-auto bg-secondary">
      <iframe
        srcDoc={fullHtml}
        sandbox="allow-scripts"
        style={iframeStyle}
        title="HTML Preview"
      />
    </div>
  );
};

/**
 * Wrapper component that reads the zoom context and passes scale as a prop.
 * This pattern ensures the inner component re-renders when zoom changes.
 */
const HtmlPreview: React.FC<HtmlPreviewProps> = ({ content }) => {
  const previewZoom = usePreviewZoom();
  const scale = previewZoom?.scale ?? 1;

  return <HtmlPreviewInner content={content} scale={scale} />;
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

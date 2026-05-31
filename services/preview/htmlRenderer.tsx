import React, { useMemo, useEffect, useRef } from 'react';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fullHtml = useMemo(
    () =>
      `<html><head><style>body { color-scheme: light dark; font-family: sans-serif; padding: 1rem; margin: 0; }</style></head><body>${content}</body></html>`,
    [content],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const applyZoom = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          doc.body.style.zoom = String(scale);
        }
      } catch (err) {
        console.warn('Failed to apply zoom to iframe body:', err);
      }
    };

    applyZoom();

    iframe.addEventListener('load', applyZoom);
    return () => {
      iframe.removeEventListener('load', applyZoom);
    };
  }, [scale]);

  const iframeStyle: React.CSSProperties = useMemo(() => ({
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: 'transparent',
  }), []);

  return (
    <div className="w-full h-full overflow-auto bg-secondary">
      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        sandbox="allow-scripts allow-same-origin"
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

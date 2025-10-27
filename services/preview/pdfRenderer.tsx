import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { IRenderer, RendererRenderOptions } from './IRenderer';
import type { LogLevel, Settings } from '../../types';
import Hint from '../../components/Hint';
import { usePreviewZoom } from '../../contexts/PreviewZoomContext';

interface PdfPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
}

const PDF_RESET_THRESHOLD = 0.001;

const PdfPreview = React.forwardRef<HTMLDivElement, PdfPreviewProps>(({ content, className, ...rest }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerReadyRef = useRef(false);
  const pendingScaleRef = useRef<number | null>(null);
  const lastAppliedScaleRef = useRef<number | null>(null);
  const ignoreMessagesUntilRef = useRef<number>(0);
  const previewZoom = usePreviewZoom();

  useImperativeHandle(ref, () => containerRef.current);

  const { url, error, isBlobUrl } = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      return { url: null as string | null, error: 'This document does not contain any PDF data.', isBlobUrl: false };
    }

    if (trimmed.startsWith('data:application/pdf')) {
      return { url: trimmed, error: null, isBlobUrl: false };
    }

    const cleanBase64 = trimmed.replace(/\s+/g, '');

    const decodeBase64 = () => {
      try {
        const markerIndex = cleanBase64.toLowerCase().indexOf('base64,');
        const payload = markerIndex !== -1
          ? cleanBase64.slice(markerIndex + 'base64,'.length)
          : cleanBase64;
        const byteCharacters = atob(payload);
        const byteLength = byteCharacters.length;
        const byteNumbers = new Uint8Array(byteLength);
        for (let i = 0; i < byteLength; i += 1) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    };

    const blobUrlFromBase64 = decodeBase64();
    if (blobUrlFromBase64) {
      return { url: blobUrlFromBase64, error: null, isBlobUrl: true };
    }

    if (trimmed.startsWith('%PDF')) {
      const blob = new Blob([trimmed], { type: 'application/pdf' });
      return { url: URL.createObjectURL(blob), error: null, isBlobUrl: true };
    }

    return { url: null, error: 'Stored PDF data is not in a recognized format.', isBlobUrl: false };
  }, [content]);

  useEffect(() => {
    return () => {
      viewerReadyRef.current = false;
      pendingScaleRef.current = null;
      lastAppliedScaleRef.current = null;
      if (isBlobUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [isBlobUrl, url]);

  useEffect(() => {
    viewerReadyRef.current = false;
    pendingScaleRef.current = previewZoom?.scale ?? null;
    lastAppliedScaleRef.current = previewZoom?.scale ?? null;
  }, [url]);

  const applyViewerZoom = useCallback((
    scale: number,
    { forceReset = false, forceApply = false }: { forceReset?: boolean; forceApply?: boolean } = {},
  ) => {
    if (!previewZoom) {
      return;
    }

    const viewerWindow = iframeRef.current?.contentWindow;
    if (!viewerWindow || !viewerReadyRef.current) {
      pendingScaleRef.current = scale;
      lastAppliedScaleRef.current = scale;
      return;
    }

    const previousScale = lastAppliedScaleRef.current;
    if (!forceApply && previousScale !== null && Math.abs(scale - previousScale) < PDF_RESET_THRESHOLD) {
      return;
    }

    const percent = Math.round(scale * 100);
    const zoomMessages: Array<Record<string, unknown>> = [];

    if (forceReset || Math.abs(scale - 1) < PDF_RESET_THRESHOLD) {
      zoomMessages.push({ type: 'resetZoom' });
    }

    zoomMessages.push({ type: 'setZoom', value: percent });
    zoomMessages.push({ type: 'setZoom', zoom: percent });
    zoomMessages.push({ type: 'setZoom', valueText: `${percent}%` });
    zoomMessages.push({ type: 'setZoomLevel', value: percent });
    zoomMessages.push({ type: 'setZoomScale', scale });
    zoomMessages.push({ type: 'zoomTo', scale });

    if (previousScale !== null && Math.abs(scale - previousScale) >= PDF_RESET_THRESHOLD) {
      const stepFactor = 1 + previewZoom.zoomStep;
      if (stepFactor > 1.0001 && previousScale > 0) {
        const ratio = scale / previousScale;
        if (Math.abs(ratio - 1) > PDF_RESET_THRESHOLD) {
          const stepEstimate = Math.round(Math.log(Math.abs(ratio)) / Math.log(stepFactor));
          if (stepEstimate !== 0) {
            const command = ratio > 1 ? 'zoomIn' : 'zoomOut';
            for (let i = 0; i < Math.abs(stepEstimate); i += 1) {
              zoomMessages.push({ type: command });
            }
          }
        }
      }
    }

    ignoreMessagesUntilRef.current = Date.now() + 250;
    zoomMessages.forEach(message => {
      try {
        viewerWindow.postMessage(message, '*');
      } catch {
        // Ignore failures, as different PDF viewers expose different messaging APIs.
      }
    });

    lastAppliedScaleRef.current = scale;
    pendingScaleRef.current = null;
  }, [previewZoom]);

  const handleIframeLoad = useCallback(() => {
    viewerReadyRef.current = true;
    const targetScale = pendingScaleRef.current ?? previewZoom?.scale ?? 1;
    const shouldForceReset = Math.abs(targetScale - 1) < PDF_RESET_THRESHOLD;
    applyViewerZoom(targetScale, { forceReset: shouldForceReset, forceApply: true });
  }, [applyViewerZoom, previewZoom?.scale]);

  useEffect(() => {
    if (!previewZoom) {
      return;
    }

    applyViewerZoom(previewZoom.scale);
  }, [applyViewerZoom, previewZoom?.scale]);

  useEffect(() => {
    if (!previewZoom) {
      return;
    }

    return previewZoom.registerResetHandler(() => {
      lastAppliedScaleRef.current = 1;
      applyViewerZoom(1, { forceReset: true });
    });
  }, [applyViewerZoom, previewZoom]);

  useEffect(() => {
    if (!previewZoom) {
      return;
    }

    const handleViewerMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (Date.now() <= ignoreMessagesUntilRef.current) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') {
        return;
      }

      const payload = data as Record<string, unknown>;
      const type = typeof payload.type === 'string' ? payload.type.toLowerCase() : null;
      const recognizedTypes = new Set(['scalechanged', 'zoomchange', 'zoomchanged', 'zoomlevelchanged']);
      if (type && !recognizedTypes.has(type)) {
        return;
      }

      const numericKeys = ['scale', 'zoom', 'zoomLevel', 'value', 'percent'];
      for (const key of numericKeys) {
        const raw = payload[key];
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          const normalized = raw > 10 ? raw / 100 : raw;
          if (normalized > 0 && Math.abs(normalized - (previewZoom.scale ?? normalized)) >= PDF_RESET_THRESHOLD) {
            lastAppliedScaleRef.current = normalized;
            previewZoom.setScale(normalized);
            return;
          }
        }
        if (typeof raw === 'string') {
          const parsed = parseFloat(raw);
          if (!Number.isNaN(parsed)) {
            const normalized = parsed > 10 ? parsed / 100 : parsed;
            if (normalized > 0 && Math.abs(normalized - (previewZoom.scale ?? normalized)) >= PDF_RESET_THRESHOLD) {
              lastAppliedScaleRef.current = normalized;
              previewZoom.setScale(normalized);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('message', handleViewerMessage);
    return () => window.removeEventListener('message', handleViewerMessage);
  }, [previewZoom]);

  if (error || !url) {
    const message = error ?? 'Unable to display the stored PDF document.';
    return (
      <div
        ref={containerRef}
        className={`w-full h-full flex items-center justify-center bg-secondary ${className ?? ''}`}
        {...rest}
      >
        <Hint role="note">{message}</Hint>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-auto bg-secondary ${className ?? ''}`}
      {...rest}
    >
      <div className="w-full h-full flex">
        <div className="flex-1 min-h-0">
          <iframe
            ref={iframeRef}
            title="PDF Preview"
            src={url}
            className="w-full h-full border border-border-color bg-white shadow-sm"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
});

PdfPreview.displayName = 'PdfPreview';

export class PdfRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'pdf' || languageId === 'application/pdf';
  }

  async render(
    content: string,
    addLog?: (level: LogLevel, message: string) => void,
    languageId?: string | null,
    _settings?: Settings,
    _options?: RendererRenderOptions,
  ) {
    return { output: <PdfPreview content={content} /> };
  }
}

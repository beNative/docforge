import React, { useEffect, useMemo } from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel, Settings } from '../../types';

interface PdfPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
}

const PdfPreview = React.forwardRef<HTMLDivElement, PdfPreviewProps>(({ content, className, ...rest }, ref) => {
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
      if (isBlobUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [isBlobUrl, url]);

  if (error) {
    return (
      <div
        ref={ref}
        className={`w-full h-full flex items-center justify-center text-text-secondary text-sm ${className ?? ''}`}
        {...rest}
      >
        {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div
        ref={ref}
        className={`w-full h-full flex items-center justify-center text-text-secondary text-sm ${className ?? ''}`}
        {...rest}
      >
        Unable to display the stored PDF document.
      </div>
    );
  }

  return (
    <div ref={ref} className={`w-full h-full overflow-auto bg-secondary ${className ?? ''}`} {...rest}>
      <iframe
        title="PDF Preview"
        src={url}
        className="w-full h-full border-0 bg-white"
      />
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
  ) {
    return { output: <PdfPreview content={content} /> };
  }
}

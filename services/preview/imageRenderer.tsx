import React, { useEffect, useMemo, useState } from 'react';
import ZoomPanContainer from '../../components/ZoomPanContainer';
import type { IRenderer } from './IRenderer';
import type { LogLevel, Settings } from '../../types';

type SupportedImageType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp'
  | 'image/svg+xml';

const SUPPORTED_IMAGE_MIME_TYPES: SupportedImageType[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
];

const FALLBACK_IMAGE_TYPE: SupportedImageType = 'image/png';

const normalizeLanguageToMime = (languageId?: string | null): SupportedImageType | null => {
  if (!languageId) return null;
  const normalized = languageId.toLowerCase();

  switch (normalized) {
    case 'png':
    case 'image/png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
    case 'image/jpg':
    case 'image/jpeg':
      return 'image/jpeg';
    case 'gif':
    case 'image/gif':
      return 'image/gif';
    case 'webp':
    case 'image/webp':
      return 'image/webp';
    case 'bmp':
    case 'image/bmp':
      return 'image/bmp';
    case 'svg':
    case 'svg+xml':
    case 'image/svg':
    case 'image/svg+xml':
      return 'image/svg+xml';
    default:
      if (normalized.startsWith('image/')) {
        const match = SUPPORTED_IMAGE_MIME_TYPES.find((type) => type === normalized);
        return match ?? null;
      }
      return null;
  }
};

const detectMimeFromBytes = (bytes: Uint8Array): SupportedImageType | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 6 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]).startsWith('GIF')
  ) {
    return 'image/gif';
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP'
  ) {
    return 'image/webp';
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const sample = decoder.decode(bytes.slice(0, 120)).trim().toLowerCase();
    if (sample.startsWith('<svg')) {
      return 'image/svg+xml';
    }
  } catch {
    // Ignore text decoding failures; we'll fall back to other detection strategies.
  }

  return null;
};

const createBlobUrlFromBytes = (bytes: Uint8Array, hintedType: SupportedImageType | null) => {
  const mimeType = detectMimeFromBytes(bytes) ?? hintedType ?? FALLBACK_IMAGE_TYPE;
  try {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return { url: URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType })), isBlobUrl: true, mimeType };
  } catch {
    return { url: null as string | null, isBlobUrl: false, mimeType };
  }
};

const createBlobUrlFromBase64 = (input: string, hintedType: SupportedImageType | null) => {
  const cleanInput = input.replace(/\s+/g, '');
  try {
    const markerIndex = cleanInput.toLowerCase().indexOf('base64,');
    const payload = markerIndex !== -1 ? cleanInput.slice(markerIndex + 'base64,'.length) : cleanInput;
    const byteCharacters = atob(payload);
    const byteLength = byteCharacters.length;
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = byteCharacters.charCodeAt(i);
    }

    return createBlobUrlFromBytes(bytes, hintedType);
  } catch {
    return { url: null as string | null, isBlobUrl: false, mimeType: hintedType };
  }
};

const createBlobUrlFromText = (input: string, hintedType: SupportedImageType | null) => {
  const mimeType = hintedType ?? 'image/svg+xml';
  try {
    const blob = new Blob([input], { type: mimeType });
    return { url: URL.createObjectURL(blob), isBlobUrl: true, mimeType };
  } catch {
    return { url: null as string | null, isBlobUrl: false, mimeType };
  }
};

interface ImagePreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  languageId?: string | null;
}

const ImagePreview = React.forwardRef<HTMLDivElement, ImagePreviewProps>(({ content, className, languageId, ...rest }, ref) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const { url, error, isBlobUrl, mimeType } = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      return {
        url: null as string | null,
        error: 'This document does not contain any image data.',
        isBlobUrl: false,
        mimeType: null as SupportedImageType | null,
      };
    }

    const hintedType = normalizeLanguageToMime(languageId) ?? null;

    if (/^(https?:|file:)/i.test(trimmed)) {
      return { url: trimmed, error: null, isBlobUrl: false, mimeType: hintedType };
    }

    if (trimmed.startsWith('data:image/')) {
      return { url: trimmed, error: null, isBlobUrl: false, mimeType: hintedType };
    }

    if (trimmed.startsWith('<svg')) {
      return { ...createBlobUrlFromText(trimmed, 'image/svg+xml'), error: null };
    }

    const char0 = trimmed.charCodeAt(0);
    const char1 = trimmed.charCodeAt(1);
    const char2 = trimmed.charCodeAt(2);
    const char3 = trimmed.charCodeAt(3);

    const looksLikeBinaryImage =
      (char0 === 0x89 && char1 === 0x50 && char2 === 0x4e && char3 === 0x47) || // PNG
      (char0 === 0xff && char1 === 0xd8 && char2 === 0xff) || // JPEG
      trimmed.startsWith('GIF8') ||
      (char0 === 0x42 && char1 === 0x4d) || // BMP
      (trimmed.startsWith('RIFF') && trimmed.slice(8, 12) === 'WEBP');

    if (looksLikeBinaryImage) {
      const bytes = new Uint8Array(trimmed.length);
      for (let i = 0; i < trimmed.length; i += 1) {
        bytes[i] = trimmed.charCodeAt(i) & 0xff;
      }
      const result = createBlobUrlFromBytes(bytes, hintedType);
      if (result.url) {
        return { ...result, error: null };
      }
    }

    const base64Match = /base64,/i.test(trimmed) || /^[a-z0-9+/=\s]+$/i.test(trimmed);
    if (base64Match) {
      const result = createBlobUrlFromBase64(trimmed, hintedType);
      if (result.url) {
        return { ...result, error: null };
      }
    }

    return {
      url: null as string | null,
      error: 'Stored image data is not in a recognized format.',
      isBlobUrl: false,
      mimeType: hintedType,
    };
  }, [content, languageId]);

  useEffect(() => {
    return () => {
      if (isBlobUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [isBlobUrl, url]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setDimensions({ width: naturalWidth, height: naturalHeight });
  };

  const handleImageError = () => {
    setDimensions(null);
  };

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
        Unable to display the stored image.
      </div>
    );
  }

  return (
    <ZoomPanContainer
      ref={ref}
      className={`w-full h-full ${className ?? ''}`}
      contentClassName="p-6"
      overlay={
        dimensions ? (
          <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white shadow-md">
            {dimensions.width} × {dimensions.height} px
            {mimeType ? ` • ${mimeType.replace('image/', '').toUpperCase()}` : ''}
          </div>
        ) : null
      }
      {...rest}
    >
      <div className="max-w-full">
        <img
          src={url}
          alt="Document preview"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="block max-w-full max-h-[80vh] rounded-lg border border-border-color bg-background object-contain shadow-lg"
          draggable={false}
        />
      </div>
    </ZoomPanContainer>
  );
});

ImagePreview.displayName = 'ImagePreview';

export class ImageRenderer implements IRenderer {
  private readonly supportedIds = [
    'image',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'webp',
    'svg',
    'svg+xml',
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg',
    'image/svg+xml',
  ];

  canRender(languageId: string): boolean {
    const normalized = languageId.toLowerCase();
    return this.supportedIds.includes(normalized);
  }

  async render(
    content: string,
    addLog?: (level: LogLevel, message: string) => void,
    languageId?: string | null,
    _settings?: Settings,
  ) {
    return { output: <ImagePreview content={content} languageId={languageId} /> };
  }
}

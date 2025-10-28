import type { DocType, DocumentOrFolder, SaveFilePayload } from '../types';

export interface DocumentExportResult {
  success: boolean;
  canceled: boolean;
  filePath?: string | null;
  suggestedFileName: string;
  extension: string;
}

type DocumentExportPayload =
  | { kind: 'text'; data: string; encoding?: 'utf-8'; mimeType?: string | null }
  | { kind: 'binary'; data: Uint8Array; mimeType?: string | null };

type DataUrlInfo = { mimeType: string; isBase64: boolean; data: string };

type FileFilter = { name: string; extensions: string[] };

const DEFAULT_DOC_TYPE_EXTENSION: Record<DocType, string> = {
  prompt: 'md',
  source_code: 'txt',
  pdf: 'pdf',
  image: 'png',
};

const DOC_TYPE_FILTER_LABELS: Partial<Record<DocType, string>> = {
  prompt: 'Text Documents',
  source_code: 'Code Files',
  pdf: 'PDF Documents',
  image: 'Image Files',
};

const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  markdown: 'md',
  md: 'md',
  plaintext: 'txt',
  text: 'txt',
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  html: 'html',
  css: 'css',
  json: 'json',
  plantuml: 'puml',
  puml: 'puml',
  java: 'java',
  csharp: 'cs',
  cpp: 'cpp',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  sql: 'sql',
  xml: 'xml',
  yaml: 'yml',
  yml: 'yml',
  toml: 'toml',
  pascal: 'pas',
  ini: 'ini',
  dockerfile: 'dockerfile',
  shell: 'sh',
  bash: 'sh',
  powershell: 'ps1',
  pdf: 'pdf',
  'application/pdf': 'pdf',
  image: 'png',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'image/bmp': 'bmp',
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'image/bmp': 'bmp',
};

const TEXT_MIME_DEFAULT = 'text/plain;charset=utf-8';

const EXTENSION_MIME_MAP: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: TEXT_MIME_DEFAULT,
  text: TEXT_MIME_DEFAULT,
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  ts: 'application/typescript',
  py: TEXT_MIME_DEFAULT,
  java: TEXT_MIME_DEFAULT,
  cs: TEXT_MIME_DEFAULT,
  cpp: TEXT_MIME_DEFAULT,
  go: TEXT_MIME_DEFAULT,
  rs: TEXT_MIME_DEFAULT,
  rb: TEXT_MIME_DEFAULT,
  php: TEXT_MIME_DEFAULT,
  sql: 'application/sql',
  xml: 'application/xml',
  yaml: 'application/x-yaml',
  yml: 'application/x-yaml',
  toml: 'application/toml',
  pas: TEXT_MIME_DEFAULT,
  ini: TEXT_MIME_DEFAULT,
  dockerfile: TEXT_MIME_DEFAULT,
  sh: 'application/x-sh',
  ps1: 'application/powershell',
  puml: TEXT_MIME_DEFAULT,
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

const sanitizeFileName = (raw: string): string => {
  const trimmed = raw.replace(INVALID_FILENAME_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return trimmed || 'Document';
};

const stripExtension = (filename: string, extension: string): string => {
  const lower = filename.toLowerCase();
  const target = `.${extension.toLowerCase()}`;
  if (lower.endsWith(target)) {
    return filename.slice(0, filename.length - target.length);
  }
  return filename;
};

const mapLanguageToExtension = (languageHint: string | null | undefined): string | null => {
  if (!languageHint) return null;
  const normalized = languageHint.trim().toLowerCase();
  if (!normalized) return null;
  if (LANGUAGE_EXTENSION_MAP[normalized]) {
    return LANGUAGE_EXTENSION_MAP[normalized];
  }
  if (normalized.includes('/')) {
    const mimeExtension = MIME_EXTENSION_MAP[normalized];
    if (mimeExtension) {
      return mimeExtension;
    }
    const fallback = normalized.split('/').pop();
    return fallback ?? null;
  }
  return null;
};

const parseDataUrl = (value: string): DataUrlInfo | null => {
  const match = value.match(/^data:([^;,]+)?((?:;[^;,]+)*)?,(.*)$/s);
  if (!match) return null;
  const mimeType = (match[1] ?? 'application/octet-stream').trim();
  const params = match[2] ?? '';
  const isBase64 = /;base64/i.test(params);
  const data = match[3] ?? '';
  return { mimeType, isBase64, data };
};

const decodeBase64ToUint8Array = (raw: string): Uint8Array => {
  const normalized = raw.replace(/[\r\n\s]/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalized);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const BufferCtor = (globalThis as { Buffer?: { from(input: string, encoding: string): any } }).Buffer;
  if (typeof BufferCtor !== 'undefined') {
    const buffer = BufferCtor.from(normalized, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  }
  throw new Error('Base64 decoding is not supported in this environment.');
};

const decodeDataUrl = (value: string): { bytes: Uint8Array; mimeType: string } | null => {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;
  if (parsed.isBase64) {
    return { bytes: decodeBase64ToUint8Array(parsed.data), mimeType: parsed.mimeType };
  }
  try {
    const decoded = decodeURIComponent(parsed.data);
    return { bytes: new TextEncoder().encode(decoded), mimeType: parsed.mimeType };
  } catch {
    return { bytes: new TextEncoder().encode(parsed.data), mimeType: parsed.mimeType };
  }
};

const isLikelyBase64 = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.replace(/[\r\n\s]/g, '');
  if (normalized.length < 16 || normalized.length % 4 !== 0) {
    return false;
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
};

const inferMimeFromExtension = (extension: string | null, docType?: DocType): string => {
  if (extension) {
    const mapped = EXTENSION_MIME_MAP[extension.toLowerCase()];
    if (mapped) {
      return mapped;
    }
  }
  if (docType) {
    if (docType === 'pdf') return 'application/pdf';
    if (docType === 'image') return 'image/png';
  }
  return TEXT_MIME_DEFAULT;
};

const determineExtension = (doc: DocumentOrFolder): string => {
  const languageExtension = mapLanguageToExtension(doc.language_hint);
  if (languageExtension) {
    return languageExtension;
  }

  const content = doc.content?.trim() ?? '';
  if (content) {
    if (doc.doc_type === 'image') {
      const decoded = decodeDataUrl(content);
      if (decoded) {
        const extension = MIME_EXTENSION_MAP[decoded.mimeType.toLowerCase()];
        if (extension) {
          return extension;
        }
      }
      if (/^<svg[\s>]/i.test(content)) {
        return 'svg';
      }
    }
    if (doc.doc_type === 'pdf') {
      const decoded = decodeDataUrl(content);
      if (decoded) {
        const extension = MIME_EXTENSION_MAP[decoded.mimeType.toLowerCase()];
        if (extension) {
          return extension;
        }
      }
      if (content.startsWith('%PDF')) {
        return 'pdf';
      }
    }
  }

  const docType = doc.doc_type ?? 'prompt';
  return DEFAULT_DOC_TYPE_EXTENSION[docType as DocType] ?? 'txt';
};

const buildFilters = (extension: string, docType: DocType | undefined): FileFilter[] => {
  const normalizedExt = extension.toLowerCase();
  const docLabel = (docType && DOC_TYPE_FILTER_LABELS[docType]) || undefined;
  const primaryLabel = docLabel ? `${docLabel} (*.${normalizedExt})` : `${normalizedExt.toUpperCase()} Files`;
  return [
    { name: primaryLabel, extensions: [normalizedExt] },
    { name: 'All Files', extensions: ['*'] },
  ];
};

const preparePayload = (doc: DocumentOrFolder, extension: string): DocumentExportPayload => {
  const content = doc.content ?? '';
  const trimmed = content.trim();
  const fallbackMime = inferMimeFromExtension(extension, doc.doc_type as DocType | undefined);

  if (doc.doc_type === 'pdf') {
    if (!trimmed) {
      return { kind: 'binary', data: new Uint8Array(), mimeType: 'application/pdf' };
    }
    const decoded = decodeDataUrl(trimmed);
    if (decoded) {
      return { kind: 'binary', data: decoded.bytes, mimeType: decoded.mimeType };
    }
    if (trimmed.startsWith('%PDF')) {
      return { kind: 'binary', data: new TextEncoder().encode(trimmed), mimeType: 'application/pdf' };
    }
    if (isLikelyBase64(trimmed)) {
      return { kind: 'binary', data: decodeBase64ToUint8Array(trimmed), mimeType: 'application/pdf' };
    }
    return { kind: 'text', data: trimmed, encoding: 'utf-8', mimeType: 'application/pdf' };
  }

  if (doc.doc_type === 'image') {
    if (!trimmed) {
      return { kind: 'binary', data: new Uint8Array(), mimeType: inferMimeFromExtension(extension, 'image') };
    }
    const decoded = decodeDataUrl(trimmed);
    if (decoded) {
      return { kind: 'binary', data: decoded.bytes, mimeType: decoded.mimeType };
    }
    if (/^<svg[\s>]/i.test(trimmed)) {
      return { kind: 'text', data: trimmed, encoding: 'utf-8', mimeType: 'image/svg+xml' };
    }
    if (isLikelyBase64(trimmed)) {
      return { kind: 'binary', data: decodeBase64ToUint8Array(trimmed), mimeType: inferMimeFromExtension(extension, 'image') };
    }
    return { kind: 'text', data: trimmed, encoding: 'utf-8', mimeType: inferMimeFromExtension(extension, 'image') };
  }

  return { kind: 'text', data: content, encoding: 'utf-8', mimeType: fallbackMime };
};

const toElectronPayload = (payload: DocumentExportPayload): SaveFilePayload => {
  if (payload.kind === 'text') {
    return { kind: 'text', content: payload.data, encoding: payload.encoding ?? 'utf-8' };
  }
  return { kind: 'binary', data: payload.data };
};

const triggerBrowserDownload = (filename: string, payload: DocumentExportPayload) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Saving to file is not supported in this environment.');
  }
  const mimeType = payload.mimeType ?? (payload.kind === 'text' ? TEXT_MIME_DEFAULT : 'application/octet-stream');
  const blob = payload.kind === 'text'
    ? new Blob([payload.data], { type: mimeType })
    : new Blob([payload.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

export const exportDocumentToFile = async (doc: DocumentOrFolder): Promise<DocumentExportResult> => {
  const extension = determineExtension(doc);
  const baseTitle = sanitizeFileName(doc.title ?? '');
  const strippedTitle = stripExtension(baseTitle, extension);
  const defaultFileName = extension ? `${strippedTitle}.${extension}` : strippedTitle;
  const filters = buildFilters(extension, doc.doc_type as DocType | undefined);
  const payload = preparePayload(doc, extension);

  if (window.electronAPI?.saveDocument) {
    const result = await window.electronAPI.saveDocument(
      {
        defaultPath: defaultFileName,
        filters,
        title: 'Save Document',
      },
      toElectronPayload(payload)
    );

    if (!result.success) {
      if (result.canceled) {
        return { success: false, canceled: true, filePath: undefined, suggestedFileName: defaultFileName, extension };
      }
      throw new Error(result.error || 'Failed to save document to file.');
    }

    return {
      success: true,
      canceled: false,
      filePath: result.filePath ?? null,
      suggestedFileName: defaultFileName,
      extension,
    };
  }

  triggerBrowserDownload(defaultFileName, payload);
  return { success: true, canceled: false, filePath: null, suggestedFileName: defaultFileName, extension };
};

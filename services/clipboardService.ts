const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export class ClipboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipboardError';
  }
}

export class ClipboardPermissionError extends ClipboardError {
  constructor(message = 'DocForge does not have permission to read from the system clipboard.') {
    super(message);
    this.name = 'ClipboardPermissionError';
  }
}

export class ClipboardUnavailableError extends ClipboardError {
  constructor(message = 'Clipboard access is not available in this environment.') {
    super(message);
    this.name = 'ClipboardUnavailableError';
  }
}

export type ClipboardReadResult = {
  text: string;
  warnings: string[];
  mimeType: string | null;
  source: 'electron' | 'browser';
};

const MAX_CLIPBOARD_TEXT_BYTES = 1024 * 1024; // 1MB guardrail

const buildSizeWarning = (byteSize: number) => {
  const sizeInKb = (byteSize / 1024).toFixed(byteSize >= 1024 * 10 ? 0 : 1);
  const label = byteSize >= 1024 * 1024 ? `${(byteSize / (1024 * 1024)).toFixed(1)} MB` : `${sizeInKb} KB`;
  return `Clipboard content is large (${label}). Importing very large snippets may impact performance.`;
};

export const readClipboardText = async (): Promise<ClipboardReadResult> => {
  if (isElectron && window.electronAPI?.readClipboardText) {
    const response = await window.electronAPI.readClipboardText();
    if (!response || response.success === false) {
      const message = response?.error ?? 'Unable to access clipboard via Electron bridge.';
      if (response?.errorCode === 'permission-denied') {
        throw new ClipboardPermissionError(message);
      }
      throw new ClipboardUnavailableError(message);
    }

    const text = response.text ?? '';
    const mimeType = response.mimeType ?? (text ? 'text/plain' : null);
    const warnings: string[] = [];

    if (text) {
      const byteSize = new TextEncoder().encode(text).length;
      if (byteSize > MAX_CLIPBOARD_TEXT_BYTES) {
        warnings.push(buildSizeWarning(byteSize));
      }
    }

    return { text, warnings, mimeType, source: 'electron' };
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new ClipboardUnavailableError();
  }

  let mimeType: string | null = null;
  let text = '';
  const warnings: string[] = [];

  if ('read' in navigator.clipboard) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const textType = item.types.find(type => type.startsWith('text/')) ?? item.types.find(type => type.includes('text'));
        if (textType) {
          mimeType = textType;
          const blob = await item.getType(textType);
          text = await blob.text();
          break;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new ClipboardPermissionError();
      }
      // If rich clipboard read fails fall back to readText
    }
  }

  if (!text) {
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        throw new ClipboardPermissionError();
      }
      throw new ClipboardUnavailableError(error instanceof Error ? error.message : String(error));
    }
  }

  if (!mimeType && text) {
    mimeType = 'text/plain';
  }

  if (text) {
    const byteSize = new TextEncoder().encode(text).length;
    if (byteSize > MAX_CLIPBOARD_TEXT_BYTES) {
      warnings.push(buildSizeWarning(byteSize));
    }
  }

  return { text, warnings, mimeType, source: 'browser' };
};

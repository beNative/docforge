import React from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel } from '../../types';

export class HtmlRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'html';
  }

  async render(content: string, addLog?: (level: LogLevel, message: string) => void): Promise<{ output: React.ReactElement; error?: string }> {
    // Using `color-scheme` allows the iframe content to respect the system's light/dark mode preference.
    const fullHtml = `<html><head><style>body { color-scheme: light dark; font-family: sans-serif; padding: 1rem; }</style></head><body>${content}</body></html>`;

    return {
      output: (
        <iframe
          srcDoc={fullHtml}
          sandbox="allow-scripts" // Allow scripts for dynamic previews, but be aware of security implications.
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
          title="HTML Preview"
        />
      ),
    };
  }
}

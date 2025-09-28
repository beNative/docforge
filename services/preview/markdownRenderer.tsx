import React from 'react';
import type { IRenderer } from './IRenderer';

// Let TypeScript know 'marked' is available on the window
declare const marked: any;

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(content: string): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      if (typeof marked === 'undefined') {
        throw new Error('Markdown parser (marked.js) is not loaded.');
      }
      const html = marked.parse(content);
      const output = <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
      return { output };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown';
      // Return an empty fragment on error to prevent crashing the UI.
      return { output: <></>, error };
    }
  }
}

import React from 'react';
import type { IRenderer } from './IRenderer';

// Let TypeScript know 'marked' and 'Prism' are available on the window
declare const marked: any;
declare const Prism: any;

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(content: string): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      if (typeof marked === 'undefined' || typeof Prism === 'undefined') {
        throw new Error('Markdown parser (marked.js) or Syntax highlighter (Prism.js) is not loaded.');
      }
      
      marked.setOptions({
        gfm: true, // Enable GitHub Flavored Markdown (tables, task lists, etc.)
        breaks: true, // Interpret carriage returns as <br>
        highlight: (code: string, lang: string) => {
          if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
          }
          // Let marked.js handle the code block if the language is not supported by Prism
          return null;
        },
      });
      
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
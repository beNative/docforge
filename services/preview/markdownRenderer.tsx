import React from 'react';
import type { IRenderer } from './IRenderer';

// Let TypeScript know 'marked' and 'Prism' are available on the window
declare const marked: any;
declare const Prism: any;

// Helper to escape HTML entities.
const escapeHtml = (unsafe: string) => {
  return unsafe
   .replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&#039;");
}

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(content: string): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      if (typeof marked === 'undefined' || typeof Prism === 'undefined') {
        throw new Error('Markdown parser (marked.js) or Syntax highlighter (Prism.js) is not loaded.');
      }
      
      const renderer = new marked.Renderer();

      // Override the code renderer to handle mermaid and prism highlighting
      renderer.code = (code: string, lang: string) => {
        const language = (lang || '').toLowerCase();
        
        if (language === 'mermaid') {
          // Mermaid will read the text content of this div.
          // The content itself is not rendered as HTML by the browser, so it's safe.
          return `<div class="mermaid">${code}</div>`;
        }

        const validLang = Prism.languages[language];
        const highlighted = validLang
          ? Prism.highlight(code, Prism.languages[language], language)
          : escapeHtml(code);
        
        const finalLang = validLang ? language : 'plaintext';

        return `<pre class="language-${finalLang}"><code class="language-${finalLang}">${highlighted}</code></pre>`;
      };

      marked.setOptions({
        gfm: true,
        breaks: true,
        renderer: renderer,
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
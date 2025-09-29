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

/**
 * Safely unescapes HTML entities.
 * The 'code' property from a marked.js renderer is pre-escaped.
 */
const unescapeHtml = (html: string): string => {
    try {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    } catch(e) {
        // Fallback in case of malformed HTML during typing.
        return html;
    }
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
      renderer.code = (code: string, lang: string, escaped: boolean) => {
        const language = (lang || '').toLowerCase();
        
        if (language === 'mermaid') {
          // The 'code' from marked is HTML-escaped. We unescape it to get the raw text.
          const rawCode = escaped ? unescapeHtml(code) : code;
          // We must re-escape the raw code before placing it inside the div.
          // This prevents marked.js from interpreting characters like '<' as HTML.
          // The PreviewPane component will be responsible for un-escaping this before rendering.
          return `<div class="mermaid">${escapeHtml(rawCode)}</div>`;
        }

        // Prism also needs unescaped code to work correctly.
        const codeToHighlight = escaped ? unescapeHtml(code) : code;
        const validLang = Prism.languages[language];
        
        const highlighted = validLang
          ? Prism.highlight(codeToHighlight, Prism.languages[language], language)
          : escapeHtml(codeToHighlight); // Re-escape if not highlighted
        
        const finalLang = validLang ? language : 'plaintext';

        return `<pre class="language-${finalLang}"><code class="language-${finalLang}">${highlighted}</code></pre>`;
      };

      // FIX: Explicitly cast content to a string to robustly handle any non-string values (null, undefined, objects)
      // that cause the 'e.replace is not a function' error.
      const html = await marked.parse(String(content ?? ''), {
        gfm: true,
        breaks: true,
        renderer: renderer,
      });
      
      const output = <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
      return { output };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown';
      // Return an empty fragment on error to prevent crashing the UI.
      return { output: <></>, error };
    }
  }
}
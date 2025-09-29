import React from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel } from '../../types';

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

const safeStringify = (obj: any): string => {
    try {
        const cache = new Set();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) return '[Circular]';
                cache.add(value);
            }
            return value;
        }, 2);
    } catch (e) {
        return `[Unserializable: ${e instanceof Error ? e.message : String(e)}]`;
    }
};

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(content: string, addLog?: (level: LogLevel, message: string) => void): Promise<{ output: React.ReactElement; error?: string }> {
    const doLog = (level: LogLevel, message: string, data?: any) => {
        const fullMessage = data !== undefined ? `${message}\nData: ${safeStringify(data)}` : message;
        if (addLog) {
            addLog(level, fullMessage);
        } else {
            const consoleMethod = level.toLowerCase() as 'debug' | 'warn' | 'error' | 'info';
            if (console[consoleMethod]) {
                console[consoleMethod](message, data ?? '');
            } else {
                console.log(`[${level}] ${message}`, data ?? '');
            }
        }
    };

    doLog('DEBUG', `[MarkdownRenderer] Starting render. Input content type: ${typeof content}. Length: ${content?.length ?? 'N/A'}`);
    if (typeof content !== 'string') {
        doLog('DEBUG', `[MarkdownRenderer] Coercing non-string content to string. Original value:`, content);
    }
    const contentAsString = String(content ?? '');

    try {
      if (typeof marked === 'undefined' || typeof Prism === 'undefined') {
        const errorMsg = 'Markdown parser (marked.js) or Syntax highlighter (Prism.js) is not loaded.';
        doLog('ERROR', `[MarkdownRenderer] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      doLog('DEBUG', '[MarkdownRenderer] marked and Prism are loaded.');
      
      const renderer = new marked.Renderer();
      const originalCodespanRenderer = renderer.codespan.bind(renderer);
      const originalParagraphRenderer = renderer.paragraph.bind(renderer);
      const originalTextRenderer = renderer.text.bind(renderer);
      const originalHeadingRenderer = renderer.heading.bind(renderer);

      const logWrapper = (name: string, fn: Function) => (...args: any[]) => {
          try {
              const argTypes = args.map(arg => `${typeof arg}: ${String(arg).substring(0, 70)}...`).join(', ');
              doLog('DEBUG', `[MarkdownRenderer] renderer.${name} called with args (${argTypes})`);
              
              if(args.some(arg => typeof arg !== 'string' && typeof arg !== 'boolean' && typeof arg !== 'number' && typeof arg !== 'object' && arg !== null && arg !== undefined)) {
                  doLog('WARNING', `[MarkdownRenderer] renderer.${name} received unexpected argument type. Arguments:`, args);
              }
              return fn(...args);
          } catch(e) {
              // FIX: The `doLog` function expects a maximum of 3 arguments. Consolidated extra arguments into a single data object.
              doLog('ERROR', `[MarkdownRenderer] Error in renderer.${name}.`, { arguments: args, error: e });
              return name.includes('span') ? '`error`' : '<p>-- render error --</p>';
          }
      }

      renderer.code = (code: string, lang: string, escaped: boolean) => {
        doLog('DEBUG', `[MarkdownRenderer] renderer.code called. lang: "${lang}" (type: ${typeof lang}), escaped: ${escaped}. Code type: ${typeof code}.`);

        const safeCode = String(code ?? '');
        const safeLang = String(lang ?? '').toLowerCase();
        
        if (typeof code !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code received non-string code. Original value:`, code);
        }
        if (typeof lang !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code received non-string lang. Original value:`, lang);
        }
        
        doLog('DEBUG', `[MarkdownRenderer] renderer.code processing safe lang: "${safeLang}"`);

        if (safeLang === 'mermaid') {
          doLog('DEBUG', '[MarkdownRenderer] Detected mermaid block.');
          const rawCode = escaped ? unescapeHtml(safeCode) : safeCode;
          doLog('DEBUG', `[MarkdownRenderer] Mermaid raw code (unescaped length): ${rawCode.length}`);
          const escapedForDiv = escapeHtml(rawCode);
          doLog('DEBUG', `[MarkdownRenderer] Mermaid code escaped for div insertion.`);
          return `<div class="mermaid">${escapedForDiv}</div>`;
        }

        const codeToHighlight = escaped ? unescapeHtml(safeCode) : safeCode;
        if(escaped) doLog('DEBUG', `[MarkdownRenderer] Unescaped code for highlighting (length): ${codeToHighlight.length}`);

        const validLang = Prism.languages[safeLang];
        doLog('DEBUG', `[MarkdownRenderer] Prism language found for "${safeLang}": ${!!validLang}`);
        
        const highlighted = validLang
          ? Prism.highlight(codeToHighlight, Prism.languages[safeLang], safeLang)
          : escapeHtml(codeToHighlight);
        
        if (!validLang) doLog('DEBUG', `[MarkdownRenderer] No Prism language found, falling back to HTML escape.`);

        const finalLang = validLang ? safeLang : 'plaintext';
        const finalHtml = `<pre class="language-${finalLang}"><code class="language-${finalLang}">${highlighted}</code></pre>`;
        doLog('DEBUG', `[MarkdownRenderer] renderer.code finished. Returning pre block.`);
        return finalHtml;
      };

      renderer.codespan = logWrapper('codespan', originalCodespanRenderer);
      renderer.paragraph = logWrapper('paragraph', originalParagraphRenderer);
      renderer.text = logWrapper('text', originalTextRenderer);
      renderer.heading = logWrapper('heading', originalHeadingRenderer);

      doLog('DEBUG', '[MarkdownRenderer] Custom renderer configured. Calling marked.parse...');
      
      const html = await marked.parse(contentAsString, {
        gfm: true,
        breaks: true,
        renderer: renderer,
      });

      doLog('DEBUG', '[MarkdownRenderer] marked.parse completed successfully.');
      
      const output = <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
      return { output };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown';
      doLog('ERROR', `[MarkdownRenderer] Render failed. Error:`, e);
      return { output: <></>, error };
    }
  }
}

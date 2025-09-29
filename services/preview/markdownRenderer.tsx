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

    doLog('DEBUG', `[MarkdownRenderer] Starting render. Input content type: ${typeof content}.`);
    if (typeof content !== 'string') {
        doLog('WARNING', `[MarkdownRenderer] Coercing non-string content to string. Original value:`, content);
    }
    const contentAsString = String(content ?? '');

    try {
      if (typeof marked === 'undefined' || typeof Prism === 'undefined') {
        const errorMsg = 'Markdown parser (marked.js) or Syntax highlighter (Prism.js) is not loaded.';
        doLog('ERROR', `[MarkdownRenderer] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      const renderer = new marked.Renderer();

      // Universal wrapper to guard all renderer methods against non-string inputs.
      const guardAndLogWrapper = (name: string, originalFn: Function, argIndicesToStringify: number[]) => (...args: any[]) => {
          try {
              const newArgs = [...args];
              let wasCoerced = false;

              for (const index of argIndicesToStringify) {
                  if (index < args.length && args[index] !== null && args[index] !== undefined) {
                      if (typeof args[index] !== 'string') {
                          doLog('WARNING', `[MarkdownRenderer] Coercing non-string argument at index ${index} for renderer.${name}. Original value:`, args[index]);
                          newArgs[index] = String(args[index]);
                          wasCoerced = true;
                      }
                  } else {
                      newArgs[index] = ''; // Ensure null/undefined becomes an empty string.
                      if (args[index] !== '') { // Only log if it was actually null/undefined
                        doLog('DEBUG', `[MarkdownRenderer] Replacing null/undefined argument at index ${index} for renderer.${name} with empty string.`);
                        wasCoerced = true;
                      }
                  }
              }
              
              if (wasCoerced) {
                   doLog('DEBUG', `[MarkdownRenderer] renderer.${name} called.`, { originalArgs: args, coercedArgs: newArgs });
              }

              return originalFn.apply(renderer, newArgs);
          } catch(e) {
              doLog('ERROR', `[MarkdownRenderer] Error in renderer.${name}.`, { arguments: args, error: e });
              return `<!-- error rendering ${name} -->`;
          }
      };

      // Keep custom code renderer for Mermaid/Prism logic, but with internal guards.
      renderer.code = (code: string, lang: string, escaped: boolean) => {
        const safeCode = String(code ?? '');
        const safeLang = String(lang ?? '').toLowerCase();
        
        if (typeof code !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code received non-string code. Original value:`, code);
        }
        if (typeof lang !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code received non-string lang. Original value:`, lang);
        }
        
        if (safeLang === 'mermaid') {
          const rawCode = escaped ? unescapeHtml(safeCode) : safeCode;
          return `<div class="mermaid">${escapeHtml(rawCode)}</div>`;
        }

        const codeToHighlight = escaped ? unescapeHtml(safeCode) : safeCode;
        const validLang = Prism.languages[safeLang];
        const highlighted = validLang
          ? Prism.highlight(codeToHighlight, Prism.languages[safeLang], safeLang)
          : escapeHtml(codeToHighlight);
        
        const finalLang = validLang ? safeLang : 'plaintext';
        return `<pre class="language-${finalLang}"><code class="language-${finalLang}">${highlighted}</code></pre>`;
      };

      // Wrap all other text-based methods
      renderer.blockquote = guardAndLogWrapper('blockquote', renderer.blockquote.bind(renderer), [0]);
      renderer.html = guardAndLogWrapper('html', renderer.html.bind(renderer), [0]);
      renderer.heading = guardAndLogWrapper('heading', renderer.heading.bind(renderer), [0, 2]);
      renderer.list = guardAndLogWrapper('list', renderer.list.bind(renderer), [0]);
      renderer.listitem = guardAndLogWrapper('listitem', renderer.listitem.bind(renderer), [0]);
      renderer.paragraph = guardAndLogWrapper('paragraph', renderer.paragraph.bind(renderer), [0]);
      renderer.table = guardAndLogWrapper('table', renderer.table.bind(renderer), [0, 1]);
      renderer.tablerow = guardAndLogWrapper('tablerow', renderer.tablerow.bind(renderer), [0]);
      renderer.tablecell = guardAndLogWrapper('tablecell', renderer.tablecell.bind(renderer), [0]);
      renderer.strong = guardAndLogWrapper('strong', renderer.strong.bind(renderer), [0]);
      renderer.em = guardAndLogWrapper('em', renderer.em.bind(renderer), [0]);
      renderer.codespan = guardAndLogWrapper('codespan', renderer.codespan.bind(renderer), [0]);
      renderer.del = guardAndLogWrapper('del', renderer.del.bind(renderer), [0]);
      renderer.link = guardAndLogWrapper('link', renderer.link.bind(renderer), [0, 1, 2]);
      renderer.image = guardAndLogWrapper('image', renderer.image.bind(renderer), [0, 1, 2]);
      renderer.text = guardAndLogWrapper('text', renderer.text.bind(renderer), [0]);

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
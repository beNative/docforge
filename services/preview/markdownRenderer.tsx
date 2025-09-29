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
      
      renderer.code = (code: any, lang: any, escaped: boolean) => {
        // Adapt to marked.js tokenizer passing a token object instead of strings.
        const isToken = typeof code === 'object' && code !== null;
        const actualCode = isToken ? code.text : String(code ?? '');
        const actualLang = isToken ? code.lang : String(lang ?? '');
        // When a token is passed, `escaped` is not provided and the text is raw.
        const actualEscaped = isToken ? false : !!escaped;

        doLog('DEBUG', `[MarkdownRenderer] renderer.code called. lang: "${actualLang}", escaped: ${actualEscaped}, isToken: ${isToken}.`);

        if (typeof actualCode !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code has non-string code after processing. Original code arg:`, code);
        }
        if (typeof actualLang !== 'string') {
          doLog('WARNING', `[MarkdownRenderer] renderer.code has non-string lang after processing. Original lang arg:`, lang);
        }

        const safeCode = String(actualCode ?? '');
        const safeLang = String(actualLang ?? '').toLowerCase();
        
        const codeToHighlight = actualEscaped ? unescapeHtml(safeCode) : safeCode;
        
        const validLang = Prism.languages[safeLang];
        
        const highlighted = validLang
          ? Prism.highlight(codeToHighlight, Prism.languages[safeLang], safeLang)
          : escapeHtml(codeToHighlight);
        
        const finalLang = validLang ? safeLang : 'plaintext';
        return `<pre class="language-${finalLang}"><code class="language-${finalLang}">${highlighted}</code></pre>`;
      };

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
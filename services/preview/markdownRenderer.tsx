import React, { useRef, useEffect, forwardRef } from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel } from '../../types';
import { useTheme } from '../../hooks/useTheme';

interface MuyaViewerProps {
  content: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

const MuyaViewer = forwardRef<HTMLDivElement, MuyaViewerProps>(({ content, onScroll }, ref) => {
  const { theme } = useTheme();
  const muyaContainerRef = useRef<HTMLDivElement>(null);
  const muyaInstanceRef = useRef<any>(null);

  useEffect(() => {
    let instance: any = null;
    if (muyaContainerRef.current && typeof Muya !== 'undefined') {
      if (muyaInstanceRef.current) {
        muyaInstanceRef.current.destroy();
      }

      const options = {
        markdown: content,
        disableEdit: true,
      };
      instance = new Muya(muyaContainerRef.current, options);
      muyaInstanceRef.current = instance;
    }
    return () => {
      instance?.destroy();
      muyaInstanceRef.current = null;
    };
  }, [theme]); // Re-initialize on theme change for proper styling

  useEffect(() => {
    if (muyaInstanceRef.current && muyaInstanceRef.current.getMarkdown() !== content) {
      muyaInstanceRef.current.setMarkdown(content);
    }
  }, [content]);

  return (
    <div ref={ref} onScroll={onScroll} className="w-full h-full overflow-auto bg-secondary">
      <div ref={muyaContainerRef} />
      <style>{`
        /* Styles to integrate Muya with the app theme */
        .mu-container {
          padding: 1.5rem; /* Match old p-6 */
          background-color: transparent !important;
          color: rgb(var(--color-text-secondary));
        }
        .mu-editor-focus-mode .mu-content-dom-read-only, .mu-editor .mu-content-dom-read-only {
          padding: 0;
        }
        .mu-editor {
          font-size: var(--markdown-font-size, 16px) !important;
          line-height: var(--markdown-line-height, 1.7) !important;
          max-width: var(--markdown-max-width, 800px) !important;
          margin-left: auto;
          margin-right: auto;
        }
        .dark .mu-container h1, .dark .mu-container h2, .dark .mu-container h3, .dark .mu-container h4, .dark .mu-container h5, .dark .mu-container h6 {
            color: rgb(var(--color-text-main));
        }
        .mu-container h1, .mu-container h2 {
            border-bottom: 1px solid rgb(var(--color-border));
        }
        .mu-container code:not([class*="language-"]) {
            background-color: rgb(var(--color-background));
            border: 1px solid rgb(var(--color-border));
            color: rgb(var(--color-destructive-text));
        }
        .mu-container blockquote {
            border-left: 4px solid rgb(var(--color-border));
        }
        .mu-container table {
          border-collapse: collapse;
        }
        .mu-container th, .mu-container td {
          border: 1px solid rgb(var(--color-border));
        }
        .dark .mu-container th {
          background-color: rgb(var(--color-background));
        }
        /* Hide Muya's resizer in preview mode */
        .mu-image-resizer {
          display: none;
        }
      `}</style>
    </div>
  );
});

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(content: string, addLog?: (level: LogLevel, message: string) => void): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      if (typeof Muya === 'undefined') {
        const errorMsg = 'Markdown editor (Muya) is not loaded.';
        addLog?.('ERROR', `[MarkdownRenderer] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      return { output: <MuyaViewer content={content} /> };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown with Muya';
      addLog?.('ERROR', `[MarkdownRenderer] Render failed: ${error}`);
      return { output: <></>, error };
    }
  }
}

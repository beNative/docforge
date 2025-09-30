import React, { forwardRef } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core';
import { nord } from '@milkdown/theme-nord';
import { MilkdownProvider, useEditor } from '@milkdown/react';
import { commonmark } from '@milkdown/preset-commonmark';
import type { IRenderer } from './IRenderer';
import type { LogLevel } from '../../types';
import { useTheme } from '../../hooks/useTheme';

import '@milkdown/theme-nord/style.css';

interface MilkdownViewerProps {
  content: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

const MilkdownViewer = forwardRef<HTMLDivElement, MilkdownViewerProps>(({ content, onScroll }, ref) => {
  const { theme } = useTheme();

  // This inner component uses a `key` prop to force re-mounting when the content changes.
  // This ensures `useEditor` is re-run with the new `defaultValueCtx`.
  const EditorWithContent = () => {
    const { editor } = useEditor((root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, content);
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => false,
            attributes: { class: 'milkdown-preview' },
          }));
        })
        .use(nord)
        .use(commonmark)
    );
    return <>{editor}</>;
  };

  return (
    <div ref={ref} onScroll={onScroll} className={`w-full h-full overflow-auto milkdown-container bg-secondary ${theme}`}>
      <MilkdownProvider>
        <EditorWithContent key={content} />
      </MilkdownProvider>
      <style>{`
        .milkdown-container {
          /* Apply app theme variables to Nord theme CSS variables */
          --nord0: var(--color-secondary); /* Main background */
          --nord1: var(--color-background); /* Lighter background */
          --nord2: var(--color-border);
          --nord3: var(--color-border);
          --nord4: var(--color-text-main); /* Headings */
          --nord5: var(--color-text-secondary);
          --nord6: var(--color-text-secondary); /* Main text */
          --nord7: rgb(var(--color-accent)); /* Primary accent */
          --nord8: rgb(var(--color-accent));
          --nord9: rgb(var(--color-accent-hover));
          --nord10: rgb(var(--color-success));
          --nord11: rgb(var(--color-warning));
          --nord12: rgb(var(--color-info));
          --nord13: rgb(var(--color-accent));
          --nord14: rgb(var(--color-destructive-text));
          --nord15: rgb(var(--color-warning));
        }

        .milkdown-container .milkdown-preview {
            padding: 1.5rem;
            max-width: var(--markdown-max-width, 800px);
            margin: 0 auto;
        }

        .milkdown-container .prose {
          font-size: var(--markdown-font-size, 16px) !important;
          line-height: var(--markdown-line-height, 1.7) !important;
        }

        .milkdown-container .prose, 
        .milkdown-container .prose h1, .milkdown-container .prose h2, .milkdown-container .prose h3, .milkdown-container .prose h4, .milkdown-container .prose h5, .milkdown-container .prose h6 {
            font-family: 'Inter', sans-serif !important;
        }
        
        .milkdown-container .prose code, .milkdown-container .prose pre {
            font-family: 'JetBrains Mono', monospace !important;
        }

        /* Hide editor-specific elements in read-only mode */
        .milkdown .ProseMirror-cursor, .milkdown .prosemirror-gapcursor {
            display: none !important;
        }
        .milkdown-container .prose hr {
            background-color: rgb(var(--color-border)) !important;
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
      return { output: <MilkdownViewer content={content} /> };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown with Milkdown';
      addLog?.('ERROR', `[MarkdownRenderer] Render failed: ${error}`);
      return { output: <></>, error };
    }
  }
}
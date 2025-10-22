import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import type { Highlighter } from 'shiki';
import mermaid from 'mermaid';
import type { IRenderer } from './IRenderer';
import type { LogLevel, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { getSharedHighlighter } from './shikiHighlighter';
import { PlantUMLDiagram, PLANTUML_LANGS, isPlantUmlLanguage } from './plantumlDiagram';
import ZoomPanContainer from '../../components/ZoomPanContainer';

import 'katex/dist/katex.min.css';

interface MarkdownViewerProps {
  content: string;
  settings: Settings;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

interface MermaidDiagramProps {
  code: string;
  theme: 'light' | 'dark';
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const renderIdRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      const target = containerRef.current;
      const trimmed = code.trim();

      if (!target) {
        return;
      }

      if (!trimmed) {
        target.innerHTML = '';
        setError(null);
        setErrorDetails(null);
        return;
      }

      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: theme === 'dark' ? 'dark' : 'default',
        });
        const { svg } = await mermaid.render(renderIdRef.current, trimmed);
        if (!cancelled) {
          target.innerHTML = svg;
          setError(null);
          setErrorDetails(null);
        }
      } catch (err) {
        if (!cancelled) {
          target.innerHTML = '';
          const details = err instanceof Error ? err.message : String(err);
          console.error('[MermaidDiagram] Failed to render diagram', err);
          setError('Unable to render the Mermaid diagram. Please verify the diagram syntax.');
          setErrorDetails(details);
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  return (
    <div className="df-mermaid">
      <div ref={containerRef} role="img" aria-label="Mermaid diagram" />
      {error && (
        <div className="df-mermaid-error" role="alert">
          <div className="df-mermaid-error__message">{error}</div>
          {errorDetails && (
            <details className="df-mermaid-error__details">
              <summary>Technical details</summary>
              <code>{errorDetails}</code>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const MarkdownViewer = forwardRef<HTMLDivElement, MarkdownViewerProps>(({ content, settings, onScroll }, ref) => {
  const { theme } = useTheme();
  const viewTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let isMounted = true;

    getSharedHighlighter()
      .then((loadedHighlighter) => {
        if (isMounted) {
          setHighlighter(loadedHighlighter);
        }
      })
      .catch((error) => {
        console.error('[MarkdownRenderer] Failed to load Shiki highlighter', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [rehypeSlug, rehypeKatex, rehypeRaw], []);

  const components = useMemo<Components>(() => {
    const stringifyChildren = (value: React.ReactNode): string => {
      return React.Children.toArray(value)
        .map((child) => {
          if (typeof child === 'string') {
            return child;
          }
          if (React.isValidElement(child)) {
            return stringifyChildren(child.props.children);
          }
          return '';
        })
        .join('');
    };

    const mergeClassNames = (
      ...classNames: Array<string | undefined | null | false>
    ): string => classNames.filter(Boolean).join(' ');

    const MarkdownCode: Components['code'] = ({
      inline,
      className,
      children,
      ...props
    }: React.ComponentProps<'code'> & { inline?: boolean }) => {
      if (inline) {
        return (
          <code className={mergeClassNames('df-inline-code', className)} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className={mergeClassNames(className)} {...props}>
          {children}
        </code>
      );
    };

    return {
      code: MarkdownCode,
      pre({ children, className, node: _node, ...props }) {
        const childArray = React.Children.toArray(children);
        const codeChild = childArray.find(
          (child) =>
            React.isValidElement(child) && (child.type === 'code' || child.type === MarkdownCode)
        ) as React.ReactElement | undefined;

        const codeProps = (codeChild?.props ?? {}) as Record<string, unknown>;
        const languageMatch =
          typeof codeProps.className === 'string'
            ? /language-([\w-]+)/.exec(codeProps.className)
            : null;
        const language = languageMatch?.[1];
        const normalizedLanguage = language?.toLowerCase();
        const raw = stringifyChildren(codeChild?.props?.children ?? []);
        const normalizedContent = raw.replace(/\r\n?/g, '\n');

        if (normalizedLanguage === 'mermaid') {
          return <MermaidDiagram code={normalizedContent} theme={viewTheme} />;
        }

        if (normalizedLanguage && isPlantUmlLanguage(normalizedLanguage)) {
          return <PlantUMLDiagram code={normalizedContent} mode={settings.plantumlRendererMode} />;
        }

        const baseClassName = ['df-code-block', className, codeChild?.props?.className]
          .filter(Boolean)
          .join(' ');

        if (normalizedLanguage && highlighter) {
          try {
            const html = highlighter.codeToHtml(normalizedContent, {
              lang: normalizedLanguage as any,
              theme: viewTheme === 'dark' ? 'one-dark-pro' : 'github-light',
            });

            const compactHtml = html
              .replace(/>\s*\n\s*</g, '><')
              .replace(/\n(<\/code>)/g, '$1')
              .replace(/\n(<\/pre>)/g, '$1');

            return (
              <div
                className={[baseClassName, 'df-code-block-shiki'].filter(Boolean).join(' ')}
                data-language={normalizedLanguage ? normalizedLanguage.toUpperCase() : undefined}
                dangerouslySetInnerHTML={{ __html: compactHtml }}
                role="group"
              />
            );
          } catch (error) {
            console.warn('[MarkdownRenderer] Failed to highlight code block for language ' + language + ':', error);
          }
        }

        const { children: _codeChildren, inline: _inline, node: _codeNode, ...restCodeProps } = codeProps;

        return (
          <pre
            className={baseClassName}
            data-language={normalizedLanguage ? normalizedLanguage.toUpperCase() : undefined}
            {...props}
          >
            <code
              className={['df-code-block__code', codeChild?.props?.className].filter(Boolean).join(' ')}
              {...(restCodeProps as React.HTMLAttributes<HTMLElement>)}
            >
              {normalizedContent}
            </code>
          </pre>
        );
      },
      table({ children, className, ...props }) {
        return (
          <div className="df-table-wrapper">
            <table className={mergeClassNames('df-table', className)} {...props}>
              {children}
            </table>
          </div>
        );
      },
      thead({ children, className, ...props }) {
        return (
          <thead className={mergeClassNames('df-table-head', className)} {...props}>
            {children}
          </thead>
        );
      },
      tbody({ children, className, ...props }) {
        return (
          <tbody className={mergeClassNames('df-table-body', className)} {...props}>
            {children}
          </tbody>
        );
      },
      tr({ children, className, ...props }) {
        return (
          <tr className={mergeClassNames('df-table-row', className)} {...props}>
            {children}
          </tr>
        );
      },
      th({ children, className, ...props }) {
        return (
          <th className={mergeClassNames('df-table-header', className)} {...props}>
            {children}
          </th>
        );
      },
      td({ children, className, ...props }) {
        return (
          <td className={mergeClassNames('df-table-cell', className)} {...props}>
            {children}
          </td>
        );
      },
      blockquote({ children, className, ...props }) {
        return (
          <blockquote className={mergeClassNames('df-blockquote', className)} {...props}>
            {children}
          </blockquote>
        );
      },
      a({ children, className, ...props }) {
        return (
          <a className={mergeClassNames('df-link', className)} {...props}>
            {children}
          </a>
        );
      },
      img(props) {
        return <img className="df-image" loading="lazy" {...props} />;
      },
      ul({ children, className, ...props }) {
        return (
          <ul className={mergeClassNames('df-list', 'df-list-disc', className)} {...props}>
            {children}
          </ul>
        );
      },
      ol({ children, className, ...props }) {
        return (
          <ol className={mergeClassNames('df-list', 'df-list-decimal', className)} {...props}>
            {children}
          </ol>
        );
      },
      li({ children, className, ...props }) {
        return (
          <li className={mergeClassNames('df-list-item', className)} {...props}>
            {children}
          </li>
        );
      },
      hr({ className, ...props }) {
        return <hr className={mergeClassNames('df-divider', className)} {...props} />;
      },
    } as Components;
  }, [highlighter, viewTheme, settings.plantumlRendererMode]);

  return (
    <div ref={ref} onScroll={onScroll} className={`w-full h-full overflow-auto bg-secondary df-markdown-container ${theme}`}>
      <ZoomPanContainer
        disablePan
        layout="natural"
        lockOverflow={false}
        className="min-h-full"
        wrapperClassName="df-markdown-shell"
        contentClassName="df-markdown-stage origin-top"
      >
        <ReactMarkdown
          className="df-markdown"
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content || ' '}
        </ReactMarkdown>
      </ZoomPanContainer>
      <style>{`
        .df-markdown-container {
          background: rgb(var(--color-secondary));
        }

        .df-markdown-stage {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .df-markdown-shell {
          width: 100%;
          min-height: 100%;
          display: flex;
          justify-content: center;
          padding: clamp(1.5rem, 4vw, 3rem);
          padding-top: var(--markdown-content-padding, 48px);
          padding-bottom: var(--markdown-content-padding, 48px);
        }

        .df-markdown {
          width: 100%;
          max-width: var(--markdown-max-width, 860px);
          font-size: var(--markdown-font-size, 16px);
          line-height: var(--markdown-line-height, 1.7);
          color: rgb(var(--color-text-main));
          font-family: var(--markdown-body-font-family, 'Inter, sans-serif');
          --df-inline-code-bg: rgba(var(--color-border), 0.35);
          --df-inline-code-border-color: rgba(var(--color-border), 0.55);
          --df-code-block-bg: rgba(var(--color-border), 0.25);
          --df-code-block-border-color: rgba(var(--color-border), 0.6);
          --df-table-border-color: rgba(var(--color-border), 0.65);
          --df-table-header-bg: rgba(var(--color-border), 0.35);
          --df-table-row-alt-bg: rgba(var(--color-border), 0.18);
          --df-divider-color: rgba(var(--color-border), 0.9);
        }

        .df-markdown > * {
          margin-top: 0;
        }

        .df-markdown > * + * {
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-paragraph-spacing, 0.75));
        }

        .df-markdown h1 {
          font-size: calc(var(--markdown-font-size, 16px) * 2.3);
          font-weight: 700;
          letter-spacing: -0.03em;
          padding-bottom: calc(var(--markdown-font-size, 16px) * 0.4);
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-heading-spacing, 2.0));
          border-bottom: 1px solid rgb(var(--color-border));
          font-family: var(--markdown-heading-font-family, var(--markdown-body-font-family, 'Inter, sans-serif'));
        }

        .df-markdown h2 {
          font-size: calc(var(--markdown-font-size, 16px) * 1.9);
          font-weight: 600;
          letter-spacing: -0.02em;
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-heading-spacing, 1.8));
          font-family: var(--markdown-heading-font-family, var(--markdown-body-font-family, 'Inter, sans-serif'));
        }

        .df-markdown h3 {
          font-size: calc(var(--markdown-font-size, 16px) * 1.6);
          font-weight: 600;
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-heading-spacing, 1.6));
          font-family: var(--markdown-heading-font-family, var(--markdown-body-font-family, 'Inter, sans-serif'));
        }

        .df-markdown h4 {
          font-size: calc(var(--markdown-font-size, 16px) * 1.4);
          font-weight: 600;
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-heading-spacing, 1.4));
          font-family: var(--markdown-heading-font-family, var(--markdown-body-font-family, 'Inter, sans-serif'));
        }

        .df-markdown h5,
        .df-markdown h6 {
          font-size: calc(var(--markdown-font-size, 16px) * 1.2);
          font-weight: 600;
          margin-top: calc(var(--markdown-font-size, 16px) * var(--markdown-heading-spacing, 1.2));
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgb(var(--color-text-secondary));
          font-family: var(--markdown-heading-font-family, var(--markdown-body-font-family, 'Inter, sans-serif'));
        }

        .df-markdown h1:first-child,
        .df-markdown h2:first-child,
        .df-markdown h3:first-child,
        .df-markdown h4:first-child,
        .df-markdown h5:first-child,
        .df-markdown h6:first-child {
          margin-top: 0;
        }

        .df-markdown p {
          color: rgb(var(--color-text-main));
          margin: 0;
        }

        .df-markdown strong {
          color: rgb(var(--color-text-main));
          font-weight: 600;
        }

        .df-markdown :not(pre) > code {
          display: inline-block;
          background-color: var(--df-inline-code-bg);
          color: rgb(var(--color-text-main));
          padding: 0.2rem 0.45rem;
          border-radius: 0.35rem;
          border: 1px solid var(--df-inline-code-border-color);
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: var(--markdown-font-size, 16px);
          line-height: inherit;
          white-space: pre-wrap;
        }

        .df-code-block {
          background: var(--markdown-code-block-background, var(--df-code-block-bg));
          border: 1px solid var(--df-code-block-border-color);
          border-radius: 0.9rem;
          padding: 1.25rem 1.5rem;
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: var(--markdown-code-font-size, 14px);
          line-height: 1.6;
          overflow: auto;
          position: relative;
          box-sizing: border-box;
        }

        .df-code-block__code {
          display: block;
          white-space: pre;
          color: rgb(var(--color-text-main));
        }

        .df-code-block::-webkit-scrollbar {
          height: 10px;
        }

        .df-code-block::-webkit-scrollbar-thumb {
          background: rgba(var(--color-border), 0.8);
          border-radius: 6px;
        }

        .df-code-block[data-language]::before {
          content: attr(data-language);
          position: absolute;
          top: 0.65rem;
          right: 1rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: rgba(var(--color-text-secondary), 0.85);
        }

        .df-code-block .line {
          display: block;
          line-height: 1.4;
        }

        .df-code-block .line:empty:not(:last-child)::before {
          content: '\\00a0';
        }

        .df-code-block-shiki .shiki {
          background-color: transparent !important;
          padding: 0;
        }

        .df-code-block-shiki .shiki code {
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: var(--markdown-code-font-size, 14px);
        }

        .df-code-block-shiki .shiki .line.highlighted {
          background: rgba(var(--color-accent), 0.12);
          border-left: 3px solid rgba(var(--color-accent), 0.75);
          padding-left: 0.5rem;
        }

        .df-markdown pre code {
          background: transparent;
          padding: 0;
          border: 0;
        }

        .df-blockquote {
          border-left: 4px solid rgba(var(--color-accent), 0.45);
          padding-left: 1.25rem;
          color: rgba(var(--color-text-secondary), 0.95);
          font-style: italic;
          background: rgba(var(--color-background), 0.65);
          border-radius: 0 0.75rem 0.75rem 0;
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }

        .df-link {
          color: rgb(var(--color-accent));
          text-decoration: underline;
          text-decoration-thickness: 2px;
          text-underline-offset: 0.25rem;
          transition: color 0.15s ease, text-decoration-color 0.15s ease;
        }

        .df-link:hover {
          color: rgb(var(--color-accent-hover));
          text-decoration-color: rgb(var(--color-accent-hover));
        }

        .df-table-wrapper {
          overflow-x: auto;
          border-radius: 0.75rem;
          border: 1px solid var(--df-table-border-color);
          background: rgba(var(--color-background), 0.96);
          margin: calc(var(--markdown-font-size, 16px) * 1.25) 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .df-table {
          width: 100%;
          border-collapse: collapse;
          min-width: max(100%, 640px);
        }

        .df-table-head .df-table-header {
          background: var(--df-table-header-bg);
        }

        .df-table-body .df-table-row:nth-child(even) .df-table-cell {
          background: var(--df-table-row-alt-bg);
        }

        .df-table-header,
        .df-table-cell {
          border: 1px solid var(--df-table-border-color);
          padding: 0.75rem 1rem;
          text-align: left;
          vertical-align: top;
        }

        .df-table-header {
          font-weight: 600;
          color: rgb(var(--color-text-secondary));
        }

        .df-list {
          padding-left: 1.5rem;
          margin: calc(var(--markdown-font-size, 16px) * 0.9) 0;
        }

        .df-list-disc {
          list-style-type: disc;
        }

        .df-list-decimal {
          list-style-type: decimal;
        }

        .df-list-item {
          margin: 0.45rem 0;
        }

        .df-divider {
          border: none;
          height: 1px;
          margin: calc(var(--markdown-font-size, 16px) * 2.5) 0;
          background-color: var(--df-divider-color);
        }

        .df-markdown > .df-divider:first-child {
          margin-top: 0;
        }

        .df-markdown-container.light .df-markdown {
          --df-inline-code-bg: #f6f8fa;
          --df-inline-code-border-color: #d0d7de;
          --df-code-block-bg: #f6f8fa;
          --df-code-block-border-color: #d0d7de;
          --df-table-border-color: #d0d7de;
          --df-table-header-bg: #f6f8fa;
          --df-table-row-alt-bg: #f0f3f6;
          --df-divider-color: #d0d7de;
          color: #1f2328;
        }

        .df-markdown-container.dark .df-markdown {
          --df-inline-code-bg: rgba(240, 246, 252, 0.18);
          --df-inline-code-border-color: rgba(240, 246, 252, 0.25);
          --df-code-block-bg: rgba(240, 246, 252, 0.07);
          --df-code-block-border-color: rgba(240, 246, 252, 0.2);
          --df-table-border-color: rgba(240, 246, 252, 0.18);
          --df-table-header-bg: rgba(240, 246, 252, 0.07);
          --df-table-row-alt-bg: rgba(240, 246, 252, 0.05);
          --df-divider-color: rgba(240, 246, 252, 0.18);
        }

        .df-image {
          max-width: 100%;
          border-radius: 0.9rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          margin: calc(var(--markdown-font-size, 16px) * 1.5) auto;
          display: block;
        }

        .df-markdown code {
          word-break: break-word;
        }

        .df-markdown-shell code {
          color: inherit;
        }

        .df-markdown-shell figcaption {
          margin-top: 0.5rem;
          text-align: center;
          color: rgba(var(--color-text-secondary), 0.85);
          font-size: 0.9rem;
        }

        .df-markdown-shell details {
          border: 1px solid rgba(var(--color-border), 0.7);
          border-radius: 0.75rem;
          padding: 1rem 1.2rem;
          background: rgba(var(--color-background), 0.6);
        }

        .df-markdown-shell summary {
          cursor: pointer;
          font-weight: 600;
        }

        .df-mermaid,
        .df-plantuml {
          border: 1px solid rgba(var(--color-border), 0.9);
          border-radius: 0.9rem;
          background: rgba(var(--color-background), 0.75);
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
          margin: calc(var(--markdown-font-size, 16px) * 1.4) 0;
          text-align: center;
        }

        .df-mermaid svg,
        .df-plantuml img,
        .df-plantuml svg {
          width: 100%;
          height: auto;
        }

        .df-mermaid-error,
        .df-plantuml-error {
          margin-top: 0.75rem;
          font-size: 0.9rem;
          color: rgb(var(--color-destructive-text));
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-start;
          text-align: left;
          user-select: text;
        }

        .df-mermaid-error__message,
        .df-plantuml-error__message {
          font-weight: 600;
        }

        .df-mermaid-error__details,
        .df-plantuml-error__details {
          width: 100%;
          border: 1px solid rgba(var(--color-border), 0.6);
          border-radius: 0.5rem;
          padding: 0.75rem 0.85rem;
          background: rgba(var(--color-background), 0.6);
          color: rgba(var(--color-text-secondary), 0.95);
          user-select: text;
        }

        .df-mermaid-error__details > summary,
        .df-plantuml-error__details > summary {
          cursor: pointer;
          font-weight: 600;
          color: rgb(var(--color-destructive-text));
        }

        .df-mermaid-error__details code,
        .df-plantuml-error__details code {
          display: block;
          margin-top: 0.5rem;
          word-break: break-word;
          font-size: 0.85rem;
          color: rgba(var(--color-text), 0.95);
        }

        .df-plantuml-loading {
          font-size: 0.9rem;
          color: rgba(var(--color-text-secondary), 0.9);
        }

        .df-markdown .katex {
          font-size: calc(var(--markdown-font-size, 16px) * 1.05);
        }

        .df-markdown .katex-display {
          margin: calc(var(--markdown-font-size, 16px) * var(--markdown-paragraph-spacing, 0.75)) 0;
        }
      `}</style>
    </div>
  );
});

export class MarkdownRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    return languageId === 'markdown';
  }

  async render(
    content: string,
    addLog?: (level: LogLevel, message: string) => void,
    languageId?: string | null,
    settings?: Settings,
  ): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      const effectiveSettings = settings ?? DEFAULT_SETTINGS;
      return { output: <MarkdownViewer content={content} settings={effectiveSettings} /> };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown';
      addLog?.('ERROR', `[MarkdownRenderer] Render failed: ${error}`);
      return { output: <></>, error };
    }
  }
}

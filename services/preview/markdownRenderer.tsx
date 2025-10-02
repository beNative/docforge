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
import plantumlEncoder from 'plantuml-encoder';
import type { IRenderer } from './IRenderer';
import type { LogLevel } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { getSharedHighlighter } from './shikiHighlighter';

import 'katex/dist/katex.min.css';

interface MarkdownViewerProps {
  content: string;
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

interface PlantUMLDiagramProps {
  code: string;
}

const PLANTUML_LANGS = ['plantuml', 'puml', 'uml'];
const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg';

const PlantUMLDiagram: React.FC<PlantUMLDiagramProps> = ({ code }) => {
  const [hasError, setHasError] = useState(false);

  const encoded = useMemo(() => {
    try {
      return plantumlEncoder.encode(code.trim());
    } catch (err) {
      return null;
    }
  }, [code]);

  if (!encoded) {
    return <div className="df-plantuml df-plantuml-error">Unable to encode PlantUML diagram.</div>;
  }

  if (hasError) {
    return <div className="df-plantuml df-plantuml-error">Failed to load PlantUML diagram from server.</div>;
  }

  return (
    <div className="df-plantuml">
      <img
        src={`${PLANTUML_SERVER}/${encoded}`}
        alt="PlantUML diagram"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const MarkdownViewer = forwardRef<HTMLDivElement, MarkdownViewerProps>(({ content, onScroll }, ref) => {
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

  const components = useMemo<Components>(() => ({
    code({ inline, className, children, ...props }) {
      if (inline) {
        return (
          <code className="df-inline-code" {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children, className, ...props }) {
      const childArray = React.Children.toArray(children);
      const codeChild = childArray.find(
        (child) => React.isValidElement(child) && typeof child.props.className === 'string'
      ) as React.ReactElement | undefined;
      const language = codeChild?.props.className
        ? /language-([\w-]+)/.exec(codeChild.props.className)?.[1]
        : undefined;
      const normalizedLanguage = language?.toLowerCase();

      if (normalizedLanguage === 'mermaid' && codeChild) {
        const raw = React.Children.toArray(codeChild.props.children)
          .map((child) => (typeof child === 'string' ? child : ''))
          .join('');
        return <MermaidDiagram code={raw} theme={viewTheme} />;
      }

      if (normalizedLanguage && PLANTUML_LANGS.includes(normalizedLanguage) && codeChild) {
        const raw = React.Children.toArray(codeChild.props.children)
          .map((child) => (typeof child === 'string' ? child : ''))
          .join('');
        return <PlantUMLDiagram code={raw} />;
      }

      const baseClassName = ['df-code-block', className].filter(Boolean).join(' ');

      if (normalizedLanguage && codeChild && highlighter) {
        const raw = React.Children.toArray(codeChild.props.children)
          .map((child) => (typeof child === 'string' ? child : ''))
          .join('');

        try {
          const html = highlighter.codeToHtml(raw, {
            lang: normalizedLanguage as any,
            theme: viewTheme === 'dark' ? 'one-dark-pro' : 'github-light',
          });

          return (
            <div
              className={[baseClassName, 'df-code-block-shiki'].filter(Boolean).join(' ')}
              data-language={normalizedLanguage ? normalizedLanguage.toUpperCase() : undefined}
              dangerouslySetInnerHTML={{ __html: html }}
              {...props}
            />
          );
        } catch (error) {
          console.warn('[MarkdownRenderer] Failed to highlight code block for language ' + language + ':', error);
        }
      }

      return (
        <pre
          className={baseClassName}
          data-language={normalizedLanguage ? normalizedLanguage.toUpperCase() : undefined}
          {...props}
        >
          {children}
        </pre>
      );
    },
    table({ children, ...props }) {
      return (
        <div className="df-table-wrapper">
          <table {...props}>{children}</table>
        </div>
      );
    },
    th({ children, ...props }) {
      return (
        <th className="df-table-header" {...props}>
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td className="df-table-cell" {...props}>
          {children}
        </td>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote className="df-blockquote" {...props}>
          {children}
        </blockquote>
      );
    },
    a({ children, ...props }) {
      return (
        <a className="df-link" {...props}>
          {children}
        </a>
      );
    },
    img(props) {
      return <img className="df-image" loading="lazy" {...props} />;
    },
    ul({ children, ...props }) {
      return (
        <ul className="df-list df-list-disc" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="df-list df-list-decimal" {...props}>
          {children}
        </ol>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="df-list-item" {...props}>
          {children}
        </li>
      );
    },
    hr(props) {
      return <hr className="df-divider" {...props} />;
    },
  }), [highlighter, viewTheme]);

  return (
    <div ref={ref} onScroll={onScroll} className={`w-full h-full overflow-auto bg-secondary df-markdown-container ${theme}`}>
      <div className="df-markdown-shell">
        <ReactMarkdown
          className="df-markdown"
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content || ' '}
        </ReactMarkdown>
      </div>
      <style>{`
        .df-markdown-container {
          background: rgb(var(--color-secondary));
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

        .df-inline-code {
          background: rgba(var(--color-text-secondary), 0.12);
          color: rgb(var(--color-accent));
          padding: 0.15rem 0.45rem;
          border-radius: 0.4rem;
          border: 1px solid rgba(var(--color-border), 0.7);
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: calc(var(--markdown-code-font-size, 14px) * 0.9);
        }

        .df-code-block {
          background: var(--markdown-code-block-background, rgba(var(--color-text-secondary), 0.08));
          border: 1px solid rgba(var(--color-border), 0.95);
          border-radius: 0.9rem;
          padding: 1.25rem 1.5rem;
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: var(--markdown-code-font-size, 14px);
          line-height: 1.65;
          overflow: auto;
          position: relative;
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

        .df-code-block pre {
          margin: 0;
          padding: 0;
          background: transparent !important;
          font-family: var(--markdown-code-font-family, 'JetBrains Mono', monospace);
          font-size: var(--markdown-code-font-size, 14px);
        }

        .df-code-block pre code {
          background: transparent;
          padding: 0;
        }

        .df-code-block .line {
          display: block;
          min-height: 1.35em;
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
          border-radius: 0.9rem;
          border: 1px solid rgba(var(--color-border), 0.9);
          background: rgba(var(--color-secondary), 0.92);
          margin: calc(var(--markdown-font-size, 16px) * 1.25) 0;
        }

        .df-table-wrapper table {
          width: 100%;
          border-collapse: collapse;
        }

        .df-table-wrapper tbody tr:nth-child(even) {
          background: rgba(var(--color-background), 0.65);
        }

        .df-table-header {
          font-weight: 600;
          text-align: left;
          padding: 0.9rem 1.1rem;
          color: rgb(var(--color-text-secondary));
        }

        .df-table-cell {
          padding: 0.85rem 1.1rem;
        }

        .df-table-wrapper tbody tr:last-child .df-table-cell {
          border-bottom: none;
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
          height: 2px;
          border: none;
          background: rgba(var(--color-border), 1);
          margin: calc(var(--markdown-font-size, 16px) * 2.5) 0;
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
        .df-plantuml img {
          width: 100%;
          height: auto;
        }

        .df-mermaid-error,
        .df-plantuml-error {
          margin-top: 0.75rem;
          font-size: 0.9rem;
          color: rgb(var(--color-destructive-text));
        }

        .df-mermaid-error {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-start;
          text-align: left;
        }

        .df-mermaid-error__message {
          font-weight: 600;
        }

        .df-mermaid-error__details {
          width: 100%;
          border: 1px solid rgba(var(--color-border), 0.6);
          border-radius: 0.5rem;
          padding: 0.75rem 0.85rem;
          background: rgba(var(--color-background), 0.6);
          color: rgba(var(--color-text-secondary), 0.95);
        }

        .df-mermaid-error__details > summary {
          cursor: pointer;
          font-weight: 600;
          color: rgb(var(--color-destructive-text));
        }

        .df-mermaid-error__details code {
          display: block;
          margin-top: 0.5rem;
          word-break: break-word;
          font-size: 0.85rem;
          color: rgba(var(--color-text), 0.95);
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

  async render(content: string, addLog?: (level: LogLevel, message: string) => void): Promise<{ output: React.ReactElement; error?: string }> {
    try {
      return { output: <MarkdownViewer content={content} /> };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to render Markdown';
      addLog?.('ERROR', `[MarkdownRenderer] Render failed: ${error}`);
      return { output: <></>, error };
    }
  }
}

import React, { useState, useEffect } from 'react';
import { previewService } from '../services/previewService';
import Spinner from './Spinner';
import { useTheme } from '../hooks/useTheme';

// Let TypeScript know mermaid is available on the window
declare const mermaid: any;

/**
 * Safely unescapes HTML entities.
 */
const unescapeHtml = (html: string): string => {
    try {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    } catch(e) {
        // Fallback in case of malformed HTML.
        return html;
    }
};

interface PreviewPaneProps {
  content: string;
  language: string | null;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

const PreviewPane = React.forwardRef<HTMLDivElement, PreviewPaneProps>(({ content, language, onScroll }, ref) => {
  const [renderedOutput, setRenderedOutput] = useState<React.ReactElement | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    let isCancelled = false;
    
    const render = async () => {
      // Don't show loader for quick renders, only if it takes time.
      const loadingTimer = setTimeout(() => {
        if (!isCancelled) setIsLoading(true);
      }, 150);

      setError(null);
      const renderer = previewService.getRendererForLanguage(language);
      const result = await renderer.render(content);

      clearTimeout(loadingTimer);
      if (!isCancelled) {
        if (result.error) {
          setError(result.error);
          setRenderedOutput(null);
        } else {
          setRenderedOutput(result.output);
        }
        setIsLoading(false);
      }
    };

    // Debounce rendering to avoid updates on every keystroke.
    const debounceTimer = setTimeout(render, 250);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [content, language]);

  // Effect to render Mermaid diagrams after the main content is in the DOM
  useEffect(() => {
    if (renderedOutput && ref && typeof ref !== 'function' && ref.current && typeof mermaid !== 'undefined') {
      try {
        // Initialize with the current theme. This is safe to call multiple times.
        mermaid.initialize({
            startOnLoad: false,
            theme: theme === 'dark' ? 'dark' : 'default',
            securityLevel: 'strict',
        });
       
        const mermaidNodes = ref.current.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          // The markdown renderer HTML-escapes the content of mermaid blocks
          // to prevent the marked.js parser from breaking on characters like '<'.
          // We need to un-escape it here so mermaid.js gets the raw diagram source.
          mermaidNodes.forEach(node => {
            const escapedContent = node.innerHTML;
            node.textContent = unescapeHtml(escapedContent);
          });
          
          // mermaid.run() is async, but we don't need to await it.
          mermaid.run({ nodes: mermaidNodes }).catch((e: Error) => {
            console.error("Mermaid.js rendering error:", e.message);
            // We could set an error state here to show in the UI if needed
          });
        }
      } catch (e) {
        if (e instanceof Error) {
            console.error("Mermaid.js initialization failed:", e.message);
        }
      }
    }
  }, [renderedOutput, ref, theme]);


  return (
    <div ref={ref} onScroll={onScroll} className="w-full h-full p-6 overflow-auto bg-secondary">
      {isLoading && (
        <div className="flex items-center justify-center h-full text-text-secondary">
            <Spinner />
            <span className="ml-2">Generating preview...</span>
        </div>
      )}
      {error && <div className="text-destructive-text p-3 bg-destructive-bg rounded-md">{error}</div>}
      {!isLoading && !error && renderedOutput}
    </div>
  );
});

export default PreviewPane;
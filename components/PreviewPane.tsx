import React, { useState, useEffect } from 'react';
import { previewService } from '../services/previewService';
import Spinner from './Spinner';
import { useTheme } from '../hooks/useTheme';
import type { LogLevel } from '../types';

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
  addLog: (level: LogLevel, message: string) => void;
}

const PreviewPane = React.forwardRef<HTMLDivElement, PreviewPaneProps>(({ content, language, onScroll, addLog }, ref) => {
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
      const result = await renderer.render(content, addLog);

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
  }, [content, language, addLog]);

  // Effect to render Mermaid diagrams after the main content is in the DOM
  useEffect(() => {
    if (renderedOutput && ref && typeof ref !== 'function' && ref.current && typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({
            startOnLoad: false,
            theme: theme === 'dark' ? 'dark' : 'default',
            securityLevel: 'strict',
        });
       
        const mermaidNodes = ref.current.querySelectorAll('.mermaid');

        if (mermaidNodes.length > 0) {
            // Use mermaid.render for more control and to avoid race conditions with React's DOM management.
            mermaidNodes.forEach((node, index) => {
                const id = `mermaid-graph-${index}-${Date.now()}`;
                const rawCode = unescapeHtml(node.innerHTML);
                
                // Clear the node to prevent the raw code from flashing
                node.innerHTML = '<div class="flex items-center justify-center p-4 text-xs text-text-secondary"><span class="mr-2"><svg class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" viewBox="0 0 24 24"></svg></span>Rendering diagram...</div>';

                try {
                    // mermaid.render returns the SVG code as a string
                    const svg = mermaid.render(id, rawCode);
                    // Insert the rendered SVG into the node
                    node.innerHTML = svg;
                } catch(e) {
                    if (e instanceof Error) {
                        console.error("Mermaid.js rendering error:", e.message);
                        node.innerHTML = `<pre class="text-error text-xs p-2 bg-destructive-bg/20 rounded-md">Mermaid Error:\n${e.message}</pre>`;
                    }
                }
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
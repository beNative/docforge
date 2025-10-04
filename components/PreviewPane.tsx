import React, { useState, useEffect } from 'react';
import { previewService } from '../services/previewService';
import Spinner from './Spinner';
import { useTheme } from '../hooks/useTheme';
import type { LogLevel } from '../types';

interface PreviewPaneProps {
  content: string;
  language: string | null;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  addLog: (level: LogLevel, message: string) => void;
}

const PreviewPane = React.forwardRef<HTMLDivElement, PreviewPaneProps>(({ content, language, onScroll, addLog }, ref) => {
  const [renderedOutput, setRenderedOutput] = useState<React.ReactElement | null>(null);
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
      const result = await renderer.render(content, addLog, language);

      clearTimeout(loadingTimer);
      if (!isCancelled) {
        if (result.error) {
          setError(result.error);
          setRenderedOutput(null);
        } else {
          // Clone the returned element to inject the ref and onScroll handler
          // This allows renderers to provide components that can be scroll-synced.
          if (React.isValidElement(result.output)) {
            const elementWithProps = React.cloneElement(result.output, { ref, onScroll });
            setRenderedOutput(elementWithProps);
          } else {
            // Fallback for non-element outputs, though our current renderers all return elements.
            setRenderedOutput(<div ref={ref} onScroll={onScroll}>{result.output}</div>);
          }
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
  }, [content, language, addLog, ref, onScroll]);

  return (
    <div className="w-full h-full bg-secondary">
      {isLoading && (
        <div className="flex items-center justify-center h-full text-text-secondary p-6">
            <Spinner />
            <span className="ml-2">Generating preview...</span>
        </div>
      )}
      {error && <div className="text-destructive-text p-3 bg-destructive-bg rounded-md m-6">{error}</div>}
      {!isLoading && !error && renderedOutput}
    </div>
  );
});

export default PreviewPane;

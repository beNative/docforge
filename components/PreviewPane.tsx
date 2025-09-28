import React, { useState, useEffect } from 'react';
import { previewService } from '../services/previewService';
import Spinner from './Spinner';

interface PreviewPaneProps {
  content: string;
  language: string | null;
}

const PreviewPane: React.FC<PreviewPaneProps> = React.memo(({ content, language }) => {
  const [renderedOutput, setRenderedOutput] = useState<React.ReactElement | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="w-full h-full p-6 overflow-auto bg-secondary">
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

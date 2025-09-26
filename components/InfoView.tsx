
import React, { useState, useEffect, useMemo } from 'react';

// Let TypeScript know that 'marked' is available globally from the script tag in index.html
declare const marked: {
  parse(markdown: string): string;
};

type DocTab = 'Readme' | 'Functional Manual' | 'Technical Manual' | 'Version Log';

const docFiles: Record<DocTab, string> = {
  'Readme': 'README.md',
  'Functional Manual': 'FUNCTIONAL_MANUAL.md',
  'Technical Manual': 'TECHNICAL_MANUAL.md',
  'Version Log': 'VERSION_LOG.md',
};

const InfoView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocTab>('Readme');
  const [documents, setDocuments] = useState<Record<DocTab, string>>({
    'Readme': 'Loading...',
    'Functional Manual': 'Loading...',
    'Technical Manual': 'Loading...',
    'Version Log': 'Loading...',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocs = async () => {
      // Fix: Use optional chaining which is type-safe now with the global declaration.
      const isElectron = window.electronAPI;
      try {
        const docPromises = (Object.keys(docFiles) as DocTab[]).map(async (tab) => {
          const filename = docFiles[tab];
          let text = '';

          if (isElectron) {
            // Fix: Use optional chaining.
            const result = await window.electronAPI!.readDoc(filename);
            // Fix: Refactored to use an if/else block for more explicit type narrowing, resolving the error.
            if (result.success) {
              // After the guard, TypeScript knows `result` has `success: true` and a `content` property.
              text = result.content;
            } else {
              // If success is false, TypeScript correctly infers that `result` has an `error` property.
              throw new Error(result.error || `Failed to load ${filename} from main process.`);
            }
          } else {
            const response = await fetch(`./${filename}`);
            if (!response.ok) {
              throw new Error(`Failed to load ${filename} (${response.status} ${response.statusText})`);
            }
            text = await response.text();
          }
          return { tab, text };
        });

        const loadedDocs = await Promise.all(docPromises);

        const newDocumentsState = loadedDocs.reduce((acc, { tab, text }) => {
          acc[tab] = text;
          return acc;
        }, {} as Record<DocTab, string>);
        
        setDocuments(newDocumentsState);

      } catch (err) {
        if (err instanceof Error) {
            console.error("Error fetching documents:", err);
            setError(`Could not load documentation. Error: ${err.message}`);
            const errorState = (Object.keys(docFiles) as DocTab[]).reduce((acc, tab) => {
                acc[tab] = `# Error\nFailed to load content for ${tab}.`;
                return acc;
            }, {} as Record<DocTab, string>);
            setDocuments(errorState);
        }
      }
    };

    fetchDocs();
  }, []);

  const renderedHtml = useMemo(() => {
    if (typeof marked === 'undefined' || !documents[activeTab]) {
      return '';
    }
    return marked.parse(documents[activeTab]);
  }, [documents, activeTab]);

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden h-full">
      <h1 className="text-2xl font-semibold text-text-main mb-4 px-6 pt-6">Application Information</h1>
      <div className="flex border-b border-border-color mb-4 px-6">
        {(Object.keys(docFiles) as DocTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-main'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {error && <div className="mx-6 mb-4 text-destructive-text p-3 bg-destructive-bg rounded-md">{error}</div>}
      <div className="flex-1 bg-secondary overflow-y-auto p-6">
        <div className="markdown-content text-text-secondary" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
    </div>
  );
};

export default InfoView;

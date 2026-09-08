import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentOrFolder } from '../types';
import { DownloadIcon, ChevronDownIcon, FileIcon, GlobeIcon } from './Icons';
import Spinner from './Spinner';
import { isPlantUMLDocument, exportPlantUmlDocument } from '../services/plantumlExportService';
import { isMarkdownDocument, exportMarkdownAsHtml } from '../services/markdownHtmlExportService';
import { exportDocumentToFile, type DocumentExportResult } from '../services/documentExportService';

export interface ExportDocumentMenuProps {
  documentNode: DocumentOrFolder;
  currentContent: string;
  disabled?: boolean;
  onExportStarted?: () => void;
  onExportCompleted?: (result: DocumentExportResult) => void;
  onError?: (error: string) => void;
}

interface ExportOption {
  id: string;
  label: string;
  extensionLabel: string;
  icon?: React.ReactNode;
  action: () => Promise<DocumentExportResult>;
}

export const ExportDocumentMenu: React.FC<ExportDocumentMenuProps> = ({
  documentNode,
  currentContent,
  disabled = false,
  onExportStarted,
  onExportCompleted,
  onError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const docWithCurrentContent = useMemo<DocumentOrFolder>(() => ({
    ...documentNode,
    content: currentContent,
  }), [documentNode, currentContent]);

  const isPlantUml = useMemo(() => isPlantUMLDocument(docWithCurrentContent), [docWithCurrentContent]);
  const isMarkdown = useMemo(() => isMarkdownDocument(docWithCurrentContent), [docWithCurrentContent]);

  const hasMultipleFormats = isPlantUml || isMarkdown;

  const exportOptions = useMemo<ExportOption[]>(() => {
    if (isPlantUml) {
      return [
        {
          id: 'png',
          label: 'Save as PNG Image',
          extensionLabel: '.png',
          action: () => exportPlantUmlDocument(docWithCurrentContent, 'png'),
        },
        {
          id: 'svg',
          label: 'Save as SVG Vector',
          extensionLabel: '.svg',
          action: () => exportPlantUmlDocument(docWithCurrentContent, 'svg'),
        },
        {
          id: 'jpg',
          label: 'Save as JPEG Image',
          extensionLabel: '.jpg',
          action: () => exportPlantUmlDocument(docWithCurrentContent, 'jpg'),
        },
        {
          id: 'puml',
          label: 'Save as PlantUML Source',
          extensionLabel: '.puml',
          action: () => exportPlantUmlDocument(docWithCurrentContent, 'puml'),
        },
      ];
    }

    if (isMarkdown) {
      return [
        {
          id: 'md',
          label: 'Save as Markdown',
          extensionLabel: '.md',
          icon: <FileIcon className="w-3.5 h-3.5 mr-2 text-primary" />,
          action: () => exportDocumentToFile(docWithCurrentContent),
        },
        {
          id: 'html',
          label: 'Save as Standalone HTML',
          extensionLabel: '.html',
          icon: <GlobeIcon className="w-3.5 h-3.5 mr-2 text-info" />,
          action: () => exportMarkdownAsHtml(docWithCurrentContent),
        },
      ];
    }

    return [
      {
        id: 'file',
        label: 'Save to File',
        extensionLabel: '',
        action: () => exportDocumentToFile(docWithCurrentContent),
      },
    ];
  }, [isPlantUml, isMarkdown, docWithCurrentContent]);

  const executeExport = useCallback(async (action: () => Promise<DocumentExportResult>) => {
    setIsOpen(false);
    setIsExporting(true);
    onExportStarted?.();

    try {
      const result = await action();
      onExportCompleted?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      onError?.(message);
    } finally {
      setIsExporting(false);
    }
  }, [onExportStarted, onExportCompleted, onError]);

  const handleMainButtonClick = useCallback(() => {
    if (disabled || isExporting) return;
    if (hasMultipleFormats) {
      setIsOpen((prev) => !prev);
    } else {
      void executeExport(exportOptions[0].action);
    }
  }, [disabled, isExporting, hasMultipleFormats, executeExport, exportOptions]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {hasMultipleFormats ? (
        <div className="inline-flex rounded-md shadow-xs">
          <button
            type="button"
            onClick={handleMainButtonClick}
            disabled={disabled || isExporting}
            className={`inline-flex items-center px-1.5 py-1 rounded-l-md text-xs font-medium transition-colors ${
              disabled || isExporting
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-hover active:bg-active'
            }`}
            title="Save to File / Export"
            aria-label="Save to File / Export"
          >
            {isExporting ? <Spinner /> : <DownloadIcon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            disabled={disabled || isExporting}
            className={`inline-flex items-center px-1 py-1 rounded-r-md border-l border-border-color text-xs transition-colors ${
              disabled || isExporting
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : isOpen
                ? 'bg-active text-text-primary'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary'
            }`}
            title="Export formats"
            aria-label="Export formats"
          >
            <ChevronDownIcon className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMainButtonClick}
          disabled={disabled || isExporting}
          className={`inline-flex items-center justify-center p-1.5 rounded-md text-xs transition-colors ${
            disabled || isExporting
              ? 'opacity-40 cursor-not-allowed text-text-secondary'
              : 'text-text-secondary hover:text-text-primary hover:bg-hover active:bg-active'
          }`}
          title="Save to File"
          aria-label="Save to File"
        >
          {isExporting ? <Spinner /> : <DownloadIcon className="w-4 h-4" />}
        </button>
      )}

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-md bg-surface border border-border-color shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
          role="menu"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-text-secondary border-b border-border-color uppercase tracking-wider">
            {isPlantUml ? 'Export Diagram' : 'Export Document'}
          </div>
          {exportOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void executeExport(option.action)}
              className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-hover active:bg-active flex items-center justify-between transition-colors"
              role="menuitem"
            >
              <span className="flex items-center truncate">
                {option.icon}
                {option.label}
              </span>
              <span className="text-[10px] font-mono text-text-secondary bg-surface-variant px-1.5 py-0.5 rounded border border-border-color/50 ml-2 flex-shrink-0">
                {option.extensionLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportDocumentMenu;

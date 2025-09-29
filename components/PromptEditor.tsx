import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { DocumentOrFolder, Settings, ViewMode } from '../types';
import { llmService } from '../services/llmService';
import { SparklesIcon, TrashIcon, CopyIcon, CheckIcon, HistoryIcon, EyeIcon, PencilIcon, LayoutHorizontalIcon, LayoutVerticalIcon, RefreshIcon, SaveIcon, FormatIcon } from './Icons';
import Spinner from './Spinner';
import Modal from './Modal';
import { useLogger } from '../hooks/useLogger';
import IconButton from './IconButton';
import Button from './Button';
import MonacoEditor, { CodeEditorHandle } from './CodeEditor';
import PreviewPane from './PreviewPane';
import { SUPPORTED_LANGUAGES } from '../services/languageService';

interface DocumentEditorProps {
  documentNode: DocumentOrFolder;
  onSave: (prompt: Partial<Omit<DocumentOrFolder, 'id' | 'content'>>) => void;
  onCommitVersion: (content: string) => void;
  onDelete: (id: string) => void;
  settings: Settings;
  onShowHistory: () => void;
  onLanguageChange: (language: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  formatTrigger: number;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentNode, onSave, onCommitVersion, onDelete, settings, onShowHistory, onLanguageChange, onViewModeChange, formatTrigger }) => {
  const [title, setTitle] = useState(documentNode.title);
  const [content, setContent] = useState(documentNode.content || '');
  
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(documentNode.default_view_mode || 'edit');
  const [splitSize, setSplitSize] = useState(50);
  const { addLog } = useLogger();
  
  const isResizing = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);
  const isContentInitialized = useRef(false);
  const editorRef = useRef<CodeEditorHandle>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const syncTimeout = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  // Reset content and view when the document changes.
  useEffect(() => {
    setContent(documentNode.content || '');
    setViewMode(documentNode.default_view_mode || 'edit');
    setSplitSize(50);
    isContentInitialized.current = true;
  }, [documentNode.id, documentNode.default_view_mode]);

  useEffect(() => {
    setTitle(documentNode.title);
  }, [documentNode.id, documentNode.title]);
  
  useEffect(() => {
    // Only mark as dirty after the initial content has been loaded.
    if (isContentInitialized.current) {
        setIsDirty(content !== documentNode.content);
    }
  }, [content, documentNode.content]);

  // Debounced auto-save for title only
  useEffect(() => {
    if (title === documentNode.title) return;
    const handler = setTimeout(() => {
      onSave({ title });
    }, 500);
    return () => clearTimeout(handler);
  }, [title, onSave, documentNode.title]);
  
  // Triggered by command palette
  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }
    if (formatTrigger > 0) {
        editorRef.current?.format();
    }
  }, [formatTrigger]);

  // --- Resizable Splitter Logic ---
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    // Fix: The 'document' prop was shadowing the global 'document' object. Renamed the prop to 'documentNode' to resolve this.
    document.body.style.userSelect = 'none';
    // Fix: The 'document' prop was shadowing the global 'document' object. Renamed the prop to 'documentNode' to resolve this.
    document.body.style.cursor = viewMode === 'split-vertical' ? 'col-resize' : 'row-resize';
  };

  const handleGlobalMouseUp = useCallback(() => {
    isResizing.current = false;
    // Fix: The 'document' prop was shadowing the global 'document' object. Renamed the prop to 'documentNode' to resolve this.
    document.body.style.userSelect = 'auto';
    // Fix: The 'document' prop was shadowing the global 'document' object. Renamed the prop to 'documentNode' to resolve this.
    document.body.style.cursor = 'default';
  }, []);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !splitContainerRef.current) return;
    
    const container = splitContainerRef.current;
    const rect = container.getBoundingClientRect();
    const newSize = viewMode === 'split-vertical'
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;
    
    setSplitSize(Math.max(10, Math.min(90, newSize)));
  }, [viewMode]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // --- Scroll Synchronization Logic ---
  const handleEditorScroll = useCallback((scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number; }) => {
    if (!viewMode.startsWith('split-') || isSyncing.current || !previewScrollRef.current) return;
    
    if (scrollInfo.scrollHeight <= scrollInfo.clientHeight) return;

    const percentage = scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight);
    
    const previewEl = previewScrollRef.current;
    if (previewEl.scrollHeight <= previewEl.clientHeight) return;
    const newPreviewScrollTop = percentage * (previewEl.scrollHeight - previewEl.clientHeight);

    isSyncing.current = true;
    previewEl.scrollTop = newPreviewScrollTop;

    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = window.setTimeout(() => {
        isSyncing.current = false;
    }, 100);
  }, [viewMode]);

  const handlePreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!viewMode.startsWith('split-') || isSyncing.current || !editorRef.current) return;

    const previewEl = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = previewEl;

    if (scrollHeight <= clientHeight) return;

    const percentage = scrollTop / (scrollHeight - clientHeight);
    
    const editor = editorRef.current;
    editor.getScrollInfo().then(editorInfo => {
        if (!isSyncing.current && editorInfo.scrollHeight > editorInfo.clientHeight) {
            const newEditorScrollTop = percentage * (editorInfo.scrollHeight - editorInfo.clientHeight);
            
            isSyncing.current = true;
            editor.setScrollTop(newEditorScrollTop);

            if (syncTimeout.current) clearTimeout(syncTimeout.current);
            syncTimeout.current = window.setTimeout(() => {
                isSyncing.current = false;
            }, 100);
        }
    });
  }, [viewMode]);


  // --- Action Handlers ---
  const handleManualSave = () => {
    addLog('INFO', `User action: Manually save version for document "${title}".`);
    if (isDirty) {
      onCommitVersion(content);
    }
  };

  const handleViewModeButton = (newMode: ViewMode) => {
    setViewMode(newMode);
    onViewModeChange(newMode);
  };
  
  const handleFormatDocument = () => {
    editorRef.current?.format();
  };

  const handleRefine = async () => {
    setIsRefining(true);
    setError(null);
    addLog('INFO', `User action: Requesting AI refinement for document: "${title}"`);
    try {
      const result = await llmService.refineDocument(content, settings, addLog);
      setRefinedContent(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(message);
      addLog('ERROR', `AI refinement failed: ${message}`);
    } finally {
      setIsRefining(false);
    }
  };
  
  const handleGenerateTitle = async () => {
    if (!settings.llmProviderUrl || !settings.llmModelName || !content.trim()) return;
    setIsGeneratingTitle(true);
    setError(null);
    addLog('INFO', 'Attempting to generate title based on content.');
    try {
      const newTitle = await llmService.generateTitle(content, settings, addLog);
      setTitle(newTitle);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Could not generate title: ${message}`);
      addLog('ERROR', `Could not generate title: ${message}`);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const acceptRefinement = () => {
    if (refinedContent) {
      setContent(refinedContent);
      addLog('INFO', `AI refinement accepted for document: "${title}"`);
    }
    setRefinedContent(null);
  };
  
  const handleCopy = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setIsCopied(true);
    addLog('INFO', `Document content copied to clipboard.`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const language = documentNode.language_hint || 'plaintext';
  const supportsAiTools = ['markdown', 'plaintext'].includes(language);
  const supportsPreview = ['markdown', 'html'].includes(language);
  const supportsFormatting = ['javascript', 'typescript', 'json', 'html', 'css', 'xml', 'yaml'].includes(language);
  
  const renderContent = () => {
    const editor = <MonacoEditor ref={editorRef} content={content} language={language} onChange={setContent} onScroll={handleEditorScroll} />;
    const preview = <PreviewPane ref={previewScrollRef} content={content} language={language} onScroll={handlePreviewScroll} />;
    
    switch(viewMode) {
        case 'edit': return editor;
        case 'preview': return supportsPreview ? preview : editor;
        case 'split-vertical':
            return (
                <div ref={splitContainerRef} className="grid h-full" style={{ gridTemplateColumns: `${splitSize}% 1px minmax(0, 1fr)` }}>
                    <div className="h-full overflow-hidden min-w-0">{editor}</div>
                    <div onMouseDown={handleSplitterMouseDown} className="h-full bg-border-color/50 hover:bg-primary cursor-col-resize transition-colors"/>
                    <div className="h-full overflow-hidden min-w-0">{supportsPreview ? preview : editor}</div>
                </div>
            );
        case 'split-horizontal':
            return (
                <div ref={splitContainerRef} className="grid w-full h-full" style={{ gridTemplateRows: `${splitSize}% 1px minmax(0, 1fr)` }}>
                    <div className="w-full overflow-hidden min-h-0">{editor}</div>
                    <div onMouseDown={handleSplitterMouseDown} className="w-full bg-border-color/50 hover:bg-primary cursor-row-resize transition-colors"/>
                    <div className="w-full overflow-hidden min-h-0">{supportsPreview ? preview : editor}</div>
                </div>
            );
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="flex justify-between items-center px-4 h-7 gap-4 border-b border-border-color flex-shrink-0 bg-secondary">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document Title" disabled={isGeneratingTitle} className="bg-transparent text-base font-semibold text-text-main focus:outline-none w-full truncate"/>
            {supportsAiTools && (
              <IconButton onClick={handleGenerateTitle} disabled={isGeneratingTitle || !content.trim() || !settings.llmProviderUrl} tooltip="Regenerate Title with AI" size="xs" variant="ghost" className="flex-shrink-0">
                {isGeneratingTitle ? <Spinner /> : <RefreshIcon className="w-4 h-4 text-primary" />}
              </IconButton>
            )}
            {isDirty && <div className="relative group flex-shrink-0"><div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-max px-2 py-1 text-xs font-semibold text-tooltip-text bg-tooltip-bg rounded-md opacity-0 group-hover:opacity-100">Unsaved changes</span></div>}
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center"><label htmlFor="language-select" className="text-xs font-medium text-text-secondary mr-2">Language:</label><select id="language-select" value={language} onChange={(e) => onLanguageChange(e.target.value)} className="bg-background text-text-main text-xs rounded-md py-0.5 pl-2 pr-6 border border-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a3a3a3' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}>{SUPPORTED_LANGUAGES.map(lang => (<option key={lang.id} value={lang.id}>{lang.label}</option>))}</select></div>
            <div className="h-5 w-px bg-border-color mx-1"></div>
            {supportsPreview && (
              <div className="flex items-center p-1 bg-background rounded-lg border border-border-color">
                  <IconButton onClick={() => handleViewModeButton('edit')} tooltip="Editor Only" size="xs" className={`rounded-md ${viewMode === 'edit' ? 'bg-secondary text-primary' : ''}`}><PencilIcon className="w-4 h-4" /></IconButton>
                  <IconButton onClick={() => handleViewModeButton('preview')} tooltip="Preview Only" size="xs" className={`rounded-md ${viewMode === 'preview' ? 'bg-secondary text-primary' : ''}`}><EyeIcon className="w-4 h-4" /></IconButton>
                  <IconButton onClick={() => handleViewModeButton('split-vertical')} tooltip="Split Vertical" size="xs" className={`rounded-md ${viewMode === 'split-vertical' ? 'bg-secondary text-primary' : ''}`}><LayoutVerticalIcon className="w-4 h-4" /></IconButton>
                  <IconButton onClick={() => handleViewModeButton('split-horizontal')} tooltip="Split Horizontal" size="xs" className={`rounded-md ${viewMode === 'split-horizontal' ? 'bg-secondary text-primary' : ''}`}><LayoutHorizontalIcon className="w-4 h-4" /></IconButton>
              </div>
            )}
            <div className="h-5 w-px bg-border-color mx-1"></div>
            {supportsFormatting && (
              <IconButton onClick={handleFormatDocument} tooltip="Format Document" size="xs" variant="ghost">
                <FormatIcon className="w-4 h-4" />
              </IconButton>
            )}
            <IconButton onClick={onShowHistory} tooltip="View Version History" size="xs" variant="ghost"><HistoryIcon className="w-4 h-4" /></IconButton>
            <div className="h-5 w-px bg-border-color mx-1"></div>
            <IconButton onClick={handleManualSave} disabled={!isDirty || isRefining} tooltip="Save Version" size="xs" variant="ghost"><SaveIcon className={`w-4 h-4 ${isDirty ? 'text-primary' : ''}`} /></IconButton>
            <IconButton onClick={handleCopy} disabled={!content.trim()} tooltip={isCopied ? 'Copied!' : 'Copy Content'} size="xs" variant="ghost">{isCopied ? <CheckIcon className="w-4 h-4 text-success" /> : <CopyIcon className="w-4 h-4" />}</IconButton>
            {supportsAiTools && (<IconButton onClick={handleRefine} disabled={!content.trim() || isRefining} tooltip="Refine with AI" size="xs" variant="ghost">{isRefining ? <Spinner /> : <SparklesIcon className="w-4 h-4 text-primary" />}</IconButton>)}
            <IconButton onClick={() => onDelete(documentNode.id)} tooltip="Delete Document" size="xs" variant="destructive"><TrashIcon className="w-4 h-4" /></IconButton>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-secondary overflow-hidden">{renderContent()}</div>
      {error && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-destructive-text p-3 bg-destructive-bg rounded-md shadow-lg z-20">{error}</div>}
      {refinedContent && (
        <Modal onClose={() => setRefinedContent(null)} title="AI Refinement Suggestion" initialFocusRef={acceptButtonRef}>
          <form onSubmit={(e) => { e.preventDefault(); acceptRefinement(); }}>
            <div className="p-6 text-text-main">
                <p className="text-text-secondary mb-4 text-sm">The AI suggests the following refinement.</p>
                <div className="p-3 my-4 bg-background border border-border-color rounded-md whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">{refinedContent}</div>
                <div className="flex justify-end gap-3 mt-6"><Button onClick={() => setRefinedContent(null)} variant="secondary" type="button">Discard</Button><Button ref={acceptButtonRef} type="submit" variant="primary">Accept</Button></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default DocumentEditor;
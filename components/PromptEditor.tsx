import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { DocumentOrFolder, Settings, ViewMode } from '../types';
import { llmService } from '../services/llmService';
import { SparklesIcon, TrashIcon, CopyIcon, CheckIcon, HistoryIcon, EyeIcon, PencilIcon, LayoutHorizontalIcon, LayoutVerticalIcon, RefreshIcon, SaveIcon, FormatIcon } from './Icons';
import Spinner from './Spinner';
import Modal from './Modal';
import { useLogger } from '../hooks/useLogger';
import { useDocumentAutoSave } from '../hooks/useDocumentAutoSave';
import IconButton from './IconButton';
import Button from './Button';
import MonacoEditor, { CodeEditorHandle } from './CodeEditor';
import MonacoDiffEditor from './MonacoDiffEditor';
import PreviewPane from './PreviewPane';
import { SUPPORTED_LANGUAGES } from '../services/languageService';
import PythonExecutionPanel from './PythonExecutionPanel';

interface DocumentEditorProps {
  documentNode: DocumentOrFolder;
  onSave: (prompt: Partial<Omit<DocumentOrFolder, 'id' | 'content'>>) => void;
  onCommitVersion: (content: string) => Promise<void> | void;
  onDelete: (id: string) => void;
  settings: Settings;
  onShowHistory: () => void;
  onLanguageChange: (language: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  formatTrigger: number;
}

const PREVIEWABLE_LANGUAGES = new Set<string>([
  'markdown',
  'html',
  'plantuml',
  'puml',
  'uml',
  'pdf',
  'application/pdf',
  'image',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'webp',
  'svg',
  'svg+xml',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg',
  'image/svg+xml',
]);

const resolveDefaultViewMode = (mode: ViewMode | null | undefined, languageHint: string | null | undefined): ViewMode => {
  if (mode) return mode;
  const normalizedHint = languageHint?.toLowerCase();
  if (!normalizedHint) {
    return 'edit';
  }
  if (normalizedHint === 'pdf' || normalizedHint === 'application/pdf') {
    return 'preview';
  }
  if (normalizedHint === 'image' || normalizedHint.startsWith('image/')) {
    return 'preview';
  }
  if (normalizedHint === 'plantuml' || normalizedHint === 'puml' || normalizedHint === 'uml') {
    return 'preview';
  }
  return 'edit';
};

const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentNode, onSave, onCommitVersion, onDelete, settings, onShowHistory, onLanguageChange, onViewModeChange, formatTrigger }) => {
  const [title, setTitle] = useState(documentNode.title);
  const [content, setContent] = useState(documentNode.content || '');
  const [baselineContent, setBaselineContent] = useState(documentNode.content || '');
  const [isDiffMode, setIsDiffMode] = useState(false);
  
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingEmoji, setIsGeneratingEmoji] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(resolveDefaultViewMode(documentNode.default_view_mode, documentNode.language_hint));
  const [splitSize, setSplitSize] = useState(50);
  const { addLog } = useLogger();
  const { skipNextAutoSave } = useDocumentAutoSave({
    documentId: documentNode.id,
    content,
    title,
    isDirty,
    isSaving,
    onCommitVersion,
    addLog,
  });
  
  const pythonPanelMinHeight = 180;
  const [isPythonPanelCollapsed, setIsPythonPanelCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('docforge.python.panelCollapsed') === 'true';
    }
    return false;
  });
  const [pythonPanelHeight, setPythonPanelHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('docforge.python.panelHeight');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          const maxHeight = Math.max(pythonPanelMinHeight, window.innerHeight - 220);
          return Math.min(Math.max(parsed, pythonPanelMinHeight), maxHeight);
        }
      }
    }
    return 260;
  });

  const isResizing = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);
  const isContentInitialized = useRef(false);
  const editorRef = useRef<CodeEditorHandle>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const syncTimeout = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  const prevDocumentIdRef = useRef<string | null>(null);
  const prevDocumentContentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('docforge.python.panelHeight', String(Math.round(pythonPanelHeight)));
  }, [pythonPanelHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleWindowResize = () => {
      const maxHeight = Math.max(pythonPanelMinHeight, window.innerHeight - 220);
      setPythonPanelHeight((current) => Math.min(Math.max(current, pythonPanelMinHeight), maxHeight));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [pythonPanelMinHeight]);

  // Keep local editor state in sync with document updates without clobbering unsaved edits.
  useEffect(() => {
    const nextContent = documentNode.content ?? '';

    if (documentNode.id !== prevDocumentIdRef.current) {
        setTitle(documentNode.title);
        setContent(nextContent);
        setBaselineContent(nextContent);
        setViewMode(resolveDefaultViewMode(documentNode.default_view_mode, documentNode.language_hint));
        setSplitSize(50);
        isContentInitialized.current = true;
        setIsDirty(false);
        setIsSaving(false);
        setIsDiffMode(false);
        prevDocumentIdRef.current = documentNode.id;
        prevDocumentContentRef.current = documentNode.content;
        return;
    }

    if (documentNode.content !== prevDocumentContentRef.current) {
        prevDocumentContentRef.current = documentNode.content;
        setBaselineContent(nextContent);
        if (!isDirty) {
            setContent(nextContent);
        }
    }
  }, [documentNode.id, documentNode.content, documentNode.default_view_mode, documentNode.language_hint, documentNode.title, isDirty]);

  useEffect(() => {
    setTitle(documentNode.title);
  }, [documentNode.id, documentNode.title]);

  useEffect(() => {
    if (viewMode === 'preview' && isDiffMode) {
        setIsDiffMode(false);
    }
  }, [viewMode, isDiffMode]);

  useEffect(() => {
    const normalizedHint = documentNode.language_hint?.toLowerCase();
    if ((normalizedHint === 'pdf' || normalizedHint === 'application/pdf') && !documentNode.default_view_mode && viewMode === 'edit') {
      setViewMode('preview');
    }
  }, [documentNode.language_hint, documentNode.default_view_mode, viewMode]);

  useEffect(() => {
    // Only mark as dirty after the initial content has been loaded.
    if (isContentInitialized.current) {
        setIsDirty(content !== documentNode.content);
    }
  }, [content, documentNode.content]);

  useEffect(() => {
  }, [content]);

  useEffect(() => {
  }, [title]);

  useEffect(() => {
  }, [isDirty]);

  useEffect(() => {
  }, [isSaving]);

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
    if (!isDirty || isRefining || isSaving) {
      return;
    }
    addLog('INFO', `User action: Manually save version for document "${title}".`);
    setIsSaving(true);
    const commitPromise = Promise.resolve(onCommitVersion(content));
    commitPromise
      .then(() => {
        setIsDirty(false);
        setBaselineContent(content);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to save document version.';
        setError(message);
        addLog('ERROR', `Manual save failed for document "${title}": ${message}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleDeleteDocument = () => {
    skipNextAutoSave();
    addLog('INFO', `User action: Delete document "${title}".`);
    onDelete(documentNode.id);
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

  const handleAddEmojiToTitle = async () => {
    if (!settings.llmProviderUrl || !settings.llmModelName || !title.trim()) return;
    setIsGeneratingEmoji(true);
    setError(null);
    addLog('INFO', `Attempting to generate emoji for title "${title}".`);
    try {
      const emoji = await llmService.generateEmojiForTitle(title, settings, addLog);
      setTitle((currentTitle) => {
        const baseTitle = currentTitle.trim();
        const emojiPrefixRegex = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\ufe0f]+\s*/u;
        const strippedTitle = baseTitle.replace(emojiPrefixRegex, '').trim();
        if (!strippedTitle) {
          return `${emoji}`;
        }
        return `${emoji} ${strippedTitle}`;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Could not generate emoji: ${message}`);
      addLog('ERROR', `Could not generate emoji: ${message}`);
    } finally {
      setIsGeneratingEmoji(false);
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
  const normalizedLanguage = language.toLowerCase();
  const supportsAiTools = ['markdown', 'plaintext'].includes(normalizedLanguage);
  const canAddEmojiToTitle = documentNode.type === 'document';
  const supportsPreview = PREVIEWABLE_LANGUAGES.has(normalizedLanguage);
  const supportsFormatting = ['javascript', 'typescript', 'json', 'html', 'css', 'xml', 'yaml'].includes(normalizedLanguage);
  const isPythonDocument = typeof window !== 'undefined' && !!window.electronAPI && (normalizedLanguage === 'python');
  const pythonDefaults = useMemo(() => ({
    ...settings.pythonDefaults,
    workingDirectory: settings.pythonWorkingDirectory ?? settings.pythonDefaults.workingDirectory ?? null,
  }), [settings.pythonDefaults, settings.pythonWorkingDirectory]);

  const handlePythonPanelResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = pythonPanelHeight;
    const pointerId = event.pointerId;
    const target = event.currentTarget;

    const getMaxHeight = () => {
      if (typeof window === 'undefined') return startHeight;
      return Math.max(pythonPanelMinHeight, window.innerHeight - 220);
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const delta = startY - pointerEvent.clientY;
      const maxHeight = getMaxHeight();
      const nextHeight = Math.min(Math.max(startHeight + delta, pythonPanelMinHeight), maxHeight);
      setPythonPanelHeight(nextHeight);
    };

    const cleanup = () => {
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerCancel);
      try {
        target.releasePointerCapture(pointerId);
      } catch {}
    };

    const handlePointerUp = () => {
      cleanup();
    };

    const handlePointerCancel = () => {
      cleanup();
    };

    try {
      target.setPointerCapture(pointerId);
    } catch {}
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerCancel);
  }, [pythonPanelHeight, pythonPanelMinHeight]);
  
  const renderContent = () => {
    const editor = isDiffMode
      ? (
          <MonacoDiffEditor
            oldText={baselineContent}
            newText={content}
            language={language}
            renderMode="inline"
            readOnly={false}
            onChange={setContent}
            onScroll={handleEditorScroll}
            fontFamily={settings.editorFontFamily}
            fontSize={settings.editorFontSize}
            activeLineHighlightColorLight={settings.editorActiveLineHighlightColor}
            activeLineHighlightColorDark={settings.editorActiveLineHighlightColorDark}
          />
        )
      : (
          <MonacoEditor
            ref={editorRef}
            content={content}
            language={language}
            onChange={setContent}
            onScroll={handleEditorScroll}
            customShortcuts={settings.customShortcuts}
            fontFamily={settings.editorFontFamily}
            fontSize={settings.editorFontSize}
            activeLineHighlightColorLight={settings.editorActiveLineHighlightColor}
            activeLineHighlightColorDark={settings.editorActiveLineHighlightColorDark}
          />
        );
    const preview = <PreviewPane ref={previewScrollRef} content={content} language={language} onScroll={handlePreviewScroll} addLog={addLog} settings={settings} />;
    
    switch(viewMode) {
        case 'edit': return editor;
        case 'preview': return supportsPreview ? preview : editor;
        case 'split-vertical':
            return (
                <div ref={splitContainerRef} className="grid h-full" style={{ gridTemplateColumns: `${splitSize}% auto minmax(0, 1fr)` }}>
                    <div className="h-full overflow-hidden min-w-0">{editor}</div>
                    <div
                      onMouseDown={handleSplitterMouseDown}
                      className="w-1.5 h-full cursor-col-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
                    />
                    <div className="h-full overflow-hidden min-w-0">{supportsPreview ? preview : editor}</div>
                </div>
            );
        case 'split-horizontal':
            return (
                <div ref={splitContainerRef} className="grid w-full h-full" style={{ gridTemplateRows: `${splitSize}% auto minmax(0, 1fr)` }}>
                    <div className="w-full overflow-hidden min-h-0">{editor}</div>
                    <div
                      onMouseDown={handleSplitterMouseDown}
                      className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
                    />
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
            {canAddEmojiToTitle && (
              <IconButton
                onClick={handleAddEmojiToTitle}
                disabled={
                  isGeneratingEmoji ||
                  !title.trim() ||
                  !settings.llmProviderUrl ||
                  !settings.llmModelName
                }
                tooltip="Add Emoji to Title"
                size="xs"
                variant="ghost"
                className="flex-shrink-0"
              >
                {isGeneratingEmoji ? <Spinner /> : <span className="text-base">😊</span>}
              </IconButton>
            )}
            {supportsAiTools && (
              <IconButton onClick={handleGenerateTitle} disabled={isGeneratingTitle || !content.trim() || !settings.llmProviderUrl} tooltip="Regenerate Title with AI" size="xs" variant="ghost" className="flex-shrink-0">
                {isGeneratingTitle ? <Spinner /> : <RefreshIcon className="w-4 h-4 text-primary" />}
              </IconButton>
            )}
            {isDirty && <div className="relative group flex-shrink-0"><div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-max px-2 py-1 text-xs font-semibold text-tooltip-text bg-tooltip-bg rounded-md opacity-0 group-hover:opacity-100">Unsaved changes</span></div>}
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center"><label htmlFor="language-select" className="text-xs font-medium text-text-secondary mr-2">Language:</label><select id="language-select" value={language} onChange={(e) => onLanguageChange(e.target.value)} className="bg-background text-text-main text-xs rounded-md py-0.5 pl-2 pr-6 border border-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none" style={{ backgroundImage: 'var(--select-arrow-background)', backgroundPosition: 'right 0.1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}>{SUPPORTED_LANGUAGES.map(lang => (<option key={lang.id} value={lang.id}>{lang.label}</option>))}</select></div>
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
            <IconButton
              onClick={() => setIsDiffMode(prev => !prev)}
              tooltip={isDiffMode ? 'Hide Inline Diff' : 'Show Inline Diff'}
              size="xs"
              variant="ghost"
              disabled={viewMode === 'preview'}
              className={isDiffMode ? 'bg-secondary text-primary' : ''}
            >
              <span className="font-semibold text-[11px] leading-none tracking-wide">Diff</span>
            </IconButton>
            <IconButton onClick={onShowHistory} tooltip="View Version History" size="xs" variant="ghost"><HistoryIcon className="w-4 h-4" /></IconButton>
            <div className="h-5 w-px bg-border-color mx-1"></div>
            <IconButton
              onClick={handleManualSave}
              disabled={!isDirty || isRefining || isSaving}
              tooltip={isSaving ? 'Saving...' : 'Save Version'}
              size="xs"
              variant="ghost"
            >
              {isSaving ? (
                <Spinner />
              ) : (
                <SaveIcon className={`w-4 h-4 ${isDirty ? 'text-primary' : ''}`} />
              )}
            </IconButton>
            <IconButton onClick={handleCopy} disabled={!content.trim()} tooltip={isCopied ? 'Copied!' : 'Copy Content'} size="xs" variant="ghost">{isCopied ? <CheckIcon className="w-4 h-4 text-success" /> : <CopyIcon className="w-4 h-4" />}</IconButton>
            {supportsAiTools && (<IconButton onClick={handleRefine} disabled={!content.trim() || isRefining} tooltip="Refine with AI" size="xs" variant="ghost">{isRefining ? <Spinner /> : <SparklesIcon className="w-4 h-4 text-primary" />}</IconButton>)}
            <IconButton onClick={handleDeleteDocument} tooltip="Delete Document" size="xs" variant="destructive"><TrashIcon className="w-4 h-4" /></IconButton>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-secondary overflow-hidden">{renderContent()}</div>
      {isPythonDocument && (
        <div
          className="flex-shrink-0 flex flex-col bg-secondary"
          style={{ height: isPythonPanelCollapsed ? 'auto' : pythonPanelHeight }}
        >
          {!isPythonPanelCollapsed && (
            <div
              className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
              onPointerDown={handlePythonPanelResizeStart}
            />
          )}
          <div className={`${isPythonPanelCollapsed ? 'flex-shrink-0' : 'flex-1'} overflow-hidden`}>
            <div className={`px-4 ${isPythonPanelCollapsed ? 'py-2' : 'pb-4 h-full overflow-auto'}`}>
              <PythonExecutionPanel
                nodeId={documentNode.id}
                code={content}
                defaults={pythonDefaults}
                consoleTheme={settings.pythonConsoleTheme}
                onCollapseChange={setIsPythonPanelCollapsed}
              />
            </div>
          </div>
        </div>
      )}
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

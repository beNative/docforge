import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DocumentTemplate } from '../types';
import { TrashIcon } from './Icons';
import { useHistoryState } from '../hooks/useHistoryState';
import Button from './Button';
import EmojiPickerDialog from './EmojiPickerDialog';
import type { EmojiDefinition } from '../assets/emojiData';

declare const Prism: any;

interface TemplateEditorProps {
  template: DocumentTemplate;
  onSave: (template: Partial<Omit<DocumentTemplate, 'id'>>) => void;
  onDelete: (id: string) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onDelete }) => {
  const [title, setTitle] = useState(template.title);
  const { state: content, setState: setContent } = useHistoryState(template.content || '');
  
  const [isDirty, setIsDirty] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const selectionRef = useRef({
    title: { start: template.title.length, end: template.title.length },
    content: { start: (template.content || '').length, end: (template.content || '').length },
  });
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiContext, setEmojiContext] = useState<'title' | 'content'>('content');
  
  useEffect(() => {
    const hasUnsavedChanges = title !== template.title || content !== template.content;
    setIsDirty(hasUnsavedChanges);
  }, [title, content, template.title, template.content]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = setTimeout(() => {
      onSave({ title, content });
    }, 500);
    return () => clearTimeout(handler);
  }, [title, content, isDirty, onSave, template]);

  const highlightedContent = useMemo(() => {
    if (typeof Prism === 'undefined' || !Prism.languages.markdown) {
        return content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    return Prism.highlight(content + '\n', Prism.languages.markdown, 'markdown');
  }, [content]);

  const syncScroll = () => {
    if (editorRef.current && preRef.current) {
        preRef.current.scrollTop = editorRef.current.scrollTop;
        preRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  };

  const updateSelection = (target: 'title' | 'content') => {
    if (target === 'title' && titleInputRef.current) {
      selectionRef.current.title = {
        start: titleInputRef.current.selectionStart ?? titleInputRef.current.value.length,
        end: titleInputRef.current.selectionEnd ?? titleInputRef.current.value.length,
      };
    }
    if (target === 'content' && editorRef.current) {
      selectionRef.current.content = {
        start: editorRef.current.selectionStart ?? editorRef.current.value.length,
        end: editorRef.current.selectionEnd ?? editorRef.current.value.length,
      };
    }
  };

  const openEmojiPicker = (target: 'title' | 'content') => {
    updateSelection(target);
    setEmojiContext(target);
    setIsEmojiPickerOpen(true);
  };

  const insertEmojiAtSelection = (value: string, emoji: string, selection: { start: number; end: number }) => {
    const start = Math.min(selection.start, value.length);
    const end = Math.min(selection.end, value.length);
    const safeStart = Math.min(start, end);
    const safeEnd = Math.max(start, end);
    const before = value.slice(0, safeStart);
    const after = value.slice(safeEnd);
    const nextValue = `${before}${emoji}${after}`;
    const cursor = safeStart + emoji.length;
    return { nextValue, cursor };
  };

  const scheduleFocus = (callback: () => void) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame === 'undefined') {
      callback();
      return;
    }

    window.requestAnimationFrame(callback);
  };

  const handleEmojiSelect = (emoji: EmojiDefinition) => {
    if (emojiContext === 'title') {
      const selection = selectionRef.current.title;
      setTitle((prevTitle) => {
        const { nextValue, cursor } = insertEmojiAtSelection(prevTitle, emoji.symbol, selection);
        selectionRef.current.title = { start: cursor, end: cursor };
        scheduleFocus(() => {
          if (titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.setSelectionRange(cursor, cursor);
          }
        });
        return nextValue;
      });
    } else {
      const selection = selectionRef.current.content;
      setContent((prevContent) => {
        const { nextValue, cursor } = insertEmojiAtSelection(prevContent, emoji.symbol, selection);
        selectionRef.current.content = { start: cursor, end: cursor };
        scheduleFocus(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.setSelectionRange(cursor, cursor);
            syncScroll();
          }
        });
        return nextValue;
      });
    }

    setIsEmojiPickerOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="flex justify-between items-center px-4 h-7 gap-4 border-b border-border-color flex-shrink-0 bg-secondary">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                selectionRef.current.title = {
                  start: e.target.selectionStart ?? e.target.value.length,
                  end: e.target.selectionEnd ?? e.target.value.length,
                };
              }}
              onSelect={() => updateSelection('title')}
              placeholder="Template Title"
              className="bg-transparent pr-10 text-base font-semibold text-text-main focus:outline-none w-full truncate placeholder:text-text-secondary"
            />
            <button
              type="button"
              onClick={() => openEmojiPicker('title')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-secondary px-2 py-1 text-sm text-text-secondary transition hover:bg-primary/10 hover:text-text-main"
            >
              <span aria-hidden>😀</span>
              <span className="sr-only">Insert emoji into title</span>
            </button>
          </div>
          {isDirty && (
                <div className="relative group flex-shrink-0">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-max px-2 py-1 text-xs font-semibold text-tooltip-text bg-tooltip-bg rounded-md opacity-0 group-hover:opacity-100 transition-opacity delay-500 pointer-events-none">
                        Unsaved changes
                    </span>
                </div>
            )}
        </div>
        <div className="flex items-center gap-2">
            {/* Fix: Use template.template_id instead of template.id */}
            <Button variant="destructive" onClick={() => onDelete(template.template_id)}>
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete Template
            </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-secondary overflow-y-auto">
        <div
            className="editor-container relative w-full flex-1 focus-within:ring-2 focus-within:ring-primary"
            data-placeholder={!content ? "Enter your template content with {{variables}} here..." : ""}
        >
            <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              selectionRef.current.content = {
                start: e.target.selectionStart ?? e.target.value.length,
                end: e.target.selectionEnd ?? e.target.value.length,
              };
            }}
            onSelect={() => updateSelection('content')}
            onScroll={syncScroll}
            spellCheck="false"
            className="absolute inset-0 p-4 w-full h-full bg-transparent text-transparent caret-primary resize-none font-mono text-sm focus:outline-none z-10 whitespace-pre-wrap break-words"
            />
            <button
              type="button"
              onClick={() => openEmojiPicker('content')}
              className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-border-color bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-sm transition hover:border-primary hover:text-text-main"
            >
              <span aria-hidden className="text-base">🌟</span>
              Emoji palette
            </button>
            <pre
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 p-4 w-full h-full overflow-auto pointer-events-none font-mono text-sm whitespace-pre-wrap break-words"
            >
            <code className="language-markdown" dangerouslySetInnerHTML={{ __html: highlightedContent }} />
            </pre>
        </div>
      </div>
      <EmojiPickerDialog
        isOpen={isEmojiPickerOpen}
        context={emojiContext}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={handleEmojiSelect}
      />
    </div>
  );
};

export default TemplateEditor;
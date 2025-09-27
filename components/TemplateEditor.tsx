import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DocumentTemplate } from '../types';
import { TrashIcon } from './Icons';
import { useHistoryState } from '../hooks/useHistoryState';
import IconButton from './IconButton';
import Button from './Button';

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
  const preRef = useRef<HTMLPreElement>(null);
  
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

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="flex justify-between items-center px-6 py-6 gap-4 border-b border-border-color flex-shrink-0 bg-secondary">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Template Title"
              className="bg-transparent text-2xl font-semibold text-text-main focus:outline-none w-full truncate placeholder:text-text-secondary"
            />
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
            onChange={(e) => setContent(e.target.value)}
            onScroll={syncScroll}
            spellCheck="false"
            className="absolute inset-0 p-6 w-full h-full bg-transparent text-transparent caret-primary resize-none font-mono text-base focus:outline-none z-10 whitespace-pre-wrap break-words"
            />
            <pre 
                ref={preRef}
                aria-hidden="true" 
                className="absolute inset-0 p-6 w-full h-full overflow-auto pointer-events-none font-mono text-base whitespace-pre-wrap break-words"
            >
            <code className="language-markdown" dangerouslySetInnerHTML={{ __html: highlightedContent }} />
            </pre>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
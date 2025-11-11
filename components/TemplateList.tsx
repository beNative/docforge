import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DocumentTemplate } from '../types';
import IconButton from './IconButton';
import { TrashIcon, DocumentDuplicateIcon } from './Icons';
import { useEmojiPicker } from '../hooks/useEmojiPicker';

interface TemplateListProps {
  templates: DocumentTemplate[];
  activeTemplateId: string | null;
  focusedItemId: string | null;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string, shiftKey: boolean) => void;
  onRenameTemplate: (id: string, newTitle: string) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ templates, activeTemplateId, focusedItemId, onSelectTemplate, onDeleteTemplate, onRenameTemplate }) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { openEmojiPicker } = useEmojiPicker();
  const renameSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleRenameStart = (e: React.MouseEvent, template: DocumentTemplate) => {
    e.stopPropagation();
    // Fix: Use template_id instead of id
    setRenamingId(template.template_id);
    setRenameValue(template.title);
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      onRenameTemplate(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    else if (e.key === 'Escape') setRenamingId(null);
  };

  const updateRenameSelection = useCallback(() => {
    const input = renameInputRef.current;
    if (!input) {
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    renameSelectionRef.current = { start, end };
  }, []);

  const openEmojiForRename = useCallback(
    (anchor: { x: number; y: number }) => {
      const input = renameInputRef.current;
      if (!input) {
        return;
      }

      const { start, end } = renameSelectionRef.current;
      openEmojiPicker({
        anchor,
        onSelect: (emoji) => {
          const activeInput = renameInputRef.current ?? input;
          const baseValue = activeInput.value;
          const before = baseValue.slice(0, start);
          const after = baseValue.slice(end);
          const nextValue = `${before}${emoji}${after}`;
          setRenameValue(nextValue);
          requestAnimationFrame(() => {
            const target = renameInputRef.current ?? input;
            const cursor = start + emoji.length;
            target.focus();
            target.setSelectionRange(cursor, cursor);
            renameSelectionRef.current = { start: cursor, end: cursor };
          });
        },
        onClose: () => {
          requestAnimationFrame(() => {
            const target = renameInputRef.current ?? input;
            target.focus();
          });
        },
      });
    },
    [openEmojiPicker, setRenameValue]
  );

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
      updateRenameSelection();
    }
  }, [renamingId, updateRenameSelection]);
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteTemplate(id, e.shiftKey);
  };

  return (
    <ul className="space-y-0">
      {templates.map((template) => {
        // Fix: Use template_id instead of id
        const isFocused = focusedItemId === template.template_id;
        return (
            // Fix: Use template_id for key and data-item-id
            <li key={template.template_id} data-item-id={template.template_id}>
            {renamingId === template.template_id ? (
                <div className="p-1 flex items-center gap-2">
                <DocumentDuplicateIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="flex w-full items-center gap-1.5">
                <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      requestAnimationFrame(updateRenameSelection);
                    }}
                    onClick={updateRenameSelection}
                    onKeyDown={(event) => {
                      handleRenameKeyDown(event);
                      requestAnimationFrame(updateRenameSelection);
                    }}
                    onKeyUp={updateRenameSelection}
                    onSelect={updateRenameSelection}
                    onMouseUp={updateRenameSelection}
                    onBlur={handleRenameSubmit}
                    className="flex-1 text-left text-xs px-1.5 py-1 rounded-md bg-background text-text-main border border-border-color focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      openEmojiForRename({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                    }}
                    className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-border-color bg-background text-sm text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
                    aria-label="Insert emoji"
                >
                    <span aria-hidden="true">😀</span>
                </button>
                </div>
            </div>
        ) : (
                <button
                // Fix: Use template_id
                onClick={() => onSelectTemplate(template.template_id)}
                onDoubleClick={(e) => handleRenameStart(e, template)}
                className={`w-full text-left p-1 rounded-md group flex justify-between items-center transition-colors duration-150 text-xs relative focus:outline-none ${
                    // Fix: Use template_id
                    activeTemplateId === template.template_id
                    ? 'bg-background text-text-main'
                    : 'hover:bg-border-color/30 text-text-secondary hover:text-text-main'
                } ${isFocused ? 'ring-2 ring-primary ring-offset-[-2px] ring-offset-secondary' : ''}`}
                >
                <div className="flex items-center gap-1.5 flex-1 truncate">
                    <DocumentDuplicateIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1 px-1">{template.title}</span>
                </div>
                {/* Fix: Use template_id */}
                <div className={`transition-opacity pr-1 flex items-center ${activeTemplateId === template.template_id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {/* Fix: Use template_id */}
                    <IconButton onClick={(e) => handleDelete(e, template.template_id)} tooltip="Delete" size="xs" variant="destructive">
                    <TrashIcon className="w-3.5 h-3.5" />
                    </IconButton>
                </div>
                </button>
            )}
            </li>
        )
      })}
       {templates.length === 0 && (
          <li className="text-center text-text-secondary p-4 text-xs">
              No templates yet.
          </li>
      )}
    </ul>
  );
};

export default TemplateList;
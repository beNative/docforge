import React, { useState, useRef, useEffect } from 'react';
import type { DocumentTemplate } from '../types';
import IconButton from './IconButton';
import { TrashIcon, DocumentDuplicateIcon } from './Icons';

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

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

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
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                  className="w-full text-left text-xs px-1.5 py-1 rounded-md bg-background text-text-main border border-border-color focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <button
                // Fix: Use template_id
                onClick={() => onSelectTemplate(template.template_id)}
                onDoubleClick={(e) => handleRenameStart(e, template)}
                className={`w-full text-left pr-1 flex justify-between items-center transition-colors duration-0 text-[13px] relative focus:outline-none h-[22px] min-h-[22px] cursor-default ${
                  // Fix: Use template_id
                  activeTemplateId === template.template_id
                    ? 'bg-tree-selected/20 text-text-main font-medium'
                    : 'hover:bg-tree-selected/10 text-text-secondary hover:text-text-main'
                  } ${isFocused ? 'ring-1 ring-inset ring-primary' : ''}`}
              >
                <div className="flex items-center gap-1 flex-1 truncate pl-[2px]">
                  <DocumentDuplicateIcon className={`w-3.5 h-3.5 flex-shrink-0 ${activeTemplateId === template.template_id ? 'text-text-main' : 'text-text-secondary'}`} />
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
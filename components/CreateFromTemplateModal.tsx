import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import type { DocumentTemplate } from '../types';
import { useLogger } from '../hooks/useLogger';

interface CreateFromTemplateModalProps {
  templates: DocumentTemplate[];
  onCreate: (title: string, content: string) => void;
  onClose: () => void;
}

const CreateFromTemplateModal: React.FC<CreateFromTemplateModalProps> = ({ templates, onCreate, onClose }) => {
  // Fix: Use template_id instead of id
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.template_id || '');
  const [documentTitle, setDocumentTitle] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const { addLog } = useLogger();

  const selectedTemplate = useMemo(() => {
    // Fix: Use template_id instead of id
    return templates.find(t => t.template_id === selectedTemplateId);
  }, [selectedTemplateId, templates]);

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const regex = /\{\{([^{}]+)\}\}/g;
    const matches = selectedTemplate.content.match(regex) || [];
    // Get unique variable names
    return [...new Set(matches.map(v => v.slice(2, -2).trim()))];
  }, [selectedTemplate]);

  useEffect(() => {
    if (selectedTemplate) {
      setDocumentTitle(`${selectedTemplate.title} - Instance`);
      // Reset variables when template changes
      setVariables(templateVariables.reduce((acc, key) => ({ ...acc, [key]: '' }), {}));
    }
  }, [selectedTemplate, templateVariables]);

  const handleCreate = () => {
    if (!selectedTemplate) return;
    let finalContent = selectedTemplate.content;
    for (const key in variables) {
      finalContent = finalContent.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), variables[key]);
    }
    onCreate(documentTitle.trim() || 'Untitled Document', finalContent);
    onClose();
  };
  
  const isFormValid = documentTitle.trim() !== '' && templateVariables.every(key => (variables[key] || '').trim() !== '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      handleCreate();
    }
  };

  return (
    <Modal onClose={() => { addLog('INFO', 'User action: Canceled "Create from Template" dialog.'); onClose(); }} title="Create Document from Template" initialFocusRef={createButtonRef}>
      <form onSubmit={handleSubmit}>
        <div className="p-6 text-text-main space-y-4">
          <div>
            <label htmlFor="template-select" className="block text-sm font-medium text-text-secondary mb-1">
              Template
            </label>
            <select
              id="template-select"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {templates.map(t => (
                // Fix: Use template_id instead of id
                <option key={t.template_id} value={t.template_id}>{t.title}</option>
              ))}
            </select>
          </div>
          
          {selectedTemplate && (
            <>
              <div>
                <label htmlFor="prompt-title" className="block text-sm font-medium text-text-secondary mb-1">
                  New Document Title
                </label>
                <input
                  id="prompt-title"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {templateVariables.length > 0 && (
                <fieldset className="border-t border-border-color pt-4">
                  <legend className="text-sm font-medium text-text-secondary mb-2">Fill in Variables</legend>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {templateVariables.map(key => (
                      <div key={key}>
                        <label htmlFor={`var-${key}`} className="block text-sm font-medium text-text-main capitalize">
                          {key.replace(/_/g, ' ')}
                        </label>
                        <input
                          id={`var-${key}`}
                          type="text"
                          value={variables[key] || ''}
                          onChange={(e) => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                          className="mt-1 w-full p-2 rounded-md bg-background text-text-main border border-border-color focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}
               {templateVariables.length === 0 && (
                  <p className="text-sm text-text-secondary text-center pt-4">This template has no variables.</p>
               )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button onClick={onClose} variant="secondary" type="button">
            Cancel
          </Button>
          <Button ref={createButtonRef} type="submit" variant="primary" disabled={!selectedTemplate || !isFormValid}>
            Create Document
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateFromTemplateModal;
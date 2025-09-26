
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import type { PromptTemplate } from '../types';

interface CreateFromTemplateModalProps {
  templates: PromptTemplate[];
  onCreate: (title: string, content: string) => void;
  onClose: () => void;
}

const CreateFromTemplateModal: React.FC<CreateFromTemplateModalProps> = ({ templates, onCreate, onClose }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [promptTitle, setPromptTitle] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId);
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
      setPromptTitle(`${selectedTemplate.title} - Instance`);
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
    onCreate(promptTitle.trim() || 'Untitled Prompt', finalContent);
    onClose();
  };
  
  const isFormValid = promptTitle.trim() !== '' && templateVariables.every(key => (variables[key] || '').trim() !== '');

  return (
    <Modal onClose={onClose} title="Create Prompt from Template">
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
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        
        {selectedTemplate && (
          <>
            <div>
              <label htmlFor="prompt-title" className="block text-sm font-medium text-text-secondary mb-1">
                New Prompt Title
              </label>
              <input
                id="prompt-title"
                type="text"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
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
        <Button onClick={onClose} variant="secondary">
          Cancel
        </Button>
        <Button onClick={handleCreate} variant="primary" disabled={!selectedTemplate || !isFormValid}>
          Create Prompt
        </Button>
      </div>
    </Modal>
  );
};

export default CreateFromTemplateModal;
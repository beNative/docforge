import { useState, useEffect, useCallback } from 'react';
import type { DocumentTemplate } from '../types';
import { repository } from '../services/repository';
import { useLogger } from './useLogger';

export const useTemplates = () => {
  const { addLog } = useLogger();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  const refreshTemplates = useCallback(async () => {
    try {
      const loadedTemplates = await repository.getAllTemplates();
      setTemplates(loadedTemplates);
      addLog('DEBUG', `${loadedTemplates.length} templates loaded from database.`);
    } catch (e) {
      addLog('ERROR', `Failed to load templates: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addLog]);

  useEffect(() => {
    // The repository's init logic now handles the initial template creation.
    // We just need to load them.
    refreshTemplates();
  }, [refreshTemplates]);

  const addTemplate = useCallback(async () => {
    const newTemplate = await repository.addTemplate({
      title: 'Untitled Template',
      content: 'Your template with {{variables}} here.',
    });
    addLog('INFO', `New template created with ID: ${newTemplate.template_id}`);
    await refreshTemplates();
    return newTemplate;
  }, [addLog, refreshTemplates]);

  const updateTemplate = useCallback(async (id: string, updatedTemplate: Partial<Omit<DocumentTemplate, 'template_id'>>) => {
    await repository.updateTemplate(id, updatedTemplate);
    addLog('DEBUG', `Template updated with ID: ${id}`);
    await refreshTemplates();
  }, [addLog, refreshTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await repository.deleteTemplate(id);
    addLog('INFO', `Deleted template with ID: ${id}`);
    await refreshTemplates();
  }, [addLog, refreshTemplates]);

  const deleteTemplates = useCallback(async (ids: string[]) => {
    await repository.deleteTemplates(ids);
    addLog('INFO', `Deleted ${ids.length} template(s).`);
    await refreshTemplates();
  }, [addLog, refreshTemplates]);

  return { templates, addTemplate, updateTemplate, deleteTemplate, deleteTemplates };
};
import React, { useState, useEffect } from 'react';
import type { DocumentOrFolder, PromptTemplate } from '../types';
import PromptList from './PromptList';
import TemplateList from './TemplateList';
import { PlusIcon, FolderPlusIcon, FileIcon } from './Icons';
import IconButton from './IconButton';
import { storageService } from '../services/storageService';
import { LOCAL_STORAGE_KEYS } from '../constants';

interface SidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  items: DocumentOrFolder[];
  templates: PromptTemplate[];
  selectedIds: Set<string>;
  focusedItemId: string | null;
  setFocusedItemId: (id: string | null) => void;
  activeTemplateId: string | null;
  onSelectPrompt: (id: string, e: React.MouseEvent) => void;
  onSelectTemplate: (id: string) => void;
  onNewDocument: () => void;
  onNewFolder: () => void;
  onNewTemplate: () => void;
  onRenameItem: (id: string, newTitle: string) => void;
  onDeleteItem: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onMoveItems: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onDuplicateItems: (ids: string[]) => void;
  onOpenTemplateModal: () => void;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    storageService.load<string[]>(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, []).then(ids => {
        setExpandedFolders(new Set(ids));
    });
  }, []);

  const handleSetExpandedFolders = (updater: React.SetStateAction<Set<string>>) => {
    setExpandedFolders(currentExpanded => {
        const newSet = typeof updater === 'function' ? updater(currentExpanded) : updater;
        storageService.save(LOCAL_STORAGE_KEYS.EXPANDED_FOLDERS, Array.from(newSet));
        return newSet;
    });
  };

  return (
    <aside
      className="flex-shrink-0 h-full flex bg-secondary border-r border-border-color"
      style={{ width: `${props.width}px` }}
    >
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
        <div className="flex-1 p-2 space-y-4 flex flex-col">
          <div className="flex flex-col flex-grow min-h-0">
            <header className="flex justify-between items-center mb-1 px-2 flex-shrink-0">
              <h2 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Documents</h2>
              <div className="flex items-center">
                <IconButton onClick={props.onNewFolder} tooltip="New Folder" size="sm" variant="ghost">
                  <FolderPlusIcon className="w-5 h-5" />
                </IconButton>
                <IconButton onClick={props.onNewDocument} tooltip="New Document (Ctrl+N)" size="sm" variant="ghost">
                  <PlusIcon className="w-5 h-5" />
                </IconButton>
              </div>
            </header>
            <PromptList
              items={props.items}
              selectedIds={props.selectedIds}
              focusedItemId={props.focusedItemId}
              setFocusedItemId={props.setFocusedItemId}
              expandedIds={expandedFolders}
              setExpandedIds={handleSetExpandedFolders}
              onSelect={props.onSelectPrompt}
              onRename={props.onRenameItem}
              onDelete={props.onDeleteItem}
              onMove={props.onMoveItems}
              onDuplicate={props.onDuplicateItems}
            />
          </div>
          <div className="flex-shrink-0">
            <header className="flex justify-between items-center mb-1 px-2">
              <h2 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Templates</h2>
               <div className="flex items-center">
                <IconButton onClick={props.onOpenTemplateModal} tooltip="Create from Template" size="sm" variant="ghost">
                  <FileIcon className="w-5 h-5" />
                </IconButton>
                <IconButton onClick={props.onNewTemplate} tooltip="New Template" size="sm" variant="ghost">
                  <PlusIcon className="w-5 h-5" />
                </IconButton>
              </div>
            </header>
            <TemplateList 
              templates={props.templates}
              activeTemplateId={props.activeTemplateId}
              focusedItemId={props.focusedItemId}
              onSelectTemplate={props.onSelectTemplate}
              onDeleteTemplate={props.onDeleteTemplate}
              onRenameTemplate={props.onRenameItem}
            />
          </div>
        </div>
      </div>
      <div
        onMouseDown={props.onResizeStart}
        className="w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors flex-shrink-0"
      />
    </aside>
  );
};

export default Sidebar;

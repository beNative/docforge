import React from 'react';
import IconButton from './IconButton';
import { DatabaseIcon, PlusIcon, XIcon } from './Icons';
import Spinner from './Spinner';
import type { WorkspaceInfo } from '../types';

interface WorkspaceTabsProps {
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onAddWorkspace: () => void;
  onOpenManager: () => void;
  onCloseWorkspace?: (workspaceId: string) => void;
  onContextMenu?: (event: React.MouseEvent, workspaceId: string) => void;
}

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  workspaces,
  activeWorkspaceId,
  isLoading,
  onSelectWorkspace,
  onAddWorkspace,
  onOpenManager,
  onCloseWorkspace,
  onContextMenu,
}) => {
  return (
    <div className="not-draggable flex items-center gap-1 overflow-hidden">
      <div className="flex items-center gap-1 overflow-x-auto max-w-full pr-1 scrollbar-thin scrollbar-thumb-border-color/60 scrollbar-track-transparent">
        {isLoading && (
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-text-secondary">
            <Spinner />
            <span>Loading workspaces…</span>
          </div>
        )}
        {!isLoading && workspaces.length === 0 && (
          <div className="px-2 py-1 text-xs text-text-secondary whitespace-nowrap">
            No workspaces connected
          </div>
        )}
        {workspaces.map(workspace => {
          const isActive = workspace.workspaceId === activeWorkspaceId;
          return (
            <button
              key={workspace.workspaceId}
              type="button"
              onClick={() => onSelectWorkspace(workspace.workspaceId)}
              onContextMenu={event => {
                if (onContextMenu) {
                  event.preventDefault();
                  onContextMenu(event, workspace.workspaceId);
                }
              }}
              className={`group relative flex items-center gap-2 max-w-xs px-3 py-1 text-xs rounded-md border transition-colors ${
                isActive
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-background/60 border-border-color/70 text-text-secondary hover:text-text-main hover:bg-border-color/40'
              }`}
            >
              <span className="truncate" title={workspace.name}>{workspace.name}</span>
              {onCloseWorkspace && !isActive && (
                <span className="flex-shrink-0">
                  <button
                    type="button"
                    title="Close workspace connection"
                    onClick={event => {
                      event.stopPropagation();
                      onCloseWorkspace(workspace.workspaceId);
                    }}
                    className="flex items-center justify-center w-4 h-4 rounded text-text-secondary/80 hover:text-destructive-text hover:bg-destructive-bg/10"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <IconButton
        onClick={onAddWorkspace}
        tooltip="Create workspace"
        size="xs"
        variant="ghost"
        className="not-draggable"
      >
        <PlusIcon className="w-4 h-4" />
      </IconButton>
      <IconButton
        onClick={onOpenManager}
        tooltip="Manage workspaces"
        size="xs"
        variant="ghost"
        className="not-draggable"
      >
        <DatabaseIcon className="w-4 h-4" />
      </IconButton>
    </div>
  );
};

export default WorkspaceTabs;

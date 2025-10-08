import React, { useMemo, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';
import type { WorkspaceInfo } from '../types';

interface WorkspaceManagerModalProps {
  isOpen: boolean;
  workspaces: WorkspaceInfo[];
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  onCreateWorkspace: () => void;
  onActivateWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (workspaceId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onOpenConnection: (workspaceId: string) => void;
  onCloseConnection: (workspaceId: string) => void;
  onRefreshConnection: (workspaceId: string) => void;
}

const StatusBadge: React.FC<{ label: string; variant: 'primary' | 'muted' }> = ({ label, variant }) => {
  const classes =
    variant === 'primary'
      ? 'bg-primary/15 text-primary border border-primary/30'
      : 'bg-border-color/40 text-text-secondary border border-border-color/60';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full ${classes}`}>
      {label}
    </span>
  );
};

const WorkspaceManagerModal: React.FC<WorkspaceManagerModalProps> = ({
  isOpen,
  workspaces,
  isLoading,
  error,
  onClose,
  onCreateWorkspace,
  onActivateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onOpenConnection,
  onCloseConnection,
  onRefreshConnection,
}) => {
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaces]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      title="Workspace Connections"
      initialFocusRef={createButtonRef}
    >
      <div className="p-6 space-y-4 text-text-main">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-text-secondary">
              Manage connected SQLite databases. Activate, rename, or remove workspaces from this list.
            </p>
            {error && (
              <p className="mt-2 text-xs text-destructive-text bg-destructive-bg/10 border border-destructive-border rounded px-3 py-2">
                {error}
              </p>
            )}
          </div>
          <Button
            ref={createButtonRef}
            onClick={onCreateWorkspace}
            variant="primary"
            type="button"
          >
            New Workspace
          </Button>
        </div>
        <div className="border border-border-color rounded-md bg-secondary/60 max-h-[420px] overflow-y-auto divide-y divide-border-color/60">
          {isLoading && (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-text-secondary">
              <Spinner />
              <span>Loading workspaces…</span>
            </div>
          )}
          {!isLoading && sortedWorkspaces.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-secondary text-center">
              No workspaces have been created yet.
            </div>
          )}
          {sortedWorkspaces.map(workspace => {
            const isActive = workspace.isActive;
            const isOpen = workspace.isOpen;
            return (
              <div key={workspace.workspaceId} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-main">{workspace.name}</p>
                    <p className="text-xs text-text-secondary truncate" title={workspace.filePath}>{workspace.filePath}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={isActive ? 'Active' : 'Inactive'} variant={isActive ? 'primary' : 'muted'} />
                    <StatusBadge label={isOpen ? 'Connected' : 'Closed'} variant={isOpen ? 'primary' : 'muted'} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => onActivateWorkspace(workspace.workspaceId)}
                    variant="secondary"
                    type="button"
                    disabled={isActive}
                  >
                    Activate
                  </Button>
                  <Button
                    onClick={() => onRefreshConnection(workspace.workspaceId)}
                    variant="secondary"
                    type="button"
                    disabled={!isOpen}
                  >
                    Refresh
                  </Button>
                  <Button
                    onClick={() => onOpenConnection(workspace.workspaceId)}
                    variant="secondary"
                    type="button"
                    disabled={isOpen}
                  >
                    Open Connection
                  </Button>
                  <Button
                    onClick={() => onCloseConnection(workspace.workspaceId)}
                    variant="secondary"
                    type="button"
                    disabled={!isOpen || isActive}
                  >
                    Close Connection
                  </Button>
                  <Button
                    onClick={() => onRenameWorkspace(workspace.workspaceId)}
                    variant="secondary"
                    type="button"
                  >
                    Rename
                  </Button>
                  <Button
                    onClick={() => onDeleteWorkspace(workspace.workspaceId)}
                    variant="destructive"
                    type="button"
                    disabled={isActive}
                  >
                    Delete
                  </Button>
                </div>
                <div className="text-[11px] text-text-secondary/80 flex flex-wrap gap-x-4">
                  <span>Created {new Date(workspace.createdAt).toLocaleString()}</span>
                  <span>Last opened {workspace.lastOpenedAt ? new Date(workspace.lastOpenedAt).toLocaleString() : 'Never'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default WorkspaceManagerModal;

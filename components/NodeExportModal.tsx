import React, { useState } from 'react';

export interface NodeExportOptions {
  includeHistory: boolean;
  includePythonSettings: boolean;
}

interface NodeExportModalProps {
  selectedCount: number;
  isExporting: boolean;
  onCancel: () => void;
  onConfirm: (options: NodeExportOptions) => void;
}

const NodeExportModal: React.FC<NodeExportModalProps> = ({
  selectedCount,
  isExporting,
  onCancel,
  onConfirm,
}) => {
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includePythonSettings, setIncludePythonSettings] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ includeHistory, includePythonSettings });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-main">Export selection</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {selectedCount === 1
            ? 'Export the selected node as a reusable JSON package.'
            : `Export ${selectedCount} nodes as a reusable JSON package.`}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border-color text-primary focus:ring-primary"
              checked={includeHistory}
              onChange={(event) => setIncludeHistory(event.target.checked)}
            />
            <span className="text-sm text-text-main">
              <span className="font-medium">Include document history</span>
              <br />
              <span className="text-text-secondary">
                Adds previous versions for each document so timelines are preserved when importing.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border-color text-primary focus:ring-primary"
              checked={includePythonSettings}
              onChange={(event) => setIncludePythonSettings(event.target.checked)}
            />
            <span className="text-sm text-text-main">
              <span className="font-medium">Include Python settings</span>
              <br />
              <span className="text-text-secondary">
                Bundles interpreter selections and auto-detect preferences for Python-enabled nodes.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-main hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isExporting}
            >
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeExportModal;

import React, { useState, act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentEditor from '../components/PromptEditor';
import { IconProvider } from '../contexts/IconContext';
import { DEFAULT_SETTINGS } from '../constants';
import type { DocumentNode } from '../components/PromptTreeItem';

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../hooks/useLogger', () => ({
  useLogger: () => ({
    logs: [],
    addLog: vi.fn(),
    clearLogs: vi.fn(),
  }),
}));

vi.mock('../components/CodeEditor', () => ({
  __esModule: true,
  default: React.forwardRef<any, any>(({ onChange, onManualSave }, ref) => {
    React.useImperativeHandle(ref, () => ({
      format: vi.fn(),
      setScrollTop: vi.fn(),
      getScrollInfo: vi.fn().mockResolvedValue({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 }),
      getSelection: vi.fn(),
      insertText: vi.fn(),
    }));
    return (
      <div data-testid="mock-code-editor">
        <button data-testid="simulate-change" onClick={() => onChange('Modified content')}>
          Simulate Change
        </button>
        <button data-testid="simulate-ctrl-s" onClick={() => onManualSave?.()}>
          Simulate Monaco Ctrl+S
        </button>
      </div>
    );
  }),
}));

describe('Document Manual Save (Ctrl+S and Toolbar Save State)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDocumentNode: DocumentNode = {
    id: 'doc-1',
    title: 'Test Document',
    content: 'Initial content',
    doc_type: 'plaintext',
    parentId: null,
    children: [],
  };

  const TestEditorWrapper: React.FC<{
    onCommitVersionMock?: (id: string, content: string) => Promise<void> | void;
  }> = ({ onCommitVersionMock }) => {
    const [commandTriggers, setCommandTriggers] = useState({
      addEmojiToTitle: 0,
      regenerateTitle: 0,
      openLanguageSelector: 0,
      cycleViewMode: 0,
      toggleInlineDiff: 0,
      cancelChanges: 0,
      manualSave: 0,
      copyContent: 0,
      refineWithAI: 0,
      insertText: 0,
    });

    return (
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <div>
          <button
            data-testid="trigger-global-manual-save"
            onClick={() => setCommandTriggers((prev) => ({ ...prev, manualSave: prev.manualSave + 1 }))}
          >
            Trigger Global Save
          </button>
          <DocumentEditor
            documentNode={mockDocumentNode}
            onSave={vi.fn()}
            onCommitVersion={onCommitVersionMock ?? vi.fn()}
            onDelete={vi.fn()}
            settings={DEFAULT_SETTINGS}
            onShowHistory={vi.fn()}
            onLanguageChange={vi.fn()}
            onViewModeChange={vi.fn()}
            onToggleLock={vi.fn()}
            formatTrigger={0}
            previewScale={1}
            editorScale={1}
            onPreviewScaleChange={vi.fn()}
            previewMinScale={0.5}
            previewMaxScale={2}
            previewZoomStep={0.1}
            previewInitialScale={1}
            previewResetSignal={0}
            onPreviewVisibilityChange={vi.fn()}
            onPreviewZoomAvailabilityChange={vi.fn()}
            onPreviewMetadataChange={vi.fn()}
            onZoomTargetChange={vi.fn()}
            onSelectionChange={vi.fn()}
            pendingInsertText={null}
            commandTriggers={commandTriggers}
            onSaveToFile={vi.fn()}
          />
        </div>
      </IconProvider>
    );
  };

  it('updates save button state from dirty -> saving -> saved -> idle', async () => {
    let resolveCommit!: () => void;
    const commitPromise = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });
    const onCommitVersion = vi.fn().mockImplementation(() => commitPromise);

    render(<TestEditorWrapper onCommitVersionMock={onCommitVersion} />);

    // Initially clean: save button tooltip is Save Version (Ctrl+S) and disabled
    const saveButton = screen.getByRole('button', { name: /save version/i });
    expect(saveButton).toBeDisabled();

    // Simulate content change in editor
    act(() => {
      fireEvent.click(screen.getByTestId('simulate-change'));
    });

    // Save button should now be enabled and dirty
    expect(saveButton).not.toBeDisabled();

    // Trigger save via Monaco onManualSave (Ctrl+S in editor)
    act(() => {
      fireEvent.click(screen.getByTestId('simulate-ctrl-s'));
    });

    // Should call onCommitVersion
    expect(onCommitVersion).toHaveBeenCalledWith('doc-1', 'Modified content');

    // Should show saving state (Spinner and Saving aria-label)
    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();

    // Resolve the commit promise
    await act(async () => {
      resolveCommit();
    });

    // Button should now show Saved state with CheckIcon and Saved aria-label
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^saved$/i })).toBeInTheDocument();
    });
  });

  it('flashes saved state when Ctrl+S is pressed on a clean document', async () => {
    const onCommitVersion = vi.fn();
    render(<TestEditorWrapper onCommitVersionMock={onCommitVersion} />);

    // Document is clean initially; trigger save via global command
    act(() => {
      fireEvent.click(screen.getByTestId('trigger-global-manual-save'));
    });

    // Should not commit a redundant version, but should flash Saved state
    expect(onCommitVersion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^saved$/i })).toBeInTheDocument();
  });
});

import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  default: React.forwardRef<any, any>((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      format: vi.fn(),
      setScrollTop: vi.fn(),
      getScrollInfo: vi.fn().mockResolvedValue({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 }),
      getSelection: vi.fn(),
      insertText: vi.fn(),
    }));
    return (
      <div data-testid="mock-code-editor">
        Code Editor Content
      </div>
    );
  }),
}));

describe('Editor Zoom Synchronization', () => {
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

  const defaultTriggers = {
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
  };

  it('triggers onEditorScaleChange and sets zoom target to editor when Ctrl+Wheel is used on the code editor', () => {
    const handleEditorScaleChange = vi.fn();
    const handleZoomTargetChange = vi.fn();

    render(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <DocumentEditor
          documentNode={mockDocumentNode}
          onSave={vi.fn()}
          onCommitVersion={vi.fn()}
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
          onEditorScaleChange={handleEditorScaleChange}
          previewMinScale={0.25}
          previewMaxScale={4}
          previewZoomStep={0.05}
          previewInitialScale={1}
          previewResetSignal={0}
          onZoomTargetChange={handleZoomTargetChange}
          commandTriggers={defaultTriggers}
        />
      </IconProvider>
    );

    const codeEditor = screen.getByTestId('mock-code-editor');

    // Zoom in with Ctrl + Wheel Up (deltaY < 0)
    act(() => {
      fireEvent.wheel(codeEditor, {
        ctrlKey: true,
        deltaY: -100,
      });
    });

    expect(handleEditorScaleChange).toHaveBeenCalledWith(1.05);
    expect(handleZoomTargetChange).toHaveBeenCalledWith('editor');

    // Zoom out with Ctrl + Wheel Down (deltaY > 0)
    act(() => {
      fireEvent.wheel(codeEditor, {
        ctrlKey: true,
        deltaY: 100,
      });
    });

    expect(handleEditorScaleChange).toHaveBeenCalledWith(0.95);
  });
});

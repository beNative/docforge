import React, { useState, act } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodeEditor from '../components/CodeEditor';

let mockModelContentCallback: (() => void) | null = null;
let mockEditorInstance: any = null;
let mockContainer: HTMLDivElement | null = null;
let getSharedEditorCallCount = 0;
let switchToDocumentCallCount = 0;
let saveCurrentViewStateCallCount = 0;

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../services/editor/monacoLoader', () => ({
  ensureMonaco: vi.fn().mockResolvedValue({
    KeyMod: { CtrlCmd: 2048, WinCtrl: 256, Shift: 1024, Alt: 512 },
    KeyCode: { KeyS: 49, KeyA: 31, Slash: 85 },
    editor: {
      setModelLanguage: vi.fn(),
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
    },
  }),
}));

vi.mock('../services/editor/registerTomlLanguage', () => ({
  registerTomlLanguage: vi.fn(),
}));

vi.mock('../services/editor/registerPlantumlLanguage', () => ({
  registerPlantumlLanguage: vi.fn(),
}));

vi.mock('../services/editor/monacoEditorPool', () => ({
  monacoEditorPool: {
    getSharedEditor: vi.fn().mockImplementation(async () => {
      getSharedEditorCallCount++;
      return { editor: mockEditorInstance, container: mockContainer };
    }),
    switchToDocument: vi.fn().mockImplementation(() => {
      switchToDocumentCallCount++;
    }),
    saveCurrentViewState: vi.fn().mockImplementation(() => {
      saveCurrentViewStateCallCount++;
    }),
  },
}));

describe('CodeEditor Stability & Focus Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSharedEditorCallCount = 0;
    switchToDocumentCallCount = 0;
    saveCurrentViewStateCallCount = 0;
    mockModelContentCallback = null;

    mockContainer = document.createElement('div');
    mockContainer.className = 'mock-monaco-container';

    let currentVal = 'Hello';
    mockEditorInstance = {
      addAction: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidChangeModelContent: vi.fn().mockImplementation((cb) => {
        mockModelContentCallback = cb;
        return { dispose: vi.fn() };
      }),
      onDidScrollChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidChangeCursorSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onContextMenu: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidFocusEditorWidget: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidBlurEditorWidget: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      updateOptions: vi.fn(),
      getValue: vi.fn().mockImplementation(() => currentVal),
      setValue: vi.fn().mockImplementation((v) => { currentVal = v; }),
      getSelection: vi.fn().mockReturnValue(null),
      saveViewState: vi.fn().mockReturnValue(null),
      restoreViewState: vi.fn(),
      getModel: vi.fn().mockReturnValue({}),
      getLayoutInfo: vi.fn().mockReturnValue({ height: 500 }),
      getScrollTop: vi.fn().mockReturnValue(0),
      getScrollHeight: vi.fn().mockReturnValue(500),
    };
  });

  it('does not re-initialize editor or detach container when content and callbacks change on keystroke', async () => {
    let parentRenderCount = 0;

    const TestHarness: React.FC = () => {
      parentRenderCount++;
      const [content, setContent] = useState('Hello');

      // Re-created on every render (simulating dynamic handleManualSave in PromptEditor)
      const dynamicManualSave = () => {
        // manual save
      };

      return (
        <CodeEditor
          documentId="doc-123"
          content={content}
          language="markdown"
          onChange={(newVal) => setContent(newVal)}
          onManualSave={dynamicManualSave}
        />
      );
    };

    render(<TestHarness />);

    await waitFor(() => {
      expect(getSharedEditorCallCount).toBe(1);
      expect(switchToDocumentCallCount).toBe(1);
    });

    const initialContainerParent = mockContainer?.parentNode;
    expect(initialContainerParent).not.toBeNull();
    expect(saveCurrentViewStateCallCount).toBe(0);

    // Simulate entering a character: Monaco changes its internal value and fires onDidChangeModelContent
    act(() => {
      mockEditorInstance.setValue('Hello World');
      mockModelContentCallback?.();
    });

    // Verify parent re-rendered with new state and new callback reference
    expect(parentRenderCount).toBeGreaterThanOrEqual(2);

    // CRITICAL CHECKS:
    // 1. Monaco editor was NOT re-initialized
    expect(getSharedEditorCallCount).toBe(1);
    expect(switchToDocumentCallCount).toBe(1);

    // 2. The DOM container was NOT detached from the editor DOM node
    expect(mockContainer?.parentNode).toBe(initialContainerParent);

    // 3. Save current view state was not triggered (meaning the cleanup function did NOT run)
    expect(saveCurrentViewStateCallCount).toBe(0);
  });
});

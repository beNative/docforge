import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('DocumentEditor image rendering', () => {
  const mockImageNode: DocumentNode = {
    id: 'img-1',
    title: 'test.png',
    content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    doc_type: 'image',
    language_hint: 'image',
    default_view_mode: 'preview',
    parentId: null,
    children: [],
  };

  it('renders image document without crashing', async () => {
    render(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <DocumentEditor
          documentNode={mockImageNode}
          onSave={vi.fn()}
          onCommitVersion={vi.fn()}
          onDelete={vi.fn()}
          settings={DEFAULT_SETTINGS}
          onShowHistory={vi.fn()}
          onLanguageChange={vi.fn()}
          onViewModeChange={vi.fn()}
          commandTriggers={{
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
          }}
        />
      </IconProvider>
    );

    await waitFor(() => {
      expect(screen.getByAltText('Document preview')).toBeInTheDocument();
    });
  });
});

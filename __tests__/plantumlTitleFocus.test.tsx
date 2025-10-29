import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DocumentOrFolder, PreviewMetadata, Settings, ViewMode } from '../types';
import DocumentEditor from '../components/PromptEditor';
import { DEFAULT_SETTINGS } from '../constants';

const renderSpy = vi.fn(async () => ({
  output: <div data-testid="mock-preview" />,
}));

const renderer = { render: renderSpy };

vi.mock('../services/previewService', () => ({
  previewService: {
    getRendererForLanguage: vi.fn(() => renderer),
  },
}));

const addLogSpy = vi.fn();

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('../hooks/useLogger', () => ({
  useLogger: () => ({ addLog: addLogSpy }),
}));

vi.mock('../components/CodeEditor', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef<HTMLTextAreaElement, any>((props, ref) => (
      <textarea
        ref={ref}
        data-testid="code-editor"
        value={props.content}
        onChange={(event) => props.onChange(event.target.value)}
      />
    )),
  };
});

vi.mock('../components/MonacoDiffEditor', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => <div data-testid="diff-editor" />,
  };
});

vi.mock('../components/IconButton', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef<HTMLButtonElement, any>(({ onClick, children, ...rest }, ref) => (
      <button ref={ref} type="button" onClick={onClick} {...rest}>
        {children}
      </button>
    )),
  };
});

vi.mock('../components/Button', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...rest }: any) => (
      <button type="button" {...rest}>
        {children}
      </button>
    ),
  };
});

vi.mock('../components/Spinner', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => <div data-testid="spinner" />,
  };
});

vi.mock('../components/Modal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children }: any) => <div data-testid="modal">{children}</div>,
  };
});

vi.mock('../services/languageService', () => ({
  SUPPORTED_LANGUAGES: [
    { id: 'plantuml', label: 'PlantUML' },
    { id: 'markdown', label: 'Markdown' },
  ],
}));

vi.mock('../hooks/useDocumentAutoSave', () => ({
  useDocumentAutoSave: () => ({ skipNextAutoSave: vi.fn() }),
}));

vi.mock('../services/llmService', () => ({
  llmService: {
    refineDocument: vi.fn(),
    generateTitle: vi.fn(),
    generateEmojiForTitle: vi.fn(),
  },
}));

vi.mock('../components/Icons', () => {
  const React = require('react');
  const MockIcon = () => <svg />;
  return {
    __esModule: true,
    SparklesIcon: MockIcon,
    TrashIcon: MockIcon,
    CopyIcon: MockIcon,
    CheckIcon: MockIcon,
    HistoryIcon: MockIcon,
    EyeIcon: MockIcon,
    PencilIcon: MockIcon,
    LayoutHorizontalIcon: MockIcon,
    LayoutVerticalIcon: MockIcon,
    RefreshIcon: MockIcon,
    SaveIcon: MockIcon,
    FormatIcon: MockIcon,
  };
});

const createDocument = (): DocumentOrFolder => ({
  id: 'doc-1',
  type: 'document',
  title: 'Original Title',
  content: '@startuml\nAlice -> Bob\n@enduml',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  parentId: null,
  language_hint: 'plantuml',
  default_view_mode: 'preview',
});

describe('DocumentEditor PlantUML preview stability', () => {
  beforeEach(() => {
    renderSpy.mockClear();
    addLogSpy.mockClear();
  });

  it('does not re-render the PlantUML preview when editing the title', async () => {
    vi.useFakeTimers();
    const restoreTimers = () => vi.useRealTimers();

    try {
      const Wrapper: React.FC = () => {
        const [doc, setDoc] = React.useState<DocumentOrFolder>(createDocument());
        const handleSave = React.useCallback((update: Partial<Omit<DocumentOrFolder, 'id' | 'content'>>) => {
          setDoc((prev) => ({ ...prev, ...update }));
        }, []);

        const handleNoop = React.useCallback(() => {}, []);
        const handleScaleChange = React.useCallback((_value: number) => {}, []);
        const handleViewMode = React.useCallback((_mode: ViewMode) => {}, []);
        const handleMetadataChange = React.useCallback((_metadata: PreviewMetadata | null) => {}, []);

        return (
          <DocumentEditor
            documentNode={doc}
            onSave={handleSave}
            onCommitVersion={handleNoop}
            onDelete={handleNoop}
            settings={DEFAULT_SETTINGS as Settings}
            onShowHistory={handleNoop}
            onLanguageChange={handleNoop}
            onViewModeChange={handleViewMode}
            formatTrigger={0}
            previewScale={1}
            onPreviewScaleChange={handleScaleChange}
            previewMinScale={0.5}
            previewMaxScale={2}
            previewZoomStep={0.1}
            previewInitialScale={1}
            previewResetSignal={0}
            onPreviewVisibilityChange={handleNoop}
            onPreviewZoomAvailabilityChange={handleNoop}
            onPreviewMetadataChange={handleMetadataChange}
          />
        );
      };

      render(<Wrapper />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      const input = screen.getByPlaceholderText('Document Title') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Original Title U' } });
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Original Title Update' } });
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(renderSpy).toHaveBeenCalledTimes(1);
    } finally {
      restoreTimers();
    }
  });
});

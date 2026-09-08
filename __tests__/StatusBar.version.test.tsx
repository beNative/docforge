import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatusBar from '../components/StatusBar';
import { IconProvider } from '../contexts/IconContext';

describe('StatusBar Active Document Version', () => {
  const defaultProps = {
    status: 'connected' as const,
    modelName: 'llama3',
    llmProviderName: 'Ollama',
    llmProviderUrl: 'http://localhost:11434',
    documentCount: 5,
    lastSaved: '2026-09-08T09:00:00.000Z',
    availableModels: [],
    onModelChange: vi.fn(),
    discoveredServices: [],
    onProviderChange: vi.fn(),
    appVersion: '0.9.5',
    previewScale: 1,
    onPreviewZoomIn: vi.fn(),
    onPreviewZoomOut: vi.fn(),
    onPreviewReset: vi.fn(),
    isPreviewZoomAvailable: false,
    previewMinScale: 0.25,
    previewMaxScale: 4,
    previewInitialScale: 1,
    zoomTarget: 'editor' as const,
  };

  beforeEach(() => {
    let overlayRoot = document.getElementById('overlay-root');
    if (!overlayRoot) {
      overlayRoot = document.createElement('div');
      overlayRoot.setAttribute('id', 'overlay-root');
      document.body.appendChild(overlayRoot);
    }
  });

  const renderWithIcons = (ui: React.ReactElement) => {
    return render(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        {ui}
      </IconProvider>
    );
  };

  it('renders active document version next to last saved time when documentVersion is provided', () => {
    renderWithIcons(
      <StatusBar
        {...defaultProps}
        documentVersion={1}
      />
    );

    expect(screen.getByText('Last Saved:')).toBeInTheDocument();
    expect(screen.getByText('Version:')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('formats numeric version and preserves already prefixed string version', () => {
    const { rerender } = renderWithIcons(
      <StatusBar
        {...defaultProps}
        documentVersion={3}
      />
    );
    expect(screen.getByText('v3')).toBeInTheDocument();

    rerender(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <StatusBar
          {...defaultProps}
          documentVersion="v4"
        />
      </IconProvider>
    );
    expect(screen.getByText('v4')).toBeInTheDocument();
  });

  it('does not render version section when documentVersion is null or undefined', () => {
    const { rerender } = renderWithIcons(
      <StatusBar
        {...defaultProps}
        documentVersion={null}
      />
    );
    expect(screen.getByText('Last Saved:')).toBeInTheDocument();
    expect(screen.queryByText('Version:')).not.toBeInTheDocument();

    rerender(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <StatusBar
          {...defaultProps}
          documentVersion={undefined}
        />
      </IconProvider>
    );
    expect(screen.queryByText('Version:')).not.toBeInTheDocument();
  });

  it('invokes onOpenDocumentHistory when the document version button is clicked', () => {
    const onOpenDocumentHistory = vi.fn();
    renderWithIcons(
      <StatusBar
        {...defaultProps}
        documentVersion={2}
        onOpenDocumentHistory={onOpenDocumentHistory}
      />
    );

    const versionButton = screen.getByRole('button', { name: /Document version v2/i });
    expect(versionButton).toBeInTheDocument();

    fireEvent.click(versionButton);
    expect(onOpenDocumentHistory).toHaveBeenCalledTimes(1);
  });

  it('shows tooltip with history hint on hover when clickable', () => {
    renderWithIcons(
      <StatusBar
        {...defaultProps}
        documentVersion={1}
        onOpenDocumentHistory={vi.fn()}
      />
    );

    const versionButton = screen.getByRole('button', { name: /Document version v1/i });
    fireEvent.mouseEnter(versionButton);

    expect(screen.getByText(/Version v1 \(click to view history\)/i)).toBeInTheDocument();
  });
});

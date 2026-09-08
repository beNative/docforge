import React, { useState, act } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../components/Sidebar';
import { IconProvider } from '../contexts/IconContext';
import type { DocumentOrFolder } from '../types';
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

vi.mock('../services/storageService', () => ({
  storageService: {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Sidebar Treeview Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const createMockData = (count: number) => {
    const documents: DocumentOrFolder[] = [];
    const documentTree: DocumentNode[] = [];
    const navigableItems: Array<{ id: string; type: 'document' | 'folder' | 'template'; parentId: string | null }> = [];

    for (let i = 1; i <= count; i++) {
      const id = `doc-${i}`;
      const title = `Document ${i}`;
      documents.push({
        id,
        title,
        type: 'document',
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DocumentOrFolder);

      documentTree.push({
        id,
        title,
        type: 'document',
        parentId: null,
        children: [],
      });

      navigableItems.push({
        id,
        type: 'document',
        parentId: null,
      });
    }

    return { documents, documentTree, navigableItems };
  };

  const TestWrapper: React.FC<{
    initialSelectedId?: string;
    itemCount?: number;
    onSelectNodeMock?: (id: string, e: React.MouseEvent) => void;
  }> = ({ initialSelectedId = 'doc-1', itemCount = 25, onSelectNodeMock }) => {
    const { documents, documentTree, navigableItems } = createMockData(itemCount);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([initialSelectedId]));
    const [lastClickedId, setLastClickedId] = useState<string | null>(initialSelectedId);
    const [activeNodeId, setActiveNodeId] = useState<string | null>(initialSelectedId);
    const searchInputRef = React.createRef<HTMLInputElement>();

    const handleSelectNode = (id: string, e: React.MouseEvent) => {
      setActiveNodeId(id);
      onSelectNodeMock?.(id, e);
    };

    return (
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <Sidebar
          documents={documents}
          documentTree={documentTree}
          navigableItems={navigableItems}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          lastClickedId={lastClickedId}
          setLastClickedId={setLastClickedId}
          activeNodeId={activeNodeId}
          activeDocumentId={activeNodeId}
          openDocumentIds={activeNodeId ? [activeNodeId] : []}
          onSelectNode={handleSelectNode}
          onDeleteSelection={vi.fn()}
          onDeleteNode={vi.fn()}
          onRenameNode={vi.fn()}
          onMoveNode={vi.fn()}
          onImportNodes={vi.fn()}
          onDropFiles={vi.fn()}
          onDropLink={vi.fn()}
          onNewDocument={vi.fn()}
          onNewRootFolder={vi.fn()}
          onNewSubfolder={vi.fn()}
          onNewFromClipboard={vi.fn()}
          onDuplicateSelection={vi.fn()}
          onToggleNodeLock={vi.fn()}
          onCopyNodeContent={vi.fn()}
          onSaveNodeToFile={vi.fn()}
          expandedFolderIds={new Set()}
          onToggleExpand={vi.fn()}
          onExpandAll={vi.fn()}
          onCollapseAll={vi.fn()}
          searchTerm=""
          setSearchTerm={vi.fn()}
          searchInputRef={searchInputRef}
          onContextMenu={vi.fn()}
          renamingNodeId={null}
          onRenameComplete={vi.fn()}
          commands={[]}
          customShortcuts={{}}
          pendingRevealId={null}
          onRevealHandled={vi.fn()}
          templates={[]}
          activeTemplateId={null}
          onSelectTemplate={vi.fn()}
        />
      </IconProvider>
    );
  };

  it('navigates with Home and End keys', () => {
    const onSelectNode = vi.fn();
    const { container } = render(<TestWrapper initialSelectedId="doc-5" itemCount={25} onSelectNodeMock={onSelectNode} />);
    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    // End key moves to last item (doc-25)
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'End' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-25', expect.anything());

    // Home key moves to first item (doc-1)
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'Home' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-1', expect.anything());
  });

  it('navigates with PageDown and PageUp keys (default page size 10 in test env)', () => {
    const onSelectNode = vi.fn();
    const { container } = render(<TestWrapper initialSelectedId="doc-1" itemCount={25} onSelectNodeMock={onSelectNode} />);
    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    // PageDown from index 0 should jump +10 to index 10 (doc-11)
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PageDown' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-11', expect.anything());

    // Another PageDown from index 10 jumps +10 to index 20 (doc-21)
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PageDown' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-21', expect.anything());

    // PageUp from index 20 jumps -10 to index 10 (doc-11)
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PageUp' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-11', expect.anything());

    // Supports PgUp and PgDn aliases
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PgDn' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-21', expect.anything());

    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PgUp' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-11', expect.anything());
  });

  it('supports Shift+Home and Shift+End for range selection', () => {
    const onSelectNode = vi.fn();
    const { container } = render(<TestWrapper initialSelectedId="doc-5" itemCount={25} onSelectNodeMock={onSelectNode} />);
    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    // Shift+End selects from doc-5 to doc-25
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'End', shiftKey: true });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-25', expect.objectContaining({ shiftKey: true }));

    // Shift+Home selects from doc-5 to doc-1
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'Home', shiftKey: true });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-1', expect.objectContaining({ shiftKey: true }));
  });

  it('supports Shift+PageDown and Shift+PageUp for range selection', () => {
    const onSelectNode = vi.fn();
    const { container } = render(<TestWrapper initialSelectedId="doc-5" itemCount={25} onSelectNodeMock={onSelectNode} />);
    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PageDown', shiftKey: true });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-15', expect.objectContaining({ shiftKey: true }));

    act(() => {
      fireEvent.keyDown(sidebar, { key: 'PageUp', shiftKey: true });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-5', expect.objectContaining({ shiftKey: true }));
  });

  it('still supports ArrowUp and ArrowDown keys', () => {
    const onSelectNode = vi.fn();
    const { container } = render(<TestWrapper initialSelectedId="doc-5" itemCount={25} onSelectNodeMock={onSelectNode} />);
    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    act(() => {
      fireEvent.keyDown(sidebar, { key: 'ArrowDown' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-6', expect.anything());

    act(() => {
      fireEvent.keyDown(sidebar, { key: 'ArrowUp' });
    });
    expect(onSelectNode).toHaveBeenLastCalledWith('doc-5', expect.anything());
  });

  it('does not navigate to templates when templates section is collapsed', () => {
    const onSelectNode = vi.fn();
    const onSelectTemplate = vi.fn();
    const documents: DocumentOrFolder[] = [
      { id: 'doc-1', title: 'Doc 1', type: 'document', parent_id: null, created_at: '', updated_at: '' } as DocumentOrFolder,
    ];
    const documentTree: DocumentNode[] = [
      { id: 'doc-1', title: 'Doc 1', type: 'document', parentId: null, children: [] },
    ];
    const templates = [
      { id: 'tpl-1', title: 'Template 1', content: '', description: '' },
    ];
    const navigableItems = [
      { id: 'doc-1', type: 'document' as const, parentId: null },
      { id: 'tpl-1', type: 'template' as const, parentId: null },
    ];

    const { container } = render(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        <Sidebar
          documents={documents}
          documentTree={documentTree}
          navigableItems={navigableItems}
          selectedIds={new Set(['doc-1'])}
          setSelectedIds={vi.fn()}
          lastClickedId="doc-1"
          setLastClickedId={vi.fn()}
          activeNodeId="doc-1"
          activeDocumentId="doc-1"
          openDocumentIds={['doc-1']}
          onSelectNode={onSelectNode}
          onDeleteSelection={vi.fn()}
          onDeleteNode={vi.fn()}
          onRenameNode={vi.fn()}
          onMoveNode={vi.fn()}
          onImportNodes={vi.fn()}
          onDropFiles={vi.fn()}
          onDropLink={vi.fn()}
          onNewDocument={vi.fn()}
          onNewRootFolder={vi.fn()}
          onNewSubfolder={vi.fn()}
          onNewFromClipboard={vi.fn()}
          onDuplicateSelection={vi.fn()}
          onToggleNodeLock={vi.fn()}
          onCopyNodeContent={vi.fn()}
          onSaveNodeToFile={vi.fn()}
          expandedFolderIds={new Set()}
          onToggleExpand={vi.fn()}
          onExpandAll={vi.fn()}
          onCollapseAll={vi.fn()}
          searchTerm=""
          setSearchTerm={vi.fn()}
          searchInputRef={React.createRef()}
          onContextMenu={vi.fn()}
          renamingNodeId={null}
          onRenameComplete={vi.fn()}
          commands={[]}
          customShortcuts={{}}
          pendingRevealId={null}
          onRevealHandled={vi.fn()}
          templates={templates as any}
          activeTemplateId={null}
          onSelectTemplate={onSelectTemplate}
        />
      </IconProvider>
    );

    const sidebar = container.querySelector('[data-component="document-tree-sidebar"]')!;

    // Find and click the Hide Templates button to collapse templates
    const collapseButton = container.querySelector('button[title="Hide Templates"]') || container.querySelector('button[aria-label="Hide Templates"]');
    expect(collapseButton).not.toBeNull();
    act(() => {
      fireEvent.click(collapseButton!);
    });

    // ArrowDown from doc-1 should NOT move to tpl-1
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'ArrowDown' });
    });
    expect(onSelectTemplate).not.toHaveBeenCalled();

    // End key should stay on doc-1 and not jump to tpl-1
    act(() => {
      fireEvent.keyDown(sidebar, { key: 'End' });
    });
    expect(onSelectTemplate).not.toHaveBeenCalled();
  });
});

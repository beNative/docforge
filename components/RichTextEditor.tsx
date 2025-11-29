import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from '@lexical/rich-text';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  ListItemNode,
  ListNode,
  $isListNode,
  type ListType,
} from '@lexical/list';
import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor,
  type NodeSelection,
  type RangeSelection,
  $createNodeSelection,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $nodesOfType,
  $setSelection,
} from 'lexical';
import {
  $createTableSelection,
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableRowNode,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableCellHeaderStates,
  TableNode,
  TableRowNode,
  type TableSelection,
} from '@lexical/table';
import IconButton from './IconButton';
import Button from './Button';
import ContextMenuComponent, { type MenuItem as ContextMenuItem } from './ContextMenu';
import { RedoIcon, UndoIcon } from './Icons';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  ClearFormattingIcon,
  CodeInlineIcon,
  HeadingOneIcon,
  HeadingThreeIcon,
  HeadingTwoIcon,
  ImageIcon as ToolbarImageIcon,
  ItalicIcon,
  LinkIcon as ToolbarLinkIcon,
  NumberListIcon,
  ParagraphIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from './rich-text/RichTextToolbarIcons';
import { $createImageNode, ImageNode, INSERT_IMAGE_COMMAND, type ImagePayload } from './rich-text/ImageNode';
import Modal from './Modal';

export interface RichTextEditorHandle {
  focus: () => void;
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }>;
}

interface RichTextEditorProps {
  html: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: 'history' | 'inline-format' | 'structure' | 'insert' | 'alignment' | 'utility' | 'table';
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

type BlockType = 'paragraph' | HeadingTagType | ListType | 'quote';

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

type SelectionSnapshot =
  | {
      type: 'range';
      anchorKey: string;
      anchorOffset: number;
      anchorType: 'text' | 'element';
      focusKey: string;
      focusOffset: number;
      focusType: 'text' | 'element';
    }
  | { type: 'node'; keys: string[] }
  | {
      type: 'table';
      tableKey: string;
      anchorCellKey: string;
      focusCellKey: string;
    }
  | null;

const RICH_TEXT_THEME = {
  paragraph: 'mb-3 text-base leading-7 text-text-main',
  heading: {
    h1: 'text-3xl font-bold text-text-main mb-4 mt-6',
    h2: 'text-2xl font-semibold text-text-main mb-3 mt-5',
    h3: 'text-xl font-medium text-text-main mb-2 mt-4',
  },
  quote: 'border-l-4 border-primary/50 pl-4 py-1 my-4 text-text-secondary italic bg-primary/5 rounded-r',
  list: {
    nested: {
      listitem: 'ml-4',
    },
    ol: 'list-decimal ml-8 mb-4 text-base leading-7 text-text-main',
    ul: 'list-disc ml-8 mb-4 text-base leading-7 text-text-main',
    listitem: 'mb-1 pl-1',
  },
  text: {
    bold: 'font-bold text-text-main',
    italic: 'italic',
    underline: 'underline decoration-primary/50 underline-offset-4',
    strikethrough: 'line-through opacity-70',
    code: 'font-mono bg-secondary-hover rounded px-1.5 py-0.5 text-sm text-primary border border-border-color',
  },
  link: 'text-primary underline decoration-primary/30 hover:decoration-primary transition-colors cursor-pointer',
  image: 'my-6 flex justify-center',
  table: 'my-6 w-full border-collapse border border-border-color text-sm',
  tableCell: 'border border-border-color px-3 py-2 align-top bg-secondary/40',
  tableCellHeader: 'bg-secondary text-text-main font-semibold',
  tableRow: 'even:bg-secondary/60',
  tableSelection: 'outline outline-2 outline-primary',
};

const Placeholder: React.FC = () => null;

const MIN_COLUMN_WIDTH = 72;

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  if (/^[a-zA-Z][\w+.-]*:/.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const LinkModal: React.FC<{
  isOpen: boolean;
  initialUrl: string;
  onSubmit: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ isOpen, initialUrl, onSubmit, onRemove, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(url);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal onClose={onClose} title="Insert link" initialFocusRef={inputRef}>
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-3">
          <label className="block text-sm font-semibold text-text-main" htmlFor="link-url-input">
            Link URL
          </label>
          <input
            id="link-url-input"
            ref={inputRef}
            type="text"
            inputMode="url"
            autoComplete="url"
            required
            value={url}
            onChange={event => setUrl(event.target.value)}
            className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="https://example.com"
          />
          <p className="text-xs text-text-secondary">
            Enter a valid URL. If you omit the protocol, https:// will be added automatically.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onRemove}>
            Remove link
          </Button>
          <Button type="submit">Save link</Button>
        </div>
      </form>
    </Modal>
  );
};

const ensureColGroupWithWidths = (tableElement: HTMLTableElement): HTMLTableColElement[] => {
  const firstRow = tableElement.rows[0];
  const columnCount = firstRow?.cells.length ?? 0;
  if (columnCount === 0) {
    return [];
  }

  let colGroup = tableElement.querySelector('colgroup');
  if (!colGroup) {
    colGroup = document.createElement('colgroup');
    tableElement.insertBefore(colGroup, tableElement.firstChild);
  }

  while (colGroup.children.length < columnCount) {
    const col = document.createElement('col');
    colGroup.appendChild(col);
  }

  while (colGroup.children.length > columnCount) {
    colGroup.lastElementChild?.remove();
  }

  const colElements = Array.from(colGroup.children) as HTMLTableColElement[];
  const existingWidths = colElements.map(col => parseFloat(col.style.width || ''));
  const needInitialization = existingWidths.some(width => Number.isNaN(width) || width <= 0);

  if (needInitialization) {
    const columnWidths = Array.from(firstRow.cells).map(cell => cell.getBoundingClientRect().width || MIN_COLUMN_WIDTH);
    colElements.forEach((col, index) => {
      const width = Math.max(MIN_COLUMN_WIDTH, columnWidths[index] ?? MIN_COLUMN_WIDTH);
      col.style.width = `${width}px`;
    });
  }

  return colElements;
};

const attachColumnResizeHandles = (tableElement: HTMLTableElement): (() => void) => {
  const container = tableElement.parentElement ?? tableElement;
  const originalContainerPosition = container.style.position;
  const restoreContainerPosition = originalContainerPosition === '' && getComputedStyle(container).position === 'static';

  if (restoreContainerPosition) {
    container.style.position = 'relative';
  }

  tableElement.style.tableLayout = 'fixed';

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '10';
  container.appendChild(overlay);

  const cleanupHandles: Array<() => void> = [];
  const resizeObserver = new ResizeObserver(() => renderHandles());

  function renderHandles() {
    overlay.replaceChildren();

    const firstRow = tableElement.rows[0];
    if (!firstRow) {
      return;
    }

    const cols = ensureColGroupWithWidths(tableElement);
    const containerRect = container.getBoundingClientRect();
    const cells = Array.from(firstRow.cells);

    cells.forEach((cell, columnIndex) => {
      if (columnIndex === cells.length - 1) {
        return;
      }

      const cellRect = cell.getBoundingClientRect();
      const handle = document.createElement('div');
      handle.setAttribute('role', 'presentation');
      handle.contentEditable = 'false';
      handle.style.position = 'absolute';
      handle.style.top = `${tableElement.offsetTop}px`;
      handle.style.left = `${cellRect.right - containerRect.left - 3}px`;
      handle.style.width = '6px';
      handle.style.height = `${tableElement.offsetHeight}px`;
      handle.style.cursor = 'col-resize';
      handle.style.pointerEvents = 'auto';
      handle.style.userSelect = 'none';

      let startX = 0;
      let leftWidth = 0;
      let rightWidth = 0;

      const handleMouseMove = (event: MouseEvent) => {
        const deltaX = event.clientX - startX;
        const nextLeftWidth = Math.max(MIN_COLUMN_WIDTH, leftWidth + deltaX);
        const nextRightWidth = Math.max(MIN_COLUMN_WIDTH, rightWidth - deltaX);

        cols[columnIndex].style.width = `${nextLeftWidth}px`;
        cols[columnIndex + 1].style.width = `${nextRightWidth}px`;
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      const handleMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        startX = event.clientX;
        leftWidth = parseFloat(cols[columnIndex].style.width || `${cell.offsetWidth}`);
        rightWidth = parseFloat(
          cols[columnIndex + 1].style.width || `${cells[columnIndex + 1]?.offsetWidth ?? MIN_COLUMN_WIDTH}`,
        );

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };

      handle.addEventListener('mousedown', handleMouseDown);
      cleanupHandles.push(() => handle.removeEventListener('mousedown', handleMouseDown));
      overlay.appendChild(handle);
    });
  }

  resizeObserver.observe(tableElement);
  renderHandles();

  return () => {
    cleanupHandles.forEach(cleanup => cleanup());
    resizeObserver.disconnect();
    overlay.remove();

    if (restoreContainerPosition) {
      container.style.position = originalContainerPosition;
    }
  };
};

const TableColumnResizePlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const cleanupMap = new Map<string, () => void>();

    const cleanupTable = (key: string) => {
      const cleanup = cleanupMap.get(key);
      if (cleanup) {
        cleanup();
        cleanupMap.delete(key);
      }
    };

    const initializeTable = (tableNode: TableNode) => {
      const tableKey = tableNode.getKey();
      const tableElement = editor.getElementByKey(tableKey);
      if (tableElement instanceof HTMLTableElement) {
        cleanupTable(tableKey);
        cleanupMap.set(tableKey, attachColumnResizeHandles(tableElement));
      }
    };

    editor.getEditorState().read(() => {
      const tableNodes = $nodesOfType(TableNode);
      tableNodes.forEach(tableNode => {
        initializeTable(tableNode);
      });
    });

    const unregisterMutationListener = editor.registerMutationListener(TableNode, mutations => {
      editor.getEditorState().read(() => {
        mutations.forEach((mutation, key) => {
          if (mutation === 'created') {
            const tableNode = $getNodeByKey<TableNode>(key);
            if (tableNode) {
              initializeTable(tableNode);
            }
          } else if (mutation === 'destroyed') {
            cleanupTable(key);
          }
        });
      });
    });

    return () => {
      unregisterMutationListener();
      cleanupMap.forEach(cleanup => cleanup());
      cleanupMap.clear();
    };
  }, [editor]);

  return null;
};

const TableModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInsertTable: (rows: number, columns: number, includeHeaderRow: boolean) => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColumnLeft: () => void;
  onInsertColumnRight: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  onDeleteTable: () => void;
  onToggleHeaderRow: () => void;
  isInTable: boolean;
  hasHeaderRow: boolean;
}> = ({
  isOpen,
  onClose,
  onInsertTable,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  onDeleteTable,
  onToggleHeaderRow,
  isInTable,
  hasHeaderRow,
}) => {
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [includeHeaderRow, setIncludeHeaderRow] = useState(true);
  const [hoveredGrid, setHoveredGrid] = useState<{ rows: number; columns: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayRows = hoveredGrid?.rows ?? rows;
  const displayColumns = hoveredGrid?.columns ?? columns;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRows(3);
    setColumns(3);
    setIncludeHeaderRow(true);
    setHoveredGrid(null);
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onInsertTable(displayRows, displayColumns, includeHeaderRow);
  };

  const handleGridClick = (row: number, column: number) => {
    setRows(row);
    setColumns(column);
    setHoveredGrid(null);
    onInsertTable(row, column, includeHeaderRow);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal title="Table options" onClose={onClose} initialFocusRef={inputRef}>
      <form onSubmit={handleSubmit} className="px-4 py-3 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>Select size</span>
              <span>
                {displayRows} × {displayColumns} cells
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1 rounded-md border border-border-color bg-secondary/70 p-3">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                  {Array.from({ length: 6 }).map((_, columnIndex) => {
                    const rowNumber = rowIndex + 1;
                    const columnNumber = columnIndex + 1;
                    const isActive =
                      (hoveredGrid?.rows ?? rows) >= rowNumber && (hoveredGrid?.columns ?? columns) >= columnNumber;
                    return (
                      <button
                        type="button"
                        key={`cell-${rowNumber}-${columnNumber}`}
                        onMouseEnter={() => setHoveredGrid({ rows: rowNumber, columns: columnNumber })}
                        onMouseLeave={() => setHoveredGrid(null)}
                        onFocus={() => setHoveredGrid({ rows: rowNumber, columns: columnNumber })}
                        onBlur={() => setHoveredGrid(null)}
                        onClick={() => handleGridClick(rowNumber, columnNumber)}
                        className={`h-8 w-8 rounded border ${
                          isActive ? 'border-primary bg-primary/10' : 'border-border-color bg-secondary-hover'
                        } focus:outline-none focus:ring-1 focus:ring-primary/60`}
                        aria-label={`Insert ${rowNumber} by ${columnNumber} table`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-main" htmlFor="table-rows">
              Custom size
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-text-secondary">Rows</span>
                <input
                  id="table-rows"
                  ref={inputRef}
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={event => setRows(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                  className="w-full rounded-md border border-border-color bg-primary-text/5 px-3 py-2 text-sm text-text-main focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-text-secondary">Columns</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={columns}
                  onChange={event => setColumns(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                  className="w-full rounded-md border border-border-color bg-primary-text/5 px-3 py-2 text-sm text-text-main focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="checkbox"
                checked={includeHeaderRow}
                onChange={event => setIncludeHeaderRow(event.target.checked)}
                className="h-4 w-4 rounded border-border-color text-primary focus:ring-primary"
              />
              <span>Use first row as a header</span>
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="px-3">
                Insert table
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-border-color pt-3">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Current table tools</span>
            <span>{isInTable ? 'Actions apply to the selected cell' : 'Place the caret inside a table to enable tools'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onInsertRowAbove} disabled={!isInTable}>
              Insert row above
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onInsertRowBelow} disabled={!isInTable}>
              Insert row below
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onInsertColumnLeft} disabled={!isInTable}>
              Insert column left
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onInsertColumnRight} disabled={!isInTable}>
              Insert column right
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onToggleHeaderRow} disabled={!isInTable}>
              {hasHeaderRow ? 'Remove header row' : 'Add header row'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onDeleteRow} disabled={!isInTable}>
              Delete row
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onDeleteColumn} disabled={!isInTable}>
              Delete column
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger/10"
              onClick={onDeleteTable}
              disabled={!isInTable}
            >
              Delete table
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

const ToolbarButton: React.FC<ToolbarButtonConfig> = ({ label, icon: Icon, isActive = false, disabled = false, onClick }) => (
  <IconButton
    type="button"
    tooltip={label}
    size="xs"
    variant="ghost"
    onMouseDown={event => {
      // Prevent the toolbar button from stealing focus, which would clear the
      // user's selection in the editor before the command executes.
      event.preventDefault();
    }}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={isActive}
    aria-label={label}
    className={`transition-all duration-200 ${isActive
        ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm'
        : 'text-text-secondary hover:text-text-main hover:bg-secondary-hover'
      } disabled:opacity-30 disabled:pointer-events-none`}
  >
    <Icon className="h-4 w-4" />
  </IconButton>
);

const ToolbarPlugin: React.FC<{
  readOnly: boolean;
  onActionsChange: (actions: ToolbarButtonConfig[]) => void;
}> = ({ readOnly, onActionsChange }) => {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkDraftUrl, setLinkDraftUrl] = useState('');
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isInTable, setIsInTable] = useState(false);
  const [hasHeaderRow, setHasHeaderRow] = useState(false);
  const pendingLinkSelectionRef = useRef<SelectionSnapshot>(null);
  const pendingTableSelectionRef = useRef<SelectionSnapshot>(null);
  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
  }, []);
  const dismissLinkModal = useCallback(() => {
    pendingLinkSelectionRef.current = null;
    closeLinkModal();
  }, [closeLinkModal]);

  const restoreSelectionFromSnapshot = useCallback(
    (snapshot: SelectionSnapshot | null | undefined = pendingLinkSelectionRef.current) => {
    const snapshotToUse = snapshot ?? pendingLinkSelectionRef.current;

    if (!snapshotToUse) {
      return null;
    }

    if (snapshotToUse.type === 'table') {
      const selection = $createTableSelection();
      const tableNode = $getNodeByKey(snapshotToUse.tableKey);
      const anchorCell = $getNodeByKey(snapshotToUse.anchorCellKey);
      const focusCell = $getNodeByKey(snapshotToUse.focusCellKey);

      if (!tableNode || !anchorCell || !focusCell) {
        return null;
      }

      selection.set(snapshotToUse.tableKey, snapshotToUse.anchorCellKey, snapshotToUse.focusCellKey);
      return selection;
    }

    if (snapshotToUse.type === 'range') {
      const selection = $createRangeSelection();
      const anchorNode = $getNodeByKey(snapshotToUse.anchorKey);
      const focusNode = $getNodeByKey(snapshotToUse.focusKey);

      if (!anchorNode || !focusNode) {
        return null;
      }

      selection.anchor.set(snapshotToUse.anchorKey, snapshotToUse.anchorOffset, snapshotToUse.anchorType);
      selection.focus.set(snapshotToUse.focusKey, snapshotToUse.focusOffset, snapshotToUse.focusType);
      return selection;
    }

    const selection = $createNodeSelection();
    snapshotToUse.keys.forEach(key => {
      const node = $getNodeByKey(key);
      if (node) {
        selection.add(node.getKey());
      }
    });

    return selection.getNodes().length > 0 ? selection : null;
  }, []);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    const hasValidSelection = $isRangeSelection(selection) || $isTableSelection(selection);

    if (!hasValidSelection) {
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setIsStrikethrough(false);
      setIsCode(false);
      setIsLink(false);
      setBlockType('paragraph');
      setAlignment('left');
      setIsInTable(false);
      setHasHeaderRow(false);
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const tableCellNode = $getTableCellNodeFromLexicalNode(anchorNode);
    if (tableCellNode) {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      setIsInTable(true);
      const firstRow = tableNode.getFirstChild();
      let hasHeader = false;
      if (firstRow && $isTableRowNode(firstRow)) {
        hasHeader = firstRow.getChildren().some(child => $isTableCellNode(child) && child.hasHeaderState(TableCellHeaderStates.ROW));
      }
      setHasHeaderRow(hasHeader);
    } else {
      setIsInTable(false);
      setHasHeaderRow(false);
    }

    if (!$isRangeSelection(selection)) {
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setIsStrikethrough(false);
      setIsCode(false);
      setIsLink(false);
      setBlockType('paragraph');
      setAlignment('left');
      return;
    }

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));
    setIsCode(selection.hasFormat('code'));

    const element = anchorNode.getTopLevelElementOrThrow();

    if ($isHeadingNode(element)) {
      setBlockType(element.getTag());
    } else if ($isListNode(element)) {
      setBlockType(element.getListType());
    } else if (element.getType() === 'quote') {
      setBlockType('quote');
    } else {
      setBlockType('paragraph');
    }

    const elementAlignment = element.getFormatType();
    setAlignment((elementAlignment || 'left') as 'left' | 'center' | 'right' | 'justify');

    const nodes = selection.getNodes();
    setIsLink(nodes.some(node => $isLinkNode(node) || $isLinkNode(node.getParent())));
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        payload => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        payload => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor, updateToolbar]);

  const formatHeading = useCallback(
    (heading: HeadingTagType) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(heading));
        }
      });
    },
    [editor],
  );

  const formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  }, [editor]);

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  }, [editor]);

  const captureLinkState = useCallback(() => {
    let detectedUrl = '';

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        pendingLinkSelectionRef.current = {
          type: 'range',
          anchorKey: selection.anchor.key,
          anchorOffset: selection.anchor.offset,
          anchorType: selection.anchor.type,
          focusKey: selection.focus.key,
          focusOffset: selection.focus.offset,
          focusType: selection.focus.type,
        };

        const selectionNodes = selection.getNodes();
        if (selectionNodes.length === 0) {
          return;
        }

        const firstNode = selectionNodes[0];
        const linkNode = $isLinkNode(firstNode)
          ? firstNode
          : $isLinkNode(firstNode.getParent())
            ? firstNode.getParent()
            : null;

        if ($isLinkNode(linkNode)) {
          detectedUrl = linkNode.getURL();
        }
        return;
      }

      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        pendingLinkSelectionRef.current = { type: 'node', keys: nodes.map(node => node.getKey()) };
      } else {
        pendingLinkSelectionRef.current = null;
      }
    });

    if (!pendingLinkSelectionRef.current) {
      return false;
    }

    setLinkDraftUrl(detectedUrl);
    setIsLinkModalOpen(true);
    return true;
  }, [editor]);

  const captureTableSelection = useCallback(() => {
    let snapshot: SelectionSnapshot = null;

    editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isTableSelection(selection)) {
        const anchorCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        const focusCell = $getTableCellNodeFromLexicalNode(selection.focus.getNode());

        if (!anchorCell || !focusCell) {
          return;
        }

        const tableNode = $getTableNodeFromLexicalNodeOrThrow(anchorCell);
        snapshot = {
          type: 'table',
          tableKey: tableNode.getKey(),
          anchorCellKey: anchorCell.getKey(),
          focusCellKey: focusCell.getKey(),
        };
        return;
      }

      if ($isRangeSelection(selection)) {
        const anchorCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        const focusCell = $getTableCellNodeFromLexicalNode(selection.focus.getNode());

        if (!anchorCell || !focusCell) {
          return;
        }

        snapshot = {
          type: 'range',
          anchorKey: selection.anchor.key,
          anchorOffset: selection.anchor.offset,
          anchorType: selection.anchor.type,
          focusKey: selection.focus.key,
          focusOffset: selection.focus.offset,
          focusType: selection.focus.type,
        };
      }
    });

    pendingTableSelectionRef.current = snapshot;
    return snapshot !== null;
  }, [editor]);

  const applyLink = useCallback(
    (url: string) => {
      closeLinkModal();

      const selectionSnapshot = pendingLinkSelectionRef.current;
      pendingLinkSelectionRef.current = null;

      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        editor.focus();
        return;
      }

      editor.update(() => {
        const selectionFromSnapshot = restoreSelectionFromSnapshot(selectionSnapshot);
        const selectionToUse = selectionFromSnapshot ?? (() => {
          const activeSelection = $getSelection();
          if ($isRangeSelection(activeSelection) || $isNodeSelection(activeSelection)) {
            return activeSelection;
          }
          const root = $getRoot();
          return root.selectEnd();
        })();

        if (!selectionToUse) {
          return;
        }

        $setSelection(selectionToUse);
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, normalizedUrl);
      });
      editor.focus();
    },
    [closeLinkModal, editor, restoreSelectionFromSnapshot],
  );

  const removeLink = useCallback(() => {
    closeLinkModal();

    const selectionSnapshot = pendingLinkSelectionRef.current;
    pendingLinkSelectionRef.current = null;

    editor.update(() => {
      const selectionFromSnapshot = restoreSelectionFromSnapshot(selectionSnapshot);
      const selectionToUse = selectionFromSnapshot ?? (() => {
        const activeSelection = $getSelection();
        if ($isRangeSelection(activeSelection) || $isNodeSelection(activeSelection)) {
          return activeSelection;
        }
        const root = $getRoot();
        return root.selectEnd();
      })();

      if (!selectionToUse) {
        return;
      }

      $setSelection(selectionToUse);
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    editor.focus();
  }, [closeLinkModal, editor, restoreSelectionFromSnapshot]);

  const toggleLink = useCallback(() => {
    if (readOnly) {
      return;
    }

    const hasSelection = captureLinkState();
    if (!hasSelection) {
      editor.focus();
    }
  }, [captureLinkState, editor, readOnly]);

  const insertImage = useCallback(
    (payload: ImagePayload) => {
      if (!payload.src) {
        return;
      }
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
    },
    [editor],
  );

  const closeTableModal = useCallback(() => {
    pendingTableSelectionRef.current = null;
    setIsTableModalOpen(false);
  }, []);

  const openTableModal = useCallback(() => {
    if (readOnly) {
      return;
    }

    captureTableSelection();
    setIsTableModalOpen(true);
  }, [captureTableSelection, readOnly]);

  const runWithActiveTable = useCallback(
    (action: (selection: RangeSelection | NodeSelection | TableSelection) => void) => {
      editor.update(() => {
        let selection = $getSelection();
        if (!selection || (!$isRangeSelection(selection) && !$isTableSelection(selection))) {
          const restoredSelection = restoreSelectionFromSnapshot(pendingTableSelectionRef.current);
          if (restoredSelection) {
            $setSelection(restoredSelection);
            selection = restoredSelection;
          }
        }

        if (!selection || (!$isRangeSelection(selection) && !$isTableSelection(selection))) {
          return;
        }
        const anchorNode = selection.anchor.getNode();
        if (!$getTableCellNodeFromLexicalNode(anchorNode)) {
          return;
        }
        action(selection);
      });
    },
    [editor, restoreSelectionFromSnapshot],
  );

  const insertTable = useCallback(
    (rows: number, columns: number, includeHeaderRow: boolean) => {
      if (readOnly) {
        return;
      }
      const normalizedRows = Math.max(1, Math.min(20, rows));
      const normalizedColumns = Math.max(1, Math.min(20, columns));
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: String(normalizedColumns),
        rows: String(normalizedRows),
        includeHeaders: includeHeaderRow ? { rows: true, columns: false } : false,
      });
      setIsTableModalOpen(false);
      editor.focus();
    },
    [editor, readOnly],
  );

  const insertTableRow = useCallback(
    (insertAfter: boolean) =>
      runWithActiveTable(() => {
        $insertTableRow__EXPERIMENTAL(insertAfter);
      }),
    [runWithActiveTable],
  );

  const insertTableColumn = useCallback(
    (insertAfter: boolean) =>
      runWithActiveTable(() => {
        $insertTableColumn__EXPERIMENTAL(insertAfter);
      }),
    [runWithActiveTable],
  );

  const deleteTableRow = useCallback(
    () =>
      runWithActiveTable(() => {
        $deleteTableRow__EXPERIMENTAL();
      }),
    [runWithActiveTable],
  );

  const deleteTableColumn = useCallback(
    () =>
      runWithActiveTable(() => {
        $deleteTableColumn__EXPERIMENTAL();
      }),
    [runWithActiveTable],
  );

  const deleteTable = useCallback(() => {
    runWithActiveTable(selection => {
      const tableCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
      if (!tableCell) {
        return;
      }
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
      tableNode.remove();
    });
    setIsTableModalOpen(false);
  }, [runWithActiveTable]);

  const selectTable = useCallback(
    () =>
      runWithActiveTable(selection => {
        const tableCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        if (!tableCell) {
          return;
        }
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
        const firstRow = tableNode.getFirstChild();
        const lastRow = tableNode.getLastChild();

        if (!$isTableRowNode(firstRow) || !$isTableRowNode(lastRow)) {
          return;
        }

        const firstCell = firstRow.getFirstChild();
        const lastCell = lastRow.getLastChild();

        if (!$isTableCellNode(firstCell) || !$isTableCellNode(lastCell)) {
          return;
        }

        const tableSelection = $createTableSelection();
        tableSelection.set(tableNode.getKey(), firstCell.getKey(), lastCell.getKey());
        $setSelection(tableSelection);
      }),
    [runWithActiveTable],
  );

  const toggleHeaderRow = useCallback(
    () =>
      runWithActiveTable(selection => {
        const tableCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
        if (!tableCell) {
          return;
        }
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
        const firstRow = tableNode.getFirstChild();
        if (!firstRow || !$isTableRowNode(firstRow)) {
          return;
        }
        const shouldAddHeader = !firstRow
          .getChildren()
          .some(child => $isTableCellNode(child) && child.hasHeaderState(TableCellHeaderStates.ROW));

        firstRow.getChildren().forEach(child => {
          if ($isTableCellNode(child)) {
            child.setHeaderStyles(shouldAddHeader ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS);
          }
        });
      }),
    [runWithActiveTable],
  );

  const openImagePicker = useCallback(() => {
    if (readOnly) {
      return;
    }
    fileInputRef.current?.click();
  }, [readOnly]);

  const handleImageFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const altText = file.name.replace(/\.[^/.]+$/, '');
          insertImage({ src: result, altText });
        }
      });
      reader.readAsDataURL(file);
    },
    [insertImage],
  );

  const toolbarButtons = useMemo<ToolbarButtonConfig[]>(
    () => [
      {
        id: 'undo',
        label: 'Undo',
        icon: UndoIcon,
        group: 'history',
        disabled: readOnly || !canUndo,
        onClick: () => editor.dispatchCommand(UNDO_COMMAND, undefined),
      },
      {
        id: 'redo',
        label: 'Redo',
        icon: RedoIcon,
        group: 'history',
        disabled: readOnly || !canRedo,
        onClick: () => editor.dispatchCommand(REDO_COMMAND, undefined),
      },
      {
        id: 'bold',
        label: 'Bold',
        icon: BoldIcon,
        group: 'inline-format',
        isActive: isBold,
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
      },
      {
        id: 'italic',
        label: 'Italic',
        icon: ItalicIcon,
        group: 'inline-format',
        isActive: isItalic,
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
      },
      {
        id: 'underline',
        label: 'Underline',
        icon: UnderlineIcon,
        group: 'inline-format',
        isActive: isUnderline,
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
      },
      {
        id: 'strikethrough',
        label: 'Strikethrough',
        icon: StrikethroughIcon,
        group: 'inline-format',
        isActive: isStrikethrough,
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'),
      },
      {
        id: 'code',
        label: 'Inline Code',
        icon: CodeInlineIcon,
        group: 'inline-format',
        isActive: isCode,
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code'),
      },
      {
        id: 'paragraph',
        label: 'Paragraph',
        icon: ParagraphIcon,
        group: 'structure',
        isActive: blockType === 'paragraph',
        disabled: readOnly,
        onClick: formatParagraph,
      },
      {
        id: 'h1',
        label: 'Heading 1',
        icon: HeadingOneIcon,
        group: 'structure',
        isActive: blockType === 'h1',
        disabled: readOnly,
        onClick: () => formatHeading('h1'),
      },
      {
        id: 'h2',
        label: 'Heading 2',
        icon: HeadingTwoIcon,
        group: 'structure',
        isActive: blockType === 'h2',
        disabled: readOnly,
        onClick: () => formatHeading('h2'),
      },
      {
        id: 'h3',
        label: 'Heading 3',
        icon: HeadingThreeIcon,
        group: 'structure',
        isActive: blockType === 'h3',
        disabled: readOnly,
        onClick: () => formatHeading('h3'),
      },
      {
        id: 'bulleted',
        label: 'Bulleted List',
        icon: BulletListIcon,
        group: 'structure',
        isActive: blockType === 'bullet',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
      },
      {
        id: 'numbered',
        label: 'Numbered List',
        icon: NumberListIcon,
        group: 'structure',
        isActive: blockType === 'number',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
      },
      {
        id: 'quote',
        label: 'Block Quote',
        icon: QuoteIcon,
        group: 'structure',
        isActive: blockType === 'quote',
        disabled: readOnly,
        onClick: formatQuote,
      },
      {
        id: 'link',
        label: isLink ? 'Edit or Remove Link' : 'Insert Link',
        icon: ToolbarLinkIcon,
        group: 'insert',
        isActive: isLink,
        disabled: readOnly,
        onClick: toggleLink,
      },
      {
        id: 'table',
        label: isInTable ? 'Table tools' : 'Insert Table',
        icon: TableIcon,
        group: 'insert',
        disabled: readOnly,
        onClick: openTableModal,
      },
      {
        id: 'image',
        label: 'Insert Image',
        icon: ToolbarImageIcon,
        group: 'insert',
        disabled: readOnly,
        onClick: openImagePicker,
      },
      {
        id: 'align-left',
        label: 'Align Left',
        icon: AlignLeftIcon,
        group: 'alignment',
        isActive: alignment === 'left',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left'),
      },
      {
        id: 'align-center',
        label: 'Align Center',
        icon: AlignCenterIcon,
        group: 'alignment',
        isActive: alignment === 'center',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center'),
      },
      {
        id: 'align-right',
        label: 'Align Right',
        icon: AlignRightIcon,
        group: 'alignment',
        isActive: alignment === 'right',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right'),
      },
      {
        id: 'align-justify',
        label: 'Justify',
        icon: AlignJustifyIcon,
        group: 'alignment',
        isActive: alignment === 'justify',
        disabled: readOnly,
        onClick: () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify'),
      },
      {
        id: 'clear-formatting',
        label: 'Clear Formatting',
        icon: ClearFormattingIcon,
        group: 'utility',
        disabled: readOnly,
        onClick: () => {
          if (isBold) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
          }
          if (isItalic) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
          }
          if (isUnderline) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
          }
          if (isStrikethrough) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
          }
          if (isCode) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
          }
          if (isLink) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
          }
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
          formatParagraph();
        },
      },
    ],
    [
      alignment,
      blockType,
      canRedo,
      canUndo,
      editor,
      formatHeading,
      formatParagraph,
      formatQuote,
      isBold,
      isCode,
      isItalic,
      isLink,
      isStrikethrough,
      isUnderline,
      openImagePicker,
      openTableModal,
      readOnly,
      toggleLink,
    ],
  );

  const tableContextActions = useMemo<ToolbarButtonConfig[]>(
    () => [
      {
        id: 'insert-column-before',
        label: 'Insert column before',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => insertTableColumn(false),
      },
      {
        id: 'insert-column-after',
        label: 'Insert column after',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => insertTableColumn(true),
      },
      {
        id: 'insert-row-before',
        label: 'Insert row before',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => insertTableRow(false),
      },
      {
        id: 'insert-row-after',
        label: 'Insert row after',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => insertTableRow(true),
      },
      {
        id: 'delete-row',
        label: 'Delete row',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTableRow,
      },
      {
        id: 'delete-column',
        label: 'Delete column',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTableColumn,
      },
      {
        id: 'delete-table',
        label: 'Delete table',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTable,
      },
      {
        id: 'select-table',
        label: 'Select table',
        icon: TableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: selectTable,
      },
    ],
    [
      deleteTable,
      deleteTableColumn,
      deleteTableRow,
      insertTableColumn,
      insertTableRow,
      isInTable,
      readOnly,
      selectTable,
    ],
  );

  const contextMenuActions = useMemo(
    () => [...toolbarButtons, ...tableContextActions],
    [tableContextActions, toolbarButtons],
  );

  useEffect(() => {
    onActionsChange(contextMenuActions);
  }, [contextMenuActions, onActionsChange]);

  const renderedToolbarElements = useMemo(
    () => {
      const items: (ToolbarButtonConfig | { type: 'separator'; id: string })[] = [];
      toolbarButtons.forEach((button, index) => {
        const previous = toolbarButtons[index - 1];
        if (previous && previous.group !== button.group) {
          items.push({ type: 'separator', id: `separator-${button.group}-${index}` });
        }
        items.push(button);
      });
      return items;
    },
    [toolbarButtons],
  );

  return (
    <>
      <div
        className="flex flex-wrap content-center items-center gap-x-0.5 gap-y-0.5 border-b border-border-color bg-secondary/50 backdrop-blur-sm px-2 py-0.5 overflow-hidden sticky top-0 z-10"
        style={{ minHeight: '28px' }}
      >
        {renderedToolbarElements.map(element =>
          'type' in element ? (
            <div key={element.id} className="mx-1 h-3 w-px bg-border-color" />
          ) : (
            <ToolbarButton key={element.id} {...element} />
          ),
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />
      </div>
      <LinkModal
        isOpen={isLinkModalOpen}
        initialUrl={linkDraftUrl}
        onSubmit={applyLink}
        onRemove={removeLink}
        onClose={dismissLinkModal}
      />
      <TableModal
        isOpen={isTableModalOpen}
        onClose={closeTableModal}
        onInsertTable={insertTable}
        onInsertRowAbove={() => insertTableRow(false)}
        onInsertRowBelow={() => insertTableRow(true)}
        onInsertColumnLeft={() => insertTableColumn(false)}
        onInsertColumnRight={() => insertTableColumn(true)}
        onDeleteRow={deleteTableRow}
        onDeleteColumn={deleteTableColumn}
        onDeleteTable={deleteTable}
        onToggleHeaderRow={toggleHeaderRow}
        isInTable={isInTable}
        hasHeaderRow={hasHeaderRow}
      />
    </>
  );
};

const HtmlContentSynchronizer: React.FC<{ html: string; lastAppliedHtmlRef: React.MutableRefObject<string> }> = ({
  html,
  lastAppliedHtmlRef,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    applyHtmlToEditor(editor, html, lastAppliedHtmlRef);
  }, [editor, html, lastAppliedHtmlRef]);

  return null;
};

const ImperativeBridgePlugin: React.FC<{
  forwardRef: React.Ref<RichTextEditorHandle>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  lastAppliedHtmlRef: React.MutableRefObject<string>;
  readOnly: boolean;
}> = ({ forwardRef, scrollContainerRef, lastAppliedHtmlRef, readOnly }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useImperativeHandle(forwardRef, () => ({
    focus: () => {
      editor.focus();
    },
    format: () => {
      const html = lastAppliedHtmlRef.current;
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const trimmed = html.trim();
        if (!trimmed) {
          lastAppliedHtmlRef.current = '';
          return;
        }
        const parser = new DOMParser();
        const dom = parser.parseFromString(trimmed, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        nodes.forEach(node => root.append(node));
        lastAppliedHtmlRef.current = trimmed;
      });
    },
    setScrollTop: (scrollTop: number) => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    },
    getScrollInfo: async () => {
      const el = scrollContainerRef.current;
      if (!el) {
        return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
      }
      return {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    },
  }), [editor, scrollContainerRef, lastAppliedHtmlRef]);

  return null;
};

const ImagePlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImageNode not registered on editor');
    }

    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      payload => {
        if (!payload?.src) {
          return false;
        }

        editor.update(() => {
          const imageNode = $createImageNode(payload);
          const selection = $getSelection();
          if ($isRangeSelection(selection) || $isNodeSelection(selection)) {
            selection.insertNodes([imageNode]);
          } else {
            const root = $getRoot();
            root.append(imageNode);
          }
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

const ClipboardImagePlugin: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (readOnly) {
      return undefined;
    }

    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return false;
        }

        const files = Array.from(clipboardData.items)
          .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
          .map(item => item.getAsFile())
          .filter((file): file is File => Boolean(file));

        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        files.forEach(file => {
          void readFileAsDataUrl(file)
            .then(src => {
              if (!src) {
                return;
              }
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                src,
                altText: file.name || 'Pasted image',
              });
            })
            .catch(() => undefined);
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, readOnly]);

  return null;
};

const sanitizeDomFromHtml = (html: string): Document => {
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, 'text/html');
  dom.querySelectorAll('script,style').forEach(node => node.remove());
  return dom;
};

const fallbackToPlainText = (text: string) => {
  const parser = new DOMParser();
  const dom = parser.parseFromString(text, 'text/html');
  return (dom.body.textContent || '').trim();
};

const applyHtmlToEditor = (
  editor: LexicalEditor,
  html: string,
  lastAppliedHtmlRef: React.MutableRefObject<string>,
) => {
  const normalizedIncoming = html.trim();

  editor.update(() => {
    const root = $getRoot();
    const currentHtml = $generateHtmlFromNodes(editor).trim();

    if (currentHtml === normalizedIncoming) {
      lastAppliedHtmlRef.current = normalizedIncoming;
      return;
    }

    if (normalizedIncoming === lastAppliedHtmlRef.current && currentHtml !== '') {
      return;
    }

    root.clear();

    if (!normalizedIncoming) {
      lastAppliedHtmlRef.current = '';
      root.append($createParagraphNode());
      return;
    }

    try {
      const dom = sanitizeDomFromHtml(normalizedIncoming);
      const nodes = $generateNodesFromDOM(editor, dom);
      if (nodes.length === 0) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(''));
        root.append(paragraph);
      } else {
        nodes.forEach(node => root.append(node));
      }
      lastAppliedHtmlRef.current = normalizedIncoming;
    } catch (error) {
      console.error('Failed to sync HTML content into the rich text editor.', error);
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(fallbackToPlainText(normalizedIncoming)));
      root.append(paragraph);
      lastAppliedHtmlRef.current = paragraph.getTextContent();
    }
  });
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ html, onChange, readOnly = false, onScroll, onFocusChange }, ref) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lastAppliedHtmlRef = useRef<string>('');
    const initialHtmlRef = useRef<string>(html);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
      x: 0,
      y: 0,
      visible: false,
    });
    const [contextActions, setContextActions] = useState<ToolbarButtonConfig[]>([]);
    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
      if (readOnly || contextActions.length === 0) {
        return [];
      }

      const mapActionsToMenuItems = (actions: ToolbarButtonConfig[]) => {
        const items: ContextMenuItem[] = [];
        actions.forEach((action, index) => {
          const previous = actions[index - 1];
          if (previous && previous.group !== action.group) {
            items.push({ type: 'separator' });
          }
          items.push({
            label: action.label,
            action: action.onClick,
            icon: action.icon,
            disabled: action.disabled,
          });
        });
        return items;
      };

      const historyActions = contextActions.filter(action => action.group === 'history');
      const selectionActions = contextActions.filter(action =>
        ['inline-format', 'alignment', 'structure', 'utility'].includes(action.group),
      );
      const tableActions = contextActions.filter(action => action.group === 'table');
      const insertActions = contextActions.filter(action => action.group === 'insert');

      const items: ContextMenuItem[] = [];
      items.push(...mapActionsToMenuItems(historyActions));

      if (items.length > 0 && selectionActions.length > 0 && items[items.length - 1]?.type !== 'separator') {
        items.push({ type: 'separator' });
      }

      if (selectionActions.length > 0) {
        items.push({
          label: 'Selection',
          submenu: mapActionsToMenuItems(selectionActions),
          disabled: selectionActions.every(action => action.disabled),
        });
      }

      if (items.length > 0 && tableActions.length > 0 && items[items.length - 1]?.type !== 'separator') {
        items.push({ type: 'separator' });
      }

      if (tableActions.length > 0) {
        items.push({
          label: 'Table',
          submenu: mapActionsToMenuItems(tableActions),
          disabled: tableActions.every(action => action.disabled),
        });
      }

      if (items.length > 0 && insertActions.length > 0) {
        items.push({ type: 'separator' });
      }

      items.push(...mapActionsToMenuItems(insertActions));

      const cleanedItems = items.filter((item, index, array) => {
        if (item.type !== 'separator') {
          return true;
        }

        const isLeadingSeparator = index === 0;
        const isTrailingSeparator = index === array.length - 1;
        const isDuplicateSeparator = array[index - 1]?.type === 'separator' || array[index + 1]?.type === 'separator';

        return !isLeadingSeparator && !isTrailingSeparator && !isDuplicateSeparator;
      });

      return cleanedItems;
    }, [contextActions, readOnly]);

    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        if (contextMenuState.visible) {
          setContextMenuState(prev => ({ ...prev, visible: false }));
        }
        if (!onScroll) {
          return;
        }
        const target = event.currentTarget;
        onScroll({
          scrollTop: target.scrollTop,
          scrollHeight: target.scrollHeight,
          clientHeight: target.clientHeight,
        });
      },
      [contextMenuState.visible, onScroll],
    );

    const handleFocus = useCallback(() => {
      onFocusChange?.(true);
    }, [onFocusChange]);

    const handleBlur = useCallback(() => {
      onFocusChange?.(false);
    }, [onFocusChange]);

    const handleChange = useCallback(
      (editorState: EditorState, editor: LexicalEditor) => {
        editorState.read(() => {
          try {
            const generated = $generateHtmlFromNodes(editor);
            const normalized = generated.trim();
            if (normalized === lastAppliedHtmlRef.current) {
              return;
            }
            lastAppliedHtmlRef.current = normalized;
            onChange(normalized);
          } catch (error) {
            console.error('Failed to serialize rich text content to HTML.', error);
          }
        });
      },
      [onChange],
    );

    const handleContextMenu = useCallback(
      (event: React.MouseEvent) => {
        if (readOnly || contextMenuItems.length === 0) {
          return;
        }
        event.preventDefault();
        setContextMenuState({
          x: event.clientX,
          y: event.clientY,
          visible: true,
        });
      },
      [contextMenuItems.length, readOnly],
    );

    const closeContextMenu = useCallback(() => {
      setContextMenuState(prev => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
      if (!readOnly) {
        return;
      }
      setContextMenuState(prev => ({ ...prev, visible: false }));
      setContextActions([]);
    }, [readOnly]);

    useEffect(() => {
      if (contextMenuState.visible && contextMenuItems.length === 0) {
        setContextMenuState(prev => ({ ...prev, visible: false }));
      }
    }, [contextMenuItems, contextMenuState.visible]);

    const initialConfig = useMemo(
      () => ({
        namespace: 'docforge-rich-text',
        editable: !readOnly,
        theme: RICH_TEXT_THEME,
        onError: (error: Error) => {
          console.error('Rich text editor encountered an error.', error);
        },
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode, TableNode, TableCellNode, TableRowNode],
        editorState: (editor: LexicalEditor) => {
          const initialHtml = (initialHtmlRef.current ?? '').trim();
          if (!initialHtml) {
            lastAppliedHtmlRef.current = '';
            return;
          }
          applyHtmlToEditor(editor, initialHtml, lastAppliedHtmlRef);
        },
      }),
      [readOnly],
    );

    return (
      <div className="h-full w-full bg-secondary flex flex-col" data-component="rich-text-editor">
        <LexicalComposer initialConfig={initialConfig}>
          {!readOnly && (
            <ToolbarPlugin
              readOnly={readOnly}
              onActionsChange={actions => {
                setContextActions(actions);
              }}
            />
          )}
          <ImperativeBridgePlugin
            forwardRef={ref}
            scrollContainerRef={scrollContainerRef}
            lastAppliedHtmlRef={lastAppliedHtmlRef}
            readOnly={readOnly}
          />
          <HtmlContentSynchronizer html={html} lastAppliedHtmlRef={lastAppliedHtmlRef} />
          <div
            ref={scrollContainerRef}
            className={`relative flex-1 overflow-auto ${readOnly ? 'cursor-not-allowed' : ''}`}
            onScroll={handleScroll}
            onContextMenu={handleContextMenu}
          >
            <div className="relative min-h-full px-4 py-6">
              <RichTextPlugin
                contentEditable={(
                  <ContentEditable
                    className="min-h-[calc(100vh-14rem)] outline-none"
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    spellCheck={!readOnly}
                    data-component="rich-text-editor"
                  />
                )}
                placeholder={<Placeholder />}
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>
          </div>
          <HistoryPlugin />
          {!readOnly && <AutoFocusPlugin />}
          <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} hasTabHandler={true} />
          {!readOnly && <TableColumnResizePlugin />}
          <ListPlugin />
          <LinkPlugin />
          <ImagePlugin />
          <ClipboardImagePlugin readOnly={readOnly} />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} />
          {!readOnly && (
            <ContextMenuComponent
              isOpen={contextMenuState.visible && contextMenuItems.length > 0}
              position={{ x: contextMenuState.x, y: contextMenuState.y }}
              items={contextMenuItems}
              onClose={closeContextMenu}
            />
          )}
        </LexicalComposer>
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

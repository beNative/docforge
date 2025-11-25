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
  $setSelection,
} from 'lexical';
import {
  $createTableNodeWithDimensions,
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $findTableNode,
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
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
  InsertRowAboveIcon,
  InsertRowBelowIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  DeleteRowIcon,
  DeleteColumnIcon,
  DeleteTableIcon,
  HeaderRowIcon,
  HeaderColumnIcon,
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
  table: 'my-4 w-full border-collapse text-base leading-7 text-text-main',
  tableCell: 'border border-border-color px-3 py-2 align-top bg-secondary/10 relative',
  tableCellHeader: 'bg-secondary-hover font-semibold text-text-main',
  tableRow: '',
  tableCellSelected: 'outline outline-2 outline-primary/60',
  tableCellPrimarySelected: 'outline outline-2 outline-offset-0 outline-primary',
  tableCellEditing: 'shadow-inner shadow-primary/30',
  tableCellResizer: 'absolute top-0 -right-0.5 w-1 h-full bg-primary/40 cursor-col-resize',
  tableCellActionButton: 'p-1 rounded bg-background text-text-secondary hover:text-text-main hover:bg-secondary-hover',
  tableCellActionButtonContainer: 'absolute -top-9 right-1 flex items-center gap-1',
  tableCellSortedIndicator: 'ml-1 text-primary',
};

const Placeholder: React.FC = () => null;

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

const MAX_TABLE_ROWS = 8;
const MAX_TABLE_COLUMNS = 10;

const TableInsertButton: React.FC<{
  disabled: boolean;
  onInsert: (rows: number, columns: number, headers: { rows: boolean; columns: boolean }) => void;
}> = ({ disabled, onInsert }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRows, setHoveredRows] = useState(3);
  const [hoveredColumns, setHoveredColumns] = useState(3);
  const [includeHeaderRow, setIncludeHeaderRow] = useState(true);
  const [includeHeaderColumn, setIncludeHeaderColumn] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.bottom + 6 });
    setIsOpen(prev => !prev);
  };

  const confirmInsert = (rows: number, columns: number) => {
    onInsert(rows, columns, { rows: includeHeaderRow, columns: includeHeaderColumn });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <IconButton
        type="button"
        tooltip="Insert table"
        size="xs"
        variant="ghost"
        disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={handleToggle}
        aria-pressed={isOpen}
        aria-label="Insert table"
        className={`${isOpen ? 'bg-primary/10 text-primary shadow-sm' : 'text-text-secondary hover:text-text-main hover:bg-secondary-hover'}`}
      >
        <TableIcon className="h-4 w-4" />
      </IconButton>

      {isOpen && (
        <div
          ref={popoverRef}
          className="fixed z-50 rounded-md border border-border-color bg-background shadow-lg p-3 w-64"
          style={{ left: anchor.left, top: anchor.top }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-text-main">Choose table size</p>
            <span className="text-[11px] text-text-secondary">{`${hoveredColumns} × ${hoveredRows}`}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1" aria-label="Table size picker">
              {Array.from({ length: MAX_TABLE_ROWS }).map((_, rowIndex) => (
                <div key={`row-${rowIndex}`} className="flex gap-1">
                  {Array.from({ length: MAX_TABLE_COLUMNS }).map((_, colIndex) => {
                    const isActive = rowIndex < hoveredRows && colIndex < hoveredColumns;
                    return (
                      <button
                        key={`cell-${rowIndex}-${colIndex}`}
                        type="button"
                        className={`h-4 w-4 rounded-sm border transition-colors ${isActive
                            ? 'bg-primary/30 border-primary'
                            : 'bg-secondary/40 border-border-color/70 hover:border-primary'
                          }`}
                        onMouseEnter={() => {
                          setHoveredRows(rowIndex + 1);
                          setHoveredColumns(colIndex + 1);
                        }}
                        onClick={() => confirmInsert(rowIndex + 1, colIndex + 1)}
                        aria-label={`Insert ${rowIndex + 1} by ${colIndex + 1} table`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-border-color text-primary focus:ring-primary"
                  checked={includeHeaderRow}
                  onChange={event => setIncludeHeaderRow(event.target.checked)}
                />
                Header row
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-border-color text-primary focus:ring-primary"
                  checked={includeHeaderColumn}
                  onChange={event => setIncludeHeaderColumn(event.target.checked)}
                />
                Header column
              </label>
            </div>

            <Button
              size="sm"
              variant="primary"
              type="button"
              onClick={() => confirmInsert(hoveredRows, hoveredColumns)}
              className="w-full"
            >
              Insert {hoveredColumns} × {hoveredRows} table
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [isInTable, setIsInTable] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkDraftUrl, setLinkDraftUrl] = useState('');
  const pendingLinkSelectionRef = useRef<SelectionSnapshot>(null);
  const closeLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
  }, []);
  const dismissLinkModal = useCallback(() => {
    pendingLinkSelectionRef.current = null;
    closeLinkModal();
  }, [closeLinkModal]);

  const restoreSelectionFromSnapshot = useCallback(
    (snapshot: SelectionSnapshot = pendingLinkSelectionRef.current) => {
    if (!snapshot) {
      return null;
    }

    if (snapshot.type === 'range') {
      const selection = $createRangeSelection();
      const anchorNode = $getNodeByKey(snapshot.anchorKey);
      const focusNode = $getNodeByKey(snapshot.focusKey);

      if (!anchorNode || !focusNode) {
        return null;
      }

      selection.anchor.set(snapshot.anchorKey, snapshot.anchorOffset, snapshot.anchorType);
      selection.focus.set(snapshot.focusKey, snapshot.focusOffset, snapshot.focusType);
      return selection;
    }

    const selection = $createNodeSelection();
    snapshot.keys.forEach(key => {
      const node = $getNodeByKey(key);
      if (node) {
        selection.add(node.getKey());
      }
    });

    return selection.getNodes().length > 0 ? selection : null;
  }, []);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();

    if ($isTableSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      setIsInTable(Boolean($findTableNode(anchorNode)));
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

    if (!$isRangeSelection(selection)) {
      const selectionNodes = selection?.getNodes?.() ?? [];
      setIsInTable(selectionNodes.some(node => Boolean($findTableNode(node))));
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

    const anchorNode = selection.anchor.getNode();
    setIsInTable(Boolean($findTableNode(anchorNode)));
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

  const runOnActiveTableCell = useCallback(
    (action: (tableCell: TableCellNode) => void) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) && !$isNodeSelection(selection) && !$isTableSelection(selection)) {
          return;
        }

        const selectionNodes = selection?.getNodes?.() ?? [];
        const tableCellNode =
          selectionNodes
            .map(node => $getTableCellNodeFromLexicalNode(node))
            .find((cell): cell is TableCellNode => Boolean(cell)) ??
          ('anchor' in selection ? $getTableCellNodeFromLexicalNode(selection.anchor.getNode()) : null);

        if (!tableCellNode) {
          return;
        }

        action(tableCellNode);
      });
    },
    [editor],
  );

  const insertTable = useCallback(
    (rows: number, columns: number, headers: { rows: boolean; columns: boolean }) => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: String(columns),
        rows: String(rows),
        includeHeaders: { rows: headers.rows, columns: headers.columns },
      });
    },
    [editor],
  );

  const insertRowAbove = useCallback(() => {
    runOnActiveTableCell(() => {
      $insertTableRow__EXPERIMENTAL(false);
    });
  }, [runOnActiveTableCell]);

  const insertRowBelow = useCallback(() => {
    runOnActiveTableCell(() => {
      $insertTableRow__EXPERIMENTAL(true);
    });
  }, [runOnActiveTableCell]);

  const insertColumnLeft = useCallback(() => {
    runOnActiveTableCell(() => {
      $insertTableColumn__EXPERIMENTAL(false);
    });
  }, [runOnActiveTableCell]);

  const insertColumnRight = useCallback(() => {
    runOnActiveTableCell(() => {
      $insertTableColumn__EXPERIMENTAL(true);
    });
  }, [runOnActiveTableCell]);

  const deleteRow = useCallback(() => {
    runOnActiveTableCell(() => {
      $deleteTableRow__EXPERIMENTAL();
    });
  }, [runOnActiveTableCell]);

  const deleteColumn = useCallback(() => {
    runOnActiveTableCell(() => {
      $deleteTableColumn__EXPERIMENTAL();
    });
  }, [runOnActiveTableCell]);

  const deleteTable = useCallback(() => {
    runOnActiveTableCell(tableCell => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
      tableNode.remove();
    });
  }, [runOnActiveTableCell]);

  const toggleHeaderRow = useCallback(() => {
    runOnActiveTableCell(tableCell => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
      const rows = tableNode.getChildren<TableRowNode>();

      if (rows.length === 0) {
        return;
      }

      const headerEnabled = rows[0]
        .getChildren<TableCellNode>()
        .every(cell => cell.hasHeaderState(TableCellHeaderStates.ROW));

      rows[0]
        .getChildren<TableCellNode>()
        .forEach(cell => cell.setHeaderStyles(headerEnabled ? cell.getHeaderStyles() & ~TableCellHeaderStates.ROW : cell.getHeaderStyles() | TableCellHeaderStates.ROW));
    });
  }, [runOnActiveTableCell]);

  const toggleHeaderColumn = useCallback(() => {
    runOnActiveTableCell(tableCell => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
      const rows = tableNode.getChildren<TableRowNode>();

      if (rows.length === 0) {
        return;
      }

      const firstColumnCells = rows
        .map(row => row.getChildren<TableCellNode>()[0])
        .filter((cell): cell is TableCellNode => Boolean(cell));

      if (firstColumnCells.length === 0) {
        return;
      }

      const headerEnabled = firstColumnCells.every(cell => cell.hasHeaderState(TableCellHeaderStates.COLUMN));

      firstColumnCells.forEach(cell => {
        const current = cell.getHeaderStyles();
        cell.setHeaderStyles(headerEnabled ? current & ~TableCellHeaderStates.COLUMN : current | TableCellHeaderStates.COLUMN);
      });
    });
  }, [runOnActiveTableCell]);

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

  const tableActionButtons = useMemo<ToolbarButtonConfig[]>(
    () =>
      !isInTable
        ? []
        : [
            {
              id: 'insert-row-above',
              label: 'Insert row above',
              icon: InsertRowAboveIcon,
              group: 'table',
              disabled: readOnly,
              onClick: insertRowAbove,
            },
            {
              id: 'insert-row-below',
              label: 'Insert row below',
              icon: InsertRowBelowIcon,
              group: 'table',
              disabled: readOnly,
              onClick: insertRowBelow,
            },
            {
              id: 'insert-column-left',
              label: 'Insert column left',
              icon: InsertColumnLeftIcon,
              group: 'table',
              disabled: readOnly,
              onClick: insertColumnLeft,
            },
            {
              id: 'insert-column-right',
              label: 'Insert column right',
              icon: InsertColumnRightIcon,
              group: 'table',
              disabled: readOnly,
              onClick: insertColumnRight,
            },
            {
              id: 'toggle-header-row',
              label: 'Toggle header row',
              icon: HeaderRowIcon,
              group: 'table',
              disabled: readOnly,
              onClick: toggleHeaderRow,
            },
            {
              id: 'toggle-header-column',
              label: 'Toggle header column',
              icon: HeaderColumnIcon,
              group: 'table',
              disabled: readOnly,
              onClick: toggleHeaderColumn,
            },
            {
              id: 'delete-row',
              label: 'Delete row',
              icon: DeleteRowIcon,
              group: 'table',
              disabled: readOnly,
              onClick: deleteRow,
            },
            {
              id: 'delete-column',
              label: 'Delete column',
              icon: DeleteColumnIcon,
              group: 'table',
              disabled: readOnly,
              onClick: deleteColumn,
            },
            {
              id: 'delete-table',
              label: 'Delete table',
              icon: DeleteTableIcon,
              group: 'table',
              disabled: readOnly,
              onClick: deleteTable,
            },
          ],
    [
      deleteColumn,
      deleteRow,
      deleteTable,
      insertColumnLeft,
      insertColumnRight,
      insertRowAbove,
      insertRowBelow,
      isInTable,
      readOnly,
      toggleHeaderColumn,
      toggleHeaderRow,
    ],
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
        label: 'Insert table',
        icon: TableIcon,
        group: 'insert',
        disabled: readOnly,
        onClick: () => undefined,
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
      ...tableActionButtons,
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
      insertColumnLeft,
      insertColumnRight,
      insertRowAbove,
      insertRowBelow,
      insertTable,
      isBold,
      isCode,
      isItalic,
      isLink,
      isStrikethrough,
      isUnderline,
      openImagePicker,
      readOnly,
      toggleLink,
      tableActionButtons,
    ],
  );

  useEffect(() => {
    const actionsWithoutTablePicker = toolbarButtons.filter(button => button.id !== 'table');
    onActionsChange(actionsWithoutTablePicker);
  }, [toolbarButtons, onActionsChange]);

  const renderedToolbarElements = useMemo(
    () => {
      const items: (
        | ToolbarButtonConfig
        | { type: 'separator'; id: string }
        | { type: 'table'; id: string; button: ToolbarButtonConfig }
      )[] = [];
      toolbarButtons.forEach((button, index) => {
        const previous = toolbarButtons[index - 1];
        if (previous && previous.group !== button.group) {
          items.push({ type: 'separator', id: `separator-${button.group}-${index}` });
        }
        if (button.id === 'table') {
          items.push({ type: 'table', id: button.id, button });
        } else {
          items.push(button);
        }
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
          'type' in element
            ? element.type === 'separator'
              ? (
                  <div key={element.id} className="mx-1 h-3 w-px bg-border-color" />
                )
              : (
                  <TableInsertButton
                    key={element.id}
                    disabled={element.button.disabled ?? false}
                    onInsert={insertTable}
                  />
                )
            : (
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

      const items: ContextMenuItem[] = [];
      contextActions.forEach((action, index) => {
        const previous = contextActions[index - 1];
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
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode, TableNode, TableRowNode, TableCellNode],
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
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} hasTabHandler={true} />
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

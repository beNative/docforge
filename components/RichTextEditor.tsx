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
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $findTableNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
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
  TableIcon,
  RowAboveIcon,
  RowBelowIcon,
  ColumnLeftIcon,
  ColumnRightIcon,
  DeleteRowIcon,
  DeleteColumnIcon,
  DeleteTableIcon,
  QuoteIcon,
  StrikethroughIcon,
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
  table: 'w-full border-collapse border border-border-color rounded-md overflow-hidden my-6 text-text-main bg-background',
  tableRow: 'even:bg-secondary/40',
  tableCell: 'border border-border-color px-3 py-2 align-top text-sm sm:text-base',
  tableCellHeader: 'bg-secondary font-semibold',
  tableSelection: 'outline outline-2 outline-primary/40 outline-offset-0',
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

const TABLE_GRID_SIZE = 6;
const clampTableDimension = (value: number, fallback = 1) => {
  if (Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  return Math.min(12, Math.max(1, Math.round(value)));
};

const TableSizeSelector: React.FC<{
  anchorRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  hoverSize: { rows: number; columns: number };
  customSize: { rows: number; columns: number };
  onHoverSizeChange: (rows: number, columns: number) => void;
  onCustomSizeChange: (key: 'rows' | 'columns', value: number) => void;
  onSelect: (rows: number, columns: number) => void;
  onClose: () => void;
}> = ({
  anchorRef,
  isOpen,
  hoverSize,
  customSize,
  onHoverSizeChange,
  onCustomSizeChange,
  onSelect,
  onClose,
}) => {
  const [localHover, setLocalHover] = useState(hoverSize);

  useEffect(() => {
    setLocalHover(hoverSize);
  }, [hoverSize]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const rows = Array.from({ length: TABLE_GRID_SIZE }, (_, index) => index + 1);
  const columns = rows;

  return (
    <div
      className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-border-color bg-background shadow-xl z-30"
      role="dialog"
      aria-label="Insert table"
    >
      <div className="px-3 pt-3">
        <p className="text-xs font-semibold text-text-secondary">Choose table size</p>
        <p className="text-[11px] text-text-secondary">Move over the grid and click to insert.</p>
      </div>
      <div className="p-3 pt-2">
        <div className="grid grid-cols-6 gap-1" role="grid" aria-label="Table size selector">
          {rows.map(row =>
            columns.map(column => {
              const isActive = row <= localHover.rows && column <= localHover.columns;
              return (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  aria-label={`${row} by ${column} table`}
                  onMouseEnter={() => {
                    setLocalHover({ rows: row, columns: column });
                    onHoverSizeChange(row, column);
                  }}
                  onFocus={() => {
                    setLocalHover({ rows: row, columns: column });
                    onHoverSizeChange(row, column);
                  }}
                  onClick={() => onSelect(row, column)}
                  className={`h-7 w-7 rounded border ${
                    isActive ? 'border-primary bg-primary/10' : 'border-border-color bg-secondary'
                  } hover:border-primary hover:bg-primary/10 transition-colors`}
                />
              );
            }),
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
          <span>
            {localHover.rows} x {localHover.columns}
          </span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => onSelect(localHover.rows, localHover.columns)}
          >
            Insert selection
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-border-color bg-secondary/40 px-3 py-3">
        <label className="flex items-center gap-1 text-xs text-text-secondary" htmlFor="table-rows-input">
          Rows
          <input
            id="table-rows-input"
            type="number"
            min={1}
            max={12}
            className="w-16 rounded border border-border-color bg-background px-2 py-1 text-sm text-text-main"
            value={customSize.rows}
            onChange={event => onCustomSizeChange('rows', clampTableDimension(Number(event.target.value), 3))}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary" htmlFor="table-columns-input">
          Columns
          <input
            id="table-columns-input"
            type="number"
            min={1}
            max={12}
            className="w-16 rounded border border-border-color bg-background px-2 py-1 text-sm text-text-main"
            value={customSize.columns}
            onChange={event => onCustomSizeChange('columns', clampTableDimension(Number(event.target.value), 3))}
          />
        </label>
        <Button
          type="button"
          className="ml-auto"
          onClick={() => onSelect(customSize.rows, customSize.columns)}
        >
          Insert
        </Button>
      </div>
    </div>
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
  const [isInTable, setIsInTable] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableHoverSize, setTableHoverSize] = useState({ rows: 3, columns: 3 });
  const [customTableSize, setCustomTableSize] = useState({ rows: 3, columns: 3 });
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkDraftUrl, setLinkDraftUrl] = useState('');
  const tableButtonWrapperRef = useRef<HTMLDivElement>(null);
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
    if (!$isRangeSelection(selection)) {
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setIsStrikethrough(false);
      setIsCode(false);
      setIsLink(false);
      setBlockType('paragraph');
      setAlignment('left');
      setIsInTable($isTableSelection(selection));
      return;
    }

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));
    setIsCode(selection.hasFormat('code'));

    const anchorNode = selection.anchor.getNode();
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

    const focusNode = selection.focus.getNode();
    const anchorTable = $findTableNode(anchorNode);
    const focusTable = $findTableNode(focusNode);
    setIsInTable(Boolean(anchorTable ?? focusTable));

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

  const handleTableHoverChange = useCallback((rows: number, columns: number) => {
    setTableHoverSize({ rows, columns });
  }, []);

  const handleCustomTableSizeChange = useCallback((key: 'rows' | 'columns', value: number) => {
    setCustomTableSize(prev => ({ ...prev, [key]: clampTableDimension(value, prev[key]) }));
  }, []);

  const insertTable = useCallback(
    (rows: number, columns: number) => {
      const safeRows = clampTableDimension(rows, 1);
      const safeColumns = clampTableDimension(columns, 1);
      setTableHoverSize({ rows: safeRows, columns: safeColumns });
      setCustomTableSize({ rows: safeRows, columns: safeColumns });
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(safeRows),
        columns: String(safeColumns),
        includeHeaders: { rows: true, columns: true },
      });
      setIsTablePickerOpen(false);
    },
    [editor],
  );

  const toggleTablePicker = useCallback(() => {
    if (readOnly) {
      return;
    }
    setIsTablePickerOpen(prev => !prev);
  }, [readOnly]);

  useEffect(() => {
    if (readOnly) {
      setIsTablePickerOpen(false);
    }
  }, [readOnly]);

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

  const modifyTableRow = useCallback(
    (position: 'above' | 'below') => {
      if (!isInTable) {
        return;
      }
      editor.update(() => {
        try {
          $insertTableRow__EXPERIMENTAL(position === 'below');
        } catch (error) {
          console.error('Unable to insert table row.', error);
        }
      });
    },
    [editor, isInTable],
  );

  const modifyTableColumn = useCallback(
    (position: 'left' | 'right') => {
      if (!isInTable) {
        return;
      }
      editor.update(() => {
        try {
          $insertTableColumn__EXPERIMENTAL(position === 'right');
        } catch (error) {
          console.error('Unable to insert table column.', error);
        }
      });
    },
    [editor, isInTable],
  );

  const deleteTableRow = useCallback(() => {
    if (!isInTable) {
      return;
    }
    editor.update(() => {
      try {
        $deleteTableRow__EXPERIMENTAL();
      } catch (error) {
        console.error('Unable to delete table row.', error);
      }
    });
  }, [editor, isInTable]);

  const deleteTableColumn = useCallback(() => {
    if (!isInTable) {
      return;
    }
    editor.update(() => {
      try {
        $deleteTableColumn__EXPERIMENTAL();
      } catch (error) {
        console.error('Unable to delete table column.', error);
      }
    });
  }, [editor, isInTable]);

  const deleteTable = useCallback(() => {
    if (!isInTable) {
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if (!selection) {
        return;
      }

      const focusNode = selection.focus.getNode();
      const tableNode = $findTableNode(focusNode);
      if (!tableNode) {
        return;
      }

      tableNode.remove();
      const root = $getRoot();
      if (root.getChildrenSize() === 0) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(''));
        root.append(paragraph);
      }
    });
  }, [editor, isInTable]);

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
        id: 'image',
        label: 'Insert Image',
        icon: ToolbarImageIcon,
        group: 'insert',
        disabled: readOnly,
        onClick: openImagePicker,
      },
      {
        id: 'table',
        label: 'Insert Table',
        icon: TableIcon,
        group: 'insert',
        disabled: readOnly,
        onClick: toggleTablePicker,
      },
      {
        id: 'row-above',
        label: 'Insert Row Above',
        icon: RowAboveIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => modifyTableRow('above'),
      },
      {
        id: 'row-below',
        label: 'Insert Row Below',
        icon: RowBelowIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => modifyTableRow('below'),
      },
      {
        id: 'column-left',
        label: 'Insert Column Left',
        icon: ColumnLeftIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => modifyTableColumn('left'),
      },
      {
        id: 'column-right',
        label: 'Insert Column Right',
        icon: ColumnRightIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: () => modifyTableColumn('right'),
      },
      {
        id: 'delete-row',
        label: 'Delete Row',
        icon: DeleteRowIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTableRow,
      },
      {
        id: 'delete-column',
        label: 'Delete Column',
        icon: DeleteColumnIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTableColumn,
      },
      {
        id: 'delete-table',
        label: 'Delete Table',
        icon: DeleteTableIcon,
        group: 'table',
        disabled: readOnly || !isInTable,
        onClick: deleteTable,
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
      isInTable,
      openImagePicker,
      readOnly,
      deleteTable,
      deleteTableColumn,
      deleteTableRow,
      modifyTableColumn,
      modifyTableRow,
      insertTable,
      toggleTablePicker,
      toggleLink,
    ],
  );

  useEffect(() => {
    onActionsChange(toolbarButtons);
  }, [toolbarButtons, onActionsChange]);

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
          ) : element.id === 'table' ? (
            <div key={element.id} ref={tableButtonWrapperRef} className="relative">
              <ToolbarButton {...element} />
              <TableSizeSelector
                anchorRef={tableButtonWrapperRef}
                isOpen={isTablePickerOpen}
                hoverSize={tableHoverSize}
                customSize={customTableSize}
                onHoverSizeChange={handleTableHoverChange}
                onCustomSizeChange={handleCustomTableSizeChange}
                onSelect={insertTable}
                onClose={() => setIsTablePickerOpen(false)}
              />
            </div>
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
          <TablePlugin />
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

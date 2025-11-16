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
} from 'lexical';
import IconButton from './IconButton';
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
  UnderlineIcon,
} from './rich-text/RichTextToolbarIcons';
import { $createImageNode, ImageNode, INSERT_IMAGE_COMMAND, type ImagePayload } from './rich-text/ImageNode';

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
  group: 'history' | 'inline-format' | 'structure' | 'insert' | 'alignment' | 'utility';
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

const RICH_TEXT_THEME = {
  paragraph: 'mb-2 text-sm leading-6 text-text-main',
  heading: {
    h1: 'text-2xl font-semibold text-text-main mb-4',
    h2: 'text-xl font-semibold text-text-main mb-3',
    h3: 'text-lg font-semibold text-text-main mb-2',
  },
  quote: 'border-l-4 border-primary/40 pl-3 text-text-secondary italic mb-3',
  list: {
    nested: {
      listitem: 'ml-4',
    },
    ol: 'list-decimal ml-6 text-sm leading-6 text-text-main',
    ul: 'list-disc ml-6 text-sm leading-6 text-text-main',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'font-mono bg-secondary/80 rounded px-1 py-0.5 text-xs text-text-main',
  },
  link: 'text-primary underline hover:no-underline',
  image: 'my-4 flex justify-center',
};

const Placeholder: React.FC = () => null;

const ToolbarButton: React.FC<ToolbarButtonConfig> = ({ label, icon: Icon, isActive = false, disabled = false, onClick }) => (
  <IconButton
    type="button"
    tooltip={label}
    size="sm"
    variant="ghost"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={isActive}
    aria-label={label}
    className={`text-text-secondary ${
      isActive ? 'bg-primary/15 text-primary hover:text-primary' : 'hover:text-text-main'
    } disabled:opacity-40 disabled:pointer-events-none`}
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

  const toggleLink = useCallback(() => {
    if (readOnly) {
      return;
    }
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = window.prompt('Enter URL');
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
  }, [editor, isLink, readOnly]);

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
        label: isLink ? 'Remove Link' : 'Insert Link',
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
      readOnly,
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
    <div
      className="flex flex-wrap content-center items-center gap-x-1.5 gap-y-1 border-b border-border-color bg-secondary px-3 py-0.5 min-h-[1.75rem] overflow-x-hidden"
    >
      {renderedToolbarElements.map(element =>
        'type' in element ? (
          <div key={element.id} className="mx-1 h-6 w-px bg-border-color/70" />
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
  );
};

const HtmlContentSynchronizer: React.FC<{ html: string; lastAppliedHtmlRef: React.MutableRefObject<string> }> = ({
  html,
  lastAppliedHtmlRef,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const normalizedIncoming = html.trim();

    if (normalizedIncoming === lastAppliedHtmlRef.current) {
      return;
    }

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (!normalizedIncoming) {
        lastAppliedHtmlRef.current = '';
        return;
      }

      const parser = new DOMParser();
      const dom = parser.parseFromString(normalizedIncoming, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom.body);
      nodes.forEach(node => root.append(node));
      lastAppliedHtmlRef.current = normalizedIncoming;
    });
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
        const nodes = $generateNodesFromDOM(editor, dom.body);
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
          const generated = $generateHtmlFromNodes(editor);
          const normalized = generated.trim();
          if (normalized === lastAppliedHtmlRef.current) {
            return;
          }
          lastAppliedHtmlRef.current = normalized;
          onChange(normalized);
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
          throw error;
        },
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode],
        editorState: (editor: LexicalEditor) => {
          const initialHtml = (initialHtmlRef.current ?? '').trim();
          if (!initialHtml) {
            lastAppliedHtmlRef.current = '';
            return;
          }
          const parser = new DOMParser();
          const dom = parser.parseFromString(initialHtml, 'text/html');
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const nodes = $generateNodesFromDOM(editor, dom.body);
            nodes.forEach(node => root.append(node));
            lastAppliedHtmlRef.current = initialHtml;
          });
        },
      }),
      [readOnly],
    );

    useEffect(() => {
      const normalized = html.trim();
      if (normalized !== lastAppliedHtmlRef.current) {
        lastAppliedHtmlRef.current = normalized;
      }
    }, [html]);

    return (
      <div className="h-full w-full bg-secondary" data-component="rich-text-editor">
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
            className={`relative h-full overflow-auto ${readOnly ? 'cursor-not-allowed' : ''}`}
            onScroll={handleScroll}
            onContextMenu={handleContextMenu}
          >
            <div className="relative min-h-full px-6 py-4">
              <RichTextPlugin
                contentEditable={(
                  <ContentEditable
                    className="min-h-[calc(100vh-14rem)] outline-none text-sm leading-6 text-text-main"
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

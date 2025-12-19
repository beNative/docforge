import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $createHeadingNode,
    $createQuoteNode,
    $isHeadingNode,
    HeadingTagType,
} from '@lexical/rich-text';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    REMOVE_LIST_COMMAND,
    $isListNode,
    ListType,
} from '@lexical/list';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
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
    FORMAT_ELEMENT_COMMAND,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND,
    LexicalEditor,
    NodeSelection,
    RangeSelection,
    $createNodeSelection,
    $createRangeSelection,
    $getNodeByKey,
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
    TableCellHeaderStates,
    TableSelection,
} from '@lexical/table';

import IconButton from '../IconButton';
import { RedoIcon, UndoIcon } from '../Icons';
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
} from './RichTextToolbarIcons';
import { ImagePayload, INSERT_IMAGE_COMMAND } from './ImageNode';
import { LinkModal } from './LinkModal';
import { TableModal } from './TableModal';
import { normalizeUrl } from './utils';
import type { ToolbarButtonConfig, BlockType, SelectionSnapshot } from './types';

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

export const ToolbarPlugin: React.FC<{
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

    /*
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
    */

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
                id: 'toggle-header-row',
                label: hasHeaderRow ? 'Remove header row' : 'Add header row',
                icon: TableIcon,
                group: 'table',
                disabled: readOnly || !isInTable,
                onClick: toggleHeaderRow,
            },
        ],
        [
            deleteTable,
            deleteTableColumn,
            deleteTableRow,
            hasHeaderRow,
            insertTableColumn,
            insertTableRow,
            isInTable,
            readOnly,
            toggleHeaderRow,
        ],
    );

    const allButtons = useMemo(() => {
        return [...toolbarButtons];
    }, [toolbarButtons]);

    useEffect(() => {
        onActionsChange(allButtons);
    }, [allButtons, onActionsChange]);

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                className="hidden"
                onChange={handleImageFileChange}
            />
            <LinkModal
                isOpen={isLinkModalOpen}
                initialUrl={linkDraftUrl}
                onSubmit={applyLink}
                onRemove={removeLink}
                onClose={closeLinkModal}
            />
            <TableModal
                isOpen={isTableModalOpen}
                onClose={() => setIsTableModalOpen(false)}
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

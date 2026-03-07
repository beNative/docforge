import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    $isNodeSelection,
    COMMAND_PRIORITY_LOW,
    COPY_COMMAND,
    CUT_COMMAND,
    FORMAT_TEXT_COMMAND,
    PASTE_COMMAND,
    createCommand,
    LexicalCommand,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
    $getTableCellNodeFromLexicalNode,
    $getTableNodeFromLexicalNodeOrThrow,
    $insertTableColumn__EXPERIMENTAL,
    $insertTableRow__EXPERIMENTAL,
    $deleteTableColumn__EXPERIMENTAL,
    $deleteTableRow__EXPERIMENTAL,
    $isTableCellNode,
} from '@lexical/table';
import { $isImageNode } from './ImageNode';
import ContextMenu, { type MenuItem } from '../ContextMenu';

// Custom command for context menu triggers
export const CONTEXT_MENU_COMMAND: LexicalCommand<{ x: number; y: number }> = createCommand('CONTEXT_MENU_COMMAND');

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    items: MenuItem[];
}

interface ContextMenuPluginProps {
    readOnly?: boolean;
    onInsertLink?: () => void;
}

/**
 * Plugin that provides context menu functionality for the rich text editor.
 * Shows different menu items based on the current selection context.
 */
export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({
    readOnly = false,
    onInsertLink,
}) => {
    const [editor] = useLexicalComposerContext();
    const [menuState, setMenuState] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        items: [],
    });
    const containerRef = useRef<HTMLDivElement | null>(null);

    const closeMenu = useCallback(() => {
        setMenuState(prev => ({ ...prev, visible: false }));
    }, []);

    const executeCommand = useCallback(
        (action: () => void) => {
            closeMenu();
            // Small delay to ensure menu closes before action
            requestAnimationFrame(() => {
                editor.focus();
                action();
            });
        },
        [closeMenu, editor],
    );

    const buildTextSelectionMenu = useCallback((): MenuItem[] => {
        const items: MenuItem[] = [];

        if (!readOnly) {
            items.push({
                label: 'Cut',
                shortcut: 'Ctrl+X',
                action: () => executeCommand(() => {
                    document.execCommand('cut');
                }),
            });
        }

        items.push({
            label: 'Copy',
            shortcut: 'Ctrl+C',
            action: () => executeCommand(() => {
                document.execCommand('copy');
            }),
        });

        if (!readOnly) {
            items.push({
                label: 'Paste',
                shortcut: 'Ctrl+V',
                action: () => executeCommand(() => {
                    navigator.clipboard.readText().then(text => {
                        editor.update(() => {
                            const selection = $getSelection();
                            if ($isRangeSelection(selection)) {
                                selection.insertText(text);
                            }
                        });
                    }).catch(() => {
                        // Fallback if clipboard API fails
                        document.execCommand('paste');
                    });
                }),
            });

            items.push({ type: 'separator' });

            items.push({
                label: 'Bold',
                shortcut: 'Ctrl+B',
                action: () => executeCommand(() => {
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
                }),
            });

            items.push({
                label: 'Italic',
                shortcut: 'Ctrl+I',
                action: () => executeCommand(() => {
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
                }),
            });

            items.push({
                label: 'Underline',
                shortcut: 'Ctrl+U',
                action: () => executeCommand(() => {
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
                }),
            });

            items.push({ type: 'separator' });

            items.push({
                label: 'Insert Link',
                shortcut: 'Ctrl+K',
                action: () => executeCommand(() => {
                    if (onInsertLink) {
                        onInsertLink();
                    } else {
                        const url = prompt('Enter URL:');
                        if (url) {
                            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
                        }
                    }
                }),
            });
        }

        return items;
    }, [editor, executeCommand, onInsertLink, readOnly]);

    const buildImageSelectionMenu = useCallback((): MenuItem[] => {
        const items: MenuItem[] = [];

        items.push({
            label: 'Copy Image',
            action: () => executeCommand(() => {
                document.execCommand('copy');
            }),
        });

        if (!readOnly) {
            items.push({
                label: 'Delete Image',
                shortcut: 'Delete',
                action: () => executeCommand(() => {
                    editor.update(() => {
                        const selection = $getSelection();
                        if ($isNodeSelection(selection)) {
                            selection.getNodes().forEach(node => {
                                if ($isImageNode(node)) {
                                    node.remove();
                                }
                            });
                        }
                    });
                }),
            });
        }

        return items;
    }, [editor, executeCommand, readOnly]);

    const buildTableCellMenu = useCallback((): MenuItem[] => {
        if (readOnly) {
            return [
                {
                    label: 'Copy',
                    shortcut: 'Ctrl+C',
                    action: () => executeCommand(() => {
                        document.execCommand('copy');
                    }),
                },
            ];
        }

        return [
            {
                label: 'Cut',
                shortcut: 'Ctrl+X',
                action: () => executeCommand(() => {
                    document.execCommand('cut');
                }),
            },
            {
                label: 'Copy',
                shortcut: 'Ctrl+C',
                action: () => executeCommand(() => {
                    document.execCommand('copy');
                }),
            },
            {
                label: 'Paste',
                shortcut: 'Ctrl+V',
                action: () => executeCommand(() => {
                    navigator.clipboard.readText().then(text => {
                        editor.update(() => {
                            const selection = $getSelection();
                            if ($isRangeSelection(selection)) {
                                selection.insertText(text);
                            }
                        });
                    }).catch(() => {
                        document.execCommand('paste');
                    });
                }),
            },
            { type: 'separator' },
            {
                label: 'Insert Row',
                submenu: [
                    {
                        label: 'Insert Row Above',
                        action: () => executeCommand(() => {
                            editor.update(() => {
                                $insertTableRow__EXPERIMENTAL(false);
                            });
                        }),
                    },
                    {
                        label: 'Insert Row Below',
                        action: () => executeCommand(() => {
                            editor.update(() => {
                                $insertTableRow__EXPERIMENTAL(true);
                            });
                        }),
                    },
                ],
            },
            {
                label: 'Insert Column',
                submenu: [
                    {
                        label: 'Insert Column Left',
                        action: () => executeCommand(() => {
                            editor.update(() => {
                                $insertTableColumn__EXPERIMENTAL(false);
                            });
                        }),
                    },
                    {
                        label: 'Insert Column Right',
                        action: () => executeCommand(() => {
                            editor.update(() => {
                                $insertTableColumn__EXPERIMENTAL(true);
                            });
                        }),
                    },
                ],
            },
            { type: 'separator' },
            {
                label: 'Delete Row',
                action: () => executeCommand(() => {
                    editor.update(() => {
                        $deleteTableRow__EXPERIMENTAL();
                    });
                }),
            },
            {
                label: 'Delete Column',
                action: () => executeCommand(() => {
                    editor.update(() => {
                        $deleteTableColumn__EXPERIMENTAL();
                    });
                }),
            },
            {
                label: 'Delete Table',
                action: () => executeCommand(() => {
                    editor.update(() => {
                        const selection = $getSelection();
                        if (!$isRangeSelection(selection)) return;
                        const anchorNode = selection.anchor.getNode();
                        const tableCell = $getTableCellNodeFromLexicalNode(anchorNode);
                        if (!tableCell) return;
                        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCell);
                        tableNode.remove();
                    });
                }),
            },
        ];
    }, [editor, executeCommand, readOnly]);

    const buildEmptySelectionMenu = useCallback((): MenuItem[] => {
        const items: MenuItem[] = [];

        if (!readOnly) {
            items.push({
                label: 'Paste',
                shortcut: 'Ctrl+V',
                action: () => executeCommand(() => {
                    navigator.clipboard.readText().then(text => {
                        editor.update(() => {
                            const selection = $getSelection();
                            if ($isRangeSelection(selection)) {
                                selection.insertText(text);
                            }
                        });
                    }).catch(() => {
                        document.execCommand('paste');
                    });
                }),
            });

            items.push({ type: 'separator' });
        }

        items.push({
            label: 'Select All',
            shortcut: 'Ctrl+A',
            action: () => executeCommand(() => {
                document.execCommand('selectAll');
            }),
        });

        return items;
    }, [editor, executeCommand, readOnly]);

    const handleContextMenu = useCallback(
        (event: MouseEvent) => {
            // Only handle right-click within the editor
            const target = event.target as HTMLElement;
            const editorRoot = editor.getRootElement();
            if (!editorRoot || !editorRoot.contains(target)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            editor.getEditorState().read(() => {
                const selection = $getSelection();
                let items: MenuItem[] = [];

                // Check if we're in a table cell
                if ($isRangeSelection(selection)) {
                    const anchorNode = selection.anchor.getNode();
                    const tableCell = $getTableCellNodeFromLexicalNode(anchorNode);

                    if (tableCell) {
                        items = buildTableCellMenu();
                    } else if (selection.getTextContent().length > 0) {
                        // Text is selected
                        items = buildTextSelectionMenu();
                    } else {
                        // Empty selection / cursor position
                        items = buildEmptySelectionMenu();
                    }
                } else if ($isNodeSelection(selection)) {
                    // Check if image is selected
                    const nodes = selection.getNodes();
                    const hasImage = nodes.some(node => $isImageNode(node));

                    if (hasImage) {
                        items = buildImageSelectionMenu();
                    } else {
                        items = buildEmptySelectionMenu();
                    }
                } else {
                    items = buildEmptySelectionMenu();
                }

                setMenuState({
                    visible: true,
                    x: event.clientX,
                    y: event.clientY,
                    items,
                });
            });
        },
        [editor, buildEmptySelectionMenu, buildImageSelectionMenu, buildTableCellMenu, buildTextSelectionMenu],
    );

    useEffect(() => {
        const rootElement = editor.getRootElement();
        if (!rootElement) {
            return;
        }

        rootElement.addEventListener('contextmenu', handleContextMenu);

        return () => {
            rootElement.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [editor, handleContextMenu]);

    // Close menu on escape or click outside
    useEffect(() => {
        if (!menuState.visible) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (containerRef.current && !containerRef.current.contains(target)) {
                closeMenu();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuState.visible, closeMenu]);

    if (!menuState.visible || menuState.items.length === 0) {
        return null;
    }

    return (
        <div ref={containerRef}>
            <ContextMenu
                isOpen={menuState.visible}
                position={{ x: menuState.x, y: menuState.y }}
                items={menuState.items}
                onClose={closeMenu}
            />
        </div>
    );
};

export default ContextMenuPlugin;

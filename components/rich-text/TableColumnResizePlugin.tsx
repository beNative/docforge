import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $nodesOfType,
    type LexicalEditor,
    $getNodeByKey,
} from 'lexical';
import {
    TableNode,
    TableRowNode,
    TableCellNode,
} from '@lexical/table';

const MIN_COLUMN_WIDTH = 72;

const ensureColGroupWithWidths = (
    tableElement: HTMLTableElement,
    preferredWidths: number[] = [],
): HTMLTableColElement[] => {
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

    if (preferredWidths.length === columnCount && preferredWidths.some(width => width > 0)) {
        colElements.forEach((col, index) => {
            const width = preferredWidths[index];
            if (Number.isFinite(width) && width > 0) {
                col.style.width = `${Math.max(MIN_COLUMN_WIDTH, width)}px`;
            }
        });
    } else {
        const existingWidths = colElements.map(col => parseFloat(col.style.width || ''));
        const needInitialization = existingWidths.some(width => Number.isNaN(width) || width <= 0);

        if (needInitialization) {
            const columnWidths = Array.from(firstRow.cells).map(cell => cell.getBoundingClientRect().width || MIN_COLUMN_WIDTH);
            colElements.forEach((col, index) => {
                const width = Math.max(MIN_COLUMN_WIDTH, columnWidths[index] ?? MIN_COLUMN_WIDTH);
                col.style.width = `${width}px`;
            });
        }
    }

    return colElements;
};

const getColumnWidthsFromState = (editor: LexicalEditor, tableKey: string): number[] => {
    let widths: number[] = [];

    editor.getEditorState().read(() => {
        const tableNode = $getNodeByKey<TableNode>(tableKey);
        if (!tableNode) {
            return;
        }

        const firstRow = tableNode.getChildren<TableRowNode>()[0];
        if (!firstRow) {
            return;
        }

        widths = firstRow
            .getChildren<TableCellNode>()
            .map(cell => cell.getWidth())
            .filter((width): width is number => Number.isFinite(width));
    });

    return widths;
};

const attachColumnResizeHandles = (
    tableElement: HTMLTableElement,
    editor: LexicalEditor,
    tableKey: string,
): (() => void) => {
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

        const storedColumnWidths = getColumnWidthsFromState(editor, tableKey);
        const cols = ensureColGroupWithWidths(tableElement, storedColumnWidths);
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

                const updatedWidths = cols.map(col => parseFloat(col.style.width || ''));
                editor.update(() => {
                    const tableNode = $getNodeByKey<TableNode>(tableKey);
                    if (!tableNode) {
                        return;
                    }

                    const rows = tableNode.getChildren<TableRowNode>();
                    rows.forEach(row => {
                        const cellsInRow = row.getChildren<TableCellNode>();
                        cellsInRow.forEach((cellNode, cellIndex) => {
                            const width = updatedWidths[cellIndex];
                            if (Number.isFinite(width) && width > 0) {
                                cellNode.setWidth(Math.max(MIN_COLUMN_WIDTH, width));
                            }
                        });
                    });
                });
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

export const TableColumnResizePlugin: React.FC = () => {
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
                cleanupMap.set(tableKey, attachColumnResizeHandles(tableElement, editor, tableKey));
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

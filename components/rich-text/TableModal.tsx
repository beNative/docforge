import React, { useState, useRef, useEffect } from 'react';
import Modal from '../Modal';
import Button from '../Button';

interface TableModalProps {
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
}

export const TableModal: React.FC<TableModalProps> = ({
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
                                                className={`h-8 w-8 rounded border ${isActive ? 'border-primary bg-primary/10' : 'border-border-color bg-secondary-hover'
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

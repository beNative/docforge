import React from 'react';
import type { HeadingTagType } from '@lexical/rich-text';
import type { ListType } from '@lexical/list';

export interface ToolbarButtonConfig {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    group: 'history' | 'inline-format' | 'structure' | 'insert' | 'alignment' | 'utility' | 'table';
    isActive?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

export type BlockType = 'paragraph' | HeadingTagType | ListType | 'quote';

export interface ContextMenuState {
    x: number;
    y: number;
    visible: boolean;
}

export type SelectionSnapshot =
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

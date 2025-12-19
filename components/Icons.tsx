import React from 'react';
import { useIconSet } from '../hooks/useIconSet';
import * as HeroIcons from './iconsets/Heroicons';
import * as LucideIcons from './iconsets/Lucide';
import * as FeatherIcons from './iconsets/Feather';
import * as TablerIcons from './iconsets/Tabler';
import * as MaterialIcons from './iconsets/Material';

export type IconProps = {
    className?: string;
};

const ICON_SETS = {
    heroicons: HeroIcons,
    lucide: LucideIcons,
    feather: FeatherIcons,
    tabler: TablerIcons,
    material: MaterialIcons,
};

type IconName = keyof typeof HeroIcons;

const usePolymorphicIcon = (name: IconName) => {
    const { iconSet } = useIconSet();
    const set = ICON_SETS[iconSet] || HeroIcons;
    // Fallback to HeroIcons if the icon doesn't exist in the selected set
    // This handling is important because strict TS might complain, 
    // and some sets might miss an icon.
    return (set as any)[name] || (HeroIcons as any)[name];
};

/**
 * Helper to create a unified icon component.
 * We rely on the fact that all icon sets export components with the same names.
 */
function createIcon(name: IconName): React.FC<IconProps> {
    const IconComponent: React.FC<IconProps> = (props) => {
        const Icon = usePolymorphicIcon(name);
        if (!Icon) return null;
        return <Icon {...props} />;
    };
    IconComponent.displayName = name;
    return IconComponent;
}

export const GearIcon = createIcon('GearIcon');
export const PlusIcon = createIcon('PlusIcon');
export const MinusIcon = createIcon('MinusIcon');
export const TrashIcon = createIcon('TrashIcon');
export const SparklesIcon = createIcon('SparklesIcon');
export const FileIcon = createIcon('FileIcon');
export const InfoIcon = createIcon('InfoIcon');
export const TerminalIcon = createIcon('TerminalIcon');
export const CodeIcon = createIcon('TerminalIcon'); // Alias
export const DownloadIcon = createIcon('DownloadIcon');
export const ChevronDownIcon = createIcon('ChevronDownIcon');
export const ChevronRightIcon = createIcon('ChevronRightIcon');
export const UndoIcon = createIcon('UndoIcon');
export const RedoIcon = createIcon('RedoIcon');
export const CommandIcon = createIcon('CommandIcon');
export const SunIcon = createIcon('SunIcon');
export const MoonIcon = createIcon('MoonIcon');
export const FolderIcon = createIcon('FolderIcon');
export const FolderOpenIcon = createIcon('FolderOpenIcon');
export const FolderPlusIcon = createIcon('FolderPlusIcon');
export const FolderDownIcon = createIcon('FolderDownIcon');
export const LockClosedIcon = createIcon('LockClosedIcon');
export const LockOpenIcon = createIcon('LockOpenIcon');
export const KeyboardIcon = createIcon('KeyboardIcon');
export const CopyIcon = createIcon('CopyIcon');
export const CheckIcon = createIcon('CheckIcon');
export const SearchIcon = createIcon('SearchIcon');
export const XIcon = createIcon('XIcon');
export const DocumentDuplicateIcon = createIcon('DocumentDuplicateIcon');
export const HistoryIcon = createIcon('HistoryIcon');
export const ArrowLeftIcon = createIcon('ArrowLeftIcon');
export const ArrowUpIcon = createIcon('ArrowUpIcon');
export const ArrowDownIcon = createIcon('ArrowDownIcon');
export const EyeIcon = createIcon('EyeIcon');
export const PencilIcon = createIcon('PencilIcon');
export const RefreshIcon = createIcon('RefreshIcon');
export const LayoutHorizontalIcon = createIcon('LayoutHorizontalIcon');
export const LayoutVerticalIcon = createIcon('LayoutVerticalIcon');
export const MinimizeIcon = createIcon('MinimizeIcon');
export const MaximizeIcon = createIcon('MaximizeIcon');
export const RestoreIcon = createIcon('RestoreIcon');
export const CloseIcon = createIcon('XIcon'); // Alias
export const WarningIcon = createIcon('WarningIcon');
export const DatabaseIcon = createIcon('DatabaseIcon');
export const SaveIcon = createIcon('SaveIcon');
export const ExpandAllIcon = createIcon('ExpandAllIcon');
export const CollapseAllIcon = createIcon('CollapseAllIcon');
export const FormatIcon = createIcon('FormatIcon');

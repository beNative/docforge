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
export const ArrowRightIcon = createIcon('ArrowRightIcon');
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
export const ExternalLinkIcon = createIcon('ExternalLinkIcon');
export const GlobeIcon = createIcon('GlobeIcon');

export const ChatIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
);

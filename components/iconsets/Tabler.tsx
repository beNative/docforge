import React from 'react';

type IconProps = {
  className?: string;
};

const iconProps = (className: string | undefined) => ({
    className: className || 'w-6 h-6',
    viewBox: "0 0 24 24",
    strokeWidth: 2,
    stroke: "currentColor",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
});

export const GearIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
export const PlusIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const TrashIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="4" y1="7" x2="20" y2="7" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
);
export const SparklesIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2" /><path d="M8 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2" /><path d="M12 10a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2" /></svg>
);
export const FileIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg>
);
export const InfoIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12.01" y2="8" /><polyline points="11 12 12 12 12 16 13 16" /></svg>
);
export const TerminalIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 7l5 5l-5 5" /><line x1="12" y1="19" x2="19" y2="19" /></svg>
);
export const DownloadIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><polyline points="7 11 12 16 17 11" /><line x1="12" y1="4" x2="12" y2="16" /></svg>
);
export const ChevronDownIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="6 9 12 15 18 9" /></svg>
);
export const ChevronRightIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="9 6 15 12 9 18" /></svg>
);
export const UndoIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 13l-4 -4l4 -4m-4 4h11a4 4 0 0 1 0 8h-1" /></svg>
);
export const RedoIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 13l4 -4l-4 -4m4 4h-11a4 4 0 0 0 0 8h1" /></svg>
);
export const CommandIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 9a2 2 0 1 1 2 -2v10a2 2 0 1 1 -2 -2h10a2 2 0 1 1 -2 2v-10a2 2 0 1 1 2 2h-10" /></svg>
);
export const SunIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="4" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
);
export const MoonIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" /></svg>
);
export const FolderIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /></svg>
);
export const FolderOpenIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-1.996 9.836a2 2 0 0 1 -1.964 1.5h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2" /></svg>
);
export const FolderPlusIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /><line x1="12" y1="10" x2="12" y2="16" /><line x1="9" y1="13" x2="15" y2="13" /></svg>
);
export const FolderDownIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /><line x1="12" y1="10" x2="12" y2="16" /><polyline points="15 13 12 16 9 13" /></svg>
);
export const KeyboardIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="2" y="6" width="20" height="12" rx="2" /><line x1="6" y1="10" x2="6" y2="10" /><line x1="10" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="14" y2="10" /><line x1="18" y1="10" x2="18" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" /><line x1="6" y1="14" x2="8" y2="14" /><line x1="16" y1="14" x2="18" y2="14" /></svg>
);
export const CopyIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
);
export const CheckIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
);
export const SearchIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="10" cy="10" r="7" /><line x1="21" y1="21" x2="15" y2="15" /></svg>
);
export const XIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const DocumentDuplicateIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 3v4a1 1 0 0 0 1 1h4" /><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z" /><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2" /></svg>
);
export const HistoryIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" /></svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="5" y1="12" x2="19" y2="12" /><line x1="5" y1="12" x2="11" y2="18" /><line x1="5" y1="12" x2="11" y2="6" /></svg>
);

export const ArrowUpIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="18" y1="11" x2="12" y2="5" /><line x1="6" y1="11" x2="12" y2="5" /></svg>
);

export const ArrowDownIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="12" y1="5" x2="12" y2="19" /><line x1="18" y1="13" x2="12" y2="19" /><line x1="6" y1="13" x2="12" y2="19" /></svg>
);

export const EyeIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="12" r="2" /><path d="M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7" /></svg>
);

export const PencilIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" /><line x1="13.5" y1="6.5" x2="17.5" y2="10.5" /></svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
);

export const LayoutHorizontalIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="4" y1="12" x2="20" y2="12" /></svg>
);

export const LayoutVerticalIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
);

export const MinimizeIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const MaximizeIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4h16v16h-16z" /></svg>
);
export const RestoreIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8h10v10h-10z" /><path d="M4 16v-12h12v4" /></svg>
);

export const WarningIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v2m0 4v.01" /><path d="M5.07 19h13.86a2 2 0 0 0 1.73 -3l-6.93 -12a2 2 0 0 0 -3.46 0l-6.93 12a2 2 0 0 0 1.73 3z" /></svg>
);

export const DatabaseIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6a8 3 0 0 0 16 0v-6" />
        <path d="M4 12v6a8 3 0 0 0 16 0v-6" />
    </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
        <circle cx="12" cy="14" r="2" />
        <polyline points="14 4 14 8 8 8 8 4" />
    </svg>
);

export const ExpandAllIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 4l4 0l0 4" /><path d="M14 10l6 -6" /><path d="M8 20l-4 0l0 -4" /><path d="M4 20l6 -6" /><path d="M16 20l4 0l0 -4" /><path d="M14 14l6 6" /><path d="M8 4l-4 0l0 4" /><path d="M4 4l6 6" /></svg>
);
export const CollapseAllIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 14h6v6" /><path d="M4 20l6 -6" /><path d="M20 14h-6v6" /><path d="M14 20l6 -6" /><path d="M4 10h6v-6" /><path d="M4 4l6 6" /><path d="M20 10h-6v-6" /><path d="M14 4l6 6" /></svg>
);
{/* FIX: Add missing FormatIcon to resolve error in Icons.tsx. */}
export const FormatIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...iconProps(className)}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
        <line x1="20" y1="6" x2="9" y2="6" />
        <line x1="20" y1="12" x2="13" y2="12" />
        <line x1="20" y1="18" x2="9" y2="18" />
        <path d="M4 8l4 4l-4 4" />
    </svg>
);

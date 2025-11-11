import React, { useEffect, useRef, useState } from 'react';
import type { DocType, DocumentOrFolder } from '../types';
import Button from './Button';
import { FolderIcon, FileIcon, InfoIcon, PlusIcon, FolderPlusIcon, FolderDownIcon, PencilIcon, SearchIcon, XIcon, CopyIcon } from './Icons';

export interface DocTypeCount {
    type: DocType;
    count: number;
}

export interface LanguageCount {
    label: string;
    count: number;
}

export interface FolderOverviewMetrics {
    directDocumentCount: number;
    directFolderCount: number;
    totalDocumentCount: number;
    totalFolderCount: number;
    totalItemCount: number;
    lastUpdated: string | null;
    recentDocuments: RecentDocumentSummary[];
    docTypeCounts: DocTypeCount[];
    languageCounts: LanguageCount[];
}

export interface RecentDocumentSummary {
    id: string;
    title: string;
    updatedAt: string | null;
    parentPath: string[];
    docType?: DocType;
    languageHint?: string | null;
}

export interface FolderSearchResult extends RecentDocumentSummary {
    searchSnippet?: string | null;
    matchedFields: ('title' | 'body')[];
}

interface FolderOverviewProps {
    folder: DocumentOrFolder;
    metrics: FolderOverviewMetrics;
    onNewDocument: (parentId: string) => void;
    onNewFromClipboard: (parentId: string) => void;
    onNewSubfolder: (parentId: string) => void;
    onImportFiles: (files: FileList, parentId: string) => void;
    onRenameFolderTitle: (folderId: string, title: string) => void;
    onNavigateToNode: (nodeId: string) => void;
    folderSearchTerm: string;
    onFolderSearchTermChange: (value: string) => void;
    searchResults: FolderSearchResult[];
    isSearchLoading: boolean;
}

const formatDateTime = (value: string | null) => {
    if (!value) {
        return 'Unknown';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }
    return date.toLocaleString();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightMatches = (text: string, term: string): React.ReactNode => {
    if (!term.trim()) {
        return text;
    }
    const escaped = escapeRegExp(term.trim());
    const regex = new RegExp(`(${escaped})`, 'ig');
    const parts = text.split(regex);
    return parts.map((part, index) => {
        if (index % 2 === 1) {
            return (
                <span key={index} className="bg-primary/20 text-text-main rounded-sm px-1 py-0.5">
                    {part}
                </span>
            );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
};

const DOC_TYPE_LABELS: Record<DocType, string> = {
    prompt: 'Prompts',
    source_code: 'Source code',
    pdf: 'PDFs',
    image: 'Images',
};

const formatDocTypeLabel = (docType: DocType) => DOC_TYPE_LABELS[docType] ?? docType.replace(/_/g, ' ');

const FolderOverview: React.FC<FolderOverviewProps> = ({
    folder,
    metrics,
    onNewDocument,
    onNewFromClipboard,
    onNewSubfolder,
    onImportFiles,
    onRenameFolderTitle,
    onNavigateToNode,
    folderSearchTerm,
    onFolderSearchTermChange,
    searchResults,
    isSearchLoading,
}) => {
    const {
        directDocumentCount,
        directFolderCount,
        totalDocumentCount,
        totalFolderCount,
        totalItemCount,
        lastUpdated,
        recentDocuments,
        docTypeCounts,
        languageCounts,
    } = metrics;

    const hasChildren = totalItemCount > 0;
    const hasDocTypeSummary = docTypeCounts.some(({ count }) => count > 0);
    const hasLanguageSummary = languageCounts.some(({ count }) => count > 0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const normalizedTitle = folder.title?.trim() ?? '';
    const displayTitle = normalizedTitle.length > 0 ? normalizedTitle : 'Untitled Folder';

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState(displayTitle);

    useEffect(() => {
        setTitleDraft(displayTitle);
        setIsEditingTitle(false);
    }, [folder.id, displayTitle]);

    useEffect(() => {
        if (isEditingTitle) {
            requestAnimationFrame(() => {
                titleInputRef.current?.focus();
                titleInputRef.current?.select();
            });
        }
    }, [isEditingTitle]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            onImportFiles(files, folder.id);
            event.target.value = '';
        }
    };

    const handleSearchChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        onFolderSearchTermChange(event.target.value);
    };

    const handleClearSearch = () => {
        onFolderSearchTermChange('');
    };

    const handleStartEditingTitle = () => {
        setIsEditingTitle(true);
    };

    const handleTitleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        setTitleDraft(event.target.value);
    };

    const handleTitleCancel = () => {
        setTitleDraft(displayTitle);
        setIsEditingTitle(false);
    };

    const commitTitleChange = () => {
        const trimmed = titleDraft.trim();
        if (!trimmed) {
            handleTitleCancel();
            return;
        }
        if (trimmed !== normalizedTitle) {
            onRenameFolderTitle(folder.id, trimmed);
        }
        setIsEditingTitle(false);
    };

    const handleTitleBlur: React.FocusEventHandler<HTMLInputElement> = () => {
        commitTitleChange();
    };

    const handleTitleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitTitleChange();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleTitleCancel();
        }
    };

    const hasSearchTerm = folderSearchTerm.trim().length > 0;

    return (
        <div className="flex h-full flex-col bg-white dark:bg-secondary">
            <div className="flex-1 overflow-auto">
                <div className="px-5 py-3">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color pb-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2 text-text-secondary">
                                <FolderIcon className="h-5 w-5" />
                                <span className="text-[11px] uppercase tracking-wide whitespace-nowrap">Folder overview</span>
                            </div>
                            {isEditingTitle ? (
                                <input
                                    ref={titleInputRef}
                                    value={titleDraft}
                                    onChange={handleTitleChange}
                                    onBlur={handleTitleBlur}
                                    onKeyDown={handleTitleKeyDown}
                                    className="max-w-full rounded-sm border border-border-color bg-transparent px-1 py-1 text-xl font-semibold leading-tight text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    aria-label="Edit folder name"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleStartEditingTitle}
                                    onDoubleClick={handleStartEditingTitle}
                                    className="w-fit max-w-full truncate text-left text-xl font-semibold leading-tight text-text-main focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                                    title={displayTitle}
                                >
                                    {displayTitle}
                                </button>
                            )}
                            <p className="text-xs text-text-secondary">
                                Updated {formatDateTime(lastUpdated ?? folder.updatedAt)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-2.5"
                                onClick={() => onNewFromClipboard(folder.id)}
                            >
                                <CopyIcon className="h-4 w-4" />
                                New from clipboard
                            </Button>
                            <Button
                                type="button"
                                className="gap-1 px-2.5"
                                onClick={() => onNewDocument(folder.id)}
                            >
                                <PlusIcon className="h-4 w-4" />
                                New document
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-2.5"
                                onClick={() => onNewSubfolder(folder.id)}
                            >
                                <FolderPlusIcon className="h-4 w-4" />
                                New subfolder
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-2.5"
                                onClick={handleImportClick}
                            >
                                <FolderDownIcon className="h-4 w-4" />
                                Import files
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-2.5"
                                onClick={handleStartEditingTitle}
                            >
                                <PencilIcon className="h-4 w-4" />
                                Rename
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                                aria-label="Import files into this folder"
                            />
                        </div>
                    </header>

                    <section className="mt-4 flex flex-col gap-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary" htmlFor="folder-search">
                            Search within this folder
                        </label>
                        <div className="relative">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                            <input
                                id="folder-search"
                                type="text"
                                value={folderSearchTerm}
                                onChange={handleSearchChange}
                                placeholder="Filter by title or body content"
                                className="w-full border border-border-color bg-background px-9 py-2 text-xs text-text-main placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {hasSearchTerm && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-text-tertiary transition hover:text-text-main"
                                    aria-label="Clear folder search"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {hasSearchTerm && (
                            <div className="border border-border-color">
                                <div className="flex items-center justify-between gap-3 bg-secondary/40 px-3 py-1.5 text-[11px] uppercase tracking-wide text-text-secondary">
                                    <span>Search results</span>
                                    <span className="text-text-tertiary normal-case">
                                        {isSearchLoading
                                            ? 'Searching…'
                                            : searchResults.length === 1
                                                ? '1 match'
                                                : `${searchResults.length} matches`}
                                    </span>
                                </div>
                                {searchResults.length > 0 ? (
                                    <ul className="divide-y divide-border-color/70">
                                        {searchResults.map((result) => {
                                            const formattedTitle = result.title.trim() || 'Untitled document';
                                            const formattedDate = formatDateTime(result.updatedAt);
                                            const hasPath = result.parentPath.length > 0;
                                            const isUnknownDate = formattedDate === 'Unknown';
                                            return (
                                                <li key={result.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onNavigateToNode(result.id)}
                                                        className="grid w-full gap-x-4 gap-y-1 rounded-sm border border-transparent px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)]"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className="mt-0.5 text-text-secondary">
                                                                <FileIcon className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs text-text-main" title={formattedTitle}>
                                                                    {highlightMatches(formattedTitle, folderSearchTerm)}
                                                                </p>
                                                                {result.searchSnippet && (
                                                                    <p
                                                                        className="mt-0.5 -ml-2 text-[11px] leading-snug text-text-secondary"
                                                                        style={{
                                                                            paddingLeft: '0.75rem',
                                                                            borderLeftWidth: '3px',
                                                                            borderLeftStyle: 'solid',
                                                                            borderLeftColor: 'rgb(var(--color-accent) / 0.45)',
                                                                        }}
                                                                    >
                                                                        {highlightMatches(result.searchSnippet, folderSearchTerm)}
                                                                    </p>
                                                                )}
                                                                {result.matchedFields.length > 0 && (
                                                                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase">
                                                                        {result.matchedFields.map((field) => (
                                                                            <span
                                                                                key={field}
                                                                                className="rounded-sm border border-primary/40 px-1.5 py-0.5 text-primary"
                                                                            >
                                                                                {field === 'title' ? 'Title match' : 'Body match'}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 text-[11px]">
                                                            <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Folder</span>
                                                            <p className="mt-0.5 text-xs text-text-secondary break-words">
                                                                {hasPath ? result.parentPath.join(' / ') : 'Workspace root'}
                                                            </p>
                                                        </div>
                                                        <div className="text-[11px] uppercase tracking-wide text-text-tertiary md:text-right">
                                                            Updated {isUnknownDate ? 'recently' : formattedDate}
                                                        </div>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="m-2 flex items-start gap-2 rounded-sm border border-border-color/70 bg-background px-3 py-2 text-xs text-text-secondary">
                                        <InfoIcon className="mt-0.5 h-4 w-4 text-text-tertiary" />
                                        <span>
                                            {isSearchLoading
                                                ? 'Searching folder contents…'
                                                : (
                                                    <>
                                                        No matches found for &ldquo;{folderSearchTerm}&rdquo;.
                                                    </>
                                                )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="mt-4 border-b border-border-color pb-4 text-xs text-text-main">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Direct documents</span>
                                <span className="text-base font-semibold">{directDocumentCount}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Direct folders</span>
                                <span className="text-base font-semibold">{directFolderCount}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Documents in subtree</span>
                                <span className="text-base font-semibold">{totalDocumentCount}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Folders in subtree</span>
                                <span className="text-base font-semibold">{totalFolderCount}</span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-start gap-2 rounded-sm border border-border-color/70 bg-background px-3 py-2 text-[11px] leading-snug text-text-secondary">
                            <InfoIcon className="mt-0.5 h-4 w-4 text-text-tertiary" />
                            <span>
                                Total items: <span className="font-semibold text-text-main">{totalItemCount}</span>. Includes every document and folder contained within this folder’s hierarchy.
                            </span>
                        </div>
                    </section>

                    <section className="mt-4 border-b border-border-color pb-4">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Contents at a glance</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-text-secondary">Document types</span>
                                {hasDocTypeSummary ? (
                                    <div className="flex flex-wrap gap-1 text-[11px]">
                                        {docTypeCounts.map(({ type, count }) => (
                                            <span
                                                key={type}
                                                className="flex items-center gap-1 border border-primary/40 px-2 py-1 text-[11px] uppercase tracking-wide text-primary"
                                            >
                                                <span>{formatDocTypeLabel(type)}</span>
                                                <span className="text-[10px] font-semibold">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-text-secondary">No documents yet.</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-text-secondary">Languages</span>
                                {hasLanguageSummary ? (
                                    <div className="flex flex-wrap gap-1 text-[11px]">
                                        {languageCounts.map(({ label, count }) => (
                                            <span
                                                key={label.toLowerCase()}
                                                className="flex items-center gap-1 border border-border-color px-2 py-1 text-[11px] uppercase tracking-wide text-text-secondary"
                                            >
                                                <span>{label}</span>
                                                <span className="text-[10px] font-semibold text-text-tertiary">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-text-secondary">No language information yet.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="mt-4">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Recently updated in this folder
                            </h2>
                            {!hasChildren && (
                                <div className="flex items-start gap-2 rounded-sm border border-border-color/70 bg-background px-3 py-2 text-xs text-text-secondary">
                                    <InfoIcon className="mt-0.5 h-4 w-4 text-text-tertiary" />
                                    <span>This folder is empty. Create content to populate these lists.</span>
                                </div>
                            )}
                        </div>
                        {recentDocuments.length > 0 ? (
                            <ul className="mt-3 divide-y divide-border-color/70 border border-border-color">
                                {recentDocuments.map((doc) => {
                                    const formattedTitle = doc.title.trim() || 'Untitled document';
                                    const formattedDate = formatDateTime(doc.updatedAt);
                                    const hasPath = doc.parentPath.length > 0;
                                    const isUnknownDate = formattedDate === 'Unknown';
                                    return (
                                        <li key={doc.id}>
                                            <button
                                                type="button"
                                                onClick={() => onNavigateToNode(doc.id)}
                                                className="grid w-full gap-x-4 gap-y-1 rounded-sm border border-transparent px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)]"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-0.5 text-text-secondary">
                                                        <FileIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs text-text-main" title={formattedTitle}>
                                                            {formattedTitle}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="min-w-0 text-[11px]">
                                                    <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Folder</span>
                                                    <p className="mt-0.5 text-xs text-text-secondary break-words">
                                                        {hasPath ? doc.parentPath.join(' / ') : 'Workspace root'}
                                                    </p>
                                                </div>
                                                <div className="text-[11px] uppercase tracking-wide text-text-tertiary md:text-right">
                                                    Updated {isUnknownDate ? 'recently' : formattedDate}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="mt-3 flex items-start gap-2 rounded-sm border border-border-color/70 bg-background px-3 py-2 text-xs text-text-secondary">
                                <InfoIcon className="mt-0.5 h-4 w-4 text-text-tertiary" />
                                <span>No recent document activity yet.</span>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default FolderOverview;

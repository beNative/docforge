import React, { useRef } from 'react';
import type { DocType, DocumentOrFolder } from '../types';
import Button from './Button';
import { FolderIcon, FileIcon, InfoIcon, PlusIcon, FolderPlusIcon, FolderDownIcon, PencilIcon, SearchIcon, XIcon } from './Icons';

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
    onNewSubfolder: (parentId: string) => void;
    onImportFiles: (files: FileList, parentId: string) => void;
    onRenameFolder: (folderId: string) => void;
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
    onNewSubfolder,
    onImportFiles,
    onRenameFolder,
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

    const hasSearchTerm = folderSearchTerm.trim().length > 0;

    return (
        <div className="flex h-full flex-col bg-background">
            <div className="flex-1 overflow-auto">
                <div className="px-8 py-6">
                    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-color pb-4">
                        <div className="flex flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2 text-text-secondary">
                                <FolderIcon className="h-5 w-5" />
                                <span className="text-xs uppercase tracking-wide">Folder overview</span>
                            </div>
                            <h1 className="text-xl font-semibold leading-tight text-text-main">
                                {folder.title.trim() || 'Untitled Folder'}
                            </h1>
                            <p className="text-xs text-text-secondary">
                                Updated {formatDateTime(lastUpdated ?? folder.updatedAt)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                className="gap-1 px-3"
                                onClick={() => onNewDocument(folder.id)}
                            >
                                <PlusIcon className="h-4 w-4" />
                                New document
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-3"
                                onClick={() => onNewSubfolder(folder.id)}
                            >
                                <FolderPlusIcon className="h-4 w-4" />
                                New subfolder
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-1 px-3"
                                onClick={handleImportClick}
                            >
                                <FolderDownIcon className="h-4 w-4" />
                                Import files
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="gap-1 px-3"
                                onClick={() => onRenameFolder(folder.id)}
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

                    <section className="mt-4 flex flex-col gap-3">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary" htmlFor="folder-search">
                            Search within this folder
                        </label>
                        <div className="relative">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                            <input
                                id="folder-search"
                                type="search"
                                value={folderSearchTerm}
                                onChange={handleSearchChange}
                                placeholder="Filter by title or body content"
                                className="w-full border border-border-color bg-background px-9 py-2 text-sm text-text-main placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
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
                                <div className="flex items-center justify-between gap-4 bg-secondary/40 px-3 py-2 text-[11px] uppercase tracking-wide text-text-secondary">
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
                                                <li key={result.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 text-text-secondary">
                                                            <FileIcon className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-text-main" title={formattedTitle}>
                                                                {highlightMatches(formattedTitle, folderSearchTerm)}
                                                            </p>
                                                            {hasPath && (
                                                                <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
                                                                    {result.parentPath.join(' / ')}
                                                                </p>
                                                            )}
                                                            {result.searchSnippet && (
                                                                <p className="text-xs text-text-secondary">
                                                                    {highlightMatches(result.searchSnippet, folderSearchTerm)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1 text-[11px] uppercase tracking-wide text-text-tertiary sm:items-end">
                                                        <span>Updated {isUnknownDate ? 'recently' : formattedDate}</span>
                                                        {result.matchedFields.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 normal-case">
                                                                {result.matchedFields.map((field) => (
                                                                    <span
                                                                        key={field}
                                                                        className="border border-primary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                                                                    >
                                                                        {field === 'title' ? 'Title match' : 'Body match'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-text-secondary">
                                        <InfoIcon className="h-4 w-4" />
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

                    <section className="mt-6 grid gap-y-3 border-b border-border-color pb-6 text-sm text-text-main sm:grid-cols-2 sm:gap-x-8">
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Direct documents</span>
                            <span className="text-lg font-medium">{directDocumentCount}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Direct folders</span>
                            <span className="text-lg font-medium">{directFolderCount}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Documents in subtree</span>
                            <span className="text-lg font-medium">{totalDocumentCount}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Folders in subtree</span>
                            <span className="text-lg font-medium">{totalFolderCount}</span>
                        </div>
                        <div className="flex flex-col gap-1 sm:col-span-2">
                            <span className="text-[11px] uppercase tracking-wide text-text-tertiary">Total items</span>
                            <span className="text-lg font-medium">{totalItemCount}</span>
                            <span className="text-xs text-text-secondary">
                                Includes every document and folder contained within this folder’s hierarchy.
                            </span>
                        </div>
                    </section>

                    <section className="mt-6 border-b border-border-color pb-6">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Contents at a glance</h2>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-text-secondary">Document types</span>
                                {hasDocTypeSummary ? (
                                    <div className="flex flex-wrap gap-1 text-xs">
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
                                    <p className="text-sm text-text-secondary">No documents yet.</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-text-secondary">Languages</span>
                                {hasLanguageSummary ? (
                                    <div className="flex flex-wrap gap-1 text-xs">
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
                                    <p className="text-sm text-text-secondary">No language information yet.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="mt-6">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                                Recently updated in this folder
                            </h2>
                            {!hasChildren && (
                                <span className="text-xs text-text-secondary">
                                    This folder is empty. Create content to populate these lists.
                                </span>
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
                                        <li key={doc.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 text-text-secondary">
                                                    <FileIcon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-text-main" title={formattedTitle}>
                                                        {formattedTitle}
                                                    </p>
                                                    {hasPath && (
                                                        <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
                                                            {doc.parentPath.join(' / ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                                                Updated {isUnknownDate ? 'recently' : formattedDate}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                                <InfoIcon className="h-4 w-4" />
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

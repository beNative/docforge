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

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-center gap-4 rounded-lg border border-border-color bg-background/80 px-4 py-5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
        </div>
        <div>
            <div className="text-2xl font-semibold text-text-main">{value}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</div>
        </div>
    </div>
);

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
        <div className="flex h-full flex-col overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-5xl px-6 py-10">
                <div className="rounded-xl border border-border-color bg-secondary p-8 shadow-sm">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-primary/10 p-4 text-primary">
                                <FolderIcon className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-text-main">
                                    {folder.title.trim() || 'Untitled Folder'}
                                </h1>
                                <p className="text-sm text-text-secondary">
                                    Last updated {formatDateTime(lastUpdated ?? folder.updatedAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                className="gap-2"
                                onClick={() => onNewDocument(folder.id)}
                            >
                                <PlusIcon className="h-4 w-4" />
                                New document
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-2"
                                onClick={() => onNewSubfolder(folder.id)}
                            >
                                <FolderPlusIcon className="h-4 w-4" />
                                New subfolder
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="gap-2"
                                onClick={handleImportClick}
                            >
                                <FolderDownIcon className="h-4 w-4" />
                                Import files
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => onRenameFolder(folder.id)}
                            >
                                <PencilIcon className="h-4 w-4" />
                                Rename folder
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
                    </div>

                    <div className="mt-6">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary" htmlFor="folder-search">
                            Search within this folder
                        </label>
                        <div className="relative mt-2">
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                            <input
                                id="folder-search"
                                type="search"
                                value={folderSearchTerm}
                                onChange={handleSearchChange}
                                placeholder="Find documents by title or content..."
                                className="w-full rounded-md border border-border-color bg-background px-9 py-2 text-sm text-text-main placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            {hasSearchTerm && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition hover:text-text-main"
                                    aria-label="Clear folder search"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {hasSearchTerm && (
                            <div className="mt-4 rounded-lg border border-border-color bg-background/70 p-6">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Search results</h2>
                                    <span className="text-xs text-text-tertiary">
                                        {isSearchLoading
                                            ? 'Searching…'
                                            : searchResults.length === 1
                                                ? '1 match'
                                                : `${searchResults.length} matches`}
                                    </span>
                                </div>

                                {searchResults.length > 0 ? (
                                    <ul className="mt-4 space-y-3">
                                        {searchResults.map((result) => {
                                            const formattedTitle = result.title.trim() || 'Untitled document';
                                            const formattedDate = formatDateTime(result.updatedAt);
                                            const hasPath = result.parentPath.length > 0;
                                            const isUnknownDate = formattedDate === 'Unknown';
                                            return (
                                                <li
                                                    key={result.id}
                                                    className="rounded-md border border-border-color/80 bg-background px-4 py-3"
                                                >
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                                <FileIcon className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-text-main">
                                                                    {highlightMatches(formattedTitle, folderSearchTerm)}
                                                                </p>
                                                                {hasPath && (
                                                                    <p className="text-xs uppercase tracking-wide text-text-tertiary">
                                                                        {result.parentPath.join(' / ')}
                                                                    </p>
                                                                )}
                                                                {result.searchSnippet && (
                                                                    <p className="mt-2 text-xs text-text-secondary">
                                                                        {highlightMatches(result.searchSnippet, folderSearchTerm)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-start gap-2 sm:items-end">
                                                            <span className="text-xs uppercase tracking-wide text-text-tertiary">
                                                                Updated {isUnknownDate ? 'recently' : formattedDate}
                                                            </span>
                                                            {result.matchedFields.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {result.matchedFields.map((field) => (
                                                                        <span
                                                                            key={field}
                                                                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                                                                        >
                                                                            {field === 'title' ? 'Title match' : 'Body match'}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-border-color/70 bg-background/60 px-4 py-3 text-sm text-text-secondary">
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
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label="Direct documents"
                            value={directDocumentCount}
                            icon={<FileIcon className="h-6 w-6" />}
                        />
                        <StatCard
                            label="Direct folders"
                            value={directFolderCount}
                            icon={<FolderIcon className="h-6 w-6" />}
                        />
                        <StatCard
                            label="Documents in tree"
                            value={totalDocumentCount}
                            icon={<FileIcon className="h-6 w-6" />}
                        />
                        <StatCard
                            label="Folders in tree"
                            value={totalFolderCount}
                            icon={<FolderIcon className="h-6 w-6" />}
                        />
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-border-color bg-background/70 p-6">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Total items</h2>
                            <p className="mt-2 text-2xl font-semibold text-text-main">{totalItemCount}</p>
                            <p className="mt-3 text-sm text-text-secondary">
                                Counting documents ({totalDocumentCount}) and folders ({totalFolderCount}) nested within this folder.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border-color bg-background/70 p-6">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Activity</h2>
                            <p className="mt-2 text-lg text-text-main">
                                Most recent change {formatDateTime(lastUpdated ?? folder.updatedAt)}
                            </p>
                            <p className="mt-3 text-sm text-text-secondary">
                                Includes updates to all documents and subfolders contained here.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 rounded-lg border border-border-color bg-background/70 p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Contents at a glance</h2>
                        <div className="mt-4 grid gap-6 md:grid-cols-2">
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Document types</h3>
                                {hasDocTypeSummary ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {docTypeCounts.map(({ type, count }) => (
                                            <span
                                                key={type}
                                                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary"
                                            >
                                                <span>{formatDocTypeLabel(type)}</span>
                                                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                    {count}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-text-secondary">No documents yet.</p>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Languages</h3>
                                {hasLanguageSummary ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {languageCounts.map(({ label, count }) => (
                                            <span
                                                key={label.toLowerCase()}
                                                className="inline-flex items-center gap-2 rounded-full bg-text-secondary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-text-secondary"
                                            >
                                                <span>{label}</span>
                                                <span className="rounded-full bg-text-secondary/20 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                                    {count}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-text-secondary">No language information yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 rounded-lg border border-border-color bg-background/70 p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                            Recently updated in this folder
                        </h2>
                        {recentDocuments.length > 0 ? (
                            <ul className="mt-4 space-y-3">
                                {recentDocuments.map((doc) => {
                                    const formattedTitle = doc.title.trim() || 'Untitled document';
                                    const formattedDate = formatDateTime(doc.updatedAt);
                                    const hasPath = doc.parentPath.length > 0;
                                    const isUnknownDate = formattedDate === 'Unknown';
                                    return (
                                        <li
                                            key={doc.id}
                                            className="flex flex-col gap-2 rounded-md border border-border-color/80 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <FileIcon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text-main">{formattedTitle}</p>
                                                    {hasPath && (
                                                        <p className="text-xs uppercase tracking-wide text-text-tertiary">
                                                            {doc.parentPath.join(' / ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-sm text-text-secondary sm:text-right">
                                                Updated {isUnknownDate ? 'recently' : formattedDate}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-border-color/70 bg-background/60 px-4 py-3 text-sm text-text-secondary">
                                <InfoIcon className="h-4 w-4" />
                                <span>No recent document activity yet. Updates will appear here as you work.</span>
                            </div>
                        )}
                    </div>

                    {!hasChildren && (
                        <div className="mt-8 flex items-center gap-3 rounded-lg border border-dashed border-border-color/80 bg-background/60 p-6 text-sm text-text-secondary">
                            <InfoIcon className="h-5 w-5 text-text-secondary" />
                            <span>This folder is empty. Create a document or add subfolders to start building content.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FolderOverview;

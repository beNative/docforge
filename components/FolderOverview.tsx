import React, { useRef } from 'react';
import type { DocumentOrFolder } from '../types';
import Button from './Button';
import { FolderIcon, FileIcon, InfoIcon, PlusIcon, FolderPlusIcon, FolderDownIcon, PencilIcon } from './Icons';

export interface FolderOverviewMetrics {
    directDocumentCount: number;
    directFolderCount: number;
    totalDocumentCount: number;
    totalFolderCount: number;
    totalItemCount: number;
    lastUpdated: string | null;
    recentDocuments: RecentDocumentSummary[];
}

export interface RecentDocumentSummary {
    id: string;
    title: string;
    updatedAt: string | null;
    parentPath: string[];
}

interface FolderOverviewProps {
    folder: DocumentOrFolder;
    metrics: FolderOverviewMetrics;
    onNewDocument: (parentId: string) => void;
    onNewSubfolder: (parentId: string) => void;
    onImportFiles: (files: FileList, parentId: string) => void;
    onRenameFolder: (folderId: string) => void;
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
}) => {
    const {
        directDocumentCount,
        directFolderCount,
        totalDocumentCount,
        totalFolderCount,
        totalItemCount,
        lastUpdated,
        recentDocuments,
    } = metrics;

    const hasChildren = totalItemCount > 0;
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

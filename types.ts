import type React from 'react';

// Fix: Add global declaration for window.electronAPI to inform TypeScript of the preload script's additions.
// Added NodeJS.Process augmentation to fix type error in main process.
declare global {
  interface Window {
    electronAPI?: {
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbGet: (sql: string, params?: any[]) => Promise<any>;
      dbRun: (sql: string, params?: any[]) => Promise<{ changes: number; lastInsertRowid: number | bigint; }>;
      dbIsNew: () => Promise<boolean>;
      dbMigrateFromJson: (data: any) => Promise<{ success: boolean, error?: string }>;
      dbDuplicateNodes: (nodeIds: string[]) => Promise<{ success: boolean; error?: string }>;
      dbDeleteVersions: (documentId: number, versionIds: number[]) => Promise<{ success: boolean; error?: string }>;
      dbBackup: () => Promise<{ success: boolean; message?: string; error?: string }>;
      dbIntegrityCheck: () => Promise<{ success: boolean; results?: string; error?: string }>;
      dbVacuum: () => Promise<{ success: boolean; error?: string }>;
      dbGetStats: () => Promise<{ success: boolean; stats?: DatabaseStats; error?: string }>;
      dbGetPath: () => Promise<string>;
      // FIX: Add missing `dbImportFiles` to the electronAPI type definition.
      dbImportFiles: (filesData: {path: string; name: string; content: string}[], targetParentId: string | null) => Promise<{ success: boolean; error?: string }>;
      legacyFileExists: (filename: string) => Promise<boolean>;
      readLegacyFile: (filename: string) => Promise<{ success: boolean, data?: string, error?: string }>;
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      getLogPath: () => Promise<string>;
      updaterSetAllowPrerelease: (allow: boolean) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => () => void;
      quitAndInstallUpdate: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
      saveLog: (defaultFilename: string, content: string) => Promise<{ success: boolean; error?: string }>;
      settingsExport: (content: string) => Promise<{ success: boolean; error?: string }>;
      settingsImport: () => Promise<{ success: boolean; content?: string; error?: string }>;
      readDoc: (filename: string) => Promise<{ success: true; content: string } | { success: false; error: string }>;
    };
  }
  // This is for the Electron main process, to add properties attached by Electron.
  namespace NodeJS {
    interface Process {
      resourcesPath: string;
    }
  }
}

// =================================================================
// Core Database-aligned Types
// =================================================================

export type NodeType = 'folder' | 'document';
export type DocType = 'prompt' | 'source_code';
export type ViewMode = 'edit' | 'preview' | 'split-vertical' | 'split-horizontal';

export interface Node {
  node_id: string;
  parent_id: string | null;
  node_type: NodeType;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Client-side property
  children?: Node[];
  // For documents, this will be attached
  document?: Document;
}

export interface Document {
  document_id: number;
  node_id: string;
  doc_type: DocType;
  language_hint: string | null;
  default_view_mode: ViewMode | null;
  current_version_id: number | null;
  // Client-side property, holds content of current version
  content?: string;
}

export interface ContentStore {
  content_id: number;
  sha256_hex: string;
  text_content: string;
  blob_content: Uint8Array | null;
}

export interface DocVersion {
  version_id: number;
  document_id: number;
  created_at: string;
  content_id: number;
  // Joined property for convenience
  content?: string;
}

// =================================================================
// Legacy Types (for migration & UI compatibility)
// =================================================================

// This is the shape UI components expect. It's an adaptation of the `Node` type.
export interface DocumentOrFolder {
  id: string;
  type: 'document' | 'folder';
  title: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  // Document-specific properties for the UI adapter
  doc_type?: DocType;
  language_hint?: string | null;
  default_view_mode?: ViewMode | null;
}

// Fix: Renamed LegacyPromptVersion to DocumentVersion and aliased it to the new DocVersion type
// to ensure components using the old name continue to work.
export type DocumentVersion = DocVersion & {
  id: string; // To match legacy structure if needed, though DocVersion uses version_id
  documentId: string; // To match legacy structure
};


// =================================================================
// Other Application Types (largely unchanged)
// =================================================================

export interface DocumentTemplate {
  template_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  llmProviderUrl: string;
  llmModelName: string;
  llmProviderName: string;
  apiType: 'ollama' | 'openai' | 'unknown';
  iconSet: 'heroicons' | 'lucide' | 'feather' | 'tabler' | 'material';
  autoSaveLogs: boolean;
  allowPrerelease: boolean;
  uiScale: number;
  customShortcuts: Record<string, string[]>;
  markdownFontSize: number;
  markdownLineHeight: number;
  markdownMaxWidth: number;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface LogMessage {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export type LLMStatus = 'checking' | 'connected' | 'error';

export interface Command {
  id:string;
  name: string;
  keywords?: string;
  action: () => void;
  category: string;
  icon: React.FC<{ className?: string }>;
  shortcut?: string[];
  shortcutString?: string;
}

export interface DiscoveredLLMService {
  id: string;
  name: string;
  modelsUrl: string;
  generateUrl: string;
  apiType: 'ollama' | 'openai';
}

export interface DiscoveredLLMModel {
  id: string;
  name: string;
}

export interface DatabaseStats {
  fileSize: string;
  pageSize: number;
  pageCount: number;
  schemaVersion: number;
  tables: {
    name: string;
    rowCount: number;
    indexes: string[];
  }[];
}
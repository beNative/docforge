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
      dbInsertNodesFromTransfer: (
        payload: DraggedNodeTransfer,
        targetId: string | null,
        position: 'before' | 'after' | 'inside'
      ) => Promise<{ success: boolean; createdNodeIds?: string[]; error?: string }>;
      dbDeleteVersions: (documentId: number, versionIds: number[]) => Promise<{ success: boolean; error?: string }>;
      dbBackup: () => Promise<{ success: boolean; message?: string; error?: string }>;
      dbIntegrityCheck: () => Promise<{ success: boolean; results?: string; error?: string }>;
      dbVacuum: () => Promise<{ success: boolean; error?: string }>;
      dbGetStats: () => Promise<{ success: boolean; stats?: DatabaseStats; error?: string }>;
      dbGetPath: () => Promise<string>;
      dbLoadFromPath: (filePath: string) => Promise<DatabaseLoadResult>;
      dbCreateNew: () => Promise<DatabaseLoadResult>;
      dbSelectAndLoad: () => Promise<DatabaseLoadResult>;
      // FIX: Add missing `dbImportFiles` to the electronAPI type definition.
      dbImportFiles: (
        filesData: { path: string; name: string; content: string }[],
        targetParentId: string | null
      ) => Promise<{ success: boolean; error?: string; createdNodes?: ImportedNodeSummary[] }>;
      readClipboardText: () => Promise<{ success: boolean; text?: string; mimeType?: string | null; error?: string; errorCode?: string }>;
      legacyFileExists: (filename: string) => Promise<boolean>;
      readLegacyFile: (filename: string) => Promise<{ success: boolean, data?: string, error?: string }>;
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      getLogPath: () => Promise<string>;
      renderPlantUML: (
        diagram: string,
        format?: 'svg'
      ) => Promise<{ success: boolean; svg?: string; error?: string; details?: string }>;
      updaterSetAllowPrerelease: (allow: boolean) => void;
      updaterSetAutoCheckEnabled?: (enabled: boolean) => void;
      updaterCheckForUpdates?: () => Promise<ManualUpdateCheckResult>;
      onUpdateAvailable?: (callback: (info: UpdateAvailableInfo) => void) => () => void;
      onUpdateDownloadProgress?: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
      onUpdateDownloaded: (callback: (info: string | UpdateAvailableInfo) => void) => () => void;
      onUpdateError?: (callback: (payload: UpdateErrorPayload | string) => void) => () => void;
      quitAndInstallUpdate: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
      saveLog: (defaultFilename: string, content: string) => Promise<{ success: boolean; error?: string }>;
      settingsExport: (content: string) => Promise<{ success: boolean; error?: string }>;
      settingsImport: () => Promise<{ success: boolean; content?: string; error?: string }>;
      readDoc: (filename: string) => Promise<{ success: true; content: string } | { success: false; error: string }>;
      pythonListEnvironments: () => Promise<PythonEnvironmentConfig[]>;
      pythonDetectInterpreters: () => Promise<PythonInterpreterInfo[]>;
      pythonCreateEnvironment: (options: CreatePythonEnvironmentPayload) => Promise<PythonEnvironmentConfig>;
      pythonUpdateEnvironment: (envId: string, updates: UpdatePythonEnvironmentPayload) => Promise<PythonEnvironmentConfig>;
      pythonDeleteEnvironment: (envId: string) => Promise<{ success: boolean }>;
      pythonGetNodeSettings: (nodeId: string) => Promise<NodePythonSettings>;
      pythonSetNodeSettings: (nodeId: string, envId: string | null, autoDetect: boolean) => Promise<NodePythonSettings>;
      pythonEnsureNodeEnv: (nodeId: string, defaults: PythonEnvironmentDefaults, interpreters?: PythonInterpreterInfo[]) => Promise<PythonEnvironmentConfig>;
      pythonRunScript: (payload: PythonRunRequestPayload) => Promise<PythonExecutionRun>;
      pythonGetRunsForNode: (nodeId: string, limit?: number) => Promise<PythonExecutionRun[]>;
      pythonGetRunLogs: (runId: string) => Promise<PythonExecutionLogEntry[]>;
      pythonGetRun: (runId: string) => Promise<PythonExecutionRun | null>;
      onPythonRunLog: (callback: (payload: { runId: string; entry: PythonExecutionLogEntry }) => void) => () => void;
      onPythonRunStatus: (callback: (payload: { runId: string; status: PythonExecutionStatus }) => void) => () => void;
      scriptGetNodeSettings: (nodeId: string, language: ScriptLanguage) => Promise<NodeScriptSettings>;
      scriptUpdateNodeSettings: (
        nodeId: string,
        language: ScriptLanguage,
        updates: ScriptNodeSettingsUpdate
      ) => Promise<NodeScriptSettings>;
      scriptRun: (payload: ScriptRunRequestPayload) => Promise<ScriptExecutionRun>;
      scriptGetRunsForNode: (
        nodeId: string,
        language: ScriptLanguage,
        limit?: number
      ) => Promise<ScriptExecutionRun[]>;
      scriptGetRunLogs: (runId: string) => Promise<ScriptExecutionLogEntry[]>;
      scriptGetRun: (runId: string) => Promise<ScriptExecutionRun | null>;
      onScriptRunLog: (
        callback: (payload: { language: ScriptLanguage; runId: string; entry: ScriptExecutionLogEntry }) => void
      ) => () => void;
      onScriptRunStatus: (
        callback: (payload: { language: ScriptLanguage; runId: string; status: ScriptExecutionStatus }) => void
      ) => () => void;
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

export interface UpdateAvailableInfo {
  version: string | null;
  releaseName: string | null;
  releaseNotes?: string | null;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface ManualUpdateCheckResult {
  success: boolean;
  updateAvailable?: boolean;
  version?: string | null;
  releaseName?: string | null;
  error?: string;
  details?: string;
}

export interface UpdateErrorPayload {
  message: string;
  details?: string | null;
}

export type NodeType = 'folder' | 'document';
export type DocType = 'prompt' | 'source_code' | 'pdf' | 'image';
export type ClassificationSource = 'auto' | 'user' | 'imported' | 'unknown';

export interface ClassificationSummary {
  languageHint: string | null;
  docType: DocType;
  defaultViewMode: ViewMode | null;
  confidence: number;
  primaryMatch: string;
  fallbackUsed: boolean;
  warnings: string[];
}
export type ViewMode = 'edit' | 'preview' | 'split-vertical' | 'split-horizontal';

export type PreviewMetadata =
  | {
      kind: 'image';
      width: number;
      height: number;
      mimeType?: string | null;
    };

export interface ImportedNodeSummary {
  nodeId: string;
  parentId: string | null;
  docType: DocType;
  languageHint: string | null;
  defaultViewMode: ViewMode | null;
}

export type PythonExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface PythonPackageSpec {
  name: string;
  version?: string;
}

export interface PythonEnvironmentConfig {
  envId: string;
  name: string;
  pythonExecutable: string;
  pythonVersion: string;
  managed: boolean;
  createdAt: string;
  updatedAt: string;
  packages: PythonPackageSpec[];
  environmentVariables: Record<string, string>;
  workingDirectory: string | null;
  description?: string | null;
}

export interface PythonEnvironmentDefaults {
  targetPythonVersion: string;
  basePackages: PythonPackageSpec[];
  environmentVariables: Record<string, string>;
  workingDirectory?: string | null;
}

export interface CreatePythonEnvironmentPayload {
  name: string;
  pythonExecutable: string;
  pythonVersion?: string;
  packages: PythonPackageSpec[];
  environmentVariables: Record<string, string>;
  workingDirectory?: string | null;
  description?: string | null;
  managed?: boolean;
}

export interface UpdatePythonEnvironmentPayload {
  name?: string;
  packages?: PythonPackageSpec[];
  environmentVariables?: Record<string, string>;
  workingDirectory?: string | null;
  description?: string | null;
}

export interface PythonInterpreterInfo {
  path: string;
  version: string;
  displayName: string;
  isDefault: boolean;
}

export interface NodePythonSettings {
  nodeId: string;
  envId: string | null;
  autoDetectEnvironment: boolean;
  lastUsedRunId: string | null;
}

export interface PythonExecutionRun {
  runId: string;
  nodeId: string;
  envId: string | null;
  status: PythonExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface PythonExecutionLogEntry {
  logId: number;
  runId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export type PythonConsoleBehavior = 'in-app' | 'windows-terminal' | 'hidden';

export interface PythonRunRequestPayload {
  nodeId: string;
  code: string;
  environment: PythonEnvironmentConfig;
  consoleTheme: 'light' | 'dark';
  consoleBehavior: PythonConsoleBehavior;
}

export type ScriptLanguage = 'shell' | 'powershell';

export interface ScriptExecutionDefaults {
  environmentVariables: Record<string, string>;
  workingDirectory: string | null;
  executable: string | null;
}

export interface ScriptRunRequestPayload {
  nodeId: string;
  language: ScriptLanguage;
  code: string;
  environmentVariables: Record<string, string>;
  workingDirectory: string | null;
  executable: string | null;
  overrides: Record<string, string>;
}

export type ScriptExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface ScriptExecutionRun {
  runId: string;
  nodeId: string;
  language: ScriptLanguage;
  status: ScriptExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface ScriptExecutionLogEntry {
  runId: string;
  timestamp: string;
  level: 'INFO' | 'ERROR';
  message: string;
}

export interface NodeScriptSettings {
  nodeId: string;
  language: ScriptLanguage;
  environmentVariables: Record<string, string>;
  workingDirectory: string | null;
  executable: string | null;
  lastRunId: string | null;
  updatedAt: string;
}

export interface ScriptNodeSettingsUpdate {
  environmentVariables: Record<string, string>;
  workingDirectory: string | null;
  executable: string | null;
}

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
  pythonSettings?: NodePythonSettings;
}

export interface Document {
  document_id: number;
  node_id: string;
  doc_type: DocType;
  language_hint: string | null;
  default_view_mode: ViewMode | null;
  language_source: ClassificationSource | null;
  doc_type_source: ClassificationSource | null;
  classification_updated_at: string | null;
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
  language_source?: ClassificationSource | null;
  doc_type_source?: ClassificationSource | null;
  classification_updated_at?: string | null;
  searchSnippet?: string;
}

export interface SerializedNodeForTransfer {
  type: NodeType;
  title: string;
  content?: string;
  doc_type?: DocType;
  language_hint?: string | null;
  default_view_mode?: ViewMode | null;
  language_source?: ClassificationSource | null;
  doc_type_source?: ClassificationSource | null;
  classification_updated_at?: string | null;
  children?: SerializedNodeForTransfer[];
}

export interface DraggedNodeTransfer {
  schema: 'docforge/nodes';
  version: 1;
  exportedAt: string;
  nodes: SerializedNodeForTransfer[];
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

export type ThemeMode = 'light' | 'dark';

export type ThemeTone = 'neutral' | 'warm' | 'cool';

export type ThemeContrastPreference = 'normal' | 'high' | 'max';

export type ThemeColorToken =
  | 'background'
  | 'secondary'
  | 'textMain'
  | 'textSecondary'
  | 'accent'
  | 'accentText'
  | 'border';

export type ThemeColorOverrides = Record<ThemeMode, Partial<Record<ThemeColorToken, string>>>;

export interface Settings {
  llmProviderUrl: string;
  llmModelName: string;
  llmProviderName: string;
  apiType: 'ollama' | 'openai' | 'unknown';
  iconSet: 'heroicons' | 'lucide' | 'feather' | 'tabler' | 'material';
  autoSaveLogs: boolean;
  allowPrerelease: boolean;
  autoCheckForUpdates: boolean;
  plantumlRendererMode: 'remote' | 'offline';
  uiScale: number;
  documentTreeIndent: number;
  documentTreeVerticalSpacing: number;
  customShortcuts: Record<string, string[]>;
  markdownFontSize: number;
  markdownLineHeight: number;
  markdownMaxWidth: number;
  markdownHeadingSpacing: number;
  markdownCodeFontSize: number;
  markdownBodyFontFamily: string;
  markdownHeadingFontFamily: string;
  markdownCodeFontFamily: string;
  editorFontFamily: string;
  editorFontSize: number;
  editorActiveLineHighlightColor: string;
  editorActiveLineHighlightColorDark: string;
  markdownCodeBlockBackgroundLight: string;
  markdownCodeBlockBackgroundDark: string;
  markdownContentPadding: number;
  markdownParagraphSpacing: number;
  themeTone: Record<ThemeMode, ThemeTone>;
  themeContrast: ThemeContrastPreference;
  themeColorOverrides: ThemeColorOverrides;
  pythonDefaults: PythonEnvironmentDefaults;
  pythonWorkingDirectory: string | null;
  pythonConsoleTheme: 'light' | 'dark';
  shellDefaults: ScriptExecutionDefaults;
  powershellDefaults: ScriptExecutionDefaults;
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
  monacoCommandId?: string;
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

export interface DatabaseLoadResult {
  success: boolean;
  path?: string;
  created?: boolean;
  message?: string;
  previousPath?: string;
  error?: string;
  canceled?: boolean;
}

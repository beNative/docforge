import type {
  NodeScriptSettings,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptExecutionStatus,
  ScriptLanguage,
  ScriptRunRequestPayload,
} from '../types';

const ensureElectron = () => {
  if (!window.electronAPI) {
    throw new Error('Script execution is only available in the Electron build.');
  }
  return window.electronAPI;
};

export const scriptService = {
  async getNodeSettings(nodeId: string, language: ScriptLanguage): Promise<NodeScriptSettings | null> {
    return ensureElectron().scriptGetNodeSettings(nodeId, language);
  },

  async setNodeSettings(
    nodeId: string,
    language: ScriptLanguage,
    settings: { environmentVariables: Record<string, string>; workingDirectory: string | null }
  ): Promise<NodeScriptSettings> {
    return ensureElectron().scriptSetNodeSettings(nodeId, language, settings);
  },

  async clearNodeSettings(nodeId: string, language: ScriptLanguage): Promise<void> {
    await ensureElectron().scriptClearNodeSettings(nodeId, language);
  },

  async runScript(payload: ScriptRunRequestPayload): Promise<ScriptExecutionRun> {
    return ensureElectron().scriptRun(payload);
  },

  async getRunsForNode(
    nodeId: string,
    language: ScriptLanguage,
    limit = 20
  ): Promise<ScriptExecutionRun[]> {
    return ensureElectron().scriptGetRunsForNode(nodeId, language, limit);
  },

  async getRunLogs(runId: string): Promise<ScriptExecutionLogEntry[]> {
    return ensureElectron().scriptGetRunLogs(runId);
  },

  async getRun(runId: string): Promise<ScriptExecutionRun | null> {
    return ensureElectron().scriptGetRun(runId);
  },

  onRunLog(
    callback: (payload: { runId: string; language: ScriptLanguage; entry: ScriptExecutionLogEntry }) => void
  ): () => void {
    return ensureElectron().onScriptRunLog(callback);
  },

  onRunStatus(
    callback: (payload: { runId: string; language: ScriptLanguage; status: ScriptExecutionStatus }) => void
  ): () => void {
    return ensureElectron().onScriptRunStatus(callback);
  },
};

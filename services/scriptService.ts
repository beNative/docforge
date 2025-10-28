import type {
  NodeScriptSettings,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptExecutionStatus,
  ScriptLanguage,
  ScriptNodeSettingsUpdate,
  ScriptRunRequestPayload,
} from '../types';

const ensureElectron = () => {
  if (!window.electronAPI) {
    throw new Error('Script execution is only available in the Electron build.');
  }
  return window.electronAPI;
};

export const scriptService = {
  async getNodeSettings(nodeId: string, language: ScriptLanguage): Promise<NodeScriptSettings> {
    return ensureElectron().scriptGetNodeSettings(nodeId, language);
  },

  async updateNodeSettings(
    nodeId: string,
    language: ScriptLanguage,
    updates: ScriptNodeSettingsUpdate
  ): Promise<NodeScriptSettings> {
    return ensureElectron().scriptUpdateNodeSettings(nodeId, language, updates);
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
    callback: (payload: { language: ScriptLanguage; runId: string; entry: ScriptExecutionLogEntry }) => void
  ): () => void {
    return ensureElectron().onScriptRunLog(callback);
  },

  onRunStatus(
    callback: (payload: { language: ScriptLanguage; runId: string; status: ScriptExecutionStatus }) => void
  ): () => void {
    return ensureElectron().onScriptRunStatus(callback);
  },
};

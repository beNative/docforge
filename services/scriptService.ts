import type {
  NodeScriptSettings,
  ScriptExecutionBridge,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptExecutionStatus,
  ScriptLanguage,
  ScriptNodeSettingsUpdate,
  ScriptRunRequestPayload,
} from '../types';

const ensureBridge = (): ScriptExecutionBridge => {
  if (window.electronAPI) {
    return window.electronAPI;
  }
  if (window.__DOCFORGE_SCRIPT_PREVIEW__) {
    return window.__DOCFORGE_SCRIPT_PREVIEW__;
  }
  throw new Error('Script execution is only available in the Electron build.');
};

export const scriptService = {
  async getNodeSettings(nodeId: string, language: ScriptLanguage): Promise<NodeScriptSettings> {
    return ensureBridge().scriptGetNodeSettings(nodeId, language);
  },

  async updateNodeSettings(
    nodeId: string,
    language: ScriptLanguage,
    updates: ScriptNodeSettingsUpdate
  ): Promise<NodeScriptSettings> {
    return ensureBridge().scriptUpdateNodeSettings(nodeId, language, updates);
  },

  async runScript(payload: ScriptRunRequestPayload): Promise<ScriptExecutionRun> {
    return ensureBridge().scriptRun(payload);
  },

  async getRunsForNode(
    nodeId: string,
    language: ScriptLanguage,
    limit = 20
  ): Promise<ScriptExecutionRun[]> {
    return ensureBridge().scriptGetRunsForNode(nodeId, language, limit);
  },

  async getRunLogs(runId: string): Promise<ScriptExecutionLogEntry[]> {
    return ensureBridge().scriptGetRunLogs(runId);
  },

  async getRun(runId: string): Promise<ScriptExecutionRun | null> {
    return ensureBridge().scriptGetRun(runId);
  },

  onRunLog(
    callback: (payload: { language: ScriptLanguage; runId: string; entry: ScriptExecutionLogEntry }) => void
  ): () => void {
    return ensureBridge().onScriptRunLog(callback);
  },

  onRunStatus(
    callback: (payload: { language: ScriptLanguage; runId: string; status: ScriptExecutionStatus }) => void
  ): () => void {
    return ensureBridge().onScriptRunStatus(callback);
  },
};

import type {
  PythonEnvironmentConfig,
  PythonInterpreterInfo,
  CreatePythonEnvironmentPayload,
  UpdatePythonEnvironmentPayload,
  NodePythonSettings,
  PythonEnvironmentDefaults,
  PythonRunRequestPayload,
  PythonExecutionRun,
  PythonExecutionLogEntry,
  PythonExecutionStatus,
} from '../types';

const ensureElectron = () => {
  if (!window.electronAPI) {
    throw new Error('Python execution is only available in the Electron build.');
  }
  return window.electronAPI;
};

export const pythonService = {
  async listEnvironments(): Promise<PythonEnvironmentConfig[]> {
    return ensureElectron().pythonListEnvironments();
  },

  async detectInterpreters(): Promise<PythonInterpreterInfo[]> {
    return ensureElectron().pythonDetectInterpreters();
  },

  async createEnvironment(options: CreatePythonEnvironmentPayload): Promise<PythonEnvironmentConfig> {
    return ensureElectron().pythonCreateEnvironment(options);
  },

  async updateEnvironment(envId: string, updates: UpdatePythonEnvironmentPayload): Promise<PythonEnvironmentConfig> {
    return ensureElectron().pythonUpdateEnvironment(envId, updates);
  },

  async deleteEnvironment(envId: string): Promise<void> {
    await ensureElectron().pythonDeleteEnvironment(envId);
  },

  async getNodeSettings(nodeId: string): Promise<NodePythonSettings> {
    return ensureElectron().pythonGetNodeSettings(nodeId);
  },

  async setNodeSettings(nodeId: string, envId: string | null, autoDetect: boolean): Promise<NodePythonSettings> {
    return ensureElectron().pythonSetNodeSettings(nodeId, envId, autoDetect);
  },

  async ensureNodeEnvironment(nodeId: string, defaults: PythonEnvironmentDefaults, interpreters?: PythonInterpreterInfo[]): Promise<PythonEnvironmentConfig> {
    return ensureElectron().pythonEnsureNodeEnv(nodeId, defaults, interpreters);
  },

  async runScript(payload: PythonRunRequestPayload): Promise<PythonExecutionRun> {
    return ensureElectron().pythonRunScript(payload);
  },

  async getRunsForNode(nodeId: string, limit = 20): Promise<PythonExecutionRun[]> {
    return ensureElectron().pythonGetRunsForNode(nodeId, limit);
  },

  async getRunLogs(runId: string): Promise<PythonExecutionLogEntry[]> {
    return ensureElectron().pythonGetRunLogs(runId);
  },

  async getRun(runId: string): Promise<PythonExecutionRun | null> {
    return ensureElectron().pythonGetRun(runId);
  },

  onRunLog(callback: (payload: { runId: string; entry: PythonExecutionLogEntry }) => void): () => void {
    return ensureElectron().onPythonRunLog(callback);
  },

  onRunStatus(callback: (payload: { runId: string; status: PythonExecutionStatus }) => void): () => void {
    return ensureElectron().onPythonRunStatus(callback);
  },
};

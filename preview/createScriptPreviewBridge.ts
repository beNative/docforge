import { v4 as uuidv4 } from 'uuid';
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

interface ListenerMap<T> {
  add(callback: T): void;
  delete(callback: T): void;
  invoke(payload: Parameters<T>[0]): void;
}

const createListenerMap = <T extends (payload: any) => void>(): ListenerMap<T> => {
  const listeners = new Set<T>();
  return {
    add(callback: T) {
      listeners.add(callback);
    },
    delete(callback: T) {
      listeners.delete(callback);
    },
    invoke(payload: Parameters<T>[0]) {
      listeners.forEach((listener) => listener(payload));
    },
  };
};

const keyFor = (nodeId: string, language: ScriptLanguage) => `${nodeId}:${language}`;

const buildDefaultSettings = (nodeId: string, language: ScriptLanguage): NodeScriptSettings => ({
  nodeId,
  language,
  environmentVariables: {},
  workingDirectory: null,
  executable: language === 'powershell' ? 'pwsh' : 'bash',
  lastRunId: null,
  updatedAt: new Date().toISOString(),
});

export const createScriptPreviewBridge = (): ScriptExecutionBridge => {
  const nodeSettings = new Map<string, NodeScriptSettings>();
  const runs = new Map<string, ScriptExecutionRun>();
  const logs = new Map<string, ScriptExecutionLogEntry[]>();
  const logListeners = createListenerMap<(
    payload: { language: ScriptLanguage; runId: string; entry: ScriptExecutionLogEntry }
  ) => void>();
  const statusListeners = createListenerMap<(
    payload: { language: ScriptLanguage; runId: string; status: ScriptExecutionStatus }
  ) => void>();

  const appendLog = (
    language: ScriptLanguage,
    runId: string,
    level: 'INFO' | 'ERROR',
    message: string
  ) => {
    const entry: ScriptExecutionLogEntry = {
      runId,
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    const existing = logs.get(runId) ?? [];
    existing.push(entry);
    logs.set(runId, existing);
    logListeners.invoke({ language, runId, entry });
  };

  const updateRun = (runId: string, update: Partial<ScriptExecutionRun>) => {
    const current = runs.get(runId);
    if (!current) return;
    const next: ScriptExecutionRun = { ...current, ...update };
    runs.set(runId, next);
    return next;
  };

  return {
    async scriptGetNodeSettings(nodeId, language) {
      const key = keyFor(nodeId, language);
      if (!nodeSettings.has(key)) {
        nodeSettings.set(key, buildDefaultSettings(nodeId, language));
      }
      return nodeSettings.get(key)!;
    },

    async scriptUpdateNodeSettings(nodeId, language, updates: ScriptNodeSettingsUpdate) {
      const key = keyFor(nodeId, language);
      const current = nodeSettings.get(key) ?? buildDefaultSettings(nodeId, language);
      const next: NodeScriptSettings = {
        ...current,
        environmentVariables: updates.environmentVariables ?? {},
        workingDirectory: updates.workingDirectory ?? null,
        executable: updates.executable ?? null,
        updatedAt: new Date().toISOString(),
      };
      nodeSettings.set(key, next);
      return next;
    },

    async scriptRun(payload: ScriptRunRequestPayload) {
      const runId = uuidv4();
      const startedAt = new Date().toISOString();
      const running: ScriptExecutionRun = {
        runId,
        nodeId: payload.nodeId,
        language: payload.language,
        mode: payload.mode,
        status: 'running',
        startedAt,
        finishedAt: null,
        exitCode: null,
        errorMessage: null,
        durationMs: null,
      };
      runs.set(runId, running);
      logs.set(runId, []);
      const key = keyFor(payload.nodeId, payload.language);
      const currentSettings = nodeSettings.get(key) ?? buildDefaultSettings(payload.nodeId, payload.language);
      nodeSettings.set(key, { ...currentSettings, lastRunId: runId, updatedAt: startedAt });
      appendLog(
        payload.language,
        runId,
        'INFO',
        payload.mode === 'test' ? 'Starting preview syntax check.' : 'Starting preview execution.'
      );
      statusListeners.invoke({ language: payload.language, runId, status: 'running' });

      setTimeout(() => {
        const finishedAt = new Date().toISOString();
        appendLog(
          payload.language,
          runId,
          'INFO',
          payload.mode === 'test'
            ? 'Preview syntax check completed successfully.'
            : 'Preview execution completed successfully.'
        );
        const updated = updateRun(runId, {
          status: 'succeeded',
          finishedAt,
          exitCode: 0,
          errorMessage: null,
          durationMs: 150,
        });
        if (updated) {
          statusListeners.invoke({ language: payload.language, runId, status: 'succeeded' });
        }
      }, 200);

      return running;
    },

    async scriptGetRunsForNode(nodeId, language, limit = 20) {
      const list = Array.from(runs.values()).filter(
        (run) => run.nodeId === nodeId && run.language === language
      );
      list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      return list.slice(0, limit);
    },

    async scriptGetRunLogs(runId) {
      return [...(logs.get(runId) ?? [])];
    },

    async scriptGetRun(runId) {
      return runs.get(runId) ?? null;
    },

    onScriptRunLog(callback) {
      logListeners.add(callback);
      return () => logListeners.delete(callback);
    },

    onScriptRunStatus(callback) {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
  };
};

export type ScriptPreviewBridge = ReturnType<typeof createScriptPreviewBridge>;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NodePythonSettings,
  PythonEnvironmentConfig,
  PythonEnvironmentDefaults,
  PythonExecutionRun,
  PythonExecutionLogEntry,
  PythonInterpreterInfo,
  PythonConsoleBehavior,
} from '../types';
import Button from './Button';
import { TerminalIcon, RefreshIcon } from './Icons';
import { pythonService } from '../services/pythonService';
import { usePythonEnvironments } from '../hooks/usePythonEnvironments';
import { useLogger } from '../hooks/useLogger';

interface PythonExecutionPanelProps {
  nodeId: string;
  code: string;
  defaults: PythonEnvironmentDefaults;
  consoleTheme: 'light' | 'dark';
}

const AUTO_OPTION_VALUE = '__auto__';

const formatTimestamp = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch {
    return iso;
  }
};

const PythonExecutionPanel: React.FC<PythonExecutionPanelProps> = ({ nodeId, code, defaults, consoleTheme }) => {
  const { addLog } = useLogger();
  const { environments, interpreters, isLoading, isDetecting, refreshEnvironments, refreshInterpreters } = usePythonEnvironments();
  const [settings, setSettings] = useState<NodePythonSettings | null>(null);
  const [runHistory, setRunHistory] = useState<PythonExecutionRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<PythonExecutionLogEntry[]>([]);
  const [isEnsuringEnv, setIsEnsuringEnv] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [ensureError, setEnsureError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [platform, setPlatform] = useState('');
  const [consoleBehavior, setConsoleBehavior] = useState<PythonConsoleBehavior>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('docforge.python.consoleBehavior');
      if (stored === 'in-app' || stored === 'windows-terminal' || stored === 'hidden') {
        return stored;
      }
    }
    return 'in-app';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.electronAPI?.getPlatform) {
      window.electronAPI.getPlatform().then(setPlatform).catch(() => setPlatform(''));
    }
  }, []);

  const isWindows = platform === 'win32';

  const loadSettings = useCallback(async () => {
    try {
      const nodeSettings = await pythonService.getNodeSettings(nodeId);
      setSettings(nodeSettings);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load Python settings for node ${nodeId}: ${message}`);
    }
  }, [nodeId, addLog]);

  const refreshRuns = useCallback(async (selectedId: string | null) => {
    try {
      const runs = await pythonService.getRunsForNode(nodeId, 20);
      setRunHistory(runs);
      if (selectedId) {
        const logs = await pythonService.getRunLogs(selectedId);
        setLogEntries(logs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load Python execution history: ${message}`);
    }
  }, [nodeId, addLog]);

  useEffect(() => {
    loadSettings();
    refreshRuns(null);
  }, [loadSettings, refreshRuns]);

  useEffect(() => {
    if (!selectedRunId) return;
    refreshRuns(selectedRunId);
  }, [selectedRunId, refreshRuns]);

  useEffect(() => {
    const unsubscribeLog = pythonService.onRunLog(({ runId, entry }) => {
      if (runId === selectedRunId) {
        setLogEntries((prev) => [...prev, entry]);
      }
    });
    const unsubscribeStatus = pythonService.onRunStatus(({ runId, status }) => {
      if (runId === selectedRunId && status !== 'running') {
        setIsRunning(false);
        refreshRuns(runId).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          addLog('ERROR', `Failed to refresh run history: ${message}`);
        });
      } else if (status !== 'running') {
        refreshRuns(runId).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          addLog('ERROR', `Failed to refresh run history: ${message}`);
        });
      }
    });
    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
  }, [selectedRunId, refreshRuns, addLog]);

  const selectedEnvId = useMemo(() => {
    if (!settings) return null;
    if (settings.autoDetectEnvironment) return AUTO_OPTION_VALUE;
    return settings.envId ?? null;
  }, [settings]);

  const handleEnvironmentChange = useCallback(async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!settings) return;
    const value = event.target.value;
    try {
      if (value === AUTO_OPTION_VALUE) {
        const updated = await pythonService.setNodeSettings(nodeId, null, true);
        setSettings(updated);
        addLog('INFO', 'Switched to automatic Python environment selection.');
      } else {
        const updated = await pythonService.setNodeSettings(nodeId, value, false);
        setSettings(updated);
        addLog('INFO', `Pinned Python environment ${value} to this document.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to update Python environment for node ${nodeId}: ${message}`);
    }
  }, [settings, nodeId, addLog]);

  const ensureEnvironment = useCallback(async (): Promise<PythonEnvironmentConfig> => {
    setEnsureError(null);
    setIsEnsuringEnv(true);
    try {
      if (settings && !settings.autoDetectEnvironment && settings.envId) {
        const env = environments.find((item) => item.envId === settings.envId);
        if (env) {
          return env;
        }
      }
      let interpreterList: PythonInterpreterInfo[] = interpreters;
      if (!interpreterList.length) {
        interpreterList = await pythonService.detectInterpreters();
      }
      const environment = await pythonService.ensureNodeEnvironment(nodeId, defaults, interpreterList);
      await refreshEnvironments();
      await loadSettings();
      return environment;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEnsureError(message);
      addLog('ERROR', `Failed to prepare Python environment: ${message}`);
      throw error;
    } finally {
      setIsEnsuringEnv(false);
    }
  }, [settings, environments, interpreters, nodeId, defaults, addLog, refreshEnvironments, loadSettings]);

  const handleRun = useCallback(async () => {
    setRunError(null);
    try {
      setIsRunning(true);
      if (!isWindows && consoleBehavior === 'windows-terminal') {
        throw new Error('Windows Terminal execution is only available on Windows.');
      }
      const environment = await ensureEnvironment();
      const run = await pythonService.runScript({ nodeId, code, environment, consoleTheme, consoleBehavior });
      setSelectedRunId(run.runId);
      setLogEntries([]);
      setRunHistory((prev) => [run, ...prev]);
      addLog('INFO', `Python execution started in environment "${environment.name}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      setIsRunning(false);
      addLog('ERROR', `Python execution failed to start: ${message}`);
    }
  }, [ensureEnvironment, nodeId, code, consoleTheme, consoleBehavior, addLog, isWindows]);

  const currentRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runHistory.find((run) => run.runId === selectedRunId) ?? null;
  }, [selectedRunId, runHistory]);

  const environmentOptions = useMemo(() => {
    const options = environments.map((env) => ({ value: env.envId, label: `${env.name} • Python ${env.pythonVersion}` }));
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [environments]);

  return (
    <div className="h-full flex flex-col text-[11px] text-text-main">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border-color/60">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <TerminalIcon className="w-4 h-4" />
          <span>Python Execution</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => { refreshEnvironments(); refreshInterpreters(); }}
            isLoading={isLoading || isDetecting}
          >
            <RefreshIcon className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button onClick={handleRun} isLoading={isRunning || isEnsuringEnv} disabled={!code.trim()}>
            <TerminalIcon className="w-4 h-4 mr-1" /> Run Script
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto pt-3">
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                <span>Virtual Environment</span>
                {isRunning && <span className="text-primary text-[11px] font-semibold normal-case">Running…</span>}
              </div>
              <select
                className="w-full bg-background border border-border-color/60 rounded-md px-3 py-1.5 text-[11px] text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedEnvId ?? AUTO_OPTION_VALUE}
                onChange={handleEnvironmentChange}
              >
                <option value={AUTO_OPTION_VALUE}>Auto-create using defaults (Python {defaults.targetPythonVersion})</option>
                {environmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {ensureError && <p className="text-[10px] text-destructive-text">{ensureError}</p>}
              {runError && <p className="text-[10px] text-destructive-text">{runError}</p>}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide block">Console Display</span>
              <select
                className="w-full bg-background border border-border-color/60 rounded-md px-3 py-1.5 text-[11px] text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                value={consoleBehavior}
                onChange={(event) => {
                  const value = event.target.value as PythonConsoleBehavior;
                  setConsoleBehavior(value);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('docforge.python.consoleBehavior', value);
                  }
                }}
              >
                <option value="in-app">In-app console window</option>
                <option value="hidden">Hidden (no console window)</option>
                <option value="windows-terminal" disabled={!isWindows}>
                  {isWindows ? 'Windows Terminal (interactive)' : 'Windows Terminal (Windows only)'}
                </option>
              </select>
              {!isWindows && consoleBehavior === 'windows-terminal' && (
                <p className="text-[10px] text-destructive-text">
                  Windows Terminal execution is only available on Windows. Please select a different console option.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                <span>Recent Runs</span>
                {runHistory.length > 0 && (
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => { refreshRuns(selectedRunId).catch(() => undefined); }}
                  >
                    Refresh
                  </button>
                )}
              </div>
              {runHistory.length === 0 ? (
                <p className="text-[11px] text-text-secondary">No runs recorded yet.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {runHistory.map((run) => (
                    <button
                      key={run.runId}
                      className={`w-full text-left rounded-md px-3 py-2 text-[11px] transition-colors border ${run.runId === selectedRunId ? 'border-primary bg-primary/10' : 'border-border-color/60 hover:border-primary/60 bg-background/60'}`}
                      onClick={() => setSelectedRunId(run.runId)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text-main">{run.status.toUpperCase()}</span>
                        <span className="text-text-secondary">{formatTimestamp(run.startedAt)}</span>
                      </div>
                      <div className="mt-1 text-text-secondary">
                        Exit Code: {run.exitCode ?? '—'}
                        {run.errorMessage && <span className="ml-2 text-destructive-text">{run.errorMessage}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 min-h-[180px]">
            <div className="flex items-center justify-between text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
              <span>Execution Log</span>
              {currentRun && <span className="text-text-secondary text-[10px]">Run ID: {currentRun.runId.slice(0, 8)}</span>}
            </div>
            <div className="flex-1 overflow-auto rounded-md border border-border-color/60 bg-background/80 p-3 font-mono text-[11px] space-y-1">
              {!currentRun ? (
                <div className="text-text-secondary">Select a run to view its output.</div>
              ) : logEntries.length === 0 ? (
                <div className="text-text-secondary">Waiting for output…</div>
              ) : (
                logEntries.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className={entry.level === 'ERROR' ? 'text-destructive-text' : 'text-text-main'}>
                    [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PythonExecutionPanel;

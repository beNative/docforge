import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NodeScriptSettings,
  ScriptExecutionDefaults,
  ScriptExecutionLogEntry,
  ScriptExecutionMode,
  ScriptExecutionRun,
  ScriptLanguage,
} from '../types';
import Button from './Button';
import { ChevronDownIcon, RefreshIcon, TerminalIcon } from './Icons';
import { scriptService } from '../services/scriptService';
import { useLogger } from '../hooks/useLogger';

interface ScriptExecutionPanelProps {
  nodeId: string;
  code: string;
  language: ScriptLanguage;
  label: string;
  defaults: ScriptExecutionDefaults;
  onCollapseChange?: (collapsed: boolean) => void;
}

const formatTimestamp = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch {
    return iso;
  }
};

const localStorageKeyFor = (language: ScriptLanguage) => `docforge.script.${language}.panelCollapsed`;

const ScriptExecutionPanel: React.FC<ScriptExecutionPanelProps> = ({
  nodeId,
  code,
  language,
  label,
  defaults,
  onCollapseChange,
}) => {
  const { addLog } = useLogger();
  const [settings, setSettings] = useState<NodeScriptSettings | null>(null);
  const [envJson, setEnvJson] = useState<string>('{}');
  const [envError, setEnvError] = useState<string | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [executable, setExecutable] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [runHistory, setRunHistory] = useState<ScriptExecutionRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<ScriptExecutionLogEntry[]>([]);
  const [activeRunMode, setActiveRunMode] = useState<ScriptExecutionMode | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(localStorageKeyFor(language)) === 'true';
  });

  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(localStorageKeyFor(language), isCollapsed ? 'true' : 'false');
  }, [isCollapsed, language]);

  const parseEnvJson = useCallback((): Record<string, string> | null => {
    const trimmed = envJson.trim();
    if (!trimmed) {
      setEnvError(null);
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Environment variables must be a JSON object of key-value pairs.');
      }
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
          throw new Error(`Value for "${key}" must be a string.`);
        }
        if (!key.trim()) {
          throw new Error('Environment variable keys cannot be empty.');
        }
        result[key] = value;
      }
      setEnvError(null);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      setEnvError(message);
      return null;
    }
  }, [envJson]);

  const loadSettings = useCallback(async () => {
    try {
      const nodeSettings = await scriptService.getNodeSettings(nodeId, language);
      setSettings(nodeSettings);
      setEnvJson(JSON.stringify(nodeSettings.environmentVariables ?? {}, null, 2));
      setWorkingDirectory(nodeSettings.workingDirectory ?? defaults.workingDirectory ?? '');
      setExecutable(nodeSettings.executable ?? defaults.executable ?? '');
      setIsConfigDirty(false);
      setEnvError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load ${language} settings for node ${nodeId}: ${message}`);
    }
  }, [nodeId, language, defaults.workingDirectory, defaults.executable, addLog]);

  const refreshRuns = useCallback(async (targetRunId: string | null) => {
    try {
      const runs = await scriptService.getRunsForNode(nodeId, language, 20);
      setRunHistory(runs);
      if (targetRunId) {
        const logs = await scriptService.getRunLogs(targetRunId);
        setLogEntries(logs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load ${language} execution history: ${message}`);
    }
  }, [nodeId, language, addLog]);

  useEffect(() => {
    loadSettings();
    refreshRuns(null);
  }, [loadSettings, refreshRuns]);

  useEffect(() => {
    if (!selectedRunId) return;
    refreshRuns(selectedRunId);
  }, [selectedRunId, refreshRuns]);

  useEffect(() => {
    const unsubscribeLog = scriptService.onRunLog(({ language: eventLanguage, runId, entry }) => {
      if (eventLanguage !== language) return;
      if (runId === selectedRunId) {
        setLogEntries((prev) => [...prev, entry]);
      }
    });
    const unsubscribeStatus = scriptService.onRunStatus(({ language: eventLanguage, runId, status }) => {
      if (eventLanguage !== language) return;
      if (status !== 'running') {
        refreshRuns(runId).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          addLog('ERROR', `Failed to refresh ${language} run history: ${message}`);
        });
        if (runId === selectedRunId) {
          setActiveRunMode(null);
        }
      }
    });
    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
  }, [language, selectedRunId, refreshRuns, addLog]);

  const handleSaveSettings = useCallback(async () => {
    const parsed = parseEnvJson();
    if (!parsed) return;
    setIsSaving(true);
    try {
      const updated = await scriptService.updateNodeSettings(nodeId, language, {
        environmentVariables: parsed,
        workingDirectory: workingDirectory.trim() ? workingDirectory.trim() : null,
        executable: executable.trim() ? executable.trim() : null,
      });
      setSettings(updated);
      setIsConfigDirty(false);
      addLog('INFO', `Saved ${language} execution settings for this document.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to save ${language} settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [parseEnvJson, nodeId, language, workingDirectory, executable, addLog]);

  const handleRun = useCallback(async (mode: ScriptExecutionMode) => {
    const parsed = parseEnvJson();
    if (!parsed) {
      setRunError('Fix environment variable errors before running.');
      return;
    }
    setRunError(null);
    try {
      setActiveRunMode(mode);
      const mergedEnv: Record<string, string> = { ...defaults.environmentVariables, ...parsed };
      const run = await scriptService.runScript({
        nodeId,
        language,
        code,
        environmentVariables: mergedEnv,
        workingDirectory: workingDirectory.trim() ? workingDirectory.trim() : (defaults.workingDirectory ?? null),
        executable: executable.trim() ? executable.trim() : (defaults.executable ?? null),
        overrides: parsed,
        mode,
      });
      setSelectedRunId(run.runId);
      setLogEntries([]);
      setRunHistory((prev) => [run, ...prev]);
      setIsConfigDirty(false);
      addLog('INFO', `${mode === 'test' ? `${label} test` : label} started.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      setActiveRunMode(null);
      addLog('ERROR', `${mode === 'test' ? `${label} test` : label} failed to start: ${message}`);
    }
  }, [parseEnvJson, defaults.environmentVariables, defaults.workingDirectory, defaults.executable, nodeId, language, code, workingDirectory, executable, addLog, label]);

  const currentRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runHistory.find((run) => run.runId === selectedRunId) ?? null;
  }, [selectedRunId, runHistory]);

  useEffect(() => {
    if (!settings?.lastRunId || selectedRunId) return;
    const match = runHistory.find((run) => run.runId === settings.lastRunId);
    if (match) {
      setSelectedRunId(match.runId);
      scriptService.getRunLogs(match.runId).then(setLogEntries).catch(() => undefined);
    }
  }, [settings, runHistory, selectedRunId]);

  const defaultsSummary = useMemo(() => {
    const entries = Object.keys(defaults.environmentVariables || {});
    if (entries.length === 0) return 'None';
    return entries.join(', ');
  }, [defaults.environmentVariables]);

  return (
    <div className={`flex flex-col text-sm text-text-main ${isCollapsed ? '' : 'h-full min-h-0'}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${isCollapsed ? 'py-2' : 'pt-2 pb-3 border-b border-border-color/50'}`}
      >
        <div className="flex items-center gap-2 font-semibold">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-secondary hover:text-text-main hover:bg-border-color transition-colors"
            aria-expanded={!isCollapsed}
            aria-controls={`script-execution-panel-${language}`}
            aria-label={isCollapsed ? `Expand ${label} panel` : `Collapse ${label} panel`}
          >
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
          </button>
          <TerminalIcon className="w-4 h-4" />
          <span>{label}</span>
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => refreshRuns(selectedRunId)}
              className="px-2.5 py-1 text-[11px]"
            >
              <RefreshIcon className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveSettings}
              disabled={isSaving || !isConfigDirty || !!envError}
              isLoading={isSaving}
              className="px-2.5 py-1 text-[11px]"
            >
              Save Config
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleRun('test')}
              isLoading={activeRunMode === 'test'}
              disabled={!code.trim() || !!envError || activeRunMode !== null}
              className="px-2.5 py-1 text-[11px]"
            >
              <TerminalIcon className="w-3.5 h-3.5 mr-1" /> Test Script
            </Button>
            <Button
              onClick={() => handleRun('run')}
              isLoading={activeRunMode === 'run'}
              disabled={!code.trim() || !!envError || activeRunMode !== null}
              className="px-2.5 py-1 text-[11px]"
            >
              <TerminalIcon className="w-3.5 h-3.5 mr-1" /> Run Script
            </Button>
          </div>
        )}
      </div>
      <div
        id={`script-execution-panel-${language}`}
        className={`pt-3 ${isCollapsed ? 'hidden' : 'flex-1 overflow-auto'}`}
        aria-hidden={isCollapsed}
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                <span>Environment Variables</span>
              </div>
              <textarea
                value={envJson}
                onChange={(event) => {
                  setEnvJson(event.target.value);
                  setIsConfigDirty(true);
                }}
                className="w-full h-32 bg-background border border-border-color rounded-md px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              {envError ? (
                <p className="text-[11px] text-destructive-text">{envError}</p>
              ) : (
                <p className="text-[11px] text-text-secondary">Defaults applied first: {defaultsSummary}</p>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide block">Working Directory</span>
              <input
                type="text"
                value={workingDirectory}
                onChange={(event) => {
                  setWorkingDirectory(event.target.value);
                  setIsConfigDirty(true);
                }}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={defaults.workingDirectory ?? ''}
              />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide block">Executable Override</span>
              <input
                type="text"
                value={executable}
                onChange={(event) => {
                  setExecutable(event.target.value);
                  setIsConfigDirty(true);
                }}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={defaults.executable ?? ''}
              />
              <p className="text-[11px] text-text-secondary">
                Leave blank to use the default interpreter for this platform.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                <span>Recent Runs</span>
                {runHistory.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => refreshRuns(selectedRunId)}
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
                        <span className="font-semibold text-text-main">{run.mode.toUpperCase()} • {run.status.toUpperCase()}</span>
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
              {runError && <p className="text-[11px] text-destructive-text">{runError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2 min-h-[180px]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
              <span>Execution Log</span>
              {currentRun && <span className="text-text-secondary">Run ID: {currentRun.runId.slice(0, 8)}</span>}
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

export default ScriptExecutionPanel;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NodeScriptSettings,
  ScriptEnvironmentDefaults,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptLanguage,
} from '../types';
import Button from './Button';
import { ChevronDownIcon, TerminalIcon } from './Icons';
import { useLogger } from '../hooks/useLogger';
import { scriptService } from '../services/scriptService';
import {
  mergeEnvironmentVariables,
  parseEnvironmentJson,
  stringifyEnvironmentJson,
} from '../services/environmentVariables';

interface ScriptExecutionPanelProps {
  nodeId: string;
  language: ScriptLanguage;
  code: string;
  defaults: ScriptEnvironmentDefaults;
  onCollapseChange?: (collapsed: boolean) => void;
}

const LOCAL_STORAGE_PREFIX: Record<ScriptLanguage, string> = {
  shell: 'docforge.shell',
  powershell: 'docforge.powershell',
};

const formatTimestamp = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch {
    return iso ?? '—';
  }
};

const ScriptExecutionPanel: React.FC<ScriptExecutionPanelProps> = ({
  nodeId,
  language,
  code,
  defaults,
  onCollapseChange,
}) => {
  const { addLog } = useLogger();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX[language]}.panelCollapsed`) === 'true';
  });

  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX[language]}.panelCollapsed`,
      isCollapsed ? 'true' : 'false'
    );
  }, [isCollapsed, language]);

  const [nodeSettings, setNodeSettings] = useState<NodeScriptSettings | null>(null);
  const [environmentInput, setEnvironmentInput] = useState(() => stringifyEnvironmentJson({}, true));
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [overrideVariables, setOverrideVariables] = useState<Record<string, string>>({});
  const [workingDirectoryInput, setWorkingDirectoryInput] = useState('');
  const [runHistory, setRunHistory] = useState<ScriptExecutionRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<ScriptExecutionLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const effectiveEnvironment = useMemo(
    () => mergeEnvironmentVariables(defaults.environmentVariables ?? {}, overrideVariables),
    [defaults.environmentVariables, overrideVariables]
  );

  const effectiveWorkingDirectory = useMemo(() => {
    const trimmed = workingDirectoryInput.trim();
    if (trimmed) return trimmed;
    return defaults.workingDirectory ?? null;
  }, [workingDirectoryInput, defaults.workingDirectory]);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await scriptService.getNodeSettings(nodeId, language);
      setNodeSettings(settings);
      const overrides = settings?.environmentVariables ?? {};
      setOverrideVariables(overrides);
      setEnvironmentInput(stringifyEnvironmentJson(overrides, true));
      setWorkingDirectoryInput(settings?.workingDirectory ?? '');
      setEnvironmentError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load ${language} settings: ${message}`);
    }
  }, [nodeId, language, addLog]);

  const refreshRuns = useCallback(async (runId: string | null) => {
    try {
      const runs = await scriptService.getRunsForNode(nodeId, language, 20);
      setRunHistory(runs);
      if (runId) {
        const logs = await scriptService.getRunLogs(runId);
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
    const unsubscribeLog = scriptService.onRunLog(({ runId, language: eventLanguage, entry }) => {
      if (eventLanguage !== language) return;
      if (runId === selectedRunId) {
        setLogEntries((prev) => [...prev, entry]);
      }
    });

    const unsubscribeStatus = scriptService.onRunStatus(({ runId, language: eventLanguage, status }) => {
      if (eventLanguage !== language) return;
      if (runId === selectedRunId && status !== 'running') {
        setIsRunning(false);
        refreshRuns(runId).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          addLog('ERROR', `Failed to refresh ${language} runs: ${message}`);
        });
      } else if (status !== 'running') {
        refreshRuns(runId).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          addLog('ERROR', `Failed to refresh ${language} runs: ${message}`);
        });
      }
    });

    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
  }, [language, selectedRunId, refreshRuns, addLog]);

  const handleEnvironmentInput = (value: string) => {
    setEnvironmentInput(value);
    try {
      const parsed = parseEnvironmentJson(value);
      setOverrideVariables(parsed);
      setEnvironmentError(null);
    } catch (error) {
      setEnvironmentError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      if (environmentError) {
        throw new Error(environmentError);
      }
      const workingDirectory = workingDirectoryInput.trim() || null;
      const updated = await scriptService.setNodeSettings(nodeId, language, {
        environmentVariables: overrideVariables,
        workingDirectory,
      });
      setNodeSettings(updated);
      addLog('INFO', `Saved ${language} script settings for this document.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to save ${language} script settings: ${message}`);
    } finally {
      setIsSavingSettings(false);
    }
  }, [environmentError, workingDirectoryInput, nodeId, language, overrideVariables, addLog]);

  const handleResetSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      await scriptService.clearNodeSettings(nodeId, language);
      setNodeSettings(null);
      setOverrideVariables({});
      setEnvironmentInput(stringifyEnvironmentJson({}, true));
      setWorkingDirectoryInput('');
      setEnvironmentError(null);
      addLog('INFO', `Cleared ${language} overrides for this document.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to reset ${language} settings: ${message}`);
    } finally {
      setIsSavingSettings(false);
    }
  }, [nodeId, language, addLog]);

  const handleRun = useCallback(async () => {
    setRunError(null);
    try {
      if (environmentError) {
        throw new Error(environmentError);
      }
      if (!code.trim()) {
        throw new Error('No script content to execute.');
      }
      setIsRunning(true);
      const run = await scriptService.runScript({
        nodeId,
        language,
        code,
        environmentVariables: effectiveEnvironment,
        workingDirectory: effectiveWorkingDirectory,
      });
      setSelectedRunId(run.runId);
      setLogEntries([]);
      setRunHistory((prev) => [run, ...prev]);
      addLog('INFO', `${language === 'shell' ? 'Shell' : 'PowerShell'} execution started.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      setIsRunning(false);
      addLog('ERROR', `${language} execution failed to start: ${message}`);
    }
  }, [environmentError, code, nodeId, language, effectiveEnvironment, effectiveWorkingDirectory, addLog]);

  const currentRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runHistory.find((run) => run.runId === selectedRunId) ?? null;
  }, [selectedRunId, runHistory]);

  const defaultsPreview = useMemo(() => stringifyEnvironmentJson(defaults.environmentVariables ?? {}, true), [defaults.environmentVariables]);

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
            aria-controls={`script-execution-${language}`}
            aria-label={isCollapsed ? 'Expand execution panel' : 'Collapse execution panel'}
          >
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
          </button>
          <TerminalIcon className="w-4 h-4" />
          <span>{language === 'shell' ? 'Shell' : 'PowerShell'} Execution</span>
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRun}
              isLoading={isRunning}
              disabled={!code.trim() || !!environmentError}
              className="px-2.5 py-1 text-[11px]"
            >
              <TerminalIcon className="w-3.5 h-3.5 mr-1" /> Run Script
            </Button>
          </div>
        )}
      </div>
      <div
        id={`script-execution-${language}`}
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
                className="w-full bg-background border border-border-color/60 rounded-md px-2.5 py-2 text-xs font-mono text-text-main focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
                value={environmentInput}
                onChange={(event) => handleEnvironmentInput(event.target.value)}
                aria-invalid={environmentError ? 'true' : 'false'}
              />
              {environmentError ? (
                <p className="text-[11px] text-destructive-text">{environmentError}</p>
              ) : (
                <p className="text-[11px] text-text-secondary">Defaults merged from settings:</p>
              )}
              {!environmentError && (
                <pre className="bg-background border border-border-color/40 rounded-md px-2 py-1 text-[10px] text-text-secondary whitespace-pre-wrap overflow-x-auto">
                  {defaultsPreview || '{}'}
                </pre>
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveSettings}
                  isLoading={isSavingSettings}
                  className="px-2.5 py-1 text-[11px]"
                  disabled={!!environmentError}
                  variant="secondary"
                >
                  Save Overrides
                </Button>
                <Button
                  onClick={handleResetSettings}
                  isLoading={isSavingSettings}
                  className="px-2.5 py-1 text-[11px]"
                  variant="ghost"
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Working Directory</span>
              <input
                type="text"
                className="w-full bg-background border border-border-color/60 rounded-md px-2.5 py-1 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                value={workingDirectoryInput}
                placeholder={defaults.workingDirectory ?? 'Inherited from settings'}
                onChange={(event) => setWorkingDirectoryInput(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                <span>Recent Runs</span>
                {runHistory.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
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
            {runError && <p className="text-[11px] text-destructive-text">{runError}</p>}
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
                logEntries.map((entry) => (
                  <div key={`${entry.logId}-${entry.timestamp}`} className={entry.level === 'ERROR' ? 'text-destructive-text' : 'text-text-main'}>
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

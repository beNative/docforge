import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PythonExecutionLogEntry, PythonExecutionRun, PythonExecutionStatus } from '../types';
import { pythonService } from '../services/pythonService';
import Spinner from './Spinner';

interface PythonConsoleAppProps {
  runId: string;
  theme: 'light' | 'dark';
}

const statusLabels: Record<PythonExecutionStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  canceled: 'Canceled',
};

const statusColors: Record<PythonExecutionStatus, string> = {
  pending: 'text-blue-400',
  running: 'text-blue-400',
  succeeded: 'text-emerald-400',
  failed: 'text-red-400',
  canceled: 'text-yellow-400',
};

const PythonConsoleApp: React.FC<PythonConsoleAppProps> = ({ runId, theme }) => {
  const [run, setRun] = useState<PythonExecutionRun | null>(null);
  const [logs, setLogs] = useState<PythonExecutionLogEntry[]>([]);
  const [environmentName, setEnvironmentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<PythonExecutionStatus>('running');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'bg-[#0f0f0f]' : 'bg-white';
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      try {
        const runInfo = await pythonService.getRun(runId);
        if (!runInfo) {
          setError('Execution not found.');
          setIsLoading(false);
          return;
        }
        setRun(runInfo);
        setStatus(runInfo.status);
        const [logEntries, envs] = await Promise.all([
          pythonService.getRunLogs(runId),
          pythonService.listEnvironments(),
        ]);
        setLogs(logEntries);
        if (runInfo.envId) {
          const env = envs.find((item) => item.envId === runInfo.envId);
          if (env) {
            setEnvironmentName(env.name);
          }
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };
    load();
    const unsubscribeLog = pythonService.onRunLog(({ runId: incomingId, entry }) => {
      if (incomingId === runId) {
        setLogs((prev) => [...prev, entry]);
      }
    });
    const unsubscribeStatus = pythonService.onRunStatus(({ runId: incomingId, status: incomingStatus }) => {
      if (incomingId === runId) {
        setStatus(incomingStatus);
        pythonService.getRun(runId).then((info) => {
          if (info) {
            setRun(info);
          }
        });
      }
    });
    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
  }, [runId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const themeClasses = useMemo(() => {
    return theme === 'dark'
      ? 'bg-[#0f0f0f] text-gray-100 border-gray-700'
      : 'bg-white text-gray-900 border-gray-200';
  }, [theme]);

  if (isLoading) {
    return (
      <div className={`w-screen h-screen flex items-center justify-center ${themeClasses}`}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-screen h-screen flex items-center justify-center ${themeClasses}`}>
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Python Console</p>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-screen h-screen flex flex-col ${themeClasses} font-mono text-sm`}>
      <header className="px-6 py-4 border-b border-border-color/40">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-secondary">Run ID</span>
          <span className="text-lg font-semibold text-text-main">{run?.runId}</span>
          {environmentName && <span className="text-xs text-text-secondary">Environment: {environmentName}</span>}
          {run?.startedAt && (
            <span className="text-xs text-text-secondary">Started: {new Date(run.startedAt).toLocaleString()}</span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className={`text-sm font-semibold ${statusColors[status]}`}>{statusLabels[status]}</span>
          {run?.exitCode !== null && <span className="text-xs text-text-secondary">Exit code: {run.exitCode}</span>}
          {run?.durationMs !== null && <span className="text-xs text-text-secondary">Duration: {(run.durationMs / 1000).toFixed(2)}s</span>}
        </div>
        {run?.errorMessage && <p className="mt-2 text-xs text-red-400">{run.errorMessage}</p>}
      </header>
      <main ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {logs.length === 0 ? (
          <p className="text-xs text-text-secondary">No output yet.</p>
        ) : (
          logs.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className={entry.level === 'ERROR' ? 'text-red-400' : 'text-text-main'}>
              <span className="text-text-secondary mr-2">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
              {entry.message}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default PythonConsoleApp;

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import { promises as fsPromises } from 'fs';
import log from 'electron-log/main';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import type {
  NodeScriptSettings,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptExecutionStatus,
  ScriptLanguage,
  ScriptRunRequestPayload,
} from '../types';

const scriptEvents = new EventEmitter();

const createTempScript = async (language: ScriptLanguage, code: string): Promise<{ dir: string; file: string }> => {
  const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'docforge-script-'));
  const extension = language === 'powershell' ? '.ps1' : '.sh';
  const file = path.join(dir, `script${extension}`);
  await fsPromises.writeFile(file, code, 'utf-8');
  if (language === 'shell' && process.platform !== 'win32') {
    await fsPromises.chmod(file, 0o700);
  }
  return { dir, file };
};

const resolveExecutionCommand = (
  language: ScriptLanguage,
  scriptPath: string
): { command: string; args: string[] } => {
  if (language === 'shell') {
    if (process.platform === 'win32') {
      return { command: 'bash', args: [scriptPath] };
    }
    const command = process.env.SHELL && process.env.SHELL.trim().length > 0 ? process.env.SHELL : '/bin/sh';
    return { command, args: [scriptPath] };
  }

  if (process.platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    };
  }

  return {
    command: 'pwsh',
    args: ['-NoLogo', '-NoProfile', '-File', scriptPath],
  };
};

const buildEnvironment = (variables: Record<string, string>): NodeJS.ProcessEnv => ({
  ...process.env,
  ...variables,
});

const appendRunLog = (
  runId: string,
  language: ScriptLanguage,
  level: 'INFO' | 'ERROR',
  message: string
) => {
  const timestamp = new Date().toISOString();
  const result = databaseService.run(
    `INSERT INTO script_execution_logs (run_id, timestamp, level, message) VALUES (?, ?, ?, ?)`
  , [runId, timestamp, level, message]);
  const logEntry: ScriptExecutionLogEntry = {
    logId: Number(result.lastInsertRowid ?? 0),
    runId,
    timestamp,
    level,
    message,
  };
  scriptEvents.emit('run-log', { runId, language, entry: logEntry });
};

const updateRunStatus = (
  runId: string,
  language: ScriptLanguage,
  status: ScriptExecutionStatus,
  updates: Partial<Omit<ScriptExecutionRun, 'runId' | 'language' | 'status' | 'environmentVariables'>> = {}
) => {
  const fields: string[] = ['status = ?'];
  const params: any[] = [status];

  if (updates.startedAt !== undefined) {
    fields.push('started_at = ?');
    params.push(updates.startedAt);
  }
  if (updates.finishedAt !== undefined) {
    fields.push('finished_at = ?');
    params.push(updates.finishedAt);
  }
  if (updates.exitCode !== undefined) {
    fields.push('exit_code = ?');
    params.push(updates.exitCode);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    params.push(updates.errorMessage);
  }
  if (updates.durationMs !== undefined) {
    fields.push('duration_ms = ?');
    params.push(updates.durationMs);
  }
  if (updates.workingDirectory !== undefined) {
    fields.push('working_directory = ?');
    params.push(updates.workingDirectory);
  }
  if (updates.environmentVariables !== undefined) {
    fields.push('environment_json = ?');
    params.push(JSON.stringify(updates.environmentVariables));
  }

  params.push(runId);

  databaseService.run(`UPDATE script_execution_runs SET ${fields.join(', ')} WHERE run_id = ?`, params);
  scriptEvents.emit('run-status', { runId, language, status });
};

const cleanupTempDir = async (dir: string) => {
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    log.warn('Failed to clean up temporary script directory:', error);
  }
};

const mapRunRow = (row: any): ScriptExecutionRun => {
  const envJson = typeof row.environment_json === 'string' ? row.environment_json : '{}';
  let envVars: Record<string, string> = {};
  try {
    envVars = JSON.parse(envJson) ?? {};
  } catch {
    envVars = {};
  }

  return {
    runId: row.run_id,
    nodeId: row.node_id,
    language: row.language as ScriptLanguage,
    status: row.status as ScriptExecutionStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    exitCode: row.exit_code ?? null,
    errorMessage: row.error_message ?? null,
    durationMs: row.duration_ms ?? null,
    environmentVariables: envVars,
    workingDirectory: row.working_directory ?? null,
  };
};

export const scriptRunner = {
  events: scriptEvents,

  async runScript(payload: ScriptRunRequestPayload): Promise<ScriptExecutionRun> {
    const { nodeId, language, code, environmentVariables, workingDirectory } = payload;
    const runId = uuidv4();
    const startedAt = new Date().toISOString();

    databaseService.run(
      `INSERT INTO script_execution_runs (run_id, node_id, language, status, started_at, environment_json, working_directory)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [runId, nodeId, language, 'running', startedAt, JSON.stringify(environmentVariables ?? {}), workingDirectory ?? null]);

    appendRunLog(runId, language, 'INFO', `Starting ${language === 'shell' ? 'shell' : 'PowerShell'} script execution.`);

    const { dir, file } = await createTempScript(language, code);
    const { command, args } = resolveExecutionCommand(language, file);
    const env = buildEnvironment(environmentVariables ?? {});

    const run: ScriptExecutionRun = {
      runId,
      nodeId,
      language,
      status: 'running',
      startedAt,
      finishedAt: null,
      exitCode: null,
      errorMessage: null,
      durationMs: null,
      environmentVariables: environmentVariables ?? {},
      workingDirectory: workingDirectory ?? null,
    };

    const startTime = Date.now();

    const finalize = async (
      status: ScriptExecutionStatus,
      exitCode: number | null,
      errorMessage?: string
    ) => {
      const finishedAt = new Date().toISOString();
      if (status === 'succeeded') {
        appendRunLog(runId, language, 'INFO', 'Execution completed successfully.');
      } else if (errorMessage) {
        appendRunLog(runId, language, 'ERROR', errorMessage);
      }
      updateRunStatus(runId, language, status, {
        finishedAt,
        exitCode: exitCode ?? undefined,
        errorMessage: errorMessage ?? null,
        durationMs: Date.now() - startTime,
      });
      await cleanupTempDir(dir);
    };

    let child: ChildProcess | null = null;

    const spawnProcess = () => {
      try {
        child = spawn(command, args, {
          cwd: workingDirectory ?? undefined,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: language === 'shell',
        });
      } catch (error) {
        throw error;
      }
    };

    try {
      spawnProcess();
    } catch (error) {
      const message =
        error instanceof Error
          ? `Failed to start ${language} process: ${error.message}`
          : 'Failed to start script process.';
      await finalize('failed', null, message);
      throw new Error(message);
    }

    const processOutput = (buffer: Buffer, level: 'INFO' | 'ERROR') => {
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        appendRunLog(runId, language, level, line);
      }
    };

    child?.stdout?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'INFO'));
    child?.stderr?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'ERROR'));

    child?.on('error', (error) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error while executing script.';
      finalize('failed', null, message).catch((err) => log.error('Failed to finalize script execution:', err));
    });

    child?.on('exit', (code) => {
      if (code === 0) {
        finalize('succeeded', 0).catch((err) => log.error('Failed to finalize script execution:', err));
      } else {
        const message = `${language === 'shell' ? 'Shell' : 'PowerShell'} process exited with code ${code ?? 'unknown'}.`;
        finalize('failed', code ?? null, message).catch((err) => log.error('Failed to finalize script execution:', err));
      }
    });

    return run;
  },

  async getRun(runId: string): Promise<ScriptExecutionRun | null> {
    const row = databaseService.get(
      `SELECT run_id, node_id, language, status, started_at, finished_at, exit_code, error_message, duration_ms, environment_json, working_directory
       FROM script_execution_runs
       WHERE run_id = ?`
    , [runId]);
    if (!row) return null;
    return mapRunRow(row);
  },

  async getRunsForNode(nodeId: string, language: ScriptLanguage, limit = 20): Promise<ScriptExecutionRun[]> {
    const rows = databaseService.query(
      `SELECT run_id, node_id, language, status, started_at, finished_at, exit_code, error_message, duration_ms, environment_json, working_directory
       FROM script_execution_runs
       WHERE node_id = ? AND language = ?
       ORDER BY datetime(started_at) DESC
       LIMIT ?`
    , [nodeId, language, limit]);
    return rows.map(mapRunRow);
  },

  async getRunLogs(runId: string): Promise<ScriptExecutionLogEntry[]> {
    const rows = databaseService.query(
      `SELECT log_id, run_id, timestamp, level, message
       FROM script_execution_logs
       WHERE run_id = ?
       ORDER BY log_id ASC`
    , [runId]);
    return rows.map((row) => ({
      logId: row.log_id,
      runId: row.run_id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
    }));
  },

  async getNodeSettings(nodeId: string, language: ScriptLanguage): Promise<NodeScriptSettings | null> {
    const row = databaseService.get(
      `SELECT node_id, language, environment_json, working_directory, updated_at
       FROM node_script_settings
       WHERE node_id = ? AND language = ?`
    , [nodeId, language]);
    if (!row) {
      return null;
    }
    let environment: Record<string, string> = {};
    try {
      environment = JSON.parse(row.environment_json) ?? {};
    } catch {
      environment = {};
    }
    return {
      nodeId: row.node_id,
      language: row.language as ScriptLanguage,
      environmentVariables: environment,
      workingDirectory: row.working_directory ?? null,
      updatedAt: row.updated_at,
    };
  },

  async setNodeSettings(
    nodeId: string,
    language: ScriptLanguage,
    settings: { environmentVariables: Record<string, string>; workingDirectory: string | null }
  ): Promise<NodeScriptSettings> {
    const now = new Date().toISOString();
    databaseService.run(
      `INSERT INTO node_script_settings (node_id, language, environment_json, working_directory, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(node_id, language) DO UPDATE SET
         environment_json = excluded.environment_json,
         working_directory = excluded.working_directory,
         updated_at = excluded.updated_at`
    , [nodeId, language, JSON.stringify(settings.environmentVariables ?? {}), settings.workingDirectory ?? null, now]);

    return this.getNodeSettings(nodeId, language);
  },

  async clearNodeSettings(nodeId: string, language: ScriptLanguage): Promise<void> {
    databaseService.run(
      `DELETE FROM node_script_settings WHERE node_id = ? AND language = ?`
    , [nodeId, language]);
  },
};

export const __testables__ = {
  resolveExecutionCommand,
};

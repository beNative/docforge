import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import log from 'electron-log/main';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import type {
  NodeScriptSettings,
  ScriptExecutionLogEntry,
  ScriptExecutionRun,
  ScriptExecutionStatus,
  ScriptLanguage,
  ScriptNodeSettingsUpdate,
  ScriptRunRequestPayload,
} from '../types';

const scriptEvents = new EventEmitter();

const writeScriptToTempFile = async (language: ScriptLanguage, code: string) => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), `docforge-${language}-script-`));
  const filePath = path.join(tempDir, language === 'powershell' ? 'script.ps1' : 'script.sh');
  await fsPromises.writeFile(filePath, code, { encoding: 'utf-8' });
  if (language === 'shell') {
    await fsPromises.chmod(filePath, 0o700);
  }
  return { filePath, dir: tempDir };
};

const cleanupTempDir = async (dir: string) => {
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    log.warn('Failed to remove temporary directory:', error);
  }
};

const normalizeEnv = (extra: Record<string, string>): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(extra)) {
    if (!key) continue;
    env[key] = value;
  }
  return env;
};

const appendRunLog = (language: ScriptLanguage, runId: string, level: 'INFO' | 'ERROR', message: string) => {
  const timestamp = new Date().toISOString();
  databaseService.run(
    `INSERT INTO script_execution_logs (run_id, timestamp, level, message) VALUES (?, ?, ?, ?)`
  , [runId, timestamp, level, message]);
  scriptEvents.emit('run-log', { language, runId, entry: { runId, timestamp, level, message } });
};

const updateRunStatus = (
  runId: string,
  status: ScriptExecutionStatus,
  updates: Partial<Omit<ScriptExecutionRun, 'runId' | 'nodeId' | 'language'>> = {}
) => {
  const fields: string[] = ['status = ?'];
  const params: any[] = [status];
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
  params.push(runId);
  databaseService.run(`UPDATE script_execution_runs SET ${fields.join(', ')} WHERE run_id = ?`, params);
};

const resolveExecutable = (language: ScriptLanguage, preferred: string | null): string => {
  const trimmed = preferred?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (language === 'powershell') {
    return process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  }
  return process.platform === 'win32' ? 'bash' : '/bin/bash';
};

const buildArgs = (language: ScriptLanguage, executable: string, scriptPath: string): string[] => {
  if (language === 'powershell') {
    const args = ['-NoLogo', '-NoProfile', '-NonInteractive'];
    if (process.platform === 'win32' && executable.toLowerCase().includes('powershell')) {
      args.push('-ExecutionPolicy', 'Bypass');
    }
    args.push('-File', scriptPath);
    return args;
  }
  if (executable.endsWith('.cmd') || executable.toLowerCase().includes('cmd.exe')) {
    return ['/c', scriptPath];
  }
  return [scriptPath];
};

const loadNodeScriptSettings = (row: any, nodeId: string, language: ScriptLanguage): NodeScriptSettings => {
  const envVars = row?.env_vars_json ? JSON.parse(row.env_vars_json) : {};
  return {
    nodeId,
    language,
    environmentVariables: envVars,
    workingDirectory: row?.working_directory ?? null,
    executable: row?.executable ?? null,
    lastRunId: row?.last_run_id ?? null,
    updatedAt: row?.updated_at ?? new Date().toISOString(),
  };
};

export const scriptRunner = {
  events: scriptEvents,

  async getNodeSettings(nodeId: string, language: ScriptLanguage): Promise<NodeScriptSettings> {
    const row = databaseService.get(
      `SELECT env_vars_json, working_directory, executable, last_run_id, updated_at FROM node_script_settings WHERE node_id = ? AND language = ?`,
      [nodeId, language]
    );
    return loadNodeScriptSettings(row, nodeId, language);
  },

  async updateNodeSettings(
    nodeId: string,
    language: ScriptLanguage,
    updates: ScriptNodeSettingsUpdate
  ): Promise<NodeScriptSettings> {
    const updatedAt = new Date().toISOString();
    databaseService.run(
      `INSERT INTO node_script_settings (node_id, language, env_vars_json, working_directory, executable, last_run_id, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(node_id, language) DO UPDATE SET
         env_vars_json = excluded.env_vars_json,
         working_directory = excluded.working_directory,
         executable = excluded.executable,
         updated_at = excluded.updated_at` ,
      [
        nodeId,
        language,
        JSON.stringify(updates.environmentVariables ?? {}),
        updates.workingDirectory ?? null,
        updates.executable ?? null,
        updatedAt,
      ]
    );
    return this.getNodeSettings(nodeId, language);
  },

  async runScript(payload: ScriptRunRequestPayload): Promise<ScriptExecutionRun> {
    const { nodeId, language, code, environmentVariables, workingDirectory, executable, overrides } = payload;
    const runId = uuidv4();
    const startedAt = new Date().toISOString();

    databaseService.run(
      `INSERT INTO script_execution_runs (run_id, node_id, language, status, started_at)
       VALUES (?, ?, ?, ?, ?)` ,
      [runId, nodeId, language, 'running', startedAt]
    );

    databaseService.run(
      `INSERT INTO node_script_settings (node_id, language, env_vars_json, working_directory, executable, last_run_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(node_id, language) DO UPDATE SET
         env_vars_json = excluded.env_vars_json,
         working_directory = excluded.working_directory,
         executable = excluded.executable,
         last_run_id = excluded.last_run_id,
         updated_at = excluded.updated_at` ,
      [
        nodeId,
        language,
        JSON.stringify(overrides ?? environmentVariables ?? {}),
        workingDirectory ?? null,
        executable ?? null,
        runId,
        startedAt,
      ]
    );

    appendRunLog(language, runId, 'INFO', `Starting ${language} script execution.`);

    const env = normalizeEnv(environmentVariables ?? {});
    const resolvedExecutable = resolveExecutable(language, executable);
    const { filePath, dir } = await writeScriptToTempFile(language, code);

    const startTime = Date.now();

    const finalize = async (
      status: ScriptExecutionStatus,
      exitCode: number | null,
      errorMessage?: string
    ) => {
      const finishedAt = new Date().toISOString();
      if (status === 'succeeded') {
        appendRunLog(language, runId, 'INFO', 'Execution completed successfully.');
      } else if (errorMessage) {
        appendRunLog(language, runId, 'ERROR', errorMessage);
      }
      updateRunStatus(runId, status, {
        finishedAt,
        exitCode: exitCode ?? undefined,
        errorMessage: errorMessage ?? null,
        durationMs: Date.now() - startTime,
      });
      scriptEvents.emit('run-status', { language, runId, status });
      await cleanupTempDir(dir);
    };

    const childArgs = buildArgs(language, resolvedExecutable, filePath);

    let child: ChildProcess;
    try {
      child = spawn(resolvedExecutable, childArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        cwd: workingDirectory ?? undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finalize('failed', null, `Failed to start process: ${message}`);
      throw error;
    }

    const processOutput = (data: Buffer, level: 'INFO' | 'ERROR') => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      for (const line of lines) {
        appendRunLog(language, runId, level, line);
      }
    };

    child.stdout?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'INFO'));
    child.stderr?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'ERROR'));

    child.on('error', (error) => {
      let message = `Execution failed: ${error instanceof Error ? error.message : String(error)}`;
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        message = `Executable not found: "${resolvedExecutable}". Update your script configuration to point to a valid interpreter.`;
      }
      finalize('failed', null, message).catch((err) => log.error('Failed to finalize script execution:', err));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        finalize('succeeded', 0).catch((err) => log.error('Failed to finalize script execution:', err));
      } else {
        const message = `Process exited with code ${code ?? 'unknown'}.`;
        finalize('failed', code ?? null, message).catch((err) => log.error('Failed to finalize script execution:', err));
      }
    });

    scriptEvents.emit('run-status', { language, runId, status: 'running' as ScriptExecutionStatus });

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
    };

    return run;
  },

  async getRunsForNode(
    nodeId: string,
    language: ScriptLanguage,
    limit = 20
  ): Promise<ScriptExecutionRun[]> {
    const rows = databaseService.all(
      `SELECT run_id, node_id, language, status, started_at, finished_at, exit_code, error_message, duration_ms
       FROM script_execution_runs
       WHERE node_id = ? AND language = ?
       ORDER BY datetime(started_at) DESC
       LIMIT ?`,
      [nodeId, language, limit]
    );
    return rows.map((row: any) => ({
      runId: row.run_id,
      nodeId: row.node_id,
      language: row.language,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? null,
      exitCode: row.exit_code ?? null,
      errorMessage: row.error_message ?? null,
      durationMs: row.duration_ms ?? null,
    }));
  },

  async getRunLogs(runId: string): Promise<ScriptExecutionLogEntry[]> {
    const rows = databaseService.all(
      `SELECT run_id, timestamp, level, message FROM script_execution_logs WHERE run_id = ? ORDER BY log_id ASC`,
      [runId]
    );
    return rows.map((row: any) => ({
      runId: row.run_id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
    }));
  },

  async getRun(runId: string): Promise<ScriptExecutionRun | null> {
    const row = databaseService.get(
      `SELECT run_id, node_id, language, status, started_at, finished_at, exit_code, error_message, duration_ms
       FROM script_execution_runs WHERE run_id = ?`,
      [runId]
    );
    if (!row) {
      return null;
    }
    return {
      runId: row.run_id,
      nodeId: row.node_id,
      language: row.language,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? null,
      exitCode: row.exit_code ?? null,
      errorMessage: row.error_message ?? null,
      durationMs: row.duration_ms ?? null,
    };
  },
};

export type ScriptRunner = typeof scriptRunner;

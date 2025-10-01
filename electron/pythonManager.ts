import { app, BrowserWindow } from 'electron';
import path from 'path';
import { promises as fsPromises, constants as fsConstants } from 'fs';
import { existsSync } from 'fs';
import { spawn, execFile } from 'child_process';
import type { ChildProcess } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { EventEmitter } from 'events';
import log from 'electron-log/main';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import type {
  PythonEnvironmentConfig,
  PythonPackageSpec,
  NodePythonSettings,
  PythonExecutionRun,
  PythonEnvironmentDefaults,
  PythonInterpreterInfo,
  PythonExecutionStatus,
  PythonConsoleBehavior,
} from '../types';

const execFileAsync = promisify(execFile);

interface StoredEnvironmentConfig {
  packages: PythonPackageSpec[];
  environmentVariables: Record<string, string>;
  baseInterpreter: string;
}

interface CreateEnvironmentOptions {
  name: string;
  pythonExecutable: string;
  pythonVersion?: string;
  packages: PythonPackageSpec[];
  environmentVariables: Record<string, string>;
  workingDirectory?: string | null;
  description?: string | null;
  managed?: boolean;
}

interface UpdateEnvironmentOptions {
  name?: string;
  packages?: PythonPackageSpec[];
  environmentVariables?: Record<string, string>;
  workingDirectory?: string | null;
  description?: string | null;
}

interface RunScriptOptions {
  nodeId: string;
  code: string;
  environment: PythonEnvironmentConfig;
  consoleTheme: 'light' | 'dark';
  consoleBehavior: PythonConsoleBehavior;
}

const VENV_ROOT = () => path.join(app.getPath('userData'), 'python-envs');

const pythonEvents = new EventEmitter();

const consoleWindows = new Map<string, BrowserWindow>();

const ensureDirectory = async (dirPath: string) => {
  await fsPromises.mkdir(dirPath, { recursive: true });
};

const getManagedPythonBinary = (envRoot: string) => {
  if (process.platform === 'win32') {
    return path.join(envRoot, 'Scripts', 'python.exe');
  }
  return path.join(envRoot, 'bin', 'python3');
};

const resolvePackageSpec = (pkg: PythonPackageSpec): string => {
  if (!pkg.version || pkg.version.toLowerCase() === 'latest') {
    return pkg.name;
  }
  if (pkg.version.startsWith('>') || pkg.version.startsWith('<') || pkg.version.includes('*')) {
    return `${pkg.name}${pkg.version}`;
  }
  return `${pkg.name}==${pkg.version}`;
};

const parseConfig = (configJson: string | null): StoredEnvironmentConfig => {
  if (!configJson) {
    return { packages: [], environmentVariables: {}, baseInterpreter: '' };
  }
  try {
    const parsed = JSON.parse(configJson) as Partial<StoredEnvironmentConfig>;
    return {
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      environmentVariables: parsed.environmentVariables ?? {},
      baseInterpreter: parsed.baseInterpreter ?? '',
    };
  } catch (error) {
    log.warn('Failed to parse python environment config JSON, using defaults.', error);
    return { packages: [], environmentVariables: {}, baseInterpreter: '' };
  }
};

const stringifiedConfig = (config: StoredEnvironmentConfig) => JSON.stringify(config);

const fetchEnvironmentRow = (envId: string) => {
  return databaseService.get(
    `SELECT env_id, name, python_executable, python_version, managed, config_json, working_directory, description, created_at, updated_at
     FROM python_environments
     WHERE env_id = ?`,
    [envId]
  );
};

const toEnvironmentConfig = (row: any): PythonEnvironmentConfig => {
  const parsed = parseConfig(row?.config_json ?? null);
  return {
    envId: row.env_id,
    name: row.name,
    pythonExecutable: row.python_executable,
    pythonVersion: row.python_version,
    managed: Boolean(row.managed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    packages: parsed.packages,
    environmentVariables: parsed.environmentVariables,
    workingDirectory: row.working_directory ?? null,
    description: row.description ?? null,
  };
};

const getPythonVersion = async (pythonExecutable: string): Promise<string> => {
  const result = await execFileAsync(pythonExecutable, ['--version']);
  const output = result.stdout?.toString().trim() || result.stderr?.toString().trim() || '';
  const match = output.match(/Python\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
  if (!match) {
    throw new Error(`Unable to determine Python version for executable at ${pythonExecutable}`);
  }
  return match[1];
};

const createVirtualEnvironment = async (baseInterpreter: string, envRoot: string) => {
  await ensureDirectory(path.dirname(envRoot));
  const args = ['-m', 'venv', envRoot];
  log.info(`Creating virtual environment at ${envRoot} using interpreter ${baseInterpreter}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(baseInterpreter, args, {
      stdio: 'pipe',
      env: {
        PYTHONNOUSERSITE: '1',
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
    });

    const errorChunks: Buffer[] = [];
    child.stderr?.on('data', (chunk) => errorChunks.push(Buffer.from(chunk)));

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errorOutput = Buffer.concat(errorChunks).toString();
        reject(new Error(`Failed to create virtual environment. Exit code ${code}. ${errorOutput}`));
      }
    });
  });
};

const installPackages = async (pythonExecutable: string, packages: PythonPackageSpec[]) => {
  if (!packages.length) return;
  const resolvedPackages = packages.map(resolvePackageSpec).filter(Boolean);
  if (!resolvedPackages.length) return;
  log.info(`Installing packages into ${pythonExecutable}: ${resolvedPackages.join(', ')}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      pythonExecutable,
      ['-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check', ...resolvedPackages],
      {
        stdio: 'pipe',
        env: {
          PYTHONNOUSERSITE: '1',
          PYTHONUNBUFFERED: '1',
        },
      }
    );
    const errorChunks: Buffer[] = [];
    child.stderr?.on('data', (chunk) => errorChunks.push(Buffer.from(chunk)));
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errorOutput = Buffer.concat(errorChunks).toString();
        reject(new Error(`Failed to install packages. Exit code ${code}. ${errorOutput}`));
      }
    });
  });
};

const ensureManagedBinaryExists = async (pythonExecutable: string) => {
  await fsPromises.access(pythonExecutable, fsConstants.X_OK);
};

const sanitizeEnvironmentVariables = (
  pythonExecutable: string,
  extra: Record<string, string>
): NodeJS.ProcessEnv => {
  const envDir = path.dirname(pythonExecutable);
  const sanitized: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: envDir + path.delimiter + (process.env.PATH ?? ''),
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
  };
  for (const [key, value] of Object.entries(extra)) {
    if (!key) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

const writeScriptToTempFile = async (code: string): Promise<{ filePath: string; dir: string }> => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'docforge-script-'));
  const filePath = path.join(tempDir, 'script.py');
  await fsPromises.writeFile(filePath, code, { encoding: 'utf-8' });
  return { filePath, dir: tempDir };
};

const appendRunLog = (runId: string, level: 'INFO' | 'ERROR', message: string) => {
  const timestamp = new Date().toISOString();
  databaseService.run(
    `INSERT INTO python_execution_logs (run_id, timestamp, level, message) VALUES (?, ?, ?, ?)`
  , [runId, timestamp, level, message]);
  pythonEvents.emit('run-log', { runId, entry: { runId, timestamp, level, message } });
};

const updateRunStatus = (
  runId: string,
  status: PythonExecutionStatus,
  updates: Partial<Omit<PythonExecutionRun, 'runId' | 'status'>> = {}
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
  databaseService.run(
    `UPDATE python_execution_runs SET ${fields.join(', ')} WHERE run_id = ?`,
    params
  );
  pythonEvents.emit('run-status', { runId, status });
};

const cleanupTempDir = async (dir: string) => {
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    log.warn(`Failed to clean up temporary directory ${dir}:`, error);
  }
};

const createConsoleWindow = (runId: string, consoleTheme: 'light' | 'dark') => {
  if (consoleWindows.has(runId)) {
    const existing = consoleWindows.get(runId)!;
    existing.focus();
    return existing;
  }
  const window = new BrowserWindow({
    width: 720,
    height: 540,
    minWidth: 480,
    minHeight: 320,
    title: `Python Execution (${runId.slice(0, 8)})`,
    backgroundColor: consoleTheme === 'dark' ? '#111111' : '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  window.on('closed', () => {
    consoleWindows.delete(runId);
  });

  const query = new URLSearchParams({ 'python-console': '1', runId, theme: consoleTheme }).toString();
  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '..', 'index.html'), { search: `?${query}` });
  } else {
    window.loadURL(`http://localhost:8080/?${query}`);
  }

  consoleWindows.set(runId, window);
  return window;
};

const detectPythonViaPyLauncher = async (): Promise<PythonInterpreterInfo[]> => {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await execFileAsync('py', ['-0p']);
    const lines = stdout.toString().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const interpreters: PythonInterpreterInfo[] = [];
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length === 2) {
        const versionPart = parts[0].replace(/^-/, '').trim();
        const pathPart = parts[1].trim();
        const version = versionPart.replace('*', '');
        interpreters.push({
          path: pathPart,
          version,
          displayName: `Python ${version} (py launcher)`,
          isDefault: versionPart.includes('*'),
        });
      }
    }
    return interpreters;
  } catch (error) {
    log.debug('py launcher not available or failed to enumerate interpreters.', error);
    return [];
  }
};

const detectPythonFromPath = async (): Promise<PythonInterpreterInfo[]> => {
  const candidates = new Set<string>();
  const pathParts = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const executables = process.platform === 'win32'
    ? ['python.exe', 'python3.exe']
    : ['python3', 'python'];

  for (const dir of pathParts) {
    for (const exe of executables) {
      const candidate = path.join(dir, exe);
      if (existsSync(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  const interpreters: PythonInterpreterInfo[] = [];
  for (const candidate of candidates) {
    try {
      const version = await getPythonVersion(candidate);
      interpreters.push({
        path: candidate,
        version,
        displayName: `Python ${version}`,
        isDefault: false,
      });
    } catch (error) {
      log.debug(`Skipping candidate interpreter ${candidate}:`, error);
    }
  }

  return interpreters;
};

const deduplicateInterpreters = (interpreters: PythonInterpreterInfo[]): PythonInterpreterInfo[] => {
  const seen = new Map<string, PythonInterpreterInfo>();
  for (const interpreter of interpreters) {
    if (!seen.has(interpreter.path)) {
      seen.set(interpreter.path, interpreter);
    }
  }
  return Array.from(seen.values());
};

export const pythonManager = {
  events: pythonEvents,

  async listEnvironments(): Promise<PythonEnvironmentConfig[]> {
    const rows = databaseService.query(
      `SELECT env_id, name, python_executable, python_version, managed, config_json, working_directory, description, created_at, updated_at
       FROM python_environments
       ORDER BY name`
    );
    return rows.map(toEnvironmentConfig);
  },

  async getEnvironment(envId: string): Promise<PythonEnvironmentConfig | null> {
    const row = fetchEnvironmentRow(envId);
    if (!row) return null;
    return toEnvironmentConfig(row);
  },

  async createEnvironment(options: CreateEnvironmentOptions): Promise<PythonEnvironmentConfig> {
    const envId = uuidv4();
    const now = new Date().toISOString();
    const managed = options.managed !== false;
    let pythonExecutable = options.pythonExecutable;

    if (managed) {
      const envRoot = path.join(VENV_ROOT(), envId);
      await createVirtualEnvironment(options.pythonExecutable, envRoot);
      pythonExecutable = getManagedPythonBinary(envRoot);
      await ensureManagedBinaryExists(pythonExecutable);
      await installPackages(pythonExecutable, options.packages);
    } else {
      await ensureManagedBinaryExists(pythonExecutable);
    }

    const pythonVersion = options.pythonVersion ?? await getPythonVersion(pythonExecutable);
    const storedConfig: StoredEnvironmentConfig = {
      packages: options.packages,
      environmentVariables: options.environmentVariables,
      baseInterpreter: options.pythonExecutable,
    };

    databaseService.run(
      `INSERT INTO python_environments (env_id, name, python_executable, python_version, managed, config_json, working_directory, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      envId,
      options.name,
      pythonExecutable,
      pythonVersion,
      managed ? 1 : 0,
      stringifiedConfig(storedConfig),
      options.workingDirectory ?? null,
      options.description ?? null,
      now,
      now,
    ]);

    const row = fetchEnvironmentRow(envId);
    return toEnvironmentConfig(row);
  },

  async updateEnvironment(envId: string, updates: UpdateEnvironmentOptions): Promise<PythonEnvironmentConfig> {
    const row = fetchEnvironmentRow(envId);
    if (!row) {
      throw new Error('Environment not found');
    }
    const config = parseConfig(row.config_json);

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.packages) {
      config.packages = updates.packages;
    }
    if (updates.environmentVariables) {
      config.environmentVariables = updates.environmentVariables;
    }
    if (updates.workingDirectory !== undefined) {
      fields.push('working_directory = ?');
      params.push(updates.workingDirectory ?? null);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description ?? null);
    }

    fields.push('config_json = ?');
    params.push(stringifiedConfig(config));
    fields.push('updated_at = ?');
    params.push(now);
    params.push(envId);

    databaseService.run(
      `UPDATE python_environments SET ${fields.join(', ')} WHERE env_id = ?`,
      params
    );

    if (updates.packages && updates.packages.length && Boolean(row.managed)) {
      const pythonExecutable = row.python_executable;
      await installPackages(pythonExecutable, updates.packages);
    }

    const updatedRow = fetchEnvironmentRow(envId);
    return toEnvironmentConfig(updatedRow);
  },

  async deleteEnvironment(envId: string): Promise<void> {
    const row = fetchEnvironmentRow(envId);
    if (!row) return;
    databaseService.run(`DELETE FROM python_environments WHERE env_id = ?`, [envId]);
    if (row.managed) {
      const envRoot = path.join(VENV_ROOT(), envId);
      if (existsSync(envRoot)) {
        try {
          await fsPromises.rm(envRoot, { recursive: true, force: true });
        } catch (error) {
          log.warn(`Failed to remove managed environment directory ${envRoot}:`, error);
        }
      }
    }
  },

  async getNodeSettings(nodeId: string): Promise<NodePythonSettings> {
    const row = databaseService.get(
      `SELECT node_id, env_id, auto_detect_env, last_run_id FROM node_python_settings WHERE node_id = ?`,
      [nodeId]
    );
    if (!row) {
      return {
        nodeId,
        envId: null,
        autoDetectEnvironment: true,
        lastUsedRunId: null,
      };
    }
    return {
      nodeId,
      envId: row.env_id ?? null,
      autoDetectEnvironment: row.auto_detect_env === null ? true : Boolean(row.auto_detect_env),
      lastUsedRunId: row.last_run_id ?? null,
    };
  },

  async setNodeSettings(nodeId: string, envId: string | null, autoDetectEnvironment: boolean): Promise<NodePythonSettings> {
    const now = new Date().toISOString();
    databaseService.run(
      `INSERT INTO node_python_settings (node_id, env_id, auto_detect_env, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET env_id = excluded.env_id, auto_detect_env = excluded.auto_detect_env, updated_at = excluded.updated_at`,
      [nodeId, envId, autoDetectEnvironment ? 1 : 0, now]
    );
    return this.getNodeSettings(nodeId);
  },

  async ensureEnvironmentForNode(nodeId: string, defaults: PythonEnvironmentDefaults, interpreters: PythonInterpreterInfo[]): Promise<PythonEnvironmentConfig> {
    const settings = await this.getNodeSettings(nodeId);
    if (settings.envId) {
      const env = await this.getEnvironment(settings.envId);
      if (env) return env;
    }

    if (!defaults?.targetPythonVersion) {
      throw new Error('Python defaults are not configured.');
    }

    const environments = await this.listEnvironments();
    const compatible = environments.find((env) => env.pythonVersion.startsWith(defaults.targetPythonVersion));
    if (compatible) {
      await this.setNodeSettings(nodeId, compatible.envId, false);
      return compatible;
    }

    if (!interpreters.length) {
      throw new Error('No Python interpreters are available to create a virtual environment.');
    }

    const preferred = interpreters.find((interpreter) => interpreter.version.startsWith(defaults.targetPythonVersion)) ?? interpreters[0];

    const environment = await this.createEnvironment({
      name: `Node ${nodeId.slice(0, 6)} (${defaults.targetPythonVersion})`,
      pythonExecutable: preferred.path,
      pythonVersion: preferred.version,
      packages: defaults.basePackages ?? [],
      environmentVariables: defaults.environmentVariables ?? {},
      workingDirectory: defaults.workingDirectory ?? null,
      managed: true,
    });

    await this.setNodeSettings(nodeId, environment.envId, false);
    return environment;
  },

  async detectPythonInstallations(): Promise<PythonInterpreterInfo[]> {
    const interpreters = await Promise.all([detectPythonViaPyLauncher(), detectPythonFromPath()]);
    const flattened = interpreters.flat();
    const deduped = deduplicateInterpreters(flattened);
    if (deduped.length) {
      deduped[0].isDefault = true;
    }
    return deduped.sort((a, b) => a.version.localeCompare(b.version));
  },

  async runScript(options: RunScriptOptions): Promise<PythonExecutionRun> {
    const { nodeId, code, environment, consoleTheme, consoleBehavior } = options;
    const runId = uuidv4();
    const startedAt = new Date().toISOString();

    const currentSettings = await this.getNodeSettings(nodeId);

    databaseService.run(
      `INSERT INTO python_execution_runs (run_id, node_id, env_id, status, started_at) VALUES (?, ?, ?, ?, ?)`
    , [runId, nodeId, environment.envId ?? null, 'running', startedAt]);

    databaseService.run(
      `INSERT INTO node_python_settings (node_id, env_id, auto_detect_env, last_run_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET env_id = excluded.env_id, last_run_id = excluded.last_run_id, updated_at = excluded.updated_at`,
      [nodeId, environment.envId ?? null, currentSettings.autoDetectEnvironment ? 1 : 0, runId, startedAt]
    );

    appendRunLog(runId, 'INFO', 'Starting Python script execution.');
    if (consoleBehavior === 'in-app') {
      createConsoleWindow(runId, consoleTheme);
    } else if (consoleBehavior === 'windows-terminal') {
      appendRunLog(runId, 'INFO', 'Launching Windows Terminal for interactive execution.');
    } else {
      appendRunLog(runId, 'INFO', 'Running script without opening a console window.');
    }

    const envVars = sanitizeEnvironmentVariables(environment.pythonExecutable, environment.environmentVariables);

    const { filePath, dir } = await writeScriptToTempFile(code);

    const startTime = Date.now();

    const finalize = async (status: PythonExecutionStatus, exitCode: number | null, errorMessage?: string) => {
      const finishedAt = new Date().toISOString();
      if (status === 'succeeded') {
        appendRunLog(runId, 'INFO', 'Execution completed successfully.');
      } else if (errorMessage) {
        appendRunLog(runId, 'ERROR', errorMessage);
      }
      updateRunStatus(runId, status, {
        finishedAt,
        exitCode: exitCode ?? undefined,
        errorMessage: errorMessage ?? null,
        durationMs: Date.now() - startTime,
      });
      await cleanupTempDir(dir);
    };

    if (consoleBehavior === 'windows-terminal' && process.platform !== 'win32') {
      const message = 'Windows Terminal execution is only available on Windows.';
      await finalize('failed', null, message);
      throw new Error(message);
    }

    const processOutput = (data: Buffer, level: 'INFO' | 'ERROR') => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      for (const line of lines) {
        appendRunLog(runId, level, line);
      }
    };

    let isFinalized = false;

    const safeFinalize = (status: PythonExecutionStatus, exitCode: number | null, message?: string) => {
      if (isFinalized) return;
      isFinalized = true;
      finalize(status, exitCode, message).catch((err) => log.error('Failed to finalize python execution:', err));
    };

    let child: ChildProcess;
    if (consoleBehavior === 'windows-terminal') {
      const title = `DocForge Python (${runId.slice(0, 8)})`;
      const args = ['-w', '_new', '--title', title, '--', environment.pythonExecutable, '-I', filePath];
      child = spawn('wt.exe', args, {
        stdio: 'ignore',
        env: envVars,
        cwd: environment.workingDirectory ?? dir,
        windowsHide: false,
      });
      appendRunLog(runId, 'INFO', 'Windows Terminal window opened. Close it to finish the run.');
    } else {
      child = spawn(environment.pythonExecutable, ['-I', filePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: envVars,
        cwd: environment.workingDirectory ?? dir,
      });
      child.stdout?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'INFO'));
      child.stderr?.on('data', (chunk) => processOutput(Buffer.from(chunk), 'ERROR'));
    }

    child.on('error', (error) => {
      const message = `Execution failed: ${error instanceof Error ? error.message : String(error)}`;
      safeFinalize('failed', null, message);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        safeFinalize('succeeded', 0);
      } else {
        const message = `Python process exited with code ${code ?? 'unknown'}.`;
        safeFinalize('failed', code ?? null, message);
      }
    });

    const run: PythonExecutionRun = {
      runId,
      nodeId,
      envId: environment.envId,
      status: 'running',
      startedAt,
      finishedAt: null,
      exitCode: null,
      errorMessage: null,
      durationMs: null,
    };

    return run;
  },

  getConsoleWindow(runId: string) {
    return consoleWindows.get(runId) ?? null;
  },

  async getRun(runId: string): Promise<PythonExecutionRun | null> {
    const row = databaseService.get(
      `SELECT run_id, node_id, env_id, status, started_at, finished_at, exit_code, error_message, duration_ms
       FROM python_execution_runs WHERE run_id = ?`,
      [runId]
    );
    if (!row) {
      return null;
    }
    return {
      runId: row.run_id,
      nodeId: row.node_id,
      envId: row.env_id,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      exitCode: row.exit_code ?? null,
      errorMessage: row.error_message ?? null,
      durationMs: row.duration_ms ?? null,
    };
  },

  async getRunsForNode(nodeId: string, limit = 20): Promise<PythonExecutionRun[]> {
    const rows = databaseService.query(
      `SELECT run_id, node_id, env_id, status, started_at, finished_at, exit_code, error_message, duration_ms
       FROM python_execution_runs WHERE node_id = ? ORDER BY datetime(started_at) DESC LIMIT ?`,
      [nodeId, limit]
    );
    return rows.map((row) => ({
      runId: row.run_id,
      nodeId: row.node_id,
      envId: row.env_id,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      exitCode: row.exit_code ?? null,
      errorMessage: row.error_message ?? null,
      durationMs: row.duration_ms ?? null,
    }));
  },

  async getRunLogs(runId: string): Promise<{ runId: string; timestamp: string; level: 'INFO' | 'ERROR'; message: string; }[]> {
    const rows = databaseService.query(
      `SELECT run_id, timestamp, level, message FROM python_execution_logs WHERE run_id = ? ORDER BY log_id ASC`,
      [runId]
    );
    return rows.map((row) => ({
      runId: row.run_id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
    }));
  },
};

export type PythonManager = typeof pythonManager;

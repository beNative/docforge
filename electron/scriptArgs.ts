import type { ScriptExecutionMode, ScriptLanguage } from '../types';

const isCmdExecutable = (executable: string): boolean => {
  const normalized = executable.toLowerCase();
  return normalized.endsWith('cmd.exe') || /(^|\\|\/)(cmd)(\.exe)?$/.test(normalized);
};

const buildShellRunArgs = (executable: string, scriptPath: string): string[] => {
  if (isCmdExecutable(executable)) {
    return ['/c', scriptPath];
  }
  return [scriptPath];
};

const buildShellTestArgs = (executable: string, scriptPath: string): string[] => {
  if (isCmdExecutable(executable)) {
    return ['/c', scriptPath];
  }
  return ['-n', scriptPath];
};

const buildPowerShellRunArgs = (executable: string, scriptPath: string): string[] => {
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive'];
  if (process.platform === 'win32' && executable.toLowerCase().includes('powershell')) {
    args.push('-ExecutionPolicy', 'Bypass');
  }
  args.push('-File', scriptPath);
  return args;
};

const escapeSingleQuotes = (value: string): string => value.replace(/'/g, "''");

const buildPowerShellTestArgs = (executable: string, scriptPath: string): string[] => {
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive'];
  if (process.platform === 'win32' && executable.toLowerCase().includes('powershell')) {
    args.push('-ExecutionPolicy', 'Bypass');
  }
  const escapedPath = escapeSingleQuotes(scriptPath);
  const command =
    "Set-StrictMode -Version Latest; try { " +
    `[ScriptBlock]::Create((Get-Content -LiteralPath '${escapedPath}' -Raw)) | Out-Null; ` +
    "Write-Output 'Syntax OK'; exit 0 } catch { Write-Error $_.Exception.Message; exit 1 }";
  args.push('-Command', command);
  return args;
};

export const buildScriptArguments = (
  language: ScriptLanguage,
  executable: string,
  scriptPath: string,
  mode: ScriptExecutionMode
): string[] => {
  if (language === 'powershell') {
    return mode === 'test'
      ? buildPowerShellTestArgs(executable, scriptPath)
      : buildPowerShellRunArgs(executable, scriptPath);
  }
  return mode === 'test'
    ? buildShellTestArgs(executable, scriptPath)
    : buildShellRunArgs(executable, scriptPath);
};

export const supportsTestMode = (language: ScriptLanguage, executable: string): boolean => {
  if (language === 'powershell') {
    return true;
  }
  if (language === 'shell') {
    return !isCmdExecutable(executable);
  }
  return false;
};

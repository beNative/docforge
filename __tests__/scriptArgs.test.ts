import { describe, expect, it } from 'vitest';
import { buildScriptArguments, supportsTestMode } from '../electron/scriptArgs';

describe('buildScriptArguments', () => {
  it('builds run arguments for shell scripts', () => {
    expect(buildScriptArguments('shell', '/bin/bash', '/tmp/script.sh', 'run')).toEqual(['/tmp/script.sh']);
  });

  it('builds test arguments for shell scripts using -n', () => {
    expect(buildScriptArguments('shell', '/bin/bash', '/tmp/script.sh', 'test')).toEqual(['-n', '/tmp/script.sh']);
  });

  it('builds run arguments for PowerShell', () => {
    const args = buildScriptArguments('powershell', 'pwsh', 'C:/scripts/test.ps1', 'run');
    expect(args[args.length - 2]).toBe('-File');
    expect(args[args.length - 1]).toBe('C:/scripts/test.ps1');
  });

  it('builds test arguments for PowerShell that compile the script', () => {
    const args = buildScriptArguments('powershell', 'pwsh', 'C:/scripts/test.ps1', 'test');
    expect(args).toContain('-Command');
    const command = args[args.length - 1];
    expect(command).toContain("Get-Content -LiteralPath 'C:/scripts/test.ps1'");
    expect(command).toContain('[ScriptBlock]::Create(');
  });
});

describe('supportsTestMode', () => {
  it('allows test mode for bash executables', () => {
    expect(supportsTestMode('shell', '/bin/bash')).toBe(true);
  });

  it('disallows test mode for cmd.exe', () => {
    expect(supportsTestMode('shell', 'C:/Windows/System32/cmd.exe')).toBe(false);
  });

  it('always allows test mode for PowerShell', () => {
    expect(supportsTestMode('powershell', 'pwsh')).toBe(true);
  });
});

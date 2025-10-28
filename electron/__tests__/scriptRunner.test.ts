import { describe, expect, it } from 'vitest';
import { __testables__ } from '../scriptRunner';

const { resolveExecutionCommand } = __testables__;

describe('resolveExecutionCommand', () => {
  it('returns a platform-appropriate command for shell scripts', () => {
    const { command, args } = resolveExecutionCommand('shell', '/tmp/test.sh');
    if (process.platform === 'win32') {
      expect(command).toBe('bash');
      expect(args).toEqual(['/tmp/test.sh']);
    } else {
      const expected = process.env.SHELL && process.env.SHELL.trim().length > 0 ? process.env.SHELL : '/bin/sh';
      expect(command).toBe(expected);
      expect(args).toEqual(['/tmp/test.sh']);
    }
  });

  it('returns a platform-appropriate command for PowerShell scripts', () => {
    const { command, args } = resolveExecutionCommand('powershell', '/tmp/test.ps1');
    if (process.platform === 'win32') {
      expect(command.toLowerCase()).toContain('powershell');
      expect(args[args.length - 1]).toBe('/tmp/test.ps1');
      expect(args).toContain('-File');
    } else {
      expect(command).toBe('pwsh');
      expect(args).toEqual(['-NoLogo', '-NoProfile', '-File', '/tmp/test.ps1']);
    }
  });
});

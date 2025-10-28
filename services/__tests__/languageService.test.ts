import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, mapExtensionToLanguageId } from '../languageService';

describe('languageService', () => {
  it('includes TOML, Shell, and PowerShell in the supported languages list', () => {
    const hasToml = SUPPORTED_LANGUAGES.some(lang => lang.id === 'toml' && lang.label === 'TOML');
    const hasShell = SUPPORTED_LANGUAGES.some(lang => lang.id === 'shell' && lang.label === 'Shell / Bash');
    const hasPowerShell = SUPPORTED_LANGUAGES.some(lang => lang.id === 'powershell' && lang.label === 'PowerShell');
    expect(hasToml).toBe(true);
    expect(hasShell).toBe(true);
    expect(hasPowerShell).toBe(true);
  });

  it('maps toml file extensions to the toml language id', () => {
    expect(mapExtensionToLanguageId('toml')).toBe('toml');
    expect(mapExtensionToLanguageId('TOML')).toBe('toml');
  });

  it('maps common shell script extensions to the shell language id', () => {
    expect(mapExtensionToLanguageId('sh')).toBe('shell');
    expect(mapExtensionToLanguageId('bash')).toBe('shell');
    expect(mapExtensionToLanguageId('zsh')).toBe('shell');
    expect(mapExtensionToLanguageId('ksh')).toBe('shell');
    expect(mapExtensionToLanguageId('shell')).toBe('shell');
  });

  it('maps PowerShell script extensions to the powershell language id', () => {
    expect(mapExtensionToLanguageId('ps1')).toBe('powershell');
    expect(mapExtensionToLanguageId('psm1')).toBe('powershell');
    expect(mapExtensionToLanguageId('psd1')).toBe('powershell');
  });

  it('falls back to plaintext when extension is null', () => {
    expect(mapExtensionToLanguageId(null)).toBe('plaintext');
  });
});

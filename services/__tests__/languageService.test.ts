import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, mapExtensionToLanguageId } from '../languageService';

describe('languageService', () => {
  it('includes TOML in the supported languages list', () => {
    const hasToml = SUPPORTED_LANGUAGES.some(lang => lang.id === 'toml' && lang.label === 'TOML');
    expect(hasToml).toBe(true);
  });

  it('maps toml file extensions to the toml language id', () => {
    expect(mapExtensionToLanguageId('toml')).toBe('toml');
    expect(mapExtensionToLanguageId('TOML')).toBe('toml');
  });

  it('falls back to plaintext when extension is null', () => {
    expect(mapExtensionToLanguageId(null)).toBe('plaintext');
  });
});

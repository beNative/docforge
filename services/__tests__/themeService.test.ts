import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, configureThemePreferences } from '../themeService';

const resetDocumentStyles = () => {
  document.documentElement.style.cssText = '';
  document.documentElement.className = '';
};

describe('themeService', () => {
  beforeEach(() => {
    configureThemePreferences({
      light: { overrides: {}, contrastOffset: 0 },
      dark: { overrides: {}, contrastOffset: 0 },
    });
    resetDocumentStyles();
    applyTheme('light');
  });

  it('merges stored overrides before applying tokens', () => {
    configureThemePreferences({
      light: {
        overrides: {
          'color-background': '10 20 30',
        },
      },
    });

    const styles = document.documentElement.style;
    expect(styles.getPropertyValue('--color-background')).toBe('10 20 30');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reapplies the current theme when preferences are updated', () => {
    applyTheme('dark');

    configureThemePreferences({
      dark: {
        overrides: {
          'color-text-main': '200 200 200',
        },
      },
    });

    const styles = document.documentElement.style;
    expect(styles.getPropertyValue('--color-text-main')).toBe('200 200 200');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies contrast offsets to base theme values', () => {
    configureThemePreferences({
      light: { contrastOffset: -10 },
    });

    const styles = document.documentElement.style;
    expect(styles.getPropertyValue('--color-text-main')).toBe('13 13 13');
  });

  it('preserves runtime overrides across preference updates', () => {
    applyTheme('light', {
      overrides: {
        'color-accent': '1 2 3',
      },
    });

    configureThemePreferences({
      light: { overrides: {}, contrastOffset: 0 },
    });

    const styles = document.documentElement.style;
    expect(styles.getPropertyValue('--color-accent')).toBe('1 2 3');
  });
});

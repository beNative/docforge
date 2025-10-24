import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ThemeDefinition,
  ThemeSlot,
  lightThemeDefinition,
  darkThemeDefinition,
  THEME_SLOTS,
} from '../themeTokens';

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const loadFallbackVariables = (selector: string): Map<ThemeSlot, string> => {
  const htmlPath = resolve(__dirname, '../../index.html');
  const file = readFileSync(htmlPath, 'utf8');
  const pattern = new RegExp(`${escapeForRegex(selector)}\\s*{([^}]*)}`);
  const match = file.match(pattern);
  if (!match) {
    throw new Error(`Failed to locate fallback variables for selector "${selector}".`);
  }

  const entries = new Map<ThemeSlot, string>();
  const block = match[1];
  const variableRegex = /--([a-z0-9-]+):\s*([^;]+);/gi;
  let variableMatch: RegExpExecArray | null;

  while ((variableMatch = variableRegex.exec(block)) !== null) {
    const [, slot, value] = variableMatch;
    entries.set(slot as ThemeSlot, value.trim());
  }

  return entries;
};

const expectDefinitionMatches = (definition: ThemeDefinition, selectors: string | string[]) => {
  const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
  const fallbackVariables = new Map<ThemeSlot, string>();

  for (const selector of selectorsArray) {
    const variables = loadFallbackVariables(selector);
    for (const [slot, value] of variables) {
      fallbackVariables.set(slot, value);
    }
  }

  for (const slot of THEME_SLOTS) {
    const fallbackValue = fallbackVariables.get(slot);
    expect(fallbackValue).toBeDefined();
    expect(definition[slot]).toBe(fallbackValue);
  }
};

describe('theme token fallbacks', () => {
  it('keeps the light theme fallback values in sync', () => {
    expectDefinitionMatches(lightThemeDefinition, ':root');
  });

  it('keeps the dark theme fallback values in sync', () => {
    expectDefinitionMatches(darkThemeDefinition, [':root', '.dark']);
  });
});

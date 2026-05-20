import React from 'react';
import type {
  Settings,
  PythonPackageSpec,
  ThemeTone,
  ThemeContrastPreference,
  ThemeMode,
  ThemeColorToken,
} from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import SettingRow from '../SettingRow';
import type { ThemePalette } from '../../services/themeCustomization';

export interface SectionProps {
  settings: Settings;
  setCurrentSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export type SettingsCategory = 'provider' | 'chat' | 'rag' | 'appearance' | 'shortcuts' | 'python' | 'shell' | 'powershell' | 'general' | 'database' | 'advanced';

export type FontField = 'markdownBodyFontFamily' | 'markdownHeadingFontFamily' | 'markdownCodeFontFamily' | 'editorFontFamily';
export type PlatformId = 'mac' | 'windows' | 'linux' | 'generic';

export interface FontOption {
  label: string;
  value: string;
}

export const detectPlatform = (): PlatformId => {
  if (typeof navigator === 'undefined') {
    return 'generic';
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'generic';
};

export const FONT_PRESETS: Record<FontField, Record<PlatformId, string[]>> = {
  markdownBodyFontFamily: {
    generic: ['Inter, sans-serif', 'System UI, sans-serif', 'Georgia, serif'],
    mac: ['SF Pro Text, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'],
    windows: ['Segoe UI, sans-serif', 'Calibri, sans-serif'],
    linux: ['Ubuntu, sans-serif', 'Cantarell, sans-serif'],
  },
  markdownHeadingFontFamily: {
    generic: ['Inter, sans-serif', 'Source Serif Pro, serif'],
    mac: ['SF Pro Display, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif'],
    windows: ['Segoe UI Semibold, sans-serif', 'Cambria, serif'],
    linux: ['Ubuntu Condensed, sans-serif', 'Cantarell, sans-serif'],
  },
  markdownCodeFontFamily: {
    generic: ['"JetBrains Mono", monospace', '"Fira Code", monospace'],
    mac: ['"SF Mono", monospace', '"Menlo", monospace'],
    windows: ['"Cascadia Code", monospace', '"Consolas", monospace'],
    linux: ['"Ubuntu Mono", monospace', '"DejaVu Sans Mono", monospace'],
  },
  editorFontFamily: {
    generic: ['"Fira Code", monospace', '"Source Code Pro", monospace'],
    mac: ['"SF Mono", monospace', '"Menlo", monospace'],
    windows: ['"Consolas", monospace', '"Cascadia Code", monospace'],
    linux: ['"Ubuntu Mono", monospace', '"DejaVu Sans Mono", monospace'],
  },
};

export const TONE_OPTIONS: { value: ThemeTone; label: string; description: string }[] = [
  {
    value: 'neutral',
    label: 'Neutral',
    description: 'Balanced default palette suitable for most environments.',
  },
  {
    value: 'warm',
    label: 'Warm',
    description: 'Amber-leaning neutrals that create a softer, more inviting feel.',
  },
  {
    value: 'cool',
    label: 'Cool',
    description: 'Blue-leaning palette that emphasizes clarity and focus.',
  },
];

export const CONTRAST_OPTIONS: { value: ThemeContrastPreference; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Standard',
    description: 'Meets WCAG AA contrast for body copy and controls.',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Boosts text and border separation toward WCAG AAA guidance.',
  },
  {
    value: 'max',
    label: 'Maximum',
    description: 'Uses pure light/dark text for maximum legibility.',
  },
];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light Theme',
  dark: 'Dark Theme',
};

export const COLOR_TOKEN_METADATA: Record<ThemeColorToken, { label: string; description: string }> = {
  background: {
    label: 'Background',
    description: 'Primary canvas color behind the entire interface.',
  },
  secondary: {
    label: 'Surface',
    description: 'Cards, panels, and secondary surfaces.',
  },
  textMain: {
    label: 'Primary Text',
    description: 'Headings and primary body copy.',
  },
  textSecondary: {
    label: 'Secondary Text',
    description: 'Helper text, metadata, and subdued copy.',
  },
  accent: {
    label: 'Accent',
    description: 'Buttons, highlights, and interactive accents.',
  },
  accentText: {
    label: 'Accent Text',
    description: 'Text and icons placed on the accent color.',
  },
  border: {
    label: 'Border',
    description: 'Dividers, outlines, and panel separators.',
  },
};

export const COLOR_TOKEN_TO_PALETTE_KEY: Record<ThemeColorToken, keyof ThemePalette> = {
  background: 'background',
  secondary: 'secondary',
  textMain: 'textMain',
  textSecondary: 'textSecondary',
  accent: 'accent',
  accentText: 'accentText',
  border: 'border',
};

export const serializePackageSpecs = (packages: PythonPackageSpec[]): string => {
  return packages
    .map((pkg) => {
      if (!pkg.version) {
        return pkg.name;
      }
      const version = pkg.version.trim();
      if (!version) {
        return pkg.name;
      }
      return /^(==|>=|<=|!=|~=|>|<)/.test(version) ? `${pkg.name}${version}` : `${pkg.name}==${version}`;
    })
    .join('\n');
};

export const parsePackagesInput = (input: string): PythonPackageSpec[] => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const specs: PythonPackageSpec[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(==|>=|<=|!=|~=|>|<)?\s*(.*)?$/);
    if (!match) {
      specs.push({ name: line });
      continue;
    }
    const [, name, operator, remainder] = match;
    const versionPart = operator ? `${operator}${(remainder || '').trim()}` : undefined;
    specs.push(versionPart ? { name, version: versionPart } : { name });
  }
  return specs;
};

export const parseEnvironmentJson = (value: string): Record<string, string> => {
  if (!value.trim()) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Environment variables must be a JSON object.');
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(parsed)) {
    result[String(key)] = val === undefined || val === null ? '' : String(val);
  }
  return result;
};

export const buildFontOptions = (field: FontField, platform: PlatformId): FontOption[] => {
  const presets = FONT_PRESETS[field];
  const ordered = [
    DEFAULT_SETTINGS[field],
    ...(presets?.generic ?? []),
    ...(presets?.[platform] ?? []),
  ].filter(Boolean);

  const unique: string[] = [];
  ordered.forEach((value) => {
    const normalized = value.trim();
    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }
  });

  return unique.map((value) => {
    const primary = value.split(',')[0].replace(/["']/g, '').trim();
    return { label: primary || value, value };
  });
};

interface FontFamilySelectorProps {
  id: string;
  label: string;
  description: string;
  value: string;
  placeholder: string;
  helperText?: string;
  options: FontOption[];
  defaultValue: string;
  onChange: (font: string) => void;
}

export const FontFamilySelector: React.FC<FontFamilySelectorProps> = ({
  id,
  label,
  description,
  value,
  placeholder,
  helperText,
  options,
  defaultValue,
  onChange,
}) => {
  const normalizedValue = (value || '').trim();
  const matchingOption = options.find((option) => option.value === normalizedValue);
  const previewFamily = normalizedValue || placeholder || defaultValue;

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (next) {
      onChange(next.trim());
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <SettingRow label={label} description={description}>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-recommended`}>
              Recommended
            </label>
            <div className="relative">
              <select
                id={`${id}-recommended`}
                value={matchingOption ? matchingOption.value : ''}
                onChange={handleSelect}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8"
              >
                <option value="">Choose a font</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-secondary text-xs">
                ▼
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1" htmlFor={`${id}-custom`}>
              Custom value
            </label>
            <input
              id={`${id}-custom`}
              type="text"
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder || defaultValue}
              className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {helperText && (
              <p className="text-xs text-text-secondary mt-1">{helperText}</p>
            )}
          </div>
        </div>
        <div className="md:w-64 border border-border-color rounded-lg p-4 bg-secondary/40 space-y-3">
          <p className="text-xs font-semibold text-text-secondary tracking-[0.2em] uppercase">Preview</p>
          <div className="rounded-md bg-background border border-border-color px-3 py-3">
            <p className="text-sm text-text-main" style={{ fontFamily: previewFamily }}>
              The quick brown fox jumps over the lazy dog.
            </p>
            <p className="text-xs text-text-secondary mt-2" style={{ fontFamily: previewFamily }}>
              0123456789 • Aa Bb Cc
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            Reset to default
          </button>
        </div>
      </div>
    </SettingRow>
  );
};

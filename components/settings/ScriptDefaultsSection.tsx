import React, { useState, useEffect } from 'react';
import type { SectionProps } from './SettingsHelpers';
import SettingRow from '../SettingRow';

export interface ScriptDefaultsSectionProps extends SectionProps {
  target: 'shell' | 'powershell';
  onValidationChange: (error: string | null) => void;
}

export const ScriptDefaultsSection: React.FC<ScriptDefaultsSectionProps> = ({
  settings,
  setCurrentSettings,
  target,
  onValidationChange,
}) => {
  const defaults = target === 'shell' ? settings.shellDefaults : settings.powershellDefaults;
  const [envVarJson, setEnvVarJson] = useState(() => JSON.stringify(defaults.environmentVariables, null, 2));
  const [envVarError, setEnvVarError] = useState<string | null>(null);

  useEffect(() => {
    setEnvVarJson(JSON.stringify(defaults.environmentVariables, null, 2));
    setEnvVarError(null);
    onValidationChange(null);
  }, [defaults.environmentVariables, onValidationChange]);

  const sectionTitle = target === 'shell' ? 'Shell Execution Defaults' : 'PowerShell Execution Defaults';
  const description =
    target === 'shell'
      ? 'Configure default environment variables, working directory, and interpreter override for shell scripts.'
      : 'Configure default environment variables, working directory, and interpreter override for PowerShell scripts.';

  const updateDefaults = (updates: Partial<typeof defaults>) => {
    setCurrentSettings((prev) => {
      if (target === 'shell') {
        return { ...prev, shellDefaults: { ...prev.shellDefaults, ...updates } };
      }
      return { ...prev, powershellDefaults: { ...prev.powershellDefaults, ...updates } };
    });
  };

  const handleEnvVarChange = (value: string) => {
    setEnvVarJson(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setEnvVarError(null);
      onValidationChange(null);
      updateDefaults({ environmentVariables: {} });
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Value must be a JSON object.');
      }
      const result: Record<string, string> = {};
      for (const [key, raw] of Object.entries(parsed)) {
        if (typeof raw !== 'string') {
          throw new Error(`Value for "${key}" must be a string.`);
        }
        if (!key.trim()) {
          throw new Error('Environment variable keys cannot be empty.');
        }
        result[key] = raw;
      }
      setEnvVarError(null);
      onValidationChange(null);
      updateDefaults({ environmentVariables: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON format.';
      setEnvVarError(message);
      onValidationChange(message);
    }
  };

  const handleWorkingDirectoryChange = (value: string) => {
    const trimmed = value.trim();
    updateDefaults({ workingDirectory: trimmed ? trimmed : null });
  };

  const handleExecutableChange = (value: string) => {
    const trimmed = value.trim();
    updateDefaults({ executable: trimmed ? trimmed : null });
  };

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">{sectionTitle}</h2>
      <p className="text-xs text-text-secondary max-w-3xl mb-6">{description}</p>
      <div className="space-y-6">
        <SettingRow label="Default Environment Variables" description="JSON object defining environment variables applied to every run.">
          <textarea
            value={envVarJson}
            onChange={(event) => handleEnvVarChange(event.target.value)}
            className="w-full h-32 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          {envVarError && <p className="text-xs text-destructive-text mt-2">{envVarError}</p>}
        </SettingRow>
        <SettingRow label="Default Working Directory" description="Optional directory used when running scripts.">
          <input
            type="text"
            value={defaults.workingDirectory ?? ''}
            onChange={(event) => handleWorkingDirectoryChange(event.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={target === 'powershell' ? 'C:\\scripts' : '/path/to/projects'}
          />
        </SettingRow>
        <SettingRow label="Executable Override" description="Optional interpreter to run scripts. Leave blank to use the platform default.">
          <input
            type="text"
            value={defaults.executable ?? ''}
            onChange={(event) => handleExecutableChange(event.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={target === 'shell' ? 'bash' : 'pwsh'}
          />
        </SettingRow>
      </div>
    </section>
  );
};

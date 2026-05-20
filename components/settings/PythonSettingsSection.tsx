import React, { useState, useEffect, useCallback } from 'react';
import type { PythonEnvironmentConfig } from '../../types';
import type { SectionProps } from './SettingsHelpers';
import { useLogger } from '../../hooks/useLogger';
import { usePythonEnvironments } from '../../hooks/usePythonEnvironments';
import { serializePackageSpecs, parsePackagesInput, parseEnvironmentJson } from './SettingsHelpers';
import Button from '../Button';
import SettingRow from '../SettingRow';
import Modal from '../Modal';
import { RefreshIcon, PlusIcon } from '../Icons';

export interface PythonSectionProps extends SectionProps {
  onValidationChange?: (message: string | null) => void;
}

type EnvironmentFormState = {
  name: string;
  interpreterPath: string;
  customInterpreter: string;
  useCustomInterpreter: boolean;
  managed: boolean;
  packagesText: string;
  envVarJson: string;
  workingDirectory: string;
  description: string;
};

export const PythonSettingsSection: React.FC<PythonSectionProps> = ({ settings, setCurrentSettings, onValidationChange }) => {
  const { addLog } = useLogger();
  const {
    environments,
    interpreters,
    isLoading,
    isDetecting,
    refreshEnvironments,
    refreshInterpreters,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
  } = usePythonEnvironments();

  const createInitialFormState = useCallback<() => EnvironmentFormState>(() => ({
    name: `Environment (${settings.pythonDefaults.targetPythonVersion})`,
    interpreterPath: interpreters[0]?.path ?? '',
    customInterpreter: '',
    useCustomInterpreter: interpreters.length === 0,
    managed: true,
    packagesText: serializePackageSpecs(settings.pythonDefaults.basePackages),
    envVarJson: JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2),
    workingDirectory: settings.pythonDefaults.workingDirectory ?? settings.pythonWorkingDirectory ?? '',
    description: '',
  }), [interpreters, settings.pythonDefaults, settings.pythonWorkingDirectory]);

  const [packagesInput, setPackagesInput] = useState(() => serializePackageSpecs(settings.pythonDefaults.basePackages));
  const [envVarJson, setEnvVarJson] = useState(() => JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2));
  const [envVarError, setEnvVarError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<EnvironmentFormState>(() => createInitialFormState());
  const [editingEnv, setEditingEnv] = useState<PythonEnvironmentConfig | null>(null);
  const [formEnvVarError, setFormEnvVarError] = useState<string | null>(null);

  useEffect(() => {
    onValidationChange?.(envVarError);
  }, [envVarError, onValidationChange]);

  useEffect(() => () => {
    onValidationChange?.(null);
  }, [onValidationChange]);

  useEffect(() => {
    setPackagesInput(serializePackageSpecs(settings.pythonDefaults.basePackages));
  }, [settings.pythonDefaults.basePackages]);

  useEffect(() => {
    setEnvVarJson(JSON.stringify(settings.pythonDefaults.environmentVariables, null, 2));
    setEnvVarError(null);
  }, [settings.pythonDefaults.environmentVariables]);

  useEffect(() => {
    if (!isCreateOpen && !isEditOpen) {
      setFormState(createInitialFormState());
    }
  }, [createInitialFormState, isCreateOpen, isEditOpen]);

  const handlePackagesChange = (value: string) => {
    setPackagesInput(value);
    const parsed = parsePackagesInput(value);
    setCurrentSettings((prev) => ({
      ...prev,
      pythonDefaults: { ...prev.pythonDefaults, basePackages: parsed },
    }));
  };

  const handleEnvVarChange = (value: string) => {
    setEnvVarJson(value);
    try {
      const parsed = parseEnvironmentJson(value);
      setCurrentSettings((prev) => ({
        ...prev,
        pythonDefaults: { ...prev.pythonDefaults, environmentVariables: parsed },
      }));
      setEnvVarError(null);
    } catch (error) {
      setEnvVarError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleFormEnvVarChange = (value: string) => {
    setFormState((prev) => ({ ...prev, envVarJson: value }));
    try {
      parseEnvironmentJson(value);
      setFormEnvVarError(null);
    } catch (error) {
      setFormEnvVarError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConsoleThemeChange = (theme: 'light' | 'dark') => {
    setCurrentSettings((prev) => ({ ...prev, pythonConsoleTheme: theme }));
  };

  const handleWorkingDirectoryChange = (value: string) => {
    const trimmed = value.trim();
    setCurrentSettings((prev) => ({
      ...prev,
      pythonWorkingDirectory: trimmed ? trimmed : null,
      pythonDefaults: { ...prev.pythonDefaults, workingDirectory: trimmed ? trimmed : null },
    }));
  };

  const openCreateModal = () => {
    setFormState(createInitialFormState());
    setFormError(null);
    setFormEnvVarError(null);
    setCreateOpen(true);
    refreshInterpreters();
  };

  const openEditModal = (env: PythonEnvironmentConfig) => {
    setEditingEnv(env);
    setFormState({
      name: env.name,
      interpreterPath: env.pythonExecutable,
      customInterpreter: '',
      useCustomInterpreter: false,
      managed: env.managed,
      packagesText: serializePackageSpecs(env.packages),
      envVarJson: JSON.stringify(env.environmentVariables, null, 2),
      workingDirectory: env.workingDirectory ?? '',
      description: env.description ?? '',
    });
    setFormError(null);
    setFormEnvVarError(null);
    setEditOpen(true);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditOpen(false);
    setEditingEnv(null);
    setFormError(null);
    setFormEnvVarError(null);
  };

  const resolveInterpreterPath = (): string => {
    if (formState.useCustomInterpreter) {
      return formState.customInterpreter.trim();
    }
    return formState.interpreterPath;
  };

  const submitCreateEnvironment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formEnvVarError) {
        throw new Error(formEnvVarError);
      }
      const interpreter = resolveInterpreterPath();
      if (!interpreter) {
        throw new Error('Select or enter a Python interpreter.');
      }
      const packages = parsePackagesInput(formState.packagesText);
      const envVars = parseEnvironmentJson(formState.envVarJson);
      const environment = await createEnvironment({
        name: formState.name.trim() || `Environment (${settings.pythonDefaults.targetPythonVersion})`,
        pythonExecutable: interpreter,
        packages,
        environmentVariables: envVars,
        workingDirectory: formState.workingDirectory.trim() || null,
        description: formState.description.trim() || null,
        managed: formState.managed,
      });
      addLog('INFO', `Created Python environment "${environment.name}".`);
      closeModals();
      await refreshEnvironments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUpdateEnvironment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEnv) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formEnvVarError) {
        throw new Error(formEnvVarError);
      }
      const packages = parsePackagesInput(formState.packagesText);
      const envVars = parseEnvironmentJson(formState.envVarJson);
      const updated = await updateEnvironment(editingEnv.envId, {
        name: formState.name.trim(),
        packages,
        environmentVariables: envVars,
        workingDirectory: formState.workingDirectory.trim() || null,
        description: formState.description.trim() || null,
      });
      addLog('INFO', `Updated Python environment "${updated.name}".`);
      closeModals();
      await refreshEnvironments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEnvironment = async (env: PythonEnvironmentConfig) => {
    const confirmed = window.confirm(`Delete environment "${env.name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteEnvironment(env.envId);
    addLog('INFO', `Deleted Python environment "${env.name}".`);
    refreshEnvironments();
  };

  const interpreterValue = formState.useCustomInterpreter ? 'custom' : formState.interpreterPath;

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Python Execution</h2>
      <p className="text-xs text-text-secondary max-w-3xl mb-6">
        Configure how DocForge prepares isolated Python environments. These defaults are applied when auto-creating a virtual
        environment for a document and can be overridden per environment.
      </p>
      <div className="space-y-6">
        <SettingRow label="Target Python Version" description="Preferred Python version when creating new virtual environments.">
          <input
            type="text"
            value={settings.pythonDefaults.targetPythonVersion}
            onChange={(e) =>
              setCurrentSettings((prev) => ({
                ...prev,
                pythonDefaults: { ...prev.pythonDefaults, targetPythonVersion: e.target.value.trim() },
              }))
            }
            className="w-40 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="3.11"
          />
        </SettingRow>
        <SettingRow label="Default Packages" description="One package per line. Versions can use ==, >=, <=, etc.">
          <textarea
            value={packagesInput}
            onChange={(e) => handlePackagesChange(e.target.value)}
            className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="numpy&#10;pandas&#10;requests"
          />
        </SettingRow>
        <SettingRow label="Default Environment Variables" description="JSON object defining environment variables applied to every run.">
          <textarea
            value={envVarJson}
            onChange={(e) => handleEnvVarChange(e.target.value)}
            className="w-full h-32 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          {envVarError && <p className="text-xs text-destructive-text mt-2">{envVarError}</p>}
        </SettingRow>
        <SettingRow
          label="Default Working Directory"
          description="Optional directory used when running scripts if no environment-specific directory is set."
        >
          <input
            type="text"
            value={settings.pythonWorkingDirectory ?? ''}
            onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
            className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="/path/to/projects"
          />
        </SettingRow>
        <SettingRow label="Console Theme" description="Theme used for the dedicated Python output window.">
          <select
            value={settings.pythonConsoleTheme}
            onChange={(e) => handleConsoleThemeChange(e.target.value as 'light' | 'dark')}
            className="w-40 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </SettingRow>
        <div className="border border-border-color rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-secondary/40">
            <div>
              <p className="text-sm font-semibold text-text-main">Managed Environments</p>
              <p className="text-xs text-text-secondary">Create reusable Python virtual environments with curated packages.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  refreshEnvironments();
                  refreshInterpreters();
                }}
                isLoading={isLoading || isDetecting}
              >
                <RefreshIcon className="w-4 h-4 mr-1" /> Refresh
              </Button>
              <Button onClick={openCreateModal}>
                <PlusIcon className="w-4 h-4 mr-1" /> New Environment
              </Button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {environments.length === 0 ? (
              <p className="text-xs text-text-secondary">No environments configured yet.</p>
            ) : (
              environments.map((env) => (
                <div key={env.envId} className="border border-border-color rounded-md p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-text-main">{env.name}</p>
                      <p className="text-xs text-text-secondary">
                        Python {env.pythonVersion} • {env.managed ? 'Managed' : 'External'}
                      </p>
                      <p className="text-xs text-text-secondary break-all mt-1">{env.pythonExecutable}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => openEditModal(env)}>
                        Configure
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteEnvironment(env)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {(env.description || env.workingDirectory) && (
                    <div className="mt-2 text-xs text-text-secondary space-y-1">
                      {env.description && <p>{env.description}</p>}
                      {env.workingDirectory && <p>Working directory: {env.workingDirectory}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <Modal title="Create Python Environment" onClose={closeModals}>
          <form onSubmit={submitCreateEnvironment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Environment name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Interpreter</label>
              <select
                value={interpreterValue}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setFormState((prev) => ({ ...prev, useCustomInterpreter: true }));
                  } else {
                    setFormState((prev) => ({ ...prev, useCustomInterpreter: false, interpreterPath: e.target.value }));
                  }
                }}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select detected interpreter</option>
                {interpreters.map((interp) => (
                  <option key={interp.path} value={interp.path}>
                    {interp.displayName}
                  </option>
                ))}
                <option value="custom">Use custom path…</option>
              </select>
              {formState.useCustomInterpreter && (
                <input
                  type="text"
                  value={formState.customInterpreter}
                  onChange={(e) => setFormState((prev) => ({ ...prev, customInterpreter: e.target.value }))}
                  className="mt-2 w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="/usr/bin/python3"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="managed-env"
                type="checkbox"
                checked={formState.managed}
                onChange={(e) => setFormState((prev) => ({ ...prev, managed: e.target.checked }))}
                className="w-4 h-4 text-primary border-border-color rounded"
              />
              <label htmlFor="managed-env" className="text-xs text-text-secondary">
                Create an isolated virtual environment managed by DocForge.
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Packages</label>
              <textarea
                value={formState.packagesText}
                onChange={(e) => setFormState((prev) => ({ ...prev, packagesText: e.target.value }))}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Variables (JSON)</label>
              <textarea
                value={formState.envVarJson}
                onChange={(e) => handleFormEnvVarChange(e.target.value)}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              {formEnvVarError && <p className="text-xs text-destructive-text mt-1">{formEnvVarError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Working Directory</label>
              <input
                type="text"
                value={formState.workingDirectory}
                onChange={(e) => setFormState((prev) => ({ ...prev, workingDirectory: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full h-20 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {formError && <p className="text-xs text-destructive-text">{formError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={closeModals}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || !!formEnvVarError}>
                Create Environment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {isEditOpen && editingEnv && (
        <Modal title={`Configure ${editingEnv.name}`} onClose={closeModals}>
          <form onSubmit={submitUpdateEnvironment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Python Executable</label>
              <input
                type="text"
                value={editingEnv.pythonExecutable}
                readOnly
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Packages</label>
              <textarea
                value={formState.packagesText}
                onChange={(e) => setFormState((prev) => ({ ...prev, packagesText: e.target.value }))}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Environment Variables (JSON)</label>
              <textarea
                value={formState.envVarJson}
                onChange={(e) => handleFormEnvVarChange(e.target.value)}
                className="w-full h-28 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              {formEnvVarError && <p className="text-xs text-destructive-text mt-1">{formEnvVarError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Working Directory</label>
              <input
                type="text"
                value={formState.workingDirectory}
                onChange={(e) => setFormState((prev) => ({ ...prev, workingDirectory: e.target.value }))}
                className="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full h-20 bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {formError && <p className="text-xs text-destructive-text">{formError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={closeModals}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || !!formEnvVarError}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};

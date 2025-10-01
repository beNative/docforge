import { useCallback, useEffect, useState } from 'react';
import type {
  PythonEnvironmentConfig,
  PythonInterpreterInfo,
  CreatePythonEnvironmentPayload,
  UpdatePythonEnvironmentPayload,
} from '../types';
import { pythonService } from '../services/pythonService';
import { useLogger } from './useLogger';

export const usePythonEnvironments = () => {
  const { addLog } = useLogger();
  const [environments, setEnvironments] = useState<PythonEnvironmentConfig[]>([]);
  const [interpreters, setInterpreters] = useState<PythonInterpreterInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const refreshEnvironments = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await pythonService.listEnvironments();
      setEnvironments(items);
      addLog('DEBUG', `Loaded ${items.length} Python environment(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to load Python environments: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  const refreshInterpreters = useCallback(async () => {
    setIsDetecting(true);
    try {
      const detected = await pythonService.detectInterpreters();
      setInterpreters(detected);
      addLog('DEBUG', `Detected ${detected.length} Python interpreter(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `Failed to detect Python interpreters: ${message}`);
    } finally {
      setIsDetecting(false);
    }
  }, [addLog]);

  useEffect(() => {
    refreshEnvironments();
    refreshInterpreters();
  }, [refreshEnvironments, refreshInterpreters]);

  const createEnvironment = useCallback(async (payload: CreatePythonEnvironmentPayload) => {
    const env = await pythonService.createEnvironment(payload);
    setEnvironments((prev) => [...prev, env]);
    addLog('INFO', `Created Python environment "${env.name}" (${env.pythonVersion}).`);
    return env;
  }, [addLog]);

  const updateEnvironment = useCallback(async (envId: string, updates: UpdatePythonEnvironmentPayload) => {
    const updated = await pythonService.updateEnvironment(envId, updates);
    setEnvironments((prev) => prev.map((env) => env.envId === envId ? updated : env));
    addLog('INFO', `Updated Python environment "${updated.name}".`);
    return updated;
  }, [addLog]);

  const deleteEnvironment = useCallback(async (envId: string) => {
    await pythonService.deleteEnvironment(envId);
    setEnvironments((prev) => prev.filter((env) => env.envId !== envId));
    addLog('INFO', `Deleted Python environment ${envId}.`);
  }, [addLog]);

  return {
    environments,
    interpreters,
    isLoading,
    isDetecting,
    refreshEnvironments,
    refreshInterpreters,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
  };
};

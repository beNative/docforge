import React, { useState, useEffect, useCallback } from 'react';
import type { DatabaseStats } from '../../types';
import { repository } from '../../services/repository';
import { useLogger } from '../../hooks/useLogger';
import Button from '../Button';
import Spinner from '../Spinner';
import SettingRow from '../SettingRow';
import { DatabaseIcon, SaveIcon, CheckIcon, SparklesIcon } from '../Icons';

export const DatabaseSettingsSection: React.FC = () => {
  const [dbPath, setDbPath] = useState<string>('Loading...');
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSwitchingDb, setIsSwitchingDb] = useState(false);
  const [isCreatingDb, setIsCreatingDb] = useState(false);
  const [operation, setOperation] = useState<{
    name: 'backup' | 'integrity' | 'vacuum' | 'switch' | 'create';
    status: 'running' | 'success' | 'error';
    message?: string;
  } | null>(null);
  const { addLog } = useLogger();

  const loadData = useCallback(async () => {
    setIsLoadingStats(true);
    setOperation(null);
    try {
      const path = await repository.getDbPath();
      setDbPath(path);
      const statsResult = await repository.getDatabaseStats();
      if (statsResult.success) {
        setStats(statsResult.stats || null);
      } else {
        setOperation({ name: 'integrity', status: 'error', message: statsResult.error || 'Failed to load stats.' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'An unknown error occurred.';
      setOperation({ name: 'integrity', status: 'error', message });
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBackup = async () => {
    addLog('INFO', 'User action: Initiate database backup.');
    setOperation({ name: 'backup', status: 'running' });
    const result = await repository.backupDatabase();
    if (result.success) {
      setOperation({ name: 'backup', status: 'success', message: result.message || 'Backup successful.' });
    } else {
      setOperation({ name: 'backup', status: 'error', message: result.error || 'Backup failed.' });
    }
  };

  const handleIntegrityCheck = async () => {
    addLog('INFO', 'User action: Initiate database integrity check.');
    setOperation({ name: 'integrity', status: 'running' });
    const result = await repository.runIntegrityCheck();
    if (result.success) {
      const message = result.results === 'ok' ? 'Integrity check passed.' : `Integrity check found issues: ${result.results}`;
      setOperation({ name: 'integrity', status: 'success', message });
    } else {
      setOperation({ name: 'integrity', status: 'error', message: result.error || 'Integrity check failed.' });
    }
  };

  const handleVacuum = async () => {
    addLog('INFO', 'User action: Initiate database vacuum (optimize).');
    setOperation({ name: 'vacuum', status: 'running' });
    const result = await repository.runVacuum();
    if (result.success) {
      setOperation({ name: 'vacuum', status: 'success', message: 'Database optimized successfully.' });
      await loadData(); // Reload stats to show size change
    } else {
      setOperation({ name: 'vacuum', status: 'error', message: result.error || 'Optimization failed.' });
    }
  };

  const handleChangeDatabase = async () => {
    addLog('INFO', 'User action: Change database location.');
    setOperation(null);
    setIsSwitchingDb(true);
    try {
      const result = await repository.selectDatabaseFile();
      if (!result.success) {
        if (result.canceled) {
          return;
        }
        const message = result.error || 'Failed to load the selected database file.';
        addLog('ERROR', `Database change failed: ${message}`);
        setOperation({ name: 'switch', status: 'error', message });
        return;
      }

      if (result.path) {
        setDbPath(result.path);
      }

      const successMessage = `${result.message ?? 'Database location updated.'} Reloading interface...`;
      addLog('INFO', successMessage);
      setOperation({ name: 'switch', status: 'success', message: successMessage });

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change database location.';
      addLog('ERROR', `Database change failed: ${message}`);
      setOperation({ name: 'switch', status: 'error', message });
    } finally {
      setIsSwitchingDb(false);
    }
  };

  const handleCreateDatabase = async () => {
    addLog('INFO', 'User action: Create a brand new database file.');
    setOperation({ name: 'create', status: 'running' });
    setIsCreatingDb(true);
    try {
      const result = await repository.createNewDatabase();
      if (!result.success) {
        if (result.canceled) {
          setOperation(null);
          return;
        }
        const message = result.error || 'Failed to create a new database file.';
        addLog('ERROR', `Database creation failed: ${message}`);
        setOperation({ name: 'create', status: 'error', message });
        return;
      }

      if (result.path) {
        setDbPath(result.path);
      }

      const message = `${result.message ?? 'New database created.'} Reloading interface...`;
      addLog('INFO', message);
      setOperation({ name: 'create', status: 'success', message });

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create a new database file.';
      addLog('ERROR', `Database creation failed: ${message}`);
      setOperation({ name: 'create', status: 'error', message });
    } finally {
      setIsCreatingDb(false);
    }
  };

  return (
    <section className="pt-2 pb-6">
      <h2 className="text-lg font-semibold text-text-main mb-4">Database Management</h2>
      <div className="space-y-6">
        <SettingRow label="Database File" description="This file contains all your documents, folders, and history.">
          <div className="w-full flex flex-col md:flex-row md:items-center gap-2">
            <div className="text-sm text-text-main bg-background px-3 py-2 rounded-md border border-border-color w-full font-mono text-xs select-all break-all md:flex-1">
              {dbPath}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateDatabase} variant="primary" isLoading={isCreatingDb} disabled={isSwitchingDb || isCreatingDb}>
                <DatabaseIcon className="w-4 h-4 mr-2" /> New Database
              </Button>
              <Button onClick={handleChangeDatabase} variant="secondary" isLoading={isSwitchingDb} disabled={isSwitchingDb || isCreatingDb}>
                Change Location
              </Button>
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Operations" description="Perform maintenance tasks on the application database.">
          <div className="flex flex-col items-end w-full gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={handleBackup} variant="secondary" isLoading={operation?.name === 'backup' && operation.status === 'running'}>
                <SaveIcon className="w-4 h-4 mr-2" /> Backup
              </Button>
              <Button onClick={handleIntegrityCheck} variant="secondary" isLoading={operation?.name === 'integrity' && operation.status === 'running'}>
                <CheckIcon className="w-4 h-4 mr-2" /> Check Integrity
              </Button>
              <Button onClick={handleVacuum} variant="secondary" isLoading={operation?.name === 'vacuum' && operation.status === 'running'}>
                <SparklesIcon className="w-4 h-4 mr-2" /> Vacuum
              </Button>
            </div>
            {operation && (
              <p className={`text-xs mt-2 text-right ${operation.status === 'error' ? 'text-error' : 'text-success'}`}>
                {operation.message}
              </p>
            )}
          </div>
        </SettingRow>
        <SettingRow label="Statistics" description="An overview of the database contents and size.">
          {isLoadingStats ? (
            <Spinner />
          ) : !stats ? (
            <p className="text-sm text-error">Could not load stats.</p>
          ) : (
            <div className="w-full space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-background p-3 rounded-md border border-border-color">
                  <strong>File Size:</strong> {stats.fileSize}
                </div>
                <div className="bg-background p-3 rounded-md border border-border-color">
                  <strong>Schema Version:</strong> {stats.schemaVersion}
                </div>
                <div className="bg-background p-3 rounded-md border border-border-color">
                  <strong>Page Size:</strong> {stats.pageSize} bytes
                </div>
                <div className="bg-background p-3 rounded-md border border-border-color">
                  <strong>Page Count:</strong> {stats.pageCount}
                </div>
              </div>
              <div className="w-full overflow-hidden border border-border-color rounded-md">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background">
                    <tr>
                      <th className="p-2 font-semibold">Table</th>
                      <th className="p-2 font-semibold text-right">Rows</th>
                      <th className="p-2 font-semibold">Indexes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {stats.tables.map((table) => (
                      <tr key={table.name} className="bg-secondary">
                        <td className="p-2 font-mono">{table.name}</td>
                        <td className="p-2 font-mono text-right">{table.rowCount}</td>
                        <td className="p-2 font-mono text-xs text-text-secondary">
                          {table.indexes.join(', ') || 'none'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SettingRow>
      </div>
    </section>
  );
};

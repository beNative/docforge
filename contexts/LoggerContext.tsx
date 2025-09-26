import React, { createContext, useState, useCallback, useMemo } from 'react';
import type { LogMessage, LogLevel } from '../types';

interface LoggerContextType {
  logs: LogMessage[];
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
}

export const LoggerContext = createContext<LoggerContextType | undefined>(undefined);

export const LoggerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);

  const addLog = useCallback((level: LogLevel, message: string) => {
    const newLog: LogMessage = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prevLogs) => [...prevLogs, newLog]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const value = useMemo(() => ({ logs, addLog, clearLogs }), [logs, addLog, clearLogs]);

  return (
    <LoggerContext.Provider value={value}>
      {children}
    </LoggerContext.Provider>
  );
};

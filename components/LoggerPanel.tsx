import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLogger } from '../hooks/useLogger';
import { LogLevel } from '../types';
import { DownloadIcon, TrashIcon, ChevronDownIcon, SearchIcon } from './Icons';
// Fix: Use relative path for service import.
import { storageService } from '../services/storageService';
import IconButton from './IconButton';

interface LoggerPanelProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

const logLevelClasses: Record<LogLevel, { text: string; bg: string; border: string }> = {
  DEBUG: { text: 'text-debug', bg: 'bg-debug/10', border: 'border-debug' },
  INFO: { text: 'text-info', bg: 'bg-info/10', border: 'border-info' },
  WARNING: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning' },
  ERROR: { text: 'text-error', bg: 'bg-error/10', border: 'border-error' },
};

const logLevels: LogLevel[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

const activeFilterClasses: Record<LogLevel, string> = {
  DEBUG: 'bg-debug text-white',
  INFO: 'bg-info text-white',
  WARNING: 'bg-warning text-white',
  ERROR: 'bg-error text-white',
};

const inactiveFilterClasses: Record<LogLevel, string> = {
    DEBUG: 'bg-background text-debug hover:bg-debug/10',
    INFO: 'bg-background text-info hover:bg-info/10',
    WARNING: 'bg-background text-warning hover:bg-warning/10',
    ERROR: 'bg-background text-error hover:bg-error/10',
};


const LoggerPanel: React.FC<LoggerPanelProps> = ({ isVisible, onToggleVisibility, height, onResizeStart }) => {
  const { logs, clearLogs, addLog } = useLogger();
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    const levelFiltered = filter === 'ALL' ? logs : logs.filter(log => log.level === filter);
    if (!normalizedQuery) {
      return levelFiltered;
    }

    return levelFiltered.filter(log => {
      const messageMatch = log.message.toLowerCase().includes(normalizedQuery);
      const timestampMatch = log.timestamp.toLowerCase().includes(normalizedQuery);
      return messageMatch || timestampMatch;
    });
  }, [logs, filter, normalizedQuery]);

  const renderHighlighted = useCallback((text: string) => {
    if (!normalizedQuery) {
      return text;
    }

    const lower = text.toLowerCase();
    const queryLength = normalizedQuery.length;
    const fragments: React.ReactNode[] = [];
    let index = 0;
    let matchIndex = lower.indexOf(normalizedQuery);
    let key = 0;

    while (matchIndex !== -1) {
      if (matchIndex > index) {
        fragments.push(<span key={`text-${key++}`}>{text.slice(index, matchIndex)}</span>);
      }
      fragments.push(
        <span key={`hl-${key++}`} className="bg-primary/20 text-primary px-0.5 rounded-sm">
          {text.slice(matchIndex, matchIndex + queryLength)}
        </span>
      );
      index = matchIndex + queryLength;
      matchIndex = lower.indexOf(normalizedQuery, index);
    }

    if (index < text.length) {
      fragments.push(<span key={`text-${key++}`}>{text.slice(index)}</span>);
    }

    return fragments;
  }, [normalizedQuery]);

  useEffect(() => {
    if (isVisible && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, isVisible]);

  const handleSaveLog = async () => {
    addLog('INFO', 'User action: Save log to file.');
    const logContent = logs.map(log => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n');
    try {
      await storageService.saveLogToFile(logContent);
    } catch(e) {
      console.error(e)
    }
  };
  
  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{ height: `${height}px` }}
      className="flex-shrink-0 flex flex-col bg-secondary shadow-lg border-t border-border-color"
      aria-hidden={!isVisible}
    >
      <div
        onMouseDown={onResizeStart}
        className="w-full h-1.5 cursor-row-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
      />
      <header className="flex items-center justify-between px-2 h-7 border-b border-border-color bg-secondary flex-shrink-0 gap-2">
        <h3 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Application Logs</h3>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-secondary">Level:</span>
            <button onClick={() => setFilter('ALL')} className={`px-1.5 py-0.5 text-[10px] rounded-md font-semibold transition-colors ${filter === 'ALL' ? 'bg-primary text-primary-text' : 'bg-background hover:bg-border-color text-text-main'}`}>ALL</button>
            {logLevels.map(level => (
              <button key={level} onClick={() => setFilter(level)} className={`px-1.5 py-0.5 text-[10px] rounded-md font-semibold transition-colors ${filter === level ? activeFilterClasses[level] : inactiveFilterClasses[level]}`}>{level}</button>
            ))}
          </div>
          <div className="relative">
            <SearchIcon className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter text..."
              className="pl-5 pr-5 py-1 text-[10px] bg-background border border-border-color rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-text-secondary/60 w-40"
              aria-label="Filter logs by text"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary hover:text-text-main px-1"
                aria-label="Clear log filter"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <IconButton onClick={handleSaveLog} tooltip="Save Log" variant="ghost" size="xs" tooltipPosition="bottom">
              <DownloadIcon className="w-4 h-4" />
            </IconButton>
            <IconButton onClick={() => { addLog('INFO', 'User action: Clear logs.'); clearLogs(); }} tooltip="Clear Logs" variant="destructive" size="xs" tooltipPosition="bottom">
              <TrashIcon className="w-4 h-4" />
            </IconButton>
            <IconButton onClick={() => { addLog('INFO', 'User action: Close logger panel.'); onToggleVisibility(); }} tooltip="Close Panel" variant="ghost" size="xs" tooltipPosition="bottom">
              <ChevronDownIcon className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 px-2 py-2 overflow-y-auto font-mono text-[11px] space-y-1.5">
        {filteredLogs.map(log => (
          <div key={log.id} className="flex items-start gap-2">
            <span className={`${logLevelClasses[log.level].text} text-[10px] opacity-80`}>{renderHighlighted(log.timestamp)}</span>
            <span className={`px-1 py-0.5 rounded-full text-[10px] font-semibold border ${logLevelClasses[log.level].bg} ${logLevelClasses[log.level].border} ${logLevelClasses[log.level].text}`}>{log.level}</span>
            <span className={`flex-1 ${logLevelClasses[log.level].text} whitespace-pre-wrap break-words leading-relaxed`}>{renderHighlighted(log.message)}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-secondary text-[11px]">
            No logs to display.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoggerPanel;
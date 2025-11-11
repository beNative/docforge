import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLogger } from '../hooks/useLogger';
import { LogLevel } from '../types';
import { DownloadIcon, TrashIcon, ChevronDownIcon, SearchIcon, CopyIcon, CheckIcon } from './Icons';
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeLevel, setIncludeLevel] = useState(true);
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);
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

  const visibleLogIds = useMemo(() => new Set(filteredLogs.map(log => log.id)), [filteredLogs]);

  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) {
        return prev;
      }

      let changed = false;
      const next: number[] = [];
      prev.forEach(id => {
        if (visibleLogIds.has(id)) {
          next.push(id);
        } else {
          changed = true;
        }
      });

      return changed ? new Set(next) : prev;
    });
  }, [visibleLogIds]);

  useEffect(() => {
    if (selectionAnchor !== null && (selectionAnchor < 0 || selectionAnchor >= filteredLogs.length)) {
      setSelectionAnchor(filteredLogs.length ? Math.min(selectionAnchor, filteredLogs.length - 1) : null);
    }
  }, [filteredLogs.length, selectionAnchor]);

  const selectedLogs = useMemo(() => filteredLogs.filter(log => selectedIds.has(log.id)), [filteredLogs, selectedIds]);
  const selectedCount = selectedLogs.length;

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartIndex(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const formatLogForCopy = useCallback((log: typeof filteredLogs[number]) => {
    const parts: string[] = [];

    if (includeTimestamp) {
      parts.push(`[${log.timestamp}]`);
    }

    if (includeLevel) {
      parts.push(`[${log.level}]`);
    }

    let message = log.message;
    if (!preserveLineBreaks) {
      message = log.message.replace(/\s*\n\s*/g, ' ');
    }

    parts.push(message);

    return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
  }, [includeTimestamp, includeLevel, preserveLineBreaks]);

  const copySelectedLogs = useCallback(async () => {
    if (selectedCount === 0) {
      return;
    }

    const text = selectedLogs.map(formatLogForCopy).join('\n');

    const fallbackCopy = (content: string) => {
      if (typeof document === 'undefined') {
        throw new Error('Clipboard API is not available');
      }

      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy logs', error);
      try {
        fallbackCopy(text);
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy failed', fallbackError);
        setCopyStatus('error');
        setTimeout(() => setCopyStatus('idle'), 3000);
      }
    }
  }, [formatLogForCopy, selectedCount, selectedLogs]);

  const isTextSelectionTarget = useCallback((target: EventTarget | null) => {
    if (typeof window === 'undefined') {
      return false;
    }

    const element = target as HTMLElement | null;
    return Boolean(element?.closest('[data-text-selectable="true"]'));
  }, []);

  const hasActiveTextSelection = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const selection = window.getSelection();
    return Boolean(selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed);
  }, []);

  const handleLogSelection = useCallback((event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, logId: number, index: number) => {
    const { shiftKey, metaKey, ctrlKey } = event;
    const isMetaKey = metaKey || ctrlKey;

    if ('nativeEvent' in event) {
      const target = event.nativeEvent.target as EventTarget | null;
      if (isTextSelectionTarget(target) && hasActiveTextSelection()) {
        return;
      }
    }

    let nextSelection: Set<number>;
    if (shiftKey && selectionAnchor !== null) {
      const anchor = selectionAnchor ?? index;
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      const rangeIds = filteredLogs.slice(start, end + 1).map(log => log.id);
      nextSelection = new Set(rangeIds);
    } else if (shiftKey && selectionAnchor === null) {
      nextSelection = new Set([logId]);
    } else if (isMetaKey) {
      nextSelection = new Set(selectedIds);
      if (nextSelection.has(logId)) {
        nextSelection.delete(logId);
      } else {
        nextSelection.add(logId);
      }
    } else {
      nextSelection = new Set([logId]);
    }

    setSelectedIds(nextSelection);
    if (!shiftKey || selectionAnchor === null) {
      setSelectionAnchor(index);
    }
  }, [filteredLogs, hasActiveTextSelection, isTextSelectionTarget, selectedIds, selectionAnchor]);

  const handleLogKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, logId: number, index: number) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleLogSelection(event, logId, index);
    }
  }, [handleLogSelection]);

  const handleListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const allIds = filteredLogs.map(log => log.id);
      setSelectedIds(new Set(allIds));
      if (filteredLogs.length > 0) {
        setSelectionAnchor(0);
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void copySelectedLogs();
    }
  }, [copySelectedLogs, filteredLogs]);

  const handleLogMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) {
      return;
    }

    const { shiftKey, metaKey, ctrlKey } = event;

    if (isTextSelectionTarget(event.target)) {
      return;
    }

    if (!(shiftKey || metaKey || ctrlKey)) {
      handleLogSelection(event, filteredLogs[index].id, index);
      event.preventDefault();
      setIsDragging(true);
      setDragStartIndex(index);
      setSelectionAnchor(index);
    }
  }, [filteredLogs, handleLogSelection, isTextSelectionTarget]);

  const handleLogMouseEnter = useCallback((index: number) => {
    if (!isDragging || dragStartIndex === null) {
      return;
    }

    const start = Math.min(dragStartIndex, index);
    const end = Math.max(dragStartIndex, index);
    const rangeIds = filteredLogs.slice(start, end + 1).map(log => log.id);
    setSelectedIds(new Set(rangeIds));
  }, [dragStartIndex, filteredLogs, isDragging]);

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
      <div className="px-2 py-1.5 border-b border-border-color bg-secondary/70 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-secondary">{selectedCount} selected</span>
          <button
            type="button"
            onClick={() => { addLog('INFO', 'User action: Copy logs to clipboard.'); void copySelectedLogs(); }}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-color bg-background text-text-main transition-colors hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-disabled={selectedCount === 0}
          >
            {copyStatus === 'success' ? (
              <CheckIcon className="w-3.5 h-3.5 text-primary" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5" />
            )}
            <span>{copyStatus === 'success' ? 'Copied!' : 'Copy Selected'}</span>
          </button>
          <span role="status" aria-live="polite" className="text-text-secondary">
            {copyStatus === 'error' && 'Copy failed. Try again.'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTimestamp}
              onChange={(event) => setIncludeTimestamp(event.target.checked)}
              className="h-3 w-3 rounded border-border-color text-primary focus:ring-primary"
            />
            <span className="text-text-secondary">Timestamps</span>
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeLevel}
              onChange={(event) => setIncludeLevel(event.target.checked)}
              className="h-3 w-3 rounded border-border-color text-primary focus:ring-primary"
            />
            <span className="text-text-secondary">Levels</span>
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preserveLineBreaks}
              onChange={(event) => setPreserveLineBreaks(event.target.checked)}
              className="h-3 w-3 rounded border-border-color text-primary focus:ring-primary"
            />
            <span className="text-text-secondary">Preserve line breaks</span>
          </label>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 px-2 py-2 overflow-y-auto font-mono text-[11px] space-y-1.5"
        role="listbox"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
      >
        {filteredLogs.map((log, index) => {
          const isSelected = selectedIds.has(log.id);
          return (
            <div
              key={log.id}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={(event) => handleLogSelection(event, log.id, index)}
              onKeyDown={(event) => handleLogKeyDown(event, log.id, index)}
              onMouseDown={(event) => handleLogMouseDown(event, index)}
              onMouseEnter={() => handleLogMouseEnter(index)}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${isSelected ? 'bg-primary/15 border-primary/60 ring-1 ring-primary/50' : 'border-transparent hover:bg-border-color/40 focus-visible:bg-border-color/40'}`}
            >
              <span className={`${logLevelClasses[log.level].text} text-[10px] opacity-80`}>{renderHighlighted(log.timestamp)}</span>
              <span className={`px-1 py-0.5 rounded-full text-[10px] font-semibold border ${logLevelClasses[log.level].bg} ${logLevelClasses[log.level].border} ${logLevelClasses[log.level].text}`}>{log.level}</span>
              <span
                data-text-selectable="true"
                className={`flex-1 ${logLevelClasses[log.level].text} whitespace-pre-wrap break-words leading-relaxed`}
              >
                {renderHighlighted(log.message)}
              </span>
            </div>
          );
        })}
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
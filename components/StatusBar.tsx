import React from 'react';
import Tooltip from './Tooltip';
import type { LLMStatus, DiscoveredLLMModel, DiscoveredLLMService, PreviewMetadata } from '../types';
import { DatabaseIcon, ChevronDownIcon, MinusIcon, PlusIcon, RefreshIcon } from './Icons';

type DatabaseStatusHint = {
  message: string;
  tone?: 'info' | 'success' | 'error' | 'neutral';
};

interface StatusBarProps {
  status: LLMStatus;
  modelName: string;
  llmProviderName: string;
  llmProviderUrl: string;
  documentCount: number;
  lastSaved?: string;
  availableModels: DiscoveredLLMModel[];
  onModelChange: (modelId: string) => void;
  discoveredServices: DiscoveredLLMService[];
  onProviderChange: (serviceId: string) => void;
  appVersion: string;
  databasePath?: string | null;
  databaseStatus?: DatabaseStatusHint | null;
  onDatabaseMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenAbout?: () => void;
  previewScale: number;
  onPreviewZoomIn: () => void;
  onPreviewZoomOut: () => void;
  onPreviewReset: () => void;
  isPreviewZoomAvailable: boolean;
  previewMinScale: number;
  previewMaxScale: number;
  previewInitialScale: number;
  previewMetadata?: PreviewMetadata | null;
  zoomTarget: 'preview' | 'editor';
}

const statusConfig: Record<LLMStatus, { text: string; color: string; tooltip: string }> = {
  checking: {
    text: 'Checking...',
    color: 'bg-warning',
    tooltip: 'Attempting to connect to the local LLM provider.',
  },
  connected: {
    text: 'Connected',
    color: 'bg-success',
    tooltip: 'Successfully connected to the local LLM provider.',
  },
  error: {
    text: 'Connection Error',
    color: 'bg-error',
    tooltip: 'Failed to connect. Check your settings and ensure the provider is running.',
  },
};

type TimestampResult = { relative: string; absolute: string } | { fallback: string };

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

interface ZoomButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  hint: string;
  icon: React.ReactNode;
}

const ZoomButton: React.FC<ZoomButtonProps> = ({ hint, icon, className = '', disabled, ...buttonProps }) => {
  const wrapperRef = React.useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const hasHint = hint.trim().length > 0;

  const handleShow = React.useCallback(() => {
    if (hasHint) {
      setShowTooltip(true);
    }
  }, [hasHint]);

  const handleHide = React.useCallback(() => {
    setShowTooltip(false);
  }, []);

  const { type, ...restButtonProps } = buttonProps;

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex"
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
      >
        <button
          type={type ?? 'button'}
          className={`${className}`.trim()}
          disabled={disabled}
          {...restButtonProps}
        >
          {icon}
        </button>
      </span>
      {hasHint && showTooltip && wrapperRef.current && (
        <Tooltip targetRef={wrapperRef} content={hint} />
      )}
    </>
  );
};

const StatusBar: React.FC<StatusBarProps> = ({
    status,
    modelName,
    llmProviderName,
    llmProviderUrl,
    documentCount,
    lastSaved,
    availableModels,
    onModelChange,
    discoveredServices,
    onProviderChange,
    appVersion,
    databasePath,
    databaseStatus,
    onDatabaseMenu,
    onOpenAbout,
    previewScale,
    onPreviewZoomIn,
    onPreviewZoomOut,
    onPreviewReset,
    isPreviewZoomAvailable,
    previewMinScale,
    previewMaxScale,
    previewInitialScale,
    previewMetadata,
    zoomTarget,
}) => {
  const { text, color, tooltip } = statusConfig[status];
  const selectedService = discoveredServices.find(s => s.generateUrl === llmProviderUrl);

  const statusTriggerRef = React.useRef<HTMLDivElement>(null);
  const [showStatusTooltip, setShowStatusTooltip] = React.useState(false);
  const databaseTriggerRef = React.useRef<HTMLButtonElement>(null);
  const [showDatabaseTooltip, setShowDatabaseTooltip] = React.useState(false);
  const databaseStatusRef = React.useRef<HTMLSpanElement>(null);
  const [showDatabaseStatusTooltip, setShowDatabaseStatusTooltip] = React.useState(false);

  const databaseFileName = React.useMemo(() => {
    if (!databasePath) {
      return databaseStatus?.tone === 'error' ? 'Database unavailable' : 'Loading…';
    }
    const normalized = databasePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || databasePath;
  }, [databasePath, databaseStatus?.tone]);

  const databaseTooltip = React.useMemo(() => {
    const lines: string[] = [];
    if (databasePath) {
      lines.push(`Location: ${databasePath}`);
    } else if (databaseStatus?.tone === 'error') {
      lines.push('Database location unavailable.');
    } else {
      lines.push('Database location is loading...');
    }
    if (databaseStatus?.message) {
      lines.push(`Status: ${databaseStatus.message}`);
    }
    if (!onDatabaseMenu) {
      lines.push('Database actions are unavailable in this environment.');
    }
    return lines.join('\n');
  }, [databasePath, databaseStatus?.message, onDatabaseMenu]);

  const databaseStatusClass = React.useMemo(() => {
    if (!databaseStatus) return 'text-text-secondary';
    switch (databaseStatus.tone) {
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-error';
      case 'neutral':
      case 'info':
      default:
        return 'text-text-secondary';
    }
  }, [databaseStatus]);

  const handleDatabaseMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!onDatabaseMenu) return;
    onDatabaseMenu(event);
  };

  const formatTimestamp = React.useCallback((isoString?: string): TimestampResult => {
    if (!isoString) {
      return { fallback: 'Not saved yet' };
    }

    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
      return { fallback: 'Invalid date' };
    }

    const absolute = date.toLocaleString();
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    let duration = Math.round((date.getTime() - Date.now()) / 1000);

    for (const division of RELATIVE_TIME_DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return { relative: formatter.format(duration, division.unit), absolute };
      }
      duration = Math.round(duration / division.amount);
    }

    return { fallback: 'Invalid date' };
  }, []);

  const [lastSavedDisplay, setLastSavedDisplay] = React.useState<{ relative: string; absolute: string } | null>(() => {
    const result = formatTimestamp(lastSaved);
    return 'fallback' in result ? null : result;
  });
  const [lastSavedFallback, setLastSavedFallback] = React.useState<string | null>(() => {
    const result = formatTimestamp(lastSaved);
    return 'fallback' in result ? result.fallback : null;
  });
  const lastSavedTriggerRef = React.useRef<HTMLSpanElement>(null);
  const [showLastSavedTooltip, setShowLastSavedTooltip] = React.useState(false);

  React.useEffect(() => {
    let intervalId: number | undefined;

    const updateTimestamp = () => {
      const result = formatTimestamp(lastSaved);
      if ('fallback' in result) {
        setLastSavedDisplay(null);
        setLastSavedFallback(result.fallback);
        setShowLastSavedTooltip(false);
        return false;
      }

      setLastSavedFallback(null);
      setLastSavedDisplay(result);
      return true;
    };

    const hasValidTimestamp = updateTimestamp();

    if (hasValidTimestamp && typeof window !== 'undefined') {
      intervalId = window.setInterval(updateTimestamp, 60000);
    }

    return () => {
      if (intervalId !== undefined && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
      }
    };
  }, [lastSaved, formatTimestamp]);

  const selectStyles: React.CSSProperties = {
    maxWidth: '160px',
    backgroundImage: 'var(--select-arrow-background)',
    backgroundPosition: 'right 0.2rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.2em 1.2em',
  };

  const zoomButtonClass = 'p-1 rounded-sm text-text-secondary hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';
  const isZoomDisabled = !isPreviewZoomAvailable;
  const isAtMinZoom = previewScale <= previewMinScale + 0.001;
  const isAtMaxZoom = previewScale >= previewMaxScale - 0.001;
  const isAtInitialZoom = Math.abs(previewScale - previewInitialScale) < 0.001;
  const zoomLabelClass = `min-w-[3rem] text-center font-semibold ${isZoomDisabled ? 'text-text-secondary' : 'text-text-main'}`;
  const zoomPercentage = Math.round(previewScale * 100);
  const zoomTargetLabel = zoomTarget === 'preview' ? 'Preview' : 'Editor';

  const previewMetadataDisplay = React.useMemo(() => {
    if (!previewMetadata) {
      return null;
    }

    if (previewMetadata.kind === 'image') {
      const baseLabel = 'Image';
      const sizeText = `${previewMetadata.width} × ${previewMetadata.height} px`;
      const typeText = previewMetadata.mimeType
        ? (previewMetadata.mimeType.startsWith('image/')
            ? previewMetadata.mimeType.replace('image/', '').toUpperCase()
            : previewMetadata.mimeType.toUpperCase())
        : null;
      return {
        label: baseLabel,
        text: typeText ? `${sizeText} • ${typeText}` : sizeText,
      };
    }

    return null;
  }, [previewMetadata]);

  return (
    <footer className="flex items-center justify-between px-3 h-5 bg-secondary border-t border-border-color text-[11px] text-text-secondary flex-shrink-0 z-30 whitespace-nowrap">
      <div className="flex flex-1 items-center gap-2 whitespace-nowrap min-w-0">
        <div
          ref={statusTriggerRef}
          className="flex items-center cursor-default focus:outline-none"
          onMouseEnter={() => setShowStatusTooltip(true)}
          onMouseLeave={() => setShowStatusTooltip(false)}
          onFocus={() => setShowStatusTooltip(true)}
          onBlur={() => setShowStatusTooltip(false)}
          tabIndex={0}
          aria-label={text}
        >
          <div className={`w-2 h-2 rounded-full ${color}`}></div>
        </div>
        {showStatusTooltip && statusTriggerRef.current && (
          <Tooltip
            targetRef={statusTriggerRef}
            content={<span className="block whitespace-pre-line break-words leading-snug text-left">{tooltip}</span>}
          />
        )}
        <div className="h-4 w-px bg-border-color"></div>
        <div className="flex items-center gap-0.5">
          <label htmlFor="status-bar-provider-select" className="sr-only">LLM provider</label>
          <select
            id="status-bar-provider-select"
            value={selectedService?.id || ''}
            onChange={(e) => onProviderChange(e.target.value)}
            disabled={discoveredServices.length === 0}
            className="bg-transparent font-semibold text-text-main rounded-md py-0.5 px-1 -my-1 hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-4"
            aria-label="LLM provider"
            style={selectStyles}
          >
            {llmProviderName && !selectedService && <option value="" disabled>{llmProviderName}</option>}
            {discoveredServices.map(service => (
              <option key={service.id} value={service.id} className="bg-secondary text-text-main">{service.name}</option>
            ))}
            {discoveredServices.length === 0 && <option value="">{llmProviderName || 'N/A'}</option>}
          </select>
        </div>
        <div className="h-4 w-px bg-border-color"></div>
        <div className="flex items-center gap-0.5">
          <label htmlFor="status-bar-model-select" className="sr-only">LLM model</label>
          <select
            id="status-bar-model-select"
            value={modelName}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={availableModels.length === 0}
            className="bg-transparent font-semibold text-text-main rounded-md py-0.5 px-1 -my-1 hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-4"
            aria-label="LLM model"
            style={selectStyles}
          >
            {availableModels.length > 0 ? (
              availableModels.map(model => (
                <option key={model.id} value={model.id} className="bg-secondary text-text-main">{model.name}</option>
              ))
            ) : (
              <option value="">{modelName || 'N/A'}</option>
            )}
          </select>
        </div>
        <div className="h-4 w-px bg-border-color"></div>
        <button
          type="button"
          onClick={handleDatabaseMenu}
          onContextMenu={(event) => {
            event.preventDefault();
            handleDatabaseMenu(event);
          }}
          className={`flex items-center gap-1.5 px-1.5 py-1 -my-1 rounded-md transition-colors ${onDatabaseMenu ? 'hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer' : 'cursor-default'}`}
          disabled={!onDatabaseMenu}
          ref={databaseTriggerRef}
          onMouseEnter={() => setShowDatabaseTooltip(true)}
          onMouseLeave={() => setShowDatabaseTooltip(false)}
          onFocus={() => setShowDatabaseTooltip(true)}
          onBlur={() => setShowDatabaseTooltip(false)}
        >
          <DatabaseIcon className="w-3.5 h-3.5" />
          <span className="font-semibold text-text-main max-w-[180px] truncate" aria-label="Current database name">
            {databaseFileName}
          </span>
          <ChevronDownIcon className="w-3 h-3 text-text-secondary" />
        </button>
        {showDatabaseTooltip && databaseTriggerRef.current && (
          <Tooltip
            targetRef={databaseTriggerRef}
            content={<span className="block whitespace-pre-line break-words leading-snug text-left">{databaseTooltip}</span>}
            className="max-w-lg"
          />
        )}
        {databaseStatus?.message && (
          <>
            <div className="h-4 w-px bg-border-color"></div>
            <div className="flex flex-1 items-center min-w-0">
              <span
                ref={databaseStatusRef}
                className={`text-[11px] ${databaseStatusClass} truncate`}
                onMouseEnter={() => setShowDatabaseStatusTooltip(true)}
                onMouseLeave={() => setShowDatabaseStatusTooltip(false)}
                onFocus={() => setShowDatabaseStatusTooltip(true)}
                onBlur={() => setShowDatabaseStatusTooltip(false)}
                tabIndex={0}
              >
                {databaseStatus.message}
              </span>
              {showDatabaseStatusTooltip && databaseStatusRef.current && (
                <Tooltip
                  targetRef={databaseStatusRef}
                  content={<span className="block whitespace-pre-line break-words leading-snug text-left">{databaseStatus.message}</span>}
                />
              )}
            </div>
            <div className="h-4 w-px bg-border-color"></div>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5" role="group" aria-label={`Workspace zoom controls (${zoomTargetLabel})`}>
            <ZoomButton
              className={zoomButtonClass}
              onClick={onPreviewZoomOut}
              disabled={isZoomDisabled || isAtMinZoom}
              aria-label="Zoom out"
              hint="Zoom out"
              icon={<MinusIcon className="w-3.5 h-3.5" />}
            />
            <span className={zoomLabelClass}>{zoomPercentage}%</span>
            <ZoomButton
              className={zoomButtonClass}
              onClick={onPreviewZoomIn}
              disabled={isZoomDisabled || isAtMaxZoom}
              aria-label="Zoom in"
              hint="Zoom in"
              icon={<PlusIcon className="w-3.5 h-3.5" />}
            />
            <ZoomButton
              className={zoomButtonClass}
              onClick={onPreviewReset}
              disabled={isZoomDisabled || isAtInitialZoom}
              aria-label="Reset zoom"
              hint="Reset zoom"
              icon={<RefreshIcon className="w-3.5 h-3.5" />}
            />
            <span className="text-[10px] uppercase tracking-wide text-text-secondary ml-1">{zoomTargetLabel}</span>
          </div>
        </div>
        {previewMetadataDisplay && (
          <>
            <div className="h-4 w-px bg-border-color"></div>
            <span>
              {previewMetadataDisplay.label}:{' '}
              <span className="font-semibold text-text-main">{previewMetadataDisplay.text}</span>
            </span>
          </>
        )}
        <div className="h-4 w-px bg-border-color"></div>
        <span>Documents: <span className="font-semibold text-text-main">{documentCount}</span></span>
        <div className="h-4 w-px bg-border-color"></div>
        <span className="flex items-center gap-1">
          Last Saved:
          <span
            ref={lastSavedTriggerRef}
            className="font-semibold text-text-main"
            onMouseEnter={() => lastSavedDisplay && setShowLastSavedTooltip(true)}
            onMouseLeave={() => setShowLastSavedTooltip(false)}
            onFocus={() => lastSavedDisplay && setShowLastSavedTooltip(true)}
            onBlur={() => setShowLastSavedTooltip(false)}
            tabIndex={lastSavedDisplay ? 0 : undefined}
          >
            {lastSavedFallback ?? lastSavedDisplay?.relative ?? 'Not saved yet'}
          </span>
        </span>
        {lastSavedDisplay && showLastSavedTooltip && lastSavedTriggerRef.current && (
          <Tooltip
            targetRef={lastSavedTriggerRef}
            content={(
              <span className="block whitespace-pre-line break-words leading-snug text-left">
                {lastSavedDisplay.absolute}
              </span>
            )}
          />
        )}
        {appVersion && <div className="h-4 w-px bg-border-color"></div>}
        {appVersion && (
          onOpenAbout ? (
            <button
              type="button"
              onClick={onOpenAbout}
              className="px-1 -mx-1 rounded-sm font-semibold text-text-main hover:bg-border-color focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="About DocForge"
            >
              v{appVersion}
            </button>
          ) : (
            <span>v{appVersion}</span>
          )
        )}
      </div>
    </footer>
  );
};

export default StatusBar;
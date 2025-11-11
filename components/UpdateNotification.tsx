import React from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import { DownloadIcon, XIcon, CheckIcon, InfoIcon } from './Icons';
import IconButton from './IconButton';
import ToggleSwitch from './ToggleSwitch';
import { useLogger } from '../hooks/useLogger';

type UpdateNotificationStatus = 'downloading' | 'downloaded' | 'error';

interface UpdateNotificationProps {
  status: UpdateNotificationStatus;
  versionLabel: string;
  progress?: number;
  bytesTransferred?: number | null;
  bytesTotal?: number | null;
  errorMessage?: string | null;
  errorDetails?: string | null;
  onInstall?: () => void;
  autoInstallEnabled?: boolean;
  autoInstallSupported?: boolean;
  onAutoInstallChange?: (enabled: boolean) => void;
  onClose: () => void;
}

const formatBytes = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let displayValue = value;
  let unitIndex = 0;

  while (displayValue >= 1024 && unitIndex < units.length - 1) {
    displayValue /= 1024;
    unitIndex += 1;
  }

  const precision = displayValue < 10 && unitIndex > 0 ? 1 : 0;
  return `${displayValue.toFixed(precision)} ${units[unitIndex]}`;
};

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  status,
  versionLabel,
  progress = 0,
  bytesTransferred = null,
  bytesTotal = null,
  errorMessage,
  errorDetails,
  onInstall,
  autoInstallEnabled,
  autoInstallSupported = true,
  onAutoInstallChange,
  onClose,
}) => {
  const { addLog } = useLogger();
  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const transferredLabel = formatBytes(bytesTransferred);
  const totalLabel = formatBytes(bytesTotal);

  const iconConfig = {
    downloading: {
      className: 'bg-primary/10 text-primary',
      Icon: DownloadIcon,
    },
    downloaded: {
      className: 'bg-success/10 text-success',
      Icon: CheckIcon,
    },
    error: {
      className: 'bg-error/10 text-error',
      Icon: InfoIcon,
    },
  } satisfies Record<UpdateNotificationStatus, { className: string; Icon: React.FC<{ className?: string }> }>;

  const { className: iconClassName, Icon } = iconConfig[status];

  const logDismiss = () => {
    if (status === 'downloaded') {
      addLog('INFO', 'User action: Dismissed update notification ("Later").');
    } else if (status === 'downloading') {
      addLog('INFO', 'User action: Hid update download notification.');
    } else {
      addLog('INFO', 'User action: Dismissed update error notification.');
    }
  };

  const handleDismiss = () => {
    logDismiss();
    onClose();
  };

  const handleInstall = () => {
    if (onInstall) {
      addLog('INFO', 'User action: Clicked "Restart & Install" for update.');
      onInstall();
    }
  };

  const handleAutoInstallToggle = (value: boolean) => {
    if (!onAutoInstallChange) {
      return;
    }
    addLog('INFO', `User action: ${value ? 'Enabled' : 'Disabled'} automatic update installation from toast.`);
    onAutoInstallChange(value);
  };

  const renderContent = () => {
    if (status === 'downloaded') {
      return (
        <>
          <h3 className="font-semibold text-text-main">Update Ready to Install</h3>
          <p className="text-sm text-text-secondary mt-1">
            DocForge version <span className="font-semibold text-text-main">{versionLabel}</span> has been downloaded and is ready to go.
          </p>
          {typeof autoInstallEnabled === 'boolean' && (
            <div className="mt-4 space-y-3 rounded-lg border border-border-color/70 bg-background/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-main">Install updates automatically</p>
                  <p className="text-xs text-text-secondary">
                    {autoInstallSupported
                      ? 'DocForge will apply the update the next time you quit if this switch stays on.'
                      : 'Automatic installation is only available in the desktop app.'}
                  </p>
                </div>
                <ToggleSwitch
                  id="update-auto-install"
                  checked={autoInstallSupported ? autoInstallEnabled : false}
                  disabled={!autoInstallSupported}
                  onChange={handleAutoInstallToggle}
                />
              </div>
              {autoInstallSupported && !autoInstallEnabled && (
                <p className="text-xs text-warning">
                  Auto-install is off. You&apos;ll need to restart DocForge manually to finish this update.
                </p>
              )}
              {!autoInstallSupported && (
                <p className="text-xs text-text-secondary">
                  Switch to the desktop application to control automatic installation.
                </p>
              )}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            {onInstall && (
              <Button onClick={handleInstall} variant="primary" className="flex-1">
                Restart & Install
              </Button>
            )}
            <Button onClick={handleDismiss} variant="secondary">
              Later
            </Button>
          </div>
        </>
      );
    }

    if (status === 'error') {
      const fallbackMessage = `We ran into a hiccup while downloading DocForge ${versionLabel}. We'll automatically retry in the background. Feel free to keep working in the meantime.`;
      const friendlyMessage = errorMessage ?? fallbackMessage;
      return (
        <>
          <h3 className="font-semibold text-text-main">Automatic Update Paused</h3>
          <p className="text-sm text-text-secondary mt-1">
            {friendlyMessage}
          </p>
          {errorDetails && (
            <details className="mt-3 rounded-md border border-border-color/60 bg-secondary/40 p-3 text-xs text-text-secondary">
              <summary className="cursor-pointer text-xs font-semibold text-text-main">
                Technical details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-snug text-text-secondary/90">
                {errorDetails}
              </pre>
            </details>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleDismiss} variant="secondary">
              Dismiss
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <h3 className="font-semibold text-text-main">Downloading Update</h3>
        <p className="text-sm text-text-secondary mt-1">
          DocForge {versionLabel} is downloading quietly in the background. Feel free to keep working.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Download progress</span>
            <span className="font-medium text-text-main">{Math.round(safeProgress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-border-color/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-[width] duration-300 ease-out"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
          {transferredLabel && totalLabel && (
            <div className="flex items-center justify-between text-[0.7rem] text-text-secondary">
              <span>{transferredLabel}</span>
              <span>{totalLabel}</span>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleDismiss} variant="secondary">
              Hide
            </Button>
          </div>
        </div>
      </>
    );
  };

  const notificationContent = (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-slide-in-up">
      <div className="bg-secondary/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border-color p-5">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${iconClassName}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-1">
            {renderContent()}
          </div>
          <div className="-mt-2 -mr-2">
            <IconButton onClick={handleDismiss} tooltip="Close" size="sm" variant="ghost">
              <XIcon className="w-5 h-5" />
            </IconButton>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-in-up {
          from {
            transform: translateY(1rem);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in-up {
          animation: slide-in-up 0.28s ease-out forwards;
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(notificationContent, overlayRoot);
};

export default UpdateNotification;
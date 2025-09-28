import React from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import { DownloadIcon, XIcon } from './Icons';
import IconButton from './IconButton';
import { useLogger } from '../hooks/useLogger';

interface UpdateNotificationProps {
  version: string;
  onInstall: () => void;
  onClose: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ version, onInstall, onClose }) => {
  const { addLog } = useLogger();
  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  const notificationContent = (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-slide-in-up">
      <div className="bg-secondary rounded-lg shadow-2xl border border-border-color p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <DownloadIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-text-main">Update Ready to Install</h3>
            <p className="text-sm text-text-secondary mt-1">
              DocForge version <span className="font-bold">{version}</span> has been downloaded.
            </p>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => { addLog('INFO', 'User action: Clicked "Restart & Install" for update.'); onInstall(); }} variant="primary" className="flex-1">
                Restart & Install
              </Button>
              <Button onClick={() => { addLog('INFO', 'User action: Dismissed update notification ("Later").'); onClose(); }} variant="secondary">
                Later
              </Button>
            </div>
          </div>
          <div className="-mt-2 -mr-2">
            <IconButton onClick={() => { addLog('INFO', 'User action: Closed update notification.'); onClose(); }} tooltip="Close" size="sm" variant="ghost">
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
          animation: slide-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(notificationContent, overlayRoot);
};

export default UpdateNotification;
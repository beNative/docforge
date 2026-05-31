import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { WarningIcon } from './Icons';

interface DbStats {
  fileSize: string;
  nodeCount: number;
  documentCount: number;
  templateCount: number;
  modifiedTime: string;
}

interface ConflictResolutionModalProps {
  localStats: DbStats;
  remoteStats: DbStats;
  onResolve: (resolution: 'local' | 'remote') => void;
  onClose: () => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  localStats,
  remoteStats,
  onResolve,
  onClose,
}) => {
  const localDate = new Date(localStats.modifiedTime);
  const remoteDate = new Date(remoteStats.modifiedTime);

  const isLocalNewer = localDate.getTime() > remoteDate.getTime();
  const isRemoteNewer = remoteDate.getTime() > localDate.getTime();

  return (
    <Modal onClose={onClose} title="Database Sync Conflict Detected">
      <div className="flex flex-col">
        {/* Warning Banner */}
        <div className="p-4 bg-warning/10 border-b border-warning/20 flex gap-3 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center text-warning">
            <WarningIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-text-main mb-1">Divergent Database Changes</h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Both your local database and the cloud database have been modified independently since the last sync. 
              Please select which version you would like to keep. The other version will be overwritten.
            </p>
          </div>
        </div>

        {/* Comparison Area */}
        <div className="p-5 grid grid-cols-2 gap-4 bg-secondary">
          {/* Local Stats Card */}
          <div className={`p-4 rounded-lg border bg-background flex flex-col justify-between ${
            isLocalNewer ? 'border-primary/45 shadow-[0_0_12px_rgba(var(--color-primary),0.05)]' : 'border-border-color'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h5 className="text-xs font-semibold text-text-main">Local Database</h5>
                {isLocalNewer && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    Newer
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-[11px] text-text-secondary">
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Last Modified:</span>
                  <span className={`font-medium ${isLocalNewer ? 'text-primary' : 'text-text-main'}`}>
                    {localDate.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>File Size:</span>
                  <span className="text-text-main font-medium">{localStats.fileSize}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Folders & Documents:</span>
                  <span className="text-text-main font-medium">{localStats.nodeCount}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Document Templates:</span>
                  <span className="text-text-main font-medium">{localStats.templateCount}</span>
                </li>
              </ul>
            </div>
            <div className="mt-5">
              <Button
                variant={isLocalNewer ? 'primary' : 'secondary'}
                className="w-full text-xs"
                onClick={() => onResolve('local')}
              >
                Keep Local (Overwrite Cloud)
              </Button>
            </div>
          </div>

          {/* Cloud Stats Card */}
          <div className={`p-4 rounded-lg border bg-background flex flex-col justify-between ${
            isRemoteNewer ? 'border-primary/45 shadow-[0_0_12px_rgba(var(--color-primary),0.05)]' : 'border-border-color'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h5 className="text-xs font-semibold text-text-main">Cloud Database</h5>
                {isRemoteNewer && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    Newer
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-[11px] text-text-secondary">
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Last Modified:</span>
                  <span className={`font-medium ${isRemoteNewer ? 'text-primary' : 'text-text-main'}`}>
                    {remoteDate.toLocaleString()}
                  </span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>File Size:</span>
                  <span className="text-text-main font-medium">{remoteStats.fileSize}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Folders & Documents:</span>
                  <span className="text-text-main font-medium">{remoteStats.nodeCount}</span>
                </li>
                <li className="flex justify-between py-1 border-b border-border-color/30">
                  <span>Document Templates:</span>
                  <span className="text-text-main font-medium">{remoteStats.templateCount}</span>
                </li>
              </ul>
            </div>
            <div className="mt-5">
              <Button
                variant={isRemoteNewer ? 'primary' : 'secondary'}
                className="w-full text-xs"
                onClick={() => onResolve('remote')}
              >
                Keep Cloud (Overwrite Local)
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border-color rounded-b-lg">
          <Button onClick={onClose} variant="secondary" type="button" className="text-xs">
            Cancel & Resolve Later
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictResolutionModal;

import React, { useState, useEffect } from 'react';
import { MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from './Icons';
import IconButton from './IconButton';

const isElectron = window.electronAPI;

const CustomTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    if (isElectron) {
      isElectron.getPlatform().then(setPlatform);
      const removeListener = isElectron.onWindowStateChange(({ isMaximized: maximized }) => {
        setIsMaximized(maximized);
      });
      return () => removeListener();
    }
  }, []);

  if (!isElectron) {
    return null; // Don't render on web
  }

  const handleMinimize = () => isElectron.minimizeWindow();
  const handleMaximize = () => isElectron.maximizeWindow();
  const handleClose = () => isElectron.closeWindow();
  
  const isMac = platform === 'darwin';

  const windowControls = (
    <div className={`flex items-center ${isMac ? 'pl-1' : 'pr-1'}`}>
      <IconButton onClick={handleMinimize} tooltip="Minimize" size="md" variant="ghost">
        <MinimizeIcon className="w-4 h-4" />
      </IconButton>
      <IconButton onClick={handleMaximize} tooltip={isMaximized ? "Restore" : "Maximize"} size="md" variant="ghost">
        {isMaximized ? <RestoreIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
      </IconButton>
      <IconButton onClick={handleClose} tooltip="Close" size="md" variant="destructive">
        <CloseIcon className="w-4 h-4" />
      </IconButton>
    </div>
  );

  return (
    <div className="h-9 flex-shrink-0 bg-secondary flex justify-between items-center z-40 border-b border-border-color">
      <div className="flex-1 h-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}></div>
      <div className={`h-full flex items-center ${isMac ? 'order-first' : 'order-last'}`}>
        {windowControls}
      </div>
    </div>
  );
};

export default CustomTitleBar;

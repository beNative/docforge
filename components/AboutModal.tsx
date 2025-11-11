import React, { useCallback, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';

const appIconUrl = new URL('../assets/icon.svg', import.meta.url).href;

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const githubLinkRef = useRef<HTMLAnchorElement>(null);
  const handleOpenExecutableFolder = useCallback(async () => {
    try {
      const result = await window.electronAPI?.openExecutableFolder?.();
      if (result && !result.success && result.error) {
        console.error('Failed to open executable folder:', result.error);
      }
    } catch (error) {
      console.error('Failed to open executable folder:', error);
    }
  }, []);

  return (
    <Modal title="About DocForge" onClose={onClose} initialFocusRef={githubLinkRef}>
      <div className="p-8 text-center text-text-main space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border-color bg-background shadow-sm">
            <img src={appIconUrl} alt="DocForge application icon" className="h-12 w-12" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">DocForge</p>
            <p className="text-sm text-text-secondary">© 2025 Tim Sinaeve. All rights reserved.</p>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              ref={githubLinkRef}
              href="https://github.com/beNative/docforge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-md border border-transparent bg-primary text-primary-text hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-colors duration-150"
            >
              View source on GitHub
            </a>
            <Button
              type="button"
              variant="secondary"
              onClick={handleOpenExecutableFolder}
              className="text-xs"
            >
              Open installation folder
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AboutModal;

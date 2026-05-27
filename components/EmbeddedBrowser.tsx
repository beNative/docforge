import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, RefreshIcon, ExternalLinkIcon, SaveIcon, GlobeIcon } from './Icons';
import IconButton from './IconButton';

interface EmbeddedBrowserProps {
  url: string;
  isLocked: boolean;
  onSaveLocation: (url: string) => void;
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({ url, isLocked, onSaveLocation }) => {
  const [webviewElement, setWebviewElement] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const webviewRef = useCallback((node: any) => {
    if (node !== null) {
      setWebviewElement(node);
    }
  }, []);

  // Sync loaded URL with the prop url when it changes
  useEffect(() => {
    if (!webviewElement) return;

    try {
      const activeUrl = webviewElement.getURL();
      if (activeUrl !== url) {
        webviewElement.loadURL(url);
      }
    } catch {
      try {
        webviewElement.loadURL(url);
      } catch (e) {
        console.warn('Failed to load url in webview:', e);
      }
    }
    setCurrentUrl(url);
    setInputUrl(url);
  }, [webviewElement, url]);

  // Handle webview event listeners and navigation state updating
  useEffect(() => {
    if (!webviewElement) return;

    const updateNavigationState = () => {
      try {
        setCanGoBack(webviewElement.canGoBack());
        setCanGoForward(webviewElement.canGoForward());
        const activeUrl = webviewElement.getURL();
        setCurrentUrl(activeUrl);
        setInputUrl(activeUrl);
      } catch (err) {
        // Ignored if webview isn't ready
      }
    };

    const handleDomReady = () => {
      updateNavigationState();
    };

    const handleDidNavigate = () => {
      updateNavigationState();
    };

    const handleDidNavigateInPage = () => {
      updateNavigationState();
    };

    webviewElement.addEventListener('dom-ready', handleDomReady);
    webviewElement.addEventListener('did-navigate', handleDidNavigate);
    webviewElement.addEventListener('did-navigate-in-page', handleDidNavigateInPage);

    return () => {
      webviewElement.removeEventListener('dom-ready', handleDomReady);
      webviewElement.removeEventListener('did-navigate', handleDidNavigate);
      webviewElement.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
    };
  }, [webviewElement]);

  const handleBack = () => {
    if (webviewElement && webviewElement.canGoBack()) {
      webviewElement.goBack();
    }
  };

  const handleForward = () => {
    if (webviewElement && webviewElement.canGoForward()) {
      webviewElement.goForward();
    }
  };

  const handleReload = () => {
    if (webviewElement) {
      webviewElement.reload();
    }
  };

  const handleOpenExternal = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(currentUrl);
    } else {
      window.open(currentUrl, '_blank');
    }
  };

  const handleSave = () => {
    if (isLocked) return;
    onSaveLocation(currentUrl);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputUrl.trim();
    if (!targetUrl) return;

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    if (webviewElement) {
      try {
        webviewElement.loadURL(targetUrl);
      } catch (err) {
        console.error('Failed to navigate webview:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Browser Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-secondary border-b border-border-color select-none">
        <div className="flex items-center gap-1">
          <IconButton
            onClick={handleBack}
            disabled={!canGoBack}
            tooltip="Back"
            size="sm"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </IconButton>
          <IconButton
            onClick={handleForward}
            disabled={!canGoForward}
            tooltip="Forward"
            size="sm"
          >
            <ArrowRightIcon className="w-4 h-4" />
          </IconButton>
          <IconButton
            onClick={handleReload}
            tooltip="Reload"
            size="sm"
          >
            <RefreshIcon className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleAddressSubmit} className="flex-1 flex items-center">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            disabled={isLocked}
            placeholder="Search or enter website address"
            className="w-full bg-background text-text-main text-sm px-3 py-1.5 rounded border border-border-color/80 focus:border-primary focus:outline-none disabled:opacity-60 transition"
          />
        </form>

        <div className="flex items-center gap-1">
          {/* Save Location Button */}
          <IconButton
            onClick={handleSave}
            disabled={isLocked || currentUrl === url}
            tooltip={isLocked ? "Document Locked" : currentUrl === url ? "Location Saved" : "Save current page as new version"}
            size="sm"
            className={`transition-colors duration-200 ${
              !isLocked && currentUrl !== url
                ? "text-primary hover:text-primary-hover bg-primary/10 border border-primary/20 hover:bg-primary/20"
                : ""
            }`}
          >
            <SaveIcon className="w-4 h-4" />
          </IconButton>

          {/* Open External Button */}
          <IconButton
            onClick={handleOpenExternal}
            tooltip="Open in default browser"
            size="sm"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* WebView Container */}
      <div className="flex-1 w-full bg-white relative">
        {isElectron ? (
          <webview
            ref={webviewRef}
            src={url}
            className="w-full h-full border-none block"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary p-8 text-center select-none">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <GlobeIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-text-main mb-2">Embedded Browser Unavailable</h3>
            <p className="text-sm text-text-secondary max-w-md mb-6">
              The embedded web browser requires running DocForge as a desktop application. You can still open the link directly in your browser.
            </p>
            <button
              onClick={handleOpenExternal}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded text-sm font-medium transition"
            >
              Open in external browser
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedBrowser;

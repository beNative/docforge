import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, RefreshIcon, ExternalLinkIcon, SaveIcon, GlobeIcon, WarningIcon } from './Icons';
import IconButton from './IconButton';

interface EmbeddedBrowserProps {
  url: string;
  isLocked: boolean;
  onSaveLocation: (url: string) => void;
  zoomScale?: number;
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const normalizeBrowserUrl = (raw: string): string => {
  let target = raw.trim();
  if (!target) return '';
  if (/^(https?|file):\/\//i.test(target)) {
    return target;
  }
  // Localhost or direct IP addresses default to http
  if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i.test(target)) {
    return `http://${target}`;
  }
  return `https://${target}`;
};

const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({ url, isLocked, onSaveLocation, zoomScale = 1.0 }) => {
  const [webviewElement, setWebviewElement] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<{ errorCode: number; errorDescription: string; validatedURL: string } | null>(null);

  const webviewRef = useCallback((node: any) => {
    if (node !== null) {
      setWebviewElement(node);
    }
  }, []);

  // Sync loaded URL with the prop url when it changes
  useEffect(() => {
    setLoadError(null);
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

  // Apply zoom factor when scale changes or webview is loaded
  useEffect(() => {
    if (!webviewElement || typeof webviewElement.setZoomFactor !== 'function') return;
    try {
      webviewElement.setZoomFactor(zoomScale);
    } catch (err) {
      console.warn('Failed to set zoom factor:', err);
    }
  }, [webviewElement, zoomScale]);

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
      try {
        if (typeof webviewElement.setZoomFactor === 'function') {
          webviewElement.setZoomFactor(zoomScale);
        }
      } catch (err) {
        console.warn('Failed to set zoom factor on dom-ready:', err);
      }
    };

    const handleDidStartLoading = () => {
      setIsLoading(true);
      setLoadError(null);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      updateNavigationState();
    };

    const handleDidNavigate = () => {
      updateNavigationState();
    };

    const handleDidNavigateInPage = () => {
      updateNavigationState();
    };

    const handleDidFailLoad = (event: any) => {
      setIsLoading(false);
      // errorCode -3 is ERR_ABORTED (e.g. user clicked another link or navigated away) - ignore it
      if (event.errorCode && event.errorCode !== -3) {
        setLoadError({
          errorCode: event.errorCode,
          errorDescription: event.errorDescription || 'The page failed to load.',
          validatedURL: event.validatedURL || currentUrl,
        });
      }
    };

    webviewElement.addEventListener('dom-ready', handleDomReady);
    webviewElement.addEventListener('did-start-loading', handleDidStartLoading);
    webviewElement.addEventListener('did-stop-loading', handleDidStopLoading);
    webviewElement.addEventListener('did-navigate', handleDidNavigate);
    webviewElement.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
    webviewElement.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      webviewElement.removeEventListener('dom-ready', handleDomReady);
      webviewElement.removeEventListener('did-start-loading', handleDidStartLoading);
      webviewElement.removeEventListener('did-stop-loading', handleDidStopLoading);
      webviewElement.removeEventListener('did-navigate', handleDidNavigate);
      webviewElement.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
      webviewElement.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [webviewElement, zoomScale, currentUrl]);

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
    setLoadError(null);
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
    const targetUrl = normalizeBrowserUrl(inputUrl);
    if (!targetUrl) return;

    setLoadError(null);
    if (webviewElement) {
      try {
        webviewElement.loadURL(targetUrl);
      } catch (err) {
        console.error('Failed to navigate webview:', err);
      }
    }
  };

  const handleTryHttp = () => {
    if (!loadError) return;
    const httpUrl = loadError.validatedURL.replace(/^https:\/\//i, 'http://');
    setInputUrl(httpUrl);
    setLoadError(null);
    if (webviewElement) {
      try {
        webviewElement.loadURL(httpUrl);
      } catch (err) {
        console.error('Failed to navigate to http:', err);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-background overflow-hidden">
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
            <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
          <>
            <webview
              ref={webviewRef}
              src={url}
              allowpopups=""
              className="absolute inset-0 w-full h-full border-none inline-flex"
            />
            {loadError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-secondary p-8 text-center select-none">
                <div className="w-14 h-14 rounded-full bg-destructive-bg flex items-center justify-center mb-4 text-destructive-text">
                  <WarningIcon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-text-main mb-2">Page Failed to Load</h3>
                <p className="text-sm text-text-secondary max-w-md mb-2 font-mono break-all">
                  {loadError.validatedURL}
                </p>
                <p className="text-xs text-text-secondary/80 max-w-md mb-6">
                  {loadError.errorDescription} (Code {loadError.errorCode})
                </p>
                <div className="flex items-center gap-3">
                  {loadError.validatedURL.startsWith('https://') && (
                    <button
                      onClick={handleTryHttp}
                      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded text-sm font-medium transition"
                    >
                      Try with HTTP
                    </button>
                  )}
                  <button
                    onClick={handleReload}
                    className="px-4 py-2 bg-background hover:bg-surface border border-border-color text-text-main rounded text-sm font-medium transition"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded text-sm font-medium transition"
                  >
                    Open Externally
                  </button>
                </div>
              </div>
            )}
          </>
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

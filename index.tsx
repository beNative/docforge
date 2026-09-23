import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PythonConsoleApp from './components/PythonConsoleApp';
import ErrorBoundary from './components/ErrorBoundary';
import { LoggerProvider } from './contexts/LoggerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { IconProvider } from './contexts/IconContext';
import { createScriptPreviewBridge } from './preview/createScriptPreviewBridge';

// Global error handling to capture any uncaught errors and log them to file
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const errorMsg = event.error?.stack || `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
    console.error('[Global Uncaught Error]', errorMsg);
    if (window.electronAPI?.log) {
      try {
        window.electronAPI.log({
          level: 'ERROR',
          message: `[Uncaught Exception] ${errorMsg}`,
        });
      } catch (e) {
        console.warn('Failed to dispatch global error to log:', e);
      }
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.stack || (event.reason instanceof Error ? event.reason.message : String(event.reason));
    console.error('[Global Unhandled Rejection]', reason);
    if (window.electronAPI?.log) {
      try {
        window.electronAPI.log({
          level: 'ERROR',
          message: `[Unhandled Promise Rejection] ${reason}`,
        });
      } catch (e) {
        console.warn('Failed to dispatch unhandled rejection to log:', e);
      }
    }
  });
}

const params = new URLSearchParams(window.location.search);
const isPythonConsole = params.get('python-console') === '1';
const runIdParam = params.get('runId') ?? '';
const consoleThemeParam = params.get('theme') === 'light' ? 'light' : 'dark';
const enableScriptPreview = params.get('script-preview') === '1';

if (enableScriptPreview && !window.__DOCFORGE_SCRIPT_PREVIEW__) {
  window.__DOCFORGE_SCRIPT_PREVIEW__ = createScriptPreviewBridge();
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="An unexpected error occurred in DocForge.">
        <LoggerProvider>
          <ThemeProvider>
            <IconProvider value={{ iconSet: 'heroicons' }}>
              {isPythonConsole ? (
                <PythonConsoleApp runId={runIdParam} theme={consoleThemeParam} />
              ) : (
                <App />
              )}
            </IconProvider>
          </ThemeProvider>
        </LoggerProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('Fatal: Could not find root element to mount the application.');
}
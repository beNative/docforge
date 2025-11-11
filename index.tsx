import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PythonConsoleApp from './components/PythonConsoleApp';
import { LoggerProvider } from './contexts/LoggerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { IconProvider } from './contexts/IconContext';
import { EmojiPickerProvider } from './contexts/EmojiPickerContext';
import { createScriptPreviewBridge } from './preview/createScriptPreviewBridge';

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
      <LoggerProvider>
        <ThemeProvider>
          <IconProvider value={{ iconSet: 'heroicons' }}>
            <EmojiPickerProvider>
              {isPythonConsole ? (
                <PythonConsoleApp runId={runIdParam} theme={consoleThemeParam} />
              ) : (
                <App />
              )}
            </EmojiPickerProvider>
          </IconProvider>
        </ThemeProvider>
      </LoggerProvider>
    </React.StrictMode>
  );
} else {
  console.error('Fatal: Could not find root element to mount the application.');
}
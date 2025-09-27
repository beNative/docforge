import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LoggerProvider } from './contexts/LoggerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { IconProvider } from './contexts/IconContext';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <LoggerProvider>
        <ThemeProvider>
          <IconProvider value={{ iconSet: 'heroicons' }}>
            <App />
          </IconProvider>
        </ThemeProvider>
      </LoggerProvider>
    </React.StrictMode>
  );
} else {
    console.error('Fatal: Could not find root element to mount the application.');
}

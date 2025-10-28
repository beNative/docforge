
// Fix: Implement the storageService module to resolve the "is not a module" error.
// This service provides an abstraction for both localStorage and Electron-specific file operations.

export const storageService = {
  /**
   * Saves a value to localStorage.
   * @param key The key to save under.
   * @param value The value to save.
   */
  save: async <T>(key: string, value: T): Promise<void> => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving to localStorage for key "${key}":`, error);
    }
  },
  
  /**
   * Loads a value from localStorage.
   * @param key The key to load from.
   * @param defaultValue The default value to return if the key doesn't exist.
   * @returns The loaded value or the default value.
   */
  load: async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error loading from localStorage for key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Saves the entire log content to a file using the Electron dialog.
   * @param content The string content of the logs to save.
   */
  saveLogToFile: async (content: string): Promise<void> => {
    if (window.electronAPI?.saveLog) {
      // The default filename is handled in the main process via the saveLog preload method
      const result = await window.electronAPI.saveLog('', content);
      if (!result.success) {
        if (result.canceled) {
          return;
        }
        throw new Error(result.error || 'Failed to save log file.');
      }
    } else {
      // Fallback for web environments
      console.warn("Saving logs is only supported in the desktop application.");
      // In a web environment, we can offer a download link as a fallback.
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docforge-log-${new Date().toISOString().split('T')[0]}.log`;
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Appends log content to a file.
   * NOTE: This functionality is not exposed through the current preload script.
   * A more robust implementation would require main process changes. This is a placeholder.
   * @param content The string content to append.
   */
  appendLogToFile: async (content: string): Promise<void> => {
    // This feature is not fully implemented in the electron backend.
    // Logging a warning to avoid silent failures.
    if (window.electronAPI) {
        console.warn('appendLogToFile is not implemented in the Electron backend.');
    }
  },
};
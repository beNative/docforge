declare global {
  interface Window {
    __monacoLoaderPromise?: Promise<any>;
  }
}

const MONACO_BASE_URL = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs';
const MONACO_LOADER_URL = `${MONACO_BASE_URL}/loader.js`;

const configureMonacoEnvironment = (win: any) => {
  if (!win.MonacoEnvironment) {
    win.MonacoEnvironment = {
      getWorkerUrl: (_moduleId: unknown, label: string) => {
        if (label === 'json') return `${MONACO_BASE_URL}/language/json/json.worker.js`;
        if (label === 'css' || label === 'scss' || label === 'less') {
          return `${MONACO_BASE_URL}/language/css/css.worker.js`;
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return `${MONACO_BASE_URL}/language/html/html.worker.js`;
        }
        if (label === 'typescript' || label === 'javascript') {
          return `${MONACO_BASE_URL}/language/typescript/ts.worker.js`;
        }
        return `${MONACO_BASE_URL}/editor/editor.worker.js`;
      },
    };
  }
};

const loadMonacoWithLoader = (win: any) => {
  return new Promise<any>((resolve, reject) => {
    const onAmdLoaderAvailable = () => {
      const amdRequire = win.require;
      if (!amdRequire) {
        reject(new Error('Monaco AMD loader is unavailable.'));
        return;
      }

      configureMonacoEnvironment(win);
      amdRequire.config({ paths: { vs: MONACO_BASE_URL } });
      amdRequire(
        ['vs/editor/editor.main'],
        () => {
          if (win.monaco) {
            resolve(win.monaco);
          } else {
            reject(new Error('Monaco editor failed to initialize.'));
          }
        },
        (error: unknown) => reject(error),
      );
    };

    if (win.require) {
      onAmdLoaderAvailable();
      return;
    }

    const script = document.createElement('script');
    script.src = MONACO_LOADER_URL;
    script.async = true;
    script.onload = onAmdLoaderAvailable;
    script.onerror = () => {
      reject(new Error('Failed to load Monaco AMD loader.'));
    };
    document.body.appendChild(script);
  });
};

export const ensureMonaco = async (): Promise<any | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as any;

  if (win.monaco) {
    configureMonacoEnvironment(win);
    return win.monaco;
  }

  if (!win.__monacoLoaderPromise) {
    win.__monacoLoaderPromise = loadMonacoWithLoader(win).catch((error: unknown) => {
      win.__monacoLoaderPromise = undefined;
      throw error;
    });
  }

  return win.__monacoLoaderPromise;
};


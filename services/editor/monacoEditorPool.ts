import { ensureMonaco } from './monacoLoader';

declare const monaco: any;

export interface PooledEditorInfo {
  editor: any;
  container: HTMLDivElement;
}

class MonacoEditorPool {
  private sharedEditor: any = null;
  private sharedContainer: HTMLDivElement | null = null;
  private modelCache = new Map<string, { model: any; viewState: any }>();
  private currentDocumentId: string | null = null;

  /**
   * Returns the single shared Monaco editor instance and its DOM container.
   * If the editor hasn't been created yet, it will initialize it offscreen.
   */
  public async getSharedEditor(): Promise<PooledEditorInfo> {
    if (this.sharedEditor) {
      return { editor: this.sharedEditor, container: this.sharedContainer! };
    }

    const monacoApi = await ensureMonaco();
    if (!monacoApi) {
      throw new Error('Monaco API could not be loaded');
    }

    // Create the container element offscreen/floating
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.className = 'docforge-shared-monaco-editor-container';

    // Create the editor instance
    const editor = monacoApi.editor.create(container, {
      automaticLayout: true,
      minimap: { enabled: true },
      wordWrap: 'on',
      folding: true,
      showFoldingControls: 'always',
      bracketPairColorization: { enabled: true },
    });

    this.sharedEditor = editor;
    this.sharedContainer = container;

    return { editor, container };
  }

  /**
   * Retrieves or creates a TextModel for the specified document.
   * If content or language has changed externally, it updates the model.
   */
  public getOrCreateModel(documentId: string, content: string, language: string): any {
    const monacoApi = (window as any).monaco;
    if (!monacoApi) return null;

    let cache = this.modelCache.get(documentId);
    if (!cache) {
      const uri = monacoApi.Uri.parse(`inmemory://model/${documentId}`);
      // Check if a model already exists under this Uri
      let model = monacoApi.editor.getModel(uri);
      if (!model) {
        model = monacoApi.editor.createModel(content, language || 'plaintext', uri);
      } else {
        if (model.getValue() !== content) {
          model.setValue(content);
        }
        if (model.getLanguageId() !== (language || 'plaintext')) {
          monacoApi.editor.setModelLanguage(model, language || 'plaintext');
        }
      }
      cache = { model, viewState: null };
      this.modelCache.set(documentId, cache);
    } else {
      // Update model content if it differs
      if (cache.model.getValue() !== content) {
        cache.model.setValue(content);
      }
      // Update model language if it differs
      const currentLang = cache.model.getLanguageId();
      if (currentLang !== (language || 'plaintext')) {
        monacoApi.editor.setModelLanguage(cache.model, language || 'plaintext');
      }
    }
    return cache.model;
  }

  /**
   * Saves the view state (cursor, scroll positions) of the current document.
   */
  public saveCurrentViewState() {
    if (this.sharedEditor && this.currentDocumentId) {
      const viewState = this.sharedEditor.saveViewState();
      const cache = this.modelCache.get(this.currentDocumentId);
      if (cache) {
        cache.viewState = viewState;
      }
    }
  }

  /**
   * Switches the shared editor to target the specified document.
   * Restores previously saved view state if available.
   */
  public switchToDocument(documentId: string, content: string, language: string) {
    if (!this.sharedEditor) return;

    this.saveCurrentViewState();

    this.currentDocumentId = documentId;
    const model = this.getOrCreateModel(documentId, content, language);
    if (model) {
      this.sharedEditor.setModel(model);
      
      const cache = this.modelCache.get(documentId);
      if (cache && cache.viewState) {
        this.sharedEditor.restoreViewState(cache.viewState);
      } else {
        this.sharedEditor.setScrollTop(0);
        this.sharedEditor.setPosition({ lineNumber: 1, column: 1 });
      }
    }
  }

  /**
   * Disposes of a model and deletes it from cache.
   * Use this when a document tab is closed or a document is deleted.
   */
  public disposeModel(documentId: string) {
    const cache = this.modelCache.get(documentId);
    if (cache) {
      if (cache.model) {
        cache.model.dispose();
      }
      this.modelCache.delete(documentId);
    }
    if (this.currentDocumentId === documentId) {
      this.currentDocumentId = null;
    }
  }

  /**
   * Cleans up all cached models and resets state.
   */
  public clearAll() {
    this.modelCache.forEach(cache => {
      if (cache.model) {
        cache.model.dispose();
      }
    });
    this.modelCache.clear();
    this.currentDocumentId = null;
  }
}

export const monacoEditorPool = new MonacoEditorPool();

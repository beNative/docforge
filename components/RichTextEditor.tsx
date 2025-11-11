import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Spinner from './Spinner';
import '@ckeditor/ckeditor5-build-classic/build/ckeditor.css';

type CKEditorComponentType = typeof import('@ckeditor/ckeditor5-react')['CKEditor'];
type ClassicEditorConstructor = typeof import('@ckeditor/ckeditor5-build-classic')['default'];

type EditorBundle = {
  CKEditor: CKEditorComponentType;
  ClassicEditor: ClassicEditorConstructor;
};

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  onScroll,
  onFocusChange,
}) => {
  const [editorBundle, setEditorBundle] = useState<EditorBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const editableElementRef = useRef<HTMLElement | null>(null);
  const scrollHandlerRef = useRef<((event: Event) => void) | null>(null);
  const onScrollRef = useRef(onScroll);
  const onFocusChangeRef = useRef(onFocusChange);
  const lastDataRef = useRef(content);

  useEffect(() => {
    onScrollRef.current = onScroll;
  }, [onScroll]);

  useEffect(() => {
    onFocusChangeRef.current = onFocusChange;
  }, [onFocusChange]);

  useEffect(() => {
    lastDataRef.current = content;
  }, [content]);

  useEffect(() => {
    let isMounted = true;

    const loadEditor = async () => {
      if (typeof window === 'undefined') {
        setLoadError('Rich text editor is not available in this environment.');
        return;
      }

      try {
        const [{ CKEditor }, ClassicEditorModule] = await Promise.all([
          import('@ckeditor/ckeditor5-react'),
          import('@ckeditor/ckeditor5-build-classic'),
        ]);
        if (!isMounted) return;
        setEditorBundle({ CKEditor, ClassicEditor: ClassicEditorModule.default });
      } catch (error) {
        console.error('Failed to load CKEditor 5:', error);
        if (isMounted) {
          setLoadError('Failed to load the rich text editor.');
        }
      }
    };

    loadEditor();

    return () => {
      isMounted = false;
      if (editableElementRef.current && scrollHandlerRef.current) {
        editableElementRef.current.removeEventListener('scroll', scrollHandlerRef.current);
      }
    };
  }, []);

  const editorConfig = useMemo(() => ({
    toolbar: [
      'heading',
      '|',
      'bold',
      'italic',
      'link',
      'bulletedList',
      'numberedList',
      'blockQuote',
      'insertTable',
      'undo',
      'redo',
    ],
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
    },
  }), []);

  const attachScrollHandler = useCallback((element: HTMLElement) => {
    if (!element) return;
    if (scrollHandlerRef.current && editableElementRef.current) {
      editableElementRef.current.removeEventListener('scroll', scrollHandlerRef.current);
    }

    const handler = (event: Event) => {
      if (!onScrollRef.current) return;
      const target = event.currentTarget as HTMLDivElement | null;
      if (!target) return;
      const syntheticEvent = {
        currentTarget: target,
        target,
      } as unknown as React.UIEvent<HTMLDivElement>;
      onScrollRef.current(syntheticEvent);
    };

    element.addEventListener('scroll', handler, { passive: true });
    editableElementRef.current = element;
    scrollHandlerRef.current = handler;
  }, []);

  const handleReady = useCallback((editor: unknown) => {
    setIsEditorReady(true);
    if (!editor || typeof editor !== 'object') {
      return;
    }

    const anyEditor = editor as {
      ui?: {
        getEditableElement?: () => HTMLElement | null;
        view?: { editable?: { element?: HTMLElement | null } };
      };
      editing?: {
        view?: {
          document: { getRoot: () => unknown };
          change: (callback: (writer: { setStyle: (prop: string, value: string, root: unknown) => void }) => void) => void;
        };
      };
      on?: (event: string, callback: () => void) => void;
    };

    const editable = anyEditor.ui?.getEditableElement?.() ?? anyEditor.ui?.view?.editable?.element ?? null;

    if (editable) {
      editable.style.minHeight = '100%';
      editable.style.height = '100%';
      editable.style.overflowY = 'auto';
      if (editable.parentElement) {
        editable.parentElement.style.height = '100%';
      }
      attachScrollHandler(editable);
    }

    const view = anyEditor.editing?.view;
    if (view?.document && view?.change) {
      try {
        view.change((writer) => {
          const root = view.document.getRoot();
          writer.setStyle('min-height', '100%', root);
        });
      } catch {
        // If styling fails, continue without throwing.
      }
    }
  }, [attachScrollHandler]);

  const handleChange = useCallback((_: unknown, editor: { getData: () => string }) => {
    const data = editor.getData();
    if (data === lastDataRef.current) {
      return;
    }
    lastDataRef.current = data;
    onChange(data);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    onFocusChangeRef.current?.(true);
  }, []);

  const handleBlur = useCallback(() => {
    onFocusChangeRef.current?.(false);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-destructive-text bg-secondary">
        {loadError}
      </div>
    );
  }

  if (!editorBundle) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-secondary bg-secondary">
        <Spinner />
        <span className="ml-2">Loading rich text editor...</span>
      </div>
    );
  }

  const { CKEditor, ClassicEditor } = editorBundle;

  return (
    <div className="relative w-full h-full">
      {!isEditorReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Spinner />
        </div>
      )}
      <div className="h-full">
        <CKEditor
          editor={ClassicEditor}
          data={content}
          disabled={readOnly}
          config={editorConfig}
          onReady={handleReady}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;

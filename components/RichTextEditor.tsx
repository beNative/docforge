import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import '@ckeditor/ckeditor5-theme-lark/dist/index.css';

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number; }) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

type ClassicEditorInstance = InstanceType<typeof ClassicEditor>;

type MaybeEditor = ClassicEditorInstance | null;

type EditorEventHandler = (_event: unknown, editor: ClassicEditorInstance) => void;

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, readOnly = false, onScroll, onFocusChange }) => {
  const editorRef = useRef<MaybeEditor>(null);
  const [isReady, setIsReady] = useState(false);
  const lastKnownDataRef = useRef(content);

  const attachScrollListener = useCallback((editor: ClassicEditorInstance) => {
    if (!onScroll) return () => undefined;
    const editable = editor.ui.view.editable.element;
    if (!editable) return () => undefined;

    const handleScroll = () => {
      onScroll({
        scrollTop: editable.scrollTop,
        scrollHeight: editable.scrollHeight,
        clientHeight: editable.clientHeight,
      });
    };

    editable.addEventListener('scroll', handleScroll);
    return () => {
      editable.removeEventListener('scroll', handleScroll);
    };
  }, [onScroll]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!isReady || !editor) return;

    const currentData = editor.getData();
    if (content !== currentData) {
      editor.setData(content);
      lastKnownDataRef.current = content;
    }
  }, [content, isReady]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!isReady || !editor || !onScroll) return undefined;

    return attachScrollListener(editor);
  }, [attachScrollListener, isReady, onScroll]);

  const handleReady = useCallback((editor: ClassicEditorInstance) => {
    editorRef.current = editor;
    setIsReady(true);
    editor.setData(content);
    lastKnownDataRef.current = content;
    onFocusChange?.(false);
  }, [content, onFocusChange]);

  const handleChange: EditorEventHandler = useCallback((_event, editor) => {
    const data = editor.getData();
    lastKnownDataRef.current = data;
    onChange(data);
  }, [onChange]);

  const handleFocus: EditorEventHandler = useCallback((_event, _editor) => {
    onFocusChange?.(true);
  }, [onFocusChange]);

  const handleBlur: EditorEventHandler = useCallback((_event, editor) => {
    onFocusChange?.(false);
    if (onScroll) {
      const editable = editor.ui.view.editable.element;
      if (editable) {
        onScroll({
          scrollTop: editable.scrollTop,
          scrollHeight: editable.scrollHeight,
          clientHeight: editable.clientHeight,
        });
      }
    }
  }, [onFocusChange, onScroll]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (readOnly) {
      editor.enableReadOnlyMode('docforge-rich-text');
    } else {
      editor.disableReadOnlyMode('docforge-rich-text');
    }
  }, [readOnly]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <CKEditor
        editor={ClassicEditor}
        data={content}
        disabled={readOnly}
        onReady={handleReady}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        config={{
          toolbar: {
            shouldNotGroupWhenFull: true,
          },
        }}
      />
    </div>
  );
};

export default RichTextEditor;

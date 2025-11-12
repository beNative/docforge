import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import '../styles/ckeditor-theme-lark.css';

import { CKEDITOR_LICENSE_KEY, resolveCkeditorLicenseKey } from '../utils/ckeditorLicense';

(ClassicEditor as unknown as { defaultConfig?: Record<string, unknown> }).defaultConfig = {
  ...((ClassicEditor as unknown as { defaultConfig?: Record<string, unknown> }).defaultConfig ?? {}),
  licenseKey: CKEDITOR_LICENSE_KEY,
};

export interface RichTextEditorHandle {
  getHtml: () => string;
  focus: () => void;
  execute: (command: string, value?: unknown) => void;
  format: () => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }>;
  setScrollTop: (scrollTop: number) => void;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  onScroll?: (info: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

const RichTextEditor = React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, onChange, readOnly = false, onScroll, onFocusChange }, ref) => {
    const editorRef = useRef<any>(null);
    const lastDataRef = useRef<string>(content);
    const readOnlyIdRef = useRef<string>('docforge-rich-text-editor');
    const focusCleanupRef = useRef<(() => void) | null>(null);
    const [isReady, setIsReady] = useState(false);
    const licenseKeyRef = useRef<string>(CKEDITOR_LICENSE_KEY);

    useEffect(() => {
      licenseKeyRef.current = resolveCkeditorLicenseKey();
    }, []);

    const getEditableDom = () => {
      const editor = editorRef.current;
      if (!editor) return null;
      const editable = editor.ui?.view?.editable;
      const element: HTMLElement | undefined = editable?.element ?? editable?.domRoot;
      return element ?? null;
    };

    useImperativeHandle(ref, () => ({
      getHtml: () => editorRef.current?.getData?.() ?? lastDataRef.current,
      focus: () => {
        if (editorRef.current?.focus) {
          editorRef.current.focus();
        }
      },
      execute: (command: string, value?: unknown) => {
        try {
          editorRef.current?.execute?.(command, value);
        } catch (error) {
          console.warn(`RichTextEditor command "${command}" failed`, error);
        }
      },
      format: () => {
        const editor = editorRef.current;
        if (!editor) return;
        try {
          editor.execute('selectAll');
          editor.execute('removeFormat');
        } catch (error) {
          console.warn('RichTextEditor format command failed', error);
        }
      },
      getScrollInfo: async () => {
        const domRoot = getEditableDom();
        if (!domRoot) {
          return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
        }
        return {
          scrollTop: domRoot.scrollTop,
          scrollHeight: domRoot.scrollHeight,
          clientHeight: domRoot.clientHeight,
        };
      },
      setScrollTop: (value: number) => {
        const domRoot = getEditableDom();
        if (domRoot) {
          domRoot.scrollTop = value;
        }
      },
    }), []);

    useEffect(() => {
      if (!editorRef.current || !isReady) return;
      const domRoot = getEditableDom();
      if (domRoot && onScroll) {
        const handler = () => {
          onScroll({
            scrollTop: domRoot.scrollTop,
            scrollHeight: domRoot.scrollHeight,
            clientHeight: domRoot.clientHeight,
          });
        };
        domRoot.addEventListener('scroll', handler);
        return () => {
          domRoot.removeEventListener('scroll', handler);
        };
      }
      return () => {};
    }, [onScroll, isReady]);

    useEffect(() => {
      if (!editorRef.current || !isReady) return;
      if (readOnly) {
        editorRef.current.enableReadOnlyMode(readOnlyIdRef.current);
      } else {
        editorRef.current.disableReadOnlyMode(readOnlyIdRef.current);
      }
    }, [readOnly, isReady]);

    useEffect(() => {
      if (!editorRef.current || !isReady) return;
      if (content === lastDataRef.current) {
        return;
      }
      const currentData = editorRef.current.getData();
      if (content !== currentData) {
        editorRef.current.setData(content);
        lastDataRef.current = content;
      }
    }, [content, isReady]);

    useEffect(() => {
      return () => {
        if (focusCleanupRef.current) {
          focusCleanupRef.current();
          focusCleanupRef.current = null;
        }
        if (editorRef.current) {
          editorRef.current.destroy?.().catch(() => undefined);
          editorRef.current = null;
        }
      };
    }, []);

    const handleEditorReady = (editor: any) => {
      editorRef.current = editor;
      lastDataRef.current = editor.getData();
      if (readOnly) {
        editor.enableReadOnlyMode(readOnlyIdRef.current);
      }
      if (onFocusChange) {
        if (focusCleanupRef.current) {
          focusCleanupRef.current();
          focusCleanupRef.current = null;
        }
        const tracker = editor.ui.focusTracker;
        const handler = (_: unknown, __: string, isFocused: boolean) => {
          onFocusChange(isFocused);
        };
        tracker.on('change:isFocused', handler);
        focusCleanupRef.current = () => {
          tracker.off('change:isFocused', handler);
        };
      }
      setIsReady(true);
    };

    const handleEditorChange = (_: unknown, editor: any) => {
      const data = editor.getData();
      lastDataRef.current = data;
      onChange(data);
    };

    const handleBlur = () => {
      onFocusChange?.(false);
    };

    const handleFocus = () => {
      onFocusChange?.(true);
    };

    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CKEditor
            editor={ClassicEditor as unknown as typeof ClassicEditor}
            data={content}
            config={{ licenseKey: licenseKeyRef.current }}
            onReady={handleEditorReady}
            onChange={handleEditorChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            disabled={readOnly}
          />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

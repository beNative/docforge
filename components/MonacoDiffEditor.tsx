import React, { useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface MonacoDiffEditorProps {
  oldText: string;
  newText: string;
  language: string;
  renderMode?: 'side-by-side' | 'inline';
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
}

const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({ oldText, newText, language, renderMode = 'side-by-side', readOnly = false, onChange, onScroll }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<any>(null);
    const { theme } = useTheme();
    const modelsRef = useRef<{ original: any; modified: any } | null>(null);
    const changeListenerRef = useRef<{ dispose: () => void } | null>(null);
    const scrollListenerRef = useRef<{ dispose: () => void } | null>(null);

    const disposeListeners = useCallback(() => {
        if (changeListenerRef.current) {
            changeListenerRef.current.dispose();
            changeListenerRef.current = null;
        }
        if (scrollListenerRef.current) {
            scrollListenerRef.current.dispose();
            scrollListenerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!editorRef.current || typeof ((window as any).require) === 'undefined') {
            return;
        }

        let isCancelled = false;

        (window as any).require(['vs/editor/editor.main'], () => {
            if (!editorRef.current || isCancelled) return;

            if (!editorInstanceRef.current) {
                editorInstanceRef.current = monaco.editor.createDiffEditor(editorRef.current, {
                    originalEditable: false,
                    readOnly,
                    automaticLayout: true,
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    wordWrap: 'on',
                    renderSideBySide: renderMode !== 'inline',
                    minimap: { enabled: false },
                    diffWordWrap: 'on',
                });
            }

            const editor = editorInstanceRef.current;
            editor.updateOptions({
                readOnly,
                renderSideBySide: renderMode !== 'inline',
                diffWordWrap: 'on',
            });

            monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');

            const originalModel = monaco.editor.createModel(oldText ?? '', language);
            const modifiedModel = monaco.editor.createModel(newText ?? '', language);

            editor.setModel({
                original: originalModel,
                modified: modifiedModel,
            });

            const previousModels = modelsRef.current;
            modelsRef.current = { original: originalModel, modified: modifiedModel };
            previousModels?.original?.dispose();
            previousModels?.modified?.dispose();

            disposeListeners();

            const modifiedEditor = editor.getModifiedEditor();

            if (onChange && !readOnly) {
                changeListenerRef.current = modifiedEditor.onDidChangeModelContent(() => {
                    onChange(modifiedEditor.getValue());
                });
            }

            if (onScroll) {
                scrollListenerRef.current = modifiedEditor.onDidScrollChange(() => {
                    onScroll({
                        scrollTop: modifiedEditor.getScrollTop(),
                        scrollHeight: modifiedEditor.getScrollHeight(),
                        clientHeight: modifiedEditor.getLayoutInfo().height,
                    });
                });
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [oldText, newText, language, theme, renderMode, readOnly, onChange, onScroll, disposeListeners]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            disposeListeners();
            if (editorInstanceRef.current) {
                const models = editorInstanceRef.current.getModel();
                models?.original?.dispose();
                models?.modified?.dispose();
                editorInstanceRef.current.dispose();
                editorInstanceRef.current = null;
            }
            if (modelsRef.current) {
                modelsRef.current.original?.dispose();
                modelsRef.current.modified?.dispose();
                modelsRef.current = null;
            }
        };
    }, [disposeListeners]);

    return <div ref={editorRef} className="w-full h-full border border-border-color rounded-md" />;
};

export default MonacoDiffEditor;


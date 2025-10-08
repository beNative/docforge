import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DEFAULT_SETTINGS } from '../constants';
import { ensureMonaco } from '../services/editor/monacoLoader';
import { applyDocforgeTheme } from '../services/editor/monacoTheme';

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
  fontFamily?: string;
  fontSize?: number;
  activeLineHighlightColorLight?: string;
  activeLineHighlightColorDark?: string;
}

const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({ oldText, newText, language, renderMode = 'side-by-side', readOnly = false, onChange, onScroll, fontFamily, fontSize, activeLineHighlightColorLight, activeLineHighlightColorDark }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<any>(null);
    const monacoApiRef = useRef<any>(null);
    const { theme } = useTheme();
    const modelsRef = useRef<{ original: any; modified: any } | null>(null);
    const changeListenerRef = useRef<{ dispose: () => void } | null>(null);
    const scrollListenerRef = useRef<{ dispose: () => void } | null>(null);
    const computedFontFamily = useMemo(() => {
        const candidate = (fontFamily ?? '').trim();
        return candidate || DEFAULT_SETTINGS.editorFontFamily;
    }, [fontFamily]);
    const computedFontSize = useMemo(() => {
        const candidate = typeof fontSize === 'number' ? fontSize : Number(fontSize);
        if (Number.isFinite(candidate) && candidate > 0) {
            return Math.min(Math.max(candidate, 8), 64);
        }
        return DEFAULT_SETTINGS.editorFontSize;
    }, [fontSize]);
    const computedActiveLineHighlightColorLight = useMemo(() => {
        const candidate = (activeLineHighlightColorLight ?? '').trim();
        return candidate || DEFAULT_SETTINGS.editorActiveLineHighlightColor;
    }, [activeLineHighlightColorLight]);
    const computedActiveLineHighlightColorDark = useMemo(() => {
        const candidate = (activeLineHighlightColorDark ?? '').trim();
        return candidate || DEFAULT_SETTINGS.editorActiveLineHighlightColorDark;
    }, [activeLineHighlightColorDark]);
    const computedActiveLineHighlightColor = useMemo(() => {
        return theme === 'dark'
            ? computedActiveLineHighlightColorDark
            : computedActiveLineHighlightColorLight;
    }, [theme, computedActiveLineHighlightColorDark, computedActiveLineHighlightColorLight]);
    const themeRef = useRef(theme);
    const highlightColorRef = useRef(computedActiveLineHighlightColor);

    useEffect(() => {
        themeRef.current = theme;
    }, [theme]);

    useEffect(() => {
        highlightColorRef.current = computedActiveLineHighlightColor;
    }, [computedActiveLineHighlightColor]);

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
        if (!editorRef.current) {
            return;
        }

        let isCancelled = false;

        const initializeDiffEditor = async () => {
            try {
                const monacoApi = await ensureMonaco();
                if (!monacoApi || isCancelled || !editorRef.current) {
                    return;
                }

                monacoApiRef.current = monacoApi;

                if (!editorInstanceRef.current) {
                    const variant = themeRef.current === 'dark' ? 'dark' : 'light';
                    const themeName = applyDocforgeTheme(monacoApi, variant, highlightColorRef.current);

                    editorInstanceRef.current = monacoApi.editor.createDiffEditor(editorRef.current, {
                        originalEditable: false,
                        readOnly,
                        automaticLayout: true,
                        fontSize: computedFontSize,
                        fontFamily: computedFontFamily,
                        wordWrap: 'on',
                        renderSideBySide: renderMode !== 'inline',
                        minimap: { enabled: false },
                        diffWordWrap: 'on',
                        theme: themeName,
                    });
                }

                const editor = editorInstanceRef.current;
                editor.updateOptions({
                    readOnly,
                    renderSideBySide: renderMode !== 'inline',
                    diffWordWrap: 'on',
                    fontFamily: computedFontFamily,
                    fontSize: computedFontSize,
                });

                const variant = themeRef.current === 'dark' ? 'dark' : 'light';
                applyDocforgeTheme(monacoApi, variant, highlightColorRef.current);

                const originalModel = monacoApi.editor.createModel(oldText ?? '', language);
                const modifiedModel = monacoApi.editor.createModel(newText ?? '', language);

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
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to initialize Monaco diff editor', error);
            }
        };

        initializeDiffEditor();

        return () => {
            isCancelled = true;
        };
    }, [oldText, newText, language, theme, renderMode, readOnly, onChange, onScroll, disposeListeners, computedFontFamily, computedFontSize]);

    useEffect(() => {
        if (editorInstanceRef.current) {
            editorInstanceRef.current.updateOptions({ fontFamily: computedFontFamily, fontSize: computedFontSize });
        }
    }, [computedFontFamily, computedFontSize]);

    useEffect(() => {
        if (monacoApiRef.current) {
            const variant = theme === 'dark' ? 'dark' : 'light';
            applyDocforgeTheme(monacoApiRef.current, variant, computedActiveLineHighlightColor);
        }
    }, [theme, computedActiveLineHighlightColor]);

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
            monacoApiRef.current = null;
        };
    }, [disposeListeners]);

    return <div ref={editorRef} className="w-full h-full border border-border-color rounded-md" />;
};

export default MonacoDiffEditor;


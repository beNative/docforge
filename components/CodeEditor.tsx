import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { MONACO_KEYBINDING_DEFINITIONS } from '../services/editor/monacoKeybindings';
import { DEFAULT_SETTINGS } from '../constants';
import { ensureMonaco } from '../services/editor/monacoLoader';
import { applyDocforgeTheme } from '../services/editor/monacoTheme';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface CodeEditorProps {
  content: string;
  language: string | null;
  onChange: (newContent: string) => void;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number; }) => void;
  onSelectionChange?: (selection: { text: string; isEmpty: boolean; range: EditorSelectionRange | null }) => void;
  customShortcuts?: Record<string, string[]>;
  fontFamily?: string;
  fontSize?: number;
  activeLineHighlightColorLight?: string;
  activeLineHighlightColorDark?: string;
}

export interface CodeEditorHandle {
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number; }>;
  getSelectedText: () => string;
  getSelectionRange: () => EditorSelectionRange | null;
  replaceSelection: (text: string, options?: { selectReplacement?: boolean; range?: EditorSelectionRange | null }) => void;
  focus: () => void;
}

export interface EditorSelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

const LETTER_REGEX = /^[A-Z]$/;
const DIGIT_REGEX = /^[0-9]$/;
const FUNCTION_KEY_REGEX = /^F([1-9]|1[0-2])$/;

const toMonacoKeyCode = (monacoApi: any, key: string): number | null => {
    const normalized = key.length === 1 ? key.toUpperCase() : key;

    if (LETTER_REGEX.test(normalized)) {
        return monacoApi.KeyCode[`Key${normalized}`];
    }

    if (DIGIT_REGEX.test(normalized)) {
        return monacoApi.KeyCode[`Digit${normalized}`];
    }

    if (FUNCTION_KEY_REGEX.test(normalized)) {
        return monacoApi.KeyCode[normalized.toUpperCase()];
    }

    switch (key) {
        case '/': return monacoApi.KeyCode.Slash;
        case '`': return monacoApi.KeyCode.Backquote;
        case '-': return monacoApi.KeyCode.Minus;
        case '=': return monacoApi.KeyCode.Equal;
        case '[': return monacoApi.KeyCode.BracketLeft;
        case ']': return monacoApi.KeyCode.BracketRight;
        case ';': return monacoApi.KeyCode.Semicolon;
        case "'": return monacoApi.KeyCode.Quote;
        case ',': return monacoApi.KeyCode.Comma;
        case '.': return monacoApi.KeyCode.Period;
        case '\\': return monacoApi.KeyCode.Backslash;
        case 'ArrowUp': return monacoApi.KeyCode.UpArrow;
        case 'ArrowDown': return monacoApi.KeyCode.DownArrow;
        case 'ArrowLeft': return monacoApi.KeyCode.LeftArrow;
        case 'ArrowRight': return monacoApi.KeyCode.RightArrow;
        case 'Enter': return monacoApi.KeyCode.Enter;
        case 'Tab': return monacoApi.KeyCode.Tab;
        case 'Space': return monacoApi.KeyCode.Space;
        case 'Backspace': return monacoApi.KeyCode.Backspace;
        case 'Delete': return monacoApi.KeyCode.Delete;
        case 'Insert': return monacoApi.KeyCode.Insert;
        case 'Escape': return monacoApi.KeyCode.Escape;
        case 'Home': return monacoApi.KeyCode.Home;
        case 'End': return monacoApi.KeyCode.End;
        case 'PageUp': return monacoApi.KeyCode.PageUp;
        case 'PageDown': return monacoApi.KeyCode.PageDown;
        default: return null;
    }
};

const toMonacoKeybinding = (monacoApi: any, keys: string[]): number | null => {
    if (!Array.isArray(keys) || keys.length === 0) {
        return null;
    }

    let keybinding = 0;
    let primaryKey: number | null = null;

    for (const key of keys) {
        if (key === 'Control') {
            keybinding |= monacoApi.KeyMod.CtrlCmd;
            continue;
        }
        if (key === 'Meta') {
            keybinding |= monacoApi.KeyMod.WinCtrl;
            continue;
        }
        if (key === 'Shift') {
            keybinding |= monacoApi.KeyMod.Shift;
            continue;
        }
        if (key === 'Alt') {
            keybinding |= monacoApi.KeyMod.Alt;
            continue;
        }

        const keyCode = toMonacoKeyCode(monacoApi, key);
        if (keyCode !== null) {
            primaryKey = keyCode;
        }
    }

    if (primaryKey === null) {
        return null;
    }

    return keybinding | primaryKey;
};

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ content, language, onChange, onScroll, onSelectionChange, customShortcuts = {}, fontFamily, fontSize, activeLineHighlightColorLight, activeLineHighlightColorDark }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const monacoApiRef = useRef<any>(null);
    const { theme } = useTheme();
    const contentRef = useRef(content);
    const customShortcutsRef = useRef<Record<string, string[]>>({});
    const actionDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
    const selectionListenerRef = useRef<{ dispose: () => void } | null>(null);
    const onSelectionChangeRef = useRef<typeof onSelectionChange | null>(onSelectionChange);
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

    useImperativeHandle(ref, () => ({
        format() {
            monacoInstanceRef.current?.getAction('editor.action.formatDocument')?.run();
        },
        setScrollTop(scrollTop: number) {
            const scrollType = monacoApiRef.current?.editor?.ScrollType?.Immediate;
            if (scrollType) {
                monacoInstanceRef.current?.setScrollTop(scrollTop, scrollType);
            } else {
                monacoInstanceRef.current?.setScrollTop(scrollTop);
            }
        },
        getScrollInfo() {
            return new Promise(resolve => {
                if (monacoInstanceRef.current) {
                    const editor = monacoInstanceRef.current;
                    resolve({
                        scrollTop: editor.getScrollTop(),
                        scrollHeight: editor.getScrollHeight(),
                        clientHeight: editor.getLayoutInfo().height,
                    });
                } else {
                    resolve({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
                }
            });
        },
        getSelectedText() {
            const editor = monacoInstanceRef.current;
            if (!editor) {
                return '';
            }
            const selection = editor.getSelection();
            const model = editor.getModel();
            if (!selection || !model) {
                return '';
            }
            return model.getValueInRange(selection);
        },
        getSelectionRange() {
            const editor = monacoInstanceRef.current;
            if (!editor) {
                return null;
            }
            const selection = editor.getSelection();
            if (!selection) {
                return null;
            }
            return {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn,
            };
        },
        replaceSelection(text: string, options) {
            const editor = monacoInstanceRef.current;
            const monacoApi = monacoApiRef.current;
            if (!editor || !monacoApi) {
                return;
            }

            const model = editor.getModel();
            if (!model) {
                return;
            }

            const normalizedText = typeof text === 'string' ? text : '';
            let targetRange = editor.getSelection();

            if (!targetRange && typeof editor.getPosition === 'function') {
                const position = editor.getPosition();
                if (position) {
                    targetRange = new monacoApi.Range(position.lineNumber, position.column, position.lineNumber, position.column);
                }
            }

            if (options?.range && monacoApi) {
                const provided = options.range;
                targetRange = new monacoApi.Range(provided.startLineNumber, provided.startColumn, provided.endLineNumber, provided.endColumn);
            }

            if (!targetRange) {
                targetRange = model.getFullModelRange();
            }

            editor.executeEdits('docforge', [{ range: targetRange, text: normalizedText, forceMoveMarkers: true }]);

            if (options?.selectReplacement === false) {
                return;
            }

            const startLineNumber = targetRange.startLineNumber;
            const startColumn = targetRange.startColumn;
            const lines = normalizedText.split('\n');
            const lastLineIndex = lines.length - 1;
            const endLineNumber = startLineNumber + lastLineIndex;
            let endColumn = startColumn;

            if (lines.length === 1) {
                endColumn = startColumn + lines[0].length;
            } else {
                endColumn = (lines[lastLineIndex]?.length ?? 0) + 1;
            }

            const selectionRange = new monacoApi.Range(startLineNumber, startColumn, endLineNumber, endColumn);
            editor.setSelection(selectionRange);
            editor.revealRangeInCenter(selectionRange);
            editor.focus();
        },
        focus() {
            monacoInstanceRef.current?.focus();
        },
    }));

    const disposeEditorShortcuts = useCallback(() => {
        actionDisposablesRef.current.forEach(disposable => {
            if (disposable && typeof disposable.dispose === 'function') {
                try {
                    disposable.dispose();
                } catch {
                    // Ignore errors during cleanup.
                }
            }
        });
        actionDisposablesRef.current = [];
    }, []);

    const applyEditorShortcuts = useCallback(() => {
        const monacoApi = monacoApiRef.current;
        if (!monacoInstanceRef.current || !monacoApi) {
            return;
        }

        disposeEditorShortcuts();

        MONACO_KEYBINDING_DEFINITIONS.forEach(definition => {
            const effective = customShortcutsRef.current[definition.id];
            const keys = effective && effective.length > 0 ? effective : definition.defaultShortcut;
            if (!keys || keys.length === 0) {
                return;
            }

            const keybinding = toMonacoKeybinding(monacoApi, keys);
            if (keybinding === null) {
                return;
            }

            const disposable = monacoInstanceRef.current.addAction({
                id: `docforge.${definition.id}`,
                label: definition.name,
                keybindings: [keybinding],
                precondition: 'editorTextFocus',
                run: () => monacoInstanceRef.current?.trigger('docforge', definition.monacoCommandId, null),
            });

            if (disposable) {
                actionDisposablesRef.current.push(disposable);
            }
        });
    }, [disposeEditorShortcuts]);

    useEffect(() => {
        customShortcutsRef.current = customShortcuts ?? {};
        if (monacoInstanceRef.current) {
            applyEditorShortcuts();
        }
    }, [customShortcuts, applyEditorShortcuts]);

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        onSelectionChangeRef.current = onSelectionChange ?? null;
    }, [onSelectionChange]);

    useEffect(() => {
        let isCancelled = false;

        const initializeEditor = async () => {
            if (!editorRef.current) {
                return;
            }

            try {
                const monacoApi = await ensureMonaco();
                if (!monacoApi || isCancelled || !editorRef.current) {
                    return;
                }

                monacoApiRef.current = monacoApi;

                if (monacoInstanceRef.current) {
                    disposeEditorShortcuts();
                    monacoInstanceRef.current.dispose();
                }

                const variant = themeRef.current === 'dark' ? 'dark' : 'light';
                const themeName = applyDocforgeTheme(monacoApi, variant, highlightColorRef.current);

                const editorInstance = monacoApi.editor.create(editorRef.current, {
                    value: content,
                    language: language || 'plaintext',
                    theme: themeName,
                    automaticLayout: true,
                    fontSize: computedFontSize,
                    fontFamily: computedFontFamily,
                    minimap: {
                        enabled: true,
                    },
                    wordWrap: 'on',
                    folding: true,
                    showFoldingControls: 'always',
                    bracketPairColorization: {
                        enabled: true,
                    },
                });

                editorInstance.onDidChangeModelContent(() => {
                    const currentValue = editorInstance.getValue();
                    if (currentValue !== contentRef.current) {
                        onChange(currentValue);
                    }
                });

                editorInstance.onDidScrollChange((e: any) => {
                    if (e.scrollTopChanged) {
                        onScroll?.({
                            scrollTop: e.scrollTop,
                            scrollHeight: e.scrollHeight,
                            clientHeight: editorInstance.getLayoutInfo().height
                        });
                    }
                });

                if (selectionListenerRef.current) {
                    selectionListenerRef.current.dispose();
                    selectionListenerRef.current = null;
                }

                const emitSelectionChange = () => {
                    const selection = editorInstance.getSelection();
                    const model = editorInstance.getModel();
                    if (!selection || !model) {
                        onSelectionChangeRef.current?.({ text: '', isEmpty: true, range: null });
                        return;
                    }
                    const selectedText = model.getValueInRange(selection);
                    onSelectionChangeRef.current?.({
                        text: selectedText,
                        isEmpty: selectedText.length === 0,
                        range: {
                            startLineNumber: selection.startLineNumber,
                            startColumn: selection.startColumn,
                            endLineNumber: selection.endLineNumber,
                            endColumn: selection.endColumn,
                        }
                    });
                };

                selectionListenerRef.current = editorInstance.onDidChangeCursorSelection(() => {
                    emitSelectionChange();
                });

                emitSelectionChange();

                monacoInstanceRef.current = editorInstance;
                applyEditorShortcuts();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to initialize Monaco editor', error);
            }
        };

        initializeEditor();

        return () => {
            isCancelled = true;
            disposeEditorShortcuts();
            if (selectionListenerRef.current) {
                try {
                    selectionListenerRef.current.dispose();
                } catch {}
                selectionListenerRef.current = null;
            }
            if (monacoInstanceRef.current) {
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
            monacoApiRef.current = null;
        };
    }, [onChange, onScroll, applyEditorShortcuts, disposeEditorShortcuts, computedFontFamily, computedFontSize]);

    // Effect to update content from props if it changes externally
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getValue() !== content) {
            // Preserve view state (like cursor position) when updating content
            const viewState = monacoInstanceRef.current.saveViewState();
            monacoInstanceRef.current.setValue(content);
            if(viewState) {
                monacoInstanceRef.current.restoreViewState(viewState);
            }
        }
    }, [content]);

    // Effect to update theme
    useEffect(() => {
        if (monacoApiRef.current) {
            const variant = theme === 'dark' ? 'dark' : 'light';
            applyDocforgeTheme(monacoApiRef.current, variant, computedActiveLineHighlightColor);
        }
    }, [theme, computedActiveLineHighlightColor]);

    useEffect(() => {
        if (monacoInstanceRef.current) {
            monacoInstanceRef.current.updateOptions({ fontFamily: computedFontFamily, fontSize: computedFontSize });
        }
    }, [computedFontFamily, computedFontSize]);

    // Effect to update language
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getModel() && monacoApiRef.current) {
            monacoApiRef.current.editor.setModelLanguage(monacoInstanceRef.current.getModel(), language || 'plaintext');
        }
    }, [language]);


    return <div ref={editorRef} className="w-full h-full" />;
});

export default CodeEditor;

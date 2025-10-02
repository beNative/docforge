import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { MONACO_KEYBINDING_DEFINITIONS } from '../services/editor/monacoKeybindings';
import { DEFAULT_SETTINGS } from '../constants';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface CodeEditorProps {
  content: string;
  language: string | null;
  onChange: (newContent: string) => void;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number; }) => void;
  customShortcuts?: Record<string, string[]>;
  fontFamily?: string;
}

export interface CodeEditorHandle {
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number; }>;
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

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ content, language, onChange, onScroll, customShortcuts = {}, fontFamily }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const { theme } = useTheme();
    const contentRef = useRef(content);
    const customShortcutsRef = useRef<Record<string, string[]>>({});
    const actionDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
    const computedFontFamily = useMemo(() => {
        const candidate = (fontFamily ?? '').trim();
        return candidate || DEFAULT_SETTINGS.editorFontFamily;
    }, [fontFamily]);

    useImperativeHandle(ref, () => ({
        format() {
            monacoInstanceRef.current?.getAction('editor.action.formatDocument')?.run();
        },
        setScrollTop(scrollTop: number) {
            monacoInstanceRef.current?.setScrollTop(scrollTop, monaco.editor.ScrollType.Immediate);
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
        }
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
        if (!monacoInstanceRef.current || typeof monaco === 'undefined') {
            return;
        }

        disposeEditorShortcuts();

        MONACO_KEYBINDING_DEFINITIONS.forEach(definition => {
            const effective = customShortcutsRef.current[definition.id];
            const keys = effective && effective.length > 0 ? effective : definition.defaultShortcut;
            if (!keys || keys.length === 0) {
                return;
            }

            const keybinding = toMonacoKeybinding(monaco, keys);
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
        if (editorRef.current && typeof ((window as any).require) !== 'undefined') {
            // Configure Monaco Environment to load workers from CDN. This is crucial for syntax highlighting.
            if (!(window as any).MonacoEnvironment) {
                (window as any).MonacoEnvironment = {
                    getWorkerUrl: function (_moduleId: any, label: string) {
                        const CDN_PATH = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs';
                        if (label === 'json') return `${CDN_PATH}/language/json/json.worker.js`;
                        if (label === 'css' || label === 'scss' || label === 'less') return `${CDN_PATH}/language/css/css.worker.js`;
                        if (label === 'html' || label === 'handlebars' || label === 'razor') return `${CDN_PATH}/language/html/html.worker.js`;
                        if (label === 'typescript' || label === 'javascript') return `${CDN_PATH}/language/typescript/ts.worker.js`;
                        return `${CDN_PATH}/editor/editor.worker.js`;
                    },
                };
            }

            (window as any).require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
            (window as any).require(['vs/editor/editor.main'], () => {
                 if (editorRef.current) {
                    // Ensure any previous instance is disposed
                    if (monacoInstanceRef.current) {
                        disposeEditorShortcuts();
                        monacoInstanceRef.current.dispose();
                    }

                    const editorInstance = monaco.editor.create(editorRef.current, {
                        value: content,
                        language: language || 'plaintext',
                        theme: theme === 'dark' ? 'vs-dark' : 'vs',
                        automaticLayout: true,
                        fontSize: 12,
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

                    monacoInstanceRef.current = editorInstance;
                    applyEditorShortcuts();
                }
            });
        }

        return () => {
            disposeEditorShortcuts();
            if (monacoInstanceRef.current) {
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
        };
    }, [onChange, onScroll, applyEditorShortcuts, disposeEditorShortcuts, computedFontFamily]);

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
        if (monacoInstanceRef.current) {
            monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
        }
    }, [theme]);

    useEffect(() => {
        if (monacoInstanceRef.current) {
            monacoInstanceRef.current.updateOptions({ fontFamily: computedFontFamily });
        }
    }, [computedFontFamily]);
    
    // Effect to update language
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getModel()) {
            monaco.editor.setModelLanguage(monacoInstanceRef.current.getModel(), language || 'plaintext');
        }
    }, [language]);


    return <div ref={editorRef} className="w-full h-full" />;
});

export default CodeEditor;

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { MONACO_KEYBINDING_DEFINITIONS } from '../services/editor/monacoKeybindings';
import { DEFAULT_SETTINGS } from '../constants';
import { ensureMonaco } from '../services/editor/monacoLoader';
import { applyDocforgeTheme } from '../services/editor/monacoTheme';
import { registerTomlLanguage } from '../services/editor/registerTomlLanguage';
import { registerPlantumlLanguage } from '../services/editor/registerPlantumlLanguage';
import EmojiPickerOverlay from './EmojiPickerOverlay';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface CodeEditorProps {
  content: string;
  language: string | null;
  onChange: (newContent: string) => void;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number; }) => void;
  customShortcuts?: Record<string, string[]>;
  fontFamily?: string;
  fontSize?: number;
  activeLineHighlightColorLight?: string;
  activeLineHighlightColorDark?: string;
  readOnly?: boolean;
  onFocusChange?: (hasFocus: boolean) => void;
}

export interface CodeEditorHandle {
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number; }>;
}

const LETTER_REGEX = /^[A-Z]$/;
const DIGIT_REGEX = /^[0-9]$/;
const FUNCTION_KEY_REGEX = /^F([1-9]|1[0-2])$/;

type StoredSelection = {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
};

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

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ content, language, onChange, onScroll, customShortcuts = {}, fontFamily, fontSize, activeLineHighlightColorLight, activeLineHighlightColorDark, readOnly = false, onFocusChange }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const monacoApiRef = useRef<any>(null);
    const emojiPickerStateRef = useRef<{ selection: StoredSelection | null; anchor: { x: number; y: number } | null } | null>(null);
    const { theme } = useTheme();
    const contentRef = useRef(content);
    const customShortcutsRef = useRef<Record<string, string[]>>({});
    const actionDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
    const focusDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const blurDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const emojiActionDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const lastContextMenuCoordsRef = useRef<{ x: number; y: number } | null>(null);
    const [emojiPickerState, setEmojiPickerState] = useState<{ selection: StoredSelection | null; anchor: { x: number; y: number } | null } | null>(null);
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

    const calculateAnchorFromSelection = useCallback((selection: StoredSelection | null): { x: number; y: number } | null => {
        if (!selection || !editorRef.current || !monacoInstanceRef.current) {
            return null;
        }

        const editor = monacoInstanceRef.current;
        const endPosition = {
            lineNumber: selection.endLineNumber,
            column: selection.endColumn,
        };

        let scrolled = editor.getScrolledVisiblePosition(endPosition);
        if (!scrolled) {
            editor.revealPositionInCenter(endPosition);
            scrolled = editor.getScrolledVisiblePosition(endPosition);
        }

        if (!scrolled) {
            return null;
        }

        const containerRect = editorRef.current.getBoundingClientRect();
        return {
            x: containerRect.left + scrolled.left,
            y: containerRect.top + scrolled.top + scrolled.height,
        };
    }, []);

    const updateEmojiPickerAnchor = useCallback((preferredCoords?: { x: number; y: number } | null) => {
        const state = emojiPickerStateRef.current;
        if (!state) {
            return;
        }

        let anchor = preferredCoords ?? null;
        if (!anchor) {
            anchor = calculateAnchorFromSelection(state.selection);
        }

        if (!anchor && editorRef.current) {
            const rect = editorRef.current.getBoundingClientRect();
            anchor = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        }

        if (!anchor) {
            return;
        }

        emojiPickerStateRef.current = { ...state, anchor };
        setEmojiPickerState((previous) => (previous ? { ...previous, anchor } : previous));
    }, [calculateAnchorFromSelection]);

    const captureCurrentSelection = useCallback((): StoredSelection | null => {
        const editor = monacoInstanceRef.current;
        if (!editor) {
            return null;
        }

        const selection = editor.getSelection();
        if (selection) {
            return {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn,
            };
        }

        const position = editor.getPosition();
        if (!position) {
            return null;
        }

        return {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        };
    }, []);

    const openEmojiPicker = useCallback((selection: StoredSelection | null, coords: { x: number; y: number } | null) => {
        const effectiveSelection = selection ?? captureCurrentSelection();
        const anchor = coords ?? calculateAnchorFromSelection(effectiveSelection);

        let resolvedAnchor = anchor;
        if (!resolvedAnchor && editorRef.current) {
            const rect = editorRef.current.getBoundingClientRect();
            resolvedAnchor = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        }

        const nextState = {
            selection: effectiveSelection,
            anchor: resolvedAnchor,
        };

        emojiPickerStateRef.current = nextState;
        setEmojiPickerState(nextState);

        requestAnimationFrame(() => {
            updateEmojiPickerAnchor(coords ?? null);
        });
    }, [captureCurrentSelection, calculateAnchorFromSelection, updateEmojiPickerAnchor]);

    const insertEmoji = useCallback((emoji: string) => {
        const editor = monacoInstanceRef.current;
        const monacoApi = monacoApiRef.current;
        if (!editor || !monacoApi) {
            return;
        }

        const selection = emojiPickerStateRef.current?.selection ?? captureCurrentSelection();
        if (!selection) {
            editor.trigger('emoji-picker', 'type', { text: emoji });
            return;
        }

        const range = new monacoApi.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn,
        );

        editor.executeEdits('emoji-picker', [
            {
                range,
                text: emoji,
                forceMoveMarkers: true,
            },
        ]);

        const newColumn = selection.startColumn + emoji.length;
        const newSelection = new monacoApi.Selection(
            selection.startLineNumber,
            newColumn,
            selection.startLineNumber,
            newColumn,
        );
        editor.setSelection(newSelection);
        editor.focus();
        contentRef.current = editor.getValue();
    }, [captureCurrentSelection]);

    useEffect(() => {
        emojiPickerStateRef.current = emojiPickerState;
    }, [emojiPickerState]);

    useEffect(() => {
        if (!emojiPickerState) {
            return;
        }
        updateEmojiPickerAnchor(emojiPickerState.anchor ?? null);

        const handleResize = () => {
            updateEmojiPickerAnchor(emojiPickerState.anchor ?? null);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [emojiPickerState, updateEmojiPickerAnchor]);

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
        emojiActionDisposableRef.current?.dispose();
        emojiActionDisposableRef.current = null;
    }, []);

    const disposeFocusListeners = useCallback(() => {
        focusDisposableRef.current?.dispose();
        focusDisposableRef.current = null;
        blurDisposableRef.current?.dispose();
        blurDisposableRef.current = null;
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
                registerTomlLanguage(monacoApi);
                registerPlantumlLanguage(monacoApi);

                if (monacoInstanceRef.current) {
                    disposeEditorShortcuts();
                    disposeFocusListeners();
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
                    readOnly,
                });

                const storeSelection = () => {
                    const selection = editorInstance.getSelection();
                    if (!selection) {
                        if (emojiPickerStateRef.current) {
                            const next = { ...emojiPickerStateRef.current, selection: null };
                            emojiPickerStateRef.current = next;
                            setEmojiPickerState(prev => (prev ? { ...prev, selection: null } : prev));
                        }
                        return;
                    }
                    const storedSelection: StoredSelection = {
                        startLineNumber: selection.startLineNumber,
                        startColumn: selection.startColumn,
                        endLineNumber: selection.endLineNumber,
                        endColumn: selection.endColumn,
                    };
                    if (emojiPickerStateRef.current) {
                        const next = { ...emojiPickerStateRef.current, selection: storedSelection };
                        emojiPickerStateRef.current = next;
                        setEmojiPickerState(prev => (prev ? { ...prev, selection: storedSelection } : prev));
                    }
                };

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
                    updateEmojiPickerAnchor();
                });

                editorInstance.onContextMenu((event: any) => {
                    const contextEvent = event?.event;
                    const posx = contextEvent?.posx ?? contextEvent?.browserEvent?.clientX;
                    const posy = contextEvent?.posy ?? contextEvent?.browserEvent?.clientY;
                    if (typeof posx === 'number' && typeof posy === 'number') {
                        lastContextMenuCoordsRef.current = { x: posx, y: posy };
                    }
                    storeSelection();
                });

                disposeFocusListeners();
                if (onFocusChange) {
                    focusDisposableRef.current = editorInstance.onDidFocusEditorWidget(() => {
                        onFocusChange(true);
                    });
                    blurDisposableRef.current = editorInstance.onDidBlurEditorWidget(() => {
                        onFocusChange(false);
                    });
                }

                monacoInstanceRef.current = editorInstance;
                applyEditorShortcuts();
                emojiActionDisposableRef.current?.dispose();
                emojiActionDisposableRef.current = editorInstance.addAction({
                    id: 'docforge.insertEmoji',
                    label: 'Insert Emoji…',
                    contextMenuGroupId: 'navigation',
                    contextMenuOrder: 0.5,
                    run: () => {
                        const state = captureCurrentSelection();
                        const coords = lastContextMenuCoordsRef.current;
                        openEmojiPicker(state, coords ?? null);
                        lastContextMenuCoordsRef.current = null;
                    },
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to initialize Monaco editor', error);
            }
        };

        initializeEditor();

        return () => {
            isCancelled = true;
            disposeEditorShortcuts();
            disposeFocusListeners();
            if (monacoInstanceRef.current) {
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
            emojiActionDisposableRef.current?.dispose();
            emojiActionDisposableRef.current = null;
            monacoApiRef.current = null;
        };
    }, [onChange, onScroll, applyEditorShortcuts, disposeEditorShortcuts, disposeFocusListeners, computedFontFamily, computedFontSize, readOnly, onFocusChange]);

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

    useEffect(() => {
        if (monacoInstanceRef.current) {
            monacoInstanceRef.current.updateOptions({ readOnly });
        }
    }, [readOnly]);

    // Effect to update language
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getModel() && monacoApiRef.current) {
            monacoApiRef.current.editor.setModelLanguage(monacoInstanceRef.current.getModel(), language || 'plaintext');
        }
    }, [language]);


    return (
        <>
            <div ref={editorRef} className="w-full h-full" />
            <EmojiPickerOverlay
                isOpen={Boolean(emojiPickerState)}
                anchor={emojiPickerState?.anchor ?? null}
                onClose={() => {
                    setEmojiPickerState(null);
                    monacoInstanceRef.current?.focus();
                }}
                onSelectEmoji={(emoji) => {
                    insertEmoji(emoji);
                }}
                ariaLabel="Insert emoji into editor"
            />
        </>
    );
});

export default CodeEditor;

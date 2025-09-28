import React, { useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface CodeEditorProps {
  content: string;
  language: string | null;
  onChange: (newContent: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ content, language, onChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const { theme } = useTheme();
    const contentRef = useRef(content);

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
                        monacoInstanceRef.current.dispose();
                    }

                    const editorInstance = monaco.editor.create(editorRef.current, {
                        value: content,
                        language: language || 'plaintext',
                        theme: theme === 'dark' ? 'vs-dark' : 'vs',
                        automaticLayout: true,
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
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

                    monacoInstanceRef.current = editorInstance;
                }
            });
        }

        return () => {
            if (monacoInstanceRef.current) {
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect to update content from props if it changes externally
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getValue() !== content) {
            monacoInstanceRef.current.setValue(content);
        }
    }, [content]);

    // Effect to update theme
    useEffect(() => {
        if (monacoInstanceRef.current) {
            monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
        }
    }, [theme]);
    
    // Effect to update language
    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getModel()) {
            monaco.editor.setModelLanguage(monacoInstanceRef.current.getModel(), language || 'plaintext');
        }
    }, [language]);


    return <div ref={editorRef} className="w-full h-full" />;
};

export default CodeEditor;
import React, { useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';

// Let TypeScript know monaco is available on the window
declare const monaco: any;

interface MonacoDiffEditorProps {
  oldText: string;
  newText: string;
  language: string;
}

const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({ oldText, newText, language }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const { theme } = useTheme();
    
    // Store props in refs to avoid re-running the main effect on every change,
    // which would re-create the editor instance. We want to update it instead.
    const propsRef = useRef({ oldText, newText, language });
    propsRef.current = { oldText, newText, language };

    // Effect for creating and cleaning up the editor instance
    useEffect(() => {
        let editorInstance: any;

        if (editorRef.current && typeof ((window as any).require) !== 'undefined') {
             // Use require AMD loader if available
            (window as any).require(['vs/editor/editor.main'], () => {
                if (!editorRef.current) return; // Component might have unmounted
                
                editorInstance = monaco.editor.createDiffEditor(editorRef.current, {
                    originalEditable: false,
                    readOnly: true,
                    theme: theme === 'dark' ? 'vs-dark' : 'vs',
                    automaticLayout: true,
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    wordWrap: 'on',
                    renderSideBySide: true,
                    minimap: { enabled: false },
                });

                const originalModel = monaco.editor.createModel(propsRef.current.oldText, propsRef.current.language);
                const modifiedModel = monaco.editor.createModel(propsRef.current.newText, propsRef.current.language);
                
                editorInstance.setModel({
                    original: originalModel,
                    modified: modifiedModel
                });

                monacoInstanceRef.current = editorInstance;
            });
        }

        return () => {
            if (monacoInstanceRef.current) {
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Effect to update theme
    useEffect(() => {
        if (monacoInstanceRef.current) {
            monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
        }
    }, [theme]);
    
    // Effect to update models when text or language changes
    useEffect(() => {
        if (monacoInstanceRef.current) {
            const editor = monacoInstanceRef.current;
            const models = editor.getModel();

            if (models) {
                const { original, modified } = models;
                if (original.getValue() !== oldText) {
                    original.setValue(oldText);
                }
                if (modified.getValue() !== newText) {
                    modified.setValue(newText);
                }
                if (original.getLanguageId() !== language) {
                    monaco.editor.setModelLanguage(original, language);
                }
                if (modified.getLanguageId() !== language) {
                    monaco.editor.setModelLanguage(modified, language);
                }
            }
        }
    }, [oldText, newText, language]);

    return <div ref={editorRef} className="w-full h-full border border-border-color rounded-md" />;
};

export default MonacoDiffEditor;

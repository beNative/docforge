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
    const editorInstanceRef = useRef<any>(null);
    const { theme } = useTheme();
    
    useEffect(() => {
        let modelsToDispose: { original: any; modified: any; } | null = null;
        
        if (editorRef.current && typeof ((window as any).require) !== 'undefined') {
            (window as any).require(['vs/editor/editor.main'], () => {
                if (!editorRef.current) return;

                // Create editor only if it doesn't exist
                if (!editorInstanceRef.current) {
                     editorInstanceRef.current = monaco.editor.createDiffEditor(editorRef.current, {
                        originalEditable: false,
                        readOnly: true,
                        automaticLayout: true,
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                        wordWrap: 'on',
                        renderSideBySide: true,
                        minimap: { enabled: false },
                    });
                }

                const editor = editorInstanceRef.current;
                
                // Always set theme and models
                monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');

                const originalModel = monaco.editor.createModel(oldText, language);
                const modifiedModel = monaco.editor.createModel(newText, language);
                
                // Get old models BEFORE setting new ones to dispose later
                modelsToDispose = editor.getModel();

                editor.setModel({
                    original: originalModel,
                    modified: modifiedModel
                });
                
                // Dispose old models AFTER setting new ones
                if (modelsToDispose) {
                    modelsToDispose.original?.dispose();
                    modelsToDispose.modified?.dispose();
                }
            });
        }

        return () => {
            // Cleanup happens when the effect re-runs or the component unmounts
            if (modelsToDispose) {
                modelsToDispose.original?.dispose();
                modelsToDispose.modified?.dispose();
            }
        };
    }, [oldText, newText, language, theme]); // Re-run effect when content or theme changes

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            if (editorInstanceRef.current) {
                const models = editorInstanceRef.current.getModel();
                models?.original?.dispose();
                models?.modified?.dispose();
                editorInstanceRef.current.dispose();
                editorInstanceRef.current = null;
            }
        }
    }, []);

    return <div ref={editorRef} className="w-full h-full border border-border-color rounded-md" />;
};

export default MonacoDiffEditor;

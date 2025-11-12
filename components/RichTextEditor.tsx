import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

type ScrollInfo = { scrollTop: number; scrollHeight: number; clientHeight: number };

export interface RichTextEditorHandle {
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<ScrollInfo>;
  getHTML: () => string;
}

interface RichTextEditorProps {
  content: string;
  onChange: (nextContent: string) => void;
  readOnly?: boolean;
  onScroll?: (scrollInfo: ScrollInfo) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
  content,
  onChange,
  readOnly = false,
  onScroll,
  onFocusChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSerializedRef = useRef(content);

  const extensions = useMemo(() => [
    StarterKit.configure({
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
    }),
    Image.configure({ inline: true }),
  ], []);

  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    onUpdate({ editor: tiptapEditor }) {
      const html = tiptapEditor.getHTML();
      lastSerializedRef.current = html;
      onChange(html);
    },
    onFocus() {
      onFocusChange?.(true);
    },
    onBlur() {
      onFocusChange?.(false);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content, false);
      lastSerializedRef.current = content;
    }
  }, [editor, content]);

  useImperativeHandle(ref, () => ({
    format: () => {
      if (!editor) return;
      const html = editor.getHTML();
      editor.commands.setContent(html, false);
      lastSerializedRef.current = html;
      onChange(html);
    },
    setScrollTop: (scrollTop: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = scrollTop;
      }
    },
    getScrollInfo: async () => {
      const el = containerRef.current;
      if (!el) {
        return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
      }
      return {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    },
    getHTML: () => {
      if (editor) {
        return editor.getHTML();
      }
      return lastSerializedRef.current;
    },
  }), [editor, onChange]);

  useEffect(() => {
    return () => {
      onFocusChange?.(false);
    };
  }, [onFocusChange]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto bg-background"
      onScroll={(event) => {
        if (!onScroll) return;
        const target = event.currentTarget;
        onScroll({
          scrollTop: target.scrollTop,
          scrollHeight: target.scrollHeight,
          clientHeight: target.clientHeight,
        });
      }}
    >
      <EditorContent editor={editor} className="px-6 py-4 focus:outline-none text-text-main space-y-3" />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import type { Editor } from '@tiptap/react';

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

const ToolbarButton: React.FC<{
  onClick: () => void;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
}> = ({ onClick, label, isActive = false, disabled = false, title }) => (
  <button
    type="button"
    className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors border border-transparent ${
      isActive ? 'bg-secondary text-primary' : 'text-text-secondary hover:text-text-main hover:bg-border-color'
    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
      if (!disabled) {
        onClick();
      }
    }}
    title={title}
    aria-pressed={isActive}
  >
    {label}
  </button>
);

const RichTextToolbar: React.FC<{ editor: Editor | null; readOnly: boolean }> = ({ editor, readOnly }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border-color bg-secondary px-3 py-2">
      <ToolbarButton
        label="B"
        title="Bold"
        isActive={editor.isActive('bold')}
        disabled={readOnly || !editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="Italic"
        isActive={editor.isActive('italic')}
        disabled={readOnly || !editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="S"
        title="Strikethrough"
        isActive={editor.isActive('strike')}
        disabled={readOnly || !editor.can().chain().focus().toggleStrike().run()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        label="Code"
        title="Inline code"
        isActive={editor.isActive('code')}
        disabled={readOnly || !editor.can().chain().focus().toggleCode().run()}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <div className="h-5 w-px bg-border-color mx-1" aria-hidden />
      <ToolbarButton
        label="P"
        title="Paragraph"
        isActive={editor.isActive('paragraph')}
        disabled={readOnly || !editor.can().chain().focus().setParagraph().run()}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        label="H1"
        title="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        disabled={readOnly || !editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="H2"
        title="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        disabled={readOnly || !editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="• List"
        title="Bullet list"
        isActive={editor.isActive('bulletList')}
        disabled={readOnly || !editor.can().chain().focus().toggleBulletList().run()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1. List"
        title="Ordered list"
        isActive={editor.isActive('orderedList')}
        disabled={readOnly || !editor.can().chain().focus().toggleOrderedList().run()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label=">"
        title="Block quote"
        isActive={editor.isActive('blockquote')}
        disabled={readOnly || !editor.can().chain().focus().toggleBlockquote().run()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <div className="h-5 w-px bg-border-color mx-1" aria-hidden />
      <ToolbarButton
        label="Undo"
        title="Undo"
        disabled={readOnly || !editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        title="Redo"
        disabled={readOnly || !editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
};

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
    content: content || '<p></p>',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-full focus:outline-none',
        'data-placeholder': 'Start writing...'
      },
      handleDOMEvents: {
        focus: () => {
          onFocusChange?.(true);
          return false;
        },
        blur: () => {
          onFocusChange?.(false);
          return false;
        },
      },
    },
    onUpdate({ editor: tiptapEditor }) {
      const html = tiptapEditor.getHTML();
      if (lastSerializedRef.current !== html) {
        lastSerializedRef.current = html;
        onChange(html);
      }
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
    if (content && content !== current) {
      editor.commands.setContent(content, false);
      lastSerializedRef.current = content;
    }
    if (!content && current !== '<p></p>') {
      editor.commands.setContent('<p></p>', false);
      lastSerializedRef.current = '<p></p>';
    }
  }, [editor, content]);

  useImperativeHandle(ref, () => ({
    format: () => {
      if (!editor) return;
      const html = editor.getHTML();
      editor.commands.setContent(html, false);
      editor.chain().focus().run();
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
    <div className="flex h-full w-full flex-col bg-background">
      <RichTextToolbar editor={editor} readOnly={readOnly} />
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
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
        <EditorContent editor={editor} className="rich-text-editor px-6 py-4 text-text-main" />
      </div>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

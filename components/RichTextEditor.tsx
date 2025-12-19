import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import {
  ListItemNode,
  ListNode,
} from '@lexical/list';
import { LinkNode } from '@lexical/link';
import {
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $getRoot } from 'lexical';

import { ImageNode } from './rich-text/ImageNode';
import ContextMenuComponent, { type MenuItem as ContextMenuItem } from './ContextMenu';
import { ToolbarPlugin } from './rich-text/ToolbarPlugin';
import { TableColumnResizePlugin } from './rich-text/TableColumnResizePlugin';
import type { ToolbarButtonConfig } from './rich-text/types';

export interface RichTextEditorHandle {
  focus: () => void;
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }>;
}

interface RichTextEditorProps {
  html: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  onFocusChange?: (hasFocus: boolean) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

const RICH_TEXT_THEME = {
  paragraph: 'mb-3 text-base leading-7 text-text-main',
  heading: {
    h1: 'text-3xl font-bold text-text-main mb-4 mt-6',
    h2: 'text-2xl font-semibold text-text-main mb-3 mt-5',
    h3: 'text-xl font-medium text-text-main mb-2 mt-4',
  },
  quote: 'border-l-4 border-primary/50 pl-4 py-1 my-4 text-text-secondary italic bg-primary/5 rounded-r',
  list: {
    nested: {
      listitem: 'ml-4',
    },
    ol: 'list-decimal ml-8 mb-4 text-base leading-7 text-text-main',
    ul: 'list-disc ml-8 mb-4 text-base leading-7 text-text-main',
    listitem: 'mb-1 pl-1',
  },
  text: {
    bold: 'font-bold text-text-main',
    italic: 'italic',
    underline: 'underline decoration-primary/50 underline-offset-4',
    strikethrough: 'line-through opacity-70',
    code: 'font-mono bg-secondary-hover rounded px-1.5 py-0.5 text-sm text-primary border border-border-color',
  },
  link: 'text-primary underline decoration-primary/30 hover:decoration-primary transition-colors cursor-pointer',
  image: 'my-6 flex justify-center',
  table: 'my-6 w-full border-collapse border border-border-color text-sm',
  tableCell: 'border border-border-color px-3 py-2 align-top bg-secondary/40',
  tableCellHeader: 'bg-secondary text-text-main font-semibold',
  tableRow: 'even:bg-secondary/60',
  tableSelection: 'outline outline-2 outline-primary',
};

const Placeholder: React.FC = () => null;

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ html, onChange, readOnly = false, onScroll, onFocusChange }, ref) => {
    const [editorRef, setEditorRef] = useState<any>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [toolbarActions, setToolbarActions] = useState<ToolbarButtonConfig[]>([]);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
    const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);

    // Track if we are currently processing an external HTML update to avoid loops
    const isUpdatingFromServer = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        editorRef?.focus();
      },
      format: () => {
        // Exposed for parent components if needed
      },
      setScrollTop: (scrollTop: number) => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollTop;
        }
      },
      getScrollInfo: async () => {
        if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          return { scrollTop, scrollHeight, clientHeight };
        }
        return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
      },
    }));

    const initialConfig = {
      namespace: 'DocForgeEditor',
      theme: RICH_TEXT_THEME,
      onError: (error: Error) => {
        console.error('Lexical Error:', error);
      },
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        LinkNode,
        TableNode,
        TableCellNode,
        TableRowNode,
        ImageNode,
      ],
      editable: !readOnly,
    };

    const handleScroll = useCallback(() => {
      if (onScroll && scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        onScroll({ scrollTop, scrollHeight, clientHeight });
      }
    }, [onScroll]);

    // Handle initial HTML load and updates
    useEffect(() => {
      if (!editorRef) return;

      editorRef.update(() => {
        // Check if content is actually different to avoid cursor jumping or unnecessary updates
        const currentHtml = $generateHtmlFromNodes(editorRef, null);
        if (currentHtml === html) return;

        isUpdatingFromServer.current = true;
        const parser = new DOMParser();
        const dom = parser.parseFromString(html || '<p class="editor-paragraph"><br></p>', 'text/html');
        const nodes = $generateNodesFromDOM(editorRef, dom);

        $getRoot().clear();
        $getRoot().append(...nodes);
        isUpdatingFromServer.current = false;
      });
    }, [html, editorRef]);

    const handleEditorChange = (editorState: any) => {
      // Skip if this change was triggered by our own sync
      if (isUpdatingFromServer.current) return;

      editorState.read(() => {
        // Generate HTML
        const htmlString = $generateHtmlFromNodes(editorRef, null);
        onChange(htmlString);
      });
    };

    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <div className="border-b border-border-color bg-secondary/30 p-2 overflow-x-auto">
          <div className="flex flex-wrap gap-1 min-w-max">
            {/* 
              We instantiate the ToolbarPlugin inside the Composer, but we render the buttons here.
              Actually, the ToolbarPlugin is a component *inside* the Composer that renders nothing but uses the context.
              Wait, the extracted toolbar plugin RENDS modals but we need the buttons. 
              The extracted ToolbarPlugin accepts `onActionsChange` which gives us the buttons config. 
              We render the buttons here using that config.
            */}
            {toolbarActions.map(action => (
              <button
                key={action.id}
                type="button"
                className={`p-1.5 rounded transition-colors ${action.isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-main hover:bg-secondary-hover'
                  } ${action.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.label}
              >
                <action.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div
          className="relative flex-1 overflow-auto"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <LexicalComposer initialConfig={initialConfig}>
            {/* Capture the editor instance */}
            <OnChangePlugin onChange={handleEditorChange} />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <TablePlugin />
            <TableColumnResizePlugin />
            <ToolbarPlugin
              readOnly={readOnly}
              onActionsChange={setToolbarActions}
            />
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-full px-8 py-6 focus:outline-none max-w-4xl mx-auto" />
              }
              placeholder={<Placeholder />}
              ErrorBoundary={LexicalErrorBoundary}
            />
            {/* Ref Handler */}
            <EditorRefPlugin setEditorRef={setEditorRef} />
            {/* Focus Handler */}
            <FocusPlugin onFocusChange={onFocusChange} />
          </LexicalComposer>

          {/* Context Menu would go here if we kept it enabled */}
        </div>
      </div>
    );
  }
);

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// Helper plugin to expose the editor instance
const EditorRefPlugin = ({ setEditorRef }: { setEditorRef: (editor: any) => void }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    setEditorRef(editor);
  }, [editor, setEditorRef]);
  return null;
};

// Helper plugin to track focus
const FocusPlugin = ({ onFocusChange }: { onFocusChange?: (hasFocus: boolean) => void }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerRootListener((rootElement: HTMLElement | null, prevRootElement: HTMLElement | null) => {
      if (prevRootElement) {
        prevRootElement.removeEventListener('focus', handleFocus);
        prevRootElement.removeEventListener('blur', handleBlur);
      }
      if (rootElement) {
        rootElement.addEventListener('focus', handleFocus);
        rootElement.addEventListener('blur', handleBlur);
      }
    });

    function handleFocus() {
      onFocusChange?.(true);
    }
    function handleBlur() {
      onFocusChange?.(false);
    }
  }, [editor, onFocusChange]);
  return null;
}

export default RichTextEditor;

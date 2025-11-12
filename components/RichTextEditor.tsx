import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Descendant } from 'slate';
import { Plate, PlateContent, createPlateEditor } from '@udecode/plate-core/react';
import { deserializeHtml, serializeHtml } from '@udecode/plate-core';
import { BasicElementsPlugin } from '@udecode/plate-basic-elements/react';
import { BasicMarksPlugin } from '@udecode/plate-basic-marks/react';

interface ScrollInfo {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface RichTextEditorHandle {
  format: () => void;
  setScrollTop: (scrollTop: number) => void;
  getScrollInfo: () => Promise<ScrollInfo>;
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onScroll?: (info: ScrollInfo) => void;
  readOnly?: boolean;
  onFocusChange?: (hasFocus: boolean) => void;
  fontFamily?: string;
  fontSize?: number;
}

type SlateValue = Descendant[];

type MarkKey = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code';

type MarkButton = {
  key: MarkKey;
  label: string;
  tooltip: string;
};

const EMPTY_VALUE: SlateValue = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

const MARK_BUTTONS: MarkButton[] = [
  { key: 'bold', label: 'B', tooltip: 'Bold' },
  { key: 'italic', label: 'I', tooltip: 'Italic' },
  { key: 'underline', label: 'U', tooltip: 'Underline' },
  { key: 'strikethrough', label: 'S', tooltip: 'Strikethrough' },
  { key: 'code', label: '</>', tooltip: 'Inline Code' },
];

const sanitizeSerializedHtml = (rawHtml: string): string => {
  if (typeof window === 'undefined') {
    return rawHtml;
  }

  const container = window.document.createElement('div');
  container.innerHTML = rawHtml;
  const editorRoot = container.querySelector('[data-slate-editor]') as HTMLElement | null;
  const target = editorRoot ?? container;

  const scrubElement = (element: Element) => {
    const attributes = Array.from(element.attributes);
    for (const attr of attributes) {
      if (attr.name.startsWith('data-slate')) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (attr.name === 'class') {
        const filtered = attr.value
          .split(/\s+/)
          .filter((cls) => cls && !cls.startsWith('slate-') && cls !== 'slate-editor');
        if (filtered.length > 0) {
          element.setAttribute('class', filtered.join(' '));
        } else {
          element.removeAttribute('class');
        }
        continue;
      }
      if (attr.name === 'style') {
        element.removeAttribute('style');
      }
    }
    Array.from(element.children).forEach((child) => scrubElement(child));
  };

  scrubElement(target);

  if (editorRoot) {
    return editorRoot.innerHTML;
  }
  return target.innerHTML;
};

const convertNodesToValue = (nodes: unknown): SlateValue => {
  if (!Array.isArray(nodes)) {
    return EMPTY_VALUE;
  }

  const slateNodes: Descendant[] = [];
  for (const node of nodes) {
    if (!node) {
      continue;
    }
    if (typeof node === 'string') {
      if (node.trim().length === 0) {
        continue;
      }
      slateNodes.push({ type: 'p', children: [{ text: node }] });
      continue;
    }
    if (typeof node === 'object') {
      const candidate = node as Record<string, unknown>;
      if ('text' in candidate) {
        slateNodes.push({ type: 'p', children: [candidate as unknown as Descendant] });
        continue;
      }
      if ('type' in candidate && 'children' in candidate) {
        slateNodes.push(node as Descendant);
        continue;
      }
    }
  }
  return slateNodes.length > 0 ? slateNodes : EMPTY_VALUE;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, onChange, onScroll, readOnly = false, onFocusChange, fontFamily, fontSize }, ref) => {
    const plugins = useMemo(() => [BasicElementsPlugin, BasicMarksPlugin], []);
    const editor = useMemo(() => createPlateEditor({ plugins }), [plugins]);
    const [value, setValue] = useState<SlateValue>(EMPTY_VALUE);
    const [activeMarks, setActiveMarks] = useState<Record<string, unknown>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const skipNextContentSyncRef = useRef(false);
    const latestSerializedRef = useRef(content ?? '');

    useEffect(() => {
      if (skipNextContentSyncRef.current) {
        skipNextContentSyncRef.current = false;
        return;
      }

      let cancelled = false;

      const applyContent = async () => {
        if (typeof window === 'undefined') {
          setValue(EMPTY_VALUE);
          return;
        }

        const parser = new window.DOMParser();
        const doc = parser.parseFromString(`<body>${content || ''}</body>`, 'text/html');
        const parsed = await deserializeHtml(editor, { element: doc.body });
        if (!cancelled) {
          const nextValue = convertNodesToValue(parsed);
          setValue(nextValue);
          editor.children = nextValue;
          latestSerializedRef.current = content ?? '';
          setActiveMarks(editor.api.marks?.() ?? {});
        }
      };

      void applyContent();

      return () => {
        cancelled = true;
      };
    }, [content, editor]);

    useEffect(() => {
      editor.children = value;
    }, [editor, value]);

    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        if (!onScroll) return;
        const target = event.currentTarget;
        onScroll({
          scrollTop: target.scrollTop,
          scrollHeight: target.scrollHeight,
          clientHeight: target.clientHeight,
        });
      },
      [onScroll],
    );

    const pushSerializedUpdate = useCallback(async () => {
      const rawHtml = await serializeHtml(editor, {
        stripClassNames: true,
        stripDataAttributes: true,
        preserveClassNames: [],
      });
      const sanitized = sanitizeSerializedHtml(rawHtml);
      if (sanitized !== latestSerializedRef.current) {
        latestSerializedRef.current = sanitized;
        onChange(sanitized);
      }
    }, [editor, onChange]);

    const handleValueChange = useCallback(
      (nextValue: SlateValue) => {
        setValue(nextValue);
        editor.children = nextValue;
        setActiveMarks(editor.api.marks?.() ?? {});
        skipNextContentSyncRef.current = true;
        void pushSerializedUpdate();
      },
      [editor, pushSerializedUpdate],
    );

    const handleToggleMark = useCallback(
      (mark: MarkKey) => {
        if (readOnly) return;
        const transforms = editor.getTransforms(BasicMarksPlugin);
        transforms.focus?.();
        const api = transforms[mark as keyof typeof transforms];
        if (api && typeof api === 'object' && 'toggle' in api && typeof (api as { toggle: () => void }).toggle === 'function') {
          (api as { toggle: () => void }).toggle();
          setActiveMarks(editor.api.marks?.() ?? {});
          skipNextContentSyncRef.current = true;
          void pushSerializedUpdate();
        }
      },
      [editor, pushSerializedUpdate, readOnly],
    );

    useImperativeHandle(
      ref,
      () => ({
        format: () => {
          editor.normalize();
        },
        setScrollTop: (scrollTop: number) => {
          if (containerRef.current) {
            containerRef.current.scrollTop = scrollTop;
          }
        },
        getScrollInfo: async () => {
          const el = containerRef.current;
          return {
            scrollTop: el?.scrollTop ?? 0,
            scrollHeight: el?.scrollHeight ?? 0,
            clientHeight: el?.clientHeight ?? 0,
          };
        },
      }),
      [editor],
    );

    const fontStyles: React.CSSProperties = useMemo(() => {
      const styles: React.CSSProperties = {
        fontFamily: fontFamily || 'var(--font-sans, ui-sans-serif)',
      };
      if (fontSize && Number.isFinite(fontSize)) {
        styles.fontSize = `${fontSize}px`;
      }
      return styles;
    }, [fontFamily, fontSize]);

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border-color bg-secondary">
          {MARK_BUTTONS.map(({ key, label, tooltip }) => {
            const isActive = Boolean(activeMarks?.[key]);
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleToggleMark(key)}
                title={tooltip}
                disabled={readOnly}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors duration-150 ${
                  isActive ? 'bg-primary text-white' : 'bg-background text-text-secondary hover:bg-secondary'
                } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-background"
          onScroll={handleScroll}
        >
          <Plate
            editor={editor}
            plugins={plugins}
            value={value}
            onChange={handleValueChange}
            readOnly={readOnly}
            onSelectionChange={() => {
              setActiveMarks(editor.api.marks?.() ?? {});
            }}
          >
            <PlateContent
              editableProps={{
                spellCheck: true,
                className:
                  'min-h-full outline-none px-4 py-4 focus:outline-none focus-visible:ring-0 text-text-main space-y-4',
                style: fontStyles,
                readOnly,
                onFocus: () => onFocusChange?.(true),
                onBlur: () => onFocusChange?.(false),
              }}
            />
          </Plate>
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

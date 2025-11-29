import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  createCommand,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type Spread,
  type SerializedLexicalNode,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';

export type ImagePayload = {
  src: string;
  altText?: string;
  width?: number | 'inherit';
  height?: number | 'inherit';
};

export type SerializedImageNode = Spread<
  {
    type: 'image';
    version: 1;
    src: string;
    altText: string;
    width?: number | 'inherit';
    height?: number | 'inherit';
  },
  SerializedLexicalNode
>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand('INSERT_IMAGE_COMMAND');

const MIN_DIMENSION = 64;

type ImageComponentProps = ImagePayload & {
  nodeKey: NodeKey;
};

type PointerState = {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const ImageComponent: React.FC<ImageComponentProps> = ({ src, altText, width, height, nodeKey }) => {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isResizing, setIsResizing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointerStateRef = useRef<PointerState | null>(null);
  const [currentWidth, setCurrentWidth] = useState<number | 'inherit'>(width ?? 'inherit');
  const [currentHeight, setCurrentHeight] = useState<number | 'inherit'>(height ?? 'inherit');

  useEffect(() => {
    setCurrentWidth(width ?? 'inherit');
  }, [width]);

  useEffect(() => {
    setCurrentHeight(height ?? 'inherit');
  }, [height]);

  const updateDimensions = useCallback(
    (nextWidth: number | 'inherit', nextHeight: number | 'inherit') => {
      setCurrentWidth(nextWidth);
      setCurrentHeight(nextHeight);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidthAndHeight(nextWidth, nextHeight);
        }
      });
    },
    [editor, nodeKey],
  );

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.remove();
          }
        });
        return true;
      }
      return false;
    },
    [editor, isSelected, nodeKey],
  );

  const onClick = useCallback(
    (event: MouseEvent) => {
      if (!imageRef.current) {
        return false;
      }

      if (event.target === imageRef.current) {
        if (event.shiftKey) {
          setSelected(!isSelected);
          return true;
        }

        clearSelection();
        setSelected(true);
        return true;
      }

      return false;
    },
    [clearSelection, isSelected, setSelected],
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          (_payload, _newEditor: LexicalEditor) => {
            const selection = $getSelection();
            if ($isNodeSelection(selection)) {
              const isNodeSelected = selection.has(nodeKey);
              setSelected(isNodeSelected);
              return false;
            }
            if (isSelected) {
              setSelected(false);
            }
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
        editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
        editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      ),
    [editor, isSelected, nodeKey, onClick, onDelete, setSelected],
  );

  const resolvedWidth = useMemo(() => (typeof currentWidth === 'number' ? `${currentWidth}px` : currentWidth ?? 'auto'), [
    currentWidth,
  ]);
  const resolvedHeight = useMemo(
    () => (typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight ?? 'auto'),
    [currentHeight],
  );

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state) {
      return;
    }

    const nextWidth = Math.max(MIN_DIMENSION, state.startWidth + (event.clientX - state.startX));
    const nextHeight = Math.max(MIN_DIMENSION, state.startHeight + (event.clientY - state.startY));

    setCurrentWidth(nextWidth);
    setCurrentHeight(nextHeight);
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    const state = pointerStateRef.current;
    if (state) {
      const nextWidth = Math.max(MIN_DIMENSION, state.startWidth + (event.clientX - state.startX));
      const nextHeight = Math.max(MIN_DIMENSION, state.startHeight + (event.clientY - state.startY));
      updateDimensions(nextWidth, nextHeight);
    }

    pointerStateRef.current = null;
    setIsResizing(false);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, updateDimensions]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isEditable || !imageRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const rect = imageRef.current.getBoundingClientRect();
      pointerStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
      };

      setIsResizing(true);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, isEditable],
  );

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const onDragStart = useCallback(
    (event: React.DragEvent) => {
      if (!isEditable || !event.dataTransfer) {
        return;
      }
      event.stopPropagation();
      event.dataTransfer.setData('text/plain', '_lexical_image');
    },
    [isEditable],
  );

  const showHandles = isEditable && isSelected;

  return (
    <span className="relative my-3 block w-full max-w-full" draggable={isEditable} onDragStart={onDragStart}>
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        style={{ width: resolvedWidth, height: resolvedHeight, maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'contain' }}
        className={`block border border-border-color/60 bg-secondary ${showHandles ? 'ring-2 ring-primary' : ''}`}
        draggable={false}
      />
      {showHandles ? (
        <div className="pointer-events-none absolute inset-0">
          <div
            role="presentation"
            className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-sm border border-primary bg-background"
            onPointerDown={handlePointerDown}
          />
        </div>
      ) : null}
      {isResizing ? <div className="pointer-events-none absolute inset-0 rounded-md border-2 border-dashed border-primary" /> : null}
    </span>
  );
};

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width?: number | 'inherit';
  __height?: number | 'inherit';

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__height, node.__key);
  }

  constructor(src: string, altText = '', width?: number | 'inherit', height?: number | 'inherit', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('span');
    dom.className = 'inline-block my-3 w-full';
    dom.style.maxWidth = '100%';
    return dom;
  }

  update(): boolean {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.__key}
      />
    );
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
    });
  }

  exportDOM(): { element: HTMLElement } {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    if (this.__width) {
      element.setAttribute('width', typeof this.__width === 'number' ? String(this.__width) : this.__width);
    }
    if (this.__height) {
      element.setAttribute('height', typeof this.__height === 'number' ? String(this.__height) : this.__height);
    }
    element.className = 'rich-image';
    return { element };
  }

  setWidthAndHeight(width?: number | 'inherit', height?: number | 'inherit') {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (domNode: Node) => {
        if (domNode instanceof HTMLImageElement) {
          return {
            conversion: () => {
              const { src, alt, width, height } = domNode;
              return {
                node: $createImageNode({
                  src,
                  altText: alt,
                  width: width ? Number(width) || undefined : undefined,
                  height: height ? Number(height) || undefined : undefined,
                }),
              } as DOMConversionOutput;
            },
            priority: 0,
          };
        }
        return null;
      },
    };
  }
}

export function $createImageNode({ src, altText, width, height }: ImagePayload): ImageNode {
  return new ImageNode(src, altText, width, height);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

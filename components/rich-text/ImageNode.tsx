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
  DRAGEND_COMMAND,
  DRAGSTART_COMMAND,
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

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type PointerState = {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  direction: ResizeDirection;
  aspectRatio: number;
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
  const [naturalSize, setNaturalSize] = useState({
    width: typeof width === 'number' ? width : 0,
    height: typeof height === 'number' ? height : 0,
  });

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

      const target = event.target as HTMLElement | null;
      if (target && (target === imageRef.current || target.dataset.type === 'image-handle')) {
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

  const onDragStart = useCallback(
    (event: DragEvent) => {
      if (!isEditable || !event.dataTransfer || !imageRef.current) {
        return false;
      }
      clearSelection();
      setSelected(true);
      event.dataTransfer.setData('text/plain', '_lexical_image');
      event.dataTransfer.setData('application/x-lexical-dragged-nodes', JSON.stringify([nodeKey]));
      event.dataTransfer.setDragImage(imageRef.current, imageRef.current.clientWidth / 2, imageRef.current.clientHeight / 2);
      event.dataTransfer.effectAllowed = 'move';
      return true;
    },
    [clearSelection, isEditable, nodeKey, setSelected],
  );

  const onDragEnd = useCallback(() => {
    setIsResizing(false);
    return false;
  }, []);

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
        editor.registerCommand(DRAGSTART_COMMAND, onDragStart, COMMAND_PRIORITY_LOW),
        editor.registerCommand(DRAGEND_COMMAND, onDragEnd, COMMAND_PRIORITY_LOW),
      ),
    [editor, isSelected, nodeKey, onClick, onDelete, onDragEnd, onDragStart, setSelected],
  );

  const resolvedWidth = useMemo(() => (typeof currentWidth === 'number' ? `${currentWidth}px` : currentWidth ?? 'auto'), [
    currentWidth,
  ]);
  const resolvedHeight = useMemo(
    () => (typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight ?? 'auto'),
    [currentHeight],
  );

  const measuredWidth = useMemo(() => {
    if (typeof currentWidth === 'number') return currentWidth;
    if (imageRef.current?.width) return imageRef.current.width;
    if (naturalSize.width) return naturalSize.width;
    return undefined;
  }, [currentWidth, naturalSize.width]);

  const measuredHeight = useMemo(() => {
    if (typeof currentHeight === 'number') return currentHeight;
    if (imageRef.current?.height) return imageRef.current.height;
    if (naturalSize.height) return naturalSize.height;
    return undefined;
  }, [currentHeight, naturalSize.height]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    let nextWidth = state.startWidth;
    let nextHeight = state.startHeight;

    if (state.direction.includes('e')) {
      nextWidth += deltaX;
    }
    if (state.direction.includes('w')) {
      nextWidth -= deltaX;
    }
    if (state.direction.includes('s')) {
      nextHeight += deltaY;
    }
    if (state.direction.includes('n')) {
      nextHeight -= deltaY;
    }

    const lockAspect = event.shiftKey || state.direction.length === 2;
    if (lockAspect) {
      const widthBasedHeight = nextWidth / state.aspectRatio;
      const heightBasedWidth = nextHeight * state.aspectRatio;
      if (Math.abs(widthBasedHeight - nextHeight) > Math.abs(heightBasedWidth - nextWidth)) {
        nextHeight = widthBasedHeight;
      } else {
        nextWidth = heightBasedWidth;
      }
    }

    setCurrentWidth(Math.max(MIN_DIMENSION, nextWidth));
    setCurrentHeight(Math.max(MIN_DIMENSION, nextHeight));
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const state = pointerStateRef.current;
      if (state) {
        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;
        let nextWidth = state.startWidth;
        let nextHeight = state.startHeight;

        if (state.direction.includes('e')) {
          nextWidth += deltaX;
        }
        if (state.direction.includes('w')) {
          nextWidth -= deltaX;
        }
        if (state.direction.includes('s')) {
          nextHeight += deltaY;
        }
        if (state.direction.includes('n')) {
          nextHeight -= deltaY;
        }

        const lockAspect = event.shiftKey || state.direction.length === 2;
        if (lockAspect) {
          const widthBasedHeight = nextWidth / state.aspectRatio;
          const heightBasedWidth = nextHeight * state.aspectRatio;
          if (Math.abs(widthBasedHeight - nextHeight) > Math.abs(heightBasedWidth - nextWidth)) {
            nextHeight = widthBasedHeight;
          } else {
            nextWidth = heightBasedWidth;
          }
        }

        nextWidth = Math.max(MIN_DIMENSION, nextWidth);
        nextHeight = Math.max(MIN_DIMENSION, nextHeight);
        updateDimensions(nextWidth, nextHeight);
      }

      pointerStateRef.current = null;
      setIsResizing(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, updateDimensions],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
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
        direction,
        aspectRatio: rect.width / rect.height,
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

  const showHandles = isEditable && isSelected;

  return (
    <span
      className={`group relative my-3 inline-block max-w-full align-top ${isSelected ? 'cursor-move' : ''}`}
      draggable={isEditable}
      style={{
        width: measuredWidth ? `${measuredWidth}px` : undefined,
        height: measuredHeight ? `${measuredHeight}px` : undefined,
      }}
    >
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        style={{ width: resolvedWidth, height: resolvedHeight, maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'contain' }}
        className={`block border border-border-color/60 bg-secondary transition-shadow duration-150 ${showHandles ? 'ring-2 ring-primary shadow-lg' : 'shadow-sm'}`}
        draggable={isEditable}
        onLoad={(event) => {
          setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
        }}
        onDragStart={(event) => {
          onDragStart(event.nativeEvent);
        }}
        onDragEnd={(event) => {
          event.preventDefault();
          onDragEnd();
        }}
      />
      {showHandles ? (
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]">
          {(
            [
              ['nw', '-top-2 -left-2 cursor-nw-resize'],
              ['n', '-top-2 left-1/2 -translate-x-1/2 cursor-n-resize'],
              ['ne', '-top-2 -right-2 cursor-ne-resize'],
              ['e', 'top-1/2 -right-2 -translate-y-1/2 cursor-e-resize'],
              ['se', '-bottom-2 -right-2 cursor-se-resize'],
              ['s', '-bottom-2 left-1/2 -translate-x-1/2 cursor-s-resize'],
              ['sw', '-bottom-2 -left-2 cursor-sw-resize'],
              ['w', 'top-1/2 -left-2 -translate-y-1/2 cursor-w-resize'],
            ] as const
          ).map(([direction, positionClass]) => (
            <button
              key={direction}
              type="button"
              data-type="image-handle"
              className={`pointer-events-auto absolute h-3 w-3 rounded-full border border-primary bg-background transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${positionClass}`}
              onPointerDown={(event) => handlePointerDown(event, direction)}
            />
          ))}
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            {`${Math.round(measuredWidth ?? 0)} × ${Math.round(measuredHeight ?? 0)} px`}
          </div>
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
    dom.className = 'inline-block my-3 max-w-full';
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

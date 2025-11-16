import React from 'react';
import {
  DecoratorNode,
  createCommand,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalCommand,
  type LexicalNode,
  type NodeKey,
  type Spread,
  type SerializedLexicalNode,
} from 'lexical';

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

class ImageComponent extends React.Component<ImagePayload> {
  render(): React.ReactNode {
    const { src, altText, width, height } = this.props;
    const resolvedWidth = typeof width === 'number' ? `${width}px` : width ?? 'auto';
    const resolvedHeight = typeof height === 'number' ? `${height}px` : height ?? 'auto';

    return (
      <img
        src={src}
        alt={altText}
        style={{
          width: resolvedWidth,
          height: resolvedHeight,
          maxWidth: '100%',
          borderRadius: '0.5rem',
          objectFit: 'contain',
        }}
        className="block border border-border-color/60 bg-secondary"
        draggable={false}
      />
    );
  }
}

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

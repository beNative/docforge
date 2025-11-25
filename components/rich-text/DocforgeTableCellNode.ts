import type { EditorConfig, LexicalEditor, NodeKey } from 'lexical';
import {
  TableCellHeaderStates,
  TableCellNode,
  type SerializedTableCellNode,
  type TableCellHeaderState,
} from '@lexical/table';

export type SerializedDocforgeTableCellNode = SerializedTableCellNode & {
  borderColor?: string | null;
  borderWidth?: number | null;
};

export class DocforgeTableCellNode extends TableCellNode {
  __borderColor: string | null;
  __borderWidth: number | null;

  static getType(): string {
    return 'tablecell';
  }

  static clone(node: DocforgeTableCellNode): DocforgeTableCellNode {
    const cloned = new DocforgeTableCellNode(node.__headerState, node.__colSpan, node.__width, node.__key);
    cloned.__rowSpan = node.__rowSpan;
    cloned.__backgroundColor = node.__backgroundColor;
    cloned.__borderColor = node.__borderColor;
    cloned.__borderWidth = node.__borderWidth;
    return cloned;
  }

  static importJSON(serializedNode: SerializedDocforgeTableCellNode): DocforgeTableCellNode {
    const node = new DocforgeTableCellNode(serializedNode.headerState, serializedNode.colSpan, serializedNode.width);
    node.__rowSpan = serializedNode.rowSpan ?? 1;
    node.__backgroundColor = serializedNode.backgroundColor ?? null;
    node.__borderColor = serializedNode.borderColor ?? null;
    node.__borderWidth = serializedNode.borderWidth ?? null;
    return node;
  }

  constructor(headerState?: TableCellHeaderState, colSpan?: number, width?: number, key?: NodeKey) {
    super(headerState, colSpan, width, key);
    this.__borderColor = null;
    this.__borderWidth = null;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    if (this.__borderColor) {
      element.style.borderColor = this.__borderColor;
    }
    if (this.__borderWidth !== null) {
      element.style.borderWidth = `${this.__borderWidth}px`;
      element.style.borderStyle = 'solid';
    }
    return element;
  }

  updateDOM(prevNode: DocforgeTableCellNode): boolean {
    if (prevNode.__borderColor !== this.__borderColor || prevNode.__borderWidth !== this.__borderWidth) {
      return true;
    }
    return super.updateDOM(prevNode);
  }

  exportDOM(editor: LexicalEditor): { element: HTMLElement | null } {
    const { element } = super.exportDOM(editor);
    if (element) {
      if (this.__borderColor) {
        element.style.borderColor = this.__borderColor;
      }
      if (this.__borderWidth !== null) {
        element.style.borderWidth = `${this.__borderWidth}px`;
        element.style.borderStyle = 'solid';
      }
    }
    return { element };
  }

  exportJSON(): SerializedDocforgeTableCellNode {
    return {
      ...super.exportJSON(),
      borderColor: this.getBorderColor(),
      borderWidth: this.getBorderWidth(),
    };
  }

  getBorderColor(): string | null {
    return this.getLatest().__borderColor;
  }

  setBorderColor(borderColor: string | null): void {
    this.getWritable().__borderColor = borderColor;
  }

  getBorderWidth(): number | null {
    return this.getLatest().__borderWidth;
  }

  setBorderWidth(borderWidth: number | null): void {
    this.getWritable().__borderWidth = borderWidth;
  }
}

export function $createDocforgeTableCellNode(
  headerState: TableCellHeaderState,
  colSpan?: number,
  width?: number,
): DocforgeTableCellNode {
  return new DocforgeTableCellNode(headerState, colSpan, width);
}

export function $isDocforgeTableCellNode(
  node: unknown,
): node is DocforgeTableCellNode {
  return node instanceof DocforgeTableCellNode;
}

export { TableCellHeaderStates };

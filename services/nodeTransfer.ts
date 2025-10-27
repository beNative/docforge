import type {
  ClassificationSource,
  DocType,
  DocumentVersion,
  DraggedNodeTransfer,
  Node,
  NodePythonSettings,
  SerializedDocumentVersionEntry,
  SerializedNodeForTransfer,
  SerializedPythonSettings,
  ViewMode,
} from '../types';

export interface TransferableTreeNode {
  id: string;
  type: 'document' | 'folder';
  title: string;
  content?: string;
  doc_type?: DocType;
  language_hint?: string | null;
  default_view_mode?: ViewMode | null;
  language_source?: ClassificationSource | null;
  doc_type_source?: ClassificationSource | null;
  classification_updated_at?: string | null;
  pythonSettings?: NodePythonSettings | null;
  children: TransferableTreeNode[];
}

export interface TransferContext {
  nodeLookup: Map<string, TransferableTreeNode>;
  parentLookup: Map<string, string | null>;
}

export interface BuildTransferOptions {
  includePythonSettings?: boolean;
  histories?: Map<string, SerializedDocumentVersionEntry[]>;
}

const mapPythonSettings = (
  settings: NodePythonSettings | null | undefined,
): SerializedPythonSettings | undefined => {
  if (!settings) {
    return undefined;
  }

  return {
    env_id: settings.envId ?? null,
    auto_detect_environment: settings.autoDetectEnvironment ?? true,
    last_run_id: settings.lastUsedRunId ?? null,
  };
};

const normalizeVersions = (
  nodeId: string,
  histories: Map<string, SerializedDocumentVersionEntry[]> | undefined,
): SerializedDocumentVersionEntry[] | undefined => {
  if (!histories?.has(nodeId)) {
    return undefined;
  }
  const entries = histories.get(nodeId) ?? [];
  const normalized = entries
    .map((entry) => ({
      version_id: entry.version_id,
      created_at: entry.created_at,
      content: entry.content ?? '',
    }))
    .filter((entry) => typeof entry.created_at === 'string');
  return normalized.length > 0 ? normalized : undefined;
};

export const buildTransferContext = (tree: TransferableTreeNode[]): TransferContext => {
  const nodeLookup = new Map<string, TransferableTreeNode>();
  const parentLookup = new Map<string, string | null>();

  const traverse = (nodes: TransferableTreeNode[], parentId: string | null) => {
    for (const node of nodes) {
      nodeLookup.set(node.id, node);
      parentLookup.set(node.id, parentId);
      if (node.children?.length) {
        traverse(node.children, node.id);
      }
    }
  };

  traverse(tree, null);
  return { nodeLookup, parentLookup };
};

export const collectRootNodesForSelection = (
  selectedIds: string[],
  context: TransferContext,
): TransferableTreeNode[] => {
  if (selectedIds.length === 0) {
    return [];
  }
  const idSet = new Set(selectedIds);
  const rootIds = selectedIds.filter((id) => {
    let current = context.parentLookup.get(id) ?? null;
    while (current) {
      if (idSet.has(current)) {
        return false;
      }
      current = context.parentLookup.get(current) ?? null;
    }
    return true;
  });

  const nodes: TransferableTreeNode[] = [];
  for (const id of rootIds) {
    const node = context.nodeLookup.get(id);
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
};

const serializeNodeInternal = (
  node: TransferableTreeNode,
  options: BuildTransferOptions,
): SerializedNodeForTransfer => {
  const children = node.children?.length
    ? node.children.map((child) => serializeNodeInternal(child, options))
    : undefined;

  const serialized: SerializedNodeForTransfer = {
    type: node.type,
    title: node.title,
    content: node.content,
    doc_type: node.doc_type,
    language_hint: node.language_hint ?? null,
    default_view_mode: node.default_view_mode ?? null,
    language_source: node.language_source ?? null,
    doc_type_source: node.doc_type_source ?? null,
    classification_updated_at: node.classification_updated_at ?? null,
    children,
  };

  if (options.includePythonSettings) {
    const mapped = mapPythonSettings(node.pythonSettings);
    if (mapped) {
      serialized.python_settings = mapped;
    }
  }

  const versions = normalizeVersions(node.id, options.histories);
  if (versions) {
    serialized.versions = versions;
  }

  return serialized;
};

export const serializeNodesForTransfer = (
  nodes: TransferableTreeNode[],
  options: BuildTransferOptions,
): SerializedNodeForTransfer[] => nodes.map((node) => serializeNodeInternal(node, options));

export const buildDraggedNodePayload = (
  selectedIds: string[],
  context: TransferContext,
  options: BuildTransferOptions = {},
): DraggedNodeTransfer | null => {
  const roots = collectRootNodesForSelection(selectedIds, context);
  if (!roots.length) {
    return null;
  }

  const serializedNodes = serializeNodesForTransfer(roots, options);
  if (serializedNodes.length === 0) {
    return null;
  }

  return {
    schema: 'docforge/nodes',
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: serializedNodes,
    options: {
      includeHistory: Boolean(options.histories && options.histories.size > 0),
      includePythonSettings: Boolean(options.includePythonSettings),
    },
  };
};

export const adaptRepositoryNodesToTransferable = (
  nodes: Node[],
): TransferableTreeNode[] => {
  const mapNode = (node: Node): TransferableTreeNode => ({
    id: node.node_id,
    type: node.node_type,
    title: node.title,
    content: node.document?.content,
    doc_type: node.document?.doc_type,
    language_hint: node.document?.language_hint ?? null,
    default_view_mode: node.document?.default_view_mode ?? null,
    language_source: node.document?.language_source ?? null,
    doc_type_source: node.document?.doc_type_source ?? null,
    classification_updated_at: node.document?.classification_updated_at ?? null,
    pythonSettings: node.pythonSettings ?? null,
    children: (node.children ?? []).map(mapNode),
  });

  return nodes.map(mapNode);
};

export const mapDocumentVersionsToSerializedEntries = (
  versions: DocumentVersion[],
): SerializedDocumentVersionEntry[] =>
  versions.map((version) => ({
    version_id: version.version_id,
    created_at: version.created_at,
    content: version.content ?? '',
  }));

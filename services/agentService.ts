import type { Node, DocType, ScriptLanguage, AgentToolCall } from '../types';

export const AGENT_TOOLS = [
  {
    name: 'get_workspace_tree',
    description: 'Returns the current workspace structure as a tree of nodes (folders and documents). Use this to find node IDs or paths.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_document',
    description: 'Reads the full content of a document by its ID.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The UUID of the document to read.' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'edit_document',
    description: 'Updates the content of an existing document. Use this to refine, rewrite, or modify documents.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The UUID of the document to edit.' },
        content: { type: 'string', description: 'The new full content of the document.' },
      },
      required: ['nodeId', 'content'],
    },
  },
  {
    name: 'create_node',
    description: 'Creates a new document or folder in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['document', 'folder'], description: 'The type of node to create.' },
        title: { type: 'string', description: 'The title of the new node.' },
        parentId: { type: 'string', description: 'The UUID of the parent folder (null for root).', nullable: true },
        content: { type: 'string', description: 'Initial content if creating a document.' },
        docType: { type: 'string', description: 'The document type (prompt, source_code, image, pdf, rich_text).' },
        languageHint: { type: 'string', description: 'The programming language hint for syntax highlighting.' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'delete_nodes',
    description: 'Deletes one or more nodes (documents or folders) from the workspace.',
    parameters: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'The UUIDs of the nodes to delete.' },
      },
      required: ['nodeIds'],
    },
  },
  {
    name: 'move_nodes',
    description: 'Moves one or more nodes to a new parent folder.',
    parameters: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'The UUIDs of the nodes to move.' },
        targetParentId: { type: 'string', description: 'The UUID of the target parent folder (null for root).', nullable: true },
        position: { type: 'string', enum: ['before', 'after', 'inside'], description: 'Position relative to the target.' },
      },
      required: ['nodeIds', 'targetParentId'],
    },
  },
  {
    name: 'run_script',
    description: 'Executes a script (Python, Shell, PowerShell) in a sandboxed environment.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'shell', 'powershell'], description: 'The programming language.' },
        code: { type: 'string', description: 'The code to execute.' },
        nodeId: { type: 'string', description: 'Optional: Associate the execution with a specific node.' },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'search_workspace',
    description: 'Performs a semantic (RAG) search across all documents in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query or keywords. Use this if you need information that is not in the current priority context.' },
      },
      required: ['query'],
    },
  },
];

export interface ToolExecutorContext {
  nodes: Node[];
  addNode: (node: any) => Promise<Node>;
  updateNode: (id: string, updates: any) => Promise<void>;
  updateDocumentContent: (id: string, content: string) => Promise<void>;
  deleteNodes: (ids: string[]) => Promise<void>;
  moveNodes: (ids: string[], targetId: string | null, position: any) => Promise<void>;
  runPython: (code: string, nodeId?: string) => Promise<string>;
  runScript: (language: ScriptLanguage, code: string, nodeId?: string) => Promise<string>;
  refreshWorkspace: () => Promise<void>;
  searchRag: (query: string) => Promise<any[]>;
  addLog: (level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', message: string) => void;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const findNodeByTitleRecursive = (nodes: any[], title: string): any | null => {
  const normalizedSearch = title.trim().toLowerCase();
  for (const n of nodes) {
    if (n.title && n.title.trim().toLowerCase() === normalizedSearch) return n;
    if (n.children && n.children.length > 0) {
      const found = findNodeByTitleRecursive(n.children, title);
      if (found) return found;
    }
  }
  return null;
};

const resolveId = (idOrTitle: string | null | undefined, context: ToolExecutorContext): string | null => {
  if (idOrTitle === null || idOrTitle === undefined) return null;
  const s = String(idOrTitle).trim();
  if (!s || s === 'null' || s.toLowerCase() === 'root') return null;
  
  // If it's already a UUID, return it
  if (s.match(UUID_REGEX)) return s;
  
  // Try to find by title
  const found = findNodeByTitleRecursive(context.nodes, s);
  if (found) {
    const resolvedId = found.node_id || found.id || s;
    if (resolvedId !== s) {
        context.addLog('DEBUG', `[Agent] Resolved title "${s}" to ID "${resolvedId}"`);
    }
    return resolvedId;
  }
  
  context.addLog('WARNING', `[Agent] Could not resolve "${s}" to a valid node ID. Expected a UUID or a unique title from the workspace tree.`);
  return s; // Fallback to original title, validation will catch it if it's used as a foreign key
};

const resolveIds = (idsOrTitles: string[], context: ToolExecutorContext): string[] => {
  return idsOrTitles.map(id => resolveId(id, context) || id);
};

export async function executeTool(toolCall: AgentToolCall, context: ToolExecutorContext): Promise<string> {
  const args = typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;
  context.addLog('DEBUG', `[Agent] LLM calling tool: ${toolCall.name} with args: ${JSON.stringify(args)}`);
  
  try {
    switch (toolCall.name) {
    case 'get_workspace_tree': {
      const simplify = (nodes: any[]): any[] => nodes.map(n => ({
        nodeId: n.node_id,
        title: n.title,
        type: n.node_type,
        ...(n.parent_id ? { parentId: n.parent_id } : {}),
        ...(n.children && n.children.length > 0 ? { children: simplify(n.children) } : {})
      }));
      const result = JSON.stringify(simplify(context.nodes));
      context.addLog('DEBUG', `[Agent] Tool get_workspace_tree returned ${context.nodes.length} top-level nodes.`);
      return result;
    }

    case 'read_document': {
      const rawId = args.nodeId || args.node_id || args.id;
      if (!rawId) {
        context.addLog('WARNING', '[Agent] Tool read_document missing nodeId');
        return 'Error: Missing nodeId parameter.';
      }
      const nodeId = resolveId(rawId, context)!;
      if (nodeId && !nodeId.match(UUID_REGEX)) {
        const err = `Error: Could not resolve "${rawId}" to a valid document ID.`;
        context.addLog('WARNING', `[Agent] Tool read_document failed: ${err}`);
        return `${err} Use get_workspace_tree to find the correct ID or name.`;
      }
      
      const findDoc = (nodes: any[], id: string): any | null => {
        for (const n of nodes) {
          if ((n.node_id === id || n.id === id)) return n;
          if (n.children) {
            const found = findDoc(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const doc = findDoc(context.nodes, nodeId);
      if (!doc) {
        const err = `Error: Document with ID ${nodeId} not found.`;
        context.addLog('WARNING', `[Agent] Tool read_document failed: ${err}`);
        return err;
      }
      const content = doc.document?.content || '(Empty document)';
      context.addLog('INFO', `[Agent] Tool read_document read "${doc.title}" (${content.length} chars).`);
      return content;
    }

    case 'edit_document': {
      const rawId = args.nodeId || args.node_id || args.id;
      if (!rawId) return 'Error: Missing nodeId parameter.';
      const nodeId = resolveId(rawId, context)!;
      if (nodeId && !nodeId.match(UUID_REGEX)) {
        return `Error: Could not resolve "${rawId}" to a valid document ID.`;
      }
      await context.updateDocumentContent(nodeId, args.content);
      await context.refreshWorkspace();
      const result = `Successfully updated document ${nodeId}.`;
      context.addLog('INFO', `[Agent] Tool edit_document succeeded: ${result}`);
      return result;
    }

    case 'create_node': {
      const rawParentId = args.parentId !== undefined ? args.parentId : (args.parent_id !== undefined ? args.parent_id : null);
      const parentId = resolveId(rawParentId, context);

      if (parentId && !parentId.match(UUID_REGEX)) {
        const err = `Error: Could not resolve parent "${rawParentId}" to a valid folder ID.`;
        context.addLog('WARNING', `[Agent] Tool create_node failed: ${err}`);
        return err;
      }

      const newNode = await context.addNode({
        parent_id: parentId,
        node_type: args.type || args.node_type || 'document',
        title: args.title,
        content: args.content,
        docType: args.docType || args.doc_type,
        languageHint: args.languageHint || args.language_hint
      });
      await context.refreshWorkspace();
      const result = `Successfully created ${args.type} "${args.title}" with ID ${newNode.node_id}.`;
      context.addLog('INFO', `[Agent] Tool create_node succeeded: ${result}`);
      return result;
    }

    case 'move_nodes': {
      const rawIds = args.nodeIds || args.node_ids || [];
      const nodeIds = resolveIds(rawIds, context);
      const rawParentId = args.targetParentId || args.target_parent_id;
      const targetParentId = resolveId(rawParentId, context);
      
      if (targetParentId && !targetParentId.match(UUID_REGEX)) {
          return `Error: Could not resolve target parent "${rawParentId}" to a valid folder ID.`;
      }

      await context.moveNodes(nodeIds, targetParentId, args.position);
      await context.refreshWorkspace();
      const result = `Successfully moved ${nodeIds.length} nodes to ${targetParentId || 'root'}.`;
      context.addLog('INFO', `[Agent] Tool move_nodes succeeded: ${result}`);
      return result;
    }

    case 'delete_nodes': {
      const rawIds = args.nodeIds || args.node_ids || [];
      const nodeIds = resolveIds(rawIds, context);
      
      const unresolvable = rawIds.filter((_, i) => !nodeIds[i] || !nodeIds[i].match(UUID_REGEX));
      if (unresolvable.length > 0) {
          const result = `Error: Could not find nodes with these titles/IDs: ${unresolvable.join(', ')}.`;
          context.addLog('WARNING', `[Agent] Tool delete_nodes failed: ${result}`);
          return result;
      }

      await context.deleteNodes(nodeIds);
      await context.refreshWorkspace();
      const result = `Successfully deleted ${nodeIds.length} nodes.`;
      context.addLog('INFO', `[Agent] Tool delete_nodes succeeded: ${result}`);
      return result;
    }

    case 'run_script': {
      const result = args.language === 'python' 
        ? await context.runPython(args.code, args.nodeId)
        : await context.runScript(args.language, args.code, args.nodeId);
      context.addLog('INFO', `[Agent] Tool run_script (${args.language}) executed.`);
      return result;
    }

    case 'search_workspace': {
      const results = await context.searchRag(args.query);
      if (!results || results.length === 0) {
          context.addLog('INFO', `[Agent] Tool search_workspace found no results for "${args.query}"`);
          return 'No relevant information found for that query.';
      }
      
      const seenDocs = new Set<string>();
      const uniqueResults = results.filter(r => {
        if (seenDocs.has(r.nodeId)) return false;
        seenDocs.add(r.nodeId);
        return true;
      }).slice(0, 5);

      const result = JSON.stringify(uniqueResults.map((r: any) => ({
        id: r.nodeId,
        title: r.nodeTitle,
        snippet: r.chunkText.substring(0, 300) + (r.chunkText.length > 300 ? '...' : ''),
        relevance: Math.max(0, (1 - (r.distance / 1.5)) * 100).toFixed(0) + '%'
      })), null, 2);
      context.addLog('INFO', `[Agent] Tool search_workspace found ${uniqueResults.length} relevant documents.`);
      return result;
    }

    default:
      const err = `Error: Unknown tool ${toolCall.name}`;
      context.addLog('ERROR', `[Agent] ${err}`);
      return err;
    }
  } catch (error: any) {
    const errorMessage = `Error executing tool ${toolCall.name}: ${error.message || error}`;
    context.addLog('ERROR', `[Agent] ${errorMessage}`);
    return errorMessage;
  }
}

import type { Node, DocType, ViewMode, ScriptLanguage, PythonConsoleBehavior, AgentToolCall } from '../types';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_workspace_tree',
    description: 'Returns the entire workspace hierarchy including all folder and document IDs and titles. Use this to discover what files exist and their locations.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_document',
    description: 'Reads the full content of a specific document by its ID.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The unique ID of the document to read.' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'edit_document',
    description: 'Updates the content of an existing document. This creates a new version of the document.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The unique ID of the document to edit.' },
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
        parentId: { type: 'string', description: 'The ID of the parent folder. Use null for the root.', nullable: true },
        content: { type: 'string', description: 'Initial content if creating a document.' },
        docType: { type: 'string', enum: ['prompt', 'source_code', 'rich_text'], description: 'Optional document type classification.' },
      },
      required: ['type', 'title', 'parentId'],
    },
  },
  {
    name: 'move_nodes',
    description: 'Moves one or more nodes to a new parent folder or a new position.',
    parameters: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'List of node IDs to move.' },
        targetParentId: { type: 'string', description: 'The ID of the target folder. Use null for root.', nullable: true },
        position: { type: 'string', enum: ['before', 'after', 'inside'], description: 'Position relative to the target.' },
      },
      required: ['nodeIds', 'targetParentId', 'position'],
    },
  },
  {
    name: 'delete_nodes',
    description: 'Deletes one or more nodes and all their descendants. IRREVERSIBLE.',
    parameters: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'List of node IDs to delete.' },
      },
      required: ['nodeIds'],
    },
  },
  {
    name: 'run_script',
    description: 'Executes a Python or Shell script and returns the logs.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'shell', 'powershell'], description: 'The scripting language to use.' },
        code: { type: 'string', description: 'The code to execute.' },
        nodeId: { type: 'string', description: 'Optional context node ID.' },
      },
      required: ['language', 'code'],
    },
  },
  {
    name: 'search_workspace',
    description: 'Performs a semantic search across the entire workspace to find relevant document snippets for a query. Use this if you need more background information on a topic.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query or keywords.' },
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
  searchRag: (query: string) => Promise<any[]>;
}

export const executeTool = async (
  toolCall: AgentToolCall,
  context: ToolExecutorContext
): Promise<string> => {
  const args = JSON.parse(toolCall.arguments);
  
  switch (toolCall.name) {
    case 'get_workspace_tree': {
      const simplify = (nodes: Node[]): any[] => nodes.map(n => ({
        id: n.node_id,
        title: n.title,
        type: n.node_type,
        parentId: n.parent_id,
        children: n.children ? simplify(n.children) : undefined
      }));
      return JSON.stringify(simplify(context.nodes), null, 2);
    }

    case 'read_document': {
      const findDoc = (nodes: Node[], id: string): Node | null => {
        for (const n of nodes) {
          if (n.node_id === id) return n;
          if (n.children) {
            const found = findDoc(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const doc = findDoc(context.nodes, args.nodeId);
      if (!doc) return `Error: Document with ID ${args.nodeId} not found.`;
      return doc.document?.content || '(Empty document)';
    }

    case 'edit_document': {
      await context.updateDocumentContent(args.nodeId, args.content);
      return `Successfully updated document ${args.nodeId}.`;
    }

    case 'create_node': {
      const newNode = await context.addNode({
        parent_id: args.parentId,
        node_type: args.type,
        title: args.title,
        locked: false,
        document: args.type === 'document' ? {
          content: args.content || '',
          doc_type: args.docType || 'prompt',
          language_hint: 'plaintext',
          language_source: 'user',
          doc_type_source: 'user',
        } : undefined
      });
      return `Successfully created ${args.type} "${args.title}" with ID ${newNode.node_id}.`;
    }

    case 'move_nodes': {
      await context.moveNodes(args.nodeIds, args.targetParentId, args.position);
      return `Successfully moved ${args.nodeIds.length} nodes to ${args.targetParentId || 'root'}.`;
    }

    case 'delete_nodes': {
      await context.deleteNodes(args.nodeIds);
      return `Successfully deleted ${args.nodeIds.length} nodes.`;
    }

    case 'run_script': {
      if (args.language === 'python') {
        return await context.runPython(args.code, args.nodeId);
      } else {
        return await context.runScript(args.language, args.code, args.nodeId);
      }
    }

    case 'search_workspace': {
      const results = await context.searchRag(args.query);
      if (!results || results.length === 0) return 'No relevant information found for that query.';
      return JSON.stringify(results.map((r: any) => ({
        title: r.nodeTitle,
        content: r.content,
        relevance: (1 - r.distance).toFixed(2)
      })), null, 2);
    }

    default:
      return `Error: Tool ${toolCall.name} not implemented.`;
  }
};

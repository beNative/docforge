import type { Settings, RagSearchResult, RagChatMessage, RagIndexResponse, AgentToolCall } from '../types';
import { v4 as uuidv4 } from 'uuid';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// =================================================================
// RAG Prompt Assembly (System Prompt)
// =================================================================

const buildRagSystemPrompt = (
  contextChunks: RagSearchResult[],
  extraContext?: { 
    activeDocument?: { id: string, title: string, content: string }, 
    selectedText?: string,
    attachedDocuments?: { title: string, content: string }[]
  }
): string => {
  const contextBlocks = contextChunks
    .map(
      (chunk, idx) =>
        `[Source ${idx + 1}: "${chunk.nodeTitle}"]\n${chunk.chunkText}`
    )
    .join('\n---\n');

  let activeDocBlock = '';
  if (extraContext?.activeDocument) {
    activeDocBlock = `[CURRENT ACTIVE DOCUMENT: "${extraContext.activeDocument.title}" (ID: ${extraContext.activeDocument.id})]\n${extraContext.activeDocument.content}\n---\n`;
  }

  let selectionBlock = '';
  if (extraContext?.selectedText) {
    selectionBlock = `[USER SELECTED TEXT]:\n${extraContext.selectedText}\n---\n`;
  }

  let attachedDocsBlock = '';
  if (extraContext?.attachedDocuments && extraContext.attachedDocuments.length > 0) {
    attachedDocsBlock = extraContext.attachedDocuments
      .map(doc => `[ATTACHED DOCUMENT: "${doc.title}"]\n${doc.content}`)
      .join('\n---\n') + '\n---\n';
  }

  return `You are a helpful assistant answering questions about the user's document workspace in DocForge.
Use the following context to answer when relevant.

PRIORITY INSTRUCTIONS:
1. ALWAYS check the "Priority Context" below first. This contains the document the user is currently looking at (Active Document) and any documents they have specifically pinned/attached to this conversation.
2. If the user refers to "this document", "the current file", or "the attached code", they are talking about the items in the Priority Context.
3. Use the "Retrieved background context" for broader knowledge from the rest of the workspace.

TOOLS & CAPABILITIES:
- [WORKSPACE] You can read the entire structure, create nodes, move items, and delete them to organize the workspace.
- [SEARCH] You can perform semantic vector searches across all documents if the provided context is insufficient.
- [READ/EDIT] You can read full document contents and write updates back to the workspace.
- [SCRIPTING] You can execute Python, Shell, and PowerShell scripts. Use Python for data processing, analysis, or logic. Use Shell/PowerShell for system-level tasks.

GUIDELINES:
- [Context First] Always check the Priority Context before calling tools.
- [Plan then Act] For complex requests (like refactoring), first read the necessary files, then perform the edits.
- [Explanations] Always explain what you are doing before or after using a tool.
- [Citations] Cite sources when answering based on document content.

WORKFLOW TIPS:
1. If you need to find something but don't know where it is, use \`search_workspace\` or \`get_workspace_tree\`.
2. When creating files in a new folder, you can use the folder's name as \`parentId\` if you just created it, or use its UUID.
3. If a tool fails with a "not found" error, verify the ID in the workspace tree.

  Priority context (Directly relevant to the user's current view):
${selectionBlock}${activeDocBlock}${attachedDocsBlock}
Retrieved background context (From RAG search):
---
${contextBlocks}
---

If the answer is not in the provided context and you cannot find it using tools, say "I couldn't find information about that in your workspace."
---
STRICT RULES FOR TOOL USE:
1. ALWAYS use the \`nodeId\` (UUID) for any tool parameter requiring an ID (like \`parentId\` or \`nodeId\`).
2. If you don't know the ID yet, you can use the exact title of the folder/document as a fallback—the system will attempt to resolve it.
3. NEVER assume an ID if you haven't seen it in the workspace tree.
4. If you just created a folder and need its ID for the next step, use the ID returned by the \`create_node\` tool.
---`;
};

// =================================================================
// Streaming LLM Request (Chat API)
// =================================================================

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  onSources?: (sources: RagSearchResult[]) => void;
  onToolCall?: (toolCalls: any[]) => void;
  onMessageUpdate?: (messages: RagChatMessage[]) => void;
  onLog?: (level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', message: string) => void;
}

const streamLLMChatResponse = async (
  messages: { role: string, content: string, tool_calls?: any, tool_call_id?: string }[],
  settings: Settings,
  callbacks: StreamCallbacks,
  tools?: any[],
  signal?: AbortSignal
): Promise<any> => {
  const { llmProviderUrl, llmModelName, apiType } = settings;

  if (!llmProviderUrl || !llmModelName || apiType === 'unknown') {
    callbacks.onError('LLM provider is not configured.');
    return;
  }

  // Use /api/chat for everything to support tools
  const url = apiType === 'ollama' 
    ? llmProviderUrl.replace('/api/generate', '/api/chat') 
    : llmProviderUrl;

  const body = JSON.stringify({
    model: llmModelName,
    messages,
    tools: settings.chatEnableAgentMode ? tools : undefined,
    stream: true,
  });

  if (callbacks.onLog) {
    callbacks.onLog('DEBUG', `[LLM Request] Sending ${messages.length} messages with ${tools?.length || 0} tools.`);
  }

  console.log(`[RAG Service] Sending request to ${url} (Model: ${llmModelName}, Stream: true)`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RAG Service] LLM HTTP Error ${response.status}: ${errorText}`);
      callbacks.onError(`LLM status ${response.status}: ${errorText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('Failed to get response stream.');
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let toolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim().length > 0);

      for (const line of lines) {
        try {
          const cleanedLine = line.replace(/^data:\s*/, '').trim();
          if (cleanedLine === '[DONE]') break;

          const parsed = JSON.parse(cleanedLine);

          // Handle embedded JSON errors from the LLM provider
          if (parsed.error) {
             const errMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
             console.error(`[RAG Service] API JSON Error: ${errMsg}`);
             callbacks.onError(`API Error: ${errMsg}`);
             return;
          }

          // OpenAI or Ollama /api/chat format
          const delta = parsed.message || parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            callbacks.onToken(delta.content);
          }

          if (delta.tool_calls) {
            // Merge tool calls (some providers stream them)
            delta.tool_calls.forEach((tc: any) => {
              const existing = toolCalls.find(t => t.index === tc.index || t.id === tc.id);
              if (existing) {
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              } else {
                toolCalls.push(tc);
              }
            });
            callbacks.onToolCall?.(toolCalls);
          }

          if (parsed.done || parsed.choices?.[0]?.finish_reason === 'stop' || parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            return { fullText, toolCalls };
          }
        } catch (e) {
          // Skip unparseable
        }
      }
    }

    return { fullText, toolCalls };
  } catch (error) {
    if (signal?.aborted) return;
    callbacks.onError(`LLM error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// =================================================================
// Public RAG Service
// =================================================================

import { AGENT_TOOLS, executeTool, type ToolExecutorContext } from './agentService';

export const ragService = {
  async search(query: string, settings: Settings): Promise<{ success: boolean; results: RagSearchResult[]; error?: string }> {
    if (!isElectron) return { success: false, results: [], error: 'RAG requires the desktop application.' };
    const { ragEmbeddingProviderUrl, ragEmbeddingModelName, ragContextLimit } = settings;
    if (!ragEmbeddingProviderUrl) return { success: false, results: [], error: 'Embedding provider URL is not configured.' };
    return window.electronAPI!.ragSearch(query, ragEmbeddingProviderUrl, ragEmbeddingModelName, ragContextLimit || 5);
  },

  // ... existing index methods (unchanged)
  async indexDocument(nodeId: string, settings: Settings): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.' };
    const { ragEmbeddingProviderUrl, ragEmbeddingModelName } = settings;
    if (!ragEmbeddingProviderUrl) return { success: false, error: 'Embedding provider URL is not configured.' };
    return window.electronAPI!.ragIndexDocument(nodeId, ragEmbeddingProviderUrl, ragEmbeddingModelName);
  },

  async indexAll(settings: Settings): Promise<RagIndexResponse> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.', documentsProcessed: 0, totalChunks: 0 };
    const { ragEmbeddingProviderUrl, ragEmbeddingModelName } = settings;
    if (!ragEmbeddingProviderUrl) return { success: false, error: 'Embedding provider URL is not configured.', documentsProcessed: 0, totalChunks: 0 };
    return window.electronAPI!.ragIndexAll(ragEmbeddingProviderUrl, ragEmbeddingModelName);
  },

  /**
   * Asks a question about the workspace using RAG and optional Agent Tools.
   */
  async askQuestion(
    question: string,
    history: RagChatMessage[],
    settings: Settings,
    callbacks: StreamCallbacks,
    context: ToolExecutorContext,
    extraContext?: { 
      activeDocument?: { title: string, content: string }, 
      selectedText?: string,
      attachedDocuments?: { title: string, content: string }[]
    },
    signal?: AbortSignal
  ): Promise<RagSearchResult[]> {
    if (!isElectron) {
      callbacks.onError('RAG requires the desktop application.');
      return [];
    }

    const { ragEmbeddingProviderUrl, ragEmbeddingModelName, ragContextLimit, ragSimilarityThreshold } = settings;
    
    // 1. Search for relevant chunks
    let filteredResults: RagSearchResult[] = [];
    if (ragEmbeddingProviderUrl) {
      callbacks.onLog?.('INFO', `RAG: Searching index for: "${question}"`);
      const searchResult = await window.electronAPI!.ragSearch(question, ragEmbeddingProviderUrl, ragEmbeddingModelName, ragContextLimit || 5);
      if (searchResult.success) {
        callbacks.onLog?.('INFO', `RAG: Retrieved ${searchResult.results.length} raw sources.`);
        filteredResults = searchResult.results.filter(r => r.distance < (ragSimilarityThreshold ?? 1.4));
        callbacks.onLog?.('INFO', `RAG: Retained ${filteredResults.length} sources after threshold filter (threshold: ${ragSimilarityThreshold ?? 1.4}).`);
        callbacks.onSources?.(filteredResults);
      } else {
        callbacks.onLog?.('ERROR', `RAG: Vector search failed: ${searchResult.error}`);
      }
    } else {
      callbacks.onLog?.('WARNING', `RAG: No embedding provider configured, skipping vector search.`);
    }

    if (extraContext?.attachedDocuments?.length) {
      callbacks.onLog?.('INFO', `RAG: Including ${extraContext.attachedDocuments.length} pinned documents in prompt context.`);
    }

    const systemPrompt = buildRagSystemPrompt(filteredResults, extraContext);
    const tools = settings.chatEnableAgentMode 
      ? AGENT_TOOLS
          .filter(t => (settings.chatEnabledTools || []).includes(t.name))
          .map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            }
          }))
      : [];

    let currentHistory = [...history];
    const MAX_HISTORY_TURNS = 10; // Keep last 10 turns (user+assistant+tool calls)
    if (currentHistory.length > MAX_HISTORY_TURNS * 2) {
      currentHistory = currentHistory.slice(-(MAX_HISTORY_TURNS * 2));
    }

    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (loopCount < MAX_LOOPS) {
      // Build API messages from current history
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...currentHistory.map(msg => ({ 
          role: msg.role, 
          content: msg.content || (msg.role === 'assistant' && msg.toolCalls ? null : ''),
          tool_calls: msg.toolCalls ? msg.toolCalls.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments
            }
          })) : undefined,
          tool_call_id: msg.toolResult?.toolCallId
        }))
      ];

      const result = await streamLLMChatResponse(apiMessages, settings, callbacks, tools, signal);
      if (!result) break;

      const { fullText, toolCalls } = result;

      if (toolCalls && toolCalls.length > 0) {
        // 1. Add assistant message with tool calls to history
        const assistantMsg: RagChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: fullText,
          toolCalls: toolCalls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments
          })),
          timestamp: new Date().toISOString()
        };
        currentHistory.push(assistantMsg);
        callbacks.onMessageUpdate?.(currentHistory);

        // 2. Execute each tool and add tool messages
        for (const tc of toolCalls) {
          const toolCall: AgentToolCall = {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments
          };

          try {
            callbacks.onLog?.('INFO', `[Agent] Executing tool: ${toolCall.name}...`);
            const toolResultContent = await executeTool(toolCall, context);
            callbacks.onLog?.('DEBUG', `[Agent] Tool ${toolCall.name} returned: ${toolResultContent.substring(0, 500)}${toolResultContent.length > 500 ? '...' : ''}`);
            
            const toolMsg: RagChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: toolResultContent,
              toolResult: { toolCallId: toolCall.id, result: toolResultContent },
              timestamp: new Date().toISOString()
            };
            currentHistory.push(toolMsg);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            callbacks.onLog?.('ERROR', `[Agent] Tool ${toolCall.name} execution failed: ${errMsg}`);
            const toolMsg: RagChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: `Error executing tool: ${errMsg}`,
              toolResult: { toolCallId: toolCall.id, result: `Error: ${errMsg}` },
              timestamp: new Date().toISOString()
            };
            currentHistory.push(toolMsg);
          }
        }
        
        callbacks.onMessageUpdate?.(currentHistory);
        loopCount++;
        continue;
      } else {
        // Final response
        callbacks.onDone(fullText);
        break;
      }
    }

    return filteredResults;
  },

  async getIndexStatus(): Promise<{ totalDocuments: number; indexedDocuments: number } | null> {
    if (!isElectron) return null;
    const result = await window.electronAPI!.ragGetIndexStatus();
    if (!result.success) return null;
    return {
      totalDocuments: result.totalDocuments ?? 0,
      indexedDocuments: result.indexedDocuments ?? 0,
    };
  },

  async clearIndex(): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.' };
    return window.electronAPI!.ragClearIndex();
  },

  onIndexProgress(callback: (current: number, total: number) => void): () => void {
    if (!isElectron || !window.electronAPI!.onRagIndexProgress) return () => {};
    return window.electronAPI!.onRagIndexProgress(({ current, total }) => callback(current, total));
  },
};

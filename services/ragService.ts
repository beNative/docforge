import type { Settings, RagSearchResult, RagChatMessage, RagIndexResponse, AgentToolCall } from '../types';
import { v4 as uuidv4 } from 'uuid';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// =================================================================
// RAG Prompt Assembly (System Prompt)
// =================================================================

const buildRagSystemPrompt = (
  contextChunks: RagSearchResult[],
  extraContext?: { activeDocument?: { title: string, content: string }, selectedText?: string }
): string => {
  const contextBlocks = contextChunks
    .map(
      (chunk, idx) =>
        `[Source ${idx + 1}: "${chunk.nodeTitle}"]\n${chunk.chunkText}`
    )
    .join('\n---\n');

  let activeDocBlock = '';
  if (extraContext?.activeDocument) {
    activeDocBlock = `[CURRENT ACTIVE DOCUMENT: "${extraContext.activeDocument.title}"]\n${extraContext.activeDocument.content}\n---\n`;
  }

  let selectionBlock = '';
  if (extraContext?.selectedText) {
    selectionBlock = `[USER SELECTED TEXT]:\n${extraContext.selectedText}\n---\n`;
  }

  return `You are a helpful assistant answering questions about the user's document workspace in DocForge.
Use the following context to answer when relevant.

TOOLS & CAPABILITIES:
- You can read the entire workspace structure to find relevant documents.
- You can create, edit, move, and delete documents and folders.
- You can run Python, Shell, and PowerShell scripts to perform complex tasks or data processing.

GUIDELINES:
- When the user asks to "do" something (create, move, refactor), use the appropriate tool.
- If you need more information about a document's content that wasn't in the RAG context, use tools to read it.
- Always explain what you are doing before or after using a tool.
- Cite sources when answering based on document content.

Priority context:
${selectionBlock}${activeDocBlock}
Retrieved background context:
---
${contextBlocks}
---

If the answer is not in the provided context and you cannot find it using tools, say "I couldn't find information about that in your workspace."`;
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
    extraContext?: { activeDocument?: { title: string, content: string }, selectedText?: string },
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
      console.log(`[RAG Service] Searching index for: "${question}"`);
      const searchResult = await window.electronAPI!.ragSearch(question, ragEmbeddingProviderUrl, ragEmbeddingModelName, ragContextLimit || 5);
      if (searchResult.success) {
        console.log(`[RAG Service] Retrieved ${searchResult.results.length} raw sources.`);
        filteredResults = searchResult.results.filter(r => r.distance < (ragSimilarityThreshold ?? 1.4));
        console.log(`[RAG Service] Retained ${filteredResults.length} sources after threshold filter (threshold: ${ragSimilarityThreshold ?? 1.4}).`);
        callbacks.onSources?.(filteredResults);
      } else {
        console.error(`[RAG Service] Vector search failed: ${searchResult.error}`);
      }
    } else {
      console.warn(`[RAG Service] No embedding provider configured, skipping vector search.`);
    }

    const systemPrompt = buildRagSystemPrompt(filteredResults, extraContext);
    const tools = AGENT_TOOLS.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    let currentHistory = [...history];
    let loopCount = 0;
    const MAX_LOOPS = 5;

    while (loopCount < MAX_LOOPS) {
      // Build API messages from current history
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...currentHistory.map(msg => ({ 
          role: msg.role, 
          content: msg.content || '',
          tool_calls: msg.toolCalls,
          tool_call_id: msg.toolResult?.toolCallId
        })),
        { role: 'user', content: question }
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
            const toolResultContent = await executeTool(toolCall, context);
            const toolMsg: RagChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: toolResultContent,
              toolResult: { toolCallId: toolCall.id, result: toolResultContent },
              timestamp: new Date().toISOString()
            };
            currentHistory.push(toolMsg);
          } catch (err) {
            const toolMsg: RagChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: `Error executing tool: ${err}`,
              toolResult: { toolCallId: toolCall.id, result: `Error: ${err}` },
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

import type { Settings, LogLevel, RagSearchResult } from '../types';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// =================================================================
// RAG Prompt Assembly
// =================================================================

const buildRagPrompt = (
  question: string, 
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
Use the following context to answer. 
Priority context:
${selectionBlock}${activeDocBlock}
Retrieved background context:
---
${contextBlocks}
---

If the answer is not in the provided context, say "I couldn't find information about that in your workspace."
Always cite which document(s) your answer comes from by referencing the source title.

User Question: ${question}

Answer:`;
};

// =================================================================
// Streaming LLM Request
// =================================================================

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

const streamLLMResponse = async (
  prompt: string,
  settings: Settings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> => {
  const { llmProviderUrl, llmModelName, apiType } = settings;

  if (!llmProviderUrl || !llmModelName || apiType === 'unknown') {
    callbacks.onError('LLM provider is not configured. Please check your settings.');
    return;
  }

  const body =
    apiType === 'ollama'
      ? JSON.stringify({ model: llmModelName, prompt, stream: true })
      : JSON.stringify({
          model: llmModelName,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });

  try {
    const response = await fetch(llmProviderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`LLM responded with status ${response.status}: ${errorText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('Failed to get response stream.');
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (apiType === 'ollama') {
            if (parsed.response) {
              fullText += parsed.response;
              callbacks.onToken(parsed.response);
            }
            if (parsed.done) {
              callbacks.onDone(fullText);
              return;
            }
          } else {
            // OpenAI-compatible streaming
            if (parsed.choices?.[0]?.delta?.content) {
              const token = parsed.choices[0].delta.content;
              fullText += token;
              callbacks.onToken(token);
            }
            if (parsed.choices?.[0]?.finish_reason === 'stop') {
              callbacks.onDone(fullText);
              return;
            }
          }
        } catch {
          // Skip unparseable lines (e.g., SSE "data: " prefixes)
          const cleanedLine = line.replace(/^data:\s*/, '').trim();
          if (cleanedLine === '[DONE]') {
            callbacks.onDone(fullText);
            return;
          }
          if (cleanedLine.length > 0) {
            try {
              const parsed = JSON.parse(cleanedLine);
              if (parsed.choices?.[0]?.delta?.content) {
                const token = parsed.choices[0].delta.content;
                fullText += token;
                callbacks.onToken(token);
              }
              if (parsed.choices?.[0]?.finish_reason === 'stop') {
                callbacks.onDone(fullText);
                return;
              }
            } catch {
              // Truly unparseable, skip
            }
          }
        }
      }
    }

    // Stream ended without explicit done signal
    callbacks.onDone(fullText);
  } catch (error) {
    if (signal?.aborted) return;
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    callbacks.onError(`Failed to connect to LLM: ${message}`);
  }
};

// =================================================================
// Public RAG Service
// =================================================================

export const ragService = {
  /**
   * Indexes a single document (delegates to Electron backend).
   */
  async indexDocument(nodeId: string, settings: Settings): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.' };
    const { ragEmbeddingProviderUrl, ragEmbeddingModelName } = settings;
    if (!ragEmbeddingProviderUrl) return { success: false, error: 'Embedding provider URL is not configured.' };
    return window.electronAPI!.ragIndexDocument(nodeId, ragEmbeddingProviderUrl, ragEmbeddingModelName);
  },

  /**
   * Indexes all documents in the workspace.
   */
  async indexAll(settings: Settings): Promise<RagIndexResponse> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.', documentsProcessed: 0, totalChunks: 0 };
    const { ragEmbeddingProviderUrl, ragEmbeddingModelName } = settings;
    if (!ragEmbeddingProviderUrl) return { success: false, error: 'Embedding provider URL is not configured.', documentsProcessed: 0, totalChunks: 0 };
    return window.electronAPI!.ragIndexAll(ragEmbeddingProviderUrl, ragEmbeddingModelName);
  },

  /**
   * Asks a question about the workspace using RAG.
   * Returns relevant sources and streams the LLM response token-by-token.
   */
  async askQuestion(
    question: string,
    settings: Settings,
    callbacks: StreamCallbacks,
    extraContext?: { activeDocument?: { title: string, content: string }, selectedText?: string },
    signal?: AbortSignal
  ): Promise<RagSearchResult[]> {
    if (!isElectron) {
      callbacks.onError('RAG requires the desktop application.');
      return [];
    }

    const { ragEmbeddingProviderUrl, ragEmbeddingModelName } = settings;
    if (!ragEmbeddingProviderUrl) {
      callbacks.onError('Embedding provider URL is not configured.');
      return [];
    }

    // 1. Search for relevant chunks
    const searchResult = await window.electronAPI!.ragSearch(question, ragEmbeddingProviderUrl, ragEmbeddingModelName, 5);
    if (!searchResult.success) {
      callbacks.onError(searchResult.error || 'Search failed.');
      return [];
    }

    // Filter by distance threshold (heuristic for irrelevance)
    // For most models, distance > 1.2-1.4 starts being noise.
    const filteredResults = searchResult.results.filter(r => r.distance < 1.4);

    if (filteredResults.length === 0) {
      // If nothing is even remotely relevant, we skip the LLM or tell it there's no context
      // But it's better to let the LLM say it couldn't find it.
      // We'll pass an empty context or a "no matches" note.
    }

    // 2. Build the RAG prompt
    const prompt = buildRagPrompt(question, filteredResults, extraContext);

    // 3. Stream the LLM response
    await streamLLMResponse(prompt, settings, callbacks, signal);

    return filteredResults;
  },

  /**
   * Gets the current index status.
   */
  async getIndexStatus(): Promise<{ totalDocuments: number; indexedDocuments: number } | null> {
    if (!isElectron) return null;
    const result = await window.electronAPI!.ragGetIndexStatus();
    if (!result.success) return null;
    return {
      totalDocuments: result.totalDocuments ?? 0,
      indexedDocuments: result.indexedDocuments ?? 0,
    };
  },

  /**
   * Clears the entire RAG index.
   */
  async clearIndex(): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'RAG requires the desktop application.' };
    return window.electronAPI!.ragClearIndex();
  },

  /**
   * Subscribes to index progress events.
   */
  onIndexProgress(callback: (current: number, total: number) => void): () => void {
    if (!isElectron || !window.electronAPI!.onRagIndexProgress) return () => {};
    return window.electronAPI!.onRagIndexProgress(({ current, total }) => callback(current, total));
  },
};

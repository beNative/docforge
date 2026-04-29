import { databaseService } from './database';

const CHUNK_TARGET_WORDS = 200;
const CHUNK_OVERLAP_WORDS = 30;
const CHUNK_MAX_CHARACTERS = 2000; // Hard limit to avoid context issues
const EMBEDDING_DIMENSIONS = 768;

// =================================================================
// Text Chunking
// =================================================================

interface TextChunk {
  chunkIndex: number;
  text: string;
}

/**
 * Splits text into overlapping chunks of approximately `targetWords` words.
 * Uses paragraph boundaries when possible, falling back to sentence boundaries,
 * and finally hard word-count splits.
 */
const chunkText = (text: string, targetWords = CHUNK_TARGET_WORDS, overlapWords = CHUNK_OVERLAP_WORDS): TextChunk[] => {
  if (!text || text.trim().length === 0) return [];

  // 1. First split by paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // 2. If any paragraph is too long, split it into sentences or smaller blocks
  const processedParagraphs: string[] = [];
  for (const p of paragraphs) {
    if (p.split(/\s+/).length > targetWords * 2) {
       // Too big, split by sentences (approximate)
       const sentences = p.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [p];
       processedParagraphs.push(...sentences);
    } else {
       processedParagraphs.push(p);
    }
  }

  const chunks: TextChunk[] = [];
  let currentChunkParts: string[] = [];
  let currentWordCount = 0;
  let chunkIndex = 0;

  const flushChunk = () => {
    if (currentChunkParts.length === 0) return;
    let chunkText = currentChunkParts.join('\n\n').trim();
    
    // Hard character limit check
    if (chunkText.length > CHUNK_MAX_CHARACTERS) {
        chunkText = chunkText.substring(0, CHUNK_MAX_CHARACTERS);
    }

    if (chunkText.length > 0) {
      chunks.push({ chunkIndex, text: chunkText });
      chunkIndex++;
    }

    // Keep the last few parts as overlap
    const overlapParts: string[] = [];
    let overlapCount = 0;
    for (let i = currentChunkParts.length - 1; i >= 0; i--) {
      const words = currentChunkParts[i].split(/\s+/).length;
      if (overlapCount + words > overlapWords && overlapParts.length > 0) break;
      overlapParts.unshift(currentChunkParts[i]);
      overlapCount += words;
    }
    currentChunkParts = overlapParts;
    currentWordCount = overlapCount;
  };

  for (const para of processedParagraphs) {
    const paraWords = para.split(/\s+/).length;

    if (currentWordCount + paraWords > targetWords && currentChunkParts.length > 0) {
      flushChunk();
    }

    currentChunkParts.push(para);
    currentWordCount += paraWords;
  }

  // Flush remaining
  if (currentChunkParts.length > 0) {
    flushChunk();
  }

  return chunks;
};

// =================================================================
// Ollama Embedding API
// =================================================================

/**
 * Calls Ollama's /api/embed endpoint to generate embeddings for one or more texts.
 */
const generateEmbeddings = async (
  texts: string[],
  ollamaBaseUrl: string,
  modelName: string
): Promise<Float32Array[]> => {
  // Derive the base URL from the configured generate URL
  // e.g., http://localhost:11434/api/generate -> http://localhost:11434
  const baseUrl = ollamaBaseUrl.replace(/\/api\/(generate|chat\/completions|embed).*$/, '');
  const embedUrl = `${baseUrl}/api/embed`;

  const response = await fetch(embedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    embeddings: number[][];
  };

  return data.embeddings.map(emb => new Float32Array(emb));
};

// =================================================================
// Public Embedding Service
// =================================================================

export const embeddingService = {
  /**
   * Indexes a single document: chunks its content, generates embeddings,
   * and stores everything in the database.
   */
  async indexDocument(nodeId: string, ollamaBaseUrl: string, modelName: string): Promise<{ chunksCreated: number }> {
    console.log(`[RAG] Indexing document: ${nodeId}`);
    const doc = databaseService.ragGetDocumentContent(nodeId);
    if (!doc || !doc.content) {
      console.log(`[RAG] Document ${nodeId} has no content, skipping.`);
      databaseService.ragDeleteChunksForNode(nodeId);
      return { chunksCreated: 0 };
    }

    const chunks = chunkText(doc.content);
    console.log(`[RAG] Document "${doc.title}" split into ${chunks.length} chunks.`);
    if (chunks.length === 0) {
      databaseService.ragDeleteChunksForNode(nodeId);
      return { chunksCreated: 0 };
    }

    // Generate embeddings in single items to stay within context limits
    // This is safer for local models with varying context windows
    const batchSize = 1;
    const allEmbeddings: Float32Array[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      try {
        const embeddings = await generateEmbeddings(
          batch.map(c => c.text),
          ollamaBaseUrl,
          modelName
        );
        allEmbeddings.push(...embeddings);
      } catch (error) {
        console.error(`[RAG] Failed to generate embeddings for batch in ${nodeId}:`, error);
        throw error; // Re-throw to be caught by indexAllDocuments
      }
    }

    // Store chunks + vectors in the database
    const dbChunks = chunks.map((chunk, idx) => ({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      embedding: allEmbeddings[idx],
    }));

    databaseService.ragUpsertChunks(nodeId, dbChunks);
    console.log(`[RAG] Successfully indexed document "${doc.title}" with ${chunks.length} chunks.`);

    return { chunksCreated: chunks.length };
  },

  /**
   * Indexes all documents in the workspace.
   * Returns the total number of documents processed and chunks created.
   */
  async indexAllDocuments(
    ollamaBaseUrl: string,
    modelName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ documentsProcessed: number; totalChunks: number; totalDocumentsFound: number; errors?: string[] }> {
    const nodeIds = databaseService.ragGetAllDocumentNodeIds();
    console.log(`[RAG] Starting full index of ${nodeIds.length} documents.`);
    let totalChunks = 0;
    let documentsProcessed = 0;
    const totalDocumentsFound = nodeIds.length;
    const errors: string[] = [];

    if (nodeIds.length === 0) {
      console.log('[RAG] No documents found to index.');
    }

    for (let i = 0; i < nodeIds.length; i++) {
      try {
        const result = await this.indexDocument(nodeIds[i], ollamaBaseUrl, modelName);
        totalChunks += result.chunksCreated;
        if (result.chunksCreated > 0) documentsProcessed++;
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Try to get document title for the error message
        const doc = databaseService.ragGetDocumentContent(nodeIds[i]);
        const title = doc ? doc.title : nodeIds[i];
        console.error(`[RAG] Failed to index document "${title}":`, errorMsg);
        errors.push(`"${title}": ${errorMsg}`);
      }
      onProgress?.(i + 1, nodeIds.length);
    }

    console.log(`[RAG] Full index complete. Processed ${documentsProcessed} documents, created ${totalChunks} total chunks.`);
    return { documentsProcessed, totalChunks, totalDocumentsFound, errors: errors.length > 0 ? errors : undefined };
  },

  /**
   * Searches the vector index for chunks similar to the given query.
   */
  async searchSimilarChunks(
    query: string,
    ollamaBaseUrl: string,
    modelName: string,
    limit: number = 5
  ): Promise<{ nodeId: string; nodeTitle: string; chunkText: string; distance: number }[]> {
    const [queryEmbedding] = await generateEmbeddings([query], ollamaBaseUrl, modelName);
    return databaseService.ragSearchSimilarChunks(queryEmbedding, limit);
  },

  /**
   * Returns the current index status.
   */
  getIndexStatus(): { totalDocuments: number; indexedDocuments: number } {
    return databaseService.ragGetIndexStatus();
  },

  /**
   * Clears the entire RAG index.
   */
  clearIndex(): void {
    databaseService.ragClearIndex();
  },
};

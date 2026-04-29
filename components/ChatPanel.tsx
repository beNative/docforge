import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Settings, RagChatMessage, RagSearchResult } from '../types';
import { ragService } from '../services/ragService';
import { v4 as uuidv4 } from 'uuid';

interface ChatPanelProps {
  isVisible: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  settings: Settings;
  onNavigateToDocument: (nodeId: string) => void;
  addLog: (level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', message: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  isVisible,
  width,
  onResizeStart,
  settings,
  onNavigateToDocument,
  addLog,
}) => {
  const [messages, setMessages] = useState<RagChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ current: number; total: number } | null>(null);
  const [indexStatus, setIndexStatus] = useState<{ totalDocuments: number; indexedDocuments: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load index status on mount and when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      ragService.getIndexStatus().then(status => {
        if (status) setIndexStatus(status);
      });
    }
  }, [isVisible]);

  // Listen for index progress events
  useEffect(() => {
    const unsubscribe = ragService.onIndexProgress((current, total) => {
      setIndexProgress({ current, total });
      if (current >= total) {
        setIsIndexing(false);
        setIndexProgress(null);
        // Refresh status
        ragService.getIndexStatus().then(status => {
          if (status) setIndexStatus(status);
        });
      }
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBuildIndex = useCallback(async () => {
    setIsIndexing(true);
    setIndexProgress({ current: 0, total: 0 });
    addLog('INFO', 'RAG: Starting workspace index build...');

    try {
      const result = await ragService.indexAll(settings);
      if (result.success) {
        addLog('INFO', `RAG: Index build complete. Found ${result.totalDocumentsFound || 0} documents. Processed ${result.documentsProcessed} documents, ${result.totalChunks} chunks.`);
        if (result.documentsProcessed === 0) {
          addLog('WARNING', `RAG: No documents were processed into the index. (Found ${result.totalDocumentsFound || 0} document nodes in total).`);
        }
      } else {
        addLog('ERROR', `RAG: Index build failed: ${result.error}`);
      }
    } catch (error: any) {
      addLog('ERROR', `RAG: Unexpected error during index build: ${error.message || error}`);
    } finally {
      setIsIndexing(false);
      setIndexProgress(null);
      // Refresh status
      const statusResult = await ragService.getIndexStatus();
      if (statusResult) {
        setIndexStatus(statusResult);
        addLog('INFO', `RAG: Current index status: ${statusResult.indexedDocuments}/${statusResult.totalDocuments} documents indexed.`);
      } else {
        // Find if there was an error in the status call
        const rawResult = await window.electronAPI!.ragGetIndexStatus();
        if (!rawResult.success && rawResult.error) {
           addLog('ERROR', `RAG: Status check failed - ${rawResult.error}`);
        }
      }
    }
  }, [settings, addLog]);

  const handleClearIndex = useCallback(async () => {
    await ragService.clearIndex();
    setIndexStatus({ totalDocuments: indexStatus?.totalDocuments ?? 0, indexedDocuments: 0 });
    addLog('INFO', 'RAG: Index cleared.');
  }, [indexStatus, addLog]);

  const handleSendMessage = useCallback(async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    setInputValue('');
    setIsLoading(true);

    // Add user message
    const userMessage: RagChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };

    const assistantMessageId = uuidv4();
    const assistantMessage: RagChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    // Create abort controller for cancellation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let sources: RagSearchResult[] = [];

    try {
      sources = await ragService.askQuestion(
        question,
        settings,
        {
          onToken: (token) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + token }
                  : msg
              )
            );
          },
          onDone: (fullText) => {
            // If the AI says it couldn't find information, don't show sources
            const noInfoFound = fullText.toLowerCase().includes("couldn't find information");
            const finalSources = noInfoFound ? [] : sources;
            
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullText, isStreaming: false, sources: finalSources }
                  : msg
              )
            );
            setIsLoading(false);
          },
          onError: (error) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `⚠️ ${error}`, isStreaming: false }
                  : msg
              )
            );
            setIsLoading(false);
            addLog('ERROR', `RAG chat error: ${error}`);
          },
        },
        abortController.signal
      );

      // Update sources on the assistant message after search completes
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId && sources.length > 0
            ? { ...msg, sources }
            : msg
        )
      );
    } catch (error) {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, settings, addLog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages(prev =>
      prev.map(msg => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }, []);

  if (!isVisible) return null;

  const hasIndex = indexStatus && indexStatus.indexedDocuments > 0;

  return (
    <>
      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="w-1.5 cursor-col-resize flex-shrink-0 bg-border-color/50 hover:bg-primary transition-colors duration-200"
      />
      <div
        className="flex flex-col bg-background border-l border-border-color overflow-hidden"
        style={{ width: `${width}px`, minWidth: '280px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-color bg-secondary/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-main">💬 Chat</span>
            {indexStatus && (
              <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 rounded-full bg-border-color/30">
                {indexStatus.indexedDocuments}/{indexStatus.totalDocuments} indexed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasIndex && (
              <button
                onClick={handleClearIndex}
                className="text-[10px] text-text-tertiary hover:text-text-secondary px-1.5 py-0.5 rounded hover:bg-border-color/30 transition-colors"
                title="Clear index"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleBuildIndex}
              disabled={isIndexing}
              className="text-[10px] text-primary hover:text-primary/80 px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="Rebuild index"
            >
              {isIndexing ? 'Indexing...' : hasIndex ? 'Rebuild' : 'Build Index'}
            </button>
          </div>
        </div>

        {/* Index progress bar */}
        {isIndexing && indexProgress && (
          <div className="px-3 py-1.5 border-b border-border-color bg-secondary/30 flex-shrink-0">
            <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
              <span>Indexing documents...</span>
              <span>{indexProgress.current}/{indexProgress.total}</span>
            </div>
            <div className="w-full h-1 bg-border-color/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-sm font-medium text-text-secondary mb-1">Chat with your workspace</p>
              <p className="text-xs text-text-tertiary mb-4">
                Ask questions about your documents and get AI-powered answers with source citations.
              </p>
              {!hasIndex && (
                <button
                  onClick={handleBuildIndex}
                  disabled={isIndexing}
                  className="text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isIndexing ? 'Building...' : 'Build Index to Get Started'}
                </button>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-secondary border border-border-color rounded-bl-sm'
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none break-words leading-relaxed overflow-x-auto">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      table: ({node, ...props}) => <table className="border-collapse border border-border-color my-2 w-full text-xs" {...props} />,
                      th: ({node, ...props}) => <th className="border border-border-color px-2 py-1 bg-secondary/50 font-semibold" {...props} />,
                      td: ({node, ...props}) => <td className="border border-border-color px-2 py-1" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                      code: ({node, ...props}) => <code className="bg-border-color/30 px-1 rounded font-mono text-[11px]" {...props} />,
                      pre: ({node, ...props}) => <pre className="bg-background/50 p-2 rounded-md border border-border-color/30 my-2 overflow-x-auto font-mono text-[11px]" {...props} />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
                )}

                {/* Source citations */}
                {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                  <div className="mt-2 pt-2 border-t border-border-color/30">
                    <div className="text-[10px] text-text-tertiary mb-1 font-medium uppercase tracking-wider">Sources</div>
                    <div className="flex flex-wrap gap-1">
                      {/* Deduplicate sources by nodeId */}
                      {[...new Map(msg.sources.map(s => [s.nodeId, s])).values()].map((source) => (
                        <button
                          key={source.nodeId}
                          onClick={() => onNavigateToDocument(source.nodeId)}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          title={`Open "${source.nodeTitle}"`}
                        >
                          📄 {source.nodeTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-3 py-2 border-t border-border-color bg-secondary/30 flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasIndex ? 'Ask about your documents...' : 'Build index first...'}
              disabled={!hasIndex || isIndexing}
              rows={1}
              className="flex-1 resize-none bg-background border border-border-color rounded-md px-3 py-2 text-sm text-text-main placeholder-text-tertiary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              style={{
                minHeight: '36px',
                maxHeight: '120px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            {isLoading ? (
              <button
                onClick={handleStopGeneration}
                className="flex-shrink-0 bg-red-500/80 hover:bg-red-500 text-white rounded-md px-3 py-2 text-sm transition-colors"
                title="Stop generation"
              >
                ■
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !hasIndex || isIndexing}
                className="flex-shrink-0 bg-primary hover:bg-primary/90 text-white rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Send message (Enter)"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPanel;

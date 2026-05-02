import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Settings, RagChatMessage, RagSearchResult, Node, DocumentOrFolder } from '../types';
import { ragService } from '../services/ragService';
import { v4 as uuidv4 } from 'uuid';
import { usePythonEnvironments } from '../hooks/usePythonEnvironments';
import { pythonService } from '../services/pythonService';
import { scriptService } from '../services/scriptService';
import { SparklesIcon, TerminalIcon, WarningIcon, XIcon, SearchIcon, TrashIcon, RefreshIcon } from './Icons';
import Hint from './Hint';
import Tooltip from './Tooltip';
import IconButton from './IconButton';

interface ChatPanelProps {
  isVisible: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  settings: Settings;
  onNavigateToDocument: (nodeId: string) => void;
  onApplyToEditor: (content: string) => void;
  onCreateDocument: (content: string, title?: string) => void;
  addLog: (level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', message: string) => void;
  activeDocument?: { title: string; content: string };
  selectedText?: string;
  nodes: Node[];
  chatContextNodeIds?: Set<string>;
  onRemoveNodeFromContext?: (nodeId: string) => void;
  onAddNodesToContext?: (nodeIds: string[]) => void;
  onClearAllContext?: () => void;
  addNode: (node: any) => Promise<Node>;
  updateNode: (id: string, updates: any) => Promise<void>;
  updateDocumentContent: (id: string, content: string) => Promise<void>;
  deleteNodes: (ids: string[]) => Promise<void>;
  moveNodes: (ids: string[], targetId: string | null, position: any) => Promise<void>;
  getLatestItems: () => Promise<Node[]>;
  runPython: (code: string, nodeId?: string) => Promise<string>;
  runScript: (language: any, code: string, nodeId?: string) => Promise<string>;
}

interface IndexActionButtonProps {
  onClick: (e: React.MouseEvent) => void;
  tooltip: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}

const IndexActionButton: React.FC<IndexActionButtonProps> = ({ onClick, tooltip, icon, label, disabled, primary }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  
  return (
    <>
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${
          primary 
            ? 'text-primary hover:bg-primary/10' 
            : 'text-text-tertiary hover:text-text-secondary hover:bg-border-color/30'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
      {isHovered && ref.current && (
        <Tooltip targetRef={ref} content={tooltip} position="bottom" />
      )}
    </>
  );
};

const SourceCitation: React.FC<{ source: RagSearchResult; onNavigate: (id: string) => void }> = ({ source, onNavigate }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  
  return (
    <>
      <button
        ref={ref}
        onClick={() => onNavigate(source.nodeId)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
      >
        📄 {source.nodeTitle}
      </button>
      {isHovered && ref.current && (
        <Tooltip targetRef={ref} content={`Open "${source.nodeTitle}"`} position="top" />
      )}
    </>
  );
};

const ApplyCodeButton: React.FC<{ content: string; onApply: (content: string) => void }> = ({ content, onApply }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  
  return (
    <>
      <button 
        ref={ref}
        onClick={() => onApply(content)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-primary/80 hover:bg-primary text-white text-[9px] px-1.5 py-0.5 rounded transition-all shadow-sm"
      >
        Apply
      </button>
      {isHovered && ref.current && (
        <Tooltip targetRef={ref} content="Apply to current document" position="top" />
      )}
    </>
  );
};

const ChatPanel: React.FC<ChatPanelProps> = ({
  isVisible,
  width,
  onResizeStart,
  settings,
  onNavigateToDocument,
  onApplyToEditor,
  onCreateDocument,
  addLog,
  activeDocument,
  selectedText,
  nodes,
  addNode,
  updateNode,
  updateDocumentContent,
  deleteNodes,
  moveNodes,
  getLatestItems,
  runPython,
  runScript,
  chatContextNodeIds = new Set(),
  onRemoveNodeFromContext,
  onAddNodesToContext,
  onClearAllContext,
}) => {
  const [messages, setMessages] = useState<RagChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ current: number; total: number } | null>(null);
  const [indexStatus, setIndexStatus] = useState<{ totalDocuments: number; indexedDocuments: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dragCounter = useRef(0);
  const { environments, interpreters, refreshEnvironments } = usePythonEnvironments();
  const [pendingAction, setPendingAction] = useState<{ 
    toolCall: any, 
    implementation: (...args: any[]) => Promise<any>,
    resolve: (val: string) => void, 
    reject: (err: any) => void 
  } | null>(null);
  
  const nodesRef = useRef<Node[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

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
        
        if (result.errors && result.errors.length > 0) {
          addLog('WARNING', `RAG: Encountered errors while indexing ${result.errors.length} item(s):`);
          result.errors.forEach(err => addLog('ERROR', `  - ${err}`));
        } else if (result.documentsProcessed === 0 && (result.totalDocumentsFound || 0) > 0) {
          addLog('WARNING', `RAG: No documents were processed into the index. (Found ${result.totalDocumentsFound || 0} document nodes in total).`);
          addLog('INFO', 'RAG: Tip - Check if Ollama is running and the embedding model is downloaded.');
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
        if (window.electronAPI) {
          const rawResult = await window.electronAPI.ragGetIndexStatus();
          if (!rawResult.success && rawResult.error) {
             addLog('ERROR', `RAG: Status check failed - ${rawResult.error}`);
          }
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

    const attachedDocuments = Array.from(chatContextNodeIds)
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is DocumentOrFolder => n !== undefined && n.type === 'document')
      .map(n => ({ title: n.title, content: n.content || '' }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let sources: RagSearchResult[] = [];
    try {

      const toolContext: any = {
        nodes: nodesRef.current,
        addNode,
        updateNode,
        updateDocumentContent,
        deleteNodes,
        moveNodes,
        getLatestItems,
        runPython: async (code: string, nodeId?: string) => {
          addLog('INFO', `Agent: Running Python script${nodeId ? ` on node ${nodeId}` : ''}...`);
          try {
            let interpreterList = interpreters;
            if (!interpreterList.length) {
              addLog('DEBUG', 'Agent: Detecting Python interpreters...');
              interpreterList = await pythonService.detectInterpreters();
            }
            addLog('DEBUG', `Agent: Ensuring environment for ${nodeId || 'agent-temp'}...`);
            const env = await pythonService.ensureNodeEnvironment(nodeId || 'agent-temp', settings.pythonDefaults, interpreterList);
            addLog('DEBUG', 'Agent: Script execution starting...');
            const run = await pythonService.runScript({
              nodeId: nodeId || 'agent-temp',
              code,
              environment: env,
              consoleTheme: settings.pythonConsoleTheme,
              consoleBehavior: 'hidden'
            });
            
            return new Promise((resolve) => {
               const cleanup = pythonService.onRunStatus(({ runId, status }) => {
                 if (runId === run.runId && (status === 'succeeded' || status === 'failed' || status === 'canceled')) {
                   cleanup();
                   pythonService.getRunLogs(runId).then(logs => {
                     const output = logs.map(l => l.message).join('\n');
                     addLog(status === 'succeeded' ? 'INFO' : 'ERROR', `Agent: Python script ${status}. Output length: ${output.length} chars.`);
                     resolve(output || `Script finished with status: ${status}`);
                   });
                 }
               });
               setTimeout(() => { cleanup(); resolve('Error: Script execution timed out.'); }, 30000);
            });
          } catch (err: any) {
            addLog('ERROR', `Agent: Python execution failed: ${err.message || err}`);
            return `Error: ${err.message || err}`;
          }
        },
        runScript: async (language: any, code: string, nodeId?: string) => {
          addLog('INFO', `Agent: Running ${language} script...`);
          try {
            const defaults = language === 'shell' ? settings.shellDefaults : settings.powershellDefaults;
            const run = await scriptService.runScript({
              nodeId: nodeId || 'agent-temp',
              language,
              code,
              environmentVariables: defaults.environmentVariables,
              workingDirectory: defaults.workingDirectory,
              executable: defaults.executable,
              overrides: {},
              mode: 'run'
            });

            return new Promise((resolve) => {
              const cleanup = scriptService.onRunStatus(({ runId, status }) => {
                if (runId === run.runId && (status === 'succeeded' || status === 'failed' || status === 'canceled')) {
                  cleanup();
                  scriptService.getRunLogs(runId).then(logs => {
                    const output = logs.map(l => l.message).join('\n');
                    resolve(output || `Script finished with status: ${status}`);
                  });
                }
              });
              setTimeout(() => { cleanup(); resolve('Error: Script execution timed out.'); }, 30000);
            });
          } catch (err: any) {
            return `Error: ${err.message || err}`;
          }
        },
        refreshWorkspace: async () => {
          const latestItems = await getLatestItems();
          nodesRef.current = latestItems;
          toolContext.nodes = latestItems;
        },
        searchRag: async (query: string) => {
          const result = await window.electronAPI!.ragSearch(query, settings.ragEmbeddingProviderUrl, settings.ragEmbeddingModelName, 5);
          return result.success ? result.results : [];
        },
        addLog
      };

      const wrappedContext: any = { ...toolContext };
      if (settings.chatAgentRequiresApproval) {
        ['deleteNodes', 'moveNodes', 'runPython', 'runScript'].forEach(method => {
           const original = (toolContext as any)[method];
           wrappedContext[method] = async (...args: any[]) => {
             return new Promise((resolve, reject) => {
               setPendingAction({
                 toolCall: { name: method, arguments: JSON.stringify(args) },
                 implementation: original,
                 resolve,
                 reject
               });
             });
           };
        });
      }

      await ragService.askQuestion(
        question,
        [...messages, userMessage],
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
          onSources: (retrievedSources) => {
            sources = retrievedSources;
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, sources: retrievedSources }
                  : msg
              )
            );
          },
          onMessageUpdate: (updatedHistory) => {
             setMessages(prev => {
                const userIndex = prev.findIndex(m => m.id === userMessage.id);
                if (userIndex === -1) return prev;
                return [...prev.slice(0, userIndex + 1), ...updatedHistory.slice(updatedHistory.findIndex(m => m.role === 'assistant'))];
             });
          },
          onDone: (fullText) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullText, isStreaming: false }
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
          onLog: addLog,
        },
        wrappedContext,
        { activeDocument, selectedText, attachedDocuments },
        abortController.signal
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('application/vnd.docforge.nodes+json')) {
      dragCounter.current++;
      if (dragCounter.current === 1) {
        setIsDraggingOver(true);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('application/vnd.docforge.nodes+json')) {
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingOver) setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    
    let data = e.dataTransfer.getData('application/json');
    if (!data) {
      data = e.dataTransfer.getData('application/vnd.docforge.nodes+json');
    }

    if (data) {
      try {
        const payload = JSON.parse(data);
        const ids = Array.isArray(payload) ? payload : (payload.nodes ? payload.nodes.map((n: any) => n.id) : []);
        
        if (Array.isArray(ids)) {
          // Pass all IDs (including folders) to the handler, which handles expansion
          onAddNodesToContext?.(ids);
        }
      } catch (err) {
        console.error('Failed to parse dropped IDs:', err);
      }
    }
  };

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
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex flex-col bg-background border-l border-border-color overflow-hidden relative"
        style={{ width: `${width}px`, minWidth: '280px' }}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-primary/20 backdrop-blur-[2px] border-2 border-dashed border-primary flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200 pointer-events-none">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <SearchIcon className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-primary mb-2">Drop to add Context</h4>
            <p className="text-sm text-text-secondary">Release to add selected documents to the current chat session.</p>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-color bg-secondary/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-main">💬 Chat</span>
            {indexStatus && (
              <Hint tooltip="Indexing progress for RAG">
                {indexStatus.indexedDocuments}/{indexStatus.totalDocuments} indexed
              </Hint>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasIndex && (
              <IndexActionButton
                onClick={handleClearIndex}
                tooltip="Clear index"
                icon={<TrashIcon className="w-3 h-3" />}
                label="Clear"
              />
            )}
            <IndexActionButton
              onClick={handleBuildIndex}
              disabled={isIndexing}
              tooltip="Rebuild index"
              icon={<RefreshIcon className={`w-3 h-3 ${isIndexing ? 'animate-spin' : ''}`} />}
              label={isIndexing ? 'Indexing...' : hasIndex ? 'Rebuild' : 'Build Index'}
              primary
            />
          </div>
        </div>

        {/* Active Context Badges */}
        {(activeDocument || selectedText || (chatContextNodeIds && chatContextNodeIds.size > 0)) && (
          <div className="px-3 py-1.5 border-b border-border-color bg-primary/5 flex flex-wrap gap-2 items-center min-h-[32px]">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mr-1">Context:</span>
            
            {activeDocument && (
              <Hint 
                tooltip={`Active: ${activeDocument.title}`}
                icon={<span className="opacity-70">📄</span>}
                className="bg-primary/10 border border-primary/20 text-primary"
              >
                {activeDocument.title.length > 20 ? activeDocument.title.substring(0, 17) + '...' : activeDocument.title}
              </Hint>
            )}
            
            {selectedText && (
              <Hint 
                tooltip="Currently selected text"
                icon={<span className="opacity-70">✂️</span>}
                className="bg-amber-500/10 border border-amber-500/20 text-amber-600"
              >
                Selection active
              </Hint>
            )}
            
            {Array.from(chatContextNodeIds).map(nodeId => {
              const node = nodes.find(n => n.id === nodeId);
              const title = node?.title || `Document ${nodeId.substring(0, 8)}...`;
              
              return (
                <div key={nodeId} className="flex items-center group">
                  <Hint 
                    tooltip={node ? `Pinned: ${node.title}` : 'Pinned document (resolving...)'} 
                    icon={<span className="opacity-70">{node?.type === 'folder' ? '📁' : '📌'}</span>}
                    className="bg-secondary/30 border border-border-color text-text-main pr-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{title.length > 20 ? title.substring(0, 17) + '...' : title}</span>
                      <IconButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveNodeFromContext?.(nodeId);
                        }}
                        variant="ghost"
                        size="xs"
                        tooltip="Remove from context"
                        tooltipPosition="bottom"
                        className="!w-4 !h-4 p-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon className="w-2.5 h-2.5" />
                      </IconButton>
                    </div>
                  </Hint>
                </div>
              );
            })}

            {chatContextNodeIds.size > 1 && (
              <button 
                onClick={() => onClearAllContext?.()}
                className="text-[10px] text-text-tertiary hover:text-red-500 transition-colors ml-auto pl-2"
              >
                Clear all
              </button>
            )}
          </div>
        )}

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

          {messages.map((msg) => {
            if (msg.role === 'tool') {
              return (
                <div key={msg.id} className="flex justify-start">
                   <details className="bg-secondary/40 border border-border-color/30 rounded-lg px-3 py-2 text-[11px] font-mono text-text-tertiary max-w-[90%] overflow-hidden group">
                     <summary className="flex items-center gap-2 cursor-pointer list-none select-none opacity-70 hover:opacity-100 transition-opacity">
                        <TerminalIcon className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-widest text-[9px]">Tool Result</span>
                        <span className="ml-auto opacity-50 font-mono">ID: {msg.toolResult?.toolCallId?.substring(0, 8)}</span>
                        <span className="group-open:rotate-180 transition-transform duration-200">▼</span>
                     </summary>
                     <div className="mt-2">
                       <pre className="whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-background/30 p-2 rounded border border-border-color/10">
                         {msg.content}
                       </pre>
                     </div>
                   </details>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-secondary border border-border-color rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-3 space-y-2">
                       {msg.toolCalls.map((tc: any) => (
                         <div key={tc.id} className="flex items-center gap-2 px-2 py-1.5 bg-background/50 border border-border-color/50 rounded-md text-[11px] text-text-secondary animate-in fade-in slide-in-from-left-1 duration-300">
                           <SparklesIcon className="w-3.5 h-3.5 text-primary animate-pulse" />
                           <span className="font-medium">Using tool:</span>
                           <code className="text-primary bg-primary/5 px-1 rounded">{tc.name}</code>
                         </div>
                       ))}
                    </div>
                  )}

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
                        code: ({node, ...props}) => {
                          const isInline = !node?.position?.start.line || node.position.start.line === node.position.end.line;
                          if (isInline) {
                            return <code className="bg-border-color/30 px-1 rounded font-mono text-[11px]" {...props} />;
                          }
                          return (
                            <div className="relative group">
                              <pre className="bg-background/50 p-2 rounded-md border border-border-color/30 my-2 overflow-x-auto font-mono text-[11px]" {...props} />
                              <ApplyCodeButton content={String(props.children)} onApply={onApplyToEditor} />
                            </div>
                          );
                        },
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
                          <SourceCitation 
                            key={source.nodeId} 
                            source={source} 
                            onNavigate={onNavigateToDocument} 
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Actions */}
                  {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onCreateDocument(msg.content)}
                      className="text-[10px] text-text-secondary hover:text-primary bg-border-color/20 hover:bg-primary/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-primary/30"
                    >
                      ✨ Create New Document
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        addLog('INFO', 'Chat response copied to clipboard.');
                      }}
                      className="text-[10px] text-text-tertiary hover:text-text-secondary px-2 py-1 rounded transition-colors"
                    >
                      Copy All
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
              <IconButton
                onClick={handleStopGeneration}
                variant="destructive"
                size="md"
                tooltip="Stop generation"
                className="flex-shrink-0 !rounded-md"
              >
                ■
              </IconButton>
            ) : (
              <IconButton
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !hasIndex || isIndexing}
                variant="primary"
                size="md"
                tooltip="Send message (Enter)"
                className="flex-shrink-0 !rounded-md bg-primary text-white hover:bg-primary/90"
              >
                ↑
              </IconButton>
            )}
          </div>
        </div>

        {/* Action Approval Modal */}
        {pendingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-secondary/90 border border-white/10 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-border-color/50 bg-gradient-to-r from-primary/10 to-transparent">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  Agent Action Request
                </h3>
              </div>
              <div className="px-6 py-6 space-y-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  The AI Agent is requesting permission to perform an automated action on your workspace.
                </p>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                  <div className="relative bg-background border border-border-color/60 rounded-xl overflow-hidden shadow-inner font-mono text-[11px]">
                    <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-border-color/50">
                      <span className="text-primary font-bold uppercase tracking-widest text-[9px]">Method</span>
                      <code className="text-text-main">{pendingAction.toolCall.name}</code>
                    </div>
                    <div className="p-4 max-h-52 overflow-auto custom-scrollbar bg-background/50">
                      <pre className="text-text-tertiary whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(pendingAction.toolCall.arguments), null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <WarningIcon className="w-4 h-4 text-amber-500 mt-0.5" />
                  <p className="text-[11px] text-amber-600/80 italic">
                    Always review the parameters carefully. Actions like document deletion or script execution cannot be easily undone.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-secondary/30 border-t border-border-color/50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    pendingAction.reject('User denied the action.');
                    setPendingAction(null);
                  }}
                  className="px-5 py-2 text-sm font-medium text-text-secondary hover:text-text-main hover:bg-white/5 rounded-xl transition-all"
                >
                  Deny
                </button>
                <button
                  onClick={async () => {
                    const action = pendingAction;
                    setPendingAction(null);
                    try {
                      const args = JSON.parse(action.toolCall.arguments);
                      const result = await action.implementation(...args);
                      action.resolve(result || 'Success');
                    } catch (err) {
                      action.reject(err);
                    }
                  }}
                  className="px-6 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatPanel;

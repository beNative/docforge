import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
// Fix: Correctly import the DocumentOrFolder type.
import type { DocumentOrFolder, DraggedNodeTransfer } from '../types';
import IconButton from './IconButton';
import { FileIcon, FolderIcon, FolderOpenIcon, ChevronRightIcon, ChevronDownIcon, CopyIcon, ArrowUpIcon, ArrowDownIcon, CodeIcon, LockClosedIcon, LockOpenIcon, TrashIcon } from './Icons';
import Tooltip from './Tooltip';
import EmojiPickerOverlay from './EmojiPickerOverlay';

export interface DocumentNode extends DocumentOrFolder {
  children: DocumentNode[];
}

export const DOCFORGE_DRAG_MIME = 'application/vnd.docforge.nodes+json';

interface DocumentTreeItemProps {
  node: DocumentNode;
  level: number;
  indentPerLevel: number;
  verticalSpacing: number;
  selectedIds: Set<string>;
  focusedItemId: string | null;
  expandedIds: Set<string>;
  openDocumentIds: Set<string>;
  activeDocumentId: string | null;
  onSelectNode: (id: string, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, shiftKey: boolean) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onMoveNode: (draggedIds: string[], targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onImportNodes: (payload: DraggedNodeTransfer, targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  onRequestNodeExport: (ids: string[]) => DraggedNodeTransfer | null;
  onDropFiles: (files: FileList, parentId: string | null) => void;
  onToggleExpand: (id: string) => void;
  onCopyNodeContent: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void | Promise<void>;
  isKnownNodeId: (id: string) => boolean;
  searchTerm: string;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onContextMenu: (e: React.MouseEvent, nodeId: string | null) => void;
  renamingNodeId: string | null;
  onRenameComplete: () => void;
}

// Helper function to determine drop position based on mouse coordinates within an element
const getDropPosition = (
  e: React.DragEvent,
  isFolder: boolean,
  itemEl: HTMLElement | null
): 'before' | 'after' | 'inside' | null => {
  if (!itemEl) return null;

  const rect = itemEl.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (height === 0) return null; // Avoid division by zero

  if (isFolder) {
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  } else {
    if (y < height * 0.5) return 'before';
    return 'after';
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;

const extractEmoji = (text: string): string | null => {
  const match = text.match(emojiRegex);
  return match ? match[0] : null;
};

const highlightMatches = (text: string, term: string): React.ReactNode => {
  if (!term.trim()) {
    return text;
  }
  const escaped = escapeRegExp(term.trim());
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <span key={index} className="bg-primary/20 text-text-main rounded-sm px-0.5">
          {part}
        </span>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};


const DocumentTreeItem: React.FC<DocumentTreeItemProps> = (props) => {
  const {
    node,
    level,
    canMoveUp,
    canMoveDown,
    ...baseChildProps
  } = props;

  const {
    selectedIds,
    focusedItemId,
    expandedIds,
    openDocumentIds,
    activeDocumentId,
    onSelectNode,
    onDeleteNode,
    onRenameNode,
    onMoveNode,
    onImportNodes,
    onRequestNodeExport,
    onDropFiles,
    onToggleExpand,
    onCopyNodeContent,
    onToggleLock,
    onMoveUp,
    onMoveDown,
    onContextMenu,
    renamingNodeId,
    onRenameComplete,
    indentPerLevel,
    verticalSpacing,
    searchTerm,
    isKnownNodeId,
  } = baseChildProps;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.title);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [lockedRowHeight, setLockedRowHeight] = useState<number | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const [isRenameEmojiPickerOpen, setIsRenameEmojiPickerOpen] = useState(false);
  const [renameEmojiAnchor, setRenameEmojiAnchor] = useState<{ x: number; y: number } | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const renameSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const isSelected = selectedIds.has(node.id);
  const isFocused = focusedItemId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const isFolder = node.type === 'folder';
  const isCodeFile = node.doc_type === 'source_code';
  const isOpenInTab = !isFolder && openDocumentIds.has(node.id);
  const areActionsVisible = isSelected || isFocused || isHovered;
  const emojiForNode = !isFolder ? extractEmoji(node.title) : null;
  const lockAriaLabel = node.locked ? 'Unlock Document' : 'Lock Document';
  const displayTitle = React.useMemo(() => {
    if (!emojiForNode || isFolder) {
      return node.title;
    }

    const emojiWithTrailingSpace = `${emojiForNode} `;
    if (node.title.startsWith(emojiWithTrailingSpace)) {
      return node.title.slice(emojiWithTrailingSpace.length);
    }

    if (node.title.startsWith(emojiForNode)) {
      return node.title.slice(emojiForNode.length);
    }

    return node.title;
  }, [emojiForNode, isFolder, node.title]);
  const isActiveTab = isOpenInTab && activeDocumentId === node.id;

  useEffect(() => {
    if (renamingNodeId === node.id) {
      setIsRenaming(true);
      onRenameComplete();
    }
  }, [renamingNodeId, node.id, onRenameComplete]);

  useEffect(() => {
    if (isRenaming) {
      const input = renameInputRef.current;
      input?.focus();
      input?.select();
      if (input) {
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? input.value.length;
        renameSelectionRef.current = { start, end };
      }
    } else {
      setIsRenameEmojiPickerOpen(false);
      setRenameEmojiAnchor(null);
    }
  }, [isRenaming]);

  useEffect(() => {
    if (isRenaming && !isSelected) {
      setIsRenaming(false);
    }
  }, [isSelected, isRenaming]);

  useEffect(() => {
    setRenameValue(node.title);
  }, [node.title]);

  useLayoutEffect(() => {
    if (!isHovered || !areActionsVisible || isRenaming) {
      setIsTitleTruncated(false);
      return;
    }

    const titleElement = titleRef.current;

    if (!titleElement) {
      setIsTitleTruncated(false);
      return;
    }

    const checkTruncation = () => {
      const truncated = titleElement.scrollWidth > titleElement.clientWidth + 0.5;
      setIsTitleTruncated(truncated);
    };

    checkTruncation();

    if (typeof window === 'undefined') {
      return;
    }

    let frame: number | null = window.requestAnimationFrame(checkTruncation);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(checkTruncation);
      resizeObserver.observe(titleElement);
    }

    window.addEventListener('resize', checkTruncation);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('resize', checkTruncation);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [areActionsVisible, displayTitle, isHovered, isRenaming, searchTerm]);

  const updateRenameSelection = useCallback(() => {
    const input = renameInputRef.current;
    if (!input) {
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    renameSelectionRef.current = { start, end };
  }, []);

  const closeRenameEmojiPicker = useCallback(() => {
    setIsRenameEmojiPickerOpen(false);
    setRenameEmojiAnchor(null);
    if (!isRenaming) {
      return;
    }
    requestAnimationFrame(() => {
      const input = renameInputRef.current;
      const selection = renameSelectionRef.current;
      if (input) {
        input.focus();
        if (selection) {
          input.setSelectionRange(selection.start, selection.end);
        }
      }
    });
  }, [isRenaming]);

  const handleRenameEmojiSelect = useCallback((emoji: string) => {
    const input = renameInputRef.current;
    if (!input) {
      return;
    }

    const selection = renameSelectionRef.current ?? {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };

    const caretPosition = selection.start + emoji.length;
    setRenameValue((previous) => {
      const before = previous.slice(0, selection.start);
      const after = previous.slice(selection.end);
      return `${before}${emoji}${after}`;
    });
    renameSelectionRef.current = { start: caretPosition, end: caretPosition };
    closeRenameEmojiPicker();
  }, [closeRenameEmojiPicker]);

  const handleRenameContextMenu = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateRenameSelection();
    setRenameEmojiAnchor({ x: event.clientX, y: event.clientY });
    setIsRenameEmojiPickerOpen(true);
  }, [updateRenameSelection]);

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  };

  const handleRenameSubmit = useCallback(() => {
    if (isRenameEmojiPickerOpen) {
      return;
    }
    if (renameValue.trim() && renameValue.trim() !== node.title) {
      onRenameNode(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  }, [isRenameEmojiPickerOpen, renameValue, node.title, onRenameNode, node.id]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
    }
  }, [handleRenameSubmit]);

  const handleRenameBlur = useCallback(() => {
    if (isRenameEmojiPickerOpen) {
      return;
    }
    handleRenameSubmit();
  }, [handleRenameSubmit, isRenameEmojiPickerOpen]);

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const draggedIds = Array.from(selectedIds.has(node.id) ? selectedIds : new Set([node.id]));
    e.dataTransfer.setData('application/json', JSON.stringify(draggedIds));
    const transferPayload = onRequestNodeExport(draggedIds);
    if (transferPayload) {
      e.dataTransfer.setData(DOCFORGE_DRAG_MIME, JSON.stringify(transferPayload));
    }
    e.dataTransfer.effectAllowed = transferPayload ? 'copyMove' : 'move';
  };

  const readLocalDragIds = (dataTransfer: DataTransfer): string[] | null => {
    if (!dataTransfer.types.includes('application/json')) {
      return null;
    }
    try {
      const raw = dataTransfer.getData('application/json');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.dataTransfer.types.includes('Files') ||
      e.dataTransfer.types.includes(DOCFORGE_DRAG_MIME) ||
      e.dataTransfer.types.includes('application/json')
    ) {
      const localIds = readLocalDragIds(e.dataTransfer);
      const hasKnownLocalIds = Array.isArray(localIds) && localIds.length > 0 && localIds.every(isKnownNodeId);
      const hasDocforgePayload = e.dataTransfer.types.includes(DOCFORGE_DRAG_MIME);
      const hasFiles = e.dataTransfer.types.includes('Files');
      const shouldCopy = hasFiles || (hasDocforgePayload && !hasKnownLocalIds);
      e.dataTransfer.dropEffect = shouldCopy ? 'copy' : 'move';
      const position = getDropPosition(e, isFolder, itemRef.current);
      if (position !== dropPosition) {
        setDropPosition(position);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Re-enabled to prevent event from bubbling to root drop handler

    const finalDropPosition = getDropPosition(e, isFolder, itemRef.current);
    setDropPosition(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const parentId = finalDropPosition === 'inside' ? node.id : node.parentId;
      onDropFiles(e.dataTransfer.files, parentId);
      return;
    }

    const localDragIds = readLocalDragIds(e.dataTransfer);
    if (finalDropPosition && Array.isArray(localDragIds) && localDragIds.length > 0) {
      const allKnown = localDragIds.every(isKnownNodeId);
      if (allKnown && !localDragIds.includes(node.id)) {
        onMoveNode(localDragIds, node.id, finalDropPosition);
        if (finalDropPosition === 'inside' && isFolder && !isExpanded) {
          onToggleExpand(node.id);
        }
        return;
      }
    }

    const transferData = e.dataTransfer.getData(DOCFORGE_DRAG_MIME);
    if (transferData && finalDropPosition) {
      try {
        const payload = JSON.parse(transferData) as DraggedNodeTransfer;
        onImportNodes(payload, node.id, finalDropPosition);
        if (finalDropPosition === 'inside' && isFolder && !isExpanded) {
          onToggleExpand(node.id);
        }
      } catch (error) {
        console.warn('Failed to parse DocForge drag payload on drop:', error);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.id);
  }

  const safeIndent = Math.max(indentPerLevel, 0);
  const paddingTopBottom = Math.max(verticalSpacing, 0);
  const basePaddingLeft = 4; // matches Tailwind px-1 for consistent baseline spacing
  const rowPaddingLeft = basePaddingLeft + Math.max(level, 0) * safeIndent;
  const snippetPaddingLeft = rowPaddingLeft + 28;
  const snippetAccentPadding = 8;
  const snippetAccentWidth = 3;
  const snippetMarginLeft = Math.max(snippetPaddingLeft - snippetAccentPadding, 0);
  const snippetAccentColor = 'rgb(var(--color-accent) / 0.45)';
  const snippetBackgroundColor = 'rgb(var(--color-background))';

  return (
    <li
      ref={itemRef}
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      className="relative"
      data-item-id={node.id}
    >
      <div
        ref={rowRef}
        onClick={(e) => !isRenaming && onSelectNode(node.id, e)}
        onDoubleClick={(e) => !isRenaming && handleRenameStart(e)}
        onMouseEnter={() => {
          if (rowRef.current) {
            setLockedRowHeight(rowRef.current.getBoundingClientRect().height);
          }
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setLockedRowHeight(null);
        }}
        style={{
          paddingLeft: `${rowPaddingLeft}px`,
          height: '22px', // VS Code standard row height
          minHeight: '22px',
        }}
        className={`w-full text-left pr-1 flex justify-between items-center transition-colors duration-0 text-[13px] relative focus:outline-none cursor-default ${isSelected
          ? 'bg-tree-selected text-text-main font-medium'
          : 'hover:bg-tree-selected/40 text-text-secondary hover:text-text-main'
          } ${isFocused ? 'ring-1 ring-inset ring-primary' : ''}`}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {isFolder && node.children.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }} className="-ml-1 p-0.5 rounded hover:bg-border-color">
              {isExpanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4" /> // Spacer for alignment
          )}

          {/* Use standardized FolderIcon for both states to prevent 'broken' look of FolderOpenIcon */}
          {isFolder ? (
            <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
          ) : emojiForNode ? (
            <span className="w-3.5 h-3.5 flex items-center justify-center text-base leading-none" aria-hidden="true">{emojiForNode}</span>
          ) : (
            isCodeFile ? <CodeIcon className="w-3.5 h-3.5 flex-shrink-0" /> : <FileIcon className="w-3.5 h-3.5 flex-shrink-0" />
          )}

          {isOpenInTab && (
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActiveTab ? 'bg-primary' : 'bg-primary/50'}`}
            />
          )}

          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onClick={(e) => { e.stopPropagation(); updateRenameSelection(); }}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              onContextMenu={handleRenameContextMenu}
              onSelect={updateRenameSelection}
              onKeyUp={updateRenameSelection}
              onMouseUp={updateRenameSelection}
              className="w-full text-left text-xs px-1.5 py-1 rounded-md bg-background text-text-main border border-border-color focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <span
              ref={titleRef}
              className={`flex-1 px-1 ${areActionsVisible ? 'truncate' : 'whitespace-normal break-words'
                }`}
            >
              {highlightMatches(displayTitle, searchTerm)}
            </span>
          )}
        </div>

        {isHovered && isTitleTruncated && titleRef.current && (
          <Tooltip
            targetRef={titleRef}
            content={(
              <span className="inline-flex max-w-xs whitespace-pre-wrap break-words text-left leading-snug gap-1">
                {emojiForNode && !isFolder && (
                  <span aria-hidden="true">{emojiForNode}</span>
                )}
                <span>{highlightMatches(displayTitle, searchTerm)}</span>
              </span>
            )}
          />
        )}

        {!isRenaming && (
          <div
            className={`transition-opacity flex items-center ${areActionsVisible ? 'opacity-100 pr-1' : 'opacity-0 pr-0 pointer-events-none'
              }`}
            style={{
              width: areActionsVisible ? undefined : 0,
              overflow: areActionsVisible ? undefined : 'hidden',
            }}
          >
            <IconButton
              aria-label="Move Up"
              onClick={(e) => { e.stopPropagation(); onMoveUp(node.id); }}
              size="xs"
              variant="ghost"
              disabled={!canMoveUp}
            >
              <ArrowUpIcon className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              aria-label="Move Down"
              onClick={(e) => { e.stopPropagation(); onMoveDown(node.id); }}
              size="xs"
              variant="ghost"
              disabled={!canMoveDown}
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
            </IconButton>
            {!isFolder && (
              <>
                <IconButton
                  aria-label="Copy Content"
                  onClick={(e) => { e.stopPropagation(); onCopyNodeContent(node.id); }}
                  size="xs"
                  variant="ghost"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  aria-label={lockAriaLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleLock(node.id, !node.locked);
                  }}
                  size="xs"
                  variant="ghost"
                  className={node.locked ? 'text-primary' : ''}
                >
                  {node.locked ? (
                    <LockClosedIcon className="w-3.5 h-3.5" />
                  ) : (
                    <LockOpenIcon className="w-3.5 h-3.5" />
                  )}
                </IconButton>
                <IconButton
                  aria-label="Delete Document"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id, e.shiftKey);
                  }}
                  size="xs"
                  variant="destructive"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>

      {!isFolder && searchTerm.trim() && node.searchSnippet && (
        <div
          className="text-[11px] text-text-secondary leading-snug whitespace-pre-wrap break-words pr-3"
          style={{
            marginLeft: `${snippetMarginLeft}px`,
            paddingLeft: `${snippetAccentPadding}px`,
            borderLeftWidth: `${snippetAccentWidth}px`,
            borderLeftStyle: 'solid',
            borderLeftColor: snippetAccentColor,
            backgroundColor: snippetBackgroundColor,
            borderRadius: '4px',
          }}
        >
          {highlightMatches(node.searchSnippet, searchTerm)}
        </div>
      )}

      {dropPosition && <div className={`absolute left-0 right-0 h-0.5 bg-primary pointer-events-none ${dropPosition === 'before' ? 'top-0' : dropPosition === 'after' ? 'bottom-0' : ''
        }`} />}
      {dropPosition === 'inside' && <div className="absolute inset-0 border-2 border-primary rounded-md pointer-events-none bg-primary/10" />}

      {isFolder && isExpanded && (
        <ul
          className="m-0 pl-0 list-none space-y-0"
        >
          {node.children.map((childNode, index) => (
            <DocumentTreeItem
              key={childNode.id}
              {...baseChildProps}
              node={childNode}
              level={level + 1}
              canMoveUp={index > 0}
              canMoveDown={index < node.children.length - 1}
            />
          ))}
        </ul>
      )}
      <EmojiPickerOverlay
        isOpen={isRenaming && isRenameEmojiPickerOpen}
        anchor={renameEmojiAnchor}
        onClose={closeRenameEmojiPicker}
        onSelectEmoji={handleRenameEmojiSelect}
        ariaLabel="Insert emoji into node name"
      />
    </li>
  );
};

export default DocumentTreeItem;

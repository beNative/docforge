import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentOrFolder } from '../types';
import ContextMenu, { MenuItem } from './ContextMenu';
import { CloseIcon, ChevronDownIcon, FileIcon } from './Icons';

interface DocumentTabsProps {
    documents: DocumentOrFolder[];
    openDocumentIds: string[];
    activeDocumentId: string | null;
    onSelectTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onCloseOthers: (id: string) => void;
    onCloseTabsToRight: (id: string) => void;
    onReorderTabs: (fromIndex: number, toIndex: number) => void;
}

interface MenuState {
    isOpen: boolean;
    position: { x: number; y: number };
    items: MenuItem[];
}

const INITIAL_MENU_STATE: MenuState = {
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
};

const DocumentTabs: React.FC<DocumentTabsProps> = ({
    documents,
    openDocumentIds,
    activeDocumentId,
    onSelectTab,
    onCloseTab,
    onCloseOthers,
    onCloseTabsToRight,
    onReorderTabs,
}) => {
    const docsById = useMemo(() => new Map(documents.map(doc => [doc.id, doc])), [documents]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef(new Map<string, HTMLDivElement>());
    const dragState = useRef<{ id: string | null; index: number }>({ id: null, index: -1 });
    const [menuState, setMenuState] = useState<MenuState>(INITIAL_MENU_STATE);
    const [scrollState, setScrollState] = useState({
        canScrollLeft: false,
        canScrollRight: false,
        hiddenTabIds: [] as string[],
    });

    const updateScrollState = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) {
            setScrollState({ canScrollLeft: false, canScrollRight: false, hiddenTabIds: [] });
            return;
        }

        const { scrollLeft, scrollWidth, clientWidth } = container;
        const containerRect = container.getBoundingClientRect();
        const hiddenTabIds: string[] = [];

        for (const id of openDocumentIds) {
            const element = tabRefs.current.get(id);
            if (!element) continue;
            const rect = element.getBoundingClientRect();
            const isHiddenLeft = rect.right <= containerRect.left + 2;
            const isHiddenRight = rect.left >= containerRect.right - 2;
            if (isHiddenLeft || isHiddenRight) {
                hiddenTabIds.push(id);
            }
        }

        const canScrollLeft = scrollLeft > 1;
        const canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;

        setScrollState((previous) => {
            if (
                previous.canScrollLeft === canScrollLeft &&
                previous.canScrollRight === canScrollRight &&
                previous.hiddenTabIds.length === hiddenTabIds.length &&
                previous.hiddenTabIds.every((id, index) => id === hiddenTabIds[index])
            ) {
                return previous;
            }
            return {
                canScrollLeft,
                canScrollRight,
                hiddenTabIds,
            };
        });
    }, [openDocumentIds]);

    useEffect(() => {
        updateScrollState();
    }, [updateScrollState, openDocumentIds.length, documents]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => updateScrollState());
        observer.observe(container);
        if (container.parentElement) {
            observer.observe(container.parentElement);
        }
        window.addEventListener('resize', updateScrollState);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateScrollState);
        };
    }, [updateScrollState]);

    useEffect(() => {
        if (!activeDocumentId) return;
        const element = tabRefs.current.get(activeDocumentId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
            requestAnimationFrame(() => updateScrollState());
        }
    }, [activeDocumentId, updateScrollState]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => updateScrollState();
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [updateScrollState]);

    const closeMenu = useCallback(() => {
        setMenuState(INITIAL_MENU_STATE);
    }, []);

    const openTabMenu = useCallback((event: React.MouseEvent, tabId: string) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const index = openDocumentIds.indexOf(tabId);
        const items: MenuItem[] = [
            { label: 'Close Tab', action: () => onCloseTab(tabId), icon: CloseIcon },
            {
                label: 'Close Others',
                action: () => onCloseOthers(tabId),
                disabled: openDocumentIds.length <= 1,
            },
            {
                label: 'Close Tabs to Right',
                action: () => onCloseTabsToRight(tabId),
                disabled: index === -1 || index === openDocumentIds.length - 1,
            },
        ];
        setMenuState({
            isOpen: true,
            position: { x: rect.left, y: rect.bottom + 4 },
            items,
        });
    }, [onCloseOthers, onCloseTab, onCloseTabsToRight, openDocumentIds]);

    const openOverflowMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!scrollState.hiddenTabIds.length) {
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const items: MenuItem[] = scrollState.hiddenTabIds.map((id) => {
            const doc = docsById.get(id);
            const displayTitle = doc?.title?.trim() || 'Untitled Document';
            return {
                label: displayTitle,
                action: () => onSelectTab(id),
                icon: FileIcon,
                disabled: id === activeDocumentId,
            };
        });
        setMenuState({
            isOpen: true,
            position: { x: rect.left, y: rect.bottom + 4 },
            items,
        });
    }, [scrollState.hiddenTabIds, docsById, onSelectTab, activeDocumentId]);

    const scrollToDirection = useCallback((direction: 'left' | 'right') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { clientWidth, scrollLeft } = container;
        if (!openDocumentIds.length) return;

        if (direction === 'left') {
            for (let index = openDocumentIds.length - 1; index >= 0; index -= 1) {
                const id = openDocumentIds[index];
                const element = tabRefs.current.get(id);
                if (!element) continue;
                const tabStart = element.offsetLeft;
                if (tabStart < scrollLeft - 1) {
                    container.scrollTo({ left: tabStart, behavior: 'smooth' });
                    return;
                }
            }
            container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            for (let index = 0; index < openDocumentIds.length; index += 1) {
                const id = openDocumentIds[index];
                const element = tabRefs.current.get(id);
                if (!element) continue;
                const tabEnd = element.offsetLeft + element.offsetWidth;
                if (tabEnd > scrollLeft + clientWidth + 1) {
                    container.scrollTo({ left: tabEnd - clientWidth, behavior: 'smooth' });
                    return;
                }
            }
            container.scrollTo({ left: container.scrollWidth - clientWidth, behavior: 'smooth' });
        }
    }, [openDocumentIds]);

    const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, tabId: string, index: number) => {
        dragState.current = { id: tabId, index };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tabId);
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>, targetIndex: number, targetElement: HTMLDivElement) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain') || dragState.current.id;
        if (!draggedId) return;
        const fromIndex = openDocumentIds.indexOf(draggedId);
        if (fromIndex === -1) {
            dragState.current = { id: null, index: -1 };
            return;
        }

        const rect = targetElement.getBoundingClientRect();
        const dropBefore = event.clientX < rect.left + rect.width / 2;
        let toIndex = targetIndex;
        if (!dropBefore) {
            toIndex = targetIndex + 1;
        }
        if (fromIndex === toIndex || fromIndex + 1 === toIndex) {
            dragState.current = { id: null, index: -1 };
            return;
        }
        if (toIndex > openDocumentIds.length) {
            toIndex = openDocumentIds.length;
        }
        onReorderTabs(fromIndex, toIndex > fromIndex ? toIndex - 1 : toIndex);
        dragState.current = { id: null, index: -1 };
    }, [openDocumentIds, onReorderTabs]);

    const handleContainerDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain') || dragState.current.id;
        if (!draggedId) return;
        const fromIndex = openDocumentIds.indexOf(draggedId);
        if (fromIndex === -1) {
            dragState.current = { id: null, index: -1 };
            return;
        }
        onReorderTabs(fromIndex, openDocumentIds.length - 1);
        dragState.current = { id: null, index: -1 };
    }, [openDocumentIds, onReorderTabs]);

    const handleDragEnd = useCallback(() => {
        dragState.current = { id: null, index: -1 };
    }, []);

    const tabElements = openDocumentIds.map((id, index) => {
        const doc = docsById.get(id);
        const isActive = id === activeDocumentId;
        const title = doc?.title?.trim() || 'Untitled Document';
        return (
            <div
                key={id}
                ref={(element) => {
                    if (element) {
                        tabRefs.current.set(id, element);
                    } else {
                        tabRefs.current.delete(id);
                    }
                }}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                data-tab-id={id}
                className={`group relative flex items-center gap-2 px-3 h-full border border-b-0 rounded-t-md cursor-pointer select-none transition-colors ${isActive ? 'bg-background text-text-main border-border-color border-b-background shadow-sm' : 'bg-secondary/60 text-text-secondary hover:text-text-main hover:bg-secondary/80 border-border-color/70'}`}
                onClick={() => onSelectTab(id)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectTab(id);
                    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w') {
                        event.preventDefault();
                        onCloseTab(id);
                    }
                }}
                onContextMenu={(event) => openTabMenu(event, id)}
                draggable
                onDragStart={(event) => handleDragStart(event, id, index)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, index, event.currentTarget)}
                onDragEnd={handleDragEnd}
            >
                <span className="truncate max-w-[160px] text-xs font-medium">
                    {title}
                </span>
                <button
                    type="button"
                    className={`flex items-center justify-center rounded-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onCloseTab(id);
                    }}
                    aria-label={`Close ${title}`}
                >
                    <CloseIcon className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    });

    return (
        <div className="border-b border-border-color bg-secondary/70 h-7 flex items-center">
            <div className="flex items-center gap-1 px-2 w-full h-full">
                <div
                    ref={scrollContainerRef}
                    className="flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-hidden"
                    onDragOver={handleDragOver}
                    onDrop={handleContainerDrop}
                    role="tablist"
                >
                    <div className="flex items-stretch gap-1 h-full min-w-max pr-2">
                        {tabElements}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-text-secondary hover:text-text-main hover:bg-secondary/80 border border-border-color/70 disabled:opacity-40 disabled:cursor-default"
                        onClick={() => scrollToDirection('left')}
                        aria-label="Scroll tabs left"
                        disabled={!scrollState.canScrollLeft}
                    >
                        <ChevronDownIcon className="w-4 h-4 -rotate-90" />
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-text-secondary hover:text-text-main hover:bg-secondary/80 border border-border-color/70 disabled:opacity-40 disabled:cursor-default"
                        onClick={() => scrollToDirection('right')}
                        aria-label="Scroll tabs right"
                        disabled={!scrollState.canScrollRight}
                    >
                        <ChevronDownIcon className="w-4 h-4 rotate-90" />
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-text-secondary hover:text-text-main hover:bg-secondary/80 border border-border-color/70 disabled:opacity-40 disabled:cursor-default"
                        onClick={openOverflowMenu}
                        aria-label="Show hidden tabs"
                        disabled={!scrollState.hiddenTabIds.length}
                    >
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <ContextMenu
                isOpen={menuState.isOpen}
                position={menuState.position}
                items={menuState.items}
                onClose={closeMenu}
            />
        </div>
    );
};

export default DocumentTabs;

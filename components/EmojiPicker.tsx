import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { storageService } from '../services/storageService';
import {
  EMOJI_CATEGORIES,
  EMOJI_BY_CATEGORY,
  EMOJI_DEFINITIONS,
  type EmojiCategoryId,
  type EmojiDefinition,
} from '../data/emojiData';

interface EmojiPickerProps {
  anchor: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const FREQUENT_LIMIT = 24;
const EDGE_MARGIN = 12;

const normalize = (value: string) => value.normalize('NFKD');

const EmojiPicker: React.FC<EmojiPickerProps> = ({ anchor, onSelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: anchor.y, left: anchor.x });
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>('smileys_people');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequent, setFrequent] = useState<string[]>([]);

  const emojiLookup = useMemo(() => {
    const map = new Map<string, EmojiDefinition>();
    for (const emoji of EMOJI_DEFINITIONS) {
      map.set(emoji.emoji, emoji);
    }
    return map;
  }, []);

  const normalizedSearch = useMemo(() => normalize(searchTerm.trim().toLowerCase()), [searchTerm]);

  const searchResults = useMemo(() => {
    if (!normalizedSearch) {
      return [] as EmojiDefinition[];
    }

    return EMOJI_DEFINITIONS.filter((emoji) => {
      const name = normalize(emoji.name.toLowerCase());
      if (name.includes(normalizedSearch)) {
        return true;
      }
      return emoji.keywords.some((keyword) => normalize(keyword.toLowerCase()).includes(normalizedSearch));
    });
  }, [normalizedSearch]);

  const frequentEmojis = useMemo(() => {
    return frequent
      .map((emoji) => emojiLookup.get(emoji))
      .filter((emoji): emoji is EmojiDefinition => Boolean(emoji));
  }, [emojiLookup, frequent]);

  const handleSelect = useCallback(
    (emoji: string) => {
      setFrequent((previous) => {
        const next = [emoji, ...previous.filter((value) => value !== emoji)].slice(0, FREQUENT_LIMIT);
        void storageService.save(LOCAL_STORAGE_KEYS.EMOJI_FREQUENT, next);
        return next;
      });
      onSelect(emoji);
    },
    [onSelect]
  );

  useEffect(() => {
    let isMounted = true;
    void storageService.load<string[]>(LOCAL_STORAGE_KEYS.EMOJI_FREQUENT, []).then((stored) => {
      if (!isMounted) return;
      if (Array.isArray(stored)) {
        setFrequent(stored.filter((value) => typeof value === 'string'));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const reposition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let top = anchor.y;
    let left = anchor.x;

    if (top + rect.height > innerHeight - EDGE_MARGIN) {
      top = Math.max(EDGE_MARGIN, innerHeight - rect.height - EDGE_MARGIN);
    }
    if (left + rect.width > innerWidth - EDGE_MARGIN) {
      left = Math.max(EDGE_MARGIN, innerWidth - rect.width - EDGE_MARGIN);
    }
    if (top < EDGE_MARGIN) {
      top = EDGE_MARGIN;
    }
    if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    }

    setPosition((previous) => {
      if (previous.top === top && previous.left === left) {
        return previous;
      }
      return { top, left };
    });
  }, [anchor.x, anchor.y]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, anchor.x, anchor.y, searchResults.length]);

  useEffect(() => {
    const handleResize = () => reposition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [reposition]);

  const overlayRoot = typeof document !== 'undefined' ? document.getElementById('overlay-root') : null;
  if (!overlayRoot) return null;

  const renderEmojiButton = (emoji: EmojiDefinition) => (
    <button
      key={emoji.emoji}
      type="button"
      onClick={() => handleSelect(emoji.emoji)}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
      title={`${emoji.name}`}
      aria-label={emoji.name}
    >
      <span>{emoji.emoji}</span>
    </button>
  );

  const renderSection = (title: string, emojis: EmojiDefinition[]) => {
    if (emojis.length === 0) return null;
    return (
      <section key={title} className="mb-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-secondary">{title}</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
          {emojis.map(renderEmojiButton)}
        </div>
      </section>
    );
  };

  const categoriesContent = normalizedSearch
    ? renderSection('Search Results', searchResults)
    : (
      <>
        {frequentEmojis.length > 0 && renderSection('Frequently Used', frequentEmojis)}
        {renderSection(EMOJI_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? '', EMOJI_BY_CATEGORY[activeCategory])}
      </>
    );

  return ReactDOM.createPortal(
    <div
      ref={containerRef}
      className="fixed z-[60] w-[30rem] max-w-[95vw] rounded-xl border border-border-color bg-secondary shadow-2xl"
      style={{ top: position.top, left: position.left }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex h-full max-h-[26rem]">
        <nav className="w-44 flex-shrink-0 border-r border-border-color bg-secondary/80 p-2 pr-0">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-widest text-text-secondary">Categories</p>
          <ul className="space-y-1 overflow-y-auto pr-2">
            {EMOJI_CATEGORIES.map((category) => {
              const isActive = category.id === activeCategory && !normalizedSearch;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory(category.id);
                      setSearchTerm('');
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none ${
                      isActive ? 'bg-primary text-primary-text shadow-sm' : 'text-text-main hover:bg-primary/10'
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="text-lg" aria-hidden="true">{category.icon}</span>
                    <span className="truncate">{category.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex-1 p-4">
          <div className="mb-4">
            <label htmlFor="emoji-search" className="sr-only">
              Search emoji
            </label>
            <input
              id="emoji-search"
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search emoji"
              className="w-full rounded-lg border border-border-color bg-background px-3 py-2 text-sm text-text-main shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="max-h-[19rem] overflow-y-auto overflow-x-hidden pr-1">
            {normalizedSearch && searchResults.length === 0 ? (
              <p className="text-sm text-text-secondary">No emoji found for "{searchTerm}".</p>
            ) : (
              categoriesContent
            )}
          </div>
        </div>
      </div>
    </div>,
    overlayRoot
  );
};

export default EmojiPicker;

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Modal from './Modal';
import { EMOJI_ENTRIES, EmojiEntry } from '../constants/emojiList';

interface EmojiPickerDialogProps {
  onClose: () => void;
  onSelect: (emoji: EmojiEntry) => void;
  contextLabel?: string;
}

type EmojiViewMode = 'grid' | 'compact' | 'list';

interface CategoryDefinition {
  id: string;
  label: string;
  icon: string;
  description?: string;
  matcher?: (entry: EmojiEntry) => boolean;
  getEntries?: () => EmojiEntry[];
}

interface CategoryWithCount extends CategoryDefinition {
  count: number;
}

const RECENT_LIMIT = 32;
const RECENT_STORAGE_KEY = 'docforge.emojiPicker.recent';
const VIEW_MODE_STORAGE_KEY = 'docforge.emojiPicker.viewMode';
const CATEGORY_STORAGE_KEY = 'docforge.emojiPicker.category';

const normalize = (value: string) => value.normalize('NFKD').toLowerCase();

const createKeywordMatcher = (keywords: string[]) => {
  const normalizedKeywords = keywords.map((keyword) => normalize(keyword));
  return (entry: EmojiEntry) => {
    const haystack = normalize(`${entry.description} ${entry.shortcode} ${entry.keywords.join(' ')}`);
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  };
};

const STATIC_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'smileys',
    label: 'Smileys & Emotion',
    icon: '😊',
    description: 'Expressions, hearts, and every mood in between.',
    matcher: createKeywordMatcher([
      'face',
      'smile',
      'grin',
      'laugh',
      'joy',
      'cry',
      'tear',
      'sad',
      'angry',
      'kiss',
      'love',
      'heart',
      'emotion',
      'wink',
    ]),
  },
  {
    id: 'people',
    label: 'People & Body',
    icon: '🧍',
    description: 'Gestures, characters, and every handy motion.',
    matcher: createKeywordMatcher([
      'person',
      'people',
      'hand',
      'hands',
      'body',
      'gesture',
      'family',
      'man',
      'woman',
      'boy',
      'girl',
      'baby',
      'foot',
      'leg',
      'selfie',
      'yoga',
    ]),
  },
  {
    id: 'nature',
    label: 'Nature & Animals',
    icon: '🌿',
    description: 'Flora, fauna, and the great outdoors.',
    matcher: createKeywordMatcher([
      'animal',
      'nature',
      'plant',
      'flower',
      'tree',
      'weather',
      'sun',
      'moon',
      'star',
      'mountain',
      'water',
      'fire',
      'bug',
      'cat',
      'dog',
      'bird',
      'fish',
    ]),
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: '🍽️',
    description: 'Comforting bites, sweet treats, and sips.',
    matcher: createKeywordMatcher([
      'food',
      'drink',
      'fruit',
      'vegetable',
      'sweet',
      'dessert',
      'meal',
      'snack',
      'coffee',
      'tea',
      'beverage',
      'bread',
      'cheese',
    ]),
  },
  {
    id: 'activities',
    label: 'Activities & Celebration',
    icon: '🎉',
    description: 'Sports, games, art, music, and parties.',
    matcher: createKeywordMatcher([
      'party',
      'celebration',
      'sport',
      'game',
      'music',
      'instrument',
      'art',
      'award',
      'ball',
      'festival',
      'hobby',
      'dancing',
    ]),
  },
  {
    id: 'travel',
    label: 'Travel & Places',
    icon: '🗺️',
    description: 'Landmarks, landscapes, and ways to get there.',
    matcher: createKeywordMatcher([
      'place',
      'travel',
      'building',
      'vehicle',
      'transport',
      'map',
      'city',
      'bridge',
      'beach',
      'hotel',
      'mountain',
      'train',
      'car',
      'ship',
      'aeroplane',
      'airport',
    ]),
  },
  {
    id: 'objects',
    label: 'Objects & Tools',
    icon: '🧰',
    description: 'Gadgets, gear, office essentials, and curiosities.',
    matcher: createKeywordMatcher([
      'tool',
      'device',
      'object',
      'money',
      'office',
      'book',
      'lock',
      'key',
      'light',
      'mail',
      'medical',
      'science',
      'technology',
      'clock',
    ]),
  },
  {
    id: 'symbols',
    label: 'Symbols & Shapes',
    icon: '🔣',
    description: 'Arrows, numbers, shapes, and expressive signs.',
    matcher: createKeywordMatcher([
      'symbol',
      'shape',
      'number',
      'letter',
      'mark',
      'button',
      'square',
      'circle',
      'triangle',
      'arrow',
      'star',
      'keycap',
      'sign',
    ]),
  },
  {
    id: 'flags',
    label: 'Flags',
    icon: '🏳️',
    description: 'National, regional, and pride flags.',
    matcher: (entry) => entry.shortcode.startsWith('flag_') || normalize(entry.description).includes('flag'),
  },
];

const VIEW_MODES: Array<{ id: EmojiViewMode; label: string; emoji: string; description: string }> = [
  { id: 'grid', label: 'Gallery', emoji: '🖼️', description: 'Balanced cards with labels and codes.' },
  { id: 'compact', label: 'Compact', emoji: '🔳', description: 'Ultra-dense grid for speed browsing.' },
  { id: 'list', label: 'List', emoji: '📋', description: 'Detailed rows with keywords and codes.' },
];

const EmojiPickerDialog: React.FC<EmojiPickerDialogProps> = ({ onClose, onSelect, contextLabel }) => {
  const [search, setSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const entryMap = useMemo(() => new Map(EMOJI_ENTRIES.map((entry) => [entry.shortcode, entry])), []);

  const [recentShortcodes, setRecentShortcodes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // Ignore corrupted storage.
    }
    return [];
  });

  const [viewMode, setViewMode] = useState<EmojiViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'compact' || stored === 'list' || stored === 'grid') {
      return stored;
    }
    return 'grid';
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    const stored = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    return stored || 'all';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentShortcodes));
  }, [recentShortcodes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, activeCategoryId);
  }, [activeCategoryId]);

  const recentEntries = useMemo(() => {
    return recentShortcodes
      .map((code) => entryMap.get(code))
      .filter((entry): entry is EmojiEntry => Boolean(entry));
  }, [recentShortcodes, entryMap]);

  const baseCategories = useMemo(() => {
    const categories: CategoryDefinition[] = [
      {
        id: 'all',
        label: 'All Emojis',
        icon: '✨',
        description: 'Every emoji in one vibrant library.',
      },
    ];

    if (recentEntries.length) {
      categories.push({
        id: 'recent',
        label: 'Recently Used',
        icon: '🕘',
        description: 'Your latest selections, ready to reuse.',
        getEntries: () => recentEntries,
      });
    }

    categories.push(...STATIC_CATEGORIES);
    return categories;
  }, [recentEntries]);

  const normalizedSearch = normalize(search.trim());

  const searchMatches = useMemo(() => {
    if (!normalizedSearch) {
      return EMOJI_ENTRIES;
    }
    return EMOJI_ENTRIES.filter((entry) => {
      const haystack = normalize(`${entry.description} ${entry.shortcode} ${entry.keywords.join(' ')}`);
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const searchMatchSet = useMemo(() => new Set(searchMatches.map((entry) => entry.shortcode)), [searchMatches]);

  const categoriesWithCounts: CategoryWithCount[] = useMemo(() => {
    return baseCategories.map((category) => {
      if (category.getEntries) {
        const pool = category.getEntries();
        const relevant = normalizedSearch ? pool.filter((entry) => searchMatchSet.has(entry.shortcode)) : pool;
        return { ...category, count: relevant.length };
      }
      if (category.matcher) {
        const matches = searchMatches.filter((entry) => category.matcher?.(entry));
        return { ...category, count: matches.length };
      }
      return { ...category, count: searchMatches.length };
    });
  }, [baseCategories, searchMatches, searchMatchSet, normalizedSearch]);

  useEffect(() => {
    if (!categoriesWithCounts.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId('all');
    }
  }, [categoriesWithCounts, activeCategoryId]);

  const activeCategory = useMemo(() => {
    return categoriesWithCounts.find((category) => category.id === activeCategoryId) ?? categoriesWithCounts[0];
  }, [categoriesWithCounts, activeCategoryId]);

  const filtered = useMemo(() => {
    if (!activeCategory) {
      return searchMatches;
    }

    if (activeCategory.getEntries) {
      const entries = activeCategory.getEntries();
      if (!normalizedSearch) {
        return entries;
      }
      return entries.filter((entry) => searchMatchSet.has(entry.shortcode));
    }

    if (activeCategory.matcher) {
      return searchMatches.filter((entry) => activeCategory.matcher?.(entry));
    }

    return searchMatches;
  }, [activeCategory, searchMatches, normalizedSearch, searchMatchSet]);

  useEffect(() => {
    setVisibleCount(filtered.length);
  }, [filtered]);

  useEffect(() => {
    if (!filtered.length) {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex((previous) => {
      if (previous === null) return 0;
      return Math.min(previous, filtered.length - 1);
    });
  }, [filtered]);

  const recordRecent = useCallback((entry: EmojiEntry) => {
    setRecentShortcodes((previous) => {
      const without = previous.filter((code) => code !== entry.shortcode);
      return [entry.shortcode, ...without].slice(0, RECENT_LIMIT);
    });
  }, []);

  const handleSelect = useCallback((entry: EmojiEntry) => {
    recordRecent(entry);
    onSelect(entry);
  }, [onSelect, recordRecent]);

  const handleSurprise = useCallback(() => {
    if (!filtered.length) return;
    const index = Math.floor(Math.random() * filtered.length);
    const entry = filtered[index];
    setHoveredIndex(index);
    handleSelect(entry);
  }, [filtered, handleSelect]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!filtered.length) return;

    const columns = viewMode === 'compact' ? 12 : viewMode === 'list' ? 1 : 8;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        const current = prev === null ? -1 : prev;
        return (current + 1) % filtered.length;
      });
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        const current = prev === null ? filtered.length : prev;
        return (current - 1 + filtered.length) % filtered.length;
      });
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        const current = prev === null ? -columns : prev;
        return Math.min(current + columns, filtered.length - 1);
      });
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        const current = prev === null ? columns : prev;
        return Math.max(current - columns, 0);
      });
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setHoveredIndex(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setHoveredIndex(filtered.length - 1);
    }
    if (event.key === 'Enter' && hoveredIndex !== null) {
      event.preventDefault();
      handleSelect(filtered[hoveredIndex]);
    }
  };

  useEffect(() => {
    if (hoveredIndex === null || typeof document === 'undefined') return;
    const target = document.getElementById(`emoji-option-${hoveredIndex}`);
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [hoveredIndex]);

  const previewEntry = useMemo(() => {
    if (hoveredIndex !== null && filtered[hoveredIndex]) {
      return filtered[hoveredIndex];
    }
    if (filtered.length) {
      return filtered[0];
    }
    if (activeCategory?.getEntries) {
      const entries = activeCategory.getEntries();
      if (entries.length) {
        return entries[0];
      }
    }
    return searchMatches[0] ?? null;
  }, [filtered, hoveredIndex, activeCategory, searchMatches]);

  const activeViewMode = VIEW_MODES.find((mode) => mode.id === viewMode) ?? VIEW_MODES[0];

  const categoryDescription = activeCategory?.description;

  return (
    <Modal onClose={onClose} title="Choose an Emoji" initialFocusRef={searchInputRef}>
      <div className="p-4 flex flex-col gap-4" onKeyDown={handleKeyDown}>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-secondary">
            {contextLabel ? `Selecting for ${contextLabel}.` : 'Search, browse, and sprinkle delight anywhere in your document.'}
          </p>
          <div className="relative">
            <input
              ref={searchInputRef}
              id="emoji-search"
              type="text"
              className="w-full rounded-lg border border-border-color bg-background/80 px-3 py-2 text-sm text-text-main shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Try typing 'rocket', ':smile:', or 'party'"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                className="absolute inset-y-0 right-2 flex items-center text-lg text-text-tertiary hover:text-text-secondary"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start md:gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl border border-border-color bg-background/50 p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-1 rounded-full border border-border-color bg-background/80 p-1">
                  {VIEW_MODES.map((mode) => {
                    const isActive = mode.id === viewMode;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                          isActive
                            ? 'bg-primary/15 text-primary shadow-sm border border-primary/40'
                            : 'text-text-secondary hover:text-primary hover:bg-primary/5 border border-transparent'
                        }`}
                        onClick={() => setViewMode(mode.id)}
                        aria-pressed={isActive}
                      >
                        <span aria-hidden>{mode.emoji}</span>
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleSurprise}
                  className="inline-flex items-center gap-2 rounded-full border border-border-color bg-background/80 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                >
                  <span aria-hidden>🎲</span>
                  Surprise me
                </button>
              </div>
              <p className="text-[11px] text-text-tertiary">
                {activeViewMode.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1" role="tablist" aria-label="Emoji categories">
              {categoriesWithCounts.map((category) => {
                const isActive = category.id === activeCategory?.id;
                const isDisabled = category.count === 0;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-primary/50 bg-primary/15 text-primary shadow-sm'
                        : 'border-border-color bg-background/60 text-text-secondary hover:border-primary/40 hover:text-primary'
                    } ${isDisabled ? 'opacity-60 cursor-not-allowed hover:border-border-color hover:text-text-secondary' : ''}`}
                    onClick={() => {
                      if (!isDisabled) {
                        setActiveCategoryId(category.id);
                      }
                    }}
                    aria-pressed={isActive}
                    aria-disabled={isDisabled}
                  >
                    <span aria-hidden>{category.icon}</span>
                    {category.label}
                    <span className="text-[10px] text-text-tertiary">({category.count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative border border-border-color rounded-2xl bg-background/60 shadow-inner">
              <div className="max-h-96 overflow-y-auto rounded-2xl">
                {filtered.length ? (
                  viewMode === 'list' ? (
                    <div className="divide-y divide-border-color">
                      {filtered.map((entry, index) => {
                        const isActive = hoveredIndex === index;
                        return (
                          <button
                            key={`${entry.emoji}-${entry.shortcode}`}
                            id={`emoji-option-${index}`}
                            type="button"
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                              isActive ? 'bg-primary/10 shadow-sm' : 'hover:bg-primary/5'
                            }`}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onFocus={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                            onClick={() => handleSelect(entry)}
                          >
                            <span className="text-2xl" aria-hidden>
                              {entry.emoji}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-main truncate">{entry.description}</p>
                              <p className="text-xs text-text-secondary truncate">
                                :{entry.shortcode}: · {entry.keywords.slice(0, 6).join(', ')}
                              </p>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Enter ↵</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className={`${
                        viewMode === 'compact'
                          ? 'grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1 p-2'
                          : 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-3'
                      }`}
                    >
                      {filtered.map((entry, index) => {
                        const isActive = hoveredIndex === index;
                        return (
                          <button
                            key={`${entry.emoji}-${entry.shortcode}`}
                            id={`emoji-option-${index}`}
                            type="button"
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border bg-background/80 px-2 py-3 text-center transition ${
                              isActive
                                ? 'border-primary/50 bg-primary/15 shadow-sm'
                                : 'border-transparent hover:border-primary/30 hover:bg-primary/5'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onFocus={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                            onClick={() => handleSelect(entry)}
                          >
                            <span
                              className={`${viewMode === 'compact' ? 'text-xl' : 'text-2xl'} leading-none`}
                              aria-hidden
                            >
                              {entry.emoji}
                            </span>
                            <span
                              className={`${
                                viewMode === 'compact' ? 'text-[10px]' : 'text-[11px]'
                              } font-medium text-text-secondary truncate w-full`}
                              title={entry.description}
                            >
                              {entry.description}
                            </span>
                            <span className="text-[10px] text-text-tertiary truncate w-full">
                              :{entry.shortcode}:
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-text-secondary">
                    <span className="text-5xl" aria-hidden>
                      😕
                    </span>
                    <p className="text-sm font-medium">No emojis match “{search}”.</p>
                    <p className="text-xs text-text-tertiary">
                      Try broadening your description or switching categories.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-text-tertiary">
              {visibleCount.toLocaleString()} emoji{visibleCount === 1 ? '' : 's'} in “{activeCategory?.label ?? 'All Emojis'}”
              {normalizedSearch ? ' matching your search.' : '.'}
            </p>
          </div>

          <aside className="flex flex-col gap-3 rounded-2xl border border-border-color bg-gradient-to-br from-primary/10 via-primary/0 to-primary/5 p-5 shadow-sm">
            <div className="flex flex-col items-center text-center gap-2">
              <span className="text-5xl leading-none" aria-hidden>
                {previewEntry?.emoji ?? '✨'}
              </span>
              <p className="text-xs uppercase tracking-wide text-text-tertiary">
                {activeCategory?.label ?? 'All Emojis'}
              </p>
              <p className="text-lg font-semibold text-text-main">
                {previewEntry ? previewEntry.description : 'No emoji selected'}
              </p>
              <p className="text-xs text-text-secondary">
                {previewEntry ? `:${previewEntry.shortcode}:` : 'Adjust your search or pick another category to keep exploring.'}
              </p>
            </div>
            {categoryDescription && (
              <p className="text-[11px] text-text-tertiary text-center">{categoryDescription}</p>
            )}
            <div className="flex flex-wrap justify-center gap-1">
              {(previewEntry?.keywords ?? ['discover', 'create', 'express'])
                .slice(0, 8)
                .map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary"
                  >
                    {keyword}
                  </span>
                ))}
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-text-tertiary">
              <span>{activeViewMode.label} view</span>
              <span>{visibleCount.toLocaleString()} match{visibleCount === 1 ? '' : 'es'}</span>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
};

export default EmojiPickerDialog;

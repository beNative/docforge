import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import {
  CONTEXT_SUGGESTIONS,
  EMOJI_CATEGORIES,
  EMOJI_DEFINITIONS,
  EMOJI_FILTERS,
  EmojiCategoryId,
  EmojiDefinition,
  EmojiFilter,
} from '../assets/emojiData';

interface EmojiPickerDialogProps {
  isOpen: boolean;
  context: 'title' | 'content';
  onClose: () => void;
  onSelect: (emoji: EmojiDefinition) => void;
}

type PickerCategory = 'all' | EmojiCategoryId;

type RankedEmoji = {
  emoji: EmojiDefinition;
  score: number;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EmojiPickerDialog: React.FC<EmojiPickerDialogProps> = ({ isOpen, context, onClose, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PickerCategory>('all');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [hoveredEmoji, setHoveredEmoji] = useState<EmojiDefinition | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(timer);
    }

    setSearchQuery('');
    setSelectedCategory('all');
    setActiveFilterIds([]);
    setHoveredEmoji(null);
    return undefined;
  }, [isOpen]);

  const searchTokens = useMemo(
    () =>
      searchQuery
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean),
    [searchQuery]
  );

  const activeFilters = useMemo(
    () =>
      activeFilterIds
        .map((id) => EMOJI_FILTERS.find((filter) => filter.id === id))
        .filter(Boolean) as EmojiFilter[],
    [activeFilterIds]
  );

  const rankedEmojis = useMemo(() => {
    const tokens = searchTokens;

    return EMOJI_DEFINITIONS.filter((emoji) => {
      if (selectedCategory !== 'all' && emoji.category !== selectedCategory) {
        return false;
      }

      const name = emoji.name.toLowerCase();
      const description = emoji.description.toLowerCase();
      const keywords = emoji.keywords.map((keyword) => keyword.toLowerCase());
      const clusters = (emoji.clusters || []).map((cluster) => cluster.toLowerCase());

      const matchesTokens =
        tokens.length === 0 ||
        tokens.every((token) =>
          name.includes(token) ||
          description.includes(token) ||
          keywords.some((keyword) => keyword.includes(token)) ||
          clusters.some((cluster) => cluster.includes(token))
        );

      if (!matchesTokens) {
        return false;
      }

      if (activeFilters.length === 0) {
        return true;
      }

      return activeFilters.every((filter) => {
        const matchesTone = filter.tone ? emoji.tone === filter.tone : false;
        const matchesKeyword = filter.keywords.some((keyword) => {
          const normalizedKeyword = keyword.toLowerCase();
          return (
            name.includes(normalizedKeyword) ||
            description.includes(normalizedKeyword) ||
            keywords.some((kw) => kw.includes(normalizedKeyword))
          );
        });
        return matchesTone || matchesKeyword;
      });
    })
      .map<RankedEmoji>((emoji) => {
        const name = emoji.name.toLowerCase();
        const description = emoji.description.toLowerCase();
        const keywords = emoji.keywords.map((keyword) => keyword.toLowerCase());
        const clusters = (emoji.clusters || []).map((cluster) => cluster.toLowerCase());

        let score = 1;
        if (emoji.contexts?.includes(context)) {
          score += 8;
        }

        tokens.forEach((token) => {
          if (name.includes(token)) {
            score += 6;
          }
          if (keywords.some((keyword) => keyword.includes(token))) {
            score += 5;
          }
          if (description.includes(token)) {
            score += 3;
          }
          if (clusters.some((cluster) => cluster.includes(token))) {
            score += 2;
          }
        });

        activeFilters.forEach((filter) => {
          if (filter.tone && emoji.tone === filter.tone) {
            score += 3;
          }
          if (
            filter.keywords.some((keyword) => {
              const normalizedKeyword = keyword.toLowerCase();
              return (
                name.includes(normalizedKeyword) ||
                description.includes(normalizedKeyword) ||
                keywords.some((kw) => kw.includes(normalizedKeyword))
              );
            })
          ) {
            score += 2;
          }
        });

        if (tokens.length === 0 && emoji.contexts?.includes(context)) {
          score += 2;
        }

        return { emoji, score };
      })
      .sort((a, b) => {
        if (b.score === a.score) {
          return a.emoji.name.localeCompare(b.emoji.name);
        }
        return b.score - a.score;
      });
  }, [activeFilters, context, searchTokens, selectedCategory]);

  const groupedByCategory = useMemo(() => {
    return rankedEmojis.reduce<Record<EmojiCategoryId, EmojiDefinition[]>>((acc, item) => {
      const { category } = item.emoji;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item.emoji);
      return acc;
    }, {} as Record<EmojiCategoryId, EmojiDefinition[]>);
  }, [rankedEmojis]);

  const dynamicSuggestions = useMemo(() => {
    if (searchTokens.length === 0) {
      return [];
    }

    return rankedEmojis.slice(0, 6).map((item) => item.emoji);
  }, [rankedEmojis, searchTokens]);

  const ambientSuggestions = useMemo(() => {
    if (searchTokens.length > 0) {
      return [];
    }

    return rankedEmojis
      .filter((item) => item.emoji.contexts?.includes(context))
      .slice(0, 4)
      .map((item) => item.emoji);
  }, [context, rankedEmojis, searchTokens]);

  const highlightText = (text: string) => {
    if (searchTokens.length === 0) {
      return text;
    }

    const regex = new RegExp(`(${searchTokens.map(escapeRegExp).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={`${part}-${index}`} className="rounded px-0.5 bg-primary/30 text-primary">
          {part}
        </mark>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      )
    );
  };

  const toggleFilter = (id: string) => {
    setActiveFilterIds((prev) => (prev.includes(id) ? prev.filter((filterId) => filterId !== id) : [...prev, id]));
  };

  const handleSuggestionClick = (keywords: string[]) => {
    setSearchQuery(keywords.join(' '));
  };

  const categoriesToRender = selectedCategory === 'all'
    ? EMOJI_CATEGORIES
    : EMOJI_CATEGORIES.filter((category) => category.id === selectedCategory);

  const quickPicks = dynamicSuggestions.length > 0 ? dynamicSuggestions : ambientSuggestions;

  if (!isOpen) {
    return null;
  }

  return (
    <Modal title="Choose an emoji" onClose={onClose} size="3xl" initialFocusRef={searchInputRef}>
      <div className="p-5 space-y-5 text-text-main">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by mood, action, or keyword (e.g. smile, launch, calm)"
                className="w-full rounded-md border border-border-color bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-2 flex items-center text-xs text-text-secondary hover:text-text-main"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {EMOJI_FILTERS.map((filter) => {
                const isActive = activeFilterIds.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => toggleFilter(filter.id)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 transition-all duration-150 ${
                      isActive
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border-color bg-secondary text-text-secondary hover:border-primary/70 hover:text-text-main'
                    }`}
                  >
                    <span aria-hidden className="text-sm">
                      {filter.icon}
                    </span>
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {CONTEXT_SUGGESTIONS[context].map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => handleSuggestionClick(suggestion.keywords)}
                className="flex items-center gap-1 rounded-full border border-transparent bg-primary/5 px-3 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <span aria-hidden>{suggestion.icon}</span>
                {suggestion.label}
              </button>
            ))}
            {quickPicks.map((emoji) => (
              <button
                key={`quick-${emoji.symbol}-${emoji.name}`}
                type="button"
                onClick={() => onSelect(emoji)}
                className="flex items-center gap-1 rounded-full border border-border-color bg-secondary px-3 py-1 text-text-secondary transition hover:border-primary hover:text-text-main"
              >
                <span aria-hidden className="text-base">{emoji.symbol}</span>
                <span className="font-medium">{emoji.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-wrap gap-2 lg:w-48 lg:flex-col lg:gap-3">
            <Button
              type="button"
              variant={selectedCategory === 'all' ? 'primary' : 'secondary'}
              className="whitespace-nowrap"
              onClick={() => setSelectedCategory('all')}
            >
              🌈 All moods
            </Button>
            {EMOJI_CATEGORIES.map((category) => {
              const isActive = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-all duration-150 ${
                    isActive
                      ? 'border-transparent bg-gradient-to-r from-primary/70 via-primary/40 to-primary/70 text-primary-text shadow'
                      : 'border-border-color bg-secondary text-text-secondary hover:border-primary/50 hover:text-text-main'
                  }`}
                >
                  <div className="font-semibold">{category.label}</div>
                  <div className="text-xs opacity-70">{category.description}</div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-4">
            <div className="rounded-lg border border-border-color bg-secondary/70 p-4">
              {hoveredEmoji ? (
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background text-4xl shadow-inner">
                    <span aria-hidden>{hoveredEmoji.symbol}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-text-main">{hoveredEmoji.name}</div>
                    <div className="text-xs text-text-secondary">{hoveredEmoji.description}</div>
                    <div className="flex flex-wrap gap-1 pt-1 text-[10px] uppercase tracking-wide text-text-secondary/80">
                      {(hoveredEmoji.clusters || []).map((cluster) => (
                        <span key={cluster} className="rounded-full bg-background px-2 py-0.5">
                          #{cluster}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-text-secondary">
                  Hover over an emoji to preview its story and vibe. Use filters and search to discover the perfect match.
                </div>
              )}
            </div>

            <div className="max-h-[26rem] space-y-6 overflow-y-auto pr-1">
              {categoriesToRender.map((category) => {
                const emojis = groupedByCategory[category.id] || [];
                if (emojis.length === 0) {
                  return null;
                }

                return (
                  <section key={category.id} aria-label={category.label} className="space-y-3">
                    <header className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-main">{category.label}</h3>
                        <p className="text-xs text-text-secondary">{category.description}</p>
                      </div>
                      <div className={`hidden rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-text lg:block ${category.accent}`}>
                        {category.id}
                      </div>
                    </header>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                      {emojis.map((emoji) => (
                        <button
                          key={`${category.id}-${emoji.symbol}-${emoji.name}`}
                          type="button"
                          onClick={() => onSelect(emoji)}
                          onMouseEnter={() => setHoveredEmoji(emoji)}
                          onFocus={() => setHoveredEmoji(emoji)}
                          onMouseLeave={() => setHoveredEmoji(null)}
                          onBlur={() => setHoveredEmoji(null)}
                          className="group flex flex-col items-start gap-1 rounded-lg border border-border-color bg-background/80 px-3 py-2 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-2xl drop-shadow-sm" aria-hidden>
                              {emoji.symbol}
                            </span>
                            {emoji.contexts?.includes(context) && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                {context === 'title' ? 'Title friendly' : 'Text ready'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-text-main">
                            {highlightText(emoji.name)}
                          </div>
                          <div className="text-xs text-text-secondary h-10 overflow-hidden leading-relaxed">
                            {highlightText(emoji.description)}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-text-secondary/80">
                            {emoji.keywords.slice(0, 4).map((keyword) => (
                              <span key={keyword} className="rounded-full bg-secondary px-2 py-0.5">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}

              {rankedEmojis.length === 0 && (
                <div className="rounded-lg border border-dashed border-border-color bg-secondary/60 p-8 text-center text-sm text-text-secondary">
                  No emojis match your filters just yet. Try a different keyword, category, or mood.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EmojiPickerDialog;

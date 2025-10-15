import React, { useMemo, useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { EMOJI_ENTRIES, EmojiEntry } from '../constants/emojiList';
import IconButton from './IconButton';
import { RefreshIcon } from './Icons';

interface EmojiPickerDialogProps {
  onClose: () => void;
  onSelect: (emoji: EmojiEntry) => void;
  onRequestRandom?: () => void;
}

const normalize = (value: string) => value.normalize('NFKD').toLowerCase();

const EmojiPickerDialog: React.FC<EmojiPickerDialogProps> = ({ onClose, onSelect, onRequestRandom }) => {
  const [search, setSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) {
      return EMOJI_ENTRIES;
    }
    return EMOJI_ENTRIES.filter((entry) => {
      const haystack = `${entry.description} ${entry.shortcode} ${entry.keywords.join(' ')}`;
      return normalize(haystack).includes(term);
    });
  }, [search]);

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

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!filtered.length) return;
    const columns = 8;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        const next = prev === null ? 0 : (prev + 1) % filtered.length;
        return next;
      });
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        if (prev === null) return filtered.length - 1;
        return (prev - 1 + filtered.length) % filtered.length;
      });
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        if (prev === null) return 0;
        return Math.min(prev + columns, filtered.length - 1);
      });
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHoveredIndex((prev) => {
        if (prev === null) return filtered.length - 1;
        return Math.max(prev - columns, 0);
      });
    }
    if (event.key === 'Enter' && hoveredIndex !== null) {
      event.preventDefault();
      onSelect(filtered[hoveredIndex]);
    }
  };

  useEffect(() => {
    if (hoveredIndex === null || typeof document === 'undefined') return;
    const target = document.getElementById(`emoji-option-${hoveredIndex}`);
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [hoveredIndex]);

  return (
    <Modal onClose={onClose} title="Choose an Emoji" initialFocusRef={searchInputRef}>
      <div className="p-4 flex flex-col gap-4" onKeyDown={handleKeyDown}>
        <div className="flex flex-col gap-1">
          <label htmlFor="emoji-search" className="text-xs font-medium text-text-secondary">
            Search by description, keyword, or shortcode
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={searchInputRef}
              id="emoji-search"
              type="text"
              className="flex-1 rounded-md border border-border-color bg-background px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Try typing 'rocket', ':smile:', or 'party'"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {onRequestRandom && (
              <IconButton
                onClick={onRequestRandom}
                tooltip="Surprise me"
                size="sm"
                variant="ghost"
              >
                <RefreshIcon className="w-4 h-4" />
              </IconButton>
            )}
          </div>
          <p className="text-[11px] text-text-tertiary">
            {visibleCount.toLocaleString()} emoji{visibleCount === 1 ? '' : 's'} available
          </p>
        </div>
        <div className="relative border border-border-color rounded-lg">
          <div className="max-h-96 overflow-y-auto">
            {filtered.length ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-2">
                {filtered.map((entry, index) => (
                  <button
                    key={`${entry.emoji}-${entry.shortcode}`}
                    id={`emoji-option-${index}`}
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-md border border-transparent bg-background px-2 py-3 transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${hoveredIndex === index ? 'border-primary bg-primary/10' : ''}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onFocus={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                    onClick={() => onSelect(entry)}
                  >
                    <span className="text-2xl" aria-hidden>
                      {entry.emoji}
                    </span>
                    <span className="text-[11px] font-medium text-text-secondary truncate w-full text-center" title={entry.description}>
                      {entry.description}
                    </span>
                    <span className="text-[10px] text-text-tertiary truncate w-full text-center">
                      :{entry.shortcode}:
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <span className="text-4xl">😕</span>
                <p className="text-sm text-text-secondary">
                  No emojis match "{search}". Try a different description.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EmojiPickerDialog;

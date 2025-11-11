import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from '../hooks/useTheme';

interface EmojiPickerOverlayProps {
  isOpen: boolean;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  ariaLabel?: string;
}

const EDGE_MARGIN = 8;

const EmojiPickerOverlay: React.FC<EmojiPickerOverlayProps> = ({
  isOpen,
  anchor,
  onClose,
  onSelectEmoji,
  ariaLabel,
}) => {
  const { theme } = useTheme();
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const themeSetting = useMemo(() => (theme === 'dark' ? Theme.DARK : Theme.LIGHT), [theme]);

  useLayoutEffect(() => {
    if (!isOpen || !anchor) return;
    setPosition({ top: anchor.y, left: anchor.x });
  }, [isOpen, anchor?.x, anchor?.y]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const container = pickerContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      let { top, left } = rect;

      if (rect.right > innerWidth - EDGE_MARGIN) {
        left = Math.max(EDGE_MARGIN, innerWidth - rect.width - EDGE_MARGIN);
      }
      if (rect.bottom > innerHeight - EDGE_MARGIN) {
        top = Math.max(EDGE_MARGIN, innerHeight - rect.height - EDGE_MARGIN);
      }
      if (rect.left < EDGE_MARGIN) {
        left = EDGE_MARGIN;
      }
      if (rect.top < EDGE_MARGIN) {
        top = EDGE_MARGIN;
      }

      setPosition((previous) => {
        if (previous.top === top && previous.left === left) {
          return previous;
        }
        return { top, left };
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, anchor?.x, anchor?.y]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (pickerContainerRef.current && !pickerContainerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      if (anchor) {
        setPosition({ top: anchor.y, left: anchor.x });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, anchor]);

  if (!isOpen) return null;

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  return ReactDOM.createPortal(
    <div
      ref={pickerContainerRef}
      className="fixed z-[100] rounded-lg border border-border-color bg-secondary shadow-2xl"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? 'Emoji picker'}
    >
      <EmojiPicker
        theme={themeSetting}
        onEmojiClick={(emojiData: EmojiClickData) => {
          onSelectEmoji(emojiData.emoji);
          onClose();
        }}
        lazyLoadEmojis
        autoFocusSearch={false}
      />
    </div>,
    overlayRoot
  );
};

export default EmojiPickerOverlay;

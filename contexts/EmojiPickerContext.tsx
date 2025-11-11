import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import EmojiPicker from '../components/EmojiPicker';

interface EmojiPickerOptions {
  anchor: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

interface EmojiPickerContextValue {
  openEmojiPicker: (options: EmojiPickerOptions) => void;
  closeEmojiPicker: () => void;
}

const EmojiPickerContext = createContext<EmojiPickerContextValue | undefined>(undefined);
const FALLBACK_CONTEXT: EmojiPickerContextValue = {
  openEmojiPicker: () => undefined,
  closeEmojiPicker: () => undefined,
};

export const EmojiPickerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<EmojiPickerOptions | null>(null);

  const handleClose = useCallback(() => {
    setOptions((current) => {
      current?.onClose?.();
      return null;
    });
  }, []);

  const handleSelect = useCallback((emoji: string) => {
    setOptions((current) => {
      current?.onSelect(emoji);
      return null;
    });
  }, []);

  const value = useMemo<EmojiPickerContextValue>(() => ({
    openEmojiPicker: (next) => setOptions(next),
    closeEmojiPicker: handleClose,
  }), [handleClose]);

  return (
    <EmojiPickerContext.Provider value={value}>
      {children}
      {options && (
        <EmojiPicker
          anchor={options.anchor}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </EmojiPickerContext.Provider>
  );
};

export const useEmojiPickerContext = (): EmojiPickerContextValue => {
  const context = useContext(EmojiPickerContext);
  if (!context) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('useEmojiPickerContext was used outside of an EmojiPickerProvider. Falling back to a no-op implementation.');
    }
    return FALLBACK_CONTEXT;
  }
  return context;
};

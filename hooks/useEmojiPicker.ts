import { useEmojiPickerContext } from '../contexts/EmojiPickerContext';

export const useEmojiPicker = () => {
  return useEmojiPickerContext();
};

export type { EmojiPickerContextValue } from '../contexts/EmojiPickerContext';

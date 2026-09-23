import { useContext } from 'react';
import { IconContext } from '../contexts/IconContext';

const DEFAULT_ICON_CONTEXT = { iconSet: 'heroicons' as const };

export const useIconSet = () => {
  const context = useContext(IconContext);
  return context ?? DEFAULT_ICON_CONTEXT;
};
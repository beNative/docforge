import { useContext } from 'react';
import { IconContext } from '../contexts/IconContext';

export const useIconSet = () => {
  const context = useContext(IconContext);
  if (context === undefined) {
    throw new Error('useIconSet must be used within an IconProvider');
  }
  return context;
};
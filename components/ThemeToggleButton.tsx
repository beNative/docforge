import React from 'react';
import { useTheme } from '../hooks/useTheme';
import IconButton from './IconButton';
import { SunIcon, MoonIcon } from './Icons';

interface ThemeToggleButtonProps {
  size?: 'xs' | 'sm' | 'md';
  tooltipPosition?: 'top' | 'bottom';
  className?: string;
}

const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ size = 'md', tooltipPosition = 'bottom', className }) => {
  const { theme, toggleTheme } = useTheme();
  const iconClassName = size === 'xs' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <IconButton
      onClick={toggleTheme}
      tooltip={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      tooltipPosition={tooltipPosition}
      size={size}
      className={className}
    >
      {theme === 'light' ? <MoonIcon className={iconClassName} /> : <SunIcon className={iconClassName} />}
    </IconButton>
  );
};

export default ThemeToggleButton;
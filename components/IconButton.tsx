import React, { useState, useRef, useCallback } from 'react';
import Tooltip from './Tooltip';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  tooltip?: string;
  variant?: 'primary' | 'ghost' | 'destructive';
  size?: 'xs' | 'sm' | 'md';
  tooltipPosition?: 'top' | 'bottom';
}

const IconButton: React.FC<IconButtonProps> = ({ children, tooltip, className, variant = 'primary', size = 'md', tooltipPosition = 'top', ...props }) => {
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const { ['aria-label']: ariaLabel, ...buttonProps } = props;
  const computedAriaLabel = ariaLabel ?? tooltip;

  const handleMouseEnter = useCallback(() => {
    if (tooltip) setIsHovered(true);
  }, [tooltip]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const baseClasses = "flex items-center justify-center rounded-sm focus:outline-none transition-colors duration-100";

  const variantClasses = {
    primary: 'text-text-secondary hover:text-text-main hover:bg-border-color/30',
    ghost: 'text-text-secondary hover:text-text-main',
    destructive: 'text-destructive-text bg-transparent hover:bg-destructive-bg/50'
  };

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-7 h-7',
    md: 'w-8 h-8'
  };

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        <button
          className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
          aria-label={computedAriaLabel}
          {...buttonProps}
        >
          {children}
        </button>
      </span>
      {isHovered && (
        <Tooltip targetRef={wrapperRef} content={tooltip} position={tooltipPosition} />
      )}
    </>
  );
};

export default IconButton;
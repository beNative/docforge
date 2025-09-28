import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  tooltip: string;
  variant?: 'primary' | 'ghost' | 'destructive';
  size?: 'xs' | 'sm' | 'md';
  tooltipPosition?: 'top' | 'bottom';
}

const Tooltip: React.FC<{
  targetRef: React.RefObject<HTMLElement>;
  tooltip: string;
  position: 'top' | 'bottom';
}> = ({ targetRef, tooltip, position }) => {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const calculatePosition = useCallback(() => {
    if (targetRef.current && tooltipRef.current && targetRef.current.offsetWidth > 0) {
      const zoomFactor = parseFloat((getComputedStyle(document.documentElement) as any).zoom || '1');
      const targetEl = targetRef.current;
      const tooltipEl = tooltipRef.current;
      
      const scaledTargetRect = targetEl.getBoundingClientRect();
      
      const targetRect = {
        top: scaledTargetRect.top / zoomFactor,
        left: scaledTargetRect.left / zoomFactor,
        bottom: scaledTargetRect.bottom / zoomFactor,
        width: targetEl.offsetWidth, // Use offsetWidth for reliable layout width
        height: targetEl.offsetHeight, // Use offsetHeight for reliable layout height
      };
      
      const tooltipRect = {
          width: tooltipEl.offsetWidth,
          height: tooltipEl.offsetHeight,
      };

      const { innerWidth, innerHeight } = window; // Already in layout pixels
      const margin = 4;

      let top, left;

      // Vertical position logic (in layout pixels)
      const spaceAbove = targetRect.top;
      const spaceBelow = innerHeight - targetRect.bottom;

      if (position === 'bottom') {
        if (spaceBelow > tooltipRect.height + margin || spaceAbove < tooltipRect.height + margin) {
          top = targetRect.bottom + margin;
        } else {
          top = targetRect.top - tooltipRect.height - margin;
        }
      } else { // 'top'
        if (spaceAbove > tooltipRect.height + margin || spaceBelow < tooltipRect.height + margin) {
          top = targetRect.top - tooltipRect.height - margin;
        } else {
          top = targetRect.bottom + margin;
        }
      }
      
      // Horizontal position and clamping logic (in layout pixels)
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      
      if (left < margin) left = margin;
      if (left + tooltipRect.width > innerWidth - margin) left = innerWidth - tooltipRect.width - margin;
      if (top < margin) top = margin;
      if (top + tooltipRect.height > innerHeight - margin) top = innerHeight - tooltipRect.height - margin;
      
      // Set the final style using layout pixel values. The browser's zoom will render it correctly.
      setStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        opacity: 1,
      });
    }
  }, [targetRef, position]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    document.addEventListener('scroll', calculatePosition, true);
    return () => {
      window.removeEventListener('resize', calculatePosition);
      document.removeEventListener('scroll', calculatePosition, true);
    };
  }, [calculatePosition]);
  
  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) return null;

  return ReactDOM.createPortal(
    <span
      ref={tooltipRef}
      style={style}
      className="fixed z-50 w-max px-2 py-1 text-xs font-semibold text-tooltip-text bg-tooltip-bg rounded-md transition-opacity duration-200 pointer-events-none"
    >
      {tooltip}
    </span>,
    overlayRoot
  );
};


const IconButton: React.FC<IconButtonProps> = ({ children, tooltip, className, variant = 'primary', size='md', tooltipPosition = 'top', ...props }) => {
    const [isHovered, setIsHovered] = useState(false);
    const wrapperRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = useCallback(() => {
        if (tooltip) setIsHovered(true);
    }, [tooltip]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
    }, []);

    const baseClasses = "flex items-center justify-center rounded-md focus:outline-none transition-colors";
  
    const variantClasses = {
      primary: 'text-text-secondary hover:bg-border-color hover:text-text-main',
      ghost: 'text-text-secondary/80 hover:bg-border-color hover:text-text-main',
      destructive: 'text-destructive-text bg-transparent hover:bg-destructive-bg'
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
          {...props}
        >
          {children}
        </button>
      </span>
      {isHovered && <Tooltip targetRef={wrapperRef} tooltip={tooltip} position={tooltipPosition} />}
    </>
  );
};

export default IconButton;
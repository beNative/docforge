import React, { useState, useRef, useImperativeHandle } from 'react';
import Tooltip, { TooltipPosition } from './Tooltip';

export interface HintProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipPosition?: TooltipPosition;
}

const Hint = React.forwardRef<HTMLSpanElement, HintProps>(
  ({ icon, children, tooltip, tooltipPosition = 'top', className = '', onMouseEnter, onMouseLeave, ...rest }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const internalRef = useRef<HTMLSpanElement>(null);
    
    useImperativeHandle(ref, () => internalRef.current!);

    const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLSpanElement>) => {
      setIsHovered(false);
      onMouseLeave?.(e);
    };

    return (
      <>
        <span
          ref={internalRef}
          className={`inline-flex items-center gap-1 rounded-full bg-border-color/50 px-2 py-0.5 text-[11px] font-medium text-text-secondary ${className}`.trim()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          {...rest}
        >
          {icon && <span aria-hidden="true" className="flex items-center">{icon}</span>}
          <span className="leading-none">{children}</span>
        </span>
        {tooltip && isHovered && internalRef.current && (
          <Tooltip targetRef={internalRef} content={tooltip} position={tooltipPosition} />
        )}
      </>
    );
  }
);

Hint.displayName = 'Hint';

export default Hint;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export type TooltipPosition = 'top' | 'bottom';

interface TooltipProps {
  targetRef: React.RefObject<Element>;
  content: React.ReactNode;
  position?: TooltipPosition;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ targetRef, content, position = 'top', className }) => {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const calculatePosition = useCallback(() => {
    if (!targetRef.current || !tooltipRef.current || targetRef.current.offsetWidth <= 0) {
      return;
    }

    const zoomFactor = parseFloat((getComputedStyle(document.documentElement) as any).zoom || '1');
    const targetEl = targetRef.current;
    const tooltipEl = tooltipRef.current;

    const scaledTargetRect = targetEl.getBoundingClientRect();

    const targetRect = {
      top: scaledTargetRect.top / zoomFactor,
      left: scaledTargetRect.left / zoomFactor,
      bottom: scaledTargetRect.bottom / zoomFactor,
      width: targetEl.offsetWidth,
      height: targetEl.offsetHeight,
    };

    const tooltipRect = {
      width: tooltipEl.offsetWidth,
      height: tooltipEl.offsetHeight,
    };

    const { innerWidth, innerHeight } = window;
    const margin = 4;

    let top: number;
    let left: number;

    const spaceAbove = targetRect.top;
    const spaceBelow = innerHeight - targetRect.bottom;

    if (position === 'bottom') {
      if (spaceBelow > tooltipRect.height + margin || spaceAbove < tooltipRect.height + margin) {
        top = targetRect.bottom + margin;
      } else {
        top = targetRect.top - tooltipRect.height - margin;
      }
    } else {
      if (spaceAbove > tooltipRect.height + margin || spaceBelow < tooltipRect.height + margin) {
        top = targetRect.top - tooltipRect.height - margin;
      } else {
        top = targetRect.bottom + margin;
      }
    }

    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

    if (left < margin) left = margin;
    if (left + tooltipRect.width > innerWidth - margin) left = innerWidth - tooltipRect.width - margin;
    if (top < margin) top = margin;
    if (top + tooltipRect.height > innerHeight - margin) top = innerHeight - tooltipRect.height - margin;

    setStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      opacity: 1,
    });
  }, [position, targetRef]);

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

  const baseClassName = 'fixed z-50 w-max px-2 py-1 text-xs font-semibold text-tooltip-text bg-tooltip-bg rounded-md shadow-lg transition-opacity duration-200 pointer-events-none';
  const composedClassName = className ? `${baseClassName} ${className}` : `${baseClassName} max-w-xs`;

  return ReactDOM.createPortal(
    <span ref={tooltipRef} style={style} className={composedClassName}>
      {content}
    </span>,
    overlayRoot,
  );
};

export default Tooltip;

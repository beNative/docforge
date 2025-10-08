import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import IconButton from './IconButton';
import { MinusIcon, PlusIcon, RefreshIcon } from './Icons';

interface ZoomPanContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  overlay?: React.ReactNode;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  zoomStep?: number;
  disableControls?: boolean;
  disablePan?: boolean;
  disableZoom?: boolean;
  contentClassName?: string;
  wrapperClassName?: string;
  layout?: 'overlay' | 'natural';
  lockOverflow?: boolean;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const normalizeWheelDelta = (event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>, target: HTMLElement | null) => {
  const lineHeight = 16;
  const pageHeight = target?.clientHeight || 800;
  const scale = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageHeight : 1;
  return {
    deltaX: event.deltaX * scale,
    deltaY: event.deltaY * scale,
  };
};

const ZoomPanContainer = React.forwardRef<HTMLDivElement, ZoomPanContainerProps>((props, ref) => {
  const {
    children,
    overlay,
    className,
    contentClassName,
    wrapperClassName,
    minScale = 0.25,
    maxScale = 5,
    initialScale = 1,
    zoomStep = 0.25,
    disableControls = false,
    disablePan = false,
    disableZoom = false,
    layout = 'overlay',
    lockOverflow = true,
    ...rest
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => containerRef.current);

  const [scale, setScaleState] = useState(initialScale);
  const [offset, setOffsetState] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const panPointer = useRef<{ id: number | null; lastX: number; lastY: number }>({ id: null, lastX: 0, lastY: 0 });

  const setScale = useCallback((next: number) => {
    const clamped = clamp(next, minScale, maxScale);
    scaleRef.current = clamped;
    setScaleState(clamped);
  }, [maxScale, minScale]);

  const setOffset = useCallback((next: React.SetStateAction<{ x: number; y: number }>) => {
    setOffsetState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      offsetRef.current = resolved;
      return resolved;
    });
  }, []);

  const handleWheelEvent = useCallback((event: WheelEvent) => {
    if (disablePan && disableZoom) {
      return;
    }

    const target = containerRef.current;

    if (!disableZoom && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const { deltaY } = normalizeWheelDelta(event, target);
      if (deltaY === 0) {
        return;
      }
      const direction = deltaY > 0 ? -1 : 1;
      const magnitude = Math.min(Math.abs(deltaY) / 300, 1.5);
      const factor = 1 + zoomStep * magnitude;
      const nextScale = direction > 0
        ? scaleRef.current * factor
        : scaleRef.current / factor;
      setScale(nextScale);
      return;
    }

    if (!disablePan) {
      event.preventDefault();
      const { deltaX, deltaY } = normalizeWheelDelta(event, target);
      const scale = scaleRef.current || 1;
      setOffset((prev) => ({
        x: prev.x - deltaX / scale,
        y: prev.y - deltaY / scale,
      }));
    }
  }, [disablePan, disableZoom, setOffset, setScale, zoomStep]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const wheelListener = (event: WheelEvent) => {
      handleWheelEvent(event);
    };

    node.addEventListener('wheel', wheelListener, { passive: false });

    return () => {
      node.removeEventListener('wheel', wheelListener);
    };
  }, [handleWheelEvent]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disablePan) {
      return;
    }

    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.setPointerCapture(event.pointerId);
    panPointer.current = { id: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    setIsPanning(true);
  }, [disablePan]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disablePan) {
      return;
    }

    if (panPointer.current.id !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const dx = event.clientX - panPointer.current.lastX;
    const dy = event.clientY - panPointer.current.lastY;
    panPointer.current = { id: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    const scale = scaleRef.current || 1;
    setOffset((prev) => ({ x: prev.x + dx / scale, y: prev.y + dy / scale }));
  }, [disablePan, setOffset]);

  const endPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panPointer.current.id !== event.pointerId) {
      return;
    }

    const node = containerRef.current;
    if (node && node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    panPointer.current = { id: null, lastX: 0, lastY: 0 };
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (disableZoom) {
      return;
    }
    event.preventDefault();
    const isZoomOut = event.shiftKey || event.altKey || event.button === 1;
    const factor = 1 + zoomStep;
    setScale(isZoomOut ? scaleRef.current / factor : scaleRef.current * factor);
  }, [disableZoom, setScale, zoomStep]);

  const handleResetView = useCallback(() => {
    setScale(initialScale);
    setOffset({ x: 0, y: 0 });
  }, [initialScale, setOffset, setScale]);

  const transformStyle = useMemo(() => {
    return { transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` };
  }, [offset.x, offset.y, scale]);

  const containerClasses = useMemo(() => {
    const classes = ['relative', 'bg-secondary'];
    if (lockOverflow) {
      classes.push('overflow-hidden');
    }
    if (!disablePan) {
      classes.push('touch-none');
      classes.push(isPanning ? 'cursor-grabbing' : 'cursor-grab');
    }
    if (className) {
      classes.push(className);
    }
    return classes.join(' ');
  }, [className, disablePan, isPanning, lockOverflow]);

  const renderContent = useCallback(() => {
    const content = (
      <div className={`transform-gpu origin-center ${contentClassName ?? ''}`} style={transformStyle}>
        {children}
      </div>
    );

    if (layout === 'natural') {
      if (wrapperClassName) {
        return <div className={wrapperClassName}>{content}</div>;
      }
      return content;
    }

    return (
      <div className={`absolute inset-0 flex items-center justify-center ${wrapperClassName ?? ''}`}>
        {content}
      </div>
    );
  }, [children, contentClassName, layout, transformStyle, wrapperClassName]);

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerCancel={endPan}
      onDoubleClick={handleDoubleClick}
      {...rest}
    >
      {renderContent()}
      {!disableControls && !disableZoom && (
        <div
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-border-color bg-background/80 px-2 py-1 shadow-lg backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
        >
          <IconButton
            tooltip="Zoom out"
            variant="ghost"
            size="sm"
            onClick={() => setScale(scaleRef.current / (1 + zoomStep))}
            className="text-text-secondary"
          >
            <MinusIcon className="w-4 h-4" />
          </IconButton>
          <span className="min-w-[3rem] text-center text-xs font-medium text-text-secondary">
            {Math.round(scale * 100)}%
          </span>
          <IconButton
            tooltip="Zoom in"
            variant="ghost"
            size="sm"
            onClick={() => setScale(scaleRef.current * (1 + zoomStep))}
            className="text-text-secondary"
          >
            <PlusIcon className="w-4 h-4" />
          </IconButton>
          <IconButton
            tooltip="Reset view"
            variant="ghost"
            size="sm"
            onClick={handleResetView}
            className="text-text-secondary"
          >
            <RefreshIcon className="w-4 h-4" />
          </IconButton>
        </div>
      )}
      {overlay && (
        <div className="pointer-events-none">
          {overlay}
        </div>
      )}
    </div>
  );
});

ZoomPanContainer.displayName = 'ZoomPanContainer';

export default ZoomPanContainer;

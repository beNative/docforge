import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const normalizeWheelDelta = (event: React.WheelEvent<HTMLDivElement>) => {
  const lineHeight = 16;
  const pageHeight = event.currentTarget.clientHeight || 800;
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
    minScale = 0.25,
    maxScale = 5,
    initialScale = 1,
    zoomStep = 0.25,
    disableControls = false,
    disablePan = false,
    disableZoom = false,
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

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (disablePan && disableZoom) {
      return;
    }

    if (!disableZoom && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const { deltaY } = normalizeWheelDelta(event);
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
      const { deltaX, deltaY } = normalizeWheelDelta(event);
      setOffset((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    }
  }, [disablePan, disableZoom, setOffset, setScale, zoomStep]);

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
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
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
    const base = 'relative overflow-hidden touch-none bg-secondary';
    const cursor = disablePan ? '' : isPanning ? ' cursor-grabbing' : ' cursor-grab';
    return `${base}${cursor}${className ? ` ${className}` : ''}`;
  }, [className, disablePan, isPanning]);

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerCancel={endPan}
      onDoubleClick={handleDoubleClick}
      {...rest}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`transform-gpu origin-center ${contentClassName ?? ''}`} style={transformStyle}>
          {children}
        </div>
      </div>
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

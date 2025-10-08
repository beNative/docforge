import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  const contentRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => containerRef.current);

  const [scale, setScaleState] = useState(initialScale);
  const [offset, setOffsetState] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const panPointer = useRef<{ id: number | null; lastX: number; lastY: number }>({ id: null, lastX: 0, lastY: 0 });
  const [contentSize, setContentSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      let width = entry.contentRect.width;
      let height = entry.contentRect.height;

      const boxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;

      if (boxSize) {
        width = boxSize.inlineSize ?? width;
        height = boxSize.blockSize ?? height;
      }

      setContentSize({ width, height });
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

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

      if (lockOverflow) {
        const scale = scaleRef.current || 1;
        setOffset((prev) => ({
          x: prev.x - deltaX / scale,
          y: prev.y - deltaY / scale,
        }));
        return;
      }

      const node = containerRef.current;
      if (node) {
        node.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
      }
    }
  }, [disablePan, disableZoom, lockOverflow, setOffset, setScale, zoomStep]);

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

    const node = containerRef.current;
    if (!node) {
      return;
    }

    if (!lockOverflow) {
      node.scrollBy({ left: -dx, top: -dy, behavior: 'auto' });
      return;
    }

    const scale = scaleRef.current || 1;
    setOffset((prev) => ({ x: prev.x + dx / scale, y: prev.y + dy / scale }));
  }, [disablePan, lockOverflow, setOffset]);

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
    if (!lockOverflow) {
      const node = containerRef.current;
      node?.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    }
  }, [initialScale, lockOverflow, setOffset, setScale]);

  const transformStyle = useMemo(() => {
    const translateX = lockOverflow ? offset.x : 0;
    const translateY = lockOverflow ? offset.y : 0;
    const origin = layout === 'natural' ? 'top left' : 'center';

    return {
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
      transformOrigin: origin,
    };
  }, [layout, lockOverflow, offset.x, offset.y, scale]);

  const containerClasses = useMemo(() => {
    const classes = ['relative', 'bg-secondary'];
    if (lockOverflow) {
      classes.push('overflow-hidden');
    } else {
      classes.push('overflow-auto');
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

  const naturalWrapperStyle = useMemo(() => {
    if (layout !== 'natural' || !contentSize.width || !contentSize.height) {
      return undefined;
    }

    return {
      width: `${contentSize.width * scale}px`,
      height: `${contentSize.height * scale}px`,
    };
  }, [contentSize.height, contentSize.width, layout, scale]);

  const renderContent = useCallback(() => {
    const content = (
      <div ref={contentRef} className={`transform-gpu ${contentClassName ?? ''}`} style={transformStyle}>
        {children}
      </div>
    );

    if (layout === 'natural') {
      if (wrapperClassName) {
        return (
          <div className={wrapperClassName} style={naturalWrapperStyle}>
            {content}
          </div>
        );
      }
      if (naturalWrapperStyle) {
        return <div style={naturalWrapperStyle}>{content}</div>;
      }
      return content;
    }

    return (
      <div className={`absolute inset-0 flex items-center justify-center ${wrapperClassName ?? ''}`}>
        {content}
      </div>
    );
  }, [children, contentClassName, layout, naturalWrapperStyle, transformStyle, wrapperClassName]);

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

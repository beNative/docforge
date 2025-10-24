import React, { useCallback, useEffect, useMemo, useRef } from 'react';

interface PreviewZoomContextValue {
  scale: number;
  minScale: number;
  maxScale: number;
  zoomStep: number;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  registerResetHandler: (handler: () => void) => () => void;
}

interface PreviewZoomProviderProps {
  children: React.ReactNode;
  scale: number;
  onScaleChange: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
  zoomStep?: number;
  initialScale?: number;
  resetSignal?: number;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const PreviewZoomContext = React.createContext<PreviewZoomContextValue | null>(null);

export const PreviewZoomProvider: React.FC<PreviewZoomProviderProps> = ({
  children,
  scale,
  onScaleChange,
  minScale = 0.25,
  maxScale = 5,
  zoomStep = 0.25,
  initialScale = 1,
  resetSignal,
}) => {
  const resetHandlersRef = useRef(new Set<() => void>());
  const lastResetSignalRef = useRef<number | undefined>(resetSignal);

  const clampedScale = useMemo(() => clamp(scale, minScale, maxScale), [scale, minScale, maxScale]);

  const setScale = useCallback((next: number) => {
    const clamped = clamp(next, minScale, maxScale);
    onScaleChange(clamped);
  }, [maxScale, minScale, onScaleChange]);

  const zoomIn = useCallback(() => {
    setScale(clampedScale * (1 + zoomStep));
  }, [clampedScale, setScale, zoomStep]);

  const zoomOut = useCallback(() => {
    setScale(clampedScale / (1 + zoomStep));
  }, [clampedScale, setScale, zoomStep]);

  const reset = useCallback(() => {
    onScaleChange(initialScale);
    resetHandlersRef.current.forEach(handler => handler());
  }, [initialScale, onScaleChange]);

  const registerResetHandler = useCallback((handler: () => void) => {
    resetHandlersRef.current.add(handler);
    return () => {
      resetHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (resetSignal === undefined) {
      return;
    }
    if (lastResetSignalRef.current === resetSignal) {
      return;
    }
    lastResetSignalRef.current = resetSignal;
    resetHandlersRef.current.forEach(handler => handler());
  }, [resetSignal]);

  const value = useMemo<PreviewZoomContextValue>(() => ({
    scale: clampedScale,
    minScale,
    maxScale,
    zoomStep,
    setScale,
    zoomIn,
    zoomOut,
    reset,
    registerResetHandler,
  }), [clampedScale, maxScale, minScale, registerResetHandler, reset, setScale, zoomIn, zoomOut, zoomStep]);

  return (
    <PreviewZoomContext.Provider value={value}>
      {children}
    </PreviewZoomContext.Provider>
  );
};

export const usePreviewZoom = (): PreviewZoomContextValue | null => {
  return React.useContext(PreviewZoomContext);
};


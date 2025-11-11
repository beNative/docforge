import React, { useCallback, useEffect, useRef, useState } from 'react';
import Compact from '@uiw/react-color-compact';
import type { ColorResult } from '@uiw/color-convert';

interface ColorPickerProps {
  id?: string;
  color: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  anchorClassName?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  id,
  color,
  onChange,
  ariaLabel,
  className,
  anchorClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, isOpen]);

  const handleColorChange = useCallback((result: ColorResult) => {
    const next = result.hexa || result.hex;
    onChange(next);
  }, [onChange]);

  return (
    <div ref={containerRef} className={`relative inline-flex ${className ?? ''}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className={`h-10 w-14 rounded-md border border-border-color bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 flex items-center justify-center ${anchorClassName ?? ''}`}
      >
        <span
          aria-hidden
          className="block h-7 w-10 rounded border border-border-color/60 shadow-inner"
          style={{ backgroundColor: color }}
        />
      </button>
      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 rounded-md border border-border-color bg-background shadow-lg p-3">
          <Compact color={color} onChange={handleColorChange} />
        </div>
      )}
    </div>
  );
};

export default ColorPicker;

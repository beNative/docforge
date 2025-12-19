import React, { useCallback, useEffect, useRef, useState } from 'react';
import Compact from '@uiw/react-color-compact';
import type { ColorResult } from '@uiw/color-convert';
import IconButton from '../IconButton';

interface ToolbarColorPickerProps {
    color: string;
    onChange: (value: string) => void;
    icon: React.FC<{ className?: string }>;
    label: string;
    disabled?: boolean;
}

const ToolbarColorPicker: React.FC<ToolbarColorPickerProps> = ({
    color,
    onChange,
    icon: Icon,
    label,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const toggleOpen = useCallback(() => {
        if (!disabled) {
            setIsOpen((previous) => !previous);
        }
    }, [disabled]);

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
        // Don't close on change to allow trying multiple colors
    }, [onChange]);

    return (
        <div ref={containerRef} className="relative inline-flex">
            <IconButton
                type="button"
                tooltip={label}
                size="xs"
                variant="ghost"
                onClick={toggleOpen}
                disabled={disabled}
                aria-pressed={isOpen}
                aria-label={label}
                className={`transition-all duration-200 ${isOpen
                    ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-main hover:bg-secondary-hover'
                    } disabled:opacity-30 disabled:pointer-events-none`}
            >
                <div className="relative flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                    <div
                        className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                </div>
            </IconButton>
            {isOpen && (
                <div className="absolute left-0 z-50 mt-2 rounded-md border border-border-color bg-background shadow-lg p-3">
                    <Compact color={color} onChange={handleColorChange} />
                </div>
            )}
        </div>
    );
};

export default ToolbarColorPicker;

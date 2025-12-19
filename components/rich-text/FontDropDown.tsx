import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '../Icons';

interface FontDropDownProps {
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const FontDropDown: React.FC<FontDropDownProps> = ({
    value,
    options,
    onChange,
    disabled = false,
    className = '',
    placeholder = 'Select...',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleOpen = useCallback(() => {
        if (!disabled) {
            setIsOpen((prev) => !prev);
        }
    }, [disabled]);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                close();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, close]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        close();
    };

    const selectedOption = options.find((opt) => opt.value === value);

    return (
        <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
            <button
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`flex items-center justify-between w-full rounded-md border border-border-color/50 bg-secondary/30 px-2 py-1 text-xs font-medium text-text-main hover:bg-secondary-hover focus:outline-none focus:ring-1 focus:ring-primary/50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className="block truncate max-w-[100px]">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDownIcon className="ml-1 h-3 w-3 text-text-secondary" />
            </button>

            {isOpen && (
                <div className="absolute left-0 z-50 mt-1 w-40 origin-top-left rounded-md bg-secondary shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-60 overflow-auto">
                    <div className="py-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`block w-full px-4 py-2 text-left text-xs ${option.value === value
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-text-main hover:bg-secondary-hover'
                                    }`}
                            >
                                <span style={{ fontFamily: option.value }}>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FontDropDown;

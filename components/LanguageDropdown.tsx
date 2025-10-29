import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon } from './Icons';
import { SUPPORTED_LANGUAGES } from '../services/languageService';

interface LanguageDropdownProps {
  id?: string;
  value: string;
  onChange: (languageId: string) => void;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ id, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLanguage = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.id === value) ?? SUPPORTED_LANGUAGES[0];
  }, [value]);

  const activeOptionId = useMemo(() => `language-option-${selectedLanguage.id}`, [selectedLanguage.id]);

  const toggleOpen = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
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

  const handleSelect = useCallback(
    (languageId: string) => {
      onChange(languageId);
      close();
    },
    [close, onChange],
  );

  return (
    <div ref={containerRef} className="relative text-xs">
      <button
        id={id}
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-2 bg-background text-text-main text-xs rounded-md py-1 pl-2 pr-2 border border-border-color focus:outline-none focus:ring-1 focus:ring-primary"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[8rem]" title={selectedLanguage.label}>
          {selectedLanguage.label}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      {isOpen && (
        <div
          className="absolute right-0 mt-1 z-50 w-72 rounded-md border border-border-color bg-background shadow-lg"
          role="listbox"
          aria-activedescendant={activeOptionId}
        >
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 p-2 text-xs">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language.id}
                type="button"
                id={`language-option-${language.id}`}
                role="option"
                aria-selected={language.id === selectedLanguage.id}
                onClick={() => handleSelect(language.id)}
                className={`text-left px-3 py-1.5 rounded-md transition-colors ${
                  language.id === selectedLanguage.id
                    ? 'bg-secondary/70 text-primary font-semibold'
                    : 'text-text-main hover:bg-secondary'
                }`}
              >
                {language.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageDropdown;

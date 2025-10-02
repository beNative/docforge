import React from 'react';

interface SettingRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  inlineDescription?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
  contentClassName?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  inlineDescription,
  children,
  htmlFor,
  className,
  contentClassName,
}) => {
  const containerClass = [
    'grid grid-cols-1 gap-y-3 gap-x-6',
    'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const contentContainerClass = ['flex flex-col items-start gap-2', contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      <div className="space-y-1">
        <label htmlFor={htmlFor} className="block font-semibold text-text-main leading-tight">
          {label}
        </label>
        {description && <div className="text-xs text-text-secondary">{description}</div>}
      </div>
      <div className={contentContainerClass}>
        {children}
        {inlineDescription && (
          <div className="text-xs text-text-secondary leading-relaxed">{inlineDescription}</div>
        )}
      </div>
    </div>
  );
};

export default SettingRow;
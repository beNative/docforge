import React from 'react';

type SettingRowDensity = 'comfortable' | 'compact';
type SettingRowVariant = 'plain' | 'soft' | 'outlined' | 'contrast';
type SettingRowAlignment = 'start' | 'center' | 'stretch';
type SettingRowJustification = 'start' | 'end' | 'between';

export interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
  inlineDescription?: React.ReactNode;
  layout?: SettingRowDensity;
  contentVariant?: SettingRowVariant;
  align?: SettingRowAlignment;
  justify?: SettingRowJustification;
  contentClassName?: string;
}

const densityGap: Record<SettingRowDensity, string> = {
  comfortable: 'gap-y-5',
  compact: 'gap-y-3',
};

const labelSpacing: Record<SettingRowDensity, string> = {
  comfortable: 'gap-2',
  compact: 'gap-1',
};

const containerSpacing: Record<SettingRowDensity, string> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-2',
};

const inlineSpacing: Record<SettingRowDensity, string> = {
  comfortable: 'mt-1.5',
  compact: 'mt-1',
};

const variantStyles: Record<SettingRowVariant, string> = {
  plain: '',
  soft: 'bg-secondary/70 border border-border-color/60 rounded-xl shadow-sm',
  outlined: 'bg-background border border-border-color rounded-xl',
  contrast: 'bg-primary/10 border border-primary/40 rounded-xl shadow-sm',
};

const alignmentMap: Record<SettingRowAlignment, string> = {
  start: 'items-start',
  center: 'items-center',
  stretch: 'items-stretch',
};

const justifyMap: Record<SettingRowJustification, string> = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between',
};

const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  htmlFor,
  inlineDescription,
  layout = 'comfortable',
  contentVariant = 'plain',
  align = 'start',
  justify = 'start',
  contentClassName,
}) => {
  const gridClasses = [
    'grid w-full',
    'grid-cols-1',
    'gap-x-6',
    densityGap[layout],
    'sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)]',
    'lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]',
    '2xl:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)]',
  ].join(' ');

  const labelClasses = [
    'flex flex-col',
    labelSpacing[layout],
    'text-sm',
  ].join(' ');

  const contentWrapperClasses = [
    'flex flex-col',
    'w-full',
    layout === 'comfortable' ? 'gap-3' : 'gap-2',
  ].join(' ');

  const contentContainerClasses = [
    'w-full',
    'flex flex-wrap',
    justifyMap[justify],
    alignmentMap[align],
    'gap-3',
    contentVariant !== 'plain' ? containerSpacing[layout] : '',
    variantStyles[contentVariant],
    contentClassName || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClasses}>
      <div className={labelClasses}>
        <label htmlFor={htmlFor} className="font-semibold text-text-main leading-tight cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-text-secondary leading-relaxed">{description}</p>}
      </div>
      <div className={contentWrapperClasses}>
        <div className={contentContainerClasses}>{children}</div>
        {inlineDescription && (
          <div className={`text-xs text-text-secondary ${inlineSpacing[layout]} leading-relaxed`}>{inlineDescription}</div>
        )}
      </div>
    </div>
  );
};

export default SettingRow;
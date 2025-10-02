import React from 'react';

type CardTone = 'default' | 'muted' | 'contrast' | 'accent';
type CardDensity = 'comfortable' | 'compact';

export interface SettingsGroupCardProps {
  id?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: CardTone;
  density?: CardDensity;
  className?: string;
  contentClassName?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const toneClasses: Record<CardTone, string> = {
  default: 'bg-secondary/80 border border-border-color/70 shadow-sm',
  muted: 'bg-background border border-border-color/60',
  contrast: 'bg-background border border-text-main/20 shadow-md',
  accent: 'bg-primary/10 border border-primary/40 shadow-sm',
};

const densityPadding: Record<CardDensity, string> = {
  comfortable: 'p-6',
  compact: 'p-4',
};

const bodySpacing: Record<CardDensity, string> = {
  comfortable: 'mt-6 space-y-6',
  compact: 'mt-4 space-y-4',
};

const SettingsGroupCard = React.forwardRef<HTMLDivElement, SettingsGroupCardProps>(
  (
    {
      id,
      title,
      description,
      icon,
      tone = 'default',
      density = 'comfortable',
      className,
      contentClassName,
      headerAction,
      children,
    },
    ref,
  ) => {
    const wrapperClasses = [
      'rounded-3xl transition-colors duration-200',
      toneClasses[tone],
      densityPadding[density],
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    const bodyClasses = [
      bodySpacing[density],
      contentClassName || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <section id={id} ref={ref} className="w-full">
        <div className={wrapperClasses}>
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-1 items-start gap-3">
              {icon && <span className="mt-1 text-primary">{icon}</span>}
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-text-main md:text-lg">{title}</h3>
                {description && (
                  <p className="text-xs md:text-sm text-text-secondary leading-relaxed max-w-3xl">{description}</p>
                )}
              </div>
            </div>
            {headerAction && <div className="flex flex-wrap gap-2 md:justify-end">{headerAction}</div>}
          </header>
          <div className={bodyClasses}>{children}</div>
        </div>
      </section>
    );
  },
);

SettingsGroupCard.displayName = 'SettingsGroupCard';

export default SettingsGroupCard;

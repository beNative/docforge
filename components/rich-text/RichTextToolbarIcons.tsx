import React from 'react';

type IconProps = {
  className?: string;
};

const createTextIcon = (text: string, options?: { fontWeight?: number; fontSize?: number; dy?: number; skewX?: number }) => {
  const { fontWeight = 600, fontSize = 13, dy = 0, skewX } = options ?? {};
  const transform = skewX ? `skewX(${skewX})` : undefined;

  const Component: React.FC<IconProps> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="12"
        y={15 + dy}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill="currentColor"
        style={transform ? { transform, transformOrigin: 'center' } : undefined}
      >
        {text}
      </text>
    </svg>
  );

  Component.displayName = `${text}TextIcon`;
  return Component;
};

export const BoldIcon = createTextIcon('B', { fontWeight: 700 });
export const ItalicIcon = createTextIcon('I', { skewX: -10 });
export const UnderlineIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <path d="M7 4v6a5 5 0 0 0 10 0V4" />
    <path d="M6 20h12" />
  </svg>
);
export const StrikethroughIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <path d="M4 12h16" />
    <path d="M6 6a4 4 0 0 1 4-2h4a4 4 0 0 1 4 4" />
    <path d="M18 18a4 4 0 0 1-4 2h-4a4 4 0 0 1-4-4" />
  </svg>
);
export const CodeInlineIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 7 4 12 8 17" />
    <polyline points="16 7 20 12 16 17" />
    <line x1="12" y1="5" x2="12" y2="19" />
  </svg>
);
export const ParagraphIcon = createTextIcon('¶', { fontSize: 16, dy: 1 });
export const HeadingOneIcon = createTextIcon('H1', { fontWeight: 700, fontSize: 11, dy: 1 });
export const HeadingTwoIcon = createTextIcon('H2', { fontWeight: 700, fontSize: 11, dy: 1 });
export const HeadingThreeIcon = createTextIcon('H3', { fontWeight: 700, fontSize: 11, dy: 1 });
export const BulletListIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <circle cx="6" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <line x1="10" y1="7" x2="20" y2="7" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="17" x2="20" y2="17" />
  </svg>
);
export const NumberListIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <text x="6" y="9" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      1.
    </text>
    <text x="6" y="14" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      2.
    </text>
    <text x="6" y="19" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      3.
    </text>
    <line x1="10" y1="7" x2="20" y2="7" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="17" x2="20" y2="17" />
  </svg>
);
export const QuoteIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 7a4 4 0 1 0 4 4V7a4 4 0 0 0-4-4H6v6" />
    <path d="M18 7a4 4 0 1 0 4 4V7a4 4 0 0 0-4-4h-4v6" />
  </svg>
);
export const LinkIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 14a4 4 0 0 1 0-5.66l2.12-2.12a4 4 0 0 1 5.66 5.66l-1.06 1.06" />
    <path d="M14 10a4 4 0 0 1 0 5.66l-2.12 2.12a4 4 0 0 1-5.66-5.66l1.06-1.06" />
  </svg>
);
export const AlignLeftIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="16" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);
export const AlignCenterIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="6" y1="18" x2="18" y2="18" />
  </svg>
);
export const AlignRightIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);
export const AlignJustifyIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="10" x2="20" y2="10" />
    <line x1="4" y1="14" x2="20" y2="14" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);
export const ImageIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="16" height="12" rx="2" ry="2" />
    <circle cx="9" cy="11" r="1.5" />
    <path d="M21 17l-4.5-4.5L13 16l-2-2-3 3" />
  </svg>
);
export const ClearFormattingIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h14" />
    <path d="M9 4l6 16" />
    <path d="M4 20l5-5" />
    <path d="M10 9h8" />
  </svg>
);

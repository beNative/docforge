import React from 'react';
import { useIconSet } from '../../hooks/useIconSet';

type IconProps = {
  className?: string;
};

type IconSet = 'heroicons' | 'lucide' | 'feather' | 'tabler' | 'material';

const strokeWidthMap: Record<IconSet, number> = {
  heroicons: 1.6,
  lucide: 2,
  feather: 1.6,
  tabler: 1.8,
  material: 2.2,
};

const createRichIcon = (
  displayName: string,
  renderer: (iconSet: IconSet, className?: string) => React.ReactElement,
): React.FC<IconProps> => {
  const Component: React.FC<IconProps> = ({ className }) => {
    const { iconSet } = useIconSet();
    return renderer(iconSet as IconSet, className);
  };
  Component.displayName = displayName;
  return Component;
};

const createStrokeIcon = (
  displayName: string,
  pathFactory: (iconSet: IconSet) => React.ReactNode,
): React.FC<IconProps> =>
  createRichIcon(displayName, (iconSet, className) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={strokeWidthMap[iconSet]}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pathFactory(iconSet)}
    </svg>
  ));

const createTextIcon = (
  displayName: string,
  text: string,
  options?: Partial<
    Record<
      IconSet,
      {
        fontWeight?: number;
        fontSize?: number;
        dy?: number;
        skewX?: number;
      }
    >
  >,
): React.FC<IconProps> => {
  const defaults = {
    fontWeight: 600,
    fontSize: 12,
    dy: 1,
    skewX: 0,
  };
  return createRichIcon(displayName, (iconSet, className) => {
    const { fontWeight, fontSize, dy, skewX } = { ...defaults, ...(options?.[iconSet] ?? {}) };
    const transform = skewX ? `skewX(${skewX})` : undefined;
    return (
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
  });
};

export const BoldIcon = createTextIcon('BoldIcon', 'B', {
  heroicons: { fontWeight: 700 },
  lucide: { fontWeight: 600 },
  feather: { fontWeight: 500 },
  tabler: { fontWeight: 650 },
  material: { fontWeight: 800 },
});

export const ItalicIcon = createTextIcon('ItalicIcon', 'I', {
  heroicons: { skewX: -12 },
  lucide: { skewX: -14 },
  feather: { skewX: -10 },
  tabler: { skewX: -16 },
  material: { skewX: -12, fontWeight: 700 },
});

export const UnderlineIcon = createStrokeIcon('UnderlineIcon', () => (
  <>
    <path d="M7 4v6a5 5 0 0 0 10 0V4" />
    <path d="M6 20h12" />
  </>
));

export const StrikethroughIcon = createStrokeIcon('StrikethroughIcon', () => (
  <>
    <path d="M4 12h16" />
    <path d="M6 6a4 4 0 0 1 4-2h4a4 4 0 0 1 4 4" />
    <path d="M18 18a4 4 0 0 1-4 2h-4a4 4 0 0 1-4-4" />
  </>
));

export const CodeInlineIcon = createStrokeIcon('CodeInlineIcon', () => (
  <>
    <polyline points="8 7 4 12 8 17" />
    <polyline points="16 7 20 12 16 17" />
    <line x1="12" y1="5" x2="12" y2="19" />
  </>
));

export const ParagraphIcon = createTextIcon('ParagraphIcon', '¶', {
  heroicons: { fontSize: 15 },
  lucide: { fontSize: 14 },
  feather: { fontSize: 13 },
  tabler: { fontSize: 15 },
  material: { fontSize: 16, fontWeight: 700 },
});

export const HeadingOneIcon = createTextIcon('HeadingOneIcon', 'H1');
export const HeadingTwoIcon = createTextIcon('HeadingTwoIcon', 'H2');
export const HeadingThreeIcon = createTextIcon('HeadingThreeIcon', 'H3');

export const BulletListIcon = createStrokeIcon('BulletListIcon', () => (
  <>
    <circle cx="6" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <line x1="10" y1="7" x2="20" y2="7" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="17" x2="20" y2="17" />
  </>
));

export const NumberListIcon = createRichIcon('NumberListIcon', (iconSet, className) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="6" y="9" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      1.
    </text>
    <text x="6" y="14" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      2.
    </text>
    <text x="6" y="19" fontSize="8" fontWeight={600} textAnchor="middle" fill="currentColor">
      3.
    </text>
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidthMap[iconSet]}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="10" y1="7" x2="20" y2="7" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="17" x2="20" y2="17" />
    </g>
  </svg>
));

export const QuoteIcon = createStrokeIcon('QuoteIcon', () => (
  <>
    <path d="M10 7a4 4 0 1 0 4 4V7a4 4 0 0 0-4-4H6v6" />
    <path d="M18 7a4 4 0 1 0 4 4V7a4 4 0 0 0-4-4h-4v6" />
  </>
));

export const TableIcon = createStrokeIcon('TableIcon', () => (
  <>
    <rect x="4" y="5" width="16" height="14" rx="2" ry="2" />
    <path d="M4 10h16" />
    <path d="M4 14h16" />
    <path d="M10 5v14" />
    <path d="M14 5v14" />
  </>
));

export const LinkIcon = createStrokeIcon('LinkIcon', () => (
  <>
    <path d="M10 14a4 4 0 0 1 0-5.66l2.12-2.12a4 4 0 0 1 5.66 5.66l-1.06 1.06" />
    <path d="M14 10a4 4 0 0 1 0 5.66l-2.12 2.12a4 4 0 0 1-5.66-5.66l1.06-1.06" />
  </>
));

export const AlignLeftIcon = createStrokeIcon('AlignLeftIcon', () => (
  <>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="16" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
));

export const AlignCenterIcon = createStrokeIcon('AlignCenterIcon', () => (
  <>
    <line x1="6" y1="6" x2="18" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="6" y1="18" x2="18" y2="18" />
  </>
));

export const AlignRightIcon = createStrokeIcon('AlignRightIcon', () => (
  <>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
));

export const AlignJustifyIcon = createStrokeIcon('AlignJustifyIcon', () => (
  <>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="10" x2="20" y2="10" />
    <line x1="4" y1="14" x2="20" y2="14" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
));

export const ImageIcon = createStrokeIcon('ImageIcon', () => (
  <>
    <rect x="4" y="6" width="16" height="12" rx="2" ry="2" />
    <circle cx="9" cy="11" r="1.5" />
    <path d="M21 17l-4.5-4.5L13 16l-2-2-3 3" />
  </>
));

export const ClearFormattingIcon = createStrokeIcon('ClearFormattingIcon', () => (
  <>
    <path d="M5 4h14" />
    <path d="M9 4l6 16" />
    <path d="M4 20l5-5" />
    <path d="M10 9h8" />
  </>
));

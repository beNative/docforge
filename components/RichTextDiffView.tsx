import React, { useMemo } from 'react';
import { diffWordsWithSpace } from 'diff';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface RichTextDiffViewProps {
  baseline: string;
  current: string;
}

const RichTextDiffView: React.FC<RichTextDiffViewProps> = ({ baseline, current }) => {
  const diffMarkup = useMemo(() => {
    const parts = diffWordsWithSpace(baseline, current);
    return parts.map((part, index) => {
      const className = part.added
        ? 'bg-success/10 text-success'
        : part.removed
        ? 'bg-destructive-bg text-destructive-text'
        : 'text-text-main';
      return (
        <span
          key={`${index}-${part.value.length}`}
          className={`whitespace-pre-wrap ${className}`}
          dangerouslySetInnerHTML={{ __html: escapeHtml(part.value) }}
        />
      );
    });
  }, [baseline, current]);

  return (
    <div className="h-full w-full overflow-auto bg-background text-sm font-mono px-4 py-3 space-x-1">
      {diffMarkup}
    </div>
  );
};

export default RichTextDiffView;

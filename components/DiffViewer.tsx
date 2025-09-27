import React from 'react';
import { diffService, DiffLinePair } from '../services/diffService';

interface DiffViewerProps {
  oldText: string;
  newText: string;
}

const Line: React.FC<{ lineData: DiffLinePair['left'] | DiffLinePair['right'], type: 'left' | 'right' }> = ({ lineData, type }) => {
  if (!lineData) {
    return <div className="h-[20px]">&nbsp;</div>; // Placeholder for alignment
  }

  const isLeft = type === 'left';
  const tokens = lineData.tokens;
  
  return (
    <div className="whitespace-pre-wrap break-words">
      <span className="text-text-secondary/50 select-none w-8 inline-block text-right pr-2">
        {lineData.lineNumber}
      </span>
      {tokens.map((token, i) => {
        let bgColor = '';
        if (isLeft && token.type === 'removed') bgColor = 'bg-destructive-bg/30';
        if (!isLeft && token.type === 'added') bgColor = 'bg-success/20';
        return (
          <span key={i} className={bgColor}>
            {token.text}
          </span>
        );
      })}
      {tokens.length === 0 && <span>&nbsp;</span>}
    </div>
  );
};


const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText }) => {
  const diffResult = React.useMemo(() => diffService.computeDiff(oldText, newText), [oldText, newText]);

  const getLineBgClass = (line: DiffLinePair) => {
    switch (line.type) {
      case 'added': return 'bg-success/10';
      case 'removed': return 'bg-destructive-bg/20';
      default: return '';
    }
  };

  return (
    <div className="font-mono text-sm border border-border-color rounded-md bg-background overflow-auto h-full">
      <div className="grid grid-cols-2">
        {/* Left Pane (Old) */}
        <div className="p-4">
          {diffResult.map((line, index) => (
            <div key={`left-${index}`} className={getLineBgClass(line)}>
              <Line lineData={line.left} type="left" />
            </div>
          ))}
        </div>
        {/* Right Pane (New) */}
        <div className="p-4 border-l border-border-color">
          {diffResult.map((line, index) => (
            <div key={`right-${index}`} className={getLineBgClass(line)}>
              <Line lineData={line.right} type="right" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;

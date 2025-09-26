import React from 'react';

type DiffLine = {
    type: 'common' | 'added' | 'removed';
    line: string;
};

// Simplified diff that marks lines as added or removed based on their presence in the other text block.
const createDiff = (oldText: string, newText: string): { left: DiffLine[], right: DiffLine[] } => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    const newLinesSet = new Set(newLines);
    const oldLinesSet = new Set(oldLines);

    const left: DiffLine[] = oldLines.map(line => ({
        type: newLinesSet.has(line) ? 'common' : 'removed',
        line,
    }));

    const right: DiffLine[] = newLines.map(line => ({
        type: oldLinesSet.has(line) ? 'common' : 'added',
        line,
    }));

    return { left, right };
};


const DiffViewer: React.FC<{ oldText: string, newText: string }> = ({ oldText, newText }) => {
    const { left, right } = createDiff(oldText, newText);

    return (
        <div className="grid grid-cols-2 gap-4 font-mono text-sm border border-border-color rounded-md bg-background overflow-auto max-h-96">
            <pre className="p-4">
                {left.map((item, index) => (
                    <div key={index} className={`whitespace-pre-wrap break-words ${item.type === 'removed' ? 'bg-destructive-bg/30' : ''}`}>
                        <span className="text-text-secondary/50 select-none w-8 inline-block text-right pr-2">{index + 1}</span>
                        <span>{item.line || ' '}</span>
                    </div>
                ))}
            </pre>
            <pre className="p-4 border-l border-border-color">
                {right.map((item, index) => (
                    <div key={index} className={`whitespace-pre-wrap break-words ${item.type === 'added' ? 'bg-success/20' : ''}`}>
                        <span className="text-text-secondary/50 select-none w-8 inline-block text-right pr-2">{index + 1}</span>
                        <span>{item.line || ' '}</span>
                    </div>
                ))}
            </pre>
        </div>
    );
};

export default DiffViewer;

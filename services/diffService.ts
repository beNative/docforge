export type WordToken = {
    text: string;
    type: 'common' | 'added' | 'removed';
};

export type LineData = {
    lineNumber?: number;
    tokens: WordToken[];
} | null;

export type DiffLinePair = {
    left: LineData;
    right: LineData;
    type: 'common' | 'added' | 'removed' | 'modified';
};

const lcs = <T,>(a: T[], b: T[], comparator: (itemA: T, itemB: T) => boolean): T[] => {
    const m = a.length;
    const n = b.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (comparator(a[i - 1], b[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const sequence: T[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (comparator(a[i - 1], b[j - 1])) {
            sequence.unshift(a[i - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    return sequence;
};


const diffWords = (oldLine: string, newLine: string): { left: WordToken[], right: WordToken[] } => {
    const oldWords = oldLine.match(/(\s+|\S+)/g) || [];
    const newWords = newLine.match(/(\s+|\S+)/g) || [];
    const commonWords = new Set(lcs(oldWords, newWords, (a, b) => a === b));

    const createTokens = (words: string[], compareSet: Set<string>, type: 'added' | 'removed'): WordToken[] => {
        return words.map(text => ({
            text,
            type: compareSet.has(text) ? 'common' : type,
        }));
    };

    return {
        left: createTokens(oldWords, commonWords, 'removed'),
        right: createTokens(newWords, commonWords, 'added'),
    };
};

const computeDiff = (oldText: string, newText: string): DiffLinePair[] => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const commonLines = new Set(lcs(oldLines, newLines, (a, b) => a === b));
    
    const result: DiffLinePair[] = [];
    let oldIdx = 0;
    let newIdx = 0;
    let oldLineNum = 1;
    let newLineNum = 1;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
        const oldLine = oldLines[oldIdx];
        const newLine = newLines[newIdx];

        if (oldIdx < oldLines.length && !commonLines.has(oldLine)) {
            result.push({
                type: 'removed',
                left: { lineNumber: oldLineNum++, tokens: [{ text: oldLine, type: 'removed' }] },
                right: null,
            });
            oldIdx++;
        } else if (newIdx < newLines.length && !commonLines.has(newLine)) {
            result.push({
                type: 'added',
                left: null,
                right: { lineNumber: newLineNum++, tokens: [{ text: newLine, type: 'added' }] },
            });
            newIdx++;
        } else if (oldIdx < oldLines.length && newIdx < newLines.length) {
            // This is a common line, check for word-level modifications
            if (oldLine !== newLine) {
                const { left, right } = diffWords(oldLine, newLine);
                result.push({
                    type: 'modified',
                    left: { lineNumber: oldLineNum++, tokens: left },
                    right: { lineNumber: newLineNum++, tokens: right },
                });
            } else {
                result.push({
                    type: 'common',
                    left: { lineNumber: oldLineNum++, tokens: [{ text: oldLine, type: 'common' }] },
                    right: { lineNumber: newLineNum++, tokens: [{ text: newLine, type: 'common' }] },
                });
            }
            oldIdx++;
            newIdx++;
        }
    }

    return result;
};


export const diffService = {
    computeDiff,
};

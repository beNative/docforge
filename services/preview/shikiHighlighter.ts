import type { Highlighter } from 'shiki/bundle/full';

let highlighterPromise: Promise<Highlighter> | null = null;

export const getSharedHighlighter = async (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki/bundle/full').then(({ getHighlighter }) =>
      getHighlighter({
        themes: {
          light: 'github-light',
          dark: 'one-dark-pro',
        },
      })
    );
  }

  return highlighterPromise;
};

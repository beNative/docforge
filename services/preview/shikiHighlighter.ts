import type { Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

export const getSharedHighlighter = async (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki/bundle/full').then(({ getHighlighter, bundledLanguages }) =>
      getHighlighter({
        themes: ['github-light', 'one-dark-pro'],
        langs: Object.keys(bundledLanguages),
      })
    );
  }

  return highlighterPromise;
};

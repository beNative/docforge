import type { Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

const SHIKI_LANGUAGES = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'html',
  'css',
  'bash',
  'shell',
  'python',
  'markdown',
  'yaml',
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'php',
  'ruby',
];

export const getSharedHighlighter = async (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ getHighlighter }) =>
      getHighlighter({
        themes: {
          light: 'github-light',
          dark: 'one-dark-pro',
        },
        langs: SHIKI_LANGUAGES,
      })
    );
  }

  return highlighterPromise;
};

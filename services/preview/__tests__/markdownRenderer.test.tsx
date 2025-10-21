import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { act, render, waitFor, within } from '@testing-library/react';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { MarkdownRenderer } from '../markdownRenderer';
import { ThemeContext } from '../../../contexts/ThemeContext';
import { IconProvider } from '../../../contexts/IconContext';
import { DEFAULT_SETTINGS } from '../../../constants';

const codeToHtmlMock = vi.fn((code: string) => {
  const lines = code.split('\n');
  const lineHtml = lines
    .map((line) => `<span class="line">${line}</span>`)
    .join('');
  return `<pre class="shiki"><code>${lineHtml}</code></pre>`;
});

vi.mock('../shikiHighlighter', () => ({
  getSharedHighlighter: vi.fn(() =>
    Promise.resolve({
      codeToHtml: codeToHtmlMock,
    })
  ),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../__fixtures__');

const referenceMarkdown = fs.readFileSync(path.join(fixturesDir, 'github-reference.md'), 'utf8');
const referenceGithubHtml = fs.readFileSync(
  path.join(fixturesDir, 'github-reference.github.html'),
  'utf8',
);

const renderMarkdown = async (markdown: string) => {
  const renderer = new MarkdownRenderer();
  const { output } = await renderer.render(markdown, undefined, 'markdown', DEFAULT_SETTINGS);
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <IconProvider value={{ iconSet: 'heroicons' }}>{output}</IconProvider>
      </ThemeContext.Provider>,
    );
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return utils!;
};

const getTagCounts = (root: ParentNode) => {
  const counts = new Map<string, number>();
  root.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  });
  return counts;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

interface TextExtractionOptions {
  removeSelectors?: string[];
}

const extractComparableText = (element: Element, options: TextExtractionOptions = {}) => {
  const clone = element.cloneNode(true) as Element;

  for (const selector of options.removeSelectors ?? []) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }

  clone.querySelectorAll('td, th').forEach((node) => {
    node.append(' ');
  });

  clone.querySelectorAll('.df-code-block-shiki .line').forEach((node) => {
    node.append('\n');
  });

  clone.querySelectorAll('.katex-html').forEach((node) => node.remove());
  clone.querySelectorAll('.katex').forEach((node) => {
    const annotation = node.querySelector('annotation');
    if (annotation) {
      node.replaceWith(annotation.textContent ?? '');
    }
  });

  clone.querySelectorAll('math-renderer').forEach((node) => {
    const content = (node.textContent ?? '').replace(/\$+/g, '').trim();
    node.replaceWith(content);
  });

  const rawText = clone.textContent ?? '';
  return normalizeText(rawText.replace(/\\,/g, ' ,'));
};

const maybeWriteArtifact = (name: string, html: string) => {
  if (!process.env.MARKDOWN_TEST_ARTIFACTS) {
    return;
  }

  const artifactDir = path.resolve(__dirname, '../../../artifacts/tests');
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, name), html, 'utf8');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MarkdownRenderer', () => {
  it('normalizes Windows line endings before syntax highlighting', async () => {
    const markdown = ['```js', 'const foo = 1;', 'const bar = 2;', '```'].join('\r\n');
    await renderMarkdown(markdown);

    await waitFor(() => expect(codeToHtmlMock).toHaveBeenCalled());

    const [[code]] = codeToHtmlMock.mock.calls;
    expect(code).toBe('const foo = 1;\nconst bar = 2;\n');
  });

  it('applies GitHub-style inline code styling without shrinking the font', async () => {
    const { container } = await renderMarkdown('Use the `inline` keyword.');

    const inline = container.querySelector('p > code');
    expect(inline).not.toBeNull();
    expect(inline?.textContent).toBe('inline');

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-markdown :not\(pre\) > code \{/);
    expect(styles).toMatch(/font-size:\s*var\(--markdown-font-size, 16px\)/);
    expect(styles).toMatch(/background:\s*rgba\(/);
    expect(styles).toMatch(/border:\s*1px solid/);
    expect(styles).toMatch(/font-family:\s*var\(--markdown-code-font-family, 'JetBrains Mono', monospace\)/);
  });

  it('renders horizontal rules with visible divider styling', async () => {
    const { container } = await renderMarkdown('Top\n\n---\n\nBottom');

    const divider = container.querySelector('hr.df-divider');
    expect(divider).not.toBeNull();

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-divider \{/);
    expect(styles).toMatch(/border-top: 1px solid/);
  });

  it('injects GitHub-style table, divider, and code block styles', async () => {
    const markdown = ['| A | B |', '| - | - |', '| 1 | 2 |', '', '---', '', '```js', 'console.log(1);', '```'].join('\n');
    const { container } = await renderMarkdown(markdown);

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-table-wrapper \{/);
    expect(styles).toMatch(/\.df-table \{/);
    expect(styles).toMatch(/\.df-table-header,/);
    expect(styles).toMatch(/\.df-divider \{/);
    expect(styles).toMatch(/\.df-code-block \{/);
  });

  it('renders accessible GitHub-style tables with semantic sections', async () => {
    const tableMarkdown = [`| Name | Value |`, `| ---- | -----:|`, `| Foo  |   100 |`].join('\n');
    const { container } = await renderMarkdown(tableMarkdown);

    const wrapper = container.querySelector('.df-table-wrapper');
    expect(wrapper).not.toBeNull();

    const table = within(wrapper as HTMLElement).getByRole('table');
    expect(table).toHaveClass('df-table');

    const headerRow = table.querySelector('thead .df-table-row');
    expect(headerRow).not.toBeNull();

    const headerCell = within(table).getByRole('columnheader', { name: /name/i });
    expect(headerCell).toHaveClass('df-table-header');

    const bodyRow = table.querySelectorAll('tbody .df-table-row');
    expect(bodyRow.length).toBe(1);

    const numericCell = within(table).getByRole('cell', { name: /100/ });
    expect(numericCell).toHaveClass('df-table-cell');
  });

  it('renders the GitHub reference fixture with all key markdown affordances', async () => {
    const { container } = await renderMarkdown(referenceMarkdown);
    const markdownRoot = container.querySelector('.df-markdown') as HTMLElement | null;
    expect(markdownRoot).not.toBeNull();
    if (!markdownRoot) {
      return;
    }

    const headings = Array.from(markdownRoot.querySelectorAll('h1, h2, h3'));
    expect(headings.map((element) => normalizeText(element.textContent))).toEqual([
      'GitHub Rendering Reference',
      'Lists and Quotes',
      'Tables',
      'Code Samples',
      'Mathematics',
      'Final Notes',
    ]);

    const horizontalRules = markdownRoot.querySelectorAll('hr.df-divider');
    expect(horizontalRules.length).toBe(2);
    horizontalRules.forEach((rule) => {
      expect(rule.classList.contains('df-divider')).toBe(true);
    });

    const blockquote = markdownRoot.querySelector('.df-blockquote');
    expect(blockquote).not.toBeNull();
    expect(normalizeText(blockquote?.textContent)).toContain('Blockquote section including');

    const unorderedList = markdownRoot.querySelector('ul.df-list.df-list-disc');
    const orderedList = markdownRoot.querySelector('ol.df-list.df-list-decimal');
    expect(unorderedList).not.toBeNull();
    expect(orderedList).not.toBeNull();
    expect(unorderedList?.querySelectorAll('li.df-list-item').length).toBeGreaterThanOrEqual(3);
    expect(orderedList?.querySelectorAll('li.df-list-item').length).toBe(3);

    const inlineCodeFragments = Array.from(markdownRoot.querySelectorAll('p > code'));
    expect(inlineCodeFragments.length).toBeGreaterThan(0);
    inlineCodeFragments.forEach((node) => {
      expect(node.parentElement?.tagName.toLowerCase()).toBe('p');
      expect(node.className).toBe('');
    });

    const tableWrapper = markdownRoot.querySelector('.df-table-wrapper');
    expect(tableWrapper).not.toBeNull();
    const table = tableWrapper?.querySelector('table.df-table') as HTMLTableElement | undefined;
    expect(table).toBeTruthy();
    const headerCells = Array.from(table?.querySelectorAll('thead .df-table-header') ?? []);
    expect(headerCells.map((cell) => normalizeText(cell.textContent))).toEqual([
      'Name',
      'Alignment',
      'Notes',
    ]);
    const bodyRows = table?.querySelectorAll('tbody .df-table-row') ?? [];
    expect(bodyRows.length).toBe(3);
    const inlineValueCell = Array.from(table?.querySelectorAll('tbody .df-table-cell') ?? []).find((cell) =>
      normalizeText(cell.textContent).includes('Inline value'),
    );
    expect(inlineValueCell).toBeDefined();

    const highlightedBlock = markdownRoot.querySelector(
      '.df-code-block-shiki[data-language="TS"] .line:nth-child(2)',
    );
    expect(highlightedBlock).not.toBeNull();
    expect(highlightedBlock?.textContent).toContain('console.log');

    const fallbackCodeBlock = markdownRoot.querySelector('pre.df-code-block:not([data-language])');
    expect(fallbackCodeBlock).not.toBeNull();
    expect(fallbackCodeBlock?.querySelector('code.df-code-block__code')?.textContent).toContain(
      'No language code block',
    );

    const mermaidDiagram = markdownRoot.querySelector('.df-mermaid');
    expect(mermaidDiagram).not.toBeNull();
    expect(mermaidDiagram?.querySelector('[role="img"]')).not.toBeNull();

    const katexBlocks = markdownRoot.querySelectorAll('.katex');
    expect(katexBlocks.length).toBeGreaterThanOrEqual(2);
    const displayMath = markdownRoot.querySelector('.katex-display');
    expect(displayMath).not.toBeNull();

    const paragraphAfterMath = markdownRoot.querySelector('h3 + p');
    expect(normalizeText(paragraphAfterMath?.textContent)).toContain('Text after math');
  });

  it('produces markup structurally consistent with GitHub for the reference fixture', async () => {
    const { container } = await renderMarkdown(referenceMarkdown);
    const markdownRoot = container.querySelector('.df-markdown');
    expect(markdownRoot).not.toBeNull();

    const githubDoc = new DOMParser().parseFromString(referenceGithubHtml, 'text/html');
    const githubRoot = githubDoc.body;

    const docforgeHtml = `<!doctype html><html><head><meta charset="utf-8"><title>DocForge Markdown</title></head><body style="margin:0;background:#f6f8fa;padding:32px;">${container.innerHTML}</body></html>`;
    const githubHtmlDocument = `<!doctype html><html><head><meta charset="utf-8"><title>GitHub Reference</title></head><body style="margin:0;background:#f6f8fa;padding:32px;">${referenceGithubHtml}</body></html>`;

    maybeWriteArtifact('github-reference-render.html', docforgeHtml);
    maybeWriteArtifact('github-reference-github.html', githubHtmlDocument);

    const expectedCounts = getTagCounts(githubRoot);
    const actualCounts = getTagCounts(markdownRoot!);

    const tagsToCompare = [
      'h1',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'blockquote',
      'hr',
    ];

    for (const tag of tagsToCompare) {
      const expected = expectedCounts.get(tag) ?? 0;
      const actual = actualCounts.get(tag) ?? 0;
      expect(actual, `Mismatch for <${tag}>`).toBe(expected);
    }

    const expectedParagraphs = expectedCounts.get('p') ?? 0;
    const actualParagraphs = actualCounts.get('p') ?? 0;
    const displayMathBlocks = markdownRoot!.querySelectorAll('.katex-display').length;
    expect(actualParagraphs + displayMathBlocks, 'Paragraphs including display math').toBe(
      expectedParagraphs,
    );

    const expectedPreformatted = expectedCounts.get('pre') ?? 0;
    const actualPreformatted = actualCounts.get('pre') ?? 0;
    const diagramBlocks = markdownRoot!.querySelectorAll('.df-mermaid, .df-plantuml').length;
    expect(actualPreformatted + diagramBlocks, 'Pre/code blocks including rendered diagrams').toBe(
      expectedPreformatted,
    );

    const expectedCodeElements = expectedCounts.get('code') ?? 0;
    const actualCodeElements = actualCounts.get('code') ?? 0;
    const highlightedBlocks = markdownRoot!.querySelectorAll('.df-code-block-shiki').length;
    expect(actualCodeElements - highlightedBlocks, 'Code elements excluding highlighted blocks').toBe(
      expectedCodeElements,
    );

    const docforgeText = extractComparableText(markdownRoot!, {
      removeSelectors: ['.df-mermaid', '.df-plantuml'],
    });
    const githubText = extractComparableText(githubRoot, {
      removeSelectors: ['.highlight-source-mermaid'],
    });
    expect(docforgeText).toBe(githubText);
  });
});

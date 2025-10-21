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
    .map((line) => `<span class="line"><span style="color:#d73a49">${line}</span></span>`)
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

const showcaseMarkdown = fs.readFileSync(
  path.join(fixturesDir, 'github-feature-showcase.md'),
  'utf8',
);
const showcaseGithubHtml = fs.readFileSync(
  path.join(fixturesDir, 'github-feature-showcase.github.html'),
  'utf8',
);

interface ParityFixture {
  id: string;
  markdown: string;
  githubHtml: string;
  artifactPrefix: string;
  removeDocforgeSelectors?: string[];
  removeGithubSelectors?: string[];
}

const renderMarkdown = async (markdown: string, theme: 'light' | 'dark' = 'light') => {
  const renderer = new MarkdownRenderer();
  const { output } = await renderer.render(markdown, undefined, 'markdown', DEFAULT_SETTINGS);
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(
      <ThemeContext.Provider value={{ theme, toggleTheme: vi.fn() }}>
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
    expect(styles).toMatch(/--df-inline-code-bg:\s*rgba\(var\(--color-border\), 0\.35\)/);
    expect(styles).toMatch(/--df-inline-code-border-color:\s*rgba\(var\(--color-border\), 0\.55\)/);
    expect(styles).toMatch(/\.df-markdown :not\(pre\) > code \{/);
    expect(styles).toMatch(/font-size:\s*var\(--markdown-font-size, 16px\)/);
    expect(styles).toMatch(/background-color:\s*var\(--df-inline-code-bg\)/);
    expect(styles).toMatch(/border:\s*1px solid/);
    expect(styles).toMatch(/var\(--df-inline-code-border-color\)/);
    expect(styles).toMatch(/font-family:\s*var\(--markdown-code-font-family, 'JetBrains Mono', monospace\)/);
    expect(styles).toMatch(/\.df-markdown-container\.light \.df-markdown \{/);
    expect(styles).toMatch(/--df-inline-code-bg:\s*#f6f8fa/);
    expect(styles).toMatch(/--df-inline-code-border-color:\s*#d0d7de/);
  });

  it('applies theme-aware inline code backgrounds', async () => {
    const { container: lightContainer } = await renderMarkdown('`light` mode inline');
    const lightStyles = lightContainer.querySelector('style')?.textContent ?? '';
    expect(lightStyles).toMatch(/\.df-markdown-container\.light \.df-markdown \{/);
    expect(lightStyles).toMatch(/--df-inline-code-bg:\s*#f6f8fa/);
    expect(lightStyles).toMatch(/--df-inline-code-border-color:\s*#d0d7de/);

    const { container: darkContainer } = await renderMarkdown('`dark` mode inline', 'dark');
    const darkStyles = darkContainer.querySelector('style')?.textContent ?? '';
    expect(darkStyles).toMatch(/\.df-markdown-container\.dark \.df-markdown \{/);
    expect(darkStyles).toMatch(/--df-inline-code-bg:\s*rgba\(240, 246, 252, 0\.18\)/);
    expect(darkStyles).toMatch(/--df-inline-code-border-color:\s*rgba\(240, 246, 252, 0\.25\)/);
  });

  it('renders horizontal rules with visible divider styling', async () => {
    const { container } = await renderMarkdown('Top\n\n---\n\nBottom');

    const divider = container.querySelector('hr.df-divider');
    expect(divider).not.toBeNull();

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-divider \{/);
    expect(styles).toMatch(/--df-divider-color:\s*rgba\(var\(--color-border\), 0\.9\)/);
    expect(styles).toMatch(/background-color:\s*var\(--df-divider-color\)/);
    expect(styles).toMatch(/\.df-markdown-container\.light \.df-markdown \{/);
    expect(styles).toMatch(/--df-divider-color:\s*#d0d7de/);
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
    expect(styles).toMatch(/--df-code-block-bg:\s*rgba\(var\(--color-border\), 0\.25\)/);
    expect(styles).toMatch(/\.df-markdown-container\.light \.df-markdown \{/);
    expect(styles).toMatch(/--df-code-block-bg:\s*#f6f8fa/);
    expect(styles).toMatch(/--df-table-border-color:\s*#d0d7de/);
  });

  it('adds GitHub-themed styling for tables and dividers in dark mode', async () => {
    const markdown = ['| Col |', '| --- |', '| Val |', '', '---'].join('\n');
    const { container } = await renderMarkdown(markdown, 'dark');

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-markdown-container\.dark \.df-markdown \{/);
    expect(styles).toMatch(/--df-table-border-color:\s*rgba\(240, 246, 252, 0\.18\)/);
    expect(styles).toMatch(/--df-divider-color:\s*rgba\(240, 246, 252, 0\.18\)/);
  });

  it('decorates highlighted code blocks with Shiki output and language badges', async () => {
    const markdown = ['```ts', 'const answer = 42;', '```'].join('\n');
    const { container } = await renderMarkdown(markdown);

    const shikiBlock = container.querySelector('.df-code-block-shiki');
    expect(shikiBlock).not.toBeNull();
    expect(shikiBlock).toHaveAttribute('data-language', 'TS');
    expect(shikiBlock?.querySelector('.shiki')).not.toBeNull();
    expect(shikiBlock?.querySelectorAll('.line').length).toBeGreaterThan(0);
    expect(shikiBlock?.querySelector('[style*="color"]')).not.toBeNull();
  });

  it('preserves blank lines in highlighted code blocks with visible placeholders', async () => {
    const markdown = [
      '```bash',
      '# First section',
      'echo "hello"',
      '',
      '# Second section',
      'echo "world"',
      '```',
    ].join('\n');
    const { container } = await renderMarkdown(markdown);

    const shikiBlock = container.querySelector('.df-code-block-shiki');
    expect(shikiBlock).not.toBeNull();

    const lines = Array.from(shikiBlock?.querySelectorAll('.line') ?? []);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    const blankLine = lines[2];
    expect(blankLine?.textContent).toBe('');

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toContain('.df-code-block .line:empty:not(:last-child)::before {');
    expect(styles).toContain("content: '\\00a0'");
  });

  it('avoids decorating trailing blank lines that originate from fenced block termination', async () => {
    const markdown = [
      '```bash',
      'echo "hello"',
      '',
      '# Final line',
      '```',
    ].join('\n');
    const { container } = await renderMarkdown(markdown);

    const shikiBlock = container.querySelector('.df-code-block-shiki');
    expect(shikiBlock).not.toBeNull();

    const lines = Array.from(shikiBlock?.querySelectorAll('.line') ?? []);
    expect(lines.length).toBe(4);
    expect(lines[1]?.textContent).toBe('');
    expect(lines[2]?.textContent).toContain('# Final line');
    expect(lines[3]?.textContent).toBe('');

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toContain('.df-code-block .line:empty:not(:last-child)::before {');
    const placeholderRuleIndex = styles.indexOf('.df-code-block .line:empty:not(:last-child)::before');
    const trailingRuleIndex = styles.indexOf('.df-code-block .line:empty::before', placeholderRuleIndex + 1);
    expect(trailingRuleIndex).toBe(-1);
  });

  it('renders plain fenced code blocks without syntax highlighting while preserving whitespace', async () => {
    const markdown = ['```', 'line 1', '  indented line', '', 'line 3', '```'].join('\n');
    const { container } = await renderMarkdown(markdown);

    const fallbackBlock = container.querySelector('pre.df-code-block:not(.df-code-block-shiki)');
    expect(fallbackBlock).not.toBeNull();
    expect(fallbackBlock?.getAttribute('data-language')).toBeNull();

    const codeElement = fallbackBlock?.querySelector('code.df-code-block__code');
    expect(codeElement?.textContent).toBe('line 1\n  indented line\n\nline 3\n');
  });

  it('renders indented code blocks with monospace styling and no language badge', async () => {
    const markdown = ['    alpha()', '    beta()', '', 'Paragraph text'].join('\n');
    const { container } = await renderMarkdown(markdown);

    const pre = container.querySelector('pre.df-code-block');
    expect(pre).not.toBeNull();
    expect(pre?.classList.contains('df-code-block-shiki')).toBe(false);
    expect(pre?.getAttribute('data-language')).toBeNull();

    const code = pre?.querySelector('code.df-code-block__code');
    expect(code?.textContent).toBe('alpha()\nbeta()\n');

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toMatch(/\.df-code-block \{/);
    expect(styles).toMatch(/font-family: var\(--markdown-code-font-family, 'JetBrains Mono', monospace\)/);
  });

  it('renders multiple highlighted code blocks with accurate language badges and structure', async () => {
    const markdown = [
      '```ts',
      'const value: number = 42;',
      '```',
      '',
      '```python',
      'def greet(name):',
      '    return f"Hello, {name}"',
      '```',
      '',
      '```json',
      '{',
      '  "key": "value"',
      '}',
      '```',
    ].join('\n');
    const { container } = await renderMarkdown(markdown);

    const shikiBlocks = Array.from(container.querySelectorAll('.df-code-block-shiki'));
    expect(shikiBlocks.length).toBe(3);
    const languages = shikiBlocks.map((block) => block.getAttribute('data-language'));
    expect(languages).toEqual(['TS', 'PYTHON', 'JSON']);
    shikiBlocks.forEach((block) => {
      expect(block.querySelectorAll('.line').length).toBeGreaterThan(0);
      expect(block.querySelector('.shiki code')).not.toBeNull();
    });
  });

  it('renders user story bash instructions with the expected blank line spacing', async () => {
    const markdown = [
      '```bash',
      '# Launch all tests for User Story 1 together (if tests requested):',
      'Task: "Contract test for [endpoint] in tests/contract/test_[name].py"',
      'Task: "Integration test for [user journey] in tests/integration/test_[name].py"',
      '',
      '# Launch all models for User Story 1 together:',
      'Task: "Create [Entity1] model in src/models/[entity1].py"',
      'Task: "Create [Entity2] model in src/models/[entity2].py"',
      '```',
    ].join('\n');
    const { container } = await renderMarkdown(markdown);

    const shikiBlock = container.querySelector('.df-code-block-shiki');
    expect(shikiBlock).not.toBeNull();
    expect(shikiBlock).toHaveAttribute('data-language', 'BASH');

    const lines = Array.from(shikiBlock?.querySelectorAll('.line') ?? []);
    expect(lines.length).toBe(8);
    const blankIndices = lines
      .map((line, index) => (line.textContent === '' ? index : -1))
      .filter((index) => index >= 0);
    expect(blankIndices).toEqual([3, 7]);

    const styles = container.querySelector('style')?.textContent ?? '';
    expect(styles).toContain('.df-code-block .line:empty:not(:last-child)::before {');

    const docforgeHtml = `<!doctype html><html><head><meta charset="utf-8"><title>User Story Code Block</title></head><body style="margin:0;background:#f6f8fa;padding:32px;">${container.innerHTML}</body></html>`;
    maybeWriteArtifact('user-story-code-render.html', docforgeHtml);
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

  it('renders the GitHub feature showcase fixture with advanced markdown constructs', async () => {
    const { container } = await renderMarkdown(showcaseMarkdown);
    const markdownRoot = container.querySelector('.df-markdown');
    expect(markdownRoot).not.toBeNull();
    if (!markdownRoot) {
      return;
    }

    const sections = Array.from(markdownRoot.querySelectorAll('h1, h2'));
    expect(sections.map((element) => normalizeText(element.textContent))).toEqual([
      'GitHub Feature Showcase',
      'Mixed Content',
      'Tables',
      'Code Blocks',
      'Definition Lists',
      'Table Alignment Verification',
      'Final Notes',
    ]);

    const mixedParagraph = markdownRoot.querySelector('#mixed-content + p');
    expect(mixedParagraph).not.toBeNull();
    expect(normalizeText(mixedParagraph?.textContent)).toContain('strikethrough');
    expect(mixedParagraph?.querySelector('code')?.textContent).toBe('inline code');
    expect(mixedParagraph?.querySelector('strong')?.textContent).toBe('bold text');
    expect(mixedParagraph?.querySelector('em')?.textContent).toBe('italic text');
    expect(mixedParagraph?.querySelector('del')?.textContent).toBe('strikethrough');
    const inlineLink = mixedParagraph?.querySelector('a.df-link[href="https://example.com"]');
    expect(inlineLink).not.toBeNull();

    const dividers = markdownRoot.querySelectorAll('hr.df-divider');
    expect(dividers.length).toBeGreaterThanOrEqual(6);
    dividers.forEach((divider) => {
      expect(divider).toHaveClass('df-divider');
    });

    const taskCheckboxes = markdownRoot.querySelectorAll('input[type="checkbox"]');
    expect(taskCheckboxes.length).toBe(2);
    taskCheckboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('disabled');
    });

    const taskListItems = markdownRoot.querySelectorAll('li.df-list-item');
    expect(taskListItems.length).toBeGreaterThanOrEqual(5);
    const nestedList = markdownRoot.querySelector('ul.df-list ul.df-list');
    expect(nestedList?.querySelectorAll('li.df-list-item').length).toBe(1);
    expect(nestedList?.querySelector('code')?.textContent).toBe('code');

    const blockquote = markdownRoot.querySelector('blockquote.df-blockquote');
    expect(blockquote).not.toBeNull();
    expect(normalizeText(blockquote?.textContent)).toContain('Blockquote with formatting');
    const blockquoteLink = blockquote?.querySelector('a.df-link[href="https://github.com"]');
    expect(blockquoteLink).not.toBeNull();

    const tableWrappers = markdownRoot.querySelectorAll('.df-table-wrapper');
    expect(tableWrappers.length).toBe(3);

    const firstTable = tableWrappers[0]?.querySelector('table.df-table');
    expect(firstTable).not.toBeNull();
    const alignedHeader = firstTable?.querySelectorAll('thead .df-table-header') ?? [];
    expect(alignedHeader.length).toBe(3);
    const alignmentAttributes = Array.from(firstTable?.querySelectorAll('tbody td.df-table-cell') ?? []).map((cell) => {
      const alignAttr = cell.getAttribute('align');
      if (alignAttr) {
        return alignAttr.toLowerCase();
      }
      const styleAlign = (cell as HTMLElement).style.textAlign;
      if (styleAlign) {
        return styleAlign.toLowerCase();
      }
      return 'left';
    });
    expect(alignmentAttributes).toEqual(['left', 'center', 'right', 'left', 'center', 'right', 'left', 'center', 'right']);

    const inlineCodeInTable = markdownRoot.querySelectorAll('td.df-table-cell code');
    expect(inlineCodeInTable.length).toBeGreaterThan(0);

    const highlightedTsBlock = markdownRoot.querySelector('.df-code-block-shiki[data-language="TS"]');
    expect(highlightedTsBlock).not.toBeNull();
    expect(highlightedTsBlock?.querySelector('.line:nth-child(3)')?.textContent).toContain('name: string');

    const highlightedPythonBlock = markdownRoot.querySelector('.df-code-block-shiki[data-language="PYTHON"]');
    expect(highlightedPythonBlock).not.toBeNull();
    expect(highlightedPythonBlock?.textContent).toContain('def greet');

    const plainBlock = markdownRoot.querySelector('pre.df-code-block:not([data-language])');
    expect(plainBlock?.querySelector('code.df-code-block__code')?.textContent).toContain('Plain fenced block');

    const definitionHeading = Array.from(markdownRoot.querySelectorAll('h2')).find(
      (heading) => normalizeText(heading.textContent) === 'Definition Lists',
    );
    expect(definitionHeading).toBeDefined();
    const definitionTexts: string[] = [];
    for (
      let element = definitionHeading?.nextElementSibling;
      element && element.tagName !== 'HR';
      element = element.nextElementSibling
    ) {
      definitionTexts.push(normalizeText(element.textContent));
    }
    expect(definitionTexts).toEqual([
      'Term 1 : Definition with inline code',
      'Term 2 : Additional definition with bold text',
    ]);
  });

  const parityFixtures: ParityFixture[] = [
    {
      id: 'github-reference',
      markdown: referenceMarkdown,
      githubHtml: referenceGithubHtml,
      artifactPrefix: 'github-reference',
      removeDocforgeSelectors: ['.df-mermaid', '.df-plantuml'],
      removeGithubSelectors: ['.highlight-source-mermaid'],
    },
    {
      id: 'github-feature-showcase',
      markdown: showcaseMarkdown,
      githubHtml: showcaseGithubHtml,
      artifactPrefix: 'github-feature-showcase',
    },
  ];

  it.each(parityFixtures.map((fixture) => [fixture.id, fixture]))(
    'produces markup structurally consistent with GitHub for %s',
    async (_id, fixture) => {
      const { container } = await renderMarkdown(fixture.markdown);
      const markdownRoot = container.querySelector('.df-markdown');
      expect(markdownRoot).not.toBeNull();

      const githubDoc = new DOMParser().parseFromString(fixture.githubHtml, 'text/html');
      const githubRoot = githubDoc.body;

      const docforgeHtml = `<!doctype html><html><head><meta charset="utf-8"><title>DocForge Markdown</title></head><body style="margin:0;background:#f6f8fa;padding:32px;">${container.innerHTML}</body></html>`;
      const githubHtmlDocument = `<!doctype html><html><head><meta charset="utf-8"><title>GitHub Reference</title></head><body style="margin:0;background:#f6f8fa;padding:32px;">${fixture.githubHtml}</body></html>`;

      maybeWriteArtifact(`${fixture.artifactPrefix}-render.html`, docforgeHtml);
      maybeWriteArtifact(`${fixture.artifactPrefix}-github.html`, githubHtmlDocument);

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
        'code',
        'pre',
        'input',
        'strong',
        'em',
        'a',
        'del',
      ];

      for (const tag of tagsToCompare) {
        const expected = expectedCounts.get(tag) ?? 0;
        const actual = actualCounts.get(tag) ?? 0;
        if (tag === 'code') {
          const highlightedBlocks = markdownRoot!.querySelectorAll('.df-code-block-shiki').length;
          expect(actual - highlightedBlocks, `Mismatch for <${tag}>`).toBe(expected);
        } else if (tag === 'pre') {
          const diagramBlocks = markdownRoot!.querySelectorAll('.df-mermaid, .df-plantuml').length;
          expect(actual + diagramBlocks, `Mismatch for <${tag}>`).toBe(expected);
        } else {
          expect(actual, `Mismatch for <${tag}>`).toBe(expected);
        }
      }

      const expectedParagraphs = expectedCounts.get('p') ?? 0;
      const actualParagraphs = actualCounts.get('p') ?? 0;
      const displayMathBlocks = markdownRoot!.querySelectorAll('.katex-display').length;
      expect(actualParagraphs + displayMathBlocks, 'Paragraphs including display math').toBe(expectedParagraphs);

      const docforgeText = extractComparableText(markdownRoot!, {
        removeSelectors: fixture.removeDocforgeSelectors ?? [],
      });
      const githubText = extractComparableText(githubRoot, {
        removeSelectors: fixture.removeGithubSelectors ?? [],
      });
      expect(docforgeText).toBe(githubText);
    },
  );
});

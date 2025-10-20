import React from 'react';
import { act, render, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
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

const renderMarkdown = async (markdown: string) => {
  const renderer = new MarkdownRenderer();
  const { output } = await renderer.render(markdown, undefined, 'markdown', DEFAULT_SETTINGS);
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: vi.fn() }}>
        <IconProvider value={{ iconSet: 'heroicons' }}>
          {output}
        </IconProvider>
      </ThemeContext.Provider>
    );
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return utils!;
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

  it('renders inline code with the monospaced styling class', async () => {
    const { container } = await renderMarkdown('Use the `inline` keyword.');

    const inline = container.querySelector('p > code');
    expect(inline).not.toBeNull();
    expect(inline?.textContent).toBe('inline');
    expect(inline?.closest('pre')).toBeNull();
  });

  it('renders horizontal rules as dividers', async () => {
    const { container } = await renderMarkdown('Top\n\n---\n\nBottom');

    const divider = container.querySelector('hr.df-divider');
    expect(divider).not.toBeNull();
  });

  it('renders GitHub-style tables', async () => {
    const tableMarkdown = [`| Name | Value |`, `| ---- | ----- |`, `| Foo  | Bar   |`].join('\n');
    const { container } = await renderMarkdown(tableMarkdown);

    const wrapper = container.querySelector('.df-table-wrapper');
    expect(wrapper).not.toBeNull();

    const table = within(wrapper as HTMLElement).getByRole('table');
    expect(table).toBeInTheDocument();

    const headerCell = within(table).getByRole('columnheader', { name: /name/i });
    expect(headerCell).toHaveClass('df-table-header');

    const dataCell = within(table).getByRole('cell', { name: /bar/i });
    expect(dataCell).toHaveClass('df-table-cell');
  });
});

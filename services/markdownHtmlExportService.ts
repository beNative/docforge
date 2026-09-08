import type { DocumentOrFolder } from '../types';
import { exportDocumentDirectly } from './documentExportService';

/**
 * Checks if a document is a Markdown document.
 */
export const isMarkdownDocument = (doc: DocumentOrFolder): boolean => {
  if (doc.type !== 'document') return false;
  if (doc.doc_type === 'prompt') return true;
  const lang = (doc.language_hint || '').toLowerCase();
  return lang === 'markdown' || lang === 'md';
};

/**
 * Escape raw HTML characters to prevent XSS.
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Lightweight, robust parser that converts Markdown to clean HTML with GitHub styling.
 */
export const markdownToHtml = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inTable = false;
  let inBlockquote = false;

  const closeOpenLists = () => {
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
    if (inOrderedList) {
      result.push('</ol>');
      inOrderedList = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      result.push('</blockquote>');
      inBlockquote = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      result.push('</tbody></table></div>');
      inTable = false;
    }
  };

  const formatInline = (text: string): string => {
    let out = escapeHtml(text);
    // Inline code `code`
    out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // Bold **text** or __text__
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic *text* or _text_
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Strikethrough ~~text~~
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // Images ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="doc-image" />');
    // Links [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return out;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        closeOpenLists();
        closeBlockquote();
        closeTable();
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        inCodeBlock = false;
        const codeContent = escapeHtml(codeBlockLines.join('\n'));
        const langClass = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : '';
        result.push(`<pre><code${langClass}>${codeContent}</code></pre>`);
        codeBlockLang = '';
        codeBlockLines = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      closeOpenLists();
      closeBlockquote();
      closeTable();
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      closeOpenLists();
      closeBlockquote();
      closeTable();
      result.push('<hr />');
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeOpenLists();
      closeBlockquote();
      closeTable();
      const level = headingMatch[1].length;
      const text = formatInline(headingMatch[2]);
      result.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      closeOpenLists();
      closeTable();
      if (!inBlockquote) {
        result.push('<blockquote>');
        inBlockquote = true;
      }
      const quoteText = trimmed.replace(/^>\s?/, '');
      result.push(`<p>${formatInline(quoteText)}</p>`);
      continue;
    } else {
      closeBlockquote();
    }

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeOpenLists();
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      // Check if it's separator row
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        // Table header separator, already opened the table
        continue;
      }
      if (!inTable) {
        result.push('<div class="table-wrapper"><table><thead><tr>');
        cells.forEach(c => result.push(`<th>${formatInline(c)}</th>`));
        result.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      } else {
        result.push('<tr>');
        cells.forEach(c => result.push(`<td>${formatInline(c)}</td>`));
        result.push('</tr>');
        continue;
      }
    } else {
      closeTable();
    }

    // Unordered list (*, -, +)
    const ulMatch = line.match(/^(\s*)([*+-])\s+(.*)$/);
    if (ulMatch) {
      if (inOrderedList) closeOpenLists();
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${formatInline(ulMatch[3])}</li>`);
      continue;
    }

    // Ordered list (1.)
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList) closeOpenLists();
      if (!inOrderedList) {
        result.push('<ol>');
        inOrderedList = true;
      }
      result.push(`<li>${formatInline(olMatch[3])}</li>`);
      continue;
    }

    closeOpenLists();

    // Standard paragraph
    result.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeOpenLists();
  closeBlockquote();
  closeTable();

  return result.join('\n');
};

/**
 * Builds a standalone, beautiful HTML document string with responsive GitHub-like styling.
 */
export const convertMarkdownToStandaloneHtml = (
  markdown: string,
  title: string = 'Document',
  options?: { theme?: 'light' | 'dark' }
): string => {
  const isDark = options?.theme === 'dark';
  const htmlBody = markdownToHtml(markdown);

  const styles = `
    :root {
      --bg: ${isDark ? '#0d1117' : '#ffffff'};
      --fg: ${isDark ? '#e6edf3' : '#1f2328'};
      --border: ${isDark ? '#30363d' : '#d0d7de'};
      --code-bg: ${isDark ? '#161b22' : '#f6f8fa'};
      --link: ${isDark ? '#2f81f7' : '#0969da'};
      --blockquote-border: ${isDark ? '#3b434b' : '#d0d7de'};
      --blockquote-fg: ${isDark ? '#8b949e' : '#656d76'};
      --table-row-even: ${isDark ? '#161b22' : '#f6f8fa'};
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }
    .markdown-container {
      max-width: 880px;
      width: 100%;
      background: var(--bg);
      padding: 2.5rem;
      border-radius: 8px;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
    h2 { font-size: 1.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
    h3 { font-size: 1.25rem; }
    h4 { font-size: 1rem; }
    p, ul, ol, blockquote, .table-wrapper, pre {
      margin-top: 0;
      margin-bottom: 1rem;
    }
    a {
      color: var(--link);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      padding-left: 2rem;
    }
    li {
      margin-top: 0.25rem;
    }
    blockquote {
      padding: 0 1rem;
      color: var(--blockquote-fg);
      border-left: 0.25rem solid var(--blockquote-border);
    }
    hr {
      height: 0.25rem;
      padding: 0;
      margin: 1.5rem 0;
      background-color: var(--border);
      border: 0;
    }
    pre {
      padding: 1rem;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: var(--code-bg);
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 85%;
    }
    code.inline-code {
      padding: 0.2em 0.4em;
      margin: 0;
      background-color: var(--code-bg);
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .table-wrapper {
      overflow-x: auto;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1rem;
    }
    table th, table td {
      padding: 6px 13px;
      border: 1px solid var(--border);
    }
    table tr:nth-child(2n) {
      background-color: var(--table-row-even);
    }
    table th {
      font-weight: 600;
      background-color: var(--code-bg);
    }
    img.doc-image {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${styles}
  </style>
</head>
<body>
  <div class="markdown-container">
${htmlBody}
  </div>
</body>
</html>`;
};

/**
 * Directly exports a markdown document as a standalone HTML file.
 */
export const exportMarkdownAsHtml = async (
  doc: DocumentOrFolder,
  options?: { theme?: 'light' | 'dark' }
) => {
  const content = doc.content || '';
  const title = doc.title || 'Untitled';
  const html = convertMarkdownToStandaloneHtml(content, title, options);

  return exportDocumentDirectly(doc, {
    format: 'html',
    data: html,
    isBinary: false,
    mimeType: 'text/html;charset=utf-8',
    fileFilterName: 'HTML Document',
    extension: 'html',
  });
};

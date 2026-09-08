import { describe, it, expect } from 'vitest';
import { isMarkdownDocument, markdownToHtml, convertMarkdownToStandaloneHtml } from '../services/markdownHtmlExportService';
import { isPlantUMLDocument } from '../services/plantumlExportService';
import type { DocumentOrFolder } from '../types';

describe('markdownHtmlExportService', () => {
  it('correctly detects markdown documents', () => {
    const doc1: DocumentOrFolder = {
      id: '1',
      title: 'Note',
      type: 'document',
      doc_type: 'prompt',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isMarkdownDocument(doc1)).toBe(true);

    const doc2: DocumentOrFolder = {
      id: '2',
      title: 'Script',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'markdown',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isMarkdownDocument(doc2)).toBe(true);

    const doc3: DocumentOrFolder = {
      id: '3',
      title: 'Python Script',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'python',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isMarkdownDocument(doc3)).toBe(false);
  });

  it('converts markdown syntax to HTML', () => {
    const md = '# Header 1\n\nThis is **bold** and *italic* and `code`.\n\n- Item 1\n- Item 2';
    const html = markdownToHtml(md);

    expect(html).toContain('<h1>Header 1</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code class="inline-code">code</code>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
  });

  it('generates a valid self-contained HTML page with styles', () => {
    const md = '# Title\n\nSome text content.';
    const fullHtml = convertMarkdownToStandaloneHtml(md, 'My Document Title');

    expect(fullHtml).toContain('<!DOCTYPE html>');
    expect(fullHtml).toContain('<title>My Document Title</title>');
    expect(fullHtml).toContain('<style>');
    expect(fullHtml).toContain('.markdown-container');
    expect(fullHtml).toContain('<h1>Title</h1>');
  });
});

describe('plantumlExportService', () => {
  it('correctly detects plantuml documents', () => {
    const pumlDoc1: DocumentOrFolder = {
      id: '1',
      title: 'Diagram',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'plantuml',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isPlantUMLDocument(pumlDoc1)).toBe(true);

    const pumlDoc2: DocumentOrFolder = {
      id: '2',
      title: 'Diagram 2',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'puml',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isPlantUMLDocument(pumlDoc2)).toBe(true);

    const pumlDoc3: DocumentOrFolder = {
      id: '3',
      title: 'Diagram 3',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'text',
      content: '@startuml\nAlice -> Bob: test\n@enduml',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isPlantUMLDocument(pumlDoc3)).toBe(true);

    const notPuml: DocumentOrFolder = {
      id: '4',
      title: 'JavaScript',
      type: 'document',
      doc_type: 'source_code',
      language_hint: 'javascript',
      content: 'console.log("hello");',
      parent_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(isPlantUMLDocument(notPuml)).toBe(false);
  });
});

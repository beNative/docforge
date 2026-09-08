import { describe, it, expect } from 'vitest';
import { getDroppedUrl } from '../components/dragDropUtils';

describe('dragDropUtils - getDroppedUrl', () => {
  it('extracts URL from text/uri-list', () => {
    const dataTransfer = {
      types: ['text/uri-list'],
      getData: (type: string) => (type === 'text/uri-list' ? 'https://example.com/page' : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBe('https://example.com/page');
  });

  it('extracts URL from text/plain', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: (type: string) => (type === 'text/plain' ? 'https://example.org' : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBe('https://example.org');
  });

  it('normalizes localhost URL without protocol', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: (type: string) => (type === 'text/plain' ? 'localhost:3000/test' : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBe('http://localhost:3000/test');
  });

  it('normalizes 127.0.0.1 URL without protocol', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: (type: string) => (type === 'text/plain' ? '127.0.0.1:8080' : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBe('http://127.0.0.1:8080');
  });

  it('extracts href from text/html using DOM parser', () => {
    const html = '<div><p>Check this out:</p><a href="https://example.com/docs">Link</a></div>';
    const dataTransfer = {
      types: ['text/html'],
      getData: (type: string) => (type === 'text/html' ? html : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBe('https://example.com/docs\nLink');
  });

  it('does not freeze or crash on massive HTML payloads (DoS protection)', () => {
    // Generate large repetitive string > 64KB that could cause catastrophic regex backtracking
    const massive = '<div class="foo">' + 'a'.repeat(100000) + '</div><a href="https://safe.com">Safe</a>';
    const dataTransfer = {
      types: ['text/html'],
      getData: (type: string) => (type === 'text/html' ? massive : ''),
    } as unknown as DataTransfer;

    const start = performance.now();
    const result = getDroppedUrl(dataTransfer);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Must process well under 100ms
  });

  it('rejects unsafe protocols like javascript:', () => {
    const dataTransfer = {
      types: ['text/plain'],
      getData: (type: string) => (type === 'text/plain' ? 'javascript:alert(1)' : ''),
    } as unknown as DataTransfer;

    expect(getDroppedUrl(dataTransfer)).toBeNull();
  });
});

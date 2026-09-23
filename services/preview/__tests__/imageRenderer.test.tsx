import { describe, expect, it } from 'vitest';
import { ImageRenderer, isSvgContent } from '../imageRenderer';
import { previewService } from '../../previewService';

describe('ImageRenderer', () => {
  const renderer = new ImageRenderer();

  it('canRender returns true for image language IDs', () => {
    expect(renderer.canRender('image')).toBe(true);
    expect(renderer.canRender('svg')).toBe(true);
    expect(renderer.canRender('image/svg+xml')).toBe(true);
    expect(renderer.canRender('png')).toBe(true);
  });

  it('canRender returns true for xml when content contains SVG markup', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
    expect(renderer.canRender('xml', svg)).toBe(true);
    expect(renderer.canRender('plaintext', svg)).toBe(true);
  });

  it('canRender returns false for xml when content does not contain SVG markup', () => {
    const nonSvg = '<?xml version="1.0"?><project><name>test</name></project>';
    expect(renderer.canRender('xml', nonSvg)).toBe(false);
  });

  it('isSvgContent detects various SVG structures', () => {
    expect(isSvgContent('<svg viewBox="0 0 10 10"></svg>')).toBe(true);
    expect(isSvgContent('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(true);
    expect(isSvgContent('<!-- comment -->\n<svg></svg>')).toBe(true);
    expect(isSvgContent('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(true);
    expect(isSvgContent('<?xml version="1.0"?><note><body>Hello</body></note>')).toBe(false);
    expect(isSvgContent('')).toBe(false);
    expect(isSvgContent(null)).toBe(false);
  });

  it('previewService returns ImageRenderer when docType is image', () => {
    const resolved = previewService.getRendererForLanguage('xml', '<svg></svg>', 'image');
    expect(resolved).toBeInstanceOf(ImageRenderer);
  });

  it('previewService returns ImageRenderer for xml when content has SVG', () => {
    const resolved = previewService.getRendererForLanguage('xml', '<svg viewBox="0 0 10 10"></svg>');
    expect(resolved).toBeInstanceOf(ImageRenderer);
  });

  it('renders PNG base64 data without crashing and displays the image', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { IconProvider } = await import('../../../contexts/IconContext');
    const React = await import('react');
    const pngContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await renderer.render(pngContent, undefined, 'image');
    render(
      <IconProvider value={{ iconSet: 'heroicons' }}>
        {result.output as React.ReactElement}
      </IconProvider>
    );

    const img = screen.getByAltText('Document preview');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe(pngContent);
  });

  it('renders fallback message for empty content', async () => {
    const { render, screen } = await import('@testing-library/react');
    const result = await renderer.render('', undefined, 'image');
    render(result.output as React.ReactElement);

    expect(screen.getByText('This document does not contain any image data.')).toBeInTheDocument();
  });
});

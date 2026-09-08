import type { IRenderer } from './preview/IRenderer';
import { HtmlRenderer } from './preview/htmlRenderer';
import { MarkdownRenderer } from './preview/markdownRenderer';
import { PlaintextRenderer } from './preview/plaintextRenderer';
import { PdfRenderer } from './preview/pdfRenderer';
import { ImageRenderer } from './preview/imageRenderer';
import { PlantUMLRenderer } from './preview/plantumlRenderer';

import type { DocType } from '../types';

class PreviewService {
  private renderers: IRenderer[];

  constructor() {
    // The order is important: more specific renderers should come before the generic fallback.
    this.renderers = [
      new MarkdownRenderer(),
      new PlantUMLRenderer(),
      new HtmlRenderer(),
      new PdfRenderer(),
      new ImageRenderer(),
      new PlaintextRenderer(), // Fallback renderer should be last
    ];
  }

  /**
   * Finds the first available renderer that can handle the given language ID, content, and docType.
   * @param languageId The language identifier (e.g., 'markdown', 'html', 'xml').
   * @param content The raw content of the document.
   * @param docType The document classification type (e.g., 'image', 'pdf').
   * @returns The appropriate renderer instance.
   */
  getRendererForLanguage(
    languageId: string | null | undefined,
    content?: string,
    docType?: DocType,
  ): IRenderer {
    if (docType === 'image') {
      const imageRenderer = this.renderers.find((r) => r instanceof ImageRenderer);
      if (imageRenderer) return imageRenderer;
    }
    if (docType === 'pdf') {
      const pdfRenderer = this.renderers.find((r) => r instanceof PdfRenderer);
      if (pdfRenderer) return pdfRenderer;
    }
    const lang = languageId || 'plaintext';
    // The fallback PlaintextRenderer will always be found if no other renderer matches.
    return this.renderers.find((r) => r.canRender(lang, content))!;
  }
}

export const previewService = new PreviewService();

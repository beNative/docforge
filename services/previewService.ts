import type { IRenderer } from './preview/IRenderer';
import { HtmlRenderer } from './preview/htmlRenderer';
import { MarkdownRenderer } from './preview/markdownRenderer';
import { PlaintextRenderer } from './preview/plaintextRenderer';
import { PdfRenderer } from './preview/pdfRenderer';
import { ImageRenderer } from './preview/imageRenderer';
import { PlantUMLRenderer } from './preview/plantumlRenderer';

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
   * Finds the first available renderer that can handle the given language ID.
   * @param languageId The language identifier (e.g., 'markdown', 'html').
   * @returns The appropriate renderer instance.
   */
  getRendererForLanguage(languageId: string | null | undefined): IRenderer {
    const lang = languageId || 'plaintext';
    // The fallback PlaintextRenderer will always be found if no other renderer matches.
    return this.renderers.find(r => r.canRender(lang))!;
  }
}

export const previewService = new PreviewService();

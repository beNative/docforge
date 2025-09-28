import type React from 'react';

export interface IRenderer {
  /**
   * Determines if this renderer can handle the given language ID (e.g., 'markdown', 'html').
   */
  canRender(languageId: string): boolean;

  /**
   * Takes a string of content and transforms it into a renderable React element or HTML string.
   */
  render(content: string): Promise<{ output: React.ReactElement | string; error?: string }>;
}

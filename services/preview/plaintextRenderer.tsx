import React from 'react';
import type { IRenderer } from './IRenderer';

export class PlaintextRenderer implements IRenderer {
  canRender(languageId: string): boolean {
    // This is the fallback renderer, so it can render anything.
    return true;
  }

  async render(content: string): Promise<{ output: React.ReactElement; error?: string }> {
    const output = <pre className="whitespace-pre-wrap break-words text-text-secondary">{content}</pre>;
    return { output };
  }
}

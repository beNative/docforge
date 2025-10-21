import React from 'react';
import type { IRenderer } from './IRenderer';
import type { LogLevel, Settings } from '../../types';

export class PlaintextRenderer implements IRenderer {
  canRender(_languageId: string): boolean {
    // This is the fallback renderer, so it can render anything.
    return true;
  }

  async render(
    content: string,
    _addLog?: (level: LogLevel, message: string) => void,
    _languageId?: string | null,
    _settings?: Settings,
  ): Promise<{ output: React.ReactElement; error?: string }> {
    const output = <pre className="whitespace-pre-wrap break-words text-text-secondary">{content}</pre>;
    return { output };
  }
}

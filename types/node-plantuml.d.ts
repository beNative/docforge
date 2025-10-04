declare module 'node-plantuml' {
  import type { Readable, Writable } from 'stream';

  export interface GenerateOptions {
    format?: 'png' | 'svg' | 'txt';
    charset?: string;
    preserveLineBreaks?: boolean;
  }

  export interface GenerationResult {
    in: Writable;
    out: Readable;
    err: Readable;
  }

  export function generate(diagramText: string, options?: GenerateOptions): GenerationResult;
}

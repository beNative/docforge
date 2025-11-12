import { mapExtensionToLanguageId } from './languageService';
import type { ClassificationSource, ClassificationSummary, DocType, ViewMode } from '../types';

type ClassificationResult = {
  languageHint: string | null;
  languageSource: ClassificationSource;
  docType: DocType;
  docTypeSource: ClassificationSource;
  defaultViewMode: ViewMode | null;
  summary: ClassificationSummary;
};

type ClassificationOptions = {
  content: string;
  title?: string | null;
};

const PDF_DATA_URI_PREFIX = 'data:application/pdf';
const IMAGE_DATA_URI_PREFIX = 'data:image/';

const detectFromShebang = (line: string): string | null => {
  if (!line.startsWith('#!')) return null;
  const normalized = line.toLowerCase();
  if (normalized.includes('python')) return 'python';
  if (normalized.includes('node') || normalized.includes('deno')) return 'javascript';
  if (normalized.includes('bash') || normalized.includes('sh')) return 'shell';
  if (normalized.includes('ruby')) return 'ruby';
  if (normalized.includes('perl')) return 'perl';
  if (normalized.includes('php')) return 'php';
  return null;
};

const classifyWith = (
  languageHint: string | null,
  docType: DocType,
  defaultViewMode: ViewMode | null,
  confidence: number,
  primaryMatch: string,
  warnings: string[] = [],
  fallbackUsed = false,
): ClassificationResult => ({
  languageHint,
  languageSource: 'auto',
  docType,
  docTypeSource: 'auto',
  defaultViewMode,
  summary: {
    languageHint,
    docType,
    defaultViewMode,
    confidence,
    primaryMatch,
    fallbackUsed,
    warnings,
  },
});

const tryParseJson = (content: string): boolean => {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

const looksLikeYaml = (content: string): boolean => {
  const lines = content.split(/\r?\n/).slice(0, 20);
  let score = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === '---' || line === '...') {
      score += 1.5;
      continue;
    }
    if (/^[\w"'][\w\-"']*:\s+/.test(line)) {
      // Ignore CSS style declarations or other colon-delimited syntax that ends with semicolons or contains braces/tags.
      if (/[;{}<>]/.test(line)) {
        continue;
      }
      score += 1;
    }
    if (/^-\s+/.test(line)) {
      score += 0.5;
    }
  }
  return score >= 2.5;
};

const looksLikeMarkdown = (content: string): boolean => {
  const lines = content.split(/\r?\n/).slice(0, 20);
  let score = 0;
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      score += 1.25;
    } else if (/^[-*+]\s+/.test(line)) {
      score += 0.75;
    } else if (/^```/.test(line)) {
      score += 1;
    } else if (/\[(.*?)\]\((.*?)\)/.test(line)) {
      score += 0.5;
    }
  }
  return score >= 2.0;
};

const looksLikeHtml = (content: string): boolean => {
  const sample = content.slice(0, 200).toLowerCase();
  return /<(!doctype\s+)?html/.test(sample) || /<head>/.test(sample) || /<body>/.test(sample);
};

const looksLikeDockerfile = (content: string): boolean => {
  const lines = content.split(/\r?\n/).slice(0, 40);
  let sawFromInstruction = false;
  let score = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (/^from\s+\S+/i.test(line)) {
      sawFromInstruction = true;
      score += 2;
      continue;
    }
    if (/^(run|cmd|copy|add|entrypoint|env|arg|workdir|expose|user|label|volume|healthcheck|shell)\b/i.test(line)) {
      score += 1;
    }
  }

  return sawFromInstruction && score >= 2;
};

const detectProgrammingLanguage = (content: string): string | null => {
  const sample = content.slice(0, 2000);
  if (/@startuml/i.test(sample)) {
    return 'plantuml';
  }
  if (/\bimport\s+.+from\s+['"].+['"]/m.test(sample) || /\bexport\s+(type|interface|const|function|class)/m.test(sample) || /:\s*[A-Za-z_][A-Za-z0-9_]*\s*(;|=)/m.test(sample)) {
    return 'typescript';
  }
  if (/\bmodule\.exports\b/.test(sample) || /\brequire\(['"]/m.test(sample) || /function\s+[A-Za-z_]/.test(sample)) {
    return 'javascript';
  }
  if (/\bdef\s+[A-Za-z_]/.test(sample) || /\bimport\s+[A-Za-z_.]+/m.test(sample)) {
    return 'python';
  }
  if (/\bclass\s+[A-Z][A-Za-z0-9_]*\s*\{/m.test(sample) && /System\.out\.println/.test(sample)) {
    return 'java';
  }
  if (/using\s+System/.test(sample) || /namespace\s+[A-Za-z0-9_.]+/.test(sample)) {
    return 'csharp';
  }
  if (/^\s*#include\s+<.+>/m.test(sample)) {
    return 'cpp';
  }
  if (/package\s+[A-Za-z0-9_.]+;/.test(sample)) {
    return 'java';
  }
  if (/fn\s+[a-zA-Z_]/.test(sample) && /let\s+mut/.test(sample)) {
    return 'rust';
  }
  if (/\bfunc\s+[A-Za-z_]/.test(sample) && /package\s+main/.test(sample)) {
    return 'go';
  }
  if (/^\s*SELECT\s+/im.test(sample) && /FROM\s+/im.test(sample)) {
    return 'sql';
  }
  if (/^\s*<\?xml/m.test(sample)) {
    return 'xml';
  }
  return null;
};

export const classifyDocumentContent = (options: ClassificationOptions): ClassificationResult => {
  const title = options.title?.trim() ?? null;
  const content = options.content ?? '';
  const trimmed = content.trim();
  const extension = title && title.includes('.') ? title.split('.').pop()?.toLowerCase() ?? null : null;
  const normalizedTitle = title?.toLowerCase() ?? null;

  if (!trimmed) {
    return classifyWith('markdown', 'prompt', null, 0, 'Empty content – defaulted to Markdown', [], true);
  }

  if (trimmed.length < 20) {
    return classifyWith('markdown', 'prompt', null, 0.1, 'Content under 20 characters – defaulted to Markdown', [], true);
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';

  if (trimmed.startsWith(PDF_DATA_URI_PREFIX)) {
    return classifyWith('pdf', 'pdf', 'preview', 1, 'Detected PDF data URI');
  }
  if (trimmed.startsWith(IMAGE_DATA_URI_PREFIX) || /^<svg[\s>]/i.test(trimmed)) {
    return classifyWith('image', 'image', 'preview', 1, 'Detected image payload');
  }

  if (extension) {
    const langFromExtension = mapExtensionToLanguageId(extension);
    if (langFromExtension === 'pdf') {
      return classifyWith('pdf', 'pdf', 'preview', 1, 'Extension indicates PDF');
    }
    if (langFromExtension === 'image') {
      return classifyWith('image', 'image', 'preview', 1, 'Extension indicates image');
    }
    if (langFromExtension === 'markdown') {
      return classifyWith('markdown', 'prompt', null, 0.65, 'Extension indicates Markdown');
    }
    if (langFromExtension === 'plantuml') {
      return classifyWith('plantuml', 'source_code', 'split-vertical', 0.8, 'Extension indicates PlantUML');
    }
    if (langFromExtension === 'html') {
      return classifyWith('html', 'rich_text', null, 0.75, 'Extension indicates HTML');
    }
    if (langFromExtension !== 'plaintext') {
      return classifyWith(langFromExtension, 'source_code', null, 0.7, `Extension indicates ${langFromExtension}`);
    }
  }

  if (normalizedTitle === 'dockerfile') {
    return classifyWith('dockerfile', 'source_code', null, 0.85, 'Filename indicates Dockerfile');
  }

  if (/^@startuml/i.test(trimmed)) {
    return classifyWith('plantuml', 'source_code', 'split-vertical', 0.85, 'Detected PlantUML directive');
  }

  if (looksLikeDockerfile(trimmed)) {
    return classifyWith('dockerfile', 'source_code', null, 0.8, 'Dockerfile instruction heuristics matched');
  }

  if (tryParseJson(trimmed)) {
    return classifyWith('json', 'source_code', null, 0.9, 'JSON parse succeeded');
  }

  if (looksLikeHtml(trimmed)) {
    return classifyWith('html', 'rich_text', null, 0.75, 'HTML tag heuristics matched');
  }

  if (looksLikeYaml(trimmed)) {
    return classifyWith('yaml', 'source_code', null, 0.75, 'YAML mapping heuristics matched');
  }

  const shebangLanguage = detectFromShebang(firstLine);
  if (shebangLanguage) {
    return classifyWith(shebangLanguage, 'source_code', null, 0.85, 'Detected language from shebang');
  }

  const inferredLang = detectProgrammingLanguage(trimmed);
  if (inferredLang) {
    const defaultViewMode = inferredLang === 'plantuml' ? 'split-vertical' : null;
    const docType: DocType = inferredLang === 'plantuml' ? 'source_code' : 'source_code';
    return classifyWith(inferredLang, docType, defaultViewMode, 0.7, `Content heuristics matched ${inferredLang}`);
  }

  if (looksLikeMarkdown(trimmed)) {
    return classifyWith('markdown', 'prompt', null, 0.6, 'Markdown syntax heuristics matched');
  }

  const warnings = ['Heuristics could not determine a confident match; defaulted to Markdown.'];
  return classifyWith('markdown', 'prompt', null, 0.2, 'Fallback to Markdown', warnings, true);
};

export type { ClassificationResult, ClassificationOptions };

import { describe, expect, it } from 'vitest';

import { classifyDocumentContent } from '../classificationService';

describe('classificationService', () => {
  it('classifies shell shebang content as source code', () => {
    const result = classifyDocumentContent({
      content: '#!/bin/bash\necho "Hello"\n',
      title: 'script.sh',
    });

    expect(result.languageHint).toBe('shell');
    expect(result.docType).toBe('source_code');
    expect(result.summary.primaryMatch).toContain('Extension indicates shell');
  });

  it('classifies PowerShell scripts by extension', () => {
    const result = classifyDocumentContent({
      content: 'Write-Host "Hello"\nWrite-Output (Get-Date)\n',
      title: 'script.ps1',
    });

    expect(result.languageHint).toBe('powershell');
    expect(result.docType).toBe('source_code');
    expect(result.summary.primaryMatch).toContain('Extension indicates powershell');
  });

  it('classifies Dockerfiles by filename when no extension exists', () => {
    const result = classifyDocumentContent({
      content: 'FROM node:20-alpine\nCMD ["node", "index.js"]\n',
      title: 'Dockerfile',
    });

    expect(result.languageHint).toBe('dockerfile');
    expect(result.docType).toBe('source_code');
    expect(result.summary.primaryMatch).toContain('Filename indicates Dockerfile');
  });

  it('classifies Dockerfiles by heuristics when filename is missing', () => {
    const result = classifyDocumentContent({
      content: '# syntax=docker/dockerfile:1\n\nFROM ubuntu:24.04\nRUN apt-get update && apt-get install -y curl\n',
    });

    expect(result.languageHint).toBe('dockerfile');
    expect(result.docType).toBe('source_code');
    expect(result.summary.primaryMatch).toContain('Dockerfile instruction heuristics matched');
  });

  it('classifies SVG files by extension as docType image and languageHint xml', () => {
    const result = classifyDocumentContent({
      content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
      title: 'icon.svg',
    });

    expect(result.languageHint).toBe('xml');
    expect(result.docType).toBe('image');
    expect(result.defaultViewMode).toBe('preview');
    expect(result.summary.primaryMatch).toContain('Extension indicates SVG image');
  });

  it('classifies SVG content with XML prolog as docType image and languageHint xml', () => {
    const result = classifyDocumentContent({
      content: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  <rect width="100" height="100" fill="red"/>\n</svg>',
      title: 'diagram.svg',
    });

    expect(result.languageHint).toBe('xml');
    expect(result.docType).toBe('image');
    expect(result.defaultViewMode).toBe('preview');
  });

  it('classifies general XML files without SVG as docType source_code', () => {
    const result = classifyDocumentContent({
      content: '<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n</project>',
      title: 'pom.xml',
    });

    expect(result.languageHint).toBe('xml');
    expect(result.docType).toBe('source_code');
    expect(result.defaultViewMode).toBeNull();
  });
});

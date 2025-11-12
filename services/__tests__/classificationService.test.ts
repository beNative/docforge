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

  it('classifies HTML content as rich text', () => {
    const result = classifyDocumentContent({
      content: '<!doctype html>\n<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
      title: 'index.html',
    });

    expect(result.languageHint).toBe('html');
    expect(result.docType).toBe('rich_text');
    expect(result.defaultViewMode).toBe('edit');
    expect(result.summary.primaryMatch).toContain('Extension indicates HTML');
  });
});

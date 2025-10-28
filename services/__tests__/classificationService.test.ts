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
});

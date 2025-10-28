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
});

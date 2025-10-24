let isTomlRegistered = false;

const TOML_LANGUAGE_CONFIGURATION = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['[', ']'],
    ['{', '}'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: '\'', close: '\'', notIn: ['string', 'comment'] },
  ],
  surroundingPairs: [
    { open: '"', close: '"' },
    { open: '\'', close: '\'' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
  ],
};

const TOML_TOKENS_PROVIDER = {
  defaultToken: '',
  tokenPostfix: '.toml',
  brackets: [
    { open: '[', close: ']', token: 'delimiter.bracket' },
    { open: '{', close: '}', token: 'delimiter.bracket' },
  ],
  keywords: ['true', 'false', 'nan', 'inf', '+inf', '-inf', '+nan', '-nan'],
  tokenizer: {
    root: [
      { include: '@whitespace' },
      [/\[(?=\[)/, { token: 'delimiter.bracket', next: '@arrayTable' }],
      [/\[[^\]]*\]/, 'type.identifier'],
      [/([A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+)*)\s*(?==)/, 'key'],
      [/=/, 'delimiter'],
      [/[,]/, 'delimiter'],
      [/\{/, 'delimiter.bracket'],
      [/\}/, 'delimiter.bracket'],
      [/"""/, { token: 'string.quote', next: '@multiBasicString' }],
      [/'''/, { token: 'string.quote', next: '@multiLiteralString' }],
      [/"/, { token: 'string.quote', next: '@basicString' }],
      [/\'/, { token: 'string.quote', next: '@literalString' }],
      [/0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*/, 'number'],
      [/0o[0-7](?:_?[0-7])*/, 'number'],
      [/0b[01](?:_?[01])*/, 'number'],
      [/\b[+-]?(?:inf|nan)\b/, 'keyword'],
      [/\b(?:true|false)\b/, 'keyword'],
      [/[+-]?(?:0|[1-9](?:_?\d)*)(?:\.\d+(?:_?\d)*)?(?:[eE][+-]?\d+(?:_?\d)*)?/, 'number'],
      [/[^\s#=\[\]{}",]+/, 'identifier'],
    ],

    arrayTable: [
      [/\]\]/, { token: 'delimiter.bracket', next: '@pop' }],
      [/[^\]]+/, 'type.identifier'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/#.*$/, 'comment'],
    ],

    basicString: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],

    multiBasicString: [
      [/"""/, { token: 'string.quote', next: '@pop' }],
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string'],
    ],

    literalString: [
      [/[^']+/, 'string'],
      [/\'/, { token: 'string.quote', next: '@pop' }],
    ],

    multiLiteralString: [
      [/'''/, { token: 'string.quote', next: '@pop' }],
      [/[^']+/, 'string'],
    ],
  },
};

const isTableHeader = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith('#')) {
    return false;
  }
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return false;
  }
  return !trimmed.includes('=');
};

export const registerTomlLanguage = (monacoApi: any): void => {
  if (!monacoApi || isTomlRegistered) {
    return;
  }

  isTomlRegistered = true;

  monacoApi.languages.register({
    id: 'toml',
    extensions: ['.toml'],
    aliases: ['TOML', 'toml'],
    mimetypes: ['application/toml'],
  });

  monacoApi.languages.setLanguageConfiguration('toml', TOML_LANGUAGE_CONFIGURATION);
  monacoApi.languages.setMonarchTokensProvider('toml', TOML_TOKENS_PROVIDER);

  monacoApi.languages.registerFoldingRangeProvider('toml', {
    provideFoldingRanges(model: any) {
      const ranges: { start: number; end: number }[] = [];
      const lineCount = model.getLineCount();
      let currentHeaderLine: number | null = null;

      for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
        const text = model.getLineContent(lineNumber);

        if (isTableHeader(text)) {
          if (currentHeaderLine !== null) {
            const end = lineNumber - 1;
            if (end > currentHeaderLine) {
              ranges.push({ start: currentHeaderLine, end });
            }
          }
          currentHeaderLine = lineNumber;
        }
      }

      if (currentHeaderLine !== null) {
        const end = lineCount;
        if (end > currentHeaderLine) {
          ranges.push({ start: currentHeaderLine, end });
        }
      }

      return ranges;
    },
  });
};

export default registerTomlLanguage;

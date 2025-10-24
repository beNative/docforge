let isPlantumlRegistered = false;

const PLANTUML_LANGUAGE_CONFIGURATION = {
  comments: {
    lineComment: "'",
    blockComment: ["/'", "'/"],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
    ['<', '>'],
  ],
  autoClosingPairs: [
    { open: '"', close: '"', notIn: ['string'] },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '<', close: '>' },
  ],
  surroundingPairs: [
    { open: '"', close: '"' },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '<', close: '>' },
  ],
};

const DIRECTIVE_KEYWORDS = [
  '!assert',
  '!author',
  '!comment',
  '!define',
  '!elif',
  '!else',
  '!endcomment',
  '!enddefinelong',
  '!endif',
  '!endfunction',
  '!endprocedure',
  '!endscope',
  '!enduml',
  '!endwhile',
  '!exit',
  '!function',
  '!ifdef',
  '!ifndef',
  '!import',
  '!include',
  '!include_many',
  '!include_once',
  '!local',
  '!pragma',
  '!procedure',
  '!return',
  '!scope',
  '!unquoted',
  '!var',
  '!while',
];

const STRUCTURE_KEYWORDS = [
  '@startuml',
  '@enduml',
  '@startmindmap',
  '@endmindmap',
  '@startwbs',
  '@endwbs',
  '@startgantt',
  '@endgantt',
  '@startsalt',
  '@endsalt',
  'abstract',
  'actor',
  'activate',
  'alt',
  'autonumber',
  'boundary',
  'break',
  'card',
  'caption',
  'class',
  'cloud',
  'collections',
  'component',
  'control',
  'critical',
  'database',
  'deactivate',
  'destroy',
  'detach',
  'else',
  'elseif',
  'end',
  'endif',
  'endwhile',
  'entity',
  'enum',
  'file',
  'folder',
  'frame',
  'group',
  'hide',
  'if',
  'interface',
  'legend',
  'loop',
  'namespace',
  'node',
  'note',
  'object',
  'package',
  'page',
  'partition',
  'queue',
  'rectangle',
  'ref',
  'repeat',
  'return',
  'right',
  'left',
  'top',
  'bottom',
  'skin',
  'skinparam',
  'start',
  'state',
  'stop',
  'title',
  'usecase',
];

const PLANTUML_TOKENS_PROVIDER = {
  defaultToken: '',
  tokenPostfix: '.plantuml',
  ignoreCase: true,
  brackets: [
    { open: '{', close: '}', token: 'delimiter.bracket' },
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
    { open: '<', close: '>', token: 'delimiter.angle' },
  ],
  keywords: [...DIRECTIVE_KEYWORDS, ...STRUCTURE_KEYWORDS],
  operators: [
    '->', '-->', '=>', '<--', '<-', '<->', '\\--', '\\==', '\\..', '..', '--', '==', '++', '--', '||', '|>', '<|', 'o|', '|o', 'o--', '==>', '<==',
  ],
  tokenizer: {
    root: [
      { include: '@whitespace' },
      [/\/'/, { token: 'comment', next: '@blockComment' }],
      [/'.*$/, 'comment'],
      [/!\w+/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier',
        },
      }],
      [/@[a-zA-Z][\w-]*/, 'keyword'],
      [/"/, { token: 'string.quote', next: '@string' }],
      [/[0-9]+(?:\.[0-9]+)?/, 'number'],
      [/[-=+*/<>!]+/, 'operator'],
      [/[^\s{}()[\]<>"']+/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier',
        },
      }],
    ],

    string: [
      [/[^"\\]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],

    blockComment: [
      [/[^']+/, 'comment'],
      [/\'\//, { token: 'comment', next: '@pop' }],
      [/./, 'comment'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
    ],
  },
};

export const registerPlantumlLanguage = (monacoApi: any): void => {
  if (!monacoApi || isPlantumlRegistered) {
    return;
  }

  isPlantumlRegistered = true;

  monacoApi.languages.register({
    id: 'plantuml',
    extensions: ['.puml', '.plantuml', '.iuml', '.uml'],
    aliases: ['PlantUML', 'plantuml', 'puml', 'uml'],
    mimetypes: ['text/x-plantuml', 'text/plantuml'],
  });

  monacoApi.languages.setLanguageConfiguration('plantuml', PLANTUML_LANGUAGE_CONFIGURATION);
  monacoApi.languages.setMonarchTokensProvider('plantuml', PLANTUML_TOKENS_PROVIDER);
};

export default registerPlantumlLanguage;

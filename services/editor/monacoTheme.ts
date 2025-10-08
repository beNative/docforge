export type MonacoThemeVariant = 'light' | 'dark';

const NO_BORDER_COLOR = '#00000000';

const sanitizeHighlightColor = (value: string): string => {
  const trimmed = (value || '').trim();
  return trimmed || '#fff59d';
};

export const defineDocforgeTheme = (
  monacoApi: any,
  variant: MonacoThemeVariant,
  highlightColor: string,
): string => {
  if (!monacoApi?.editor?.defineTheme) {
    return variant === 'dark' ? 'vs-dark' : 'vs';
  }

  const base = variant === 'dark' ? 'vs-dark' : 'vs';
  const themeName = variant === 'dark' ? 'docforge-dark' : 'docforge-light';
  const resolvedHighlight = sanitizeHighlightColor(highlightColor);

  monacoApi.editor.defineTheme(themeName, {
    base,
    inherit: true,
    rules: [],
    colors: {
      'editor.lineHighlightBackground': resolvedHighlight,
      'editor.lineHighlightBorder': NO_BORDER_COLOR,
    },
  });

  return themeName;
};

export const applyDocforgeTheme = (
  monacoApi: any,
  variant: MonacoThemeVariant,
  highlightColor: string,
): string => {
  const themeName = defineDocforgeTheme(monacoApi, variant, highlightColor);
  if (monacoApi?.editor?.setTheme) {
    monacoApi.editor.setTheme(themeName);
  }
  return themeName;
};


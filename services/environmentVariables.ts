export const parseEnvironmentJson = (value: string): Record<string, string> => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid JSON: ${error.message}`
        : 'Environment variables must be valid JSON.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Environment variables must be expressed as a JSON object.');
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(parsed)) {
    if (!key) continue;
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    result[key] = String(rawValue);
  }
  return result;
};

export const stringifyEnvironmentJson = (
  value: Record<string, string>,
  pretty: boolean = true
): string => {
  if (!pretty) {
    return JSON.stringify(value);
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const sorted: Record<string, string> = {};
  for (const [key, val] of entries) {
    sorted[key] = val;
  }
  return JSON.stringify(sorted, null, 2);
};

export const mergeEnvironmentVariables = (
  defaults: Record<string, string>,
  overrides: Record<string, string>
): Record<string, string> => {
  return {
    ...defaults,
    ...overrides,
  };
};

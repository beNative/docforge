/**
 * Validates whether a candidate string is a supported web/local URL.
 */
export const isValidWebUrl = (candidate: string): boolean => {
  if (!candidate || typeof candidate !== 'string') return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  // Standard web protocols or local file protocol
  if (/^(https?|file):\/\/\S+/i.test(trimmed)) {
    return true;
  }

  // Localhost or direct IP addresses with port or path
  if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/\S*)?$/i.test(trimmed)) {
    return true;
  }

  return false;
};

/**
 * Normalizes a URL string to have a valid protocol scheme if missing.
 */
export const normalizeUrlScheme = (url: string): string => {
  const trimmed = url.trim();
  if (/^(https?|file):\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
};

/**
 * Extracts a dropped URL and optional title from a DataTransfer event.
 * Guarded against large payloads to prevent UI thread freezes.
 */
export const getDroppedUrl = (dataTransfer: DataTransfer): string | null => {
  let url: string | null = null;

  // 1. Try text/uri-list (RFC 2483: lines starting with # are comments)
  try {
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      const lines = uriList.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && isValidWebUrl(trimmed)) {
          url = normalizeUrlScheme(trimmed);
          break;
        }
      }
    }
  } catch {
    // Ignore DataTransfer read errors
  }

  // 2. Try Firefox's specific format (URL\nTitle)
  if (!url) {
    try {
      const mozUrl = dataTransfer.getData('text/x-moz-url');
      if (mozUrl) {
        const lines = mozUrl.split(/[\r\n]+/);
        const firstLine = lines[0]?.trim();
        if (firstLine && isValidWebUrl(firstLine)) {
          const title = lines[1]?.trim();
          url = title ? `${normalizeUrlScheme(firstLine)}\n${title}` : normalizeUrlScheme(firstLine);
        }
      }
    } catch {
      // Ignore
    }
  }

  // 3. Try standard URL or url
  if (!url) {
    try {
      const directUrl = dataTransfer.getData('URL') || dataTransfer.getData('url');
      if (directUrl) {
        const trimmed = directUrl.trim();
        if (isValidWebUrl(trimmed)) {
          url = normalizeUrlScheme(trimmed);
        }
      }
    } catch {
      // Ignore
    }
  }

  // 4. Try text/plain (strictly inspect only the first 2 lines to avoid freezing on megabytes of text)
  if (!url) {
    try {
      const plainText = dataTransfer.getData('text/plain')?.trim();
      if (plainText) {
        const lines = plainText.split(/[\r\n]+/, 3);
        const firstLine = lines[0]?.trim();
        if (firstLine && isValidWebUrl(firstLine)) {
          const secondLine = lines[1]?.trim();
          const hasTitle = secondLine && !isValidWebUrl(secondLine) && secondLine.length < 150;
          url = hasTitle
            ? `${normalizeUrlScheme(firstLine)}\n${secondLine}`
            : normalizeUrlScheme(firstLine);
        }
      }
    } catch {
      // Ignore
    }
  }

  // 5. Try text/html (safely bounded to max 32KB to avoid ReDoS / DOM parsing lag)
  if (!url) {
    try {
      const rawHtml = dataTransfer.getData('text/html');
      if (rawHtml) {
        const boundedHtml = rawHtml.length > 32768 ? rawHtml.slice(0, 32768) : rawHtml;
        if (typeof DOMParser !== 'undefined') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(boundedHtml, 'text/html');
          const anchor = doc.querySelector('a[href]');
          if (anchor) {
            const href = anchor.getAttribute('href')?.trim();
            if (href && isValidWebUrl(href)) {
              const text = (anchor.textContent || anchor.getAttribute('title') || '').trim();
              const cleanTitle = text && text.length < 150 ? text : '';
              url = cleanTitle
                ? `${normalizeUrlScheme(href)}\n${cleanTitle}`
                : normalizeUrlScheme(href);
            }
          }
        } else {
          // Fallback regex bounded to 2KB
          const smallSample = boundedHtml.slice(0, 2048);
          const match = smallSample.match(/href=["']([^"']+)["']/i);
          if (match && match[1] && isValidWebUrl(match[1].trim())) {
            url = normalizeUrlScheme(match[1].trim());
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!url) return null;

  // Final sanity check on first line
  const [firstLine] = url.split(/[\r\n]+/, 1);
  if (firstLine && isValidWebUrl(firstLine.trim())) {
    return url;
  }

  return null;
};

export const getCleanTitleFromUrl = (urlString: string): string => {
  try {
    const normalized = normalizeUrlScheme(urlString);
    const url = new URL(normalized);
    let title = url.hostname.replace(/^www\./i, '');
    if (url.pathname && url.pathname !== '/') {
      const cleanPath = url.pathname.replace(/\/+$/, '');
      if (cleanPath) {
        title += cleanPath;
      }
    }
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    return title || urlString;
  } catch {
    return urlString.length > 60 ? urlString.substring(0, 57) + '...' : urlString;
  }
};

export const getDroppedUrl = (dataTransfer: DataTransfer): string | null => {
  // 1. Try text/uri-list
  let url = dataTransfer.getData('text/uri-list');
  
  // 2. Try Firefox's specific format
  if (!url) {
    const mozUrl = dataTransfer.getData('text/x-moz-url');
    if (mozUrl) {
      url = mozUrl.split(/[\r\n]+/)[0]?.trim();
    }
  }

  // 3. Try URL or url
  if (!url) {
    url = dataTransfer.getData('URL') || dataTransfer.getData('url');
  }

  // 4. Try text/plain (might be a selection or fallback)
  if (!url) {
    const plainText = dataTransfer.getData('text/plain')?.trim();
    if (plainText) {
      const lines = plainText.split(/[\r\n]+/);
      const firstLine = lines[0]?.trim();
      if (firstLine && /^https?:\/\/\S+$/i.test(firstLine)) {
        url = plainText;
      }
    }
  }

  // 5. Try text/html (extract href from <a> tags)
  if (!url) {
    const htmlText = dataTransfer.getData('text/html');
    if (htmlText) {
      const match = htmlText.match(/href="([^"]+)"/i) || htmlText.match(/href='([^']+)'/i);
      if (match && match[1]) {
        const href = match[1].trim();
        if (/^https?:\/\/\S+$/i.test(href)) {
          url = href;
        }
      }
    }
  }

  if (!url) return null;

  const cleaned = url.trim();
  const lines = cleaned.split(/[\r\n]+/);
  const firstLine = lines[0]?.trim();

  if (firstLine && /^https?:\/\/\S+$/i.test(firstLine)) {
    return cleaned;
  }

  return null;
};

export const getCleanTitleFromUrl = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    let title = url.hostname;
    if (url.pathname && url.pathname !== '/') {
      title += url.pathname;
    }
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    return title;
  } catch {
    return urlString;
  }
};

export const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) {
        return '';
    }

    if (/^[a-zA-Z][\w+.-]*:/.test(trimmed)) {
        return trimmed;
    }

    return `https://${trimmed}`;
};

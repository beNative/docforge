import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: () => null,
  Theme: {
    DARK: 'dark',
    LIGHT: 'light',
  },
}));

// Mock matchMedia for components relying on it (e.g. theme detection)
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

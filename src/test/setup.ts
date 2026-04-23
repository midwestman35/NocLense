import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    switch (command) {
      case 'keyring_is_available':
        return false;
      case 'keyring_get':
        return null;
      case 'keyring_list':
        return [];
      case 'legacy_secure_storage_read':
        return {};
      default:
        return undefined;
    }
  }),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  readTextFile: vi.fn(),
}));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// Ensure React DOM is reset between tests.
afterEach(() => {
  cleanup();
});


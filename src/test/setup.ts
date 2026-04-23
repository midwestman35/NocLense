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
      case 'report_runtime_error':
        return { reportId: 'report-test' };
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
  open: vi.fn(async () => ({
    read: vi.fn(async () => null),
    seek: vi.fn(async () => 0),
    close: vi.fn(async () => undefined),
  })),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  stat: vi.fn(async () => ({
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 0,
    mtime: null,
    atime: null,
    birthtime: null,
    readonly: false,
    fileAttributes: null,
    dev: null,
    ino: null,
    mode: null,
    nlink: null,
    uid: null,
    gid: null,
    rdev: null,
    blksize: null,
    blocks: null,
  })),
  SeekMode: {
    Start: 0,
    Current: 1,
    End: 2,
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(async () => undefined),
  listen: vi.fn(async () => vi.fn()),
  once: vi.fn(async () => vi.fn()),
}));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// Ensure React DOM is reset between tests.
afterEach(() => {
  cleanup();
});


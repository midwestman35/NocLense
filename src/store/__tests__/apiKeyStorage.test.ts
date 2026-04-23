import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { resetCredentialsForTest } from '../../services/credentials';
import { loadApiKey, migrateFromLocalStorage, saveApiKey } from '../apiKeyStorage';

const invokeMock = vi.mocked(invoke);
const GEMINI_KEY = 'noclense_ai_api_key_gemini';
const LEGACY_GEMINI_KEY = 'noclense_ai_api_key';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Storage;
}

function clearTestStorage(): void {
  localStorage.removeItem(GEMINI_KEY);
  localStorage.removeItem(LEGACY_GEMINI_KEY);
}

describe('apiKeyStorage', () => {
  beforeEach(() => {
    const storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });

    invokeMock.mockReset();
    resetCredentialsForTest();
    clearTestStorage();
  });

  it('saves to localStorage when the keyring is unavailable', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'keyring_is_available') {
        return false;
      }
      return undefined;
    });

    await saveApiKey('gemini', 'local-only-key');

    expect(localStorage.getItem(GEMINI_KEY)).toBe('local-only-key');
    expect(localStorage.getItem(LEGACY_GEMINI_KEY)).toBe('local-only-key');
  });

  it('loads directly from the keyring when a value already exists', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      switch (command) {
        case 'keyring_is_available':
          return true;
        case 'keyring_get':
          return 'from-keyring';
        default:
          return undefined;
      }
    });

    await expect(loadApiKey('gemini')).resolves.toBe('from-keyring');
    expect(invokeMock).not.toHaveBeenCalledWith('legacy_secure_storage_read', expect.anything());
  });

  it('migrates legacy secure-storage values into the keyring before clearing localStorage', async () => {
    localStorage.setItem(GEMINI_KEY, 'stale-local-value');

    invokeMock.mockImplementation(async (command: string) => {
      switch (command) {
        case 'keyring_is_available':
          return true;
        case 'keyring_list':
          return [];
        case 'legacy_secure_storage_read':
          return {
            [GEMINI_KEY]: 'migrated-from-safe-storage',
          };
        case 'keyring_set':
          return undefined;
        default:
          return undefined;
      }
    });

    await expect(migrateFromLocalStorage()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('legacy_secure_storage_read', {
      keys: [
        'noclense_ai_api_key_gemini',
        'noclense_ai_api_key_claude',
        'noclense_ai_api_key_codex',
        'noclense_ai_api_key_unleash',
        'noclense_ai_api_key',
      ],
    });
    expect(invokeMock).toHaveBeenCalledWith('keyring_set', {
      service: 'com.axon.noclense',
      key: 'gemini',
      value: 'migrated-from-safe-storage',
    });
    expect(localStorage.getItem(GEMINI_KEY)).toBeNull();
  });
});

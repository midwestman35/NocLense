import type { AIProviderId } from '../types/ai';

const STORAGE_KEY_API_KEY = 'noclense_ai_api_key';
const PROVIDERS: AIProviderId[] = ['gemini', 'claude', 'codex'];

function getProviderStorageKey(provider: AIProviderId): string {
  return `${STORAGE_KEY_API_KEY}_${provider}`;
}

function isElectronBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

function hasSecureStorageBridge(): boolean {
  return Boolean(
    window.electronAPI?.isSecureStorageAvailable &&
      window.electronAPI?.getSecureStorage &&
      window.electronAPI?.setSecureStorage &&
      window.electronAPI?.migrateToSecureStorage
  );
}

function loadApiKeyFromLocalStorage(provider: AIProviderId): string | null {
  try {
    const scoped = localStorage.getItem(getProviderStorageKey(provider));
    if (scoped) {
      return scoped;
    }
    if (provider === 'gemini') {
      return localStorage.getItem(STORAGE_KEY_API_KEY);
    }
    return null;
  } catch (error) {
    console.error('Failed to load API key from localStorage:', error);
    return null;
  }
}

function saveApiKeyToLocalStorage(provider: AIProviderId, key: string): void {
  try {
    localStorage.setItem(getProviderStorageKey(provider), key);
    // Keep legacy key for backward compatibility with existing installs.
    if (provider === 'gemini') {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    }
  } catch (error) {
    console.error('Failed to save API key to localStorage:', error);
  }
}

function removeApiKeyFromLocalStorage(provider: AIProviderId): void {
  try {
    localStorage.removeItem(getProviderStorageKey(provider));
    if (provider === 'gemini') {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  } catch (error) {
    console.error('Failed to remove API key from localStorage:', error);
  }
}

async function isSecureStorageAvailable(): Promise<boolean> {
  if (!isElectronBridgeAvailable() || !hasSecureStorageBridge()) {
    return false;
  }

  try {
    const result = await window.electronAPI?.isSecureStorageAvailable?.();
    return Boolean(result?.ok && result.available);
  } catch (error) {
    console.error('Failed checking secure storage availability:', error);
    return false;
  }
}

export async function loadApiKey(provider: AIProviderId): Promise<string | null> {
  const secureAvailable = await isSecureStorageAvailable();
  if (!secureAvailable) {
    return loadApiKeyFromLocalStorage(provider);
  }

  try {
    const secureResult = await window.electronAPI?.getSecureStorage?.(getProviderStorageKey(provider));
    if (secureResult?.ok && secureResult.value) {
      return secureResult.value;
    }

    // Legacy fallback for older single-provider Gemini key.
    if (provider === 'gemini') {
      const legacyResult = await window.electronAPI?.getSecureStorage?.(STORAGE_KEY_API_KEY);
      if (legacyResult?.ok && legacyResult.value) {
        return legacyResult.value;
      }
    }
  } catch (error) {
    console.error('Failed loading API key from secure storage:', error);
  }

  return loadApiKeyFromLocalStorage(provider);
}

export async function saveApiKey(provider: AIProviderId, key: string): Promise<void> {
  const secureAvailable = await isSecureStorageAvailable();
  if (!secureAvailable) {
    saveApiKeyToLocalStorage(provider, key);
    return;
  }

  try {
    const providerResult = await window.electronAPI?.setSecureStorage?.(getProviderStorageKey(provider), key);
    if (!providerResult?.ok) {
      throw new Error(providerResult?.error || 'Unknown secure storage error');
    }

    if (provider === 'gemini') {
      const legacyResult = await window.electronAPI?.setSecureStorage?.(STORAGE_KEY_API_KEY, key);
      if (!legacyResult?.ok) {
        throw new Error(legacyResult?.error || 'Unknown secure storage error');
      }
    }

    removeApiKeyFromLocalStorage(provider);
  } catch (error) {
    console.error('Failed saving API key to secure storage, using localStorage fallback:', error);
    saveApiKeyToLocalStorage(provider, key);
  }
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  const secureAvailable = await isSecureStorageAvailable();
  if (!secureAvailable) {
    return false;
  }

  const valuesToMigrate: Record<string, string> = {};

  for (const provider of PROVIDERS) {
    const key = loadApiKeyFromLocalStorage(provider);
    if (key) {
      valuesToMigrate[getProviderStorageKey(provider)] = key;
      if (provider === 'gemini') {
        valuesToMigrate[STORAGE_KEY_API_KEY] = key;
      }
    }
  }

  if (Object.keys(valuesToMigrate).length === 0) {
    return false;
  }

  try {
    const result = await window.electronAPI?.migrateToSecureStorage?.(valuesToMigrate);
    if (!result?.ok) {
      throw new Error(result?.error || 'Migration failed');
    }

    for (const provider of PROVIDERS) {
      removeApiKeyFromLocalStorage(provider);
    }

    return true;
  } catch (error) {
    console.error('Failed migrating API keys to secure storage:', error);
    return false;
  }
}

export async function getApiKeyStorageStatus(): Promise<{
  isElectron: boolean;
  secureStorageAvailable: boolean;
}> {
  const isElectron = isElectronBridgeAvailable();
  const secureStorageAvailable = await isSecureStorageAvailable();
  return { isElectron, secureStorageAvailable };
}

import { invoke } from '@tauri-apps/api/core';
import { CredentialNotFoundError, credentials } from '../services/credentials';
import type { AIProviderId } from '../types/ai';

const STORAGE_KEY_API_KEY = 'noclense_ai_api_key';
const PROVIDERS: AIProviderId[] = ['gemini', 'claude', 'codex', 'unleash'];

type LegacyKeyMap = Partial<Record<AIProviderId, string>>;

function getProviderStorageKey(provider: AIProviderId): string {
  return `${STORAGE_KEY_API_KEY}_${provider}`;
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

function collectLocalStorageValues(): LegacyKeyMap {
  const values: LegacyKeyMap = {};

  for (const provider of PROVIDERS) {
    const key = loadApiKeyFromLocalStorage(provider);
    if (key) {
      values[provider] = key;
    }
  }

  return values;
}

function mapLegacySecureStorageValues(values: Record<string, string>): LegacyKeyMap {
  const mapped: LegacyKeyMap = {};

  for (const provider of PROVIDERS) {
    const scoped = values[getProviderStorageKey(provider)];
    if (typeof scoped === 'string' && scoped.length > 0) {
      mapped[provider] = scoped;
      continue;
    }

    if (provider === 'gemini') {
      const legacy = values[STORAGE_KEY_API_KEY];
      if (typeof legacy === 'string' && legacy.length > 0) {
        mapped[provider] = legacy;
      }
    }
  }

  return mapped;
}

async function loadLegacyValuesFromTauriSecureStorage(): Promise<LegacyKeyMap> {
  try {
    const values = await invoke<Record<string, string>>('legacy_secure_storage_read', {
      keys: [...PROVIDERS.map(getProviderStorageKey), STORAGE_KEY_API_KEY],
    });

    if (!values || typeof values !== 'object') {
      return {};
    }

    return mapLegacySecureStorageValues(values);
  } catch (error) {
    console.error('Failed reading legacy secure storage via Tauri:', error);
    return {};
  }
}

function hasLegacyValues(values: LegacyKeyMap): boolean {
  return PROVIDERS.some((provider) => typeof values[provider] === 'string' && values[provider]!.length > 0);
}

async function readLegacyValues(): Promise<LegacyKeyMap> {
  const tauriValues = await loadLegacyValuesFromTauriSecureStorage();
  if (hasLegacyValues(tauriValues)) {
    return tauriValues;
  }

  return collectLocalStorageValues();
}

async function isKeyringAvailable(): Promise<boolean> {
  return credentials().isAvailable();
}

async function hasAnyKeyringValues(): Promise<boolean> {
  try {
    const keys = await credentials().list();
    return keys.some((key) => PROVIDERS.includes(key as AIProviderId));
  } catch (error) {
    console.error('Failed listing keyring values:', error);
    return false;
  }
}

async function persistValuesToKeyring(values: LegacyKeyMap): Promise<void> {
  for (const provider of PROVIDERS) {
    const value = values[provider];
    if (typeof value === 'string' && value.length > 0) {
      await credentials().set(provider, value);
    }
  }
}

function clearLocalStorageValues(values: LegacyKeyMap): void {
  for (const provider of PROVIDERS) {
    if (typeof values[provider] === 'string' && values[provider]!.length > 0) {
      removeApiKeyFromLocalStorage(provider);
    }
  }
}

async function migrateLegacyValuesToKeyring(): Promise<LegacyKeyMap> {
  if (!(await isKeyringAvailable())) {
    return {};
  }

  if (await hasAnyKeyringValues()) {
    return {};
  }

  const legacyValues = await readLegacyValues();
  if (!hasLegacyValues(legacyValues)) {
    return {};
  }

  await persistValuesToKeyring(legacyValues);
  clearLocalStorageValues(legacyValues);
  console.info('Migrated legacy API keys into the OS keyring.', {
    providers: PROVIDERS.filter((provider) => legacyValues[provider]),
  });
  return legacyValues;
}

export async function loadApiKey(provider: AIProviderId): Promise<string | null> {
  if (!(await isKeyringAvailable())) {
    return loadApiKeyFromLocalStorage(provider);
  }

  try {
    return await credentials().get(provider);
  } catch (error) {
    if (!(error instanceof CredentialNotFoundError)) {
      console.error('Failed loading API key from the OS keyring:', error);
      return loadApiKeyFromLocalStorage(provider);
    }
  }

  const migratedValues = await migrateLegacyValuesToKeyring();
  return migratedValues[provider] ?? null;
}

export async function saveApiKey(provider: AIProviderId, key: string): Promise<void> {
  if (await isKeyringAvailable()) {
    await credentials().set(provider, key);
    removeApiKeyFromLocalStorage(provider);
    return;
  }

  saveApiKeyToLocalStorage(provider, key);
}

export async function migrateFromLocalStorage(): Promise<boolean> {
  if (!(await isKeyringAvailable())) {
    return false;
  }

  const migratedValues = await migrateLegacyValuesToKeyring();
  return hasLegacyValues(migratedValues);
}

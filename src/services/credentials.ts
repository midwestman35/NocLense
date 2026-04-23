import { invoke } from '@tauri-apps/api/core';
import type { AIProviderId } from '../types/ai';

export type CredentialKey = AIProviderId | 'github_pat';

export interface CredentialsProvider {
  get(key: CredentialKey): Promise<string>;
  set(key: CredentialKey, value: string): Promise<void>;
  delete(key: CredentialKey): Promise<void>;
  list(): Promise<CredentialKey[]>;
  isAvailable(): Promise<boolean>;
  onChange(cb: (key: CredentialKey) => void): () => void;
}

const KEYRING_SERVICE = 'com.axon.noclense';

function isCredentialKey(value: string): value is CredentialKey {
  return (
    value === 'gemini' ||
    value === 'claude' ||
    value === 'codex' ||
    value === 'unleash' ||
    value === 'github_pat'
  );
}

export class CredentialNotFoundError extends Error {
  readonly key: CredentialKey;

  constructor(key: CredentialKey) {
    super(`Credential not found for "${key}"`);
    this.name = 'CredentialNotFoundError';
    this.key = key;
  }
}

export class CredentialInvalidError extends Error {
  readonly key: CredentialKey;
  readonly statusCode?: number;

  constructor(
    key: CredentialKey,
    statusCode?: number,
    message: string = `Credential for "${key}" is invalid`
  ) {
    super(message);
    this.name = 'CredentialInvalidError';
    this.key = key;
    this.statusCode = statusCode;
  }
}

export class LocalKeyringProvider implements CredentialsProvider {
  private cache = new Map<CredentialKey, string>();
  private listeners = new Set<(key: CredentialKey) => void>();

  async get(key: CredentialKey): Promise<string> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await invoke<string | null>('keyring_get', {
      service: KEYRING_SERVICE,
      key,
    });
    if (typeof value !== 'string') {
      throw new CredentialNotFoundError(key);
    }

    this.cache.set(key, value);
    return value;
  }

  async set(key: CredentialKey, value: string): Promise<void> {
    await invoke('keyring_set', {
      service: KEYRING_SERVICE,
      key,
      value,
    });
    this.cache.set(key, value);
    this.notify(key);
  }

  async delete(key: CredentialKey): Promise<void> {
    await invoke('keyring_delete', {
      service: KEYRING_SERVICE,
      key,
    });
    this.cache.delete(key);
    this.notify(key);
  }

  async list(): Promise<CredentialKey[]> {
    const keys = await invoke<string[]>('keyring_list', {
      service: KEYRING_SERVICE,
    });
    return Array.isArray(keys) ? keys.filter(isCredentialKey) : [];
  }

  async isAvailable(): Promise<boolean> {
    try {
      return Boolean(await invoke<boolean>('keyring_is_available'));
    } catch {
      return false;
    }
  }

  onChange(cb: (key: CredentialKey) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(key: CredentialKey): void {
    for (const listener of this.listeners) {
      listener(key);
    }
  }
}

let provider: CredentialsProvider | null = null;

export function initCredentials(nextProvider: CredentialsProvider = new LocalKeyringProvider()): void {
  provider = nextProvider;
}

export function resetCredentialsForTest(): void {
  provider = null;
}

export function credentials(): CredentialsProvider {
  if (!provider) {
    provider = new LocalKeyringProvider();
  }
  return provider;
}

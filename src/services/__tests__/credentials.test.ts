import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  CredentialNotFoundError,
  LocalKeyringProvider,
  credentials,
  initCredentials,
  resetCredentialsForTest,
} from '../credentials';

const invokeMock = vi.mocked(invoke);

describe('LocalKeyringProvider', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    resetCredentialsForTest();
  });

  it('throws CredentialNotFoundError when the key is missing', async () => {
    invokeMock.mockResolvedValueOnce(null);
    const provider = new LocalKeyringProvider();

    await expect(provider.get('gemini')).rejects.toBeInstanceOf(CredentialNotFoundError);
    expect(invokeMock).toHaveBeenCalledWith('keyring_get', {
      service: 'com.axon.noclense',
      key: 'gemini',
    });
  });

  it('caches reads after the first invoke call', async () => {
    invokeMock.mockResolvedValueOnce('cached-value');
    const provider = new LocalKeyringProvider();

    await expect(provider.get('gemini')).resolves.toBe('cached-value');
    await expect(provider.get('gemini')).resolves.toBe('cached-value');

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('updates the cache and notifies listeners on set and delete', async () => {
    invokeMock.mockResolvedValue(undefined);
    const provider = new LocalKeyringProvider();
    const listener = vi.fn();
    provider.onChange(listener);

    await provider.set('claude', 'test-key');
    await expect(provider.get('claude')).resolves.toBe('test-key');
    await provider.delete('claude');

    expect(listener).toHaveBeenNthCalledWith(1, 'claude');
    expect(listener).toHaveBeenNthCalledWith(2, 'claude');
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'keyring_set', {
      service: 'com.axon.noclense',
      key: 'claude',
      value: 'test-key',
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'keyring_delete', {
      service: 'com.axon.noclense',
      key: 'claude',
    });
  });

  it('filters unknown values from keyring_list', async () => {
    invokeMock.mockResolvedValueOnce(['gemini', 'github_pat', 'unexpected']);
    const provider = new LocalKeyringProvider();

    await expect(provider.list()).resolves.toEqual(['gemini', 'github_pat']);
  });
});

describe('credentials singleton', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    resetCredentialsForTest();
  });

  it('returns the provider registered via initCredentials', async () => {
    const provider = new LocalKeyringProvider();
    initCredentials(provider);

    expect(credentials()).toBe(provider);
  });
});

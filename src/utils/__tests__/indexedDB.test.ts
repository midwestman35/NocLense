import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexedDBManager } from '../indexedDB';

function createMockOpenRequest(): IDBOpenDBRequest {
  return {
    error: null,
    onblocked: null,
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
    result: null,
    source: null,
    transaction: null,
    readyState: 'pending',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as IDBOpenDBRequest;
}

describe('IndexedDBManager resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects blocked upgrades with a descriptive error instead of hanging', async () => {
    const request = createMockOpenRequest();
    const open = vi.fn(() => request);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal('indexedDB', { open });

    const manager = new IndexedDBManager();
    const initPromise = manager.init();

    request.onblocked?.(new Event('blocked'));

    await expect(initPromise).rejects.toThrow(/close other tabs and reload/i);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/blocked/i));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('clears a rejected init promise so the next init retries from scratch', async () => {
    const firstRequest = createMockOpenRequest();
    const secondRequest = createMockOpenRequest();
    const fakeDb = {
      close: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
    } as unknown as IDBDatabase;

    const open = vi
      .fn()
      .mockImplementationOnce(() => firstRequest)
      .mockImplementationOnce(() => secondRequest);

    vi.stubGlobal('indexedDB', { open });

    const manager = new IndexedDBManager();
    const firstInit = manager.init();
    (firstRequest as { error: DOMException | null }).error = new DOMException('open failed', 'AbortError');
    firstRequest.onerror?.(new Event('error'));

    await expect(firstInit).rejects.toThrow(/failed to open indexeddb/i);

    const secondInit = manager.init();
    (secondRequest as { result: IDBDatabase | null }).result = fakeDb;
    secondRequest.onsuccess?.(new Event('success'));

    await expect(secondInit).resolves.toBe(fakeDb);
    expect(open).toHaveBeenCalledTimes(2);
  });
});

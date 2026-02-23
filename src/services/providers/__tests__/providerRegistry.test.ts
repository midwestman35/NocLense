import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerRegistry } from '../providerRegistry';

describe('Provider registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns known providers', () => {
    expect(providerRegistry.getProvider('gemini').providerId).toBe('gemini');
    expect(providerRegistry.getProvider('claude').providerId).toBe('claude');
    expect(providerRegistry.getProvider('codex').providerId).toBe('codex');
  });

  it('Claude provider normalizes response shape', async () => {
    const provider = providerRegistry.getProvider('claude');
    provider.initialize('test-claude-key-12345', 'claude-3-5-haiku-latest');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Investigate [Log #123]' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      })
    );

    const response = await provider.analyzeLog('why', 'context');
    expect(response.content).toContain('Investigate');
    expect(response.logReferences).toContain(123);
    expect(response.tokensUsed).toBe(15);
  });

  it('Codex provider normalizes response shape', async () => {
    const provider = providerRegistry.getProvider('codex');
    provider.initialize('test-openai-key-12345', 'gpt-4.1-mini');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: 'Root cause points to log 77',
          usage: { total_tokens: 19 },
        }),
      })
    );

    const response = await provider.analyzeLog('why', 'context');
    expect(response.content).toContain('Root cause');
    expect(response.logReferences).toContain(77);
    expect(response.tokensUsed).toBe(19);
  });
});

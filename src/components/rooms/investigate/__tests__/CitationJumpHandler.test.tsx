import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildCitationUrl, useCitationJumpHandler } from '../CitationJumpHandler';
import type { LogViewerHandle } from '../../../LogViewer';
import type { Citation, CitationId, Investigation } from '../../../../types/canonical';

vi.mock('../../../../store/aiSettings', () => ({
  loadAiSettings: () => ({
    datadogSite: 'datadoghq.com',
    jiraSubdomain: 'carbyne.atlassian.net',
    zendeskSubdomain: 'carbyne',
  }),
}));

describe('CitationJumpHandler', () => {
  it('jumps directly to log citations in the virtualized viewer', () => {
    const citationId = 'cite-log' as CitationId;
    const jumpToCitation = vi.fn();
    const investigation = {
      citations: {
        [citationId]: {
          id: citationId,
          displayText: 'sip.log:128',
          source: { kind: 'log', fileName: 'sip.log', byteOffset: 2048 },
          createdAt: 0,
        },
      },
    } as unknown as Investigation;
    const logViewerRef = { current: { jumpToCitation } as unknown as LogViewerHandle };
    const { result } = renderHook(() => useCitationJumpHandler({ investigation, logViewerRef }));

    act(() => result.current(citationId));

    expect(jumpToCitation).toHaveBeenCalledWith('sip.log', 2048);
  });

  it('opens vendor citations in their source system', () => {
    const citationId = 'cite-zd' as CitationId;
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const citation = {
      id: citationId,
      displayText: 'ZD #41637',
      source: { kind: 'zendesk', ticketId: 41637 },
      createdAt: 0,
    } as unknown as Citation;
    const investigation = { citations: { [citationId]: citation } } as unknown as Investigation;
    const logViewerRef = { current: null };
    const { result } = renderHook(() => useCitationJumpHandler({ investigation, logViewerRef }));

    act(() => result.current(citationId));

    expect(buildCitationUrl(citation)).toBe('https://carbyne.zendesk.com/agent/tickets/41637');
    expect(open).toHaveBeenCalledWith(
      'https://carbyne.zendesk.com/agent/tickets/41637',
      '_blank',
      'noopener,noreferrer',
    );
  });
});

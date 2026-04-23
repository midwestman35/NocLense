import { useCallback, type RefObject } from 'react';
import type { LogViewerHandle } from '../../LogViewer';
import { loadAiSettings } from '../../../store/aiSettings';
import type { Citation, CitationId, Investigation } from '../../../types/canonical';

interface CitationJumpHandlerArgs {
  investigation: Investigation | null;
  logViewerRef: RefObject<LogViewerHandle | null>;
}

export function buildCitationUrl(citation: Citation): string | null {
  const settings = loadAiSettings();

  switch (citation.source.kind) {
    case 'jira':
      return settings.jiraSubdomain
        ? `https://${settings.jiraSubdomain}/browse/${citation.source.key}`
        : null;
    case 'zendesk':
      return settings.zendeskSubdomain
        ? `https://${settings.zendeskSubdomain}.zendesk.com/agent/tickets/${citation.source.ticketId}`
        : null;
    case 'confluence':
      return settings.jiraSubdomain
        ? `https://${settings.jiraSubdomain}/wiki/spaces/${citation.source.spaceKey}/pages/${citation.source.pageId}`
        : null;
    case 'slack':
      return citation.source.messageTs
        ? `https://${citation.source.workspace}.slack.com/archives/${citation.source.channelId}/p${citation.source.messageTs.replace('.', '')}`
        : `https://${citation.source.workspace}.slack.com/archives/${citation.source.channelId}`;
    case 'datadog': {
      const params = new URLSearchParams({
        query: citation.source.query,
        from_ts: String(citation.source.startMs),
        to_ts: String(citation.source.endMs),
        live: 'false',
      });
      return `https://app.${settings.datadogSite}/logs?${params.toString()}`;
    }
    default:
      return null;
  }
}

export function useCitationJumpHandler({
  investigation,
  logViewerRef,
}: CitationJumpHandlerArgs): (citationId: CitationId) => void {
  return useCallback((citationId: CitationId) => {
    const citation = investigation?.citations[citationId];
    if (!citation) return;

    if (citation.source.kind === 'log') {
      logViewerRef.current?.jumpToCitation(citation.source.fileName, citation.source.byteOffset);
      return;
    }

    const url = buildCitationUrl(citation);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [investigation, logViewerRef]);
}

/**
 * investigation.ts
 *
 * Shared types for the Investigation Setup Modal → DiagnoseTab handoff.
 */
import type { ZendeskTicket } from '../services/zendeskService';
import type { DatadogEnrichmentOptions } from '../services/datadogService';
import type { ApexEventData } from '../services/apexEventParser';

export interface InvestigationSetup {
  /** Fully fetched Zendesk ticket */
  ticket: ZendeskTicket;
  /** Customer/requester timezone confirmed by the agent */
  timezone: string;
  /** Attachment IDs the agent chose to import */
  selectedAttachmentIds: number[];
  /** Datadog enrichment options (enabled=false if skipped) */
  ddOpts: DatadogEnrichmentOptions;
  /** APEX event data extracted from PDF attachments (passed as AI context) */
  apexEvents: ApexEventData[];
}

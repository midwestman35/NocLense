/**
 * External Service Type Definitions
 *
 * Purpose:
 * Consolidates types for external service integrations (Zendesk, Datadog, APEX, Jira, Confluence)
 * to avoid duplication and ensure consistent data contracts across the application.
 *
 * @module types/services
 */

// ─── Zendesk Types ───────────────────────────────────────────────────────────

export interface ZendeskAttachment {
  id: number;
  fileName: string;
  contentUrl: string;
  contentType: string;
  size: number;
  /** True when the file is an inline image embed rather than a standalone attachment */
  inline: boolean;
  /** Whether the comment it came from was public-facing or an internal note */
  commentType: 'public' | 'internal';
}

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  tags: string[];
  comments: string[];
  requesterTimezone: string | null;
  orgId: number | null;
  orgName: string | null;
  orgTimezone: string | null;
  attachments: ZendeskAttachment[];
}

export interface ZendeskTicketDraft {
  subject: string;
  description: string;
  requesterEmail?: string;
}

// ─── Datadog Types ───────────────────────────────────────────────────────────

export interface DatadogEnrichmentOptions {
  enabled: boolean;
  /** Datadog API key for enrichment queries */
  apiKey?: string;
  /** Time range in milliseconds to query (default: 1 hour) */
  timeRangeMs?: number;
  /** Include service metrics in enrichment */
  includeMetrics?: boolean;
  /** Include trace data if available */
  includeTraces?: boolean;
}

export interface DatadogLogEntry {
  /** Datadog unique log identifier */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level: debug, info, warn, error, etc. */
  level: string;
  /** Service name that produced the log */
  service: string;
  /** Log message content */
  message: string;
  /** Key-value attributes from the log */
  tags?: Record<string, string>;
  /** Full JSON payload of the log if available */
  json_payload?: Record<string, any>;
}

export interface DatadogStation {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'unknown';
  lastSeen?: number;
  metrics?: Record<string, number>;
}

// ─── APEX Types ──────────────────────────────────────────────────────────────

export interface ApexEventData {
  /** Unique event identifier */
  id: string;
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event type (e.g., "call_start", "call_end", "error") */
  eventType: string;
  /** Associated call ID if applicable */
  callId?: string;
  /** Station or extension involved */
  station?: string;
  /** Event payload/details */
  payload?: Record<string, any>;
  /** Severity: info, warning, error, critical */
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

// ─── Jira Types ──────────────────────────────────────────────────────────────

export interface JiraIssueCreatedResponse {
  /** The newly created Jira issue key (e.g., "INCIDENT-123") */
  key: string;
  /** The Jira issue ID */
  id: string;
  /** URL to view the issue in Jira */
  self: string;
}

// ─── Confluence Types ────────────────────────────────────────────────────────

export interface SavedInvestigation {
  /** Confluence page ID */
  pageId: string;
  /** Investigation title */
  title: string;
  /** Page version/revision number */
  version: number;
  /** Last modified timestamp (ISO 8601) */
  lastModified: string;
  /** URL to the Confluence page */
  url: string;
}

export interface ConfluenceSearchResult {
  /** Result item ID */
  id: string;
  /** Page/article title */
  title: string;
  /** Content type (page, blog, attachment, etc.) */
  type: string;
  /** Brief excerpt of the content */
  excerpt?: string;
  /** URL to the result */
  url: string;
  /** Last modified timestamp */
  lastModified?: string;
  /** Space key where this content lives */
  space?: string;
}

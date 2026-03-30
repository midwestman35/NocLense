/**
 * apexEventParser.ts
 *
 * Parses the text content of a Carbyne APEX Event PDF and extracts
 * structured data that can be used for Datadog lookups and AI context.
 *
 * Typical PDF header: "us-ga-cobb-apex  Export Date: Dec-18-2025 10:44:49"
 * Followed by: Event 8622789 / Dec-17-2025 09:18:51 / Attributes / Transcript / Audit
 *
 * Key extracted fields for Datadog searches:
 *   - callCenterName  → @log.machineData.callCenterName (e.g. "us-ga-cobb-apex")
 *   - station         → operator/station name (e.g. "EC17")
 *   - eventId         → Carbyne event ID (e.g. "8622789")
 */

export interface ApexEventData {
  /** Full CNC / call center name from the PDF header (e.g. "us-ga-cobb-apex") */
  callCenterName: string;
  /** Event ID number */
  eventId: string;
  /** Event date/time as a string */
  eventDateTime: string;
  /** Export date */
  exportDate: string;
  /** Station identifier (e.g. "EC17") */
  station: string;
  /** Agent / operator name */
  agentName: string;
  /** Agent ID (may be "N/A") */
  agentId: string;
  /** Caller phone number */
  phone: string;
  /** Caller name (may be "N/A") */
  callerName: string;
  /** Call direction (Inbound / Outbound) */
  direction: string;
  /** Call type (Emergency / Non-emergency) */
  callType: string;
  /** Queue name */
  queueName: string;
  /** How long the call lasted */
  callTime: string;
  /** How the call ended */
  terminationReason: string;
  /** Whether the call was abandoned */
  abandonedStatus: string;
  /** Full transcript text */
  transcript: string;
  /** Raw full text of the PDF (for AI context) */
  rawText: string;
}

/**
 * Parse APEX event text extracted from a PDF.
 * Returns null if the text doesn't match the expected APEX event format.
 */
export function parseApexEventPdf(text: string): ApexEventData | null {
  // Detect APEX event format — look for "Event NNNN" pattern
  const eventMatch = text.match(/Event\s+(\d{4,})/);
  if (!eventMatch) return null;

  const eventId = eventMatch[1];

  // Extract call center name from header line (first identifiable slug, e.g. "us-ga-cobb-apex")
  // Pattern: lowercase slug with hyphens before "Export Date"
  const cncMatch = text.match(/([a-z]{2}-[a-z]{2}-[\w-]+(?:-apex)?)\s*Export Date/i);
  const callCenterName = cncMatch?.[1]?.toLowerCase() ?? '';

  // Export date
  const exportDateMatch = text.match(/Export Date:\s*(.+?)(?:\n|$)/);
  const exportDate = exportDateMatch?.[1]?.trim() ?? '';

  // Event date/time (line after "Event NNNN")
  const eventDateMatch = text.match(/Event\s+\d+\s*\n?\s*([A-Z][a-z]{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/);
  const eventDateTime = eventDateMatch?.[1]?.trim() ?? '';

  // Helper: extract "Key: Value" from attributes section
  function attr(key: string): string {
    const re = new RegExp(key + ':\\s*(.+?)(?:\\n|$)', 'i');
    const m = text.match(re);
    return m?.[1]?.trim() ?? 'N/A';
  }

  const station = attr('Station');
  const agentName = attr('Agent Name');
  const agentId = attr('Agent ID');
  const phone = attr('Phone');
  const callerName = attr('Caller Name');
  const direction = attr('Direction');
  const callType = attr('Type');
  const queueName = attr('Queue Name');
  const callTime = attr('Call Time');
  const terminationReason = attr('Termination Reason');
  const abandonedStatus = attr('Abandoned Call Status');

  // Extract transcript section (everything between "Transcript" header and "Audit" header)
  const transcriptMatch = text.match(/Transcript\s*\n([\s\S]*?)(?:\nAudit\s*\n|$)/i);
  const transcript = transcriptMatch?.[1]?.trim() ?? '';

  return {
    callCenterName,
    eventId,
    eventDateTime,
    exportDate,
    station,
    agentName,
    agentId,
    phone,
    callerName,
    direction,
    callType,
    queueName,
    callTime,
    terminationReason,
    abandonedStatus,
    transcript,
    rawText: text,
  };
}

/**
 * Build a Datadog search query from extracted APEX event data.
 *
 * Uses the real Datadog field names for Carbyne APEX:
 *   @log.machineData.callCenterName — the CNC name (e.g. us-il-glenview-apex)
 *   @log.machineData.name           — the operator/station name (e.g. us-il-glenview-south-apex-02)
 *     ↑ NOT derivable from the PDF's "Station: EC17" — agent must confirm
 *
 * Also includes the event ID for correlation and service:prod.
 */
export function buildDatadogQueryFromApex(event: ApexEventData): string {
  const parts: string[] = [];

  if (event.callCenterName) {
    parts.push(`@log.machineData.callCenterName:${event.callCenterName}`);
  }

  // Always target production for APEX
  parts.push('service:prod');

  return parts.join(' ');
}

/**
 * Build an event-ID-specific Datadog query to find logs correlated with a specific call.
 * Searches for the event ID in any field (message, attributes, etc.).
 */
export function buildDatadogEventIdQuery(event: ApexEventData): string {
  if (!event.eventId) return '';
  return `*${event.eventId}*`;
}

/**
 * Format APEX event data into a concise text block for AI context.
 */
export function formatApexEventForAi(event: ApexEventData): string {
  const lines: string[] = [
    `APEX EVENT #${event.eventId}`,
    `Call Center: ${event.callCenterName}`,
    `Station: ${event.station}`,
    `Agent: ${event.agentName} (ID: ${event.agentId})`,
    `Date/Time: ${event.eventDateTime}`,
    `Phone: ${event.phone}`,
    `Caller: ${event.callerName}`,
    `Direction: ${event.direction} | Type: ${event.callType} | Queue: ${event.queueName}`,
    `Call Duration: ${event.callTime} | Termination: ${event.terminationReason}`,
    `Abandoned: ${event.abandonedStatus}`,
    '',
    '--- TRANSCRIPT ---',
    event.transcript || '(no transcript)',
  ];
  return lines.join('\n');
}

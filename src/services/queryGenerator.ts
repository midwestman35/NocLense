function formatTimeWindow(timeWindow: { start: number; end: number }): string {
  return `${new Date(timeWindow.start).toISOString()} to ${new Date(timeWindow.end).toISOString()}`;
}

export function generateCloudWatchQuery(
  correlationKeys: Record<string, string>,
  timeWindow: { start: number; end: number }
): string {
  const entries = Object.entries(correlationKeys).filter(([, value]) => value);
  if (entries.length === 0) {
    return `fields @timestamp, @message\n| sort @timestamp asc\n# Add requestId, messageID, cncID, or callId filters before running.\n# Time: ${formatTimeWindow(timeWindow)}`;
  }

  const filterLines = entries.map(([key, value]) => `| filter ${key.startsWith('@') ? key : `@message like /${key}:${value}/`} `);
  return `fields @timestamp, @message\n${filterLines.join('\n')}\n| sort @timestamp asc\n# Time: ${formatTimeWindow(timeWindow)}`;
}

export function generateDatadogQuery(
  service: string | undefined,
  correlationKeys: Record<string, string>,
  timeWindow: { start: number; end: number }
): string {
  const filters = Object.entries(correlationKeys)
    .filter(([, value]) => value)
    .map(([key, value]) => `@${key}:${value}`)
    .join(' ');
  return `${service ? `service:${service} ` : ''}${filters || '# Add correlation filters here'}\n# Time: ${formatTimeWindow(timeWindow)}`;
}

export function generateSIPQuery(callId?: string, status?: string, method?: string): string {
  const filters = [callId && `Call-ID: ${callId}`, method && `Method: ${method}`, status && `Status: ${status}`]
    .filter(Boolean)
    .join('\n');
  return `# SIP Filter\n${filters || 'No filters specified'}`;
}

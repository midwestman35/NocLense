export function generateCloudWatchQuery(requestId: string, timeWindow: { start: number; end: number }): string {
  return `fields @timestamp, @message\n| filter @requestId = "${requestId}"\n| sort @timestamp asc\n# Time: ${new Date(timeWindow.start).toISOString()} to ${new Date(timeWindow.end).toISOString()}`;
}
export function generateDatadogQuery(service: string, correlationKeys: Record<string, string>, timeWindow: { start: number; end: number }): string {
  const filters = Object.entries(correlationKeys).map(([k, v]) => `@${k}:${v}`).join(' ');
  return `service:${service} ${filters}\n# Time: ${new Date(timeWindow.start).toISOString()} to ${new Date(timeWindow.end).toISOString()}`;
}
export function generateSIPQuery(callId?: string, status?: string, method?: string): string {
  const filters = [callId && `Call-ID: ${callId}`, method && `Method: ${method}`, status && `Status: ${status}`].filter(Boolean).join('\n');
  return `# SIP Filter\n${filters || 'No filters specified'}`;
}

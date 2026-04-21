export function extractZendeskTicketId(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const ticketUrlMatch = value.match(/\/tickets\/(\d+)/i);
  if (ticketUrlMatch) {
    return ticketUrlMatch[1];
  }

  const rawTicketMatch = value.match(/^#?\s*(\d+)\s*$/);
  if (rawTicketMatch) {
    return rawTicketMatch[1];
  }

  return null;
}

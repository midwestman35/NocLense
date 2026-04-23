import { searchConfluenceInvestigations } from '../../../services/confluenceService';
import { validateDatadogCredentials } from '../../../services/datadogService';
import { fetchZendeskTicket, type ZendeskTicket } from '../../../services/zendeskService';
import type { AiSettings } from '../../../store/aiSettings';

export type VendorId = 'zendesk' | 'datadog' | 'jira' | 'confluence';

export interface ConnectionResult {
  valid: boolean;
  message: string;
}

export interface SetupContextDraft {
  ticketId: string;
  severity: string;
  timezone: string;
  cnc: string;
  notes: string;
}

export interface AttachmentSelection {
  id: number;
  selected: boolean;
}

export const VENDOR_LABELS: Record<VendorId, string> = {
  zendesk: 'Zendesk',
  datadog: 'Datadog',
  jira: 'Jira',
  confluence: 'Confluence',
};

export const REQUIRED_FIELDS: Record<VendorId, Array<keyof AiSettings>> = {
  zendesk: ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'],
  datadog: ['datadogApiKey', 'datadogAppKey', 'datadogSite'],
  jira: ['jiraSubdomain', 'jiraEmail', 'jiraToken', 'jiraProjectKey'],
  confluence: ['jiraSubdomain', 'jiraEmail', 'jiraToken', 'confluenceSpaceId', 'confluenceParentPageId'],
};

export function vendorConfigured(settings: AiSettings, vendor: VendorId): boolean {
  return REQUIRED_FIELDS[vendor].every((field) => String(settings[field] ?? '').trim().length > 0);
}

export function countConfiguredVendors(settings: AiSettings): number {
  return (Object.keys(VENDOR_LABELS) as VendorId[]).filter((vendor) => vendorConfigured(settings, vendor)).length;
}

export function maskSecret(value: string): string {
  if (!value) return 'not set';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

export async function testVendorConnection(
  vendor: VendorId,
  settings: AiSettings,
  context: SetupContextDraft,
): Promise<ConnectionResult> {
  if (!vendorConfigured(settings, vendor)) {
    return { valid: false, message: `${VENDOR_LABELS[vendor]} configuration is incomplete.` };
  }

  if (vendor === 'datadog') {
    return validateDatadogCredentials(settings);
  }

  if (vendor === 'zendesk') {
    if (!context.ticketId.trim()) {
      return { valid: false, message: 'Enter a Zendesk ticket number before testing.' };
    }
    const ticket = await fetchZendeskTicket(settings, context.ticketId);
    return { valid: true, message: `Loaded ticket #${ticket.id}.` };
  }

  if (vendor === 'confluence') {
    const results = await searchConfluenceInvestigations(settings, ['noc'], 1);
    return { valid: true, message: `Confluence search returned ${results.length} result${results.length === 1 ? '' : 's'}.` };
  }

  return {
    valid: true,
    message: `Jira configuration is present for project ${settings.jiraProjectKey}. Live issue creation remains in Submit.`,
  };
}

export function buildAttachmentSelections(ticket: ZendeskTicket | null): AttachmentSelection[] {
  return (ticket?.attachments ?? []).map((attachment) => ({
    id: attachment.id,
    selected: true,
  }));
}

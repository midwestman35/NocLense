export interface AiSettings {
  endpoint: string;
  token: string;
  assistantId: string;
  userEmail: string;
  zendeskSubdomain: string;
  zendeskEmail: string;
  zendeskToken: string;
  jiraSubdomain: string;
  jiraEmail: string;
  jiraToken: string;
  jiraProjectKey: string;
  datadogApiKey: string;
  datadogAppKey: string;
  datadogSite: string;        // e.g. 'datadoghq.com'
  datadogDefaultIndexes: string; // comma-separated, blank = all
  datadogDefaultHosts: string;   // comma-separated default stations/hosts
  confluenceSpaceId: string;       // Confluence space ID for investigation store
  confluenceParentPageId: string;  // Parent page ID under which investigations are saved
}

const STORAGE_KEY = 'unleash_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  endpoint: 'https://e-api.unleash.so',
  token: '',
  assistantId: '',
  userEmail: '',
  zendeskSubdomain: '',
  zendeskEmail: '',
  zendeskToken: '',
  jiraSubdomain: '',
  jiraEmail: '',
  jiraToken: '',
  jiraProjectKey: '',
  datadogApiKey: '',
  datadogAppKey: '',
  datadogSite: 'datadoghq.com',
  datadogDefaultIndexes: '',
  datadogDefaultHosts: '',
  confluenceSpaceId: '',
  confluenceParentPageId: '',
};

export function loadAiSettings(): AiSettings {
  // Read env vars (baked in at build time)
  const envToken = import.meta.env.VITE_UNLEASH_TOKEN as string | undefined;
  const envAssistantId = import.meta.env.VITE_UNLEASH_ASSISTANT_ID as string | undefined;
  const envUserEmail = import.meta.env.VITE_UNLEASH_USER_EMAIL as string | undefined;
  const envZdSubdomain = import.meta.env.VITE_ZENDESK_SUBDOMAIN as string | undefined;
  const envZdEmail = import.meta.env.VITE_ZENDESK_EMAIL as string | undefined;
  const envZdToken = import.meta.env.VITE_ZENDESK_TOKEN as string | undefined;
  const envJiraSubdomain = import.meta.env.VITE_JIRA_SUBDOMAIN as string | undefined;
  const envJiraEmail = import.meta.env.VITE_JIRA_EMAIL as string | undefined;
  const envJiraToken = import.meta.env.VITE_JIRA_TOKEN as string | undefined;
  const envJiraProjectKey = import.meta.env.VITE_JIRA_PROJECT_KEY as string | undefined;
  const envDdApiKey = import.meta.env.VITE_DATADOG_API_KEY as string | undefined;
  const envDdAppKey = import.meta.env.VITE_DATADOG_APP_KEY as string | undefined;
  const envDdSite = import.meta.env.VITE_DATADOG_SITE as string | undefined;
  const envConfSpaceId = import.meta.env.VITE_CONFLUENCE_SPACE_ID as string | undefined;
  const envConfParentPageId = import.meta.env.VITE_CONFLUENCE_PARENT_PAGE_ID as string | undefined;

  // Env-var base (used as fallback for any field not explicitly saved)
  const envBase: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    token: envToken ?? '',
    assistantId: envAssistantId ?? '',
    userEmail: envUserEmail ?? '',
    zendeskSubdomain: envZdSubdomain ?? '',
    zendeskEmail: envZdEmail ?? '',
    zendeskToken: envZdToken ?? '',
    jiraSubdomain: envJiraSubdomain ?? '',
    jiraEmail: envJiraEmail ?? '',
    jiraToken: envJiraToken ?? '',
    jiraProjectKey: envJiraProjectKey ?? '',
    datadogApiKey: envDdApiKey ?? '',
    datadogAppKey: envDdAppKey ?? '',
    datadogSite: envDdSite ?? 'datadoghq.com',
    confluenceSpaceId: envConfSpaceId ?? '',
    confluenceParentPageId: envConfParentPageId ?? '',
    datadogDefaultIndexes: '',
    datadogDefaultHosts: '',
  };

  // 1. Check localStorage — merge with env base so new env fields are picked up
  //    even when an older localStorage entry (without those fields) exists.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.token) {
        return {
          ...envBase,   // env vars as defaults
          ...parsed,    // localStorage overrides per-field
          // For fields that may have been saved empty before env vars were set,
          // fall back to env vars when the stored value is blank
          zendeskSubdomain: parsed.zendeskSubdomain || envZdSubdomain || '',
          zendeskEmail: parsed.zendeskEmail || envZdEmail || '',
          zendeskToken: parsed.zendeskToken || envZdToken || '',
          assistantId: parsed.assistantId || envAssistantId || '',
          jiraSubdomain: parsed.jiraSubdomain || envJiraSubdomain || '',
          jiraEmail: parsed.jiraEmail || envJiraEmail || '',
          jiraToken: parsed.jiraToken || envJiraToken || '',
          jiraProjectKey: parsed.jiraProjectKey || envJiraProjectKey || '',
          datadogApiKey: parsed.datadogApiKey || envDdApiKey || '',
          datadogAppKey: parsed.datadogAppKey || envDdAppKey || '',
          datadogSite: parsed.datadogSite || envDdSite || 'datadoghq.com',
        };
      }
    }
  } catch { /* ignore */ }

  // 2. Fall back entirely to env vars
  if (envToken) return envBase;

  return { ...DEFAULT_AI_SETTINGS };
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export interface AiSettings {
  endpoint: string;
  token: string;
  assistantId: string;
  userEmail: string;
  zendeskSubdomain: string;
  zendeskEmail: string;
  zendeskToken: string;
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
};

export function loadAiSettings(): AiSettings {
  // Read env vars (baked in at build time)
  const envToken = import.meta.env.VITE_UNLEASH_TOKEN as string | undefined;
  const envAssistantId = import.meta.env.VITE_UNLEASH_ASSISTANT_ID as string | undefined;
  const envUserEmail = import.meta.env.VITE_UNLEASH_USER_EMAIL as string | undefined;
  const envZdSubdomain = import.meta.env.VITE_ZENDESK_SUBDOMAIN as string | undefined;
  const envZdEmail = import.meta.env.VITE_ZENDESK_EMAIL as string | undefined;
  const envZdToken = import.meta.env.VITE_ZENDESK_TOKEN as string | undefined;

  // Env-var base (used as fallback for any field not explicitly saved)
  const envBase: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    token: envToken ?? '',
    assistantId: envAssistantId ?? '',
    userEmail: envUserEmail ?? '',
    zendeskSubdomain: envZdSubdomain ?? '',
    zendeskEmail: envZdEmail ?? '',
    zendeskToken: envZdToken ?? '',
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

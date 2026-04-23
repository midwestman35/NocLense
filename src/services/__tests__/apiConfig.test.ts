import {
  UNLEASH_DEFAULT_BASE,
  getAtlassianBase,
  getConfluenceApiBase,
  getConfluenceRestContentBase,
  getDatadogBase,
  getJiraApiBase,
  getUnleashBase,
  getUnleashChatsUrl,
  getZendeskApiBase,
  getZendeskSiteBase,
} from '../apiConfig';

describe('apiConfig', () => {
  it('normalizes Unleash endpoints and defaults to the shipped base URL', () => {
    expect(getUnleashBase('https://e-api.unleash.so/')).toBe(UNLEASH_DEFAULT_BASE);
    expect(getUnleashChatsUrl('')).toBe(`${UNLEASH_DEFAULT_BASE}/chats`);
  });

  it('builds Zendesk API URLs from a subdomain', () => {
    expect(getZendeskSiteBase('carbyne')).toBe('https://carbyne.zendesk.com');
    expect(getZendeskApiBase('carbyne')).toBe('https://carbyne.zendesk.com/api/v2');
  });

  it('preserves Datadog api.* hosts without double-prefixing them', () => {
    expect(getDatadogBase('datadoghq.com')).toBe('https://api.datadoghq.com');
    expect(getDatadogBase('api.us5.datadoghq.com')).toBe('https://api.us5.datadoghq.com');
  });

  it('builds Jira and Confluence URLs from an Atlassian host', () => {
    expect(getAtlassianBase('https://axon.atlassian.net/')).toBe('https://axon.atlassian.net');
    expect(getJiraApiBase('axon.atlassian.net')).toBe('https://axon.atlassian.net/rest/api/3');
    expect(getConfluenceApiBase('axon.atlassian.net')).toBe('https://axon.atlassian.net/wiki/api/v2');
    expect(getConfluenceRestContentBase('axon.atlassian.net')).toBe('https://axon.atlassian.net/wiki/rest/api/content');
  });
});

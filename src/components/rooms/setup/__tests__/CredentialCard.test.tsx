import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AiSettings } from '../../../../store/aiSettings';
import { CredentialCard } from '../CredentialCard';

vi.mock('../../../../services/datadogService', () => ({
  validateDatadogCredentials: vi.fn(async () => ({ valid: true, message: 'Datadog ok' })),
}));

const settings: AiSettings = {
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
  datadogApiKey: 'api',
  datadogAppKey: 'app',
  datadogSite: 'datadoghq.com',
  datadogDefaultIndexes: '',
  datadogDefaultHosts: '',
  confluenceSpaceId: '',
  confluenceParentPageId: '',
};

describe('CredentialCard', () => {
  it('saves through the provided callback and tests Datadog credentials', async () => {
    const onSaved = vi.fn();
    render(
      <CredentialCard
        vendor="datadog"
        settings={settings}
        context={{ ticketId: '', severity: '', timezone: 'Eastern Time (US & Canada)', cnc: '', notes: '' }}
        onSettingsChange={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /save config/i }));
    expect(onSaved).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Datadog ok'));
  });
});

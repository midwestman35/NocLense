import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../ui';
import { SetupRoom } from '../SetupRoom';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

vi.mock('../../../../services/zendeskService', () => ({
  fetchZendeskTicket: vi.fn(async () => ({
    id: 41637,
    subject: 'Dispatch cannot hear caller audio',
    description: '',
    status: 'open',
    priority: 'high',
    requesterName: 'K Nguyen',
    requesterEmail: 'k@example.com',
    createdAt: '2026-04-23T12:00:00Z',
    tags: ['audio'],
    comments: [],
    requesterTimezone: 'Pacific Time (US & Canada)',
    orgId: 1,
    orgName: 'MACC 911',
    orgTimezone: null,
    attachments: [
      {
        id: 9,
        fileName: 'apex-audio.log',
        contentUrl: 'https://example.zendesk.com/attachments/9',
        contentType: 'text/plain',
        size: 2048,
        inline: false,
        commentType: 'internal',
      },
    ],
  })),
}));

vi.mock('../../../../services/datadogService', () => ({
  validateDatadogCredentials: vi.fn(async () => ({ valid: true, message: 'Datadog ok' })),
}));

vi.mock('../../../../services/confluenceService', () => ({
  searchConfluenceInvestigations: vi.fn(async () => []),
}));

function renderRoom() {
  return render(
    <ToastProvider>
      <SetupRoom onBack={vi.fn()} onContinue={vi.fn()} />
    </ToastProvider>,
  );
}

describe('SetupRoom', () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.removeItem('unleash_ai_settings');
  });

  it('renders setup panels and saves Zendesk settings through aiSettings storage', async () => {
    renderRoom();
    expect(screen.getByText('Investigation Setup')).toBeInTheDocument();
    expect(screen.getByText('Zendesk')).toBeInTheDocument();
    expect(screen.getByText('Investigation Context')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('carbyne'), { target: { value: 'carbyne' } });
    fireEvent.change(screen.getAllByPlaceholderText('agent@example.com')[0], {
      target: { value: 'agent@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Zendesk API token'), { target: { value: 'zd-token' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save config/i })[0]);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('unleash_ai_settings') ?? '{}');
      expect(stored.zendeskToken).toBe('zd-token');
    });
  });

  it('loads Zendesk attachments for the context ticket', async () => {
    renderRoom();
    fireEvent.change(screen.getByPlaceholderText('41637'), { target: { value: '41637' } });
    fireEvent.change(screen.getByPlaceholderText('carbyne'), { target: { value: 'carbyne' } });
    fireEvent.change(screen.getAllByPlaceholderText('agent@example.com')[0], {
      target: { value: 'agent@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Zendesk API token'), { target: { value: 'zd-token' } });

    fireEvent.click(screen.getByRole('button', { name: /refresh ticket/i }));

    await waitFor(() => {
      expect(screen.getByText('apex-audio.log')).toBeInTheDocument();
      expect(screen.getByText('Dispatch cannot hear caller audio')).toBeInTheDocument();
    });
  });
});

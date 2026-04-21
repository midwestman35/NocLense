import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import LogTabs from '../LogTabs';

interface HarnessLog {
  id: number;
  fileName: string;
  message: string;
}

function LogTabsHarness({ logs }: { logs: HarnessLog[] }) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const items = Array.from(
    logs.reduce((counts, log) => counts.set(log.fileName, (counts.get(log.fileName) ?? 0) + 1), new Map<string, number>()),
  ).map(([fileName, count]) => ({ fileName, count }));
  const visibleLogs = activeTab ? logs.filter((log) => log.fileName === activeTab) : logs;

  return (
    <div>
      <LogTabs items={items} activeTab={activeTab} allCount={logs.length} onSelect={setActiveTab} />
      <ul data-testid="visible-logs">
        {visibleLogs.map((log) => (
          <li key={log.id}>{log.message}</li>
        ))}
      </ul>
    </div>
  );
}

describe('LogTabs', () => {
  it('does not render a tab bar when only one file exists', () => {
    render(
      <LogTabs
        items={[{ fileName: 'single.log', count: 2 }]}
        activeTab={null}
        allCount={2}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('log-tabs')).not.toBeInTheDocument();
  });

  it('renders a tab bar when two distinct files exist', () => {
    render(
      <LogTabs
        items={[
          { fileName: 'alpha.log', count: 2 },
          { fileName: 'beta.log', count: 1 },
        ]}
        activeTab={null}
        allCount={3}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('log-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('log-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('log-tab-alpha.log')).toBeInTheDocument();
    expect(screen.getByTestId('log-tab-beta.log')).toBeInTheDocument();
  });

  it('clicking a tab filters the visible list to that file', () => {
    render(
      <LogTabsHarness
        logs={[
          { id: 1, fileName: 'alpha.log', message: 'alpha one' },
          { id: 2, fileName: 'alpha.log', message: 'alpha two' },
          { id: 3, fileName: 'beta.log', message: 'beta one' },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId('log-tab-beta.log'));

    expect(screen.queryByText('alpha one')).not.toBeInTheDocument();
    expect(screen.queryByText('alpha two')).not.toBeInTheDocument();
    expect(screen.getByText('beta one')).toBeInTheDocument();
  });

  it('the All tab restores the full list', () => {
    render(
      <LogTabsHarness
        logs={[
          { id: 1, fileName: 'alpha.log', message: 'alpha one' },
          { id: 2, fileName: 'beta.log', message: 'beta one' },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId('log-tab-beta.log'));
    fireEvent.click(screen.getByTestId('log-tab-all'));

    expect(screen.getByText('alpha one')).toBeInTheDocument();
    expect(screen.getByText('beta one')).toBeInTheDocument();
  });
});

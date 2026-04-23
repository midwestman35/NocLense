import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvestigateRoom } from '../InvestigateRoom';

vi.mock('../LogStreamPanel', () => ({ LogStreamPanel: () => <div>virtualized log stream</div> }));
vi.mock('../DatadogLiveCard', () => ({ DatadogLiveCard: () => <div>datadog live card</div> }));
vi.mock('../../../AISidebar', () => ({ AISidebar: () => <div>ai assistant panel</div> }));
vi.mock('../../../evidence/EvidencePanel', () => ({ default: () => <div>evidence panel</div> }));
vi.mock('../../../correlation-graph/CorrelationGraph', () => ({ CorrelationGraph: () => <div>correlation graph</div> }));
vi.mock('../../../workspace/SimilarCasesSection', () => ({ SimilarCasesSection: () => <div>similar cases section</div> }));

describe('InvestigateRoom', () => {
  it('mounts the investigate panels with live data props', () => {
    render(
      <InvestigateRoom
        filteredLogCount={2386}
        fileError={null}
        logViewerRef={{ current: null }}
        parseProgress={null}
        selectedLog={null}
        pendingSetup={null}
        similarPastTickets={[{ id: 41637, subject: 'Dispatch 4 cannot hear caller audio', status: 'closed', createdAt: '2026-04-05T02:14:00.000Z', tags: ['noc:audio'] }]}
        evidenceSet={null}
        onCloseSelectedLog={vi.fn()}
        onJumpToSelectedLog={vi.fn()}
        onSetupAI={vi.fn()}
        onSetupConsumed={vi.fn()}
        onCitationClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Log Stream')).toBeInTheDocument();
    expect(screen.getByText('2,386 events')).toBeInTheDocument();
    expect(screen.getByText('virtualized log stream')).toBeInTheDocument();
    expect(screen.getByText('ai assistant panel')).toBeInTheDocument();
    expect(screen.getByText('evidence panel')).toBeInTheDocument();
    expect(screen.getByText('correlation graph')).toBeInTheDocument();
    expect(screen.getByText(/Dispatch 4 cannot hear caller audio/)).toBeInTheDocument();
    expect(screen.getByText('datadog live card')).toBeInTheDocument();
  });
});

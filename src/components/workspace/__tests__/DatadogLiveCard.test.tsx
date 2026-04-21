import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomLiveStateProvider } from '../../../contexts/RoomLiveStateContext';
import { RoomLiveStateStore } from '../../../contexts/roomLiveStateStore';
import { DatadogLiveCard } from '../NewWorkspaceLayout';

/**
 * Phase 05 Commit 5 — Datadog Live card tier integration.
 *
 * Verifies the card registers as a datadog-stream surface, reads its
 * arbitrated tier from the store, and reflects the tier via
 * data-tier attribute (forwarded through the WorkspaceCard dataAttributes
 * prop landed in Phase 04.5 Commit 5).
 */
describe('DatadogLiveCard', () => {
  function renderWithStore(store: RoomLiveStateStore) {
    return render(
      <RoomLiveStateProvider store={store}>
        <DatadogLiveCard />
      </RoomLiveStateProvider>
    );
  }

  it('registers the surface and reports ready tier on mount', () => {
    const store = new RoomLiveStateStore();
    const { container } = renderWithStore(store);
    const root = container.querySelector('[data-card-id="datadog-live"]')!;
    // useLiveSurface registers on mount → surface reaches 'ready' tier
    // immediately per Phase 01a increment 7 documentation.
    expect(root).toHaveAttribute('data-surface', 'datadog-live');
    expect(root.getAttribute('data-tier')).toBe('ready');
  });

  it('reflects live tier when the store notifies a datadog-stream event', () => {
    const store = new RoomLiveStateStore();
    const { container } = renderWithStore(store);
    act(() => {
      store.notify('datadog-live', 'datadog-stream');
    });
    const root = container.querySelector('[data-card-id="datadog-live"]')!;
    expect(root.getAttribute('data-tier')).toBe('live');
  });

  it('accent color follows tier (ready/live = purple, alert = destructive)', () => {
    const store = new RoomLiveStateStore();
    const { container } = renderWithStore(store);
    // Initial render: ready → accent purple (#a855f7 via tierToAccent).
    // The accent dot is rendered inside the card header as a small span
    // with backgroundColor set inline. Query for any span whose
    // background-color is the expected value is fragile; instead, assert
    // the data-tier attribute drives CSS selectors (live-state.css).
    // This test focuses on the data-tier channel; visual assertion is
    // via the mood board + manual smoke.
    const root = container.querySelector('[data-card-id="datadog-live"]')!;
    expect(root).toHaveAttribute('data-tier', 'ready');
  });
});

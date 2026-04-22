import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CorrelationGraphResult } from '../types';
import { CorrelationGraph } from '../CorrelationGraph';
import { useCorrelationGraph } from '../useCorrelationGraph';
import { useLogContext } from '../../../contexts/LogContext';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

const destroyMock = vi.fn();
const fitViewMock = vi.fn().mockResolvedValue(undefined);
const getZoomMock = vi.fn().mockReturnValue(1);
const layoutMock = vi.fn().mockResolvedValue(undefined);
const onMock = vi.fn();
const renderMock = vi.fn().mockResolvedValue(undefined);
const resizeMock = vi.fn();
const setDataMock = vi.fn();
const setLayoutMock = vi.fn();
const stopLayoutMock = vi.fn();
const drawMock = vi.fn().mockResolvedValue(undefined);
const updateNodeDataMock = vi.fn();
const zoomToMock = vi.fn().mockResolvedValue(undefined);
const graphConstructorMock = vi.fn();

vi.mock('../useCorrelationGraph', () => ({
  useCorrelationGraph: vi.fn(),
}));

vi.mock('../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

function GraphMock(
  this: {
    destroy: typeof destroyMock;
    on: typeof onMock;
    render: typeof renderMock;
    resize: typeof resizeMock;
    setData: typeof setDataMock;
    fitView: typeof fitViewMock;
    getZoom: typeof getZoomMock;
    layout: typeof layoutMock;
    setLayout: typeof setLayoutMock;
    stopLayout: typeof stopLayoutMock;
    draw: typeof drawMock;
    updateNodeData: typeof updateNodeDataMock;
    zoomTo: typeof zoomToMock;
  },
  options: unknown,
) {
  graphConstructorMock(options);
  this.destroy = destroyMock;
  this.on = onMock;
  this.render = renderMock;
  this.resize = resizeMock;
  this.setData = setDataMock;
  this.fitView = fitViewMock;
  this.getZoom = getZoomMock;
  this.layout = layoutMock;
  this.setLayout = setLayoutMock;
  this.stopLayout = stopLayoutMock;
  this.draw = drawMock;
  this.updateNodeData = updateNodeDataMock;
  this.zoomTo = zoomToMock;
}

vi.mock('@antv/g6', () => ({
  Graph: vi.fn(function GraphConstructor(options: unknown) {
    GraphMock.call(this as Parameters<typeof GraphMock>[0], options);
  }),
  NodeEvent: {
    CLICK: 'node:click',
  },
}), { virtual: true });

function createGraphState(
  overrides: Partial<CorrelationGraphResult> = {},
): CorrelationGraphResult {
  return {
    nodes: [
      {
        id: 'callId:call-1',
        type: 'callId',
        correlationType: 'callId',
        value: 'call-1',
        label: 'call-1',
        typeLabel: 'Call ID',
        colorToken: '--correlation-call-id',
        size: 24,
        edgeCount: 2,
        connectionCount: 2,
        logCount: 2,
        isActive: false,
        isExcluded: false,
        isCluster: false,
        memberCount: 1,
      },
      {
        id: 'station:station-a',
        type: 'station',
        correlationType: 'station',
        value: 'station-a',
        label: 'station-a',
        typeLabel: 'Station ID',
        colorToken: '--correlation-station-id',
        size: 22,
        edgeCount: 1,
        connectionCount: 1,
        logCount: 1,
        isActive: true,
        isExcluded: false,
        isCluster: false,
        memberCount: 1,
      },
    ],
    edges: [
      {
        id: 'callId:call-1__station:station-a',
        source: 'callId:call-1',
        target: 'station:station-a',
        weight: 1,
        correlationTypes: ['callId', 'station'],
        isClusterEdge: false,
      },
    ],
    totalNodeCount: 2,
    totalEdgeCount: 1,
    renderedNodeCount: 2,
    renderedEdgeCount: 1,
    isClustered: false,
    expandedClusters: [],
    toggleCluster: vi.fn(),
    ...overrides,
  };
}

function createLogContext(overrides: Partial<ReturnType<typeof useLogContext>> = {}): ReturnType<typeof useLogContext> {
  return {
    activeCorrelations: [],
    toggleCorrelation: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useLogContext>;
}

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0];

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly callback: ResizeObserverCallback;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
}

function setElementSize(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

function pressTab(from: HTMLElement, to: HTMLElement): void {
  act(() => {
    const event = createEvent.keyDown(from, { key: 'Tab' });
    fireEvent(from, event);
    expect(event.defaultPrevented).toBe(false);
    to.focus();
  });
}

function focusElement(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

function pressKey(element: HTMLElement, key: string): void {
  act(() => {
    fireEvent.keyDown(element, { key });
  });
}

describe('CorrelationGraph', () => {
  beforeEach(() => {
    destroyMock.mockReset();
    fitViewMock.mockClear();
    getZoomMock.mockReset();
    getZoomMock.mockReturnValue(1);
    layoutMock.mockClear();
    onMock.mockReset();
    renderMock.mockClear();
    resizeMock.mockReset();
    setDataMock.mockReset();
    setLayoutMock.mockReset();
    stopLayoutMock.mockReset();
    drawMock.mockReset();
    updateNodeDataMock.mockReset();
    zoomToMock.mockReset();
    graphConstructorMock.mockReset();
    MockResizeObserver.instances = [];

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
    vi.mocked(useCorrelationGraph).mockReturnValue(createGraphState());
    vi.mocked(useLogContext).mockReturnValue(createLogContext());
  });

  it('creates a G6 force graph and sends transformed node-edge data', async () => {
    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(graphConstructorMock).toHaveBeenCalledTimes(1);
    });

    const options = graphConstructorMock.mock.calls[0][0] as {
      layout: { type: string };
      behaviors: Array<{ type: string }>;
      renderer: unknown;
    };

    expect(options.layout.type).toBe('d3-force');
    expect(options.renderer).toBeDefined();
    expect(options.behaviors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'drag-canvas' }),
        expect.objectContaining({ type: 'zoom-canvas' }),
      ]),
    );

    await waitFor(() => {
      expect(setDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'callId:call-1',
              data: expect.objectContaining({
                correlationType: 'callId',
                value: 'call-1',
              }),
            }),
          ]),
          edges: expect.arrayContaining([
            expect.objectContaining({
              id: 'callId:call-1__station:station-a',
              data: expect.objectContaining({
                weight: 1,
                isClusterEdge: false,
              }),
            }),
          ]),
        }),
      );
    });

    expect(screen.getByTestId('correlation-graph')).toBeInTheDocument();
  });

  it('disables layout animation when reduced motion is active', async () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(graphConstructorMock).toHaveBeenCalledTimes(1);
    });

    const options = graphConstructorMock.mock.calls[0][0] as {
      animation: boolean;
      layout: { animation: boolean; iterations: number };
    };

    expect(options.animation).toBe(false);
    expect(options.layout.animation).toBe(false);
    expect(options.layout.iterations).toBe(1);

    await waitFor(() => {
      expect(fitViewMock).toHaveBeenCalledWith(
        { when: 'always' },
        false,
      );
    });
  });

  it('resizes the canvas when the observed surface changes', async () => {
    render(<CorrelationGraph />);

    const surface = await screen.findByTestId('correlation-graph-surface');
    setElementSize(surface, 640, 360);

    const observer = MockResizeObserver.instances[0];
    observer.callback([], observer as unknown as ResizeObserver);

    await waitFor(() => {
      expect(resizeMock).toHaveBeenCalledWith(640, 360);
    });
  });

  it('toggles a cluster when a cluster node is clicked', async () => {
    const toggleCluster = vi.fn();

    vi.mocked(useCorrelationGraph).mockReturnValue(
      createGraphState({
        nodes: [
          {
            id: 'cluster:callId',
            type: 'cluster',
            correlationType: 'callId',
            value: 'callId',
            label: 'Call IDs',
            typeLabel: 'Call ID',
            colorToken: '--correlation-call-id',
            size: 36,
            edgeCount: 8,
            connectionCount: 4,
            logCount: 12,
            isActive: false,
            isExcluded: false,
            isCluster: true,
            memberCount: 12,
          },
        ],
        edges: [],
        totalNodeCount: 12,
        totalEdgeCount: 8,
        renderedNodeCount: 1,
        renderedEdgeCount: 0,
        isClustered: true,
        toggleCluster,
      }),
    );

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(onMock).toHaveBeenCalledWith('node:click', expect.any(Function));
    });

    const clickHandler = onMock.mock.calls.find(([eventName]) => eventName === 'node:click')?.[1] as
      | ((event: { targetType: string; target: { id?: string } }) => void)
      | undefined;

    act(() => {
      clickHandler?.({
        targetType: 'node',
        target: { id: 'cluster:callId' },
      });
    });

    expect(toggleCluster).toHaveBeenCalledWith('callId');
  });

  it('adds a correlation filter when a non-cluster node is clicked', async () => {
    const toggleCorrelation = vi.fn();

    vi.mocked(useLogContext).mockReturnValue(
      createLogContext({ toggleCorrelation }),
    );

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(onMock).toHaveBeenCalledWith('node:click', expect.any(Function));
    });

    const clickHandler = onMock.mock.calls.find(([eventName]) => eventName === 'node:click')?.[1] as
      | ((event: { targetType: string; target: { id?: string } }) => void)
      | undefined;

    act(() => {
      clickHandler?.({
        targetType: 'node',
        target: { id: 'callId:call-1' },
      });
    });

    expect(toggleCorrelation).toHaveBeenCalledWith({
      type: 'callId',
      value: 'call-1',
    });
  });

  it('adds container accessibility semantics and live regions', () => {
    const { container } = render(<CorrelationGraph />);

    const graphContainer = screen.getByTestId('correlation-graph');
    const graphSurface = screen.getByTestId('correlation-graph-surface');
    const liveRegions = container.querySelectorAll('[aria-live]');

    expect(graphContainer).toHaveAttribute('role', 'application');
    expect(graphContainer).toHaveAttribute('tabindex', '0');
    expect(graphContainer).toHaveAttribute('aria-label', 'Correlation graph. 2 nodes, 1 edge.');
    expect(graphSurface).toHaveAttribute('tabindex', '-1');
    expect(graphSurface).toHaveAttribute('aria-hidden', 'true');
    expect(liveRegions).toHaveLength(2);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(container.querySelector('[aria-live="assertive"]')).not.toBeNull();
  });

  it('moves focus to the graph container and announces the first node on focus', async () => {
    render(
      <>
        <button data-testid="before">Before</button>
        <CorrelationGraph />
      </>,
    );

    const beforeButton = screen.getByTestId('before');
    const graphContainer = screen.getByTestId('correlation-graph');

    focusElement(beforeButton);
    pressTab(beforeButton, graphContainer);

    expect(graphContainer).toHaveFocus();

    await waitFor(() => {
      expect(
        screen.getByText('Call ID, call-1, connected to 2 log entries, 2 other correlations. Inactive.'),
      ).toBeInTheDocument();
    });
  });

  it('uses arrow keys to change the announced node and sync keyboard focus styling', async () => {
    render(<CorrelationGraph />);

    const graphContainer = screen.getByTestId('correlation-graph');
    focusElement(graphContainer);

    await waitFor(() => {
      expect(
        screen.getByText('Call ID, call-1, connected to 2 log entries, 2 other correlations. Inactive.'),
      ).toBeInTheDocument();
    });

    pressKey(graphContainer, 'ArrowRight');

    await waitFor(() => {
      expect(
        screen.getByText('Station ID, station-a, connected to 1 log entry, 1 other correlation. Active.'),
      ).toBeInTheDocument();
    });

    const lastUpdate = updateNodeDataMock.mock.calls.at(-1)?.[0] as Array<{
      id: string;
      data: {
        isKeyboardFocused: boolean;
      };
    }>;

    expect(lastUpdate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'station:station-a',
          data: expect.objectContaining({
            isKeyboardFocused: true,
          }),
        }),
      ]),
    );
  });

  it('reuses keyboard activation to toggle the focused node filter', async () => {
    const toggleCorrelation = vi.fn();

    vi.mocked(useLogContext).mockReturnValue(
      createLogContext({ toggleCorrelation }),
    );

    render(<CorrelationGraph />);

    const graphContainer = screen.getByTestId('correlation-graph');
    focusElement(graphContainer);

    await waitFor(() => {
      expect(
        screen.getByText('Call ID, call-1, connected to 2 log entries, 2 other correlations. Inactive.'),
      ).toBeInTheDocument();
    });

    pressKey(graphContainer, 'Enter');

    expect(toggleCorrelation).toHaveBeenCalledWith({
      type: 'callId',
      value: 'call-1',
    });
  });

  it('allows tabbing out normally and clears focus on escape', async () => {
    render(
      <>
        <CorrelationGraph />
        <button data-testid="after">After</button>
      </>,
    );

    const graphContainer = screen.getByTestId('correlation-graph');
    const afterButton = screen.getByTestId('after');

    focusElement(graphContainer);
    expect(graphContainer).toHaveFocus();

    pressTab(graphContainer, afterButton);
    expect(afterButton).toHaveFocus();

    focusElement(graphContainer);
    pressKey(graphContainer, 'Escape');

    expect(graphContainer).not.toHaveFocus();
  });

  it('keeps the keyboard focus ring non-animated under reduced motion', async () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    render(<CorrelationGraph />);

    const graphContainer = screen.getByTestId('correlation-graph');
    focusElement(graphContainer);

    await waitFor(() => {
      expect(updateNodeDataMock).toHaveBeenCalled();
    });

    expect(graphContainer.className).not.toContain('transition');
  });

  it('renders the large-graph guard and dismisses it without forcing show-all', async () => {
    vi.mocked(useCorrelationGraph).mockReturnValue(
      createGraphState({
        nodes: [
          {
            id: 'cluster:callId',
            type: 'cluster',
            correlationType: 'callId',
            value: 'callId',
            label: 'Call IDs',
            typeLabel: 'Call ID',
            colorToken: '--correlation-call-id',
            size: 36,
            edgeCount: 40,
            connectionCount: 2,
            logCount: 120,
            isActive: false,
            isExcluded: false,
            isCluster: true,
            memberCount: 600,
          },
          {
            id: 'cluster:report',
            type: 'cluster',
            correlationType: 'report',
            value: 'report',
            label: 'Report IDs',
            typeLabel: 'Report ID',
            colorToken: '--correlation-report-id',
            size: 36,
            edgeCount: 40,
            connectionCount: 2,
            logCount: 120,
            isActive: false,
            isExcluded: false,
            isCluster: true,
            memberCount: 401,
          },
        ],
        edges: [
          {
            id: 'cluster:callId__cluster:report',
            source: 'cluster:callId',
            target: 'cluster:report',
            weight: 120,
            correlationTypes: ['callId', 'report'],
            isClusterEdge: true,
          },
        ],
        totalNodeCount: 1001,
        totalEdgeCount: 1400,
        renderedNodeCount: 2,
        renderedEdgeCount: 1,
        isClustered: true,
      }),
    );

    render(<CorrelationGraph />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Large graph detected')).toBeInTheDocument();
    expect(screen.getByText('1001 nodes and 1400 edges. Rendering may be slow.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Reset layout' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep clustered' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('re-renders with expandAllClusters after choosing show all on a large graph', async () => {
    vi.mocked(useCorrelationGraph).mockImplementation(({ expandAllClusters } = {}) => (
      expandAllClusters
        ? createGraphState({
            nodes: [
              {
                id: 'callId:call-1',
                type: 'callId',
                correlationType: 'callId',
                value: 'call-1',
                label: 'call-1',
                typeLabel: 'Call ID',
                colorToken: '--correlation-call-id',
                size: 24,
                edgeCount: 1,
                connectionCount: 1,
                logCount: 1,
                isActive: false,
                isExcluded: false,
                isCluster: false,
                memberCount: 1,
              },
              {
                id: 'report:report-1',
                type: 'report',
                correlationType: 'report',
                value: 'report-1',
                label: 'report-1',
                typeLabel: 'Report ID',
                colorToken: '--correlation-report-id',
                size: 24,
                edgeCount: 1,
                connectionCount: 1,
                logCount: 1,
                isActive: false,
                isExcluded: false,
                isCluster: false,
                memberCount: 1,
              },
            ],
            edges: [
              {
                id: 'callId:call-1__report:report-1',
                source: 'callId:call-1',
                target: 'report:report-1',
                weight: 1,
                correlationTypes: ['callId', 'report'],
                isClusterEdge: false,
              },
            ],
            totalNodeCount: 1001,
            totalEdgeCount: 1400,
            renderedNodeCount: 2,
            renderedEdgeCount: 1,
            isClustered: false,
          })
        : createGraphState({
            nodes: [
              {
                id: 'cluster:callId',
                type: 'cluster',
                correlationType: 'callId',
                value: 'callId',
                label: 'Call IDs',
                typeLabel: 'Call ID',
                colorToken: '--correlation-call-id',
                size: 36,
                edgeCount: 40,
                connectionCount: 1,
                logCount: 120,
                isActive: false,
                isExcluded: false,
                isCluster: true,
                memberCount: 600,
              },
            ],
            edges: [],
            totalNodeCount: 1001,
            totalEdgeCount: 1400,
            renderedNodeCount: 1,
            renderedEdgeCount: 0,
            isClustered: true,
          })
    ));

    render(<CorrelationGraph />);

    fireEvent.click(await screen.findByRole('button', { name: 'Show all' }));

    await waitFor(() => {
      expect(useCorrelationGraph).toHaveBeenLastCalledWith({ expandAllClusters: true });
    });
  });

  it('does not mount G6 when the graph is empty', () => {
    vi.mocked(useCorrelationGraph).mockReturnValue(
      createGraphState({
        nodes: [],
        edges: [],
        totalNodeCount: 0,
        totalEdgeCount: 0,
        renderedNodeCount: 0,
        renderedEdgeCount: 0,
        isClustered: false,
      }),
    );

    render(<CorrelationGraph />);

    expect(screen.getByText('No correlations to show')).toBeInTheDocument();
    expect(screen.getByText('Load logs and apply filters to see the correlation graph.')).toBeInTheDocument();
    expect(graphConstructorMock).not.toHaveBeenCalled();
  });

  it('wires zoom, fit-view, and layout reset controls to the graph instance', async () => {
    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(graphConstructorMock).toHaveBeenCalledTimes(1);
    });

    fitViewMock.mockClear();
    zoomToMock.mockClear();
    setLayoutMock.mockClear();
    layoutMock.mockClear();
    stopLayoutMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomToMock).toHaveBeenCalledWith(
      1.25,
      expect.objectContaining({ duration: 180, easing: 'ease-out' }),
    );

    zoomToMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomToMock).toHaveBeenCalledWith(
      0.8,
      expect.objectContaining({ duration: 180, easing: 'ease-out' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(fitViewMock).toHaveBeenCalledWith(
      { when: 'always' },
      expect.objectContaining({ duration: 180, easing: 'ease-out' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));

    await waitFor(() => {
      expect(stopLayoutMock).toHaveBeenCalledTimes(1);
      expect(setLayoutMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'd3-force',
        animation: true,
      }));
      expect(layoutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('disables animated zoom and layout reset under reduced motion', async () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(graphConstructorMock).toHaveBeenCalledTimes(1);
    });

    zoomToMock.mockClear();
    setLayoutMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomToMock).toHaveBeenCalledWith(1.25, false);

    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));

    await waitFor(() => {
      expect(setLayoutMock).toHaveBeenCalledWith(expect.objectContaining({
        animation: false,
      }));
    });
  });

  it('renders active and excluded nodes with distinct graph styling attributes', async () => {
    vi.mocked(useCorrelationGraph).mockReturnValue(
      createGraphState({
        nodes: [
          {
            id: 'callId:call-1',
            type: 'callId',
            correlationType: 'callId',
            value: 'call-1',
            label: 'call-1',
            typeLabel: 'Call ID',
            colorToken: '--correlation-call-id',
            size: 24,
            edgeCount: 2,
            connectionCount: 2,
            logCount: 2,
            isActive: true,
            isExcluded: false,
            isCluster: false,
            memberCount: 1,
          },
          {
            id: 'station:station-a',
            type: 'station',
            correlationType: 'station',
            value: 'station-a',
            label: 'station-a',
            typeLabel: 'Station ID',
            colorToken: '--correlation-station-id',
            size: 22,
            edgeCount: 1,
            connectionCount: 1,
            logCount: 1,
            isActive: false,
            isExcluded: true,
            isCluster: false,
            memberCount: 1,
          },
        ],
        edges: [
          {
            id: 'callId:call-1__station:station-a',
            source: 'callId:call-1',
            target: 'station:station-a',
            weight: 1,
            correlationTypes: ['callId', 'station'],
            isClusterEdge: false,
          },
        ],
      }),
    );

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(setDataMock).toHaveBeenCalled();
    });

    const graphPayload = setDataMock.mock.calls.at(-1)?.[0] as {
      nodes: Array<{
        id: string;
        data: {
          isActive: boolean;
          isExcluded: boolean;
          isKeyboardFocused: boolean;
        };
        style: {
          halo: boolean;
          lineDash?: number[];
          opacity: number;
          shadowBlur?: number;
        };
      }>;
    };

    const activeNode = graphPayload.nodes.find((node) => node.id === 'callId:call-1');
    const excludedNode = graphPayload.nodes.find((node) => node.id === 'station:station-a');

    expect(activeNode).toMatchObject({
      data: {
        isActive: true,
        isExcluded: false,
        isKeyboardFocused: false,
      },
      style: expect.objectContaining({
        halo: true,
        shadowBlur: 12,
      }),
    });

    expect(excludedNode).toMatchObject({
      data: {
        isActive: false,
        isExcluded: true,
        isKeyboardFocused: false,
      },
      style: expect.objectContaining({
        lineDash: [4, 3],
        opacity: 0.34,
      }),
    });
  });
});

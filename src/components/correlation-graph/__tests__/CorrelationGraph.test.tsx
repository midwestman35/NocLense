import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CorrelationGraphResult } from '../types';
import { CorrelationGraph } from '../CorrelationGraph';
import { useCorrelationGraph } from '../useCorrelationGraph';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

const destroyMock = vi.fn();
const onMock = vi.fn();
const renderMock = vi.fn().mockResolvedValue(undefined);
const resizeMock = vi.fn();
const setDataMock = vi.fn();
const getNodeDataMock = vi.fn();
const graphConstructorMock = vi.fn();

vi.mock('../useCorrelationGraph', () => ({
  useCorrelationGraph: vi.fn(),
}));

vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

function GraphMock(
  this: {
    destroy: typeof destroyMock;
    getNodeData: typeof getNodeDataMock;
    on: typeof onMock;
    render: typeof renderMock;
    resize: typeof resizeMock;
    setData: typeof setDataMock;
  },
  options: unknown,
) {
  graphConstructorMock(options);
  this.destroy = destroyMock;
  this.getNodeData = getNodeDataMock;
  this.on = onMock;
  this.render = renderMock;
  this.resize = resizeMock;
  this.setData = setDataMock;
}

vi.mock('@antv/g6', () => ({
  Graph: vi.fn(function GraphConstructor(options: unknown) {
    GraphMock.call(this as Parameters<typeof GraphMock>[0], options);
  }),
  NodeEvent: {
    CLICK: 'node:click',
  },
}));

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
        logIds: [1],
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

describe('CorrelationGraph', () => {
  beforeEach(() => {
    destroyMock.mockReset();
    onMock.mockReset();
    renderMock.mockClear();
    resizeMock.mockReset();
    setDataMock.mockReset();
    getNodeDataMock.mockReset();
    graphConstructorMock.mockReset();
    MockResizeObserver.instances = [];

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
    vi.mocked(useCorrelationGraph).mockReturnValue(createGraphState());
  });

  it('creates a G6 force graph and sends transformed node-edge data', async () => {
    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(graphConstructorMock).toHaveBeenCalledTimes(1);
    });

    const options = graphConstructorMock.mock.calls[0][0] as {
      layout: { type: string };
      behaviors: Array<{ type: string }>;
      autoFit: { type: string };
    };

    expect(options.layout.type).toBe('d3-force');
    expect(options.autoFit.type).toBe('view');
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
      autoFit: { animation: boolean };
      layout: { animation: boolean; iterations: number };
    };

    expect(options.animation).toBe(false);
    expect(options.autoFit.animation).toBe(false);
    expect(options.layout.animation).toBe(false);
    expect(options.layout.iterations).toBe(1);
  });

  it('resizes the canvas when the observed surface changes', async () => {
    render(<CorrelationGraph />);

    const surface = await screen.findByTestId('correlation-graph');
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

    getNodeDataMock.mockReturnValue({
      data: {
        correlationType: 'callId',
        isCluster: true,
      },
    });

    render(<CorrelationGraph />);

    await waitFor(() => {
      expect(onMock).toHaveBeenCalledWith('node:click', expect.any(Function));
    });

    const clickHandler = onMock.mock.calls.find(([eventName]) => eventName === 'node:click')?.[1] as
      | ((event: { targetType: string; target: { id?: string } }) => void)
      | undefined;

    clickHandler?.({
      targetType: 'node',
      target: { id: 'cluster:callId' },
    });

    expect(toggleCluster).toHaveBeenCalledWith('callId');
  });
});

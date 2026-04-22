import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLogContext, type CorrelationItem } from '../../../contexts/LogContext';
import type { LogEntry } from '../../../types';
import { GRAPH_CLUSTER_THRESHOLD } from '../types';
import { useCorrelationGraph } from '../useCorrelationGraph';

vi.mock('../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

function createLogEntry(id: number, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    timestamp: id,
    rawTimestamp: `2026-04-22T00:00:${String(id).padStart(2, '0')}Z`,
    level: 'INFO',
    component: 'CorrelationGraph',
    displayComponent: 'CorrelationGraph',
    message: `Log ${id}`,
    displayMessage: `Log ${id}`,
    payload: '',
    type: 'LOG',
    isSip: false,
    ...overrides,
  };
}

function buildContext(filteredLogs: LogEntry[], activeCorrelations: CorrelationItem[] = []): ReturnType<typeof useLogContext> {
  return {
    filteredLogs,
    activeCorrelations,
  } as ReturnType<typeof useLogContext>;
}

describe('useCorrelationGraph', () => {
  beforeEach(() => {
    vi.mocked(useLogContext).mockReset();
  });

  it('builds unique nodes and aggregated edges from filtered logs', () => {
    vi.mocked(useLogContext).mockReturnValue(
      buildContext(
        [
          createLogEntry(1, { callId: 'call-1', stationId: 'station-a', extensionId: 'ext-1' }),
          createLogEntry(2, { callId: 'call-1', stationId: 'station-b', reportId: 'report-7' }),
          createLogEntry(3, { callId: 'call-2' }),
        ],
        [
          { type: 'callId', value: 'call-1' },
          { type: 'station', value: 'station-b', excluded: true },
        ],
      ),
    );

    const { result } = renderHook(() => useCorrelationGraph());

    expect(result.current.isClustered).toBe(false);
    expect(result.current.totalNodeCount).toBe(6);
    expect(result.current.totalEdgeCount).toBe(6);

    const callNode = result.current.nodes.find((node) => node.id === 'callId:call-1');
    const excludedStationNode = result.current.nodes.find((node) => node.id === 'station:station-b');
    const isolatedNode = result.current.nodes.find((node) => node.id === 'callId:call-2');

    expect(callNode).toMatchObject({
      type: 'callId',
      colorToken: '--correlation-call-id',
      edgeCount: 4,
      logCount: 2,
      isActive: true,
      isExcluded: false,
    });
    expect(excludedStationNode).toMatchObject({
      isActive: false,
      isExcluded: true,
      colorToken: '--correlation-station-id',
    });
    expect(isolatedNode?.edgeCount).toBe(0);
    expect(callNode?.size).toBeGreaterThan(isolatedNode?.size ?? 0);

    const edge = result.current.edges.find(
      (graphEdge) =>
        graphEdge.source === 'callId:call-1' &&
        graphEdge.target === 'station:station-a',
    );

    expect(edge).toMatchObject({
      weight: 1,
      isClusterEdge: false,
    });
  });

  it('keeps the graph scoped to the eight faceted correlation types', () => {
    vi.mocked(useLogContext).mockReturnValue(
      buildContext([
        createLogEntry(10, { callId: 'call-10', traceId: 'trace-10', fileName: 'ops.log' }),
      ]),
    );

    const { result } = renderHook(() => useCorrelationGraph());

    expect(result.current.nodes.map((node) => node.id)).toEqual(['callId:call-10', 'file:ops.log']);
    expect(result.current.nodes.some((node) => node.correlationType === 'callId')).toBe(true);
    expect(result.current.nodes.some((node) => node.value === 'trace-10')).toBe(false);
  });

  it('collapses large graphs into type-level summary nodes over the clustering threshold', () => {
    const largeGraphLogs = Array.from({ length: (GRAPH_CLUSTER_THRESHOLD / 2) + 50 }, (_, index) => (
      createLogEntry(index + 1, {
        callId: `call-${index}`,
        reportId: `report-${index}`,
      })
    ));

    vi.mocked(useLogContext).mockReturnValue(buildContext(largeGraphLogs));

    const { result } = renderHook(() => useCorrelationGraph());

    expect(result.current.isClustered).toBe(true);
    expect(result.current.totalNodeCount).toBe(largeGraphLogs.length * 2);
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.edges).toHaveLength(1);
    expect(result.current.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cluster:callId',
          label: 'Call IDs',
          isCluster: true,
          memberCount: largeGraphLogs.length,
        }),
        expect.objectContaining({
          id: 'cluster:report',
          label: 'Report IDs',
          isCluster: true,
          memberCount: largeGraphLogs.length,
        }),
      ]),
    );
    expect(result.current.edges[0]).toMatchObject({
      source: 'cluster:callId',
      target: 'cluster:report',
      weight: largeGraphLogs.length,
      isClusterEdge: true,
    });
  });

  it('expands a cluster into its member nodes on toggle', () => {
    const largeGraphLogs = Array.from({ length: (GRAPH_CLUSTER_THRESHOLD / 2) + 50 }, (_, index) => (
      createLogEntry(index + 1, {
        callId: `call-${index}`,
        reportId: `report-${index}`,
      })
    ));

    vi.mocked(useLogContext).mockReturnValue(buildContext(largeGraphLogs));

    const { result } = renderHook(() => useCorrelationGraph());

    act(() => {
      result.current.toggleCluster('callId');
    });

    expect(result.current.expandedClusters).toEqual(['callId']);
    expect(result.current.nodes).toHaveLength(largeGraphLogs.length + 1);
    expect(result.current.nodes.some((node) => node.id === 'callId:call-0')).toBe(true);
    expect(result.current.nodes.some((node) => node.id === 'cluster:report')).toBe(true);
    expect(result.current.edges).toHaveLength(largeGraphLogs.length);
    expect(result.current.edges.every((edge) => edge.target === 'cluster:report' || edge.source === 'cluster:report')).toBe(true);
  });

  it('renders the full graph when expandAllClusters is enabled', () => {
    const largeGraphLogs = Array.from({ length: (GRAPH_CLUSTER_THRESHOLD / 2) + 50 }, (_, index) => (
      createLogEntry(index + 1, {
        callId: `call-${index}`,
        reportId: `report-${index}`,
      })
    ));

    vi.mocked(useLogContext).mockReturnValue(buildContext(largeGraphLogs));

    const { result } = renderHook(() => useCorrelationGraph({ expandAllClusters: true }));

    expect(result.current.isClustered).toBe(false);
    expect(result.current.nodes).toHaveLength(largeGraphLogs.length * 2);
    expect(result.current.edges).toHaveLength(largeGraphLogs.length);
    expect(result.current.nodes.some((node) => node.isCluster)).toBe(false);
  });
});

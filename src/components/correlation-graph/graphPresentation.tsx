import type { Dispatch, JSX, SetStateAction } from 'react';
import type { EdgeData, Graph, GraphData, GraphOptions, IEvent, NodeData } from '@antv/g6';

import {
  CORRELATION_GRAPH_TYPE_META,
  type GraphCorrelationType,
  type GraphEdge,
  type GraphNode,
} from './types';

export const MIN_GRAPH_WIDTH = 320;
export const MIN_GRAPH_HEIGHT = 260;

const TOKEN_FALLBACKS: Record<string, string> = {
  '--correlation-call-id': '#76ce40',
  '--correlation-report-id': '#f59e0b',
  '--correlation-operator-id': '#60a5fa',
  '--correlation-extension-id': '#a78bfa',
  '--correlation-station-id': '#2dd4bf',
  '--correlation-file-name': '#fb7185',
  '--correlation-cnc-id': '#f97316',
  '--correlation-message-id': '#22d3ee',
  '--correlation-graph-edge': 'rgba(150, 152, 140, 0.34)',
  '--correlation-graph-cluster-edge': 'rgba(118, 206, 64, 0.4)',
  '--correlation-graph-label': '#e5eadf',
  '--correlation-graph-muted-label': '#96988c',
  '--correlation-graph-node-stroke': '#2a2e26',
  '--correlation-graph-active-ring': '#d0fdbf',
  '--ring': '#a3a3a3',
};

export interface GraphThemeTokens {
  edge: string;
  clusterEdge: string;
  label: string;
  mutedLabel: string;
  nodeStroke: string;
  activeRing: string;
  focusRing: string;
}

export interface CorrelationNodePayload {
  correlationType: GraphCorrelationType;
  value: string;
  label: string;
  typeLabel: string;
  edgeCount: number;
  logCount: number;
  connectionCount: number;
  isCluster: boolean;
  memberCount: number;
  isActive: boolean;
  isExcluded: boolean;
  isKeyboardFocused: boolean;
}

export interface CorrelationEdgePayload {
  weight: number;
  isClusterEdge: boolean;
  correlationTypes: [GraphCorrelationType, GraphCorrelationType];
  correlationTypeLabels: [string, string];
}

export type CorrelationNodeData = NodeData & {
  data: CorrelationNodePayload;
};

export type CorrelationEdgeData = EdgeData & {
  data: CorrelationEdgePayload;
};

export type GraphPointerEvent = IEvent & {
  targetType: 'node' | 'edge';
  target: {
    id?: string | number;
  };
  canvas?: {
    x?: number;
    y?: number;
  };
  client?: {
    x?: number;
    y?: number;
  };
};

export type GraphTooltipState =
  | {
      kind: 'node';
      x: number;
      y: number;
      node: GraphNode;
    }
  | {
      kind: 'edge';
      x: number;
      y: number;
      edge: GraphEdge;
    };

export type GraphNodeClickEvent = IEvent & {
  targetType: 'node';
  target: {
    id?: string | number;
  };
};

export type GraphWithUpdates = Graph & {
  draw?: () => void | Promise<void>;
  fitView: (options?: { when?: 'always' | 'overflow'; direction?: 'x' | 'y' | 'both' }, animation?: false | {
    duration?: number;
    easing?: string;
  }) => Promise<void>;
  getZoom: () => number;
  layout: () => Promise<void>;
  setLayout: (layout: unknown) => void;
  stopLayout: () => void;
  updateNodeData?: (data: NodeData[]) => void;
  zoomTo: (zoom: number, animation?: false | {
    duration?: number;
    easing?: string;
  }) => Promise<void>;
};

export type AnnouncementState = {
  nonce: number;
  text: string;
};

export type GraphViewportAnimation = false | {
  duration: number;
  easing: string;
};

type FocusDirection = 'first' | 'last' | 'next' | 'previous';
type NodeAction = 'filter-added' | 'filter-removed' | 'cluster-expanded' | 'cluster-collapsed';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function resolveCssToken(token: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function resolveCorrelationColor(token: string): string {
  return resolveCssToken(token, TOKEN_FALLBACKS[token] ?? TOKEN_FALLBACKS['--correlation-call-id']);
}

function resolveNodeTypeFromId(nodeId: string | null): GraphCorrelationType | null {
  if (!nodeId) {
    return null;
  }

  if (nodeId.startsWith('cluster:')) {
    return nodeId.slice('cluster:'.length) as GraphCorrelationType;
  }

  const separatorIndex = nodeId.indexOf(':');
  return separatorIndex > 0 ? (nodeId.slice(0, separatorIndex) as GraphCorrelationType) : null;
}

export function resolveGraphThemeTokens(): GraphThemeTokens {
  return {
    edge: resolveCssToken('--correlation-graph-edge', TOKEN_FALLBACKS['--correlation-graph-edge']),
    clusterEdge: resolveCssToken('--correlation-graph-cluster-edge', TOKEN_FALLBACKS['--correlation-graph-cluster-edge']),
    label: resolveCssToken('--correlation-graph-label', TOKEN_FALLBACKS['--correlation-graph-label']),
    mutedLabel: resolveCssToken('--correlation-graph-muted-label', TOKEN_FALLBACKS['--correlation-graph-muted-label']),
    nodeStroke: resolveCssToken('--correlation-graph-node-stroke', TOKEN_FALLBACKS['--correlation-graph-node-stroke']),
    activeRing: resolveCssToken('--correlation-graph-active-ring', TOKEN_FALLBACKS['--correlation-graph-active-ring']),
    focusRing: resolveCssToken('--ring', TOKEN_FALLBACKS['--ring']),
  };
}

export function measureGraphSurface(surface: HTMLDivElement | null): { width: number; height: number } {
  const width = surface?.clientWidth ?? 0;
  const height = surface?.clientHeight ?? 0;

  return {
    width: width > 0 ? width : MIN_GRAPH_WIDTH,
    height: height > 0 ? height : MIN_GRAPH_HEIGHT,
  };
}

export function buildNodeDatum(
  node: GraphNode,
  theme: GraphThemeTokens,
  isKeyboardFocused = false,
): CorrelationNodeData {
  const nodeColor = resolveCorrelationColor(node.colorToken);
  const baseStrokeColor = node.isCluster ? nodeColor : theme.nodeStroke;
  const strokeColor = isKeyboardFocused
    ? theme.focusRing
    : (node.isActive ? theme.activeRing : (node.isExcluded ? theme.mutedLabel : baseStrokeColor));

  return {
    id: node.id,
    data: {
      correlationType: node.correlationType,
      value: node.value,
      label: node.label,
      typeLabel: node.typeLabel,
      edgeCount: node.edgeCount,
      logCount: node.logCount,
      connectionCount: node.connectionCount,
      isCluster: node.isCluster,
      memberCount: node.memberCount,
      isActive: node.isActive,
      isExcluded: node.isExcluded,
      isKeyboardFocused,
    },
    style: {
      size: node.size,
      fill: nodeColor,
      fillOpacity: node.isExcluded ? 0.08 : (node.isCluster ? 0.3 : 0.16),
      stroke: strokeColor,
      lineWidth: isKeyboardFocused ? 3.5 : (node.isActive ? 3 : (node.isCluster ? 2.4 : (node.isExcluded ? 1.6 : 1.25))),
      opacity: node.isExcluded ? 0.34 : 1,
      lineDash: node.isExcluded ? [4, 3] : undefined,
      label: true,
      labelText: node.isCluster ? `${node.typeLabel}\n${node.memberCount}` : node.label,
      labelPlacement: node.isCluster ? 'center' : 'bottom',
      labelFill: node.isExcluded ? theme.mutedLabel : theme.label,
      labelFontSize: node.isCluster ? 10 : 10,
      labelMaxWidth: node.isCluster ? 128 : 96,
      labelFontStyle: node.isExcluded ? 'italic' : 'normal',
      halo: node.isActive,
      haloFill: theme.activeRing,
      haloStroke: theme.activeRing,
      haloOpacity: node.isActive ? 0.22 : 0,
      shadowColor: isKeyboardFocused ? theme.focusRing : (node.isActive ? theme.activeRing : (node.isCluster ? nodeColor : undefined)),
      shadowBlur: isKeyboardFocused ? 18 : (node.isActive ? 12 : (node.isCluster ? 10 : 0)),
    },
  };
}

export function buildEdgeDatum(edge: GraphEdge, theme: GraphThemeTokens): CorrelationEdgeData {
  const [sourceType, targetType] = edge.correlationTypes;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      weight: edge.weight,
      isClusterEdge: edge.isClusterEdge,
      correlationTypes: edge.correlationTypes,
      correlationTypeLabels: [
        CORRELATION_GRAPH_TYPE_META[sourceType].label,
        CORRELATION_GRAPH_TYPE_META[targetType].label,
      ],
    },
    style: {
      stroke: edge.isClusterEdge ? theme.clusterEdge : theme.edge,
      opacity: edge.isClusterEdge ? 0.5 : 0.32,
      lineWidth: Math.min(5, 1 + (edge.weight * 0.35)),
    },
  };
}

export function buildGraphData(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  focusedNodeId: string | null = null,
): GraphData {
  const theme = resolveGraphThemeTokens();

  return {
    nodes: nodes.map((node) => buildNodeDatum(node, theme, node.id === focusedNodeId)),
    edges: edges.map((edge) => buildEdgeDatum(edge, theme)),
  };
}

export function resolveTooltipPosition(
  event: GraphPointerEvent,
  surface: HTMLDivElement,
): { x: number; y: number } {
  const surfaceWidth = surface.clientWidth || MIN_GRAPH_WIDTH;
  const surfaceHeight = surface.clientHeight || MIN_GRAPH_HEIGHT;

  if (typeof event.canvas?.x === 'number' && typeof event.canvas?.y === 'number') {
    return {
      x: clamp(event.canvas.x + 14, 12, Math.max(12, surfaceWidth - 12)),
      y: clamp(event.canvas.y + 14, 12, Math.max(12, surfaceHeight - 12)),
    };
  }

  if (typeof event.client?.x === 'number' && typeof event.client?.y === 'number') {
    const rect = surface.getBoundingClientRect();

    return {
      x: clamp(event.client.x - rect.left + 14, 12, Math.max(12, surfaceWidth - 12)),
      y: clamp(event.client.y - rect.top + 14, 12, Math.max(12, surfaceHeight - 12)),
    };
  }

  return {
    x: surfaceWidth / 2,
    y: 28,
  };
}

export function renderTooltipContent(tooltip: GraphTooltipState): JSX.Element {
  if (tooltip.kind === 'node') {
    const { node } = tooltip;
    const tooltipValue = node.isCluster ? `${node.memberCount} grouped values` : node.value;

    return (
      <>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          {node.typeLabel}
        </div>
        <div className="mt-1 text-[12px] font-medium text-[var(--foreground)]">
          {tooltipValue}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-[var(--muted-foreground)]">
          <div>Connected logs: {node.logCount}</div>
          <div>Connected nodes: {node.connectionCount}</div>
        </div>
      </>
    );
  }

  const [leftTypeLabel, rightTypeLabel] = tooltip.edge.correlationTypes.map(
    (type) => CORRELATION_GRAPH_TYPE_META[type].label,
  );

  return (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        Shared correlation
      </div>
      <div className="mt-1 text-[12px] font-medium text-[var(--foreground)]">
        {leftTypeLabel} to {rightTypeLabel}
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-[var(--muted-foreground)]">
        <div>Shared log entries: {tooltip.edge.weight}</div>
        <div>Edge weight: {tooltip.edge.weight}</div>
      </div>
    </>
  );
}

export function buildGraphAriaLabel(nodeCount: number, edgeCount: number): string {
  return `Correlation graph. ${nodeCount} ${pluralize(nodeCount, 'node', 'nodes')}, ${edgeCount} ${pluralize(edgeCount, 'edge', 'edges')}.`;
}

export function announce(
  setAnnouncement: Dispatch<SetStateAction<AnnouncementState>>,
  text: string,
): void {
  setAnnouncement((current) => ({
    nonce: current.nonce + 1,
    text,
  }));
}

export function buildFocusedNodeAnnouncement(node: GraphNode): string {
  const valueLabel = node.isCluster ? `${node.memberCount} grouped values` : node.value;
  const stateLabel = node.isCluster
    ? (node.isExcluded ? 'Contains excluded filters.' : (node.isActive ? 'Contains active filters.' : 'Inactive.'))
    : (node.isExcluded ? 'Excluded.' : (node.isActive ? 'Active.' : 'Inactive.'));

  return `${node.typeLabel}, ${valueLabel}, connected to ${node.logCount} ${pluralize(node.logCount, 'log entry', 'log entries')}, ${node.connectionCount} other ${pluralize(node.connectionCount, 'correlation', 'correlations')}. ${stateLabel}`;
}

export function buildActionAnnouncement(node: GraphNode, action: NodeAction): string {
  if (action === 'cluster-expanded') {
    return `${node.label} group expanded.`;
  }

  if (action === 'cluster-collapsed') {
    return `${node.label} group collapsed.`;
  }

  const prefix = action === 'filter-added' ? 'Filter added.' : 'Filter removed.';
  return `${prefix} ${node.typeLabel}, ${node.value}.`;
}

export function reconcileFocusedNodeId(
  nodes: readonly GraphNode[],
  candidateNodeId: string | null,
): string | null {
  if (nodes.length === 0) {
    return null;
  }

  if (candidateNodeId && nodes.some((node) => node.id === candidateNodeId)) {
    return candidateNodeId;
  }

  const candidateType = resolveNodeTypeFromId(candidateNodeId);

  if (candidateType) {
    if (candidateNodeId?.startsWith('cluster:')) {
      const firstMember = nodes.find(
        (node) => !node.isCluster && node.correlationType === candidateType,
      );

      if (firstMember) {
        return firstMember.id;
      }
    }

    const visibleCluster = nodes.find(
      (node) => node.isCluster && node.correlationType === candidateType,
    );

    if (visibleCluster) {
      return visibleCluster.id;
    }

    const firstSameType = nodes.find((node) => node.correlationType === candidateType);
    if (firstSameType) {
      return firstSameType.id;
    }
  }

  return nodes[0]?.id ?? null;
}

export function resolveNextFocusedNodeId(
  nodes: readonly GraphNode[],
  currentNodeId: string | null,
  direction: FocusDirection,
): string | null {
  if (nodes.length === 0) {
    return null;
  }

  if (direction === 'first') {
    return nodes[0].id;
  }

  if (direction === 'last') {
    return nodes[nodes.length - 1].id;
  }

  const currentIndex = nodes.findIndex((node) => node.id === currentNodeId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = direction === 'next'
    ? clamp(safeIndex + 1, 0, nodes.length - 1)
    : clamp(safeIndex - 1, 0, nodes.length - 1);

  return nodes[nextIndex]?.id ?? null;
}

export function syncCanvasAccessibility(surface: HTMLDivElement | null): void {
  if (!surface) {
    return;
  }

  const canvases = surface.querySelectorAll('canvas');
  canvases.forEach((canvas) => {
    canvas.setAttribute('tabindex', '-1');
    canvas.setAttribute('aria-hidden', 'true');
  });
}

export function createForceLayoutOptions(prefersReducedMotion: boolean): GraphOptions['layout'] {
  return {
    type: 'd3-force',
    animation: !prefersReducedMotion,
    preventOverlap: true,
    centerStrength: 0.18,
    collideStrength: 0.9,
    iterations: prefersReducedMotion ? 1 : 220,
    linkDistance: (edgeDatum) => {
      const data = edgeDatum.data as CorrelationEdgePayload | undefined;
      return data?.isClusterEdge ? 180 : 118;
    },
    nodeStrength: (nodeDatum) => {
      const data = nodeDatum.data as CorrelationNodePayload | undefined;
      return data?.isCluster ? -420 : -260;
    },
  };
}

export function resolveViewportAnimation(prefersReducedMotion: boolean): GraphViewportAnimation {
  return prefersReducedMotion ? false : {
    duration: 180,
    easing: 'ease-out',
  };
}

export async function renderGraph(graph: Graph, surface: HTMLDivElement | null): Promise<void> {
  const renderResult = graph.render();

  if (renderResult && typeof (renderResult as Promise<void>).then === 'function') {
    await renderResult;
    syncCanvasAccessibility(surface);
    return;
  }

  syncCanvasAccessibility(surface);
}

export async function drawGraph(graph: GraphWithUpdates, surface: HTMLDivElement | null): Promise<void> {
  const drawResult = graph.draw?.();

  if (drawResult && typeof (drawResult as Promise<void>).then === 'function') {
    await drawResult;
    syncCanvasAccessibility(surface);
    return;
  }

  syncCanvasAccessibility(surface);
}

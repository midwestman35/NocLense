import { useEffect, useMemo, useRef } from 'react';
import {
  Graph,
  NodeEvent,
  type EdgeData,
  type GraphData,
  type IEvent,
  type NodeData,
} from '@antv/g6';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import type { GraphCorrelationType, GraphEdge, GraphNode } from './types';
import { useCorrelationGraph } from './useCorrelationGraph';

const MIN_GRAPH_WIDTH = 320;
const MIN_GRAPH_HEIGHT = 260;

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
};

interface GraphThemeTokens {
  edge: string;
  clusterEdge: string;
  label: string;
  mutedLabel: string;
  nodeStroke: string;
  activeRing: string;
}

interface CorrelationNodePayload {
  correlationType: GraphCorrelationType;
  value: string;
  typeLabel: string;
  edgeCount: number;
  logCount: number;
  connectionCount: number;
  isCluster: boolean;
  memberCount: number;
}

interface CorrelationEdgePayload {
  weight: number;
  logIds: number[];
  isClusterEdge: boolean;
}

type CorrelationNodeData = NodeData & {
  data: CorrelationNodePayload;
};

type CorrelationEdgeData = EdgeData & {
  data: CorrelationEdgePayload;
};

type GraphNodeClickEvent = IEvent & {
  targetType: 'node';
  target: {
    id?: string | number;
  };
};

function resolveCssToken(token: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function resolveGraphThemeTokens(): GraphThemeTokens {
  return {
    edge: resolveCssToken('--correlation-graph-edge', TOKEN_FALLBACKS['--correlation-graph-edge']),
    clusterEdge: resolveCssToken('--correlation-graph-cluster-edge', TOKEN_FALLBACKS['--correlation-graph-cluster-edge']),
    label: resolveCssToken('--correlation-graph-label', TOKEN_FALLBACKS['--correlation-graph-label']),
    mutedLabel: resolveCssToken('--correlation-graph-muted-label', TOKEN_FALLBACKS['--correlation-graph-muted-label']),
    nodeStroke: resolveCssToken('--correlation-graph-node-stroke', TOKEN_FALLBACKS['--correlation-graph-node-stroke']),
    activeRing: resolveCssToken('--correlation-graph-active-ring', TOKEN_FALLBACKS['--correlation-graph-active-ring']),
  };
}

function resolveCorrelationColor(token: string): string {
  return resolveCssToken(token, TOKEN_FALLBACKS[token] ?? TOKEN_FALLBACKS['--correlation-call-id']);
}

function measureGraphSurface(surface: HTMLDivElement | null): { width: number; height: number } {
  const width = surface?.clientWidth ?? 0;
  const height = surface?.clientHeight ?? 0;

  return {
    width: width > 0 ? width : MIN_GRAPH_WIDTH,
    height: height > 0 ? height : MIN_GRAPH_HEIGHT,
  };
}

function buildNodeDatum(node: GraphNode, theme: GraphThemeTokens): CorrelationNodeData {
  const nodeColor = resolveCorrelationColor(node.colorToken);

  return {
    id: node.id,
    data: {
      correlationType: node.correlationType,
      value: node.value,
      typeLabel: node.typeLabel,
      edgeCount: node.edgeCount,
      logCount: node.logCount,
      connectionCount: node.connectionCount,
      isCluster: node.isCluster,
      memberCount: node.memberCount,
    },
    style: {
      size: node.size,
      fill: nodeColor,
      fillOpacity: node.isCluster ? 0.22 : 0.16,
      stroke: node.isActive ? theme.activeRing : theme.nodeStroke,
      lineWidth: node.isActive ? 2.5 : 1.25,
      opacity: node.isExcluded ? 0.45 : 1,
      label: true,
      labelText: node.isCluster ? `${node.label} (${node.memberCount})` : node.label,
      labelPlacement: 'bottom',
      labelFill: node.isExcluded ? theme.mutedLabel : theme.label,
      labelFontSize: node.isCluster ? 11 : 10,
      labelMaxWidth: node.isCluster ? 128 : 96,
      halo: node.isActive,
      haloFill: nodeColor,
      haloStroke: nodeColor,
      haloOpacity: 0.18,
    },
  };
}

function buildEdgeDatum(edge: GraphEdge, theme: GraphThemeTokens): CorrelationEdgeData {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: {
      weight: edge.weight,
      logIds: edge.logIds,
      isClusterEdge: edge.isClusterEdge,
    },
    style: {
      stroke: edge.isClusterEdge ? theme.clusterEdge : theme.edge,
      opacity: edge.isClusterEdge ? 0.5 : 0.32,
      lineWidth: Math.min(5, 1 + (edge.weight * 0.35)),
    },
  };
}

function buildGraphData(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): GraphData {
  const theme = resolveGraphThemeTokens();

  return {
    nodes: nodes.map((node) => buildNodeDatum(node, theme)),
    edges: edges.map((edge) => buildEdgeDatum(edge, theme)),
  };
}

export function CorrelationGraph() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { nodes, edges, toggleCluster } = useCorrelationGraph();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const graphData = useMemo(() => buildGraphData(nodes, edges), [edges, nodes]);

  useEffect(() => {
    const surface = surfaceRef.current;

    if (!surface) {
      return;
    }

    const { width, height } = measureGraphSurface(surface);
    const graph = new Graph({
      container: surface,
      width,
      height,
      padding: 24,
      animation: !prefersReducedMotion,
      autoFit: {
        type: 'view',
        animation: !prefersReducedMotion,
        options: { when: 'always' },
      },
      data: { nodes: [], edges: [] },
      node: { type: 'circle' },
      edge: { type: 'line' },
      layout: {
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
      },
      behaviors: [
        { type: 'drag-canvas' },
        { type: 'zoom-canvas' },
        { type: 'drag-element-force' },
      ],
    });

    const handleNodeClick = (event: IEvent) => {
      if (!('targetType' in event) || event.targetType !== 'node' || !('target' in event)) {
        return;
      }

      const nodeEvent = event as GraphNodeClickEvent;
      const nodeId = nodeEvent.target.id;

      if (typeof nodeId !== 'string') {
        return;
      }

      const clickedNode = graph.getNodeData(nodeId) as CorrelationNodeData;

      if (clickedNode.data?.isCluster) {
        toggleCluster(clickedNode.data.correlationType);
      }
    };

    const resizeGraph = () => {
      const nextSize = measureGraphSurface(surfaceRef.current);
      graph.resize(nextSize.width, nextSize.height);
      void graph.render();
    };

    graphRef.current = graph;
    graph.on(NodeEvent.CLICK, handleNodeClick);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          resizeGraph();
        })
      : null;

    resizeObserver?.observe(surface);

    const cardBody = surface.closest('[data-card-body]');
    if (resizeObserver && cardBody instanceof HTMLElement) {
      resizeObserver.observe(cardBody);
    }

    return () => {
      resizeObserver?.disconnect();
      graph.destroy();
      graphRef.current = null;
    };
  }, [prefersReducedMotion, toggleCluster]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    graphRef.current.setData(graphData);
    void graphRef.current.render();
  }, [graphData]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center px-5 text-center text-xs text-[var(--muted-foreground)]">
        Upload or filter to a correlated result set to render the graph.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full border-t border-[var(--border)]/60 bg-[var(--correlation-graph-bg)]">
      <div
        ref={surfaceRef}
        data-testid="correlation-graph"
        aria-label="Correlation graph"
        className="h-full w-full"
      />
    </div>
  );
}

export default CorrelationGraph;

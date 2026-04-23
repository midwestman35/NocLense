import { Graph, NodeEvent, type IEvent } from '@antv/g6';
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import {
  buildGraphData,
  buildNodeDatum,
  createForceLayoutOptions,
  drawGraph,
  type GraphNodeClickEvent,
  measureGraphSurface,
  renderGraph,
  resolveGraphThemeTokens,
  resolveTooltipPosition,
  resolveViewportAnimation,
  type GraphPointerEvent,
  type GraphTooltipState,
  type GraphWithUpdates,
} from './graphPresentation';
import { detectWebGL2Availability, resolveGraphRendererSelection, ZOOM_STEP } from './graphRuntime';
import type { GraphEdge, GraphNode } from './types';

const FIT_VIEW_OPTIONS = { when: 'always' as const };

interface UseCorrelationGraphCanvasArgs {
  activateNode: (node: GraphNode) => void;
  disableGraphAnimation: boolean;
  edges: readonly GraphEdge[];
  graphData: ReturnType<typeof buildGraphData>;
  graphEdgesById: Map<string, GraphEdge>;
  graphNodesById: Map<string, GraphNode>;
  hasRenderableGraph: boolean;
  isClustered: boolean;
  nodes: readonly GraphNode[];
  onTooltipChange: (tooltip: GraphTooltipState | null) => void;
  renderedNodeCount: number;
  resolvedFocusedNodeId: string | null;
}

interface UseCorrelationGraphCanvasResult {
  handleFitView: () => void;
  handleResetLayout: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
}

export function useCorrelationGraphCanvas({
  activateNode,
  disableGraphAnimation,
  edges,
  graphData,
  graphEdgesById,
  graphNodesById,
  hasRenderableGraph,
  isClustered,
  nodes,
  onTooltipChange,
  renderedNodeCount,
  resolvedFocusedNodeId,
}: UseCorrelationGraphCanvasArgs): UseCorrelationGraphCanvasResult {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphWithUpdates | null>(null);
  const graphNodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const graphEdgesByIdRef = useRef<Map<string, GraphEdge>>(new Map());
  const previousFocusedNodeIdRef = useRef<string | null>(null);

  const viewportAnimation = useMemo(
    () => resolveViewportAnimation(disableGraphAnimation),
    [disableGraphAnimation],
  );
  const webgl2Available = useMemo(() => detectWebGL2Availability(), []);
  const rendererSelection = useMemo(
    () => resolveGraphRendererSelection(renderedNodeCount, webgl2Available),
    [renderedNodeCount, webgl2Available],
  );

  useEffect(() => {
    graphNodesByIdRef.current = graphNodesById;
    graphEdgesByIdRef.current = graphEdgesById;
  }, [graphEdgesById, graphNodesById]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !hasRenderableGraph) {
      return;
    }

    const { height, width } = measureGraphSurface(surface);
    const graph = new Graph({
      container: surface,
      width,
      height,
      padding: 24,
      animation: !disableGraphAnimation,
      data: { nodes: [], edges: [] },
      renderer: rendererSelection.renderer,
      node: { type: 'circle' },
      edge: { type: 'line' },
      layout: createForceLayoutOptions(disableGraphAnimation),
      behaviors: [
        { type: 'drag-canvas' },
        { type: 'zoom-canvas' },
        { type: 'drag-element-force' },
      ],
    }) as GraphWithUpdates;

    const handleNodeClick = (event: IEvent) => {
      if (!('targetType' in event) || event.targetType !== 'node' || !('target' in event)) {
        return;
      }
      const nodeEvent = event as GraphNodeClickEvent;
      const nodeId = nodeEvent.target.id;
      if (typeof nodeId !== 'string') {
        return;
      }
      const clickedNode = graphNodesByIdRef.current.get(nodeId);
      if (!clickedNode) {
        return;
      }
      activateNode(clickedNode);
    };

    const handleNodePointer = (event: IEvent) => {
      if (!surfaceRef.current) {
        return;
      }
      const pointerEvent = event as GraphPointerEvent;
      const nodeId = pointerEvent.target.id;
      if (typeof nodeId !== 'string') {
        return;
      }
      const hoveredNode = graphNodesByIdRef.current.get(nodeId);
      if (!hoveredNode) {
        return;
      }
      const position = resolveTooltipPosition(pointerEvent, surfaceRef.current);
      onTooltipChange({
        kind: 'node',
        x: position.x,
        y: position.y,
        node: hoveredNode,
      });
    };

    const handleEdgePointer = (event: IEvent) => {
      if (!surfaceRef.current) {
        return;
      }
      const pointerEvent = event as GraphPointerEvent;
      const edgeId = pointerEvent.target.id;
      if (typeof edgeId !== 'string') {
        return;
      }
      const hoveredEdge = graphEdgesByIdRef.current.get(edgeId);
      if (!hoveredEdge) {
        return;
      }
      const position = resolveTooltipPosition(pointerEvent, surfaceRef.current);
      onTooltipChange({
        kind: 'edge',
        x: position.x,
        y: position.y,
        edge: hoveredEdge,
      });
    };

    const resizeGraph = () => {
      const nextSize = measureGraphSurface(surfaceRef.current);
      graph.resize(nextSize.width, nextSize.height);
      void graph.fitView(FIT_VIEW_OPTIONS, false);
    };

    graphRef.current = graph;
    graph.on(NodeEvent.CLICK, handleNodeClick);
    graph.on('node:pointerenter', handleNodePointer);
    graph.on('node:pointermove', handleNodePointer);
    graph.on('node:pointerleave', () => onTooltipChange(null));
    graph.on('edge:pointerenter', handleEdgePointer);
    graph.on('edge:pointermove', handleEdgePointer);
    graph.on('edge:pointerleave', () => onTooltipChange(null));

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
  }, [activateNode, disableGraphAnimation, hasRenderableGraph, onTooltipChange, rendererSelection.renderer]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !hasRenderableGraph) {
      return;
    }

    let cancelled = false;
    const syncGraphData = async () => {
      graph.setData(graphData);
      await renderGraph(graph, surfaceRef.current);
      if (!cancelled) {
        await graph.fitView(FIT_VIEW_OPTIONS, viewportAnimation);
      }
    };

    void syncGraphData();

    return () => {
      cancelled = true;
    };
  }, [graphData, hasRenderableGraph, viewportAnimation]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      previousFocusedNodeIdRef.current = resolvedFocusedNodeId;
      return;
    }

    const idsToSync = Array.from(new Set([
      previousFocusedNodeIdRef.current,
      resolvedFocusedNodeId,
    ].filter((nodeId): nodeId is string => Boolean(nodeId))));

    if (idsToSync.length === 0) {
      previousFocusedNodeIdRef.current = resolvedFocusedNodeId;
      return;
    }

    const theme = resolveGraphThemeTokens();
    const nodeUpdates = idsToSync
      .map((nodeId) => graphNodesById.get(nodeId))
      .filter((node): node is GraphNode => Boolean(node))
      .map((node) => buildNodeDatum(node, theme, node.id === resolvedFocusedNodeId));

    if (nodeUpdates.length === 0) {
      previousFocusedNodeIdRef.current = resolvedFocusedNodeId;
      return;
    }

    if (graph.updateNodeData) {
      graph.updateNodeData(nodeUpdates);
      void drawGraph(graph, surfaceRef.current);
    } else {
      graph.setData(buildGraphData(nodes, edges, resolvedFocusedNodeId));
      void renderGraph(graph, surfaceRef.current);
    }

    previousFocusedNodeIdRef.current = resolvedFocusedNodeId;
  }, [edges, graphNodesById, nodes, resolvedFocusedNodeId]);

  const handleZoomIn = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    void graph.zoomTo(graph.getZoom() * ZOOM_STEP, viewportAnimation);
  }, [viewportAnimation]);

  const handleZoomOut = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    void graph.zoomTo(graph.getZoom() / ZOOM_STEP, viewportAnimation);
  }, [viewportAnimation]);

  const handleFitView = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    void graph.fitView(FIT_VIEW_OPTIONS, viewportAnimation);
  }, [viewportAnimation]);

  const handleResetLayout = useCallback(() => {
    const graph = graphRef.current;
    if (!graph || !hasRenderableGraph || isClustered) {
      return;
    }
    graph.stopLayout();
    graph.setLayout(createForceLayoutOptions(disableGraphAnimation));
    void graph.layout().then(() => graph.fitView(FIT_VIEW_OPTIONS, viewportAnimation));
  }, [disableGraphAnimation, hasRenderableGraph, isClustered, viewportAnimation]);

  return {
    handleFitView,
    handleResetLayout,
    handleZoomIn,
    handleZoomOut,
    surfaceRef,
  };
}

import {
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Graph, NodeEvent, type IEvent } from '@antv/g6';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useLogContext } from '../../contexts/LogContext';
import { LARGE_GRAPH_THRESHOLD, type GraphEdge, type GraphNode } from './types';
import { useCorrelationGraph } from './useCorrelationGraph';
import {
  announce,
  type AnnouncementState,
  buildActionAnnouncement,
  buildFocusedNodeAnnouncement,
  buildGraphAriaLabel,
  buildGraphData,
  buildNodeDatum,
  createForceLayoutOptions,
  drawGraph,
  type GraphNodeClickEvent,
  measureGraphSurface,
  reconcileFocusedNodeId,
  renderGraph,
  renderTooltipContent,
  resolveGraphThemeTokens,
  resolveNextFocusedNodeId,
  resolveTooltipPosition,
  resolveViewportAnimation,
  type GraphPointerEvent,
  type GraphTooltipState,
  type GraphWithUpdates,
} from './graphPresentation';
import { CorrelationGraphControls, CorrelationGraphEmptyState, LargeGraphOverlay } from './CorrelationGraphChrome';
import { detectWebGL2Availability, resolveGraphRendererSelection, ZOOM_STEP } from './graphRuntime';

type PendingAction =
  | {
      kind: 'filter';
      node: GraphNode;
    }
  | {
      kind: 'cluster';
      node: GraphNode;
      action: 'cluster-expanded' | 'cluster-collapsed';
    };

type LargeGraphPreference = 'undecided' | 'show-all' | 'keep-clustered';

const EMPTY_ANNOUNCEMENT: AnnouncementState = {
  nonce: 0,
  text: '',
};

const FIT_VIEW_OPTIONS = { when: 'always' as const };

export function CorrelationGraph(): JSX.Element {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { activeCorrelations, toggleCorrelation } = useLogContext();
  const [largeGraphPreference, setLargeGraphPreference] = useState<LargeGraphPreference>('undecided');
  const shouldExpandAllClusters = largeGraphPreference === 'show-all';
  const {
    edges,
    expandedClusters,
    isClustered,
    nodes,
    renderedEdgeCount,
    renderedNodeCount,
    toggleCluster,
    totalEdgeCount,
    totalNodeCount,
  } = useCorrelationGraph({ expandAllClusters: shouldExpandAllClusters });

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [lastFocusedNodeId, setLastFocusedNodeId] = useState<string | null>(null);
  const [isContainerFocused, setIsContainerFocused] = useState(false);
  const [tooltip, setTooltip] = useState<GraphTooltipState | null>(null);
  const [focusAnnouncement, setFocusAnnouncement] = useState<AnnouncementState>(EMPTY_ANNOUNCEMENT);
  const [actionAnnouncement, setActionAnnouncement] = useState<AnnouncementState>(EMPTY_ANNOUNCEMENT);

  const hasRenderableGraph = nodes.length > 0;
  const isLargeGraph = totalNodeCount > LARGE_GRAPH_THRESHOLD;
  const isLargeGraphOverlayVisible = isLargeGraph && largeGraphPreference === 'undecided';
  const disableGraphAnimation = prefersReducedMotion || isLargeGraph;
  const graphAriaLabel = useMemo(
    () => buildGraphAriaLabel(renderedNodeCount, renderedEdgeCount),
    [renderedEdgeCount, renderedNodeCount],
  );
  const graphData = useMemo(() => buildGraphData(nodes, edges), [edges, nodes]);
  const graphNodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const graphEdgesById = useMemo(() => new Map(edges.map((edge) => [edge.id, edge])), [edges]);
  const resolvedFocusedNodeId = useMemo(
    () => (isContainerFocused ? reconcileFocusedNodeId(nodes, focusedNodeId ?? lastFocusedNodeId) : null),
    [focusedNodeId, isContainerFocused, lastFocusedNodeId, nodes],
  );
  const focusedNode = useMemo(
    () => (resolvedFocusedNodeId ? graphNodesById.get(resolvedFocusedNodeId) ?? null : null),
    [graphNodesById, resolvedFocusedNodeId],
  );
  const overlayHeadingId = useId();
  const viewportAnimation = useMemo(
    () => resolveViewportAnimation(disableGraphAnimation),
    [disableGraphAnimation],
  );
  const webgl2Available = useMemo(() => detectWebGL2Availability(), []);
  const rendererSelection = useMemo(
    () => resolveGraphRendererSelection(renderedNodeCount, webgl2Available),
    [renderedNodeCount, webgl2Available],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphWithUpdates | null>(null);
  const graphNodesByIdRef = useRef<Map<string, GraphNode>>(new Map());
  const graphEdgesByIdRef = useRef<Map<string, GraphEdge>>(new Map());
  const previousFocusedNodeIdRef = useRef<string | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const expandedClustersRef = useRef(expandedClusters);
  const toggleClusterRef = useRef(toggleCluster);
  const toggleCorrelationRef = useRef(toggleCorrelation);
  const isContainerFocusedRef = useRef(false);
  const focusedNodeIdRef = useRef<string | null>(null);
  const lastFocusedNodeIdRef = useRef<string | null>(null);
  const overlayPrimaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    graphNodesByIdRef.current = graphNodesById;
    graphEdgesByIdRef.current = graphEdgesById;
    expandedClustersRef.current = expandedClusters;
    toggleClusterRef.current = toggleCluster;
    toggleCorrelationRef.current = toggleCorrelation;
    isContainerFocusedRef.current = isContainerFocused;
    focusedNodeIdRef.current = focusedNodeId;
    lastFocusedNodeIdRef.current = lastFocusedNodeId;
  }, [
    expandedClusters,
    focusedNodeId,
    graphEdgesById,
    graphNodesById,
    isContainerFocused,
    lastFocusedNodeId,
    toggleCluster,
    toggleCorrelation,
  ]);

  useEffect(() => {
    if (!isContainerFocused || !focusedNode) {
      return;
    }
    announce(setFocusAnnouncement, buildFocusedNodeAnnouncement(focusedNode));
  }, [focusedNode, isContainerFocused]);

  useEffect(() => {
    const pendingAction = pendingActionRef.current;
    if (!pendingAction) {
      return;
    }
    if (pendingAction.kind === 'cluster') {
      announce(setActionAnnouncement, buildActionAnnouncement(pendingAction.node, pendingAction.action));
      pendingActionRef.current = null;
      return;
    }
    const nextNodeState = graphNodesById.get(pendingAction.node.id);
    const action = nextNodeState && (nextNodeState.isActive || nextNodeState.isExcluded)
      ? 'filter-added'
      : 'filter-removed';
    announce(setActionAnnouncement, buildActionAnnouncement(pendingAction.node, action));
    pendingActionRef.current = null;
  }, [activeCorrelations, graphNodesById]);

  useEffect(() => {
    if (isLargeGraphOverlayVisible) {
      overlayPrimaryButtonRef.current?.focus();
    }
  }, [isLargeGraphOverlayVisible]);

  const focusGraphContainer = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current?.focus();
    });
  }, []);

  const activateNode = useCallback((node: GraphNode) => {
    setLastFocusedNodeId(node.id);
    if (node.isCluster) {
      pendingActionRef.current = {
        kind: 'cluster',
        node,
        action: expandedClustersRef.current.includes(node.correlationType)
          ? 'cluster-collapsed'
          : 'cluster-expanded',
      };
      toggleClusterRef.current(node.correlationType);
      return;
    }
    pendingActionRef.current = {
      kind: 'filter',
      node,
    };
    toggleCorrelationRef.current({
      type: node.correlationType,
      value: node.value,
    });
  }, []);

  const handleKeepClustered = useCallback(() => {
    setLargeGraphPreference('keep-clustered');
    focusGraphContainer();
  }, [focusGraphContainer]);

  const handleShowAll = useCallback(() => {
    setLargeGraphPreference('show-all');
    focusGraphContainer();
  }, [focusGraphContainer]);

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
      setTooltip({
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
      setTooltip({
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
    graph.on('node:pointerleave', () => setTooltip(null));
    graph.on('edge:pointerenter', handleEdgePointer);
    graph.on('edge:pointermove', handleEdgePointer);
    graph.on('edge:pointerleave', () => setTooltip(null));

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
  }, [activateNode, disableGraphAnimation, hasRenderableGraph, rendererSelection.kind, rendererSelection.renderer]);

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

  const handleContainerFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    setIsContainerFocused(true);
    setTooltip(null);
    setFocusedNodeId((current) => reconcileFocusedNodeId(nodes, current ?? lastFocusedNodeId));
  }, [lastFocusedNodeId, nodes]);

  const handleContainerBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    if (resolvedFocusedNodeId) {
      setLastFocusedNodeId(resolvedFocusedNodeId);
    }

    setIsContainerFocused(false);
    setFocusedNodeId(null);
    setTooltip(null);
  }, [resolvedFocusedNodeId]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.currentTarget !== document.activeElement) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        setTooltip(null);
        {
          const nextFocusedNodeId = resolveNextFocusedNodeId(nodes, resolvedFocusedNodeId, 'next');
          setFocusedNodeId(nextFocusedNodeId);
          setLastFocusedNodeId(nextFocusedNodeId);
        }
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        setTooltip(null);
        {
          const nextFocusedNodeId = resolveNextFocusedNodeId(nodes, resolvedFocusedNodeId, 'previous');
          setFocusedNodeId(nextFocusedNodeId);
          setLastFocusedNodeId(nextFocusedNodeId);
        }
        break;
      }
      case 'Home': {
        event.preventDefault();
        setTooltip(null);
        {
          const nextFocusedNodeId = resolveNextFocusedNodeId(nodes, resolvedFocusedNodeId, 'first');
          setFocusedNodeId(nextFocusedNodeId);
          setLastFocusedNodeId(nextFocusedNodeId);
        }
        break;
      }
      case 'End': {
        event.preventDefault();
        setTooltip(null);
        {
          const nextFocusedNodeId = resolveNextFocusedNodeId(nodes, resolvedFocusedNodeId, 'last');
          setFocusedNodeId(nextFocusedNodeId);
          setLastFocusedNodeId(nextFocusedNodeId);
        }
        break;
      }
      case 'Enter':
      case ' ':
      case 'Spacebar': {
        if (!focusedNode) {
          return;
        }

        event.preventDefault();
        activateNode(focusedNode);
        break;
      }
      case 'Escape': {
        event.preventDefault();
        event.currentTarget.blur();
        break;
      }
      default:
        break;
    }
  }, [activateNode, focusedNode, nodes, resolvedFocusedNodeId]);

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

  if (!hasRenderableGraph) {
    return <CorrelationGraphEmptyState />;
  }

  return (
    <div className="relative h-[300px] w-full border-t border-[var(--border)]/60 bg-[var(--correlation-graph-bg)]">
      <div
        ref={containerRef}
        data-testid="correlation-graph"
        role="application"
        tabIndex={0}
        aria-label={graphAriaLabel}
        onBlur={handleContainerBlur}
        onFocus={handleContainerFocus}
        onKeyDown={handleKeyDown}
        className="h-full w-full focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] focus-visible:ring-offset-[var(--correlation-graph-bg)]"
      >
        <div
          ref={surfaceRef}
          data-testid="correlation-graph-surface"
          aria-hidden="true"
          tabIndex={-1}
          className="h-full w-full"
        />
      </div>

      <CorrelationGraphControls
        disableResetLayout={isClustered}
        onFitView={handleFitView}
        onResetLayout={handleResetLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {isLargeGraphOverlayVisible && (
        <LargeGraphOverlay
          edgeCount={totalEdgeCount}
          headingId={overlayHeadingId}
          nodeCount={totalNodeCount}
          onKeepClustered={handleKeepClustered}
          onShowAll={handleShowAll}
          primaryButtonRef={overlayPrimaryButtonRef}
        />
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={focusAnnouncement.nonce}>{focusAnnouncement.text}</span>
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        <span key={actionAnnouncement.nonce}>{actionAnnouncement.text}</span>
      </div>

      {tooltip && (
        <div
          data-testid="correlation-graph-tooltip"
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-[var(--border)]/80 bg-[color:rgba(20,24,18,0.94)] px-3 py-2 shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          {renderTooltipContent(tooltip)}
        </div>
      )}
    </div>
  );
}

export default CorrelationGraph;

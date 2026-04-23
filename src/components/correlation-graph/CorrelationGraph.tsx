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

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useLogContext } from '../../contexts/LogContext';
import { LARGE_GRAPH_THRESHOLD, type GraphNode } from './types';
import { useCorrelationGraph } from './useCorrelationGraph';
import {
  announce,
  type AnnouncementState,
  buildActionAnnouncement,
  buildFocusedNodeAnnouncement,
  buildGraphAriaLabel,
  buildGraphData,
  reconcileFocusedNodeId,
  renderTooltipContent,
  resolveNextFocusedNodeId,
  type GraphTooltipState,
} from './graphPresentation';
import { CorrelationGraphControls, CorrelationGraphEmptyState, LargeGraphOverlay } from './CorrelationGraphChrome';
import { useCorrelationGraphCanvas } from './useCorrelationGraphCanvas';

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const expandedClustersRef = useRef(expandedClusters);
  const toggleClusterRef = useRef(toggleCluster);
  const toggleCorrelationRef = useRef(toggleCorrelation);
  const overlayPrimaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    expandedClustersRef.current = expandedClusters;
    toggleClusterRef.current = toggleCluster;
    toggleCorrelationRef.current = toggleCorrelation;
  }, [
    expandedClusters,
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

  const {
    handleFitView,
    handleResetLayout,
    handleZoomIn,
    handleZoomOut,
    surfaceRef,
  } = useCorrelationGraphCanvas({
    activateNode,
    disableGraphAnimation,
    edges,
    graphData,
    graphEdgesById,
    graphNodesById,
    hasRenderableGraph,
    isClustered,
    nodes,
    onTooltipChange: setTooltip,
    renderedNodeCount,
    resolvedFocusedNodeId,
  });

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
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-line-2 bg-bg-2/95 px-3 py-2 shadow-[var(--shadow-floating)] backdrop-blur-sm"
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

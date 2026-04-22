import { useCallback, useMemo, useState } from 'react';

import { useLogContext, type CorrelationItem } from '../../contexts/LogContext';
import type { LogEntry } from '../../types';
import {
  CORRELATION_GRAPH_TYPE_META,
  GRAPH_CLUSTER_THRESHOLD,
  GRAPH_CORRELATION_TYPES,
  type CorrelationGraphResult,
  type GraphCorrelationType,
  type GraphEdge,
  type GraphNode,
} from './types';

const NODE_SIZE_MIN = 18;
const NODE_SIZE_RANGE = 18;
const CLUSTER_SIZE_MIN = 28;
const CLUSTER_SIZE_RANGE = 16;

interface BaseGraphNode {
  id: string;
  correlationType: GraphCorrelationType;
  value: string;
  label: string;
  typeLabel: string;
  colorToken: string;
  size: number;
  edgeCount: number;
  connectionCount: number;
  logCount: number;
  neighborIds: string[];
}

interface BaseGraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  logIds: number[];
  correlationTypes: [GraphCorrelationType, GraphCorrelationType];
}

interface BaseGraphData {
  nodes: BaseGraphNode[];
  edges: BaseGraphEdge[];
  nodeById: ReadonlyMap<string, BaseGraphNode>;
  totalNodeCount: number;
  totalEdgeCount: number;
}

interface ActiveNodeState {
  included: ReadonlySet<string>;
  excluded: ReadonlySet<string>;
}

interface GraphValueSeed {
  id: string;
  type: GraphCorrelationType;
  value: string;
  label: string;
  typeLabel: string;
  colorToken: string;
}

interface NodeAccumulator extends GraphValueSeed {
  edgeCount: number;
  logCount: number;
  neighborIds: Set<string>;
}

interface EdgeAccumulator {
  source: string;
  target: string;
  logIds: Set<number>;
  correlationTypes: [GraphCorrelationType, GraphCorrelationType];
}

const GRAPH_VALUE_EXTRACTORS: Record<GraphCorrelationType, (log: LogEntry) => string | undefined> = {
  callId: (log) => log.callId,
  report: (log) => log.reportId,
  operator: (log) => log.operatorId,
  extension: (log) => log.extensionId,
  station: (log) => log.stationId,
  file: (log) => log.fileName,
  cncID: (log) => log.cncID,
  messageID: (log) => log.messageID,
};

function normalizeCorrelationValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getNodeId(type: GraphCorrelationType, value: string): string {
  return `${type}:${value}`;
}

function getClusterId(type: GraphCorrelationType): string {
  return `cluster:${type}`;
}

function isGraphCorrelationType(type: CorrelationItem['type']): type is GraphCorrelationType {
  return (GRAPH_CORRELATION_TYPES as readonly string[]).includes(type);
}

function sortGraphNodes<T extends { correlationType: GraphCorrelationType; value: string }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((left, right) => {
    const typeOrder = GRAPH_CORRELATION_TYPES.indexOf(left.correlationType) - GRAPH_CORRELATION_TYPES.indexOf(right.correlationType);
    if (typeOrder !== 0) {
      return typeOrder;
    }

    return left.value.localeCompare(right.value);
  });
}

function sortGraphEdges<T extends { id: string }>(edges: readonly T[]): T[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}

function getNodeSize(edgeCount: number, maxEdgeCount: number): number {
  if (maxEdgeCount <= 0) {
    return NODE_SIZE_MIN;
  }

  return Math.round(NODE_SIZE_MIN + (edgeCount / maxEdgeCount) * NODE_SIZE_RANGE);
}

function getClusterSize(memberCount: number, maxMemberCount: number): number {
  if (maxMemberCount <= 0) {
    return CLUSTER_SIZE_MIN;
  }

  return Math.round(CLUSTER_SIZE_MIN + (memberCount / maxMemberCount) * CLUSTER_SIZE_RANGE);
}

function createGraphSeeds(log: LogEntry): GraphValueSeed[] {
  const seeds: GraphValueSeed[] = [];

  for (const type of GRAPH_CORRELATION_TYPES) {
    const value = normalizeCorrelationValue(GRAPH_VALUE_EXTRACTORS[type](log));

    if (!value) {
      continue;
    }

    const meta = CORRELATION_GRAPH_TYPE_META[type];

    seeds.push({
      id: getNodeId(type, value),
      type,
      value,
      label: value,
      typeLabel: meta.label,
      colorToken: meta.colorToken,
    });
  }

  return seeds;
}

function buildBaseGraph(filteredLogs: readonly LogEntry[]): BaseGraphData {
  const nodeMap = new Map<string, NodeAccumulator>();
  const edgeMap = new Map<string, EdgeAccumulator>();

  for (const log of filteredLogs) {
    const seeds = createGraphSeeds(log);

    for (const seed of seeds) {
      const existingNode = nodeMap.get(seed.id);

      if (existingNode) {
        existingNode.logCount += 1;
        continue;
      }

      nodeMap.set(seed.id, {
        ...seed,
        edgeCount: 0,
        logCount: 1,
        neighborIds: new Set<string>(),
      });
    }

    if (seeds.length < 2) {
      continue;
    }

    for (let sourceIndex = 0; sourceIndex < seeds.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < seeds.length; targetIndex += 1) {
        const source = seeds[sourceIndex];
        const target = seeds[targetIndex];
        const [leftId, rightId] = [source.id, target.id].sort((left, right) => left.localeCompare(right));
        const edgeId = `${leftId}__${rightId}`;
        const existingEdge = edgeMap.get(edgeId);

        if (existingEdge) {
          existingEdge.logIds.add(log.id);
        } else {
          const orderedTypes: [GraphCorrelationType, GraphCorrelationType] = leftId === source.id
            ? [source.type, target.type]
            : [target.type, source.type];

          edgeMap.set(edgeId, {
            source: leftId,
            target: rightId,
            logIds: new Set<number>([log.id]),
            correlationTypes: orderedTypes,
          });
        }

        const sourceNode = nodeMap.get(source.id);
        const targetNode = nodeMap.get(target.id);

        if (sourceNode && targetNode) {
          sourceNode.edgeCount += 1;
          targetNode.edgeCount += 1;
          sourceNode.neighborIds.add(target.id);
          targetNode.neighborIds.add(source.id);
        }
      }
    }
  }

  const maxEdgeCount = Math.max(0, ...Array.from(nodeMap.values(), (node) => node.edgeCount));

  const nodes = sortGraphNodes(
    Array.from(nodeMap.values(), (node): BaseGraphNode => ({
      id: node.id,
      correlationType: node.type,
      value: node.value,
      label: node.label,
      typeLabel: node.typeLabel,
      colorToken: node.colorToken,
      size: getNodeSize(node.edgeCount, maxEdgeCount),
      edgeCount: node.edgeCount,
      connectionCount: node.neighborIds.size,
      logCount: node.logCount,
      neighborIds: Array.from(node.neighborIds),
    })),
  );

  const edges = sortGraphEdges(
    Array.from(edgeMap.values(), (edge): BaseGraphEdge => ({
      id: `${edge.source}__${edge.target}`,
      source: edge.source,
      target: edge.target,
      weight: edge.logIds.size,
      logIds: Array.from(edge.logIds).sort((left, right) => left - right),
      correlationTypes: edge.correlationTypes,
    })),
  );

  return {
    nodes,
    edges,
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    totalNodeCount: nodes.length,
    totalEdgeCount: edges.length,
  };
}

function buildActiveNodeState(activeCorrelations: readonly CorrelationItem[]): ActiveNodeState {
  const included = new Set<string>();
  const excluded = new Set<string>();

  for (const correlation of activeCorrelations) {
    if (!isGraphCorrelationType(correlation.type)) {
      continue;
    }

    const nodeId = getNodeId(correlation.type, correlation.value);

    if (correlation.excluded) {
      excluded.add(nodeId);
      continue;
    }

    included.add(nodeId);
  }

  return { included, excluded };
}

function decorateBaseNode(node: BaseGraphNode, activeState: ActiveNodeState): GraphNode {
  const isExcluded = activeState.excluded.has(node.id);

  return {
    id: node.id,
    type: node.correlationType,
    correlationType: node.correlationType,
    value: node.value,
    label: node.label,
    typeLabel: node.typeLabel,
    colorToken: node.colorToken,
    size: node.size,
    edgeCount: node.edgeCount,
    connectionCount: node.connectionCount,
    logCount: node.logCount,
    isActive: !isExcluded && activeState.included.has(node.id),
    isExcluded,
    isCluster: false,
    memberCount: 1,
  };
}

function buildClusterNode(
  type: GraphCorrelationType,
  members: readonly BaseGraphNode[],
  activeState: ActiveNodeState,
  maxMemberCount: number,
): GraphNode {
  const meta = CORRELATION_GRAPH_TYPE_META[type];
  const neighborIds = new Set<string>();

  for (const member of members) {
    for (const neighborId of member.neighborIds) {
      neighborIds.add(neighborId);
    }
  }

  const memberIds = new Set(members.map((member) => member.id));
  const visibleNeighborCount = Array.from(neighborIds).filter((neighborId) => !memberIds.has(neighborId)).length;

  return {
    id: getClusterId(type),
    type: 'cluster',
    correlationType: type,
    value: type,
    label: meta.pluralLabel,
    typeLabel: meta.label,
    colorToken: meta.colorToken,
    size: getClusterSize(members.length, maxMemberCount),
    edgeCount: members.reduce((total, member) => total + member.edgeCount, 0),
    connectionCount: visibleNeighborCount,
    logCount: members.reduce((total, member) => total + member.logCount, 0),
    isActive: members.some((member) => activeState.included.has(member.id)),
    isExcluded: members.some((member) => activeState.excluded.has(member.id)),
    isCluster: true,
    memberCount: members.length,
  };
}

function buildRenderedGraph(
  baseGraph: BaseGraphData,
  activeState: ActiveNodeState,
  expandedClusters: readonly GraphCorrelationType[],
): Omit<CorrelationGraphResult, 'expandedClusters' | 'toggleCluster'> {
  if (baseGraph.totalNodeCount <= GRAPH_CLUSTER_THRESHOLD) {
    const nodes = baseGraph.nodes.map((node) => decorateBaseNode(node, activeState));
    const edges: GraphEdge[] = baseGraph.edges.map((edge) => ({
      ...edge,
      isClusterEdge: false,
    }));

    return {
      nodes,
      edges,
      totalNodeCount: baseGraph.totalNodeCount,
      totalEdgeCount: baseGraph.totalEdgeCount,
      renderedNodeCount: nodes.length,
      renderedEdgeCount: edges.length,
      isClustered: false,
    };
  }

  const expandedClusterSet = new Set(expandedClusters);
  const nodesByType = new Map<GraphCorrelationType, BaseGraphNode[]>();

  for (const node of baseGraph.nodes) {
    const currentNodes = nodesByType.get(node.correlationType) ?? [];
    currentNodes.push(node);
    nodesByType.set(node.correlationType, currentNodes);
  }

  const collapsedTypes = GRAPH_CORRELATION_TYPES.filter((type) => nodesByType.has(type) && !expandedClusterSet.has(type));
  const maxMemberCount = Math.max(
    0,
    ...collapsedTypes.map((type) => nodesByType.get(type)?.length ?? 0),
  );

  const renderedNodes: GraphNode[] = [];

  for (const type of GRAPH_CORRELATION_TYPES) {
    const members = nodesByType.get(type);

    if (!members || members.length === 0) {
      continue;
    }

    if (expandedClusterSet.has(type)) {
      renderedNodes.push(...members.map((node) => decorateBaseNode(node, activeState)));
      continue;
    }

    renderedNodes.push(buildClusterNode(type, members, activeState, maxMemberCount));
  }

  const renderedEdges = new Map<string, GraphEdge>();

  for (const edge of baseGraph.edges) {
    const sourceNode = baseGraph.nodeById.get(edge.source);
    const targetNode = baseGraph.nodeById.get(edge.target);

    if (!sourceNode || !targetNode) {
      continue;
    }

    const renderedSource = expandedClusterSet.has(sourceNode.correlationType)
      ? sourceNode.id
      : getClusterId(sourceNode.correlationType);
    const renderedTarget = expandedClusterSet.has(targetNode.correlationType)
      ? targetNode.id
      : getClusterId(targetNode.correlationType);

    if (renderedSource === renderedTarget) {
      continue;
    }

    const [source, target] = [renderedSource, renderedTarget].sort((left, right) => left.localeCompare(right));
    const renderedEdgeId = `${source}__${target}`;
    const existingEdge = renderedEdges.get(renderedEdgeId);

    if (existingEdge) {
      const mergedLogIds = new Set([...existingEdge.logIds, ...edge.logIds]);
      existingEdge.logIds = Array.from(mergedLogIds).sort((left, right) => left - right);
      existingEdge.weight = existingEdge.logIds.length;
      continue;
    }

    renderedEdges.set(renderedEdgeId, {
      id: renderedEdgeId,
      source,
      target,
      weight: edge.logIds.length,
      logIds: [...edge.logIds],
      correlationTypes: edge.correlationTypes,
      isClusterEdge: source.startsWith('cluster:') || target.startsWith('cluster:'),
    });
  }

  const nodes = sortGraphNodes(renderedNodes);
  const edges = sortGraphEdges(Array.from(renderedEdges.values()));

  return {
    nodes,
    edges,
    totalNodeCount: baseGraph.totalNodeCount,
    totalEdgeCount: baseGraph.totalEdgeCount,
    renderedNodeCount: nodes.length,
    renderedEdgeCount: edges.length,
    isClustered: true,
  };
}

export function useCorrelationGraph(): CorrelationGraphResult {
  const { filteredLogs, activeCorrelations } = useLogContext();
  const [expandedClusters, setExpandedClusters] = useState<GraphCorrelationType[]>([]);

  const baseGraph = useMemo(() => buildBaseGraph(filteredLogs), [filteredLogs]);
  const activeState = useMemo(() => buildActiveNodeState(activeCorrelations), [activeCorrelations]);
  const renderedGraph = useMemo(
    () => buildRenderedGraph(baseGraph, activeState, expandedClusters),
    [activeState, baseGraph, expandedClusters],
  );

  const toggleCluster = useCallback((type: GraphCorrelationType) => {
    setExpandedClusters((currentClusters) => (
      currentClusters.includes(type)
        ? currentClusters.filter((clusterType) => clusterType !== type)
        : [...currentClusters, type]
    ));
  }, []);

  return {
    ...renderedGraph,
    expandedClusters,
    toggleCluster,
  };
}

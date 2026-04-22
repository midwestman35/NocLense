export const GRAPH_CLUSTER_THRESHOLD = 500;

export const GRAPH_CORRELATION_TYPES = [
  'callId',
  'report',
  'operator',
  'extension',
  'station',
  'file',
  'cncID',
  'messageID',
] as const;

export type GraphCorrelationType = (typeof GRAPH_CORRELATION_TYPES)[number];

export interface GraphTypeMeta {
  label: string;
  pluralLabel: string;
  colorToken: `--correlation-${string}`;
}

export const CORRELATION_GRAPH_TYPE_META: Record<GraphCorrelationType, GraphTypeMeta> = {
  callId: {
    label: 'Call ID',
    pluralLabel: 'Call IDs',
    colorToken: '--correlation-call-id',
  },
  report: {
    label: 'Report ID',
    pluralLabel: 'Report IDs',
    colorToken: '--correlation-report-id',
  },
  operator: {
    label: 'Operator ID',
    pluralLabel: 'Operator IDs',
    colorToken: '--correlation-operator-id',
  },
  extension: {
    label: 'Extension ID',
    pluralLabel: 'Extension IDs',
    colorToken: '--correlation-extension-id',
  },
  station: {
    label: 'Station ID',
    pluralLabel: 'Station IDs',
    colorToken: '--correlation-station-id',
  },
  file: {
    label: 'File Name',
    pluralLabel: 'File Names',
    colorToken: '--correlation-file-name',
  },
  cncID: {
    label: 'CNC ID',
    pluralLabel: 'CNC IDs',
    colorToken: '--correlation-cnc-id',
  },
  messageID: {
    label: 'Message ID',
    pluralLabel: 'Message IDs',
    colorToken: '--correlation-message-id',
  },
};

export interface GraphNode {
  id: string;
  type: GraphCorrelationType | 'cluster';
  correlationType: GraphCorrelationType;
  value: string;
  label: string;
  typeLabel: string;
  colorToken: string;
  size: number;
  edgeCount: number;
  connectionCount: number;
  logCount: number;
  isActive: boolean;
  isExcluded: boolean;
  isCluster: boolean;
  memberCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  logIds: number[];
  correlationTypes: [GraphCorrelationType, GraphCorrelationType];
  isClusterEdge: boolean;
}

export interface CorrelationGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodeCount: number;
  totalEdgeCount: number;
  renderedNodeCount: number;
  renderedEdgeCount: number;
  isClustered: boolean;
  expandedClusters: GraphCorrelationType[];
  toggleCluster: (type: GraphCorrelationType) => void;
}

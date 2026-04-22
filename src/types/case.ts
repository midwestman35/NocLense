import type { ImportedDataset, LogSourceType } from '../types';

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'open' | 'monitoring' | 'handoff' | 'resolved';
export type BookmarkTag = 'evidence' | 'symptom' | 'milestone' | 'red-herring' | 'action';

export interface Attachment {
  id: string;
  importBatchId?: string;
  fileName: string;
  sourceType: LogSourceType;
  sourceLabel: string;
  size: number;
  importedAt: number;
  kind: ImportedDataset['kind'];
  hash?: string;
  warnings?: string[];
}

export interface Bookmark {
  id: string;
  logId: number;
  tag: BookmarkTag;
  note?: string;
  timestamp: number;
}

export interface Note {
  id: string;
  caseId?: string;
  logId?: number;
  content: string;
  timestamp: number;
}

export interface InvestigationFilters {
  filterText?: string;
  activeCorrelations?: Array<{ type: string; value: string; excluded?: boolean }>;
  selectedMessageTypeFilter?: string | null;
}

export interface CaseState {
  pivots: string[];
  filters: InvestigationFilters;
  timeWindow: { start: number; end: number };
  selectedLogId?: number | null;
  activePanel?: string | null;
}

export interface Case {
  id: string;
  title: string;
  severity: CaseSeverity;
  status: CaseStatus;
  tenant?: string;
  externalRef?: string;
  owner?: string;
  stakeholderTeam?: string;
  summary: string;
  impact: string;
  createdAt: number;
  updatedAt: number;
  attachments: Attachment[];
  bookmarks: Bookmark[];
  notes: Note[];
  timeWindow?: { start: number; end: number } | null;
  state?: CaseState;
  embedding?: number[];
  embeddingVersion?: string;
}

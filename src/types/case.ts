export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BookmarkTag = 'evidence' | 'symptom' | 'milestone' | 'red-herring' | 'action';

export interface Attachment { fileName: string; sourceType: string; size: number; hash?: string; }
export interface Bookmark { id: string; eventId: string; tag: BookmarkTag; note?: string; timestamp: number; }
export interface Note { id: string; caseId?: string; eventId?: string; content: string; timestamp: number; }
export interface CaseState { pivots: string[]; filters: Record<string, any>; timeWindow: { start: number; end: number; }; selectedEventId?: string; }
export interface Case {
  id: string; title: string; severity: CaseSeverity; tenant?: string; summary: string; impact: string;
  createdAt: number; updatedAt: number; attachments: Attachment[]; bookmarks: Bookmark[]; notes: Note[]; state?: CaseState;
}

import type { Case, Bookmark, Note, CaseState } from '../types/case';
export type CaseAction =
  | { type: 'LOAD_CASES'; payload: Case[] }
  | { type: 'CREATE_CASE'; payload: Case }
  | { type: 'UPDATE_CASE'; payload: { id: string; updates: Partial<Case> } }
  | { type: 'DELETE_CASE'; payload: string }
  | { type: 'SET_ACTIVE_CASE'; payload: string | null }
  | { type: 'ADD_BOOKMARK'; payload: { caseId: string; bookmark: Bookmark } }
  | { type: 'REMOVE_BOOKMARK'; payload: { caseId: string; bookmarkId: string } }
  | { type: 'ADD_NOTE'; payload: { caseId: string; note: Note } }
  | { type: 'UPDATE_CASE_STATE'; payload: { caseId: string; state: Partial<CaseState> } };
export interface CaseStoreState { cases: Case[]; activeCaseId: string | null; }
export function caseReducer(state: CaseStoreState, action: CaseAction): CaseStoreState {
  switch (action.type) {
    case 'LOAD_CASES': return { ...state, cases: action.payload };
    case 'CREATE_CASE': return { ...state, cases: [...state.cases, action.payload] };
    case 'UPDATE_CASE': return { ...state, cases: state.cases.map(c => c.id === action.payload.id ? { ...c, ...action.payload.updates, updatedAt: Date.now() } : c) };
    case 'DELETE_CASE': return { ...state, cases: state.cases.filter(c => c.id !== action.payload), activeCaseId: state.activeCaseId === action.payload ? null : state.activeCaseId };
    case 'SET_ACTIVE_CASE': return { ...state, activeCaseId: action.payload };
    case 'ADD_BOOKMARK': return { ...state, cases: state.cases.map(c => c.id === action.payload.caseId ? { ...c, bookmarks: [...c.bookmarks, action.payload.bookmark], updatedAt: Date.now() } : c) };
    case 'REMOVE_BOOKMARK': return { ...state, cases: state.cases.map(c => c.id === action.payload.caseId ? { ...c, bookmarks: c.bookmarks.filter(b => b.id !== action.payload.bookmarkId), updatedAt: Date.now() } : c) };
    case 'ADD_NOTE': return { ...state, cases: state.cases.map(c => c.id === action.payload.caseId ? { ...c, notes: [...c.notes, action.payload.note], updatedAt: Date.now() } : c) };
    case 'UPDATE_CASE_STATE': return { ...state, cases: state.cases.map(c => c.id === action.payload.caseId ? { ...c, state: { ...c.state, ...action.payload.state } as CaseState } : c) };
    default: return state;
  }
}

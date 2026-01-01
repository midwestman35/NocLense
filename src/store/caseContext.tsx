import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Case, Bookmark, Note, CaseState } from '../types/case';
import { caseReducer } from './caseReducer';
import type { CaseAction } from './caseReducer';
import { saveCases, loadCases } from './localStorage';

interface CaseContextValue {
  cases: Case[]; activeCase: Case | null; activeCaseId: string | null; dispatch: React.Dispatch<CaseAction>;
  createCase: (data: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'bookmarks' | 'notes' | 'attachments'>) => void;
  updateCase: (id: string, updates: Partial<Case>) => void; deleteCase: (id: string) => void;
  setActiveCase: (id: string | null) => void; addBookmark: (caseId: string, bookmark: Bookmark) => void;
  removeBookmark: (caseId: string, bookmarkId: string) => void; addNote: (caseId: string, note: Note) => void;
  updateCaseState: (caseId: string, state: Partial<CaseState>) => void;
}

const CaseContext = createContext<CaseContextValue | undefined>(undefined);

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(caseReducer, { cases: [], activeCaseId: null });

  useEffect(() => { const loaded = loadCases(); if (loaded.length > 0) dispatch({ type: 'LOAD_CASES', payload: loaded }); }, []);
  useEffect(() => { if (state.cases.length > 0) saveCases(state.cases); }, [state.cases]);

  const createCase = useCallback((data: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'bookmarks' | 'notes' | 'attachments'>) => {
    const newCase: Case = { ...data, id: `case_${Date.now()}`, createdAt: Date.now(), updatedAt: Date.now(), bookmarks: [], notes: [], attachments: [] };
    dispatch({ type: 'CREATE_CASE', payload: newCase }); dispatch({ type: 'SET_ACTIVE_CASE', payload: newCase.id });
  }, []);
  const updateCase = useCallback((id: string, updates: Partial<Case>) => dispatch({ type: 'UPDATE_CASE', payload: { id, updates } }), []);
  const deleteCase = useCallback((id: string) => dispatch({ type: 'DELETE_CASE', payload: id }), []);
  const setActiveCase = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE_CASE', payload: id }), []);
  const addBookmark = useCallback((caseId: string, bookmark: Bookmark) => dispatch({ type: 'ADD_BOOKMARK', payload: { caseId, bookmark } }), []);
  const removeBookmark = useCallback((caseId: string, bookmarkId: string) => dispatch({ type: 'REMOVE_BOOKMARK', payload: { caseId, bookmarkId } }), []);
  const addNote = useCallback((caseId: string, note: Note) => dispatch({ type: 'ADD_NOTE', payload: { caseId, note } }), []);
  const updateCaseState = useCallback((caseId: string, stateUpdate: Partial<CaseState>) => dispatch({ type: 'UPDATE_CASE_STATE', payload: { caseId, state: stateUpdate } }), []);

  const activeCase = state.activeCaseId ? state.cases.find(c => c.id === state.activeCaseId) || null : null;
  const value: CaseContextValue = { cases: state.cases, activeCase, activeCaseId: state.activeCaseId, dispatch, createCase, updateCase, deleteCase, setActiveCase, addBookmark, removeBookmark, addNote, updateCaseState };
  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() { const ctx = useContext(CaseContext); if (!ctx) throw new Error('useCase must be used within CaseProvider'); return ctx; }

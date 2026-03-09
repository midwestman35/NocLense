import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type { Case, Bookmark, Note, CaseState, CaseSeverity, CaseStatus } from '../types/case';
import { caseReducer } from './caseReducer';
import type { CaseAction } from './caseReducer';
import { saveCases, loadCases } from './localStorage';

interface CreateCaseInput {
  title: string;
  severity?: CaseSeverity;
  status?: CaseStatus;
  tenant?: string;
  externalRef?: string;
  owner?: string;
  stakeholderTeam?: string;
  summary?: string;
  impact?: string;
  timeWindow?: { start: number; end: number } | null;
  state?: CaseState;
}

interface CaseContextValue {
  cases: Case[];
  activeCase: Case | null;
  activeCaseId: string | null;
  dispatch: React.Dispatch<CaseAction>;
  createCase: (data: CreateCaseInput) => string;
  updateCase: (id: string, updates: Partial<Case>) => void;
  deleteCase: (id: string) => void;
  setActiveCase: (id: string | null) => void;
  addBookmark: (caseId: string, bookmark: Bookmark) => void;
  removeBookmark: (caseId: string, bookmarkId: string) => void;
  addNote: (caseId: string, note: Note) => void;
  updateCaseState: (caseId: string, state: Partial<CaseState>) => void;
}

const CaseContext = createContext<CaseContextValue | undefined>(undefined);

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(caseReducer, { cases: [], activeCaseId: null });

  useEffect(() => {
    const loaded = loadCases();
    if (loaded.length > 0) {
      dispatch({ type: 'LOAD_CASES', payload: loaded });
    }
  }, []);

  useEffect(() => {
    saveCases(state.cases);
  }, [state.cases]);

  const createCase = useCallback((data: CreateCaseInput) => {
    const newCase: Case = {
      id: `case_${Date.now()}`,
      title: data.title,
      severity: data.severity ?? 'medium',
      status: data.status ?? 'open',
      tenant: data.tenant,
      externalRef: data.externalRef,
      owner: data.owner,
      stakeholderTeam: data.stakeholderTeam,
      summary: data.summary ?? '',
      impact: data.impact ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachments: [],
      bookmarks: [],
      notes: [],
      timeWindow: data.timeWindow ?? null,
      state: data.state,
    };

    dispatch({ type: 'CREATE_CASE', payload: newCase });
    dispatch({ type: 'SET_ACTIVE_CASE', payload: newCase.id });
    return newCase.id;
  }, []);

  const updateCase = useCallback((id: string, updates: Partial<Case>) => {
    dispatch({ type: 'UPDATE_CASE', payload: { id, updates } });
  }, []);

  const deleteCase = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CASE', payload: id });
  }, []);

  const setActiveCase = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_CASE', payload: id });
  }, []);

  const addBookmark = useCallback((caseId: string, bookmark: Bookmark) => {
    dispatch({ type: 'ADD_BOOKMARK', payload: { caseId, bookmark } });
  }, []);

  const removeBookmark = useCallback((caseId: string, bookmarkId: string) => {
    dispatch({ type: 'REMOVE_BOOKMARK', payload: { caseId, bookmarkId } });
  }, []);

  const addNote = useCallback((caseId: string, note: Note) => {
    dispatch({ type: 'ADD_NOTE', payload: { caseId, note } });
  }, []);

  const updateCaseState = useCallback((caseId: string, stateUpdate: Partial<CaseState>) => {
    dispatch({ type: 'UPDATE_CASE_STATE', payload: { caseId, state: stateUpdate } });
  }, []);

  const activeCase = useMemo(
    () => (state.activeCaseId ? state.cases.find((caseItem) => caseItem.id === state.activeCaseId) ?? null : null),
    [state.activeCaseId, state.cases]
  );

  const value = useMemo(
    () => ({
      cases: state.cases,
      activeCase,
      activeCaseId: state.activeCaseId,
      dispatch,
      createCase,
      updateCase,
      deleteCase,
      setActiveCase,
      addBookmark,
      removeBookmark,
      addNote,
      updateCaseState,
    }),
    [activeCase, addBookmark, addNote, createCase, deleteCase, removeBookmark, setActiveCase, state.activeCaseId, state.cases, updateCase, updateCaseState]
  );

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCase must be used within CaseProvider');
  }
  return context;
}

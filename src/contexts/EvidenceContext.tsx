/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useCase } from '../store/caseContext';
import {
  asCaseId,
  type Block,
  type BlockId,
  type CaseId,
  type EvidenceItem,
  type EvidenceSet,
  type Investigation,
} from '../types/canonical';

interface EvidenceContextValue {
  investigation: Investigation | null;
  evidenceSet: EvidenceSet | null;
  setInvestigation: (inv: Investigation) => void;
  restoreEvidenceSet: (set: EvidenceSet) => void;
  pinBlock: (block: Block, pinnedBy: 'user' | 'ai') => void;
  unpinBlock: (blockId: BlockId) => void;
  reorderItems: (orderedIds: BlockId[]) => void;
  updateItemNote: (blockId: BlockId, note: string | undefined) => void;
}

const EvidenceContext = createContext<EvidenceContextValue | undefined>(undefined);

function getInitialCaseId(activeCaseId: string | null): CaseId {
  return asCaseId(activeCaseId ?? '');
}

function buildEvidenceSet(inv: Investigation, activeCaseId: string | null): EvidenceSet {
  return {
    caseId: getInitialCaseId(activeCaseId),
    investigationId: inv.id,
    items: [],
  };
}

function reorderItems(items: EvidenceItem[]): EvidenceItem[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

export function EvidenceProvider({ children }: { children: ReactNode }): JSX.Element {
  const { activeCaseId, createCase } = useCase();
  const [investigation, setInvestigationState] = useState<Investigation | null>(null);
  const [evidenceSet, setEvidenceSet] = useState<EvidenceSet | null>(null);
  const investigationRef = useRef<Investigation | null>(null);
  const evidenceSetRef = useRef<EvidenceSet | null>(null);

  const commitInvestigation = useCallback((next: Investigation | null) => {
    investigationRef.current = next;
    setInvestigationState(next);
  }, []);

  const commitEvidenceSet = useCallback((next: EvidenceSet | null) => {
    evidenceSetRef.current = next;
    setEvidenceSet(next);
  }, []);

  const setInvestigation = useCallback((inv: Investigation) => {
    commitInvestigation(inv);
    commitEvidenceSet(buildEvidenceSet(inv, activeCaseId));
  }, [activeCaseId, commitEvidenceSet, commitInvestigation]);

  const restoreEvidenceSet = useCallback((set: EvidenceSet) => {
    commitEvidenceSet(set);
  }, [commitEvidenceSet]);

  const pinBlock = useCallback((block: Block, pinnedBy: 'user' | 'ai') => {
    const currentInvestigation = investigationRef.current;
    const currentEvidenceSet = evidenceSetRef.current;
    if (!currentInvestigation || !currentEvidenceSet) return;

    let nextCaseId = currentEvidenceSet.caseId;
    if (!activeCaseId && !currentEvidenceSet.caseId) {
      const contextBlock = currentInvestigation.blocks.find((candidate) => candidate.kind === 'context');
      const title = contextBlock
        ? `${contextBlock.body.customer} · ${contextBlock.body.ticketUrl ?? 'investigation'}`
        : 'Investigation';
      nextCaseId = asCaseId(createCase({ title }));
    } else if (activeCaseId) {
      nextCaseId = asCaseId(activeCaseId);
    }

    const now = Date.now();
    const existing = currentEvidenceSet.items.find((item) => item.blockId === block.id);
    if (existing) {
      const remaining = currentEvidenceSet.items.filter((item) => item.blockId !== block.id);
      commitEvidenceSet({
        ...currentEvidenceSet,
        caseId: nextCaseId,
        items: reorderItems([{ ...existing, pinnedAt: now }, ...remaining]),
      });
      return;
    }

    commitEvidenceSet({
      ...currentEvidenceSet,
      caseId: nextCaseId,
      items: reorderItems([
        {
          blockId: block.id,
          pinnedAt: now,
          pinnedBy,
          order: 0,
        },
        ...currentEvidenceSet.items,
      ]),
    });
  }, [activeCaseId, commitEvidenceSet, createCase]);

  const unpinBlock = useCallback((blockId: BlockId) => {
    const currentEvidenceSet = evidenceSetRef.current;
    if (!currentEvidenceSet) return;
    commitEvidenceSet({
      ...currentEvidenceSet,
      items: reorderItems(currentEvidenceSet.items.filter((item) => item.blockId !== blockId)),
    });
  }, [commitEvidenceSet]);

  const reorderEvidenceItems = useCallback((orderedIds: BlockId[]) => {
    const currentEvidenceSet = evidenceSetRef.current;
    if (!currentEvidenceSet) return;
    const lookup = new Map(currentEvidenceSet.items.map((item) => [item.blockId, item]));
    const orderedItems = orderedIds
      .map((id) => lookup.get(id))
      .filter((item): item is EvidenceItem => Boolean(item));
    const remaining = currentEvidenceSet.items.filter((item) => !orderedIds.includes(item.blockId));
    commitEvidenceSet({
      ...currentEvidenceSet,
      items: reorderItems([...orderedItems, ...remaining]),
    });
  }, [commitEvidenceSet]);

  const updateItemNote = useCallback((blockId: BlockId, note: string | undefined) => {
    const currentEvidenceSet = evidenceSetRef.current;
    if (!currentEvidenceSet) return;
    commitEvidenceSet({
      ...currentEvidenceSet,
      items: currentEvidenceSet.items.map((item) => {
        if (item.blockId !== blockId) return item;
        if (note === undefined) {
          const nextItem = { ...item };
          delete nextItem.note;
          return nextItem;
        }
        return { ...item, note };
      }),
    });
  }, [commitEvidenceSet]);

  const value = useMemo<EvidenceContextValue>(() => ({
    investigation,
    evidenceSet,
    setInvestigation,
    restoreEvidenceSet,
    pinBlock,
    unpinBlock,
    reorderItems: reorderEvidenceItems,
    updateItemNote,
  }), [evidenceSet, investigation, pinBlock, reorderEvidenceItems, restoreEvidenceSet, setInvestigation, unpinBlock, updateItemNote]);

  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence(): EvidenceContextValue {
  const context = useContext(EvidenceContext);
  if (!context) {
    throw new Error('useEvidence must be used within EvidenceProvider');
  }
  return context;
}

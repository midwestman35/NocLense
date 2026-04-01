import { useEffect, useRef } from 'react';
import { useCase } from '../../store/caseContext';
import { useLogContext, type CorrelationItem } from '../../contexts/LogContext';

/**
 * CaseStateBridge — syncs active case state with LogContext filters.
 * When a case is selected, restores its saved filter/correlation state.
 * When filters change, persists them to the active case.
 */
export function CaseStateBridge() {
  const { activeCase, updateCaseState } = useCase();
  const {
    activeCorrelations,
    setActiveCorrelations,
    filterText,
    setFilterText,
    selectedMessageTypeFilter,
    setSelectedMessageTypeFilter,
    selectedLogId,
    setSelectedLogId,
    visibleRange,
  } = useLogContext();
  const restoringCaseId = useRef<string | null>(null);

  // Restore case state when active case changes
  useEffect(() => {
    if (!activeCase) {
      restoringCaseId.current = null;
      return;
    }

    if (restoringCaseId.current === activeCase.id) {
      return;
    }

    const state = activeCase.state;
    if (state) {
      setFilterText(state.filters.filterText ?? '');
      setActiveCorrelations((state.filters.activeCorrelations as CorrelationItem[] | undefined) ?? []);
      setSelectedMessageTypeFilter(state.filters.selectedMessageTypeFilter ?? null);
      setSelectedLogId(state.selectedLogId ?? null);
    }

    restoringCaseId.current = activeCase.id;
  }, [activeCase, setActiveCorrelations, setFilterText, setSelectedLogId, setSelectedMessageTypeFilter]);

  // Persist case state when filters change
  useEffect(() => {
    if (!activeCase) return;

    const timeoutId = window.setTimeout(() => {
      updateCaseState(activeCase.id, {
        pivots: activeCorrelations.map((item) => `${item.type}:${item.value}${item.excluded ? ':excluded' : ''}`),
        filters: {
          filterText,
          activeCorrelations,
          selectedMessageTypeFilter,
        },
        timeWindow: activeCase.timeWindow ?? visibleRange,
        selectedLogId,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeCase, activeCorrelations, filterText, selectedLogId, selectedMessageTypeFilter, updateCaseState, visibleRange]);

  return null;
}

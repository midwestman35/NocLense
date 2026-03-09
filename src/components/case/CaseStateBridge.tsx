import { useEffect, useRef } from 'react';
import { useCase } from '../../store/caseContext';
import { useLogContext, type CorrelationItem } from '../../contexts/LogContext';
import type { PanelId } from '../layout/IconRail';

export function CaseStateBridge({
  activePanel,
  onActivePanelChange,
}: {
  activePanel: PanelId | null;
  onActivePanelChange: (panel: PanelId | null) => void;
}) {
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
      onActivePanelChange((state.activePanel as PanelId | null | undefined) ?? null);
    }

    restoringCaseId.current = activeCase.id;
  }, [activeCase, onActivePanelChange, setActiveCorrelations, setFilterText, setSelectedLogId, setSelectedMessageTypeFilter]);

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
        activePanel,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeCase, activeCorrelations, activePanel, filterText, selectedLogId, selectedMessageTypeFilter, updateCaseState, visibleRange]);

  return null;
}

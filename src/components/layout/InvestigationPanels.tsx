import { useMemo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui';
import { useLogContext, type CorrelationItem } from '../../contexts/LogContext';
import { useAI } from '../../contexts/AIContext';
import { useCase } from '../../store/caseContext';
import type { PanelId } from './IconRail';
import { CasePanel } from '../case/CasePanel';

function PanelSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[var(--border)] last:border-b-0">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</h3>
        {meta ? <span className="text-[10px] text-[var(--muted-foreground)]">{meta}</span> : null}
      </div>
      <div className="pb-2">{children}</div>
    </section>
  );
}

function DenseList({
  items,
  type,
  counts,
  activeCorrelations,
  onToggle,
  emptyLabel,
  onRemoveFile,
}: {
  items: string[];
  type: CorrelationItem['type'];
  counts: Record<string, number>;
  activeCorrelations: CorrelationItem[];
  onToggle: (item: CorrelationItem) => void;
  emptyLabel: string;
  onRemoveFile?: (value: string) => void;
}) {
  if (items.length === 0) {
    return <div className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-0.5 px-2">
      {items.map((item) => {
        const isActive = activeCorrelations.some(
          (correlation) => correlation.type === type && correlation.value === item && !correlation.excluded
        );
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle({ type, value: item })}
            className={clsx(
              'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[11px] transition-colors',
              isActive
                ? 'bg-[var(--muted)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono" title={item}>{item}</span>
            <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              {counts[`${type}:${item}`] ?? 0}
            </span>
            {onRemoveFile ? (
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveFile(item);
                }}
                className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                role="button"
                tabIndex={0}
              >
                Remove
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function useInvestigationPanels({ onSetupAI }: { onSetupAI: () => void }): Record<PanelId, ReactNode> {
  const {
    logs,
    filteredLogs,
    correlationData,
    correlationCounts,
    activeCorrelations,
    toggleCorrelation,
    clearAllFilters,
    availableMessageTypes,
    excludedMessageTypes,
    selectedMessageTypeFilter,
    setSelectedMessageTypeFilter,
    toggleExcludedMessageType,
    removeFile,
    importedDatasets,
  } = useLogContext();
  const { isEnabled, apiKeyConfigured, onboardingCompleted, provider } = useAI();
  const { activeCase } = useCase();

  const messageTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      if (!log.messageType) continue;
      counts.set(log.messageType, (counts.get(log.messageType) ?? 0) + 1);
    }
    return counts;
  }, [filteredLogs]);

  return useMemo(
    () => ({
      case: <CasePanel />,
      files: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="Imported datasets" meta={`${importedDatasets.length}`}>
            {importedDatasets.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">No datasets loaded yet.</div>
            ) : (
              <div className="space-y-1 px-2">
                {importedDatasets.map((dataset) => (
                  <div key={dataset.id} className="rounded border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrelation({ type: 'file', value: dataset.fileName })}
                        className="truncate font-medium text-[var(--foreground)] hover:text-[var(--foreground)]"
                        title={dataset.fileName}
                      >
                        {dataset.fileName}
                      </button>
                      <span className="uppercase tracking-[0.14em]">{dataset.sourceLabel}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span>{dataset.logCount.toLocaleString()} events</span>
                      <button type="button" onClick={() => void removeFile(dataset.fileName)} className="hover:text-[var(--destructive)]">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
          <PanelSection title="File pivots" meta={`${correlationData.fileNames.length}`}>
            <DenseList
              items={correlationData.fileNames.slice(0, 12)}
              type="file"
              counts={correlationCounts}
              activeCorrelations={activeCorrelations}
              onToggle={toggleCorrelation}
              emptyLabel="No files loaded yet."
              onRemoveFile={removeFile}
            />
          </PanelSection>
          <div className="px-3 py-3 text-[11px] text-[var(--muted-foreground)]">
            {logs.length === 0
              ? 'Load one or more datasets to inspect source-level context.'
              : `${logs.length.toLocaleString()} events available in the current workspace.`}
          </div>
        </div>
      ),
      callIds: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="Call IDs" meta={`${correlationData.callIds.length}`}>
            <DenseList
              items={correlationData.callIds.slice(0, 18)}
              type="callId"
              counts={correlationCounts}
              activeCorrelations={activeCorrelations}
              onToggle={toggleCorrelation}
              emptyLabel="No call IDs found in the current dataset."
            />
          </PanelSection>
        </div>
      ),
      reports: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="Reports" meta={`${correlationData.reportIds.length}`}>
            <DenseList
              items={correlationData.reportIds.slice(0, 12)}
              type="report"
              counts={correlationCounts}
              activeCorrelations={activeCorrelations}
              onToggle={toggleCorrelation}
              emptyLabel="No report IDs found in the current dataset."
            />
          </PanelSection>
        </div>
      ),
      stations: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="Stations" meta={`${correlationData.stationIds.length}`}>
            <DenseList
              items={correlationData.stationIds.slice(0, 12)}
              type="station"
              counts={correlationCounts}
              activeCorrelations={activeCorrelations}
              onToggle={toggleCorrelation}
              emptyLabel="No station IDs found in the current dataset."
            />
          </PanelSection>
        </div>
      ),
      ai: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="AI Assistant" meta={provider === 'codex' ? 'ChatGPT (OpenAI)' : undefined}>
            <div className="px-3 space-y-3">
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--accent)] px-3 py-2">
                <div className="text-[11px] font-medium text-[var(--foreground)]">
                  {onboardingCompleted ? 'AI is configured for investigation support.' : 'Finish setup before first use.'}
                </div>
                <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  Use AI for filtered-log questions only after the case evidence is in view.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Provider</div>
                  <div className="mt-1 text-[var(--foreground)]">
                    {provider === 'codex' ? 'ChatGPT (OpenAI)' : provider === 'claude' ? 'Claude' : 'Gemini'}
                  </div>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Status</div>
                  <div className="mt-1 text-[var(--foreground)]">{isEnabled && apiKeyConfigured ? 'Ready' : 'Needs setup'}</div>
                </div>
              </div>
              <Button variant="outline" className="h-8 w-full justify-between text-xs" onClick={onSetupAI}>
                {onboardingCompleted ? 'Review AI setup' : 'Set up AI'}
                <ChevronRight size={14} />
              </Button>
            </div>
          </PanelSection>
        </div>
      ),
      filters: (
        <div className="h-full overflow-y-auto">
          <PanelSection title="Working view" meta={activeCase ? activeCase.title : 'Workspace only'}>
            <div className="px-3 text-[11px] text-[var(--muted-foreground)]">
              {activeCase
                ? `Active case has ${activeCase.bookmarks.length} evidence items and ${activeCase.notes.length} notes.`
                : 'No active case selected. Filters still work, but evidence and handoff export stay disabled.'}
            </div>
          </PanelSection>
          <PanelSection title="Message Types" meta={`${availableMessageTypes.length}`}>
            <div className="space-y-1 px-2">
              {availableMessageTypes.length === 0 ? (
                <div className="px-1 py-2 text-[11px] text-[var(--muted-foreground)]">No message types available.</div>
              ) : (
                availableMessageTypes.map((type) => {
                  const isSelected = selectedMessageTypeFilter === type;
                  const isExcluded = excludedMessageTypes.has(type);
                  return (
                    <div key={type} className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--muted)]">
                      <button
                        type="button"
                        onClick={() => setSelectedMessageTypeFilter(isSelected ? null : type)}
                        className={clsx(
                          'min-w-0 flex-1 truncate text-left text-[11px]',
                          isSelected ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                        )}
                      >
                        {type}
                      </button>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{messageTypeCounts.get(type) ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => toggleExcludedMessageType(type)}
                        className={clsx(
                          'rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]',
                          isExcluded
                            ? 'border-[var(--destructive)]/40 text-[var(--destructive)]'
                            : 'border-[var(--border)] text-[var(--muted-foreground)]'
                        )}
                      >
                        Hide
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </PanelSection>
          <PanelSection title="Reset" meta={`${filteredLogs.length.toLocaleString()} visible`}>
            <div className="px-3">
              <Button variant="ghost" className="h-8 w-full justify-start px-2 text-xs" onClick={clearAllFilters}>
                Clear all filters
              </Button>
            </div>
          </PanelSection>
        </div>
      ),
    }),
    [
      activeCase,
      activeCorrelations,
      apiKeyConfigured,
      availableMessageTypes,
      clearAllFilters,
      correlationCounts,
      correlationData.callIds,
      correlationData.fileNames,
      correlationData.reportIds,
      correlationData.stationIds,
      excludedMessageTypes,
      filteredLogs.length,
      importedDatasets,
      isEnabled,
      logs.length,
      messageTypeCounts,
      onboardingCompleted,
      onSetupAI,
      provider,
      removeFile,
      selectedMessageTypeFilter,
      setSelectedMessageTypeFilter,
      toggleCorrelation,
      toggleExcludedMessageType,
    ]
  );
}

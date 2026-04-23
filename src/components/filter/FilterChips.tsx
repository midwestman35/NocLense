import { useLogContext } from '../../contexts/LogContext';
import { X } from 'lucide-react';

export default function FilterChips() {
  const {
    hasActiveFilters,
    activeCorrelations,
    toggleCorrelation,
    clearAllFilters,
    jumpState,
    setJumpState,
    setActiveCorrelations,
    setFilterText,
  } = useLogContext();
  const hasJumpRestore = jumpState.active && jumpState.previousFilters != null;

  if (!hasActiveFilters && !hasJumpRestore) return null;

  const handleRestoreFilters = () => {
    const previousFilters = jumpState.previousFilters;
    if (!previousFilters) return;

    setActiveCorrelations(previousFilters.activeCorrelations ?? []);
    setFilterText(previousFilters.filterText ?? '');
    setJumpState({ active: false, previousFilters: null });
  };

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient min-w-0 flex-1">
        {hasJumpRestore && (
          <button
            type="button"
            onClick={handleRestoreFilters}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-xs font-medium text-amber shadow-[var(--shadow-flat)] hover:bg-amber/15"
            title="Restore the filters cleared by Jump To"
          >
            Restore jump filters
          </button>
        )}
        {activeCorrelations.map((filter) => (
          <div
            key={`${filter.type}-${filter.value}`}
            className="flex items-center gap-1 rounded-full border border-[var(--foreground)]/20 bg-[var(--foreground)]/10 px-2.5 py-1 text-xs whitespace-nowrap text-[var(--foreground)] shadow-[var(--shadow-flat)] shrink-0"
          >
            <span className="font-bold uppercase opacity-75 text-[10px] tracking-wider">{filter.type}:</span>
            <span className="font-mono font-medium">{filter.value}</span>
            <button
              onClick={() => toggleCorrelation(filter)}
              className="ml-1 hover:text-[var(--destructive)] transition-colors p-0.5 rounded-full hover:bg-[var(--destructive)]/10"
              title={`Remove ${filter.type} filter`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={clearAllFilters}
        className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        title="Clear all filters (keeps log data)"
      >
        <X size={14} />
        Clear filters
      </button>
    </div>
  );
}

import { useRef } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { X } from 'lucide-react';
import { useAnimeStagger } from '../../utils/anime';

export default function FilterChips() {
  const { hasActiveFilters, activeCorrelations, toggleCorrelation, clearAllFilters } = useLogContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useAnimeStagger(containerRef, '.filter-chip', [activeCorrelations.length], {
    translateY: [6, 0],
    opacity: [0, 1],
    stagger: 30,
    duration: 200,
  });

  if (!hasActiveFilters) return null;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div ref={containerRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient min-w-0 flex-1">
        {activeCorrelations.map((filter) => (
          <div
            key={`${filter.type}-${filter.value}`}
            className="filter-chip flex items-center gap-1 bg-[var(--foreground)]/10 text-[var(--foreground)] border border-[var(--foreground)]/20 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shadow-sm shrink-0"
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

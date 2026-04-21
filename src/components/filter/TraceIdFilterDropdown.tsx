import { Check, Fingerprint, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface TraceIdFilterDropdownProps {
  traceIds: string[];
  selectedTraceIds: string[];
  onToggle: (traceId: string) => void;
  onClear: () => void;
}

function describeSelection(selectedTraceIds: string[]): string {
  if (selectedTraceIds.length === 0) return 'Trace ID';
  if (selectedTraceIds.length === 1) return selectedTraceIds[0].slice(0, 12);
  return `${selectedTraceIds.length} selected`;
}

export default function TraceIdFilterDropdown({
  traceIds,
  selectedTraceIds,
  onToggle,
  onClear,
}: TraceIdFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortedTraceIds = useMemo(
    () => traceIds.slice().sort((left, right) => left.localeCompare(right)),
    [traceIds],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (sortedTraceIds.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          selectedTraceIds.length > 0
            ? 'border-[var(--ring)] bg-[var(--accent)] text-[var(--foreground)]'
            : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        <Fingerprint size={12} />
        <span className="max-w-[14ch] truncate" title={selectedTraceIds.join(', ') || 'Trace IDs'}>
          {describeSelection(selectedTraceIds)}
        </span>
        {selectedTraceIds.length > 0 && (
          <span
            className="rounded-full p-0.5 hover:bg-[var(--destructive)]/10"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            <X size={10} />
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-[60] mt-1 min-w-[280px] rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--shadow-raised)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            <span>Trace IDs</span>
            {selectedTraceIds.length > 0 && (
              <button
                type="button"
                className="text-[10px] text-[var(--foreground)] hover:underline"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {sortedTraceIds.map((traceId) => {
              const selected = selectedTraceIds.includes(traceId);
              return (
                <button
                  key={traceId}
                  type="button"
                  onClick={() => onToggle(traceId)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    selected
                      ? 'bg-[var(--foreground)]/10 text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <span className="flex w-4 shrink-0 items-center justify-center">
                    {selected ? <Check size={12} /> : null}
                  </span>
                  <span className="truncate font-mono" title={traceId}>
                    {traceId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

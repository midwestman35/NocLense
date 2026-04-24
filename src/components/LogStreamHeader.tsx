import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useLogContext } from '../contexts/LogContext';
import { useAnimeStagger, useAnimeValue } from '../utils/anime';

const LEVEL_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ERROR: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'ERR' },
  WARN: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'WRN' },
  INFO: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'INF' },
  DEBUG: { bg: 'bg-[var(--muted)]', text: 'text-[var(--muted-foreground)]', label: 'DBG' },
};

export function LogHeader() {
  const {
    sortConfig,
    setSortConfig,
    selectedComponentFilter,
    setSelectedComponentFilter,
    logs,
  } = useLogContext();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [serviceMappingValues, setServiceMappingValues] = useState<string[]>([]);

  useEffect(() => {
    if (!showAllServices || serviceMappingValues.length > 0) return;

    let cancelled = false;
    const loadServiceMappings = async (): Promise<void> => {
      try {
        const response = await fetch('/service-mappings.json');
        if (!response.ok) return;

        const mappings = (await response.json()) as Record<string, string>;
        if (!cancelled) {
          setServiceMappingValues(Object.values(mappings));
        }
      } catch {
        if (!cancelled) {
          setServiceMappingValues([]);
        }
      }
    };

    void loadServiceMappings();

    return () => {
      cancelled = true;
    };
  }, [serviceMappingValues.length, showAllServices]);

  const availableComponents = useMemo(() => {
    const components = new Set(logs.map((log) => log.displayComponent));
    if (showAllServices) {
      serviceMappingValues.forEach((value) => components.add(value));
    }
    return Array.from(components).sort();
  }, [logs, serviceMappingValues, showAllServices]);

  const toggleSort = (field: 'timestamp' | 'level'): void => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  return (
    <div className="log-grid sticky top-0 z-10 h-8 items-center border-b border-[var(--border)] bg-transparent px-2 text-[11px] font-medium text-[var(--muted-foreground)]">
      <div className="text-center">#</div>
      <button type="button" className="flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => toggleSort('timestamp')}>
        Timestamp
        {sortConfig.field === 'timestamp' && (sortConfig.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
      <div className="flex min-w-0 items-center gap-3">
        <span>Type</span>
        <div className="relative">
          <button type="button" className="flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => setIsFilterOpen((current) => !current)}>
            Service
            <Filter size={10} className={selectedComponentFilter ? 'text-[var(--foreground)]' : ''} />
          </button>
          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-48 border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-raised)]">
                <label className="mb-1.5 flex cursor-pointer items-center gap-2 border-b border-[var(--border)] px-1.5 pb-1.5 text-[11px] text-[var(--foreground)]">
                  <input type="checkbox" checked={showAllServices} onChange={() => setShowAllServices((current) => !current)} />
                  Show All
                </label>
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  <button
                    type="button"
                    className={`w-full px-1.5 py-1 text-left text-[11px] ${
                      !selectedComponentFilter
                        ? 'bg-[var(--muted)] text-[var(--foreground)]'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                    onClick={() => {
                      setSelectedComponentFilter(null);
                      setIsFilterOpen(false);
                    }}
                  >
                    All Services
                  </button>
                  {availableComponents.map((component) => (
                    <button
                      key={component}
                      type="button"
                      className={`w-full px-1.5 py-1 text-left text-[11px] ${
                        selectedComponentFilter === component
                          ? 'bg-[var(--muted)] text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                      }`}
                      onClick={() => {
                        setSelectedComponentFilter(component);
                        setIsFilterOpen(false);
                      }}
                    >
                      {component}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <button type="button" className="flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => toggleSort('level')}>
          Lvl
          {sortConfig.field === 'level' && (sortConfig.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </button>
        <span>Message</span>
      </div>
    </div>
  );
}

export function TimeWindowStrip() {
  const {
    filteredLogs,
    availableMessageTypes,
    selectedMessageTypeFilter,
    setSelectedMessageTypeFilter,
    setScrollTargetTimestamp,
  } = useLogContext();
  const [isOpen, setIsOpen] = useState(false);
  const badgesRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(filteredLogs.length);

  const animatedEventCount = useAnimeValue(prevCountRef.current, filteredLogs.length, { duration: 400 });

  useEffect(() => {
    prevCountRef.current = filteredLogs.length;
  }, [filteredLogs.length]);

  useAnimeStagger(badgesRef, 'span', [filteredLogs.length], {
    translateY: [4, 0],
    opacity: [0, 1],
    stagger: 50,
    duration: 200,
  });

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      if (!log.messageType) continue;
      counts.set(log.messageType, (counts.get(log.messageType) ?? 0) + 1);
    }
    return counts;
  }, [filteredLogs]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of filteredLogs) {
      counts[log.level] = (counts[log.level] ?? 0) + 1;
    }
    return counts;
  }, [filteredLogs]);

  const rangeLabel = useMemo(() => {
    if (filteredLogs.length === 0) return 'No logs';
    const first = filteredLogs[0].timestamp;
    const last = filteredLogs[filteredLogs.length - 1].timestamp;
    if (first === last) return new Date(first).toLocaleTimeString();
    return `${new Date(first).toLocaleTimeString()} to ${new Date(last).toLocaleTimeString()}`;
  }, [filteredLogs]);

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-transparent">
      <div className="flex h-9 items-center gap-3 px-3 text-xs">
        <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex items-center gap-1 text-[var(--foreground)]">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Log window
        </button>
        <span className="tabular-nums text-[var(--muted-foreground)]">{animatedEventCount.toLocaleString()} events</span>
        <span className="tabular-nums text-[var(--muted-foreground)]">{rangeLabel}</span>
        <div ref={badgesRef} className="ml-1 flex items-center gap-1">
          {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((level) => {
            const count = levelCounts[level];
            if (!count) return null;
            const style = LEVEL_BADGE[level];
            return (
              <span key={level} className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${style.bg} ${style.text}`} title={`${level}: ${count}`}>
                {style.label} {count.toLocaleString()}
              </span>
            );
          })}
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--workspace)] px-3 pb-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" onClick={() => setScrollTargetTimestamp(filteredLogs[0]?.timestamp ?? null)}>
              Jump to start
            </button>
            <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" onClick={() => setSelectedMessageTypeFilter(null)}>
              Full dataset
            </button>
            {availableMessageTypes.slice(0, 8).map((type) => {
              const active = selectedMessageTypeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMessageTypeFilter(active ? null : type)}
                  className={`rounded border px-2 py-1 ${
                    active
                      ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {type} ({typeCounts.get(type) ?? 0})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

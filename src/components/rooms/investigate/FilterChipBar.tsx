import { useMemo, type JSX } from 'react';
import { Activity, GitBranch, Radio, RotateCcw } from 'lucide-react';
import { Badge, Button, ToggleChip } from '../../ui';
import { useLogContext } from '../../../contexts/LogContext';
import type { LogLevel } from '../../../types';

const LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

export function FilterChipBar(): JSX.Element {
  const {
    filteredLogs,
    logs,
    selectedLevels,
    toggleLevel,
    isSipFilterEnabled,
    setIsSipFilterEnabled,
    selectedSipMethods,
    activeCorrelations,
    clearFilterSelections,
    useIndexedDBMode,
    totalLogCount,
  } = useLogContext();

  const levelCounts = useMemo(() => {
    const counts = new Map<LogLevel, number>();
    for (const log of filteredLogs.length > 0 ? filteredLogs : logs) {
      counts.set(log.level, (counts.get(log.level) ?? 0) + 1);
    }
    return counts;
  }, [filteredLogs, logs]);

  const visibleCount = filteredLogs.length;
  const sourceCount = useIndexedDBMode ? totalLogCount : logs.length;
  const hasFilters = selectedLevels.size > 0 || isSipFilterEnabled || activeCorrelations.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[rgba(255,255,255,0.012)] px-3 py-2">
      <Badge variant="outline" className="font-mono">
        {visibleCount.toLocaleString()} / {sourceCount.toLocaleString()} events
      </Badge>
      <ToggleChip
        label="SIP"
        checked={isSipFilterEnabled}
        onChange={setIsSipFilterEnabled}
        icon={<Radio size={10} />}
        count={selectedSipMethods.size}
      />
      {LEVELS.map((level) => (
        <ToggleChip
          key={level}
          label={level}
          checked={selectedLevels.has(level)}
          onChange={() => toggleLevel(level)}
          icon={<Activity size={10} />}
          count={levelCounts.get(level) ?? 0}
          activeClassName="bg-[var(--mint)] border-[var(--mint)] text-[var(--bg-0)]"
        />
      ))}
      {activeCorrelations.length > 0 && (
        <Badge variant="level-info" className="gap-1 font-mono">
          <GitBranch size={10} />
          {activeCorrelations.length} correlations
        </Badge>
      )}
      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={clearFilterSelections} className="ml-auto">
          <RotateCcw size={11} />
          Reset
        </Button>
      )}
    </div>
  );
}

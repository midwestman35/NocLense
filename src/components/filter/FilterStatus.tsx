import { useLogContext } from '../../contexts/LogContext';

export default function FilterStatus() {
  const { logs, filteredLogs } = useLogContext();

  if (logs.length === 0) return null;

  return (
    <>
      <div className="w-px h-6 bg-[var(--border)] mx-2 shrink-0" />
      <div className="text-xs text-[var(--muted-foreground)] shrink-0 font-mono">
        <span className="font-bold text-[var(--foreground)]">{filteredLogs.length.toLocaleString()}</span>
        <span className="opacity-75"> / {logs.length.toLocaleString()}</span>
      </div>
    </>
  );
}

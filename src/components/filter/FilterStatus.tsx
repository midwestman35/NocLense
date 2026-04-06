import { useRef, useEffect } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { useAnimeValue } from '../../utils/anime';

export default function FilterStatus() {
  const { logs, filteredLogs } = useLogContext();
  const prevRef = useRef(filteredLogs.length);

  const animatedCount = useAnimeValue(prevRef.current, filteredLogs.length, { duration: 400 });

  useEffect(() => {
    prevRef.current = filteredLogs.length;
  }, [filteredLogs.length]);

  if (logs.length === 0) return null;

  return (
    <>
      <div className="w-px h-6 bg-[var(--border)] mx-2 shrink-0" />
      <div className="text-xs text-[var(--muted-foreground)] shrink-0 font-mono">
        <span className="font-bold text-[var(--foreground)]">{animatedCount.toLocaleString()}</span>
        <span className="opacity-75"> / {logs.length.toLocaleString()}</span>
      </div>
    </>
  );
}

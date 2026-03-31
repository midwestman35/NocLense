import { useState, memo } from 'react';
import { stc, getSipColorClasses } from '../utils/colorUtils';
import { ChevronRight, ChevronDown, Star } from 'lucide-react';
import clsx from 'clsx';
import type { LogEntry } from '../types';
import { highlightText } from '../utils/highlightUtils.tsx';
import { getLogDisplayTimestamp } from '../utils/logTimestamp';
import { useLogContext } from '../contexts/LogContext';

const EVENT_TYPE_STYLES: Record<string, string> = {
  transport: 'bg-blue-500/10 text-blue-300 border-blue-500/15',
  http: 'bg-blue-500/10 text-blue-300 border-blue-500/15',
  state: 'bg-violet-500/10 text-violet-300 border-violet-500/15',
  error: 'bg-red-500/10 text-red-300 border-red-500/15',
  report: 'bg-amber-500/10 text-amber-300 border-amber-500/15',
  user: 'bg-green-500/10 text-green-300 border-green-500/15',
  transcript: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/15',
};

function getEventTypePill(log: LogEntry): { label: string; style: string } | null {
  if (log.isSip && log.sipMethod) {
    return { label: log.sipMethod, style: getSipColorClasses(log.sipMethod) };
  }
  const mt = log.messageType?.toLowerCase() ?? '';
  if (!mt) return null;
  for (const [key, style] of Object.entries(EVENT_TYPE_STYLES)) {
    if (mt.includes(key)) {
      return { label: mt.toUpperCase(), style };
    }
  }
  return {
    label: mt.length > 18 ? `${mt.slice(0, 17)}...`.toUpperCase() : mt.toUpperCase(),
    style: 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]',
  };
}

const LEVEL_DOT: Record<string, string> = {
  ERROR: 'bg-red-500',
  WARN: 'bg-amber-500',
  INFO: 'bg-blue-400',
  DEBUG: 'bg-[var(--muted-foreground)]',
};

interface LogRowProps {
  log: LogEntry;
  style?: React.CSSProperties;
  onClick: (log: LogEntry) => void;
  active: boolean;
  measureRef?: (node: HTMLElement | null) => void;
  index?: number;
  isTextWrap?: boolean;
  filterText?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isHighlighted?: boolean;
  isAiHighlighted?: boolean;
  collapseCount?: number;
}

const LogRow: React.FC<LogRowProps> = ({
  log,
  style,
  onClick,
  active,
  measureRef,
  index,
  isTextWrap,
  filterText,
  isFavorite = false,
  onToggleFavorite,
  isHighlighted = false,
  isAiHighlighted = false,
  collapseCount,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { toggleCorrelation } = useLogContext();

  const hasPayload = log.payload && log.payload.length > 0;
  const eventPill = getEventTypePill(log);

  return (
    <div
      ref={measureRef}
      data-index={index}
      style={style}
      className={clsx(
        'flex flex-col border-b border-[var(--border)] cursor-pointer font-mono transition-colors duration-[var(--duration-fast)]',
        active ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]/70',
        isHighlighted && 'bg-[var(--warning)]/8 ring-1 ring-inset ring-[var(--warning)]/25',
        isAiHighlighted && 'bg-violet-500/10 ring-1 ring-inset ring-violet-500/30'
      )}
      onClick={() => onClick(log)}
    >
      <div className={clsx('log-grid w-full px-2', isTextWrap ? 'items-start py-1.5' : 'items-center h-[var(--log-row-height)]')}>
        <div className="flex justify-center">
          {hasPayload ? (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : null}
        </div>

        <div className="text-[var(--muted-foreground)] text-[11px] truncate tabular-nums">
          {getLogDisplayTimestamp(log)}
        </div>

        <div className={clsx('min-w-0 flex items-center gap-1.5', isTextWrap ? 'flex-wrap' : 'overflow-hidden')}>
          {eventPill && (
            <span className={clsx('px-1 py-0 rounded border text-[9px] font-semibold leading-[16px] shrink-0 uppercase', eventPill.style)}>
              {eventPill.label}
            </span>
          )}
          <span className="px-1 py-0 rounded text-[9px] font-medium leading-[16px] bg-[var(--accent)] text-[var(--muted-foreground)] border border-[var(--border)] shrink-0 truncate max-w-[160px]" title={log.component}>
            {log.displayComponent}
          </span>
          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', LEVEL_DOT[log.level] ?? LEVEL_DOT.INFO)} title={log.level} />
          <span className={clsx('min-w-0 text-[11px]', isTextWrap ? 'break-all' : 'truncate', !(log.summaryMessage ?? log.displayMessage) ? 'text-[var(--muted-foreground)] italic' : 'text-[var(--foreground)]')}>
            {(() => {
              const fullMessage = log.summaryMessage ?? log.displayMessage;
              if (!fullMessage) return `[Empty entry — ${log.sourceLabel ?? log.component ?? 'unknown source'}]`;
              const maxLength = 180;
              const truncatedMessage = fullMessage.length > maxLength ? `${fullMessage.slice(0, maxLength)}...` : fullMessage;
              return highlightText(truncatedMessage, filterText || '');
            })()}
            {collapseCount != null && collapseCount > 1 && (
              <span className="ml-1 px-1 py-0 rounded bg-[var(--accent)] text-[9px] text-[var(--muted-foreground)] font-mono" title={`${collapseCount} similar rows`}>
                x{collapseCount}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {log.callId && (
              <div
                className="flex items-center gap-0.5 px-1 rounded cursor-pointer hover:bg-[var(--accent)] shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCorrelation({ type: 'callId', value: log.callId! });
                }}
                title={`Call-ID: ${log.callId}`}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stc(log.callId) }} />
                <span className="text-[9px] text-[var(--muted-foreground)] font-mono">{log.callId.slice(0, 8)}</span>
              </div>
            )}
            {log.reportId && (
              <span
                className="text-[9px] text-[var(--muted-foreground)] font-mono cursor-pointer hover:text-[var(--foreground)]"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCorrelation({ type: 'report', value: log.reportId! });
                }}
                title={`Report ${log.reportId}`}
              >
                #{log.reportId}
              </span>
            )}
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }} className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--warning)] shrink-0" title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Star size={12} className={clsx(isFavorite && 'fill-[var(--warning)] text-[var(--warning)]')} />
            </button>
          </div>
        </div>
      </div>

      {expanded && hasPayload && (
        <div className="pl-[calc(20px+140px+12px)] pr-4 pb-2 text-[11px] text-[var(--muted-foreground)] whitespace-pre-wrap break-all overflow-auto bg-[var(--accent)] max-h-[300px]">
          {log.type === 'JSON' ? <pre className="mt-1">{JSON.stringify(log.json, null, 2)}</pre> : <div className="font-mono mt-1">{log.payload}</div>}
        </div>
      )}
    </div>
  );
};

export default memo(LogRow);

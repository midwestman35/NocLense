import { memo } from 'react';
import { ChevronDown, ChevronRight, Hash, Star } from 'lucide-react';
import clsx from 'clsx';
import { stc, getSipColorClasses } from '../utils/colorUtils';
import type { LogEntry } from '../types';
import { highlightText } from '../utils/highlightUtils.tsx';
import { getLogDisplayTimestamp } from '../utils/logTimestamp';
import { useLogContext } from '../contexts/LogContext';

const EVENT_TYPE_STYLES: Record<string, string> = {
  transport: 'bg-cyan/10 text-cyan border-cyan/15',
  http: 'bg-cyan/10 text-cyan border-cyan/15',
  state: 'bg-violet/10 text-violet border-violet/15',
  error: 'bg-red/10 text-red border-red/15',
  report: 'bg-amber/10 text-amber border-amber/15',
  user: 'bg-mint/10 text-mint border-mint/15',
  transcript: 'bg-cyan/10 text-cyan border-cyan/15',
};

const LEVEL_DOT: Record<string, string> = {
  ERROR: 'bg-red',
  WARN: 'bg-amber',
  INFO: 'bg-cyan',
  DEBUG: 'bg-[var(--muted-foreground)]',
};

function getEventTypePill(log: LogEntry): { label: string; style: string } | null {
  if (log.isSip && log.sipMethod) {
    return { label: log.sipMethod, style: getSipColorClasses(log.sipMethod) };
  }

  const messageType = log.messageType?.toLowerCase() ?? '';
  if (!messageType) return null;

  for (const [key, style] of Object.entries(EVENT_TYPE_STYLES)) {
    if (messageType.includes(key)) {
      return { label: messageType.toUpperCase(), style };
    }
  }

  return {
    label: messageType.length > 18 ? `${messageType.slice(0, 17)}...`.toUpperCase() : messageType.toUpperCase(),
    style: 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]',
  };
}

function buildPayloadPreview(log: LogEntry): string {
  const previewSource = typeof log.json?.msg === 'string' && log.json.msg.trim().length > 0
    ? log.json.msg
    : log.payload;
  if (!previewSource) return '';
  return previewSource.length > 80 ? `${previewSource.slice(0, 80)}...` : previewSource;
}

interface LogRowProps {
  log: LogEntry;
  style?: React.CSSProperties;
  onClick: (log: LogEntry) => void;
  onToggleExpanded: (logId: number) => void;
  active: boolean;
  isExpanded: boolean;
  isCitationTarget?: boolean;
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

function LogRow({
  log,
  style,
  onClick,
  onToggleExpanded,
  active,
  isExpanded,
  isCitationTarget = false,
  measureRef,
  index,
  isTextWrap,
  filterText,
  isFavorite = false,
  onToggleFavorite,
  isHighlighted = false,
  isAiHighlighted = false,
  collapseCount,
}: LogRowProps) {
  const { toggleCorrelation } = useLogContext();
  const hasPayload = log.payload && log.payload.length > 0;
  const eventPill = getEventTypePill(log);
  const fullMessage = log.summaryMessage ?? log.displayMessage;
  const payloadPreview = buildPayloadPreview(log);
  const visibleMessage = !fullMessage
    ? `[Empty entry; ${log.sourceLabel ?? log.component ?? 'unknown source'}]`
    : fullMessage.length > 180
      ? `${fullMessage.slice(0, 180)}...`
      : fullMessage;

  const handleRowClick = (): void => {
    if (hasPayload) {
      onToggleExpanded(log.id);
    }
    onClick(log);
  };

  return (
    <div
      ref={measureRef}
      data-index={index}
      data-citation-target={isCitationTarget ? 'true' : 'false'}
      title={log.jsonMalformed ? 'Malformed JSON body' : undefined}
      style={style}
      className={clsx(
        'flex cursor-pointer flex-col border-b border-[var(--border)] font-mono transition-colors duration-[var(--duration-fast)]',
        active ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]/70',
        isHighlighted && 'bg-[var(--warning)]/8 ring-1 ring-inset ring-[var(--warning)]/25',
        isAiHighlighted && 'bg-violet/10 ring-1 ring-inset ring-violet/30',
        isCitationTarget && 'bg-[color:color-mix(in_srgb,var(--glow-ready)_20%,transparent)]',
        log.jsonMalformed && 'border-l-2 border-l-amber/60',
      )}
      onClick={handleRowClick}
    >
      <div className={clsx('log-grid w-full px-2', isTextWrap ? 'items-start py-1.5' : 'items-center h-[var(--log-row-height)]')}>
        <div className="flex justify-center">
          {hasPayload ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded(log.id);
              }}
              className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label={isExpanded ? 'Collapse payload' : 'Expand payload'}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : null}
        </div>

        <div className="truncate text-[11px] tabular-nums text-[var(--muted-foreground)]">
          {getLogDisplayTimestamp(log)}
        </div>

        <div className={clsx('min-w-0 flex items-center gap-1.5', isTextWrap ? 'flex-wrap' : 'overflow-hidden')}>
          {eventPill && (
            <span className={clsx('shrink-0 rounded border px-1 py-0 text-[9px] font-semibold uppercase leading-[16px]', eventPill.style)}>
              {eventPill.label}
            </span>
          )}
          <span
            className="max-w-[160px] shrink-0 truncate rounded border border-[var(--border)] bg-[var(--accent)] px-1 py-0 text-[9px] font-medium leading-[16px] text-[var(--muted-foreground)]"
            title={log.component}
          >
            {log.displayComponent}
          </span>
          <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', LEVEL_DOT[log.level] ?? LEVEL_DOT.INFO)} title={log.level} />
          <span className={clsx('min-w-0 text-[11px]', isTextWrap ? 'break-all' : 'truncate', !fullMessage ? 'italic text-[var(--muted-foreground)]' : 'text-[var(--foreground)]')}>
            {highlightText(visibleMessage, filterText || '')}
            {collapseCount != null && collapseCount > 1 && (
              <span className="ml-1 rounded bg-[var(--accent)] px-1 py-0 text-[9px] font-mono text-[var(--muted-foreground)]" title={`${collapseCount} similar rows`}>
                x{collapseCount}
              </span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {log.traceId && (
              <button
                type="button"
                className="flex items-center gap-0.5 rounded px-1 text-[9px] font-mono text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCorrelation({ type: 'traceId', value: log.traceId! });
                }}
                title={`traceId: ${log.traceId}`}
              >
                <Hash size={10} />
                <span>{log.traceId.slice(0, 10)}</span>
              </button>
            )}
            {log.callId && (
              <button
                type="button"
                className="flex items-center gap-0.5 rounded px-1 hover:bg-[var(--accent)] shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCorrelation({ type: 'callId', value: log.callId! });
                }}
                title={`Call-ID: ${log.callId}`}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stc(log.callId) }} />
                <span className="text-[9px] font-mono text-[var(--muted-foreground)]">{log.callId.slice(0, 8)}</span>
              </button>
            )}
            {log.reportId && (
              <button
                type="button"
                className="text-[9px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCorrelation({ type: 'report', value: log.reportId! });
                }}
                title={`Report ${log.reportId}`}
              >
                #{log.reportId}
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite?.();
              }}
              className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--warning)] shrink-0"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={12} className={clsx(isFavorite && 'fill-[var(--warning)] text-[var(--warning)]')} />
            </button>
          </div>
        </div>
      </div>

      {!isExpanded && hasPayload && payloadPreview && (
        <div className="px-2 pb-2 pl-[calc(20px+140px+12px)] text-[11px] text-[var(--muted-foreground)]">
          <span className="block truncate font-mono">{payloadPreview}</span>
        </div>
      )}

      {isExpanded && hasPayload && (
        <div className="max-h-[300px] overflow-auto bg-[var(--accent)] pb-2 pl-[calc(20px+140px+12px)] pr-4 text-[11px] text-[var(--muted-foreground)]">
          <pre className="mt-1 whitespace-pre-wrap break-all">{log.payload}</pre>
        </div>
      )}
    </div>
  );
}

export default memo(LogRow);

import { useState, memo } from 'react';
import { stc, getSipColorClasses } from '../utils/colorUtils';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, AlertCircle, Info, Bug, AlertTriangle, Star } from 'lucide-react';
import clsx from 'clsx';
import type { LogEntry } from '../types';
import { highlightText } from '../utils/highlightUtils.tsx';
import { useLogContext } from '../contexts/LogContext';

const LevelIcon = ({ level }: { level: LogEntry['level'] }) => {
    switch (level) {
        case 'ERROR': return <AlertCircle size={16} className="text-red-500" />;
        case 'WARN': return <AlertTriangle size={16} className="text-yellow-500" />;
        case 'DEBUG': return <Bug size={16} className="text-slate-500" />;
        default: return <Info size={16} className="text-blue-500" />;
    }
};

/** Category badge per §6.2: messageType when present; JSON = subtle pill; SIP uses method tag only; LOG = neutral. */
function getCategoryBadge(log: LogEntry): { label: string; title: string; className: string } | null {
    // SIP: no separate category badge — method-colored tag (sipMethod) is the category
    if (log.isSip && !log.messageType) return null;

    const label = log.messageType ?? (log.type === 'JSON' ? 'JSON' : 'LOG');
    const title = log.messageType ?? (log.type === 'JSON' ? 'JSON payload' : 'Log');
    const maxLen = 36;
    const displayLabel = label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;

    if (log.type === 'JSON' || log.messageType) {
        return {
            label: displayLabel,
            title: label.length > maxLen ? label : title,
            className: 'bg-slate-700/80 text-slate-400 border border-slate-600/80 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
        };
    }
    return {
        label: displayLabel,
        title: title,
        className: 'bg-slate-700/50 text-slate-500 border border-slate-600/50 text-[10px] px-1.5 py-0.5 rounded shrink-0',
    };
}

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
    /** When set, show " (×N)" for collapsed similar group (6.3 Option A) */
    collapseCount?: number;
}

const LogRow: React.FC<LogRowProps> = ({ log, style, onClick, active, measureRef, index, isTextWrap, filterText, isFavorite = false, onToggleFavorite, isHighlighted = false, collapseCount }) => {
    const [expanded, setExpanded] = useState(false);
    const { toggleCorrelation, setIsSidebarOpen } = useLogContext();

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleFavorite?.();
    };

    const hasPayload = log.payload && log.payload.length > 0;

    return (
        <div
            ref={measureRef}
            data-index={index}
            style={style}
            className={clsx(
                "flex flex-col border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer text-sm font-mono transition-colors",
                active && "bg-slate-700/80 border-l-4 border-l-blue-500",
                isHighlighted && "bg-yellow-500/10 ring-1 ring-inset ring-yellow-500/50 z-10"
            )}
            onClick={() => onClick(log)}
        >
            <div className={clsx("log-grid w-full px-2", isTextWrap ? "items-start py-1" : "items-center h-[35px]")}>
                {/* 1. Expand/Collapse (20px) */}
                <div className="flex justify-center">
                    {hasPayload ? (
                        <button
                            onClick={toggleExpand}
                            className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                        >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : null}
                </div>

                {/* 2. Timestamp (160px) */}
                <div className="text-slate-500 truncate">
                    {format(new Date(log.timestamp), 'MM/dd HH:mm:ss.SSS')}
                </div>

                {/* 3. Level (24px) */}
                <div className="flex justify-center">
                    <LevelIcon level={log.level} />
                </div>

                {/* 4. Component (130px) */}
                <div className="font-semibold truncate text-blue-400" title={log.component}>
                    {log.displayComponent}
                </div>

                {/* 5. SIP Code (90px) */}
                <div className="flex items-center justify-center">
                    {log.sipMethod ? (
                        <span className={clsx(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors whitespace-nowrap",
                            getSipColorClasses(log.sipMethod)
                        )}>
                            {log.sipMethod}
                        </span>
                    ) : (
                        <span className="text-slate-600 text-[10px]">—</span>
                    )}
                </div>

                {/* 6. Message (1fr) — Optimized: fewer inline badges, cleaner layout */}
                <div className={clsx(
                    "text-slate-200 min-w-0 flex items-center gap-1.5",
                    isTextWrap ? "whitespace-pre-wrap break-all" : "truncate overflow-hidden whitespace-nowrap"
                )} title={!isTextWrap ? (log.summaryMessage ?? log.message) : undefined}>
                    {/* Star icon */}
                    <button
                        onClick={handleToggleFavorite}
                        className="p-0.5 hover:bg-white/10 rounded text-slate-500 hover:text-yellow-400 transition-colors shrink-0"
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star
                            size={14}
                            className={clsx(
                                "transition-all",
                                isFavorite ? "fill-yellow-500 text-yellow-500" : ""
                            )}
                        />
                    </button>
                    
                    {/* Category / MessageType badge - only show for non-LOG types */}
                    {(() => {
                        const badge = getCategoryBadge(log);
                        // Skip showing generic LOG badge to reduce noise
                        if (!badge || badge.label === 'LOG') return null;
                        return (
                            <span
                                className={clsx(badge.className, 'whitespace-nowrap max-w-[180px] truncate')}
                                title={badge.title}
                            >
                                {badge.label}
                            </span>
                        );
                    })()}
                    
                    {/* Call-ID: show color dot only, full ID in tooltip */}
                    {log.callId && (
                        <div
                            className="flex items-center gap-1 px-1 py-0.5 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-700/50 shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleCorrelation({ type: 'callId', value: log.callId! }); setIsSidebarOpen(true); }}
                            title={`Call-ID: ${log.callId} – click to filter`}
                        >
                            <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: stc(log.callId) }}
                            />
                            <span className="text-[9px] text-slate-500 font-mono">{log.callId.slice(0, 8)}…</span>
                        </div>
                    )}
                    
                    {/* Report ID - compact */}
                    {log.reportId && (
                        <div
                            className="px-1 py-0.5 bg-blue-500/10 rounded cursor-pointer hover:bg-blue-500/20 shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleCorrelation({ type: 'report', value: log.reportId! }); setIsSidebarOpen(true); }}
                            title={`Report ${log.reportId} – click to filter`}
                        >
                            <span className="text-[9px] text-blue-400 font-mono">#{log.reportId}</span>
                        </div>
                    )}
                    
                    {/* cncID & messageID - show subtle indicator, details on hover */}
                    {(log.cncID || log.messageID) && (
                        <div 
                            className="flex items-center gap-0.5 shrink-0"
                            title={[
                                log.cncID ? `cncID: ${log.cncID}` : null,
                                log.messageID ? `messageID: ${log.messageID}` : null
                            ].filter(Boolean).join('\n')}
                        >
                            {log.cncID && (
                                <div
                                    className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 cursor-pointer hover:bg-cyan-400"
                                    onClick={(e) => { e.stopPropagation(); toggleCorrelation({ type: 'cncID', value: log.cncID! }); setIsSidebarOpen(true); }}
                                />
                            )}
                            {log.messageID && (
                                <div
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 cursor-pointer hover:bg-emerald-400"
                                    onClick={(e) => { e.stopPropagation(); toggleCorrelation({ type: 'messageID', value: log.messageID! }); setIsSidebarOpen(true); }}
                                />
                            )}
                        </div>
                    )}
                    
                    {/* Message text */}
                    <span className="min-w-0 truncate">
                        {(() => {
                            const fullMessage = log.summaryMessage ?? log.displayMessage;
                            const maxLength = 150;
                            const truncatedMessage = fullMessage.length > maxLength 
                                ? fullMessage.slice(0, maxLength) + '…' 
                                : fullMessage;
                            return highlightText(truncatedMessage, filterText || '');
                        })()}
                        {collapseCount != null && collapseCount > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-600/80 text-[10px] text-slate-300 font-mono shrink-0" title={`${collapseCount} similar rows`}>
                                ×{collapseCount}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            {expanded && hasPayload && (
                <div className="pl-12 pr-4 pb-2 text-xs text-slate-400 whitespace-pre-wrap break-all overflow-auto bg-black/20 inner-shadow max-h-[300px]">
                    {log.type === 'JSON' ? (
                        <pre className="mt-1">{JSON.stringify(log.json, null, 2)}</pre>
                    ) : (
                        <div className="font-mono mt-1">{log.payload}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default memo(LogRow);

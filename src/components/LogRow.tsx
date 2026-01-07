import { useState, memo } from 'react';
import { stc, getSipColorClasses } from '../utils/colorUtils';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, AlertCircle, Info, Bug, AlertTriangle, Star } from 'lucide-react';
import clsx from 'clsx';
import type { LogEntry } from '../types';
import { highlightText } from '../utils/highlightUtils.tsx';

const LevelIcon = ({ level }: { level: LogEntry['level'] }) => {
    switch (level) {
        case 'ERROR': return <AlertCircle size={16} className="text-red-500" />;
        case 'WARN': return <AlertTriangle size={16} className="text-yellow-500" />;
        case 'DEBUG': return <Bug size={16} className="text-slate-500" />;
        default: return <Info size={16} className="text-blue-500" />;
    }
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
}

const LogRow: React.FC<LogRowProps> = ({ log, style, onClick, active, measureRef, index, isTextWrap, filterText, isFavorite = false, onToggleFavorite, isHighlighted = false }) => {
    const [expanded, setExpanded] = useState(false);

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

                {/* 5. Message (1fr) */}
                <div className={clsx(
                    "text-slate-200 min-w-0 flex items-center gap-2",
                    isTextWrap ? "whitespace-pre-wrap break-all" : "truncate overflow-hidden whitespace-nowrap"
                )} title={!isTextWrap ? log.message : undefined}>
                    {/* Star icon - positioned directly to the left of message */}
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
                    {log.callId && (
                        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 mx-1 max-w-[120px]">
                            <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: stc(log.callId) }}
                            ></div>
                            <span className="text-[10px] text-slate-400 truncate font-mono" title={`Call-ID: ${log.callId}`}>
                                {log.callId}
                            </span>
                        </div>
                    )}
                    <span>
                        {highlightText(log.displayMessage, filterText || '')}
                        {log.sipMethod && (
                            <span className={clsx(
                                "ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors whitespace-nowrap",
                                getSipColorClasses(log.sipMethod)
                            )}>
                                {log.sipMethod}
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

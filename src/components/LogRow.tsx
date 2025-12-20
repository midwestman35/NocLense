import { useState, memo } from 'react';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, AlertCircle, Info, Bug, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { LogEntry } from '../types';

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
}

import { stc } from '../utils/colors';

const LogRow: React.FC<LogRowProps> = ({ log, style, onClick, active, measureRef, index }) => {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const hasPayload = log.payload && log.payload.length > 0;

    return (
        <div
            ref={measureRef}
            data-index={index}
            style={style}
            className={clsx(
                "flex flex-col border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer text-sm font-mono transition-colors",
                active && "bg-slate-700/80 border-l-4 border-l-blue-500"
            )}
            onClick={() => onClick(log)}
        >
            <div className="flex items-center h-[35px] px-2 gap-2 whitespace-nowrap overflow-hidden">
                {hasPayload ? (
                    <button
                        onClick={toggleExpand}
                        className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                    >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <div className="w-[18px]"></div>
                )}

                <div className="w-[160px] text-slate-500 shrink-0 truncate" title={log.fileName || 'Unknown Source'}>
                    {format(new Date(log.timestamp), 'MM/dd HH:mm:ss.SSS')}
                </div>

                <div className="w-[24px] shrink-0 flex justify-center">
                    <LevelIcon level={log.level} />
                </div>

                <div className="w-[120px] font-semibold shrink-0 truncate text-blue-400" title={log.component}>
                    {log.component}
                </div>

                <div className="flex-grow flex items-center gap-2 overflow-hidden">
                    {log.callId && (
                        <div
                            className="w-1.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: stc(log.callId) }}
                            title={`Call-ID: ${log.callId}`}
                        ></div>
                    )}
                    <div className="truncate text-slate-200" title={log.message}>
                        {log.message} {log.sipMethod && <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/50 text-yellow-500 rounded text-xs">{log.sipMethod}</span>}
                    </div>
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

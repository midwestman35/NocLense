import React, { useMemo } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

interface CallFlowViewerProps {
    callId: string;
    onClose: () => void;
}

const CallFlowViewer: React.FC<CallFlowViewerProps> = ({ callId, onClose }) => {
    const { logs } = useLogContext();

    console.log("CallFlowViewer rendered", { callId, totalLogs: logs.length });

    const callLogs = useMemo(() => {
        const filtered = logs
            .filter(l => l.callId === callId)
            .sort((a, b) => a.timestamp - b.timestamp);
        console.log("CallFlowViewer logs found:", filtered.length);
        return filtered;
    }, [logs, callId]);

    // Extract Participants
    const participants = useMemo(() => {
        const set = new Set<string>();
        callLogs.forEach(l => {
            if (l.sipFrom) set.add(extractUser(l.sipFrom));
            if (l.sipTo) set.add(extractUser(l.sipTo));
        });
        return Array.from(set);
    }, [callLogs]);

    function extractUser(sipUri: string) {
        // sip:1017@domain... -> 1017
        const match = sipUri.match(/sip:([^@]+)/);
        return match ? match[1] : sipUri;
    }

    if (callLogs.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 shadow-xl max-w-md w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">No SIP Flow Detected</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                        No SIP messages (INVITE, BYE, etc.) were found for Call ID: <span className="text-yellow-400 font-mono">{callId}</span>.
                    </p>
                    <p className="text-slate-500 text-xs">
                        This might happen if the logs containing the SIP signaling are missing or not parsed correctly.
                    </p>
                    <div className="mt-6 flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">Close</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 w-[90vw] h-[90vh] rounded-lg shadow-2xl flex flex-col border border-slate-700">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-white">Call Flow: <span className="text-yellow-400 font-mono text-base">{callId}</span></h2>
                        <div className="text-xs text-slate-400 mt-1">{callLogs.length} SIP messages • {participants.join(' <-> ')}</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-grow overflow-auto p-8 bg-slate-900 relative">
                    {/* Headers */}
                    <div className="flex justify-between sticky top-0 mb-8 px-12">
                        {participants.map(p => (
                            <div key={p} className="flex flex-col items-center">
                                <div className="px-4 py-2 bg-slate-800 border border-slate-600 rounded text-sm font-bold text-blue-300 shadow-lg">
                                    {p}
                                </div>
                                <div className="h-4 w-0.5 bg-slate-700/50 mt-2"></div>
                            </div>
                        ))}
                    </div>

                    {/* Timeline */}
                    <div className="relative min-h-full">
                        {/* Vertical Lines */}
                        <div className="absolute inset-0 flex justify-between px-12 pointer-events-none">
                            {participants.map(p => (
                                <div key={p} className="w-0.5 bg-slate-800 h-full"></div>
                            ))}
                        </div>

                        {/* Messages */}
                        <div className="space-y-4 relative z-10 pt-2 pb-12">
                            {callLogs.map((log, i) => {
                                const fromUser = extractUser(log.sipFrom || '');
                                const toUser = extractUser(log.sipTo || '');

                                // Determine Direction
                                // Simplify: Left Participant is participants[0]
                                const isLeftToRight = fromUser === participants[0];
                                const isSelf = fromUser === toUser;

                                return (
                                    <div key={log.id} className="relative flex items-center group">
                                        {/* Timestamp Left */}
                                        <div className="absolute left-2 text-[10px] text-slate-500 font-mono w-24 text-right">
                                            {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                                        </div>

                                        <div className="flex-grow flex items-center justify-between px-12 mx-auto w-full max-w-4xl">
                                            {/* Arrow */}
                                            <div className="w-full relative h-8 flex items-center justify-center">
                                                <div className={clsx(
                                                    "h-0.5 w-full absolute top-1/2 transform -translate-y-1/2 transition-colors group-hover:bg-blue-500",
                                                    log.level === 'ERROR' ? "bg-red-500/50" : "bg-slate-600"
                                                )}></div>

                                                {/* Arrow Head */}
                                                {isLeftToRight ? (
                                                    <div className="absolute right-0 text-slate-600 group-hover:text-blue-500"><ArrowRight size={14} fill="currentColor" /></div>
                                                ) : (
                                                    <div className="absolute left-0 text-slate-600 group-hover:text-blue-500"><ArrowLeft size={14} fill="currentColor" /></div>
                                                )}

                                                {/* Label */}
                                                <div className="absolute flex flex-col items-center justify-center bg-slate-900 px-2 group-hover:border-blue-500 border border-transparent rounded cursor-pointer" title={log.message}>
                                                    <span className={clsx(
                                                        "text-xs font-bold",
                                                        log.sipMethod === 'INVITE' ? "text-green-400" :
                                                            log.sipMethod === 'BYE' || log.sipMethod === 'CANCEL' ? "text-red-400" :
                                                                log.sipMethod?.startsWith('2') ? "text-blue-300" : "text-slate-300"
                                                    )}>
                                                        {log.sipMethod || 'SIP'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500">{log.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallFlowViewer;

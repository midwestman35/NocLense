import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogContext } from '../contexts/LogContext';
import LogRow from './LogRow';

const LogViewer = () => {
    const { filteredLogs, selectedLogId, setSelectedLogId } = useLogContext();
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredLogs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50, // Increased default row height to accommodate wrapping
        overscan: 5,
    });

    // Scroll to selected log if initiated externally
    useEffect(() => {
        if (selectedLogId && parentRef.current) {
            const index = filteredLogs.findIndex(l => l.id === selectedLogId);
            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'center' });
            }
        }
    }, [selectedLogId, filteredLogs, rowVirtualizer]);

    return (
        <div
            ref={parentRef}
            className="flex-grow h-full w-full overflow-y-auto relative bg-slate-900"
        >
            {filteredLogs.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    No logs to display
                </div>
            ) : (
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const log = filteredLogs[virtualRow.index];
                        return (
                            <LogRow
                                key={log.id}
                                log={log}
                                active={log.id === selectedLogId}
                                onClick={(l) => setSelectedLogId(l.id === selectedLogId ? null : l.id)}
                                measureRef={rowVirtualizer.measureElement}
                                index={virtualRow.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LogViewer;

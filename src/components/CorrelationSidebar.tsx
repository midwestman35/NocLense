import React, { useState } from 'react';
import { useLogContext, type CorrelationItem } from '../contexts/LogContext';
import { Hash, User, Phone, Monitor, ChevronRight, ChevronDown, Filter, X, ArrowUpAZ, ArrowDown, FileText, Ban, Activity, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import AIButton from './AIButton';

type SortMode = 'alpha' | 'count';

// Re-defining ItemList properly
const CorrelationItemList = ({
    items,
    type,
    activeCorrelations,
    correlationCounts,
    toggleCorrelation,
    setOnlyCorrelation,
    showAllCallIds,
    setShowAllCallIds,

    sortMode,
    hoveredCallId,
    hoveredCorrelation,
    setHoveredCorrelation,
    onRemoveItem
}: {
    items: string[],
    type: CorrelationItem['type'],
    activeCorrelations: CorrelationItem[],
    correlationCounts: Record<string, number>,
    toggleCorrelation: (item: CorrelationItem) => void,
    setOnlyCorrelation: (item: CorrelationItem) => void,
    showAllCallIds: boolean,
    setShowAllCallIds: (show: boolean) => void,
    sortMode: SortMode,
    hoveredCallId: string | null,
    hoveredCorrelation: CorrelationItem | null,
    setHoveredCorrelation: (item: CorrelationItem | null) => void,
    onRemoveItem?: (item: string) => void
}) => {

    const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(s);

    // Sorting
    const sortedItems = [...items].sort((a, b) => {
        // 1. UUID Priority (for Call IDs mainly)
        if (type === 'callId') {
            const aIsUuid = isUuid(a);
            const bIsUuid = isUuid(b);
            if (aIsUuid && !bIsUuid) return -1;
            if (!aIsUuid && bIsUuid) return 1;
        }

        // 2. Count or Alpha
        if (sortMode === 'count') {
            const countA = correlationCounts[`${type}:${a}`] || 0;
            const countB = correlationCounts[`${type}:${b}`] || 0;
            if (countB !== countA) return countB - countA;
        }
        return a.localeCompare(b);
    });

    if (sortedItems.length === 0) return <div className="px-8 py-1 text-xs text-[var(--muted-foreground)] italic opacity-60">None detected</div>;

    const isLimited = type === 'callId' && !showAllCallIds; // Don't limit files
    const visibleItems = isLimited ? sortedItems.slice(0, 10) : sortedItems;
    const remainingCount = sortedItems.length - visibleItems.length;

    const handleOnly = (e: React.MouseEvent, t: CorrelationItem['type'], v: string) => {
        e.stopPropagation();
        const isCurrentlyOnly = activeCorrelations.length === 1 && activeCorrelations[0].type === t && activeCorrelations[0].value === v;
        if (isCurrentlyOnly) {
            toggleCorrelation({ type: t, value: v });
        } else {
            setOnlyCorrelation({ type: t, value: v });
        }
    };

    return (
        <div className="flex flex-col mb-1 resize-y overflow-auto min-h-[50px]" style={{ maxHeight: 'none' }}>
            {visibleItems.map(item => {
                const isActive = activeCorrelations.some(c => c.type === type && c.value === item && !c.excluded);
                const isExcluded = activeCorrelations.some(c => c.type === type && c.value === item && c.excluded);
                const count = correlationCounts[`${type}:${item}`] || 0;

                const isOnlyFilter = activeCorrelations.length === 1 && activeCorrelations[0].type === type && activeCorrelations[0].value === item;
                const isHighlighted = (type === 'callId' && hoveredCallId === item) || (hoveredCorrelation?.type === type && hoveredCorrelation.value === item);

                return (
                    <div
                        key={item}
                        className={clsx(
                            "group flex items-start justify-between px-8 py-1.5 text-xs font-mono transition-colors cursor-pointer relative border-l-2",
                            isActive
                                ? "bg-[var(--foreground)]/10 text-[var(--foreground)] border-[var(--foreground)]"
                                : isExcluded
                                    ? "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)] opacity-60"
                                    : isHighlighted
                                        ? "bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]"
                                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] border-transparent"
                        )}
                        onClick={() => toggleCorrelation({ type, value: item })}
                        onMouseEnter={() => setHoveredCorrelation({ type, value: item })}
                        onMouseLeave={() => setHoveredCorrelation(null)}
                    >
                        <span className="break-all mr-2" title={item}>{item}</span>

                        <div className="flex items-center gap-2 shrink-0 ml-auto pointer-events-auto">
                            {onRemoveItem && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveItem(item);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--destructive)]/20 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                                    title="Remove file"
                                >
                                    <X size={12} />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCorrelation({ type, value: item, excluded: true });
                                }}
                                className={clsx(
                                    "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]",
                                    isExcluded ? "text-[var(--destructive)] opacity-100" : "text-[var(--muted-foreground)]"
                                )}
                                title="Exclude"
                            >
                                <Ban size={12} />
                            </button>

                            <button
                                onClick={(e) => handleOnly(e, type, item)}
                                className={clsx(
                                    "opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                                    isOnlyFilter
                                        ? "bg-[var(--foreground)] text-[var(--muted)] border-[var(--foreground)] opacity-100"
                                        : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--foreground)] hover:text-white hover:border-[var(--foreground)]"
                                )}
                            >
                                {isOnlyFilter ? 'ALL' : 'ONLY'}
                            </button>

                            <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors font-sans",
                                isActive
                                    ? "bg-[var(--foreground)] text-white"
                                    : "bg-[var(--border)] text-[var(--muted-foreground)] group-hover:bg-[var(--muted-foreground)] group-hover:text-[var(--card)]"
                            )}>
                                {count}
                            </span>
                        </div>
                    </div>
                );
            })}
            {isLimited && remainingCount > 0 && (
                <button
                    onClick={() => setShowAllCallIds(true)}
                    className="px-8 py-1 text-xs text-[var(--foreground)] hover:text-[var(--foreground)] text-left italic hover:underline"
                >
                    Show {remainingCount} More...
                </button>
            )}
            {!isLimited && type === 'callId' && items.length > 10 && (
                <button
                    onClick={() => setShowAllCallIds(false)}
                    className="px-8 py-1 text-xs text-[var(--foreground)] hover:text-[var(--foreground)] text-left italic hover:underline"
                >
                    Show Less
                </button>
            )}
        </div>
    );
};

const SectionHeader = ({ title, icon: Icon, expanded, onToggle }: { title: string, icon: any, expanded: boolean, onToggle: () => void }) => (
    <button
        onClick={onToggle}
        className="flex items-center w-full px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors uppercase tracking-wider border-b border-[var(--border)]/50 bg-[var(--card)] sticky top-0 z-10"
    >
        {expanded ? <ChevronDown size={12} className="mr-2" /> : <ChevronRight size={12} className="mr-2" />}
        <Icon size={12} className="mr-2" />
        <span className="flex-grow text-left">{title}</span>
    </button>
);

const CorrelationSidebar = () => {
    const {
        logs,
        correlationData,
        activeCorrelations,
        toggleCorrelation,
        setOnlyCorrelation,
        correlationCounts,
        setIsSidebarOpen,

        clearAllFilters,
        hoveredCallId,
        hoveredCorrelation,
        setHoveredCorrelation,
        removeFile
    } = useLogContext();

    const [expandedSections, setExpandedSections] = useState({
        file: true,
        report: true,
        operator: true,
        station: true,
        callId: true,
        extension: true,
        cncID: true,
        messageID: true,
    });

    const [sortMode, setSortMode] = useState<SortMode>('count');
    const [showAllCallIds, setShowAllCallIds] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);

    const getCorrelationLogs = (item: CorrelationItem): typeof logs => {
        return logs.filter((log) => {
            switch (item.type) {
                case 'report':
                    return log.reportId === item.value;
                case 'operator':
                    return log.operatorId === item.value;
                case 'extension':
                    return log.extensionId === item.value;
                case 'station':
                    return log.stationId === item.value;
                case 'callId':
                    return log.callId === item.value;
                case 'file':
                    return log.fileName === item.value;
                case 'cncID':
                    return log.cncID === item.value;
                case 'messageID':
                    return log.messageID === item.value;
                default:
                    return false;
            }
        });
    };

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };


    return (
        <div
            className="h-full flex flex-col bg-[var(--card)] text-[var(--foreground)] font-sans relative border-r border-[var(--border)]"
            style={{ width: sidebarWidth }}
        >
            {/* Resize Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[var(--foreground)] cursor-col-resize z-50 transition-colors"
                onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startW = sidebarWidth;
                    const onMove = (mv: MouseEvent) => {
                        setSidebarWidth(Math.max(250, Math.min(600, startW + (mv.clientX - startX))));
                    };
                    const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--muted)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <Filter size={16} />
                    <span className="font-bold text-xs uppercase tracking-wider">Correlate</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSortMode(prev => prev === 'count' ? 'alpha' : 'count')}
                        className={clsx(
                            "p-1.5 rounded transition-colors",
                            sortMode === 'count' ? "text-[var(--foreground)] bg-[var(--foreground)]/10" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        )}
                        title={`Sort by: ${sortMode === 'count' ? 'Count (Desc)' : 'Alpha (Asc)'}`}
                    >
                        {sortMode === 'count' ? <ArrowDown size={14} /> : <ArrowUpAZ size={14} />}
                    </button>

                    <button
                        onClick={clearAllFilters}
                        className="p-1.5 hover:bg-[var(--destructive)]/10 rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                        title="Clear Active Filters"
                    >
                        <X size={14} />
                    </button>

                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-[var(--muted)] rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors lg:hidden"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">

                {/* Files Section */}
                <SectionHeader title="Files" icon={FileText} expanded={expandedSections.file} onToggle={() => toggleSection('file')} />
                {expandedSections.file && (
                    <CorrelationItemList
                        items={Array.from(correlationData.fileNames || [])} type="file"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={true} setShowAllCallIds={setShowAllCallIds}

                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                        onRemoveItem={removeFile}
                    />
                )}

                <SectionHeader title="Call IDs" icon={Phone} expanded={expandedSections.callId} onToggle={() => toggleSection('callId')} />
                {expandedSections.callId && (
                    <CorrelationItemList
                        items={Array.from(correlationData.callIds)} type="callId"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={showAllCallIds} setShowAllCallIds={setShowAllCallIds}

                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}

                <SectionHeader title="Reports" icon={Hash} expanded={expandedSections.report} onToggle={() => toggleSection('report')} />
                {expandedSections.report && (
                    <CorrelationItemList
                        items={Array.from(correlationData.reportIds)} type="report"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={showAllCallIds} setShowAllCallIds={setShowAllCallIds}

                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}

                <SectionHeader title="Stations" icon={Monitor} expanded={expandedSections.station} onToggle={() => toggleSection('station')} />
                {expandedSections.station && (
                    <CorrelationItemList
                        items={Array.from(correlationData.stationIds)} type="station"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={showAllCallIds} setShowAllCallIds={setShowAllCallIds}

                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}

                <SectionHeader title="Operators" icon={User} expanded={expandedSections.operator} onToggle={() => toggleSection('operator')} />
                {expandedSections.operator && (
                    <CorrelationItemList
                        items={Array.from(correlationData.operatorIds)} type="operator"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={showAllCallIds} setShowAllCallIds={setShowAllCallIds}
                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}

                <SectionHeader title="Session (cncID)" icon={Activity} expanded={expandedSections.cncID} onToggle={() => toggleSection('cncID')} />
                {expandedSections.cncID && (
                    <CorrelationItemList
                        items={Array.from(correlationData.cncIds || [])} type="cncID"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={true} setShowAllCallIds={setShowAllCallIds}
                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}

                <SectionHeader title="Message (messageID)" icon={MessageSquare} expanded={expandedSections.messageID} onToggle={() => toggleSection('messageID')} />
                {expandedSections.messageID && (
                    <CorrelationItemList
                        items={Array.from(correlationData.messageIds || [])} type="messageID"
                        activeCorrelations={activeCorrelations} correlationCounts={correlationCounts}
                        toggleCorrelation={toggleCorrelation} setOnlyCorrelation={setOnlyCorrelation}
                        showAllCallIds={true} setShowAllCallIds={setShowAllCallIds}
                        sortMode={sortMode}
                        hoveredCallId={hoveredCallId}
                        hoveredCorrelation={hoveredCorrelation}
                        setHoveredCorrelation={setHoveredCorrelation}
                    />
                )}
            </div>

            {activeCorrelations.length > 0 && (
                <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--muted)]/30">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                        Analyze Active Filters
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {activeCorrelations.slice(0, 4).map((item) => {
                            const scopedLogs = getCorrelationLogs(item);
                            return (
                                <div key={`${item.type}:${item.value}:${item.excluded ? 'excluded' : 'included'}`} className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-[var(--muted-foreground)] truncate">
                                        {item.type}: {item.value}
                                    </span>
                                    <AIButton
                                        variant="secondary"
                                        size="sm"
                                        promptType="custom"
                                        customPrompt={`Analyze logs for ${item.type}: ${item.value}. Identify key patterns, errors, and probable root causes.`}
                                        logs={scopedLogs}
                                        label="Analyze"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-auto px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)] text-center bg-[var(--muted)]/30">
                {activeCorrelations.length > 0 ? (
                    <span className="text-[var(--foreground)] font-medium">{activeCorrelations.length} Active Filter(s)</span>
                ) : (
                    <span className="opacity-50">No active filters</span>
                )}
            </div>
        </div>
    );
};

export default CorrelationSidebar;

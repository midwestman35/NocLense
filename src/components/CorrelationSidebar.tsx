import React, { useState } from 'react';
import { useLogContext, type CorrelationItem } from '../contexts/LogContext';
import { Hash, User, Phone, Monitor, ChevronRight, ChevronDown, Filter, X, ArrowUpAZ, ArrowDown, FileText, Ban } from 'lucide-react';
import clsx from 'clsx';

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
    setHoveredCorrelation
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
    setHoveredCorrelation: (item: CorrelationItem | null) => void
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

    if (sortedItems.length === 0) return <div className="px-8 py-1 text-xs text-[var(--text-secondary)] italic opacity-60">None detected</div>;

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
                                ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]"
                                : isExcluded
                                    ? "bg-red-500/10 text-red-400 border-red-500 opacity-60"
                                    : isHighlighted
                                        ? "bg-yellow-500/20 text-yellow-200 border-yellow-500"
                                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-light)] hover:text-[var(--text-primary)] border-transparent"
                        )}
                        onClick={() => toggleCorrelation({ type, value: item })}
                        onMouseEnter={() => setHoveredCorrelation({ type, value: item })}
                        onMouseLeave={() => setHoveredCorrelation(null)}
                    >
                        <span className="break-all mr-2" title={item}>{item}</span>

                        <div className="flex items-center gap-2 shrink-0 ml-auto pointer-events-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCorrelation({ type, value: item, excluded: true });
                                }}
                                className={clsx(
                                    "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 hover:text-red-400",
                                    isExcluded ? "text-red-400 opacity-100" : "text-[var(--text-secondary)]"
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
                                        ? "bg-[var(--accent-blue)] text-[var(--bg-light)] border-[var(--accent-blue)] opacity-100"
                                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--accent-blue)] hover:text-white hover:border-[var(--accent-blue)]"
                                )}
                            >
                                {isOnlyFilter ? 'ALL' : 'ONLY'}
                            </button>

                            <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors font-sans",
                                isActive
                                    ? "bg-[var(--accent-blue)] text-white"
                                    : "bg-[var(--border-color)] text-[var(--text-secondary)] group-hover:bg-[var(--text-secondary)] group-hover:text-[var(--card-bg)]"
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
                    className="px-8 py-1 text-xs text-blue-400 hover:text-blue-300 text-left italic hover:underline"
                >
                    Show {remainingCount} More...
                </button>
            )}
            {!isLimited && type === 'callId' && items.length > 10 && (
                <button
                    onClick={() => setShowAllCallIds(false)}
                    className="px-8 py-1 text-xs text-blue-400 hover:text-blue-300 text-left italic hover:underline"
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
        className="flex items-center w-full px-3 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-light)] transition-colors uppercase tracking-wider border-b border-[var(--border-color)]/50 bg-[var(--card-bg)] sticky top-0 z-10"
    >
        {expanded ? <ChevronDown size={12} className="mr-2" /> : <ChevronRight size={12} className="mr-2" />}
        <Icon size={12} className="mr-2" />
        <span className="flex-grow text-left">{title}</span>
    </button>
);

const CorrelationSidebar = () => {
    const {
        correlationData,
        activeCorrelations,
        toggleCorrelation,
        setOnlyCorrelation,
        correlationCounts,
        setIsSidebarOpen,

        clearAllFilters,
        hoveredCallId,
        hoveredCorrelation,
        setHoveredCorrelation
    } = useLogContext();

    const [expandedSections, setExpandedSections] = useState({
        file: true,
        report: true,
        operator: true,
        station: true,
        callId: true,
        extension: true,
    });

    const [sortMode, setSortMode] = useState<SortMode>('count');
    const [showAllCallIds, setShowAllCallIds] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };


    return (
        <div
            className="h-full flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] font-sans relative border-r border-[var(--border-color)]"
            style={{ width: sidebarWidth }}
        >
            {/* Resize Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[var(--accent-blue)] cursor-col-resize z-50 transition-colors"
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
            <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-light)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <Filter size={16} />
                    <span className="font-bold text-xs uppercase tracking-wider">Correlate</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSortMode(prev => prev === 'count' ? 'alpha' : 'count')}
                        className={clsx(
                            "p-1.5 rounded transition-colors",
                            sortMode === 'count' ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10" : "text-[var(--text-secondary)] hover:bg-[var(--bg-light)]"
                        )}
                        title={`Sort by: ${sortMode === 'count' ? 'Count (Desc)' : 'Alpha (Asc)'}`}
                    >
                        {sortMode === 'count' ? <ArrowDown size={14} /> : <ArrowUpAZ size={14} />}
                    </button>

                    <button
                        onClick={clearAllFilters}
                        className="p-1.5 hover:bg-red-500/10 rounded text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                        title="Clear Active Filters"
                    >
                        <X size={14} />
                    </button>

                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-[var(--bg-light)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors lg:hidden"
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
            </div>

            <div className="mt-auto px-4 py-2 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] text-center bg-[var(--bg-light)]/30">
                {activeCorrelations.length > 0 ? (
                    <span className="text-[var(--accent-blue)] font-medium">{activeCorrelations.length} Active Filter(s)</span>
                ) : (
                    <span className="opacity-50">No active filters</span>
                )}
            </div>
        </div>
    );
};

export default CorrelationSidebar;

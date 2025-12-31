import React, { useState } from 'react';
import { useLogContext, type CorrelationItem } from '../contexts/LogContext';
import { Hash, User, Phone, Monitor, ChevronRight, ChevronDown, Filter, X, ArrowUpAZ, ArrowDown, Settings2 } from 'lucide-react';
import clsx from 'clsx';

type SortMode = 'alpha' | 'count';

const CorrelationSidebar = () => {
    const {
        correlationData,
        activeCorrelations,
        toggleCorrelation,
        setOnlyCorrelation,
        correlationCounts,
        setIsSidebarOpen
    } = useLogContext();

    const [expandedSections, setExpandedSections] = useState({
        report: true,
        operator: true,
        station: true,
        callId: true,
        extension: true,
    });

    const [sortMode, setSortMode] = useState<SortMode>('count'); // Default to count sort (Most Active)

    const [showAllCallIds, setShowAllCallIds] = useState(false);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const isSelected = (type: CorrelationItem['type'], value: string) => {
        return activeCorrelations.some(item => item.type === type && item.value === value);
    };

    const handleToggle = (type: CorrelationItem['type'], value: string) => {
        toggleCorrelation({ type, value });
    };

    const handleOnly = (e: React.MouseEvent, type: CorrelationItem['type'], value: string) => {
        e.stopPropagation();

        // Check if this item is currently the ONLY active correlation
        const isCurrentlyOnly = activeCorrelations.length === 1 &&
            activeCorrelations[0].type === type &&
            activeCorrelations[0].value === value;

        if (isCurrentlyOnly) {
            // If it's already "Only", toggle back to "All" (clear filters)
            // Or should we revert to previous state? "All" is safer/simpler.
            // But we need a way to clear *active* correlations.
            // LogContext has clearAllFilters but that clears search too.
            // We need clearActiveCorrelations. 
            // setOnlyCorrelation([]) works if type definition allows it, but it expects one item.
            // We need a helper to clear.
            // Actually, we can just use toggleCorrelation to remove the last item!
            toggleCorrelation({ type, value });
        } else {
            setOnlyCorrelation({ type, value });
        }
    };

    const SectionHeader = ({ title, icon: Icon, sectionKey }: { title: string, icon: any, sectionKey: keyof typeof expandedSections }) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center w-full px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors uppercase tracking-wider"
        >
            {expandedSections[sectionKey] ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />}
            <Icon size={14} className="mr-2" />
            <span className="flex-grow text-left">{title}</span>
        </button>
    );

    const ItemList = ({ items, type, icon: Icon }: { items: string[], type: CorrelationItem['type'], icon: any }) => {
        if (!expandedSections[type]) return null;

        // Sorting Logic
        const sortedItems = [...items].sort((a, b) => {
            if (sortMode === 'count') {
                const countA = correlationCounts[`${type}:${a}`] || 0;
                const countB = correlationCounts[`${type}:${b}`] || 0;
                // Descending for count
                if (countB !== countA) return countB - countA;
            }
            // Fallback to Alpha
            return a.localeCompare(b);
        });

        if (sortedItems.length === 0) return <div className="px-8 py-1 text-xs text-slate-600 italic">None detected</div>;

        // Limiting Logic
        const isLimited = type === 'callId' && !showAllCallIds;
        const visibleItems = isLimited ? sortedItems.slice(0, 10) : sortedItems;
        const remainingCount = sortedItems.length - visibleItems.length;

        return (
            <div className="flex flex-col mb-2">
                {visibleItems.map(item => {
                    const selected = isSelected(type, item);
                    const count = correlationCounts[`${type}:${item}`] || 0;

                    // Check if this specific item is the "Only" one active
                    const isOnlyActive = activeCorrelations.length === 1 &&
                        activeCorrelations[0].type === type &&
                        activeCorrelations[0].value === item;

                    return (
                        <div
                            key={item}
                            className={clsx(
                                "flex items-center px-4 py-1.5 text-xs font-mono transition-colors group cursor-pointer relative",
                                selected ? "bg-blue-600/20 text-blue-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                            )}
                            onClick={() => handleToggle(type, item)}
                        >
                            <input
                                type="checkbox"
                                checked={selected}
                                readOnly
                                className="mr-3 cursor-pointer rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                            />
                            <span className="truncate flex-grow" title={item}>{item}</span>

                            {/* Only/All Button */}
                            <button
                                onClick={(e) => handleOnly(e, type, item)}
                                className={clsx(
                                    "mx-2 text-[10px] px-1 rounded backdrop-blur-sm transition-opacity",
                                    isOnlyActive
                                        ? "block text-blue-300 bg-blue-900/80 hover:bg-blue-800" // Always visible if active
                                        : "hidden group-hover:block text-blue-400 hover:text-blue-300 bg-slate-900/80" // Visible on hover otherwise
                                )}
                            >
                                {isOnlyActive ? "All" : "Only"}
                            </button>

                            <span className="ml-2 text-[10px] text-slate-600 font-sans px-1.5 py-0.5 bg-slate-800 rounded-full group-hover:bg-slate-700 min-w-[20px] text-center">
                                {count}
                            </span>
                        </div>
                    );
                })}

                {/* Show More / Show Less Button */}
                {type === 'callId' && sortedItems.length > 10 && (
                    <button
                        onClick={() => setShowAllCallIds(!showAllCallIds)}
                        className="mx-4 my-1 text-xs text-blue-400 hover:text-blue-300 text-left hover:underline"
                    >
                        {showAllCallIds ? "Show Less" : `Show ${remainingCount} More...`}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col flex-shrink-0 h-full overflow-hidden text-slate-300">
            {/* Header */}
            <div className="p-3 border-b border-slate-700 font-semibold text-sm flex items-center justify-between bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-blue-500" />
                    <span>Correlate</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Sorting Controls */}
                    <button
                        onClick={() => setSortMode('count')}
                        className={clsx("p-1.5 rounded transition-colors", sortMode === 'count' ? "bg-blue-600 text-white" : "hover:bg-slate-700 text-slate-500")}
                        title="Sort by Count (Most Active)"
                    >
                        <ArrowDown size={14} />
                    </button>
                    <button
                        onClick={() => setSortMode('alpha')}
                        className={clsx("p-1.5 rounded transition-colors", sortMode === 'alpha' ? "bg-blue-600 text-white" : "hover:bg-slate-700 text-slate-500")}
                        title="Sort Alphabetically"
                    >
                        <ArrowUpAZ size={14} />
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded transition-colors ml-1"
                        title="Close Sidebar"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Active Filters Summary (Optional, if space permits) */}
            {activeCorrelations.length > 0 && (
                <div className="px-3 py-2 bg-blue-900/20 border-b border-blue-900/30 flex items-center justify-between">
                    <span className="text-xs text-blue-300">{activeCorrelations.length} active filter(s)</span>
                    <button
                        onClick={() => activeCorrelations.forEach(c => toggleCorrelation(c))}
                        className="text-[10px] text-blue-400 hover:text-white underline"
                    >
                        Clear
                    </button>
                </div>
            )}

            <div className="flex-grow overflow-y-auto py-2">
                <SectionHeader title="Call IDs" icon={Phone} sectionKey="callId" />
                <ItemList items={correlationData.callIds} type="callId" icon={Phone} />

                <SectionHeader title="Reports" icon={Hash} sectionKey="report" />
                <ItemList items={correlationData.reportIds} type="report" icon={Hash} />

                <SectionHeader title="Stations" icon={Monitor} sectionKey="station" />
                <ItemList items={correlationData.stationIds} type="station" icon={Monitor} />

                <SectionHeader title="Operators" icon={User} sectionKey="operator" />
                <ItemList items={correlationData.operatorIds} type="operator" icon={User} />
            </div>
        </div>
    );
};

export default CorrelationSidebar;

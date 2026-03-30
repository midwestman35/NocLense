import { useState, useRef, useEffect, useMemo } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { Search, Check, X, Star, Sparkles, Database } from 'lucide-react';
import SearchHistoryDropdown from './SearchHistoryDropdown';
import SipFilterDropdown from './SipFilterDropdown';
import MessageTypeFilterDropdown from './MessageTypeFilterDropdown';

const FilterBar = () => {
    const {
        filterText,
        setFilterText,
        isSipFilterEnabled,
        setIsSipFilterEnabled,
        selectedLevels,
        toggleLevel,
        selectedSipMethods,
        toggleSipMethod,
        logs,
        filteredLogs,
        clearAllFilters,
        clearFilterSelections,
        hasActiveFilters,
        activeCorrelations,
        toggleCorrelation,
        searchHistory,
        addToSearchHistory,
        clearSearchHistory,
        favoriteLogIds,
        isShowFavoritesOnly,
        setIsShowFavoritesOnly,
        availableMessageTypes,
        excludedMessageTypes,
        toggleExcludedMessageType,
        selectedMessageTypeFilter,
        setSelectedMessageTypeFilter,
        isCollapseSimilarEnabled,
        setIsCollapseSimilarEnabled,
        aiHighlightedLogIds,
        isShowAiHighlightOnly,
        setIsShowAiHighlightOnly,
        selectedSourceFilter,
        setSelectedSourceFilter,
        availableSources,
    } = useLogContext();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle focus
    const handleFocus = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setIsDropdownOpen(true);
        setSelectedIndex(-1);
    };

    // Handle blur with delay to allow clicking on dropdown items
    const handleBlur = () => {
        blurTimeoutRef.current = setTimeout(() => {
            setIsDropdownOpen(false);
            setSelectedIndex(-1);
        }, 200);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isDropdownOpen && searchHistory.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setIsDropdownOpen(true);
        }

        if (!isDropdownOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < searchHistory.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : searchHistory.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < searchHistory.length) {
                    handleHistorySelect(searchHistory[selectedIndex]);
                } else if (filterText.trim()) {
                    // Add current search to history on Enter
                    addToSearchHistory(filterText.trim());
                }
                break;
            case 'Escape':
                setIsDropdownOpen(false);
                setSelectedIndex(-1);
                inputRef.current?.blur();
                break;
        }
    };

    // Handle history item selection
    const handleHistorySelect = (term: string) => {
        setFilterText(term);
        addToSearchHistory(term);
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Detect if Homer logs are present and extract available SIP methods
    const hasHomerLogs = useMemo(() => {
        return logs.some(log => log.component === 'Homer SIP');
    }, [logs]);

    const availableSipMethods = useMemo(() => {
        if (!hasHomerLogs) return [];
        const methods = new Set<string>();
        
        logs.forEach(log => {
            if (log.component === 'Homer SIP' && log.sipMethod) {
                // Normalize SIP response codes (e.g., "100 trying" and "100 trying -- your call is important to us" -> "100 Trying")
                // Extract numeric code and first word of reason phrase
                const responseMatch = log.sipMethod.match(/^(\d{3})\s+(\w+)(?:\s+.*)?$/i);
                if (responseMatch) {
                    const code = responseMatch[1];
                    const firstWord = responseMatch[2].charAt(0).toUpperCase() + responseMatch[2].slice(1).toLowerCase();
                    const normalized = `${code} ${firstWord}`;
                    methods.add(normalized);
                } else {
                    // For request methods (INVITE, ACK, etc.), add as-is
                    methods.add(log.sipMethod);
                }
            }
        });
        return Array.from(methods);
    }, [logs, hasHomerLogs]);

    return (
        <div className="flex items-center gap-3 w-full p-2 relative z-50" ref={dropdownRef}>
            <div className="relative flex-grow max-w-2xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]" size={16} />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search logs (Call-ID, message, component)..."
                    className="w-full bg-transparent border border-[var(--input)] rounded-[var(--radius-md)] pl-10 pr-4 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)] placeholder:text-[var(--muted-foreground)] transition-colors"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                />
                <SearchHistoryDropdown
                    history={searchHistory}
                    isOpen={isDropdownOpen}
                    selectedIndex={selectedIndex}
                    onSelect={handleHistorySelect}
                    onClear={clearSearchHistory}
                    onClose={() => setIsDropdownOpen(false)}
                />
            </div>

            {/* Active Filters Display Chips + Clear filters button */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient min-w-0 flex-1">
                        {activeCorrelations.map((filter) => (
                            <div
                                key={`${filter.type}-${filter.value}`}
                                className="flex items-center gap-1 bg-[var(--foreground)]/10 text-[var(--foreground)] border border-[var(--foreground)]/20 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shadow-sm shrink-0"
                            >
                                <span className="font-bold uppercase opacity-75 text-[10px] tracking-wider">{filter.type}:</span>
                                <span className="font-mono font-medium">{filter.value}</span>
                                <button
                                    onClick={() => toggleCorrelation(filter)}
                                    className="ml-1 hover:text-[var(--destructive)] transition-colors p-0.5 rounded-full hover:bg-[var(--destructive)]/10"
                                    title={`Remove ${filter.type} filter`}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                        title="Clear all filters (keeps log data)"
                    >
                        <X size={14} />
                        Clear filters
                    </button>
                </div>
            )}

            <div className="w-px h-6 bg-[var(--border)] mx-2 shrink-0" />

            {/* Toggles */}
            <div className="flex items-center gap-4 shrink-0">
                <SipFilterDropdown
                    selectedLevels={selectedLevels}
                    isSipFilterEnabled={isSipFilterEnabled}
                    selectedSipMethods={selectedSipMethods}
                    availableSipMethods={availableSipMethods}
                    onToggleLevel={toggleLevel}
                    onToggleSipOnly={() => setIsSipFilterEnabled(!isSipFilterEnabled)}
                    onToggleSipMethod={toggleSipMethod}
                    onClearAll={clearFilterSelections}
                />

                <MessageTypeFilterDropdown
                    availableMessageTypes={availableMessageTypes}
                    excludedMessageTypes={excludedMessageTypes}
                    selectedMessageTypeFilter={selectedMessageTypeFilter}
                    onToggleExcluded={toggleExcludedMessageType}
                    onSelectFilter={setSelectedMessageTypeFilter}
                />

                {/* Source Filter Dropdown */}
                {availableSources.length > 1 && (
                    <SourceFilterDropdown
                        sources={availableSources}
                        selected={selectedSourceFilter}
                        onSelect={setSelectedSourceFilter}
                    />
                )}

                <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors select-none group">
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsShowFavoritesOnly(!isShowFavoritesOnly);
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-4 h-4 border rounded transition-all duration-200 flex items-center justify-center ${isShowFavoritesOnly ? 'bg-[var(--warning)]/10 border-[var(--warning)]' : 'border-[var(--muted-foreground)] bg-transparent'}`}
                    >
                        <Star size={10} className={isShowFavoritesOnly ? "bg-[var(--warning)]/10 border-[var(--warning)] fill-[var(--warning)] text-[var(--warning)]" : "text-transparent"} />
                    </div>
                    <span className="font-medium group-hover:text-[var(--warning)] transition-colors">Favorites</span>
                    {favoriteLogIds.size > 0 && <span className="text-[10px] opacity-70">({favoriteLogIds.size})</span>}
                </label>

                <label className={`flex items-center gap-2 text-xs select-none group transition-colors ${aiHighlightedLogIds.size > 0 ? 'cursor-pointer text-[var(--muted-foreground)] hover:text-violet-400' : 'cursor-default text-[var(--muted-foreground)] opacity-40'}`}>
                    <div
                        onClick={(e) => {
                            if (aiHighlightedLogIds.size === 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsShowAiHighlightOnly(!isShowAiHighlightOnly);
                        }}
                        role="button"
                        tabIndex={aiHighlightedLogIds.size > 0 ? 0 : -1}
                        className={`w-4 h-4 border rounded transition-all duration-200 flex items-center justify-center ${isShowAiHighlightOnly && aiHighlightedLogIds.size > 0 ? 'bg-violet-500/20 border-violet-500' : 'border-[var(--muted-foreground)] bg-transparent'}`}
                    >
                        <Sparkles size={9} className={isShowAiHighlightOnly && aiHighlightedLogIds.size > 0 ? 'text-violet-400' : 'text-transparent'} />
                    </div>
                    <span className={`font-medium transition-colors ${aiHighlightedLogIds.size > 0 ? 'group-hover:text-violet-400' : ''}`}>AI highlighted</span>
                    {aiHighlightedLogIds.size > 0 && <span className="text-[10px] opacity-70">({aiHighlightedLogIds.size})</span>}
                </label>

                <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors select-none group" title="Group consecutive rows with same service and message">
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsCollapseSimilarEnabled(!isCollapseSimilarEnabled);
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-4 h-4 border rounded transition-all duration-200 flex items-center justify-center ${isCollapseSimilarEnabled ? 'bg-[var(--foreground)] border-[var(--foreground)]' : 'border-[var(--muted-foreground)] bg-transparent'}`}
                    >
                        {isCollapseSimilarEnabled && <Check size={12} className="text-white" />}
                    </div>
                    <span className="font-medium group-hover:text-[var(--foreground)] transition-colors">Collapse similar</span>
                </label>
            </div>

            {/* Log Count */}
            {logs.length > 0 && (
                <>
                    <div className="w-px h-6 bg-[var(--border)] mx-2 shrink-0" />
                    <div className="text-xs text-[var(--muted-foreground)] shrink-0 font-mono">
                        <span className="font-bold text-[var(--foreground)]">{filteredLogs.length}</span>
                        <span className="opacity-75"> / {logs.length}</span>
                    </div>
                </>
            )}
        </div>
    );
};

/** Inline dropdown for filtering logs by source type (Datadog, Homer SIP, APEX, etc.) */
function SourceFilterDropdown({
    sources,
    selected,
    onSelect,
}: {
    sources: string[];
    selected: string | null;
    onSelect: (source: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const SOURCE_COLORS: Record<string, string> = {
        'Datadog': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Homer SIP': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        'Call Log': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'FDX': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'CCS/PBX': 'bg-green-500/20 text-green-400 border-green-500/30',
        'APEX Local': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                    selected
                        ? SOURCE_COLORS[selected] || 'bg-[var(--foreground)]/10 text-[var(--foreground)] border-[var(--foreground)]/20'
                        : 'text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
            >
                <Database size={12} />
                {selected || 'Source'}
                {selected && (
                    <span
                        onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                        className="ml-0.5 rounded-full hover:bg-[var(--destructive)]/20 p-0.5"
                    >
                        <X size={10} />
                    </span>
                )}
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 z-[60] min-w-[160px] rounded-lg border shadow-xl py-1"
                    style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                    {selected && (
                        <button
                            onClick={() => { onSelect(null); setOpen(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors"
                            style={{ color: 'var(--muted-foreground)' }}
                        >
                            Show all sources
                        </button>
                    )}
                    {sources.map(src => (
                        <button
                            key={src}
                            onClick={() => { onSelect(src === selected ? null : src); setOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors flex items-center gap-2 ${
                                src === selected ? 'font-semibold' : ''
                            }`}
                            style={{ color: src === selected ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                SOURCE_COLORS[src]?.split(' ')[0] || 'bg-gray-500/30'
                            }`} />
                            {src}
                            {src === selected && <Check size={12} className="ml-auto" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FilterBar;

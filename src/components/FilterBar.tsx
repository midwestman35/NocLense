import { useState, useRef, useEffect, useMemo } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { Search, Check, X, Star } from 'lucide-react';
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
        setIsCollapseSimilarEnabled
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search logs (Call-ID, message, component)..."
                    className="w-full bg-[var(--bg-light)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] focus:border-[var(--accent-blue)] placeholder-[var(--text-secondary)] transition-all shadow-sm"
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

            {/* Active Filters Display Chips */}
            {activeCorrelations.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient flex-1">
                    {activeCorrelations.map((filter) => (
                        <div
                            key={`${filter.type}-${filter.value}`}
                            className="flex items-center gap-1 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shadow-sm"
                        >
                            <span className="font-bold uppercase opacity-75 text-[10px] tracking-wider">{filter.type}:</span>
                            <span className="font-mono font-medium">{filter.value}</span>
                            <button
                                onClick={() => toggleCorrelation(filter)}
                                className="ml-1 hover:text-[var(--err)] transition-colors p-0.5 rounded-full hover:bg-[var(--err)]/10"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {activeCorrelations.length > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--err)] underline decoration-dotted underline-offset-2 whitespace-nowrap ml-2"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            )}

            <div className="w-px h-6 bg-[var(--border-color)] mx-2 shrink-0" />

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

                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none group">
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsShowFavoritesOnly(!isShowFavoritesOnly);
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-4 h-4 border rounded transition-all duration-200 flex items-center justify-center ${isShowFavoritesOnly ? 'bg-yellow-500/10 border-yellow-500' : 'border-[var(--text-secondary)] bg-transparent'}`}
                    >
                        <Star size={10} className={isShowFavoritesOnly ? "bg-yellow-500/10 border-yellow-500 fill-yellow-500 text-yellow-500" : "text-transparent"} />
                    </div>
                    <span className="font-medium group-hover:text-yellow-500 transition-colors">Favorites</span>
                    {favoriteLogIds.size > 0 && <span className="text-[10px] opacity-70">({favoriteLogIds.size})</span>}
                </label>

                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none group" title="Group consecutive rows with same service and message">
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsCollapseSimilarEnabled(!isCollapseSimilarEnabled);
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-4 h-4 border rounded transition-all duration-200 flex items-center justify-center ${isCollapseSimilarEnabled ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' : 'border-[var(--text-secondary)] bg-transparent'}`}
                    >
                        {isCollapseSimilarEnabled && <Check size={12} className="text-white" />}
                    </div>
                    <span className="font-medium group-hover:text-[var(--accent-blue)] transition-colors">Collapse similar</span>
                </label>
            </div>

            {/* Log Count */}
            {logs.length > 0 && (
                <>
                    <div className="w-px h-6 bg-[var(--border-color)] mx-2 shrink-0" />
                    <div className="text-xs text-[var(--text-secondary)] shrink-0 font-mono">
                        <span className="font-bold text-[var(--text-primary)]">{filteredLogs.length}</span>
                        <span className="opacity-75"> / {logs.length}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default FilterBar;

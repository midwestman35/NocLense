import { useState, useRef, useEffect } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { Search, Filter } from 'lucide-react';
import SearchHistoryDropdown from './SearchHistoryDropdown';

const FilterBar = () => {
    const {
        filterText,
        setFilterText,
        isSipFilterEnabled,
        setIsSipFilterEnabled,
        logs,
        filteredLogs,
        isTextWrapEnabled,
        setIsTextWrapEnabled,
        clearAllFilters,
        activeCorrelations,
        searchHistory,
        addToSearchHistory,
        clearSearchHistory
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

    return (
        <div className="flex items-center gap-4 p-4 bg-slate-800 border-b border-slate-700">
            <div className="relative flex-grow max-w-md" ref={dropdownRef}>
                <div className="flex items-center bg-slate-900 rounded-md px-3 py-2 border border-slate-700 focus-within:border-blue-500">
                    <Search size={18} className="text-slate-500 mr-2" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search logs (Call-ID, message, component)..."
                        className="bg-transparent border-none outline-none text-slate-50 w-full placeholder-slate-500"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <SearchHistoryDropdown
                    history={searchHistory}
                    isOpen={isDropdownOpen}
                    selectedIndex={selectedIndex}
                    onSelect={handleHistorySelect}
                    onClear={clearSearchHistory}
                    onClose={() => setIsDropdownOpen(false)}
                />
            </div>

            <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer select-none space-x-2">
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={isSipFilterEnabled}
                            onChange={() => setIsSipFilterEnabled(!isSipFilterEnabled)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${isSipFilterEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isSipFilterEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-1 text-slate-300">
                        <Filter size={16} /> SIP Filter
                    </span>
                </label>

                <label className="flex items-center cursor-pointer select-none space-x-2">
                    <input
                        type="checkbox"
                        className="w-4 h-4 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-offset-slate-800"
                        checked={isTextWrapEnabled}
                        onChange={() => setIsTextWrapEnabled(!isTextWrapEnabled)}
                    />
                    <span className="text-sm font-medium text-slate-300">
                        Wrap Text
                    </span>
                </label>

                {(filterText || isSipFilterEnabled || activeCorrelations.length > 0) && (
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1.5 rounded transition-colors border border-red-500/20"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {logs.length > 0 && (
                <div className="text-xs text-slate-500 ml-auto flex items-center gap-3">
                    <span>{logs.length.toLocaleString()} event{logs.length !== 1 ? 's' : ''}</span>
                    {filteredLogs.length !== logs.length && (
                        <span className="text-blue-400">
                            ({filteredLogs.length.toLocaleString()} filtered)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterBar;

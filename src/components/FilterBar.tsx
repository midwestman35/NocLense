import { useState, useRef, useEffect } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { Search, Filter } from 'lucide-react';
import SearchHistoryDropdown from './SearchHistoryDropdown';

const FilterBar = () => {
    const { 
        filterText, 
        setFilterText, 
        smartFilterActive, 
        setSmartFilterActive, 
        logs,
        searchHistory,
        addToSearchHistory,
        clearSearchHistory
    } = useLogContext();
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

            <div className="flex items-center gap-2">
                <label className="flex items-center cursor-pointer select-none space-x-2">
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={smartFilterActive}
                            onChange={() => setSmartFilterActive(!smartFilterActive)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${smartFilterActive ? 'bg-blue-600' : 'bg-slate-700'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${smartFilterActive ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-1 text-slate-300">
                        <Filter size={16} /> Smart Filter
                    </span>
                </label>
            </div>

            {logs.length > 0 && (
                <div className="text-xs text-slate-500 ml-auto">
                    {logs.length.toLocaleString()} events
                </div>
            )}
        </div>
    );
};

export default FilterBar;

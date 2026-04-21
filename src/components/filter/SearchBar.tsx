import { useState, useRef, useEffect } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { Search } from 'lucide-react';
import SearchHistoryDropdown from '../SearchHistoryDropdown';

export default function SearchBar() {
  const {
    filterText,
    setFilterText,
    searchHistory,
    addToSearchHistory,
    clearSearchHistory,
  } = useLogContext();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
    setSelectedIndex(-1);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleHistorySelect = (term: string) => {
    setFilterText(term);
    addToSearchHistory(term);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && searchHistory.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsDropdownOpen(true);
    }

    if (!isDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < searchHistory.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : searchHistory.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchHistory.length) {
          handleHistorySelect(searchHistory[selectedIndex]);
        } else if (filterText.trim()) {
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

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  return (
    <div className="relative flex-grow max-w-2xl">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]" size={16} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search logs (traceId, Call-ID, message, component)..."
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
  );
}

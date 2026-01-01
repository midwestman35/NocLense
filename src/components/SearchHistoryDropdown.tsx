import { Search } from 'lucide-react';

interface SearchHistoryDropdownProps {
    history: string[];
    isOpen: boolean;
    selectedIndex: number;
    onSelect: (term: string) => void;
    onClear: () => void;
    onClose: () => void;
}

const SearchHistoryDropdown = ({
    history,
    isOpen,
    selectedIndex,
    onSelect,
    onClear,
    onClose
}: SearchHistoryDropdownProps) => {
    if (!isOpen) return null;

    const handleItemClick = (term: string) => {
        onSelect(term);
        onClose();
    };

    const truncateText = (text: string, maxLength: number = 50) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
            {history.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    No search history
                </div>
            ) : (
                <>
                    <div className="px-2 py-1 border-b border-slate-700 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 px-2 py-1">Recent Searches</span>
                        <button
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent input blur
                                onClear();
                            }}
                            className="text-xs text-slate-500 hover:text-red-400 px-2 py-1 rounded transition-colors"
                            title="Clear history"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="py-1">
                        {history.map((term, index) => (
                            <button
                                key={`${term}-${index}`}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    handleItemClick(term);
                                }}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-200 hover:bg-slate-700'
                                }`}
                            >
                                <Search size={14} className="flex-shrink-0 text-slate-400" />
                                <span className="flex-1 truncate">{truncateText(term)}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default SearchHistoryDropdown;


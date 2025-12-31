import { useLogContext } from '../contexts/LogContext';
import { Search, Filter } from 'lucide-react';

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
        activeCorrelations
    } = useLogContext();

    return (
        <div className="flex items-center gap-4 p-4 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center bg-slate-900 rounded-md px-3 py-2 flex-grow max-w-md border border-slate-700 focus-within:border-blue-500">
                <Search size={18} className="text-slate-500 mr-2" />
                <input
                    type="text"
                    placeholder="Search logs (Call-ID, message, component)..."
                    className="bg-transparent border-none outline-none text-slate-50 w-full placeholder-slate-500"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
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

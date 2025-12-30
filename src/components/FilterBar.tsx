import { useLogContext } from '../contexts/LogContext';
import { Search, Filter } from 'lucide-react';

const FilterBar = () => {
    const { filterText, setFilterText, smartFilterActive, setSmartFilterActive, logs } = useLogContext();

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

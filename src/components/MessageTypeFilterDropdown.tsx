import { ChevronDown, Check, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface MessageTypeFilterDropdownProps {
    availableMessageTypes: string[];
    excludedMessageTypes: Set<string>;
    selectedMessageTypeFilter: string | null;
    onToggleExcluded: (type: string) => void;
    onSelectFilter: (type: string | null) => void;
}

const MessageTypeFilterDropdown = ({
    availableMessageTypes,
    excludedMessageTypes,
    selectedMessageTypeFilter,
    onToggleExcluded,
    onSelectFilter
}: MessageTypeFilterDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const hasFilter = selectedMessageTypeFilter !== null || excludedMessageTypes.size > 0;

    const currentLabel = (): string => {
        if (!hasFilter) return 'All types';
        const parts: string[] = [];
        if (selectedMessageTypeFilter) {
            const label = availableMessageTypes.find(t => t === selectedMessageTypeFilter) || selectedMessageTypeFilter;
            parts.push(`Only: ${label.length > 24 ? label.slice(0, 24) + '…' : label}`);
        }
        if (excludedMessageTypes.size > 0) {
            parts.push(`Exclude ${excludedMessageTypes.size}`);
        }
        return parts.join(' · ') || 'All types';
    };

    const clearMessageTypeFilters = () => {
        onSelectFilter(null);
        excludedMessageTypes.forEach(t => onToggleExcluded(t));
    };

    if (availableMessageTypes.length === 0) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-color)] rounded-md hover:border-[var(--accent-blue)] bg-[var(--bg-light)]"
            >
                <span>Message type</span>
                <span className="max-w-[180px] truncate font-mono text-[var(--text-primary)]">
                    {currentLabel()}
                </span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg z-50 min-w-[260px] max-h-[360px] overflow-y-auto">
                    <div className="px-2 py-1 border-b border-[var(--border-color)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-secondary)] px-2">Message type</span>
                        {hasFilter && (
                            <button
                                type="button"
                                onClick={() => { clearMessageTypeFilters(); setIsOpen(false); }}
                                className="text-[10px] text-[var(--accent-blue)] hover:underline px-2"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="py-1">
                        {/* Show only: single select */}
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                            Show only
                        </div>
                        <button
                            onClick={() => { onSelectFilter(null); }}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                selectedMessageTypeFilter === null
                                    ? 'bg-[var(--accent-blue)] text-white'
                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-light)]'
                            }`}
                        >
                            <span className="w-4 flex items-center justify-center">
                                {selectedMessageTypeFilter === null && <Check size={14} />}
                            </span>
                            <span>All message types</span>
                        </button>
                        {availableMessageTypes.map((type) => {
                            const selected = selectedMessageTypeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => { onSelectFilter(selected ? null : type); }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                        selected
                                            ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-light)]'
                                    }`}
                                >
                                    <span className="w-4 flex items-center justify-center shrink-0">
                                        {selected && <Check size={12} className="text-[var(--accent-blue)]" />}
                                    </span>
                                    <span className="font-mono text-xs truncate" title={type}>{type}</span>
                                </button>
                            );
                        })}

                        {/* Exclude: checkboxes (6.3 Option B) */}
                        {availableMessageTypes.length > 0 && (
                            <>
                                <div className="my-1 border-t border-[var(--border-color)]" />
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                                    Exclude (hide these)
                                </div>
                                {availableMessageTypes.map((type) => {
                                    const excluded = excludedMessageTypes.has(type);
                                    return (
                                        <button
                                            key={`excl-${type}`}
                                            onClick={(e) => { e.preventDefault(); onToggleExcluded(type); }}
                                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                                excluded
                                                    ? 'bg-amber-500/10 text-amber-500'
                                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-light)]'
                                            }`}
                                        >
                                            <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 border-[var(--border-color)]">
                                                {excluded && <X size={10} className="text-amber-500" />}
                                            </span>
                                            <span className="font-mono text-xs truncate" title={type}>{type}</span>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageTypeFilterDropdown;

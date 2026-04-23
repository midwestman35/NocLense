import { ChevronDown, Check, AlertCircle, Info, Bug, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { LogLevel } from '../types';

interface SipFilterDropdownProps {
    selectedLevels: Set<LogLevel>;
    isSipFilterEnabled: boolean;
    selectedSipMethods: Set<string>;
    availableSipMethods: string[];
    onToggleLevel: (level: LogLevel) => void;
    onToggleSipOnly: () => void;
    onToggleSipMethod: (method: string) => void;
    onClearAll: () => void;
}

const LEVEL_OPTIONS: { value: LogLevel; label: string; icon: typeof AlertCircle }[] = [
    { value: 'ERROR', label: 'ERROR logs', icon: AlertCircle },
    { value: 'WARN', label: 'WARN logs', icon: AlertTriangle },
    { value: 'INFO', label: 'INFO logs', icon: Info },
    { value: 'DEBUG', label: 'DEBUG logs', icon: Bug },
];

const SipFilterDropdown = ({
    selectedLevels,
    isSipFilterEnabled,
    selectedSipMethods,
    availableSipMethods,
    onToggleLevel,
    onToggleSipOnly,
    onToggleSipMethod,
    onClearAll
}: SipFilterDropdownProps) => {
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

    const hasAnyFilter = selectedLevels.size > 0 || isSipFilterEnabled;

    const currentLabel = (): string => {
        if (!hasAnyFilter) return 'All logs';
        const parts: string[] = [];
        if (selectedLevels.size > 0) {
            parts.push([...selectedLevels].sort().join(', '));
        }
        if (isSipFilterEnabled) {
            if (selectedSipMethods.size > 0) {
                parts.push(`SIP: ${selectedSipMethods.size} method${selectedSipMethods.size === 1 ? '' : 's'}`);
            } else {
                parts.push('SIP only');
            }
        }
        return parts.join(' · ') || 'All logs';
    };

    const sortedSipMethods = [...availableSipMethods].sort((a, b) => {
        const aIsResponse = /^\d{3}/.test(a);
        const bIsResponse = /^\d{3}/.test(b);
        if (aIsResponse && !bIsResponse) return -1;
        if (!aIsResponse && bIsResponse) return 1;
        return a.localeCompare(b);
    });

    const hasSipOptions = availableSipMethods.length > 0;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)] rounded-md hover:border-[var(--foreground)] bg-[var(--accent)]"
            >
                <span>Filter</span>
                <span className="max-w-[160px] truncate font-mono text-[var(--foreground)]">
                    {currentLabel()}
                </span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-[var(--shadow-raised)] z-50 min-w-[220px] max-h-[320px] overflow-y-auto">
                    <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--muted-foreground)] px-2">Show only (multi-select)</span>
                        {hasAnyFilter && (
                            <button
                                type="button"
                                onClick={() => { onClearAll(); setIsOpen(false); }}
                                className="text-[10px] text-[var(--foreground)] hover:underline px-2"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="py-1">
                        <button
                            onClick={() => { onClearAll(); setIsOpen(false); }}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                !hasAnyFilter
                                    ? 'bg-[var(--foreground)] text-ink-0'
                                    : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                            }`}
                        >
                            <span className="w-4 flex items-center justify-center">
                                {!hasAnyFilter && <Check size={14} />}
                            </span>
                            <span>All logs</span>
                        </button>

                        {LEVEL_OPTIONS.map(({ value, label, icon: Icon }) => {
                            const checked = selectedLevels.has(value);
                            return (
                                <button
                                    key={value}
                                    onClick={(e) => { e.preventDefault(); onToggleLevel(value); }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                        checked
                                            ? 'bg-[var(--foreground)]/15 text-[var(--foreground)]'
                                            : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                                    }`}
                                >
                                    <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 border-[var(--border)]">
                                        {checked && <Check size={12} className="text-[var(--foreground)]" />}
                                    </span>
                                    <Icon size={14} className={value === 'ERROR' ? 'text-[var(--destructive)]' : value === 'WARN' ? 'text-[var(--warning)]' : ''} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}

                        {hasSipOptions && (
                            <>
                                <div className="my-1 border-t border-[var(--border)]" />
                                <button
                                    onClick={(e) => { e.preventDefault(); onToggleSipOnly(); }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                        isSipFilterEnabled && selectedSipMethods.size === 0
                                            ? 'bg-[var(--foreground)]/15 text-[var(--foreground)]'
                                            : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                                    }`}
                                >
                                    <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 border-[var(--border)]">
                                        {isSipFilterEnabled && selectedSipMethods.size === 0 && <Check size={12} className="text-[var(--foreground)]" />}
                                    </span>
                                    <span>SIP only</span>
                                </button>
                                {sortedSipMethods.map((method) => {
                                    const checked = selectedSipMethods.has(method);
                                    return (
                                        <button
                                            key={method}
                                            onClick={(e) => { e.preventDefault(); onToggleSipMethod(method); }}
                                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                                checked
                                                    ? 'bg-[var(--foreground)]/15 text-[var(--foreground)]'
                                                    : 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                                            }`}
                                        >
                                            <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 border-[var(--border)]">
                                                {checked && <Check size={12} className="text-[var(--foreground)]" />}
                                            </span>
                                            <span className="font-mono text-xs">SIP: {method}</span>
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

export default SipFilterDropdown;

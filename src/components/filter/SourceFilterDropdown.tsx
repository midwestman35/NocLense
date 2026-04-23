import { useState, useRef, useEffect } from 'react';
import { Database, X, Check } from 'lucide-react';

const SOURCE_COLORS: Record<string, string> = {
  'Datadog': 'bg-violet/20 text-violet border-violet/30',
  'Homer SIP': 'bg-cyan/20 text-cyan border-cyan/30',
  'Call Log': 'bg-amber/20 text-amber border-amber/30',
  'FDX': 'bg-cyan/20 text-cyan border-cyan/30',
  'CCS/PBX': 'bg-mint/20 text-mint border-mint/30',
  'APEX Local': 'bg-amber/20 text-amber border-amber/30',
};

interface SourceFilterDropdownProps {
  sources: string[];
  selected: string | null;
  onSelect: (source: string | null) => void;
}

export default function SourceFilterDropdown({ sources, selected, onSelect }: SourceFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
          className="absolute top-full left-0 mt-1 z-[60] min-w-[160px] rounded-lg border shadow-[var(--shadow-raised)] py-1"
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
                SOURCE_COLORS[src]?.split(' ')[0] || 'bg-ink-3'
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

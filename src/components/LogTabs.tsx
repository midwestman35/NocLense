import { useMemo, useRef } from 'react';

export interface LogTabItem {
  fileName: string;
  count: number;
}

interface LogTabsProps {
  items: LogTabItem[];
  activeTab: string | null;
  allCount: number;
  onSelect: (fileName: string | null) => void;
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 3)}...`;
}

export default function LogTabs({
  items,
  activeTab,
  allCount,
  onSelect,
}: LogTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = useMemo(
    () => [{ fileName: null, label: 'All', count: allCount }, ...items.map((item) => ({
      fileName: item.fileName,
      label: truncateLabel(item.fileName, 24),
      count: item.count,
    }))],
    [allCount, items],
  );

  if (items.length < 2) return null;

  const focusTab = (index: number): void => {
    const target = buttonRefs.current[(index + tabs.length) % tabs.length];
    target?.focus();
  };

  return (
    <div
      className="border-b border-[var(--border)] bg-[var(--card)] px-3"
      role="tablist"
      aria-label="Log sources"
      data-testid="log-tabs"
    >
      <div className="flex min-w-0 gap-1 overflow-x-auto py-2 no-scrollbar">
        {tabs.map((tab, index) => {
          const isActive = tab.fileName === activeTab;
          return (
            <button
              key={tab.fileName ?? '__all__'}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              data-testid={`log-tab-${tab.fileName ?? 'all'}`}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-2 py-1 text-xs transition-colors ${
                isActive
                  ? 'border-[var(--ring)] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => onSelect(tab.fileName)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  focusTab(index + 1);
                  return;
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  focusTab(index - 1);
                  return;
                }
                if (event.key === 'Home') {
                  event.preventDefault();
                  focusTab(0);
                  return;
                }
                if (event.key === 'End') {
                  event.preventDefault();
                  focusTab(tabs.length - 1);
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(tab.fileName);
                }
              }}
            >
              <span className="max-w-[18ch] truncate" title={tab.fileName ?? 'All files'}>
                {tab.label}
              </span>
              <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {tab.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

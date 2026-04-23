import { useEffect, useMemo, useState, type JSX } from 'react';
import { Badge, Icon, ScrollArea } from '../ui';

export type AuthFeedTone = 'mint' | 'amber' | 'violet' | 'ink';

export interface AuthFeedItem {
  timestamp: string;
  kind: string;
  message: string;
  tone: AuthFeedTone;
}

interface AuthStatusFeedProps {
  items: AuthFeedItem[];
}

const TONE_CLASS_MAP: Record<AuthFeedTone, string> = {
  mint: 'text-[var(--mint)]',
  amber: 'text-[var(--amber)]',
  violet: 'text-[var(--violet)]',
  ink: 'text-[var(--ink-1)]',
};

export function AuthStatusFeed({ items }: AuthStatusFeedProps): JSX.Element {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (items.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRotation((current) => (current + 1) % items.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [items.length]);

  const visibleItems = useMemo(() => {
    return items.map((_, index) => items[(index + rotation) % items.length]);
  }, [items, rotation]);

  return (
    <div className="glass rounded-[var(--radius-panel)] border border-[var(--line)] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)] animate-phase-pulse" />
        <h2 className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-2)]">Live ops feed</h2>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.12em]">
            pdt
          </Badge>
          <Icon name="activity" size={14} className="text-[var(--mint)]" />
        </div>
      </div>

      <ScrollArea maxHeight="220px" className="pr-1">
        <div className="space-y-2.5">
          {visibleItems.map((item, index) => (
            <div
              key={`${item.timestamp}-${item.kind}`}
              className="grid grid-cols-[68px_72px_minmax(0,1fr)] items-start gap-3 text-[11.5px]"
              style={{ opacity: 1 - index * 0.14 }}
            >
              <span className="mono text-[var(--ink-3)]">{item.timestamp}</span>
              <span className={`mono text-[10px] uppercase tracking-[0.12em] ${TONE_CLASS_MAP[item.tone]}`}>
                {item.kind}
              </span>
              <span className="min-w-0 truncate text-[var(--ink-1)]">{item.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

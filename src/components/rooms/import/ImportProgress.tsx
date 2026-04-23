import type { JSX } from 'react';
import { Badge, Card, CardContent, Icon } from '../../ui';

interface ImportProgressProps {
  progress: number;
  streaming: boolean;
}

export function ImportProgress({ progress, streaming }: ImportProgressProps): JSX.Element | null {
  if (progress <= 0 || progress >= 1) {
    return null;
  }

  const percent = Math.round(progress * 100);

  return (
    <Card className="border-[var(--line)] bg-[rgba(255,255,255,0.02)]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name={streaming ? 'db' : 'import'} size={14} stroke="var(--mint)" />
            <div>
              <p className="text-sm font-medium text-[var(--ink-0)]">
                {streaming ? 'Streaming import in progress' : 'Import in progress'}
              </p>
              <p className="text-xs text-[var(--ink-3)]">
                {streaming
                  ? 'Large-file chunks are streaming into IndexedDB through the Tauri file stream.'
                  : 'Parsing and correlating selected files.'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.14em]">
            {percent}%
          </Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--mint),rgba(142,240,183,0.55))] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

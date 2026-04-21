import type { CSSProperties } from 'react';
import { Badge } from '../../../ui/Badge';
import type { HypothesisStatus } from '../../../../types/canonical';

interface StatusChipProps {
  status: HypothesisStatus;
}

const STATUS_LABELS: Record<HypothesisStatus, string> = {
  CONFIRMED: 'Confirmed',
  RULED_OUT: 'Ruled Out',
  INCONCLUSIVE: 'Inconclusive',
};

const STATUS_STYLES: Record<HypothesisStatus, CSSProperties> = {
  CONFIRMED: {
    backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)',
    color: 'var(--success)',
    boxShadow: 'var(--shadow-glow-ready)',
  },
  RULED_OUT: {
    backgroundColor: 'color-mix(in srgb, var(--destructive) 14%, transparent)',
    color: 'var(--destructive)',
    boxShadow: 'var(--shadow-glow-error)',
  },
  INCONCLUSIVE: {
    backgroundColor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    boxShadow: 'none',
  },
};

export default function StatusChip({ status }: StatusChipProps) {
  return (
    <Badge
      aria-label={`Status: ${STATUS_LABELS[status].toLowerCase()}`}
      data-status={status}
      className="uppercase tracking-[0.08em]"
      style={STATUS_STYLES[status]}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

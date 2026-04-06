import { clsx } from 'clsx';

interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  lines = 1,
  className,
}: SkeletonProps) {
  const baseClass = 'animate-shimmer bg-gradient-to-r from-[var(--muted)] via-[var(--accent)] to-[var(--muted)] bg-[length:200%_100%]';

  if (variant === 'text' && lines > 1) {
    return (
      <div className={clsx('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={clsx(baseClass, 'rounded-[var(--radius-sm)]')}
            style={{
              width: i === lines - 1 ? '60%' : '100%',
              height: height ?? 12,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        baseClass,
        variant === 'circular' ? 'rounded-full' : 'rounded-[var(--radius-sm)]',
        className
      )}
      style={{ width: width ?? '100%', height: height ?? (variant === 'text' ? 12 : 24) }}
    />
  );
}

/** Skeleton mimicking a log row (35px height) */
export function SkeletonLogRow() {
  return (
    <div className="flex items-center gap-3 px-2 h-[var(--log-row-height)] border-b border-[var(--border)]">
      <Skeleton width={28} height={12} />
      <Skeleton width={110} height={12} />
      <Skeleton width={48} height={16} variant="rectangular" className="rounded-full" />
      <Skeleton width={80} height={12} />
      <Skeleton className="flex-1" height={12} />
    </div>
  );
}

/** Skeleton for the filter bar area */
export function SkeletonFilterBar() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton width={280} height={36} className="rounded-[var(--radius-md)]" />
      <Skeleton width={60} height={24} className="rounded-full" />
      <Skeleton width={60} height={24} className="rounded-full" />
      <Skeleton width={60} height={24} className="rounded-full" />
    </div>
  );
}

/** Skeleton for AI panel loading state */
export function SkeletonAiPanel() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <Skeleton height={20} width="40%" />
      <Skeleton variant="text" lines={3} height={14} />
      <div className="flex gap-2 mt-2">
        <Skeleton width={80} height={32} className="rounded-[var(--radius-md)]" />
        <Skeleton width={80} height={32} className="rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

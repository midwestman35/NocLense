import React from 'react';

interface LogHistogramProps {
  bars?: number;
  accent?: string;
  height?: number;
  seed?: number;
}

export function LogHistogram({
  bars = 48,
  accent = 'var(--mint)',
  height = 36,
  seed = 0,
}: LogHistogramProps) {
  const [tick, setTick] = React.useState(0);
  const barCount = Math.max(1, Math.floor(bars));

  React.useEffect(() => {
    const id = setInterval(() => setTick((current) => current + 1), 800);
    return () => clearInterval(id);
  }, []);

  const values = React.useMemo(() => {
    const next: number[] = [];

    for (let index = 0; index < barCount; index += 1) {
      const signal = Math.sin(index * 0.6 + seed) * 0.5 + 0.5;
      const noise = (Math.sin(index * 1.3 + seed * 0.7) * 0.5 + 0.5) * 0.4;
      next.push(Math.max(0.08, signal * 0.6 + noise));
    }

    return next;
  }, [barCount, seed]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        width: '100%',
        height,
      }}
      aria-hidden="true"
    >
      {values.map((value, index) => {
        const active = ((index + tick) % barCount) < 3;

        return (
          <div
            key={index}
            style={{
              flex: 1,
              height: `${value * 100}%`,
              background: active ? accent : 'rgba(255,255,255,0.10)',
              borderRadius: 1,
              boxShadow: active ? `0 0 6px ${accent}` : 'none',
              transition: 'background .4s, box-shadow .4s',
            }}
          />
        );
      })}
    </div>
  );
}

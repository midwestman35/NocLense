interface SparkProps {
  data?: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
}

export function Spark({
  data = [3, 5, 4, 6, 8, 6, 9, 7, 11, 9, 12, 10],
  color = 'var(--mint)',
  w = 72,
  h = 22,
  fill = true,
}: SparkProps) {
  const values = data.length > 0 ? data : [0];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const y = h - ((value - min) / (max - min || 1)) * (h - 2) - 1;
    return [index * step, y];
  });
  const path = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

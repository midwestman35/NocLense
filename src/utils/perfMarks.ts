type PerfMark = {
  name: string;
  t: number;
  meta?: Record<string, unknown>;
};

const IS_DEV = import.meta.env.DEV;
const marks: PerfMark[] = [];
let exposed = false;

function exposeIfNeeded(): void {
  if (exposed || typeof window === 'undefined') return;
  exposed = true;
  (window as unknown as { __dumpImportPerf?: () => void }).__dumpImportPerf = dumpImportPerf;
  (window as unknown as { __resetImportPerf?: () => void }).__resetImportPerf = resetImportPerf;
}

export function markImport(name: string, meta?: Record<string, unknown>): void {
  if (!IS_DEV) return;
  marks.push({ name, t: performance.now(), meta });
  exposeIfNeeded();
}

export function resetImportPerf(): void {
  marks.length = 0;
}

export function dumpImportPerf(): PerfMark[] {
  if (marks.length === 0) {
    console.log('[perfMarks] no marks recorded');
    return [];
  }
  const start = marks[0].t;
  const rows = marks.map((mark, index) => {
    const prev = index === 0 ? mark.t : marks[index - 1].t;
    return {
      name: mark.name,
      'Δ prev (ms)': (mark.t - prev).toFixed(1),
      't+start (ms)': (mark.t - start).toFixed(1),
      meta: mark.meta ? JSON.stringify(mark.meta) : '',
    };
  });
  console.table(rows);
  return [...marks];
}

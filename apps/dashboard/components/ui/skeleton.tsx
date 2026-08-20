// ─── Base Skeleton ────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} style={style} />;
}

// ─── KPI Card Skeleton ────────────────────────────────────────────────────────
// Mirrors the real KPI card exactly: p-5 / rounded-xl / border-slate-200 /
// shadow-xs shell, label+value+trend stacked on the left, a 10x10 icon
// box pinned to the right at the same height as the whole text block.
export function KpiCardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-24 mt-1" />
        <Skeleton className="h-3 w-28 mt-1.5" />
      </div>
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
    </div>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────
// Fixed at h-[52px] with px-5 cells to match the real order rows exactly —
// otherwise the table visibly grows/shifts columns the moment data lands.
export function TableRowSkeleton({
  cols,
  delay = 0,
}: {
  cols: { w: string; pill?: boolean }[];
  delay?: number;
}) {
  return (
    <tr className="h-[52px]">
      {cols.map((col, i) => (
        <td key={i} className="px-5">
          <div
            className={`skeleton-shimmer ${col.pill ? 'rounded-full h-6' : 'rounded h-3.5'} ${col.w}`}
            style={{ animationDelay: `${delay}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Chart / Bar Skeleton ─────────────────────────────────────────────────────
// Reserves the same left/bottom gutter Recharts' YAxis/XAxis actually take up
// (~32px tick-label column, ~20px tick-label row) so the plot area doesn't
// visibly narrow and shift down the instant the real chart mounts.
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  const bars = [55, 80, 40, 95, 60, 75, 50];
  const plotHeight = height - 20;
  return (
    <div className="w-full flex items-stretch gap-2" style={{ height }}>
      <div className="flex flex-col justify-between shrink-0 w-8 pb-5" style={{ height: plotHeight }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-2 w-6" />
        ))}
      </div>
      <div className="relative flex-1 flex items-end gap-[5%] pb-5" style={{ height: plotHeight }}>
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ bottom: `${pct}%` }}
          />
        ))}
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 skeleton-shimmer rounded-t"
            style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

import { AlertCircle } from 'lucide-react';

// ─── Inline Error (no red borders ever) ──────────────────────────────────────
export function InlineError({
  message = 'Could not load data',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return <SectionError onRetry={onRetry as () => void} />;
}

// ─── Section Error ──────────────────────────────────────────────────────────
export function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-gray-300" />
      </div>
      <p className="text-sm text-gray-400">Could not load data</p>
      <button
        onClick={onRetry}
        className="text-sm text-orange-500 hover:text-orange-600 font-medium underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

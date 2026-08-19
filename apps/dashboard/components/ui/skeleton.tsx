// ─── Base Skeleton ────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} style={style} />;
}

// ─── KPI Card Skeleton ────────────────────────────────────────────────────────
export function KpiCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28 mt-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────
export function TableRowSkeleton({
  cols,
  delay = 0,
}: {
  cols: { w: string; pill?: boolean }[];
  delay?: number;
}) {
  return (
    <tr>
      {cols.map((col, i) => (
        <td key={i} className="px-4 py-3.5">
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
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  const bars = [55, 80, 40, 95, 60, 75, 50];
  return (
    <div className="w-full relative flex items-end gap-[5%] px-2 pb-4" style={{ height }}>
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

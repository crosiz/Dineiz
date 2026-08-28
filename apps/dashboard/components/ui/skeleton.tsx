// ─────────────────────────────────────────────────────────────────────────────
// Skeletons — the single loading vocabulary for the whole dashboard.
//
// Rules of the road:
//   • One shimmer, everywhere. Every placeholder is a <Skeleton> (the
//     `.skeleton-shimmer` gradient sweep in globals.css). Never `animate-pulse`
//     on a bare coloured div — the two treatments look different side by side
//     and that mismatch is exactly what reads as unfinished.
//   • A skeleton mirrors the real thing it stands in for — same card shell,
//     same row height, same column count — so content lands without the layout
//     jumping.
//   • Circular spinners are for buttons and tiny "working…" states only
//     (see <Spinner> in ./Spinner). A screen or panel waiting on its first
//     data render shows a skeleton, not a spinner.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

// ─── Base ────────────────────────────────────────────────────────────────────
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`skeleton-shimmer rounded-md ${className}`} style={style} />;
}

// A stack of text lines — last line shortened so it reads as a paragraph.
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: i === lines - 1 ? '55%' : '100%', animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
// Matches the h1 + subtitle + primary-action row every top-level screen has.
export function SkeletonHeader({ actions = 1, className = '' }: { actions?: number; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="space-y-2.5">
        <Skeleton className="h-6 w-52 max-w-[50vw]" />
        <Skeleton className="h-3.5 w-72 max-w-[70vw]" />
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat / KPI cards ────────────────────────────────────────────────────────
// The compact summary card used above most tables: label + one big number.
const STAT_GRID: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
  6: 'grid-cols-2 lg:grid-cols-6',
};

export function SkeletonStatCards({
  count = 4,
  columns,
  className = '',
}: {
  count?: number;
  columns?: number;
  className?: string;
}) {
  const grid = STAT_GRID[columns ?? count] ?? STAT_GRID[4];
  return (
    <div className={`grid ${grid} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-20 mt-2.5" />
        </div>
      ))}
    </div>
  );
}

// The taller home-dashboard KPI card: label / value / trend on the left, a
// square icon tile pinned right.
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

export function SkeletonKpiRow({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────────
// `boxed` = the white card the search + segmented pills sit in on list pages.
export function SkeletonFilterBar({ boxed = false, className = '' }: { boxed?: boolean; className?: string }) {
  const inner = (
    <>
      <Skeleton className="h-8 w-64 max-w-[50vw]" />
      <div className="flex-1" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-24" />
    </>
  );
  if (boxed) {
    return (
      <div className={`flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex-wrap ${className}`}>
        {inner}
      </div>
    );
  }
  return <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>{inner}</div>;
}

// ─── Tables ──────────────────────────────────────────────────────────────────
export type SkeletonColumn =
  | number // width in px
  | { w: number; align?: 'left' | 'right'; pill?: boolean; avatar?: boolean };

const DEFAULT_COLS: SkeletonColumn[] = [{ w: 180, avatar: true }, 88, 120, 96, { w: 64, align: 'right' }];

function normalizeCol(c: SkeletonColumn) {
  return typeof c === 'number' ? { w: c, align: 'left' as const, pill: false, avatar: false } : {
    align: 'left' as const,
    pill: false,
    avatar: false,
    ...c,
  };
}

function SkeletonCell({ col, delay }: { col: ReturnType<typeof normalizeCol>; delay: number }) {
  return (
    <td className="px-5 py-3">
      <div className={`flex items-center gap-2.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
        {col.avatar && <Skeleton className="w-7 h-7 rounded-full shrink-0" style={{ animationDelay: `${delay}ms` }} />}
        <Skeleton
          className={col.pill ? 'h-6 rounded-full' : 'h-3.5'}
          style={{ width: col.w, animationDelay: `${delay}ms` }}
        />
      </div>
    </td>
  );
}

// Bare <tr> rows for dropping into a table whose <thead> is already rendered
// (the real header stays, only the body is a placeholder — no layout shift).
export function SkeletonTableRows({
  rows = 8,
  columns = DEFAULT_COLS,
}: {
  rows?: number;
  columns?: SkeletonColumn[];
}) {
  const cols = columns.map(normalizeCol);
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="h-[52px] border-b border-slate-100 last:border-0">
          {cols.map((col, c) => (
            <SkeletonCell key={c} col={col} delay={r * 40 + c * 20} />
          ))}
        </tr>
      ))}
    </>
  );
}

// The whole table — card shell, header row, body rows. For a page area that
// renders no <table> of its own until data arrives.
export function SkeletonTable({
  rows = 8,
  columns = DEFAULT_COLS,
  className = '',
}: {
  rows?: number;
  columns?: SkeletonColumn[];
  className?: string;
}) {
  const cols = columns.map(normalizeCol);
  return (
    <div className={`rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs ${className}`}>
      <div className="h-11 border-b border-slate-200 bg-slate-50/60 flex items-center gap-6 px-5">
        {cols.map((col, i) => (
          <Skeleton key={i} className="h-2.5" style={{ width: Math.min(col.w, 96) }} />
        ))}
      </div>
      <table className="w-full">
        <tbody>
          <SkeletonTableRows rows={rows} columns={columns} />
        </tbody>
      </table>
    </div>
  );
}

// Back-compat: the home dashboard passes `cols: { w: string; pill?: boolean }[]`.
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
          <Skeleton
            className={`${col.pill ? 'rounded-full h-6' : 'h-3.5'} ${col.w}`}
            style={{ animationDelay: `${delay}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Card grid ───────────────────────────────────────────────────────────────
export function SkeletonCardGrid({
  count = 6,
  columns = 3,
  lines = 3,
  media = false,
  className = '',
  cardClassName = '',
}: {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  lines?: number;
  media?: boolean;
  className?: string;
  cardClassName?: string;
}) {
  const colClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs ${cardClassName}`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {media && <Skeleton className="h-28 w-full mb-4" />}
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-6 w-3/5 mt-3" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: lines }).map((_, j) => (
              <Skeleton key={j} className="h-3" style={{ width: j === lines - 1 ? '60%' : '100%' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── List ────────────────────────────────────────────────────────────────────
// Stacked bordered rows — the shape of the deal / sync-issue / subscription
// lists that aren't tables.
export function SkeletonList({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-xs"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────
export function SkeletonForm({
  rows = 5,
  columns = 1,
  className = '',
}: {
  rows?: number;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={`grid gap-x-6 gap-y-5 ${columns === 2 ? 'sm:grid-cols-2' : 'max-w-2xl'} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Chart ───────────────────────────────────────────────────────────────────
// Reserves the same axis gutters Recharts takes so the plot area doesn't jump
// when the real chart mounts.
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  const bars = [55, 80, 40, 95, 60, 75, 50];
  const plotHeight = height - 20;
  return (
    <div className="w-full flex items-stretch gap-2" style={{ height }} aria-hidden>
      <div className="flex flex-col justify-between shrink-0 w-8 pb-5" style={{ height: plotHeight }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-2 w-6" />
        ))}
      </div>
      <div className="relative flex-1 flex items-end gap-[5%] pb-5" style={{ height: plotHeight }}>
        {[20, 40, 60, 80].map((pct) => (
          <div key={pct} className="absolute left-0 right-0 border-t border-slate-100" style={{ bottom: `${pct}%` }} />
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

// A chart in its titled white card.
export function SkeletonChartCard({ height = 240, title = true }: { height?: number; title?: boolean }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
      {title && (
        <div className="mb-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-[60vw]" />
        </div>
      )}
      <ChartSkeleton height={height} />
    </div>
  );
}

// ─── Detail / slide-over ─────────────────────────────────────────────────────
// Section cards stacked in a column — order detail, customer profile, etc.
export function SkeletonDetail({ sections = 3, className = '' }: { sections?: number; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs" style={{ animationDelay: `${i * 60}ms` }}>
          <Skeleton className="h-3 w-32" />
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page composer ───────────────────────────────────────────────────────────
type PageVariant = 'stats-table' | 'table' | 'cards' | 'form' | 'tabs' | 'analytics' | 'split' | 'detail';

// The default first-paint for a whole screen. `header` off when the caller
// already renders its real <h1> above this (a tab panel, a table cell).
export function PageSkeleton({
  header = true,
  actions = 1,
  variant = 'stats-table',
  rows = 8,
  columns,
  label,
  className = '',
}: {
  header?: boolean;
  actions?: number;
  variant?: PageVariant;
  rows?: number;
  columns?: SkeletonColumn[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={`w-full space-y-6 ${className}`} role="status" aria-busy="true">
      <span className="sr-only">{label || 'Loading'}</span>
      {header && <SkeletonHeader actions={actions} />}

      {variant === 'form' && <SkeletonForm rows={Math.max(rows, 4)} />}

      {variant === 'tabs' && (
        <>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
            {[64, 72, 60, 68].map((w, i) => (
              <Skeleton key={i} className="h-7" style={{ width: w }} />
            ))}
          </div>
          <SkeletonForm rows={Math.max(rows, 4)} columns={2} />
        </>
      )}

      {variant === 'cards' && <SkeletonCardGrid count={Math.max(rows, 6)} />}

      {variant === 'analytics' && (
        <>
          <SkeletonStatCards count={4} />
          <SkeletonChartCard height={320} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonChartCard height={240} />
            <SkeletonChartCard height={240} />
          </div>
        </>
      )}

      {variant === 'detail' && <SkeletonDetail />}

      {variant === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonForm rows={Math.max(rows, 5)} />
          </div>
          <SkeletonCardGrid count={2} columns={1} />
        </div>
      )}

      {variant === 'table' && (
        <>
          <SkeletonFilterBar />
          <SkeletonTable rows={rows} columns={columns} />
        </>
      )}

      {variant === 'stats-table' && (
        <>
          <SkeletonStatCards count={4} />
          <SkeletonFilterBar boxed />
          <SkeletonTable rows={rows} columns={columns} />
        </>
      )}
    </div>
  );
}

// ─── Errors ──────────────────────────────────────────────────────────────────
export function SectionError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">Could not load data</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-orange-500 hover:text-orange-600 font-medium underline underline-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  // `message` kept for call-site compatibility; SectionError owns the copy.
  void message;
  return <SectionError onRetry={onRetry} />;
}

// Circular progress lives here — and ONLY for buttons and tiny inline
// "working…" states. Anything waiting on its first data render (a screen, a
// panel, a tab body, a table) shows a skeleton instead: see
// ./skeleton and <PageLoader> / <InlineLoader> below, which now delegate there.
import {
  PageSkeleton,
  SkeletonList,
  type SkeletonColumn,
} from './skeleton';

// Clean two-tone ring spinner — a soft brand-color track with a solid
// brand-color arc rotating on top of it. Ties to --color-primary so it
// follows tenant white-label branding automatically.
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  const border = Math.max(2, Math.round(size / 9));
  return (
    <span
      className={`inline-block shrink-0 rounded-full animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
        borderTopColor: 'var(--color-primary)',
        animationDuration: '0.7s',
      }}
    />
  );
}

// ─── PageLoader ──────────────────────────────────────────────────────────────
// The shared first-paint for a whole screen. Thin wrapper over <PageSkeleton>
// so existing call sites keep working; pass `header={false}` when the caller
// already renders its real <h1> above this (a tab panel, a table cell).
type PageLoaderVariant = 'table' | 'cards' | 'form' | 'tabs' | 'analytics' | 'split' | 'detail';

export function PageLoader({
  label,
  className = '',
  variant = 'table',
  rows = 8,
  header = true,
  columns,
}: {
  label?: string;
  className?: string;
  variant?: PageLoaderVariant;
  rows?: number;
  header?: boolean;
  columns?: SkeletonColumn[];
}) {
  return (
    <PageSkeleton
      label={label}
      className={className}
      variant={variant}
      rows={rows}
      header={header}
      columns={columns}
    />
  );
}

// Inline placeholder — for a section inside a page that already has its own
// heading rendered (narrow report views, sub-panels). A quiet skeleton list,
// never a spinner, so it matches everything around it.
export function InlineLoader({ label = 'Loading', className = '', rows = 3 }: { label?: string; className?: string; rows?: number }) {
  return (
    <div className={`w-full ${className}`} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <SkeletonList rows={rows} />
    </div>
  );
}

// Full viewport — the moment between a successful sign-in and the dashboard
// mounting. A genuine app-shell transition (no content to placeholder yet),
// so a spinner is the right call here specifically.
export function FullScreenLoader({ label = 'Loading your dashboard' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full gap-4" style={{ background: '#F8FAFC' }}>
      <Spinner size={36} />
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

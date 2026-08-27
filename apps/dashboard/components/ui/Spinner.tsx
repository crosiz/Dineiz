// Clean two-tone ring spinner — a soft brand-color track with a solid
// brand-color arc rotating on top of it. Reads as calmer/more premium than
// a spinning icon, and ties directly to --color-primary so it follows
// tenant white-label branding automatically. Keep this for buttons and
// inline "working…" states; for a whole screen or panel loading, use
// <PageLoader/> so every screen looks identical.
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
// The ONE shared page/section loading treatment. Every screen that is waiting
// on its first data render returns this, so the loading state is always the
// same shape in the same place — top-aligned in the content column, never a
// spinner floating in the middle of the viewport. The moving "activity" cue
// during navigation is the global top bar (NavigationProgress); this is just
// the calm placeholder underneath it.
type PageLoaderVariant = 'table' | 'cards' | 'form';

function Bar({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} style={style} />;
}

export function PageLoader({
  label,
  className = '',
  variant = 'table',
  rows = 7,
}: {
  label?: string;
  className?: string;
  variant?: PageLoaderVariant;
  rows?: number;
}) {
  return (
    <div className={`w-full ${className}`} role="status" aria-busy="true">
      <span className="sr-only">{label || 'Loading'}</span>

      {/* Header — matches the h1 + subtitle + primary action every screen has */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2.5">
          <Bar className="h-6 w-52" />
          <Bar className="h-3.5 w-72 max-w-[60vw]" />
        </div>
        <Bar className="h-9 w-32 shrink-0" />
      </div>

      {variant === 'form' ? (
        <div className="max-w-2xl space-y-6">
          {Array.from({ length: Math.max(4, rows) }).map((_, i) => (
            <div key={i} className="space-y-2" style={{ animationDelay: `${i * 60}ms` }}>
              <Bar className="h-3 w-32" />
              <Bar className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : variant === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: Math.max(6, rows) }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Bar className="h-4 w-24" />
              <Bar className="h-7 w-32" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <Bar className="h-9 w-56" />
            <Bar className="h-9 w-32" />
            <Bar className="h-9 w-28" />
            <Bar className="h-9 w-28" />
          </div>
          {/* Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="h-11 border-b border-slate-200 bg-slate-50/60 flex items-center gap-6 px-5">
              {[16, 24, 20, 16, 20].map((w, i) => (
                <Bar key={i} className="h-2.5" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="h-[52px] border-b border-slate-100 last:border-0 flex items-center gap-6 px-5"
              >
                {[16, 24, 20, 16, 20].map((w, j) => (
                  <Bar
                    key={j}
                    className="h-3"
                    style={{ width: `${w * 4}px`, animationDelay: `${i * 40}ms` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Inline "working…" row — for a section inside a page that already has its own
// heading rendered (narrow report views, sub-panels). Kept deliberately quiet
// so it never competes with the global top progress bar.
export function InlineLoader({ label = 'Loading', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-sm text-slate-400 ${className}`} role="status" aria-busy="true">
      <Spinner size={15} />
      <span>{label}</span>
    </div>
  );
}

// Full viewport — for the moment between a successful sign-in and the
// dashboard mounting, or any other whole-screen transition.
export function FullScreenLoader({ label = 'Loading your dashboard' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full gap-4" style={{ background: '#F8FAFC' }}>
      <Spinner size={36} />
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

// The one shared screen/section loading treatment for the POS. A screen that
// is waiting on its first data render returns this, so the loading state is
// always the same shape in the same place — never a spinner floating in the
// middle of the terminal. The moving cue during navigation is the global top
// bar (NavigationProgress); this is the calm placeholder underneath it.
type ScreenLoaderVariant = 'list' | 'grid' | 'panel';

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded-lg bg-[var(--pos-bg-hover,#E2E8F0)] animate-pulse ${className}`} />;
}

export function ScreenLoader({
  label,
  variant = 'list',
  className = '',
}: {
  label?: string;
  variant?: ScreenLoaderVariant;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 min-h-0 overflow-hidden p-5 bg-[var(--pos-bg-base,#F8FAFC)] ${className}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label || 'Loading'}</span>

      {/* header strip — title + a couple of controls, like every screen has */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <Bar className="h-6 w-44" />
        <div className="flex gap-2">
          <Bar className="h-8 w-24" />
          <Bar className="h-8 w-8" />
        </div>
      </div>

      {variant === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Bar key={i} className="h-24" />
          ))}
        </div>
      ) : variant === 'panel' ? (
        <div className="max-w-xl space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-14 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}

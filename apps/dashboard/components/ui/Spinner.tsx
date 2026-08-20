// Clean two-tone ring spinner — a soft brand-color track with a solid
// brand-color arc rotating on top of it. Reads as calmer/more premium than
// a spinning icon, and ties directly to --color-primary so it follows
// tenant white-label branding automatically.
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

// Fills its parent container — for a section, panel, or table that's loading.
export function PageLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`h-full min-h-[240px] w-full flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={30} />
      {label && <p className="text-sm font-medium text-slate-400">{label}</p>}
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

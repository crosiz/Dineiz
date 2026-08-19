import { Loader2 } from 'lucide-react';
import { DineizLogo } from './DineizLogo';

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-primary ${className}`} />;
}

// Fills its parent container — for a section, panel, or table that's loading.
export function PageLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`h-full min-h-[240px] w-full flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={26} />
      {label && <p className="text-sm font-medium text-slate-400">{label}</p>}
    </div>
  );
}

// Full viewport — for the moment between a successful sign-in and the
// dashboard mounting, or any other whole-screen transition.
export function FullScreenLoader({ label = 'Loading your dashboard' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full gap-6" style={{ background: '#F8FAFC' }}>
      <DineizLogo size="lg" variant="light" showWordmark={false} />
      <div className="flex flex-col items-center gap-3">
        <Spinner size={22} />
        <p className="text-sm font-medium text-slate-400">{label}</p>
      </div>
    </div>
  );
}

'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Shown when a fetch genuinely failed, so it never looks identical to a
 * screen that's just legitimately empty. Pass `onRetry` to refetch in place.
 */
export function ErrorState({
  message = "Something went wrong loading this.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
        <AlertTriangle size={18} className="text-red-500" />
      </div>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff5722] hover:underline"
        >
          <RefreshCw size={13} /> Try again
        </button>
      )}
    </div>
  );
}

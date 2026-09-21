"use client";

import { ServerCrash } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Logo size={32} />
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-tint">
          <ServerCrash className="h-6 w-6 text-danger" strokeWidth={1.5} />
        </span>
        <h1 className="text-lg font-semibold text-text-1">Something went wrong</h1>
        <p className="max-w-sm text-sm text-text-2">
          This screen hit an unexpected error. Your order data is safe — try again, and contact support if it keeps happening.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Try Again
      </button>
    </div>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";
import { DineizLogo } from "@/components/ui/DineizLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <DineizLogo size="md" />
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-panel">
          <SearchX className="h-6 w-6 text-text-3" strokeWidth={1.5} />
        </span>
        <h1 className="text-lg font-semibold text-text-1">Page not found</h1>
        <p className="max-w-sm text-sm text-text-2">
          The screen you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

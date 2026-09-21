import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Logo size={32} />
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-tint">
          <ShieldAlert className="h-6 w-6 text-warning" strokeWidth={1.5} />
        </span>
        <h1 className="text-lg font-semibold text-text-1">You don&rsquo;t have access to this page</h1>
        <p className="max-w-sm text-sm text-text-2">
          Your role doesn&rsquo;t include permission for this module. Ask a Branch Manager or Tenant Admin if you need access.
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

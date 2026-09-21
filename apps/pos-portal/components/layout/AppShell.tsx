import { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-bg">
      <Suspense fallback={<div className="h-screen w-[260px] shrink-0 border-r border-border bg-panel" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 shrink-0 border-b border-border bg-bg" />}>
          <TopBar />
        </Suspense>
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
      </div>
    </div>
  );
}

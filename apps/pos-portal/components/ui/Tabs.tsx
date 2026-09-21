"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabDef = { key: string; label: string };

export function Tabs({ tabs, paramName = "tab" }: { tabs: TabDef[]; paramName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? tabs[0]!.key;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-6">
      {tabs.map((tab) => {
        const isActive = tab.key === current;
        const href = tab.key === tabs[0]!.key ? pathname : `${pathname}?${paramName}=${tab.key}`;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "relative flex h-11 shrink-0 items-center px-3 text-[13px] font-medium transition-colors",
              isActive ? "text-text-1" : "text-text-2 hover:text-text-1"
            )}
          >
            {tab.label}
            {isActive && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-primary" />}
          </Link>
        );
      })}
    </div>
  );
}

export function useActiveTab(tabs: TabDef[], paramName = "tab"): string {
  const searchParams = useSearchParams();
  return searchParams.get(paramName) ?? tabs[0]!.key;
}

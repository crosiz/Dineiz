"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, CircleHelp, LogOut } from "lucide-react";
import { DineizLogo } from "@/components/ui/DineizLogo";
import { NAV_ITEMS, splitHref } from "@/lib/nav-config";
import { CURRENT_BRANCH, TENANT_NAME } from "@/mocks/session";
import { cn } from "@/lib/utils";
import { useLogout } from "@/lib/use-logout";
import { getDB } from "@/lib/db";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const logout = useLogout();
  const pendingCount = useLiveQuery(() => getDB().queuedPayments.where("syncStatus").anyOf(["pending", "syncing", "failed"]).count(), []) ?? 0;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of NAV_ITEMS) {
      const base = splitHref(item.href).path;
      if (item.children && (pathname === base || pathname.startsWith(base + "/"))) {
        initial[item.label] = true;
      }
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside
      className="flex h-screen w-[260px] shrink-0 flex-col border-r border-border bg-panel px-3 py-4"
      aria-label="Primary navigation"
    >
      <div className="mb-4 px-2">
        <DineizLogo size="md" />
      </div>

      <button
        type="button"
        className="mb-4 flex items-center gap-2.5 rounded-md border border-border p-2 text-left transition-colors hover:bg-hover"
      >
        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold"
          style={{ background: CURRENT_BRANCH.avatarBg, color: CURRENT_BRANCH.avatarFg }}
        >
          {CURRENT_BRANCH.initials}
          <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-2 border-panel bg-success" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-text-1">
            {TENANT_NAME} · {CURRENT_BRANCH.name}
          </span>
          <span className="block text-[10.5px] text-text-3">Shift started 12:52 PM</span>
        </span>
        <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-text-3" strokeWidth={1.75} />
      </button>

      <nav className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const base = splitHref(item.href).path;
            const isParentActive = pathname === base || pathname.startsWith(base + "/");
            const Icon = item.icon;
            const isOpen = !!openGroups[item.label];

            return (
              <li key={item.label}>
                {item.children ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-[13px] transition-colors",
                      isParentActive ? "bg-primary-tint font-semibold text-text-1" : "text-text-2 hover:bg-hover"
                    )}
                  >
                    <Icon
                      className={cn("h-[18px] w-[18px] shrink-0", isParentActive ? "text-primary" : "text-text-2")}
                      strokeWidth={1.75}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn("h-3 w-3 shrink-0 text-text-3 transition-transform", isOpen && "rotate-180")}
                      strokeWidth={2}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-2.5 text-[13px] transition-colors",
                      isParentActive ? "bg-primary-tint font-semibold text-text-1" : "text-text-2 hover:bg-hover"
                    )}
                  >
                    <Icon
                      className={cn("h-[18px] w-[18px] shrink-0", isParentActive ? "text-primary" : "text-text-2")}
                      strokeWidth={1.75}
                    />
                    <span>{item.label}</span>
                  </Link>
                )}

                {item.children && isOpen && (
                  <ul className="flex flex-col py-0.5 pl-[44px]">
                    {item.children.map((child) => {
                      const cs = splitHref(child.href);
                      const isChildActive = pathname === cs.path && currentTab === cs.tab;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex h-[34px] items-center text-xs transition-colors",
                              isChildActive ? "font-semibold text-primary" : "text-text-2 hover:text-text-1"
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-2.5">
        <Link
          href="/sync-queue"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 text-xs transition-colors hover:bg-hover",
            pendingCount > 0 ? "text-warning" : "text-success"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", pendingCount > 0 ? "bg-warning" : "bg-success")} />
          {pendingCount > 0 ? `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}` : "All synced"}
        </Link>
        <Link
          href="/help"
          className="flex h-[34px] items-center gap-3 rounded-md px-2.5 text-xs text-text-2 transition-colors hover:bg-hover"
        >
          <CircleHelp className="h-4 w-4" strokeWidth={1.75} />
          Help &amp; Support
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex h-[34px] items-center gap-3 rounded-md px-2.5 text-left text-xs text-text-2 transition-colors hover:bg-hover"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </aside>
  );
}

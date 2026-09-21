"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  Keyboard,
  KeyRound,
  Lock,
  LogOut,
  Package,
  Receipt,
  Search,
  Settings2,
  Sun,
  Wallet,
} from "lucide-react";
import { getBreadcrumb } from "@/lib/nav-config";
import { CURRENT_USER } from "@/mocks/session";
import { useClickOutside } from "@/lib/use-click-outside";
import { useLogout } from "@/lib/use-logout";
import { cn } from "@/lib/utils";

type NotifKind = "order" | "stock" | "payment" | "approval";

const NOTIFICATIONS: { id: string; kind: NotifKind; text: string; time: string; unread?: boolean; group: "TODAY" | "YESTERDAY" }[] = [
  { id: "n1", kind: "order", text: "New order #A108 from Table T-04", time: "2 min ago", unread: true, group: "TODAY" },
  { id: "n2", kind: "stock", text: "Chicken stock below threshold", time: "38 min ago", group: "TODAY" },
  { id: "n3", kind: "payment", text: "Payment received for #A104", time: "1 hr ago", group: "TODAY" },
  { id: "n4", kind: "approval", text: "Manager approval used for a 20% discount", time: "Yesterday, 9:14 PM", group: "YESTERDAY" },
];

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TopBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { section, page } = getBreadcrumb(pathname, searchParams.get("tab"));
  const logout = useLogout();
  const now = useClock();

  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  useClickOutside(userRef, () => setUserOpen(false));
  useClickOutside(notifRef, () => setNotifOpen(false));

  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-border bg-bg px-5">
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px] text-text-2">
        <span>{section}</span>
        {page && page !== section && (
          <>
            <ChevronRight className="h-3 w-3 text-text-3" strokeWidth={2} />
            <span className="font-semibold text-text-1">{page}</span>
          </>
        )}
      </div>

      <div className="flex flex-1 justify-center">
        <button
          type="button"
          className="flex h-[34px] w-[340px] items-center gap-2 rounded-md border border-border bg-panel px-3 text-left transition-colors hover:bg-hover"
        >
          <Search className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
          <span className="flex-1 text-[13px] text-text-3">Search orders, items, customers…</span>
          <span className="tabular rounded border border-border bg-bg px-1.5 py-px text-[10px] text-text-3">⌘K</span>
        </button>
      </div>

      <div className="flex items-center gap-3.5 whitespace-nowrap">
        <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-panel py-0 pl-1.5 pr-2.5">
          <span
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: CURRENT_USER.avatarBg, color: CURRENT_USER.avatarFg }}
          >
            {CURRENT_USER.initials.slice(0, 2)}
          </span>
          <span className="text-xs font-semibold text-text-1">{CURRENT_USER.name.split(" ")[0]}</span>
        </div>

        <span className="tabular text-[13px] text-text-2">
          {now
            ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
            : "--:--:-- --"}
        </span>

        <span className="h-2 w-2 rounded-full bg-success" title="Online" />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-text-2 transition-colors hover:bg-hover"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="tabular absolute -right-1 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] overflow-hidden rounded-lg border border-border bg-bg shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                <span className="text-sm font-semibold text-text-1">Notifications</span>
                <button type="button" className="text-[11px] font-semibold text-primary">
                  Mark all read
                </button>
              </div>
              {(["TODAY", "YESTERDAY"] as const).map((group) => {
                const items = NOTIFICATIONS.filter((n) => n.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="border-t border-border px-4 pb-1.5 pt-3 text-[11px] text-text-3 first:border-t-0">
                      {group}
                    </div>
                    {items.map((n) => {
                      const Icon = n.kind === "order" ? Receipt : n.kind === "stock" ? Package : n.kind === "payment" ? Wallet : Lock;
                      const color =
                        n.kind === "order" ? "var(--primary)" : n.kind === "stock" ? "var(--warning)" : n.kind === "payment" ? "var(--success)" : "var(--text-2)";
                      return (
                        <div
                          key={n.id}
                          className={cn("flex gap-2.5 px-4 py-2.5", n.unread && "bg-primary-tint")}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} strokeWidth={1.75} />
                          <div>
                            <div className="text-[12.5px] text-text-1">{n.text}</div>
                            <div className="text-[11px] text-text-3">{n.time}</div>
                          </div>
                          {n.unread && <span className="ml-auto mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-80"
            style={{ background: CURRENT_USER.avatarBg, color: CURRENT_USER.avatarFg }}
            aria-label="User menu"
          >
            {CURRENT_USER.initials}
          </button>

          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] rounded-lg border border-border bg-bg p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="mb-1.5 flex items-center gap-2.5 border-b border-border px-2 pb-2.5 pt-1">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: CURRENT_USER.avatarBg, color: CURRENT_USER.avatarFg }}
                >
                  {CURRENT_USER.initials}
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-text-1">{CURRENT_USER.name}</div>
                  <span className="rounded bg-primary-tint px-[7px] py-px text-[10px] font-semibold text-primary">
                    {CURRENT_USER.roleLabel.toUpperCase()}
                  </span>
                </div>
              </div>

              <MenuItem icon={CircleUserRound} label="My Profile" />
              <MenuItem icon={KeyRound} label="Change PIN" />
              <MenuItem icon={Settings2} label="Preferences" />
              <MenuItem icon={Sun} label="Theme" trailing="Light" />
              <MenuItem icon={Keyboard} label="Keyboard Shortcuts" trailing="⌘/" />

              <div className="my-1.5 h-px bg-border" />

              <Link
                href="/lock"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-text-1 transition-colors hover:bg-hover"
              >
                <Lock className="h-3.5 w-3.5 text-text-2" strokeWidth={1.75} />
                Lock Terminal
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-danger transition-colors hover:bg-hover"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  trailing?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-text-1 transition-colors hover:bg-hover"
    >
      <Icon className="h-3.5 w-3.5 text-text-2" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {trailing && <span className="tabular text-[11px] text-text-3">{trailing}</span>}
    </button>
  );
}

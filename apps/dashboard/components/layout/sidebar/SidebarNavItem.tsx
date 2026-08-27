'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { navProgress } from '@/lib/nav-progress-store';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  badge?: React.ReactNode;
  onHover?: () => void;
}

export function SidebarNavItem({ href, icon, label, collapsed, badge, onHover }: NavItemProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const exactOnlyRoutes = ['/dashboard', '/dashboard/settings'];
  const isCurrent = exactOnlyRoutes.includes(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  // Light up on click, not when the route finally resolves — the highlight and
  // the top progress bar both move on the same frame as the click.
  const isActive = isCurrent || isPending;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return; // let the browser handle new-tab / modified clicks
    }
    e.preventDefault();
    if (isCurrent) return; // re-clicking the active tab is a no-op
    navProgress.start();
    startTransition(() => router.push(href));
  };

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onMouseEnter={onHover}
      onClick={handleClick}
      aria-current={isCurrent ? 'page' : undefined}
      className={`group relative flex items-center transition-colors duration-150 rounded-lg text-[13px] select-none outline-none border ${
        collapsed
          ? `justify-center w-9 h-9 mx-auto p-0 my-0.5 ${
              isActive
                ? 'bg-white/[0.09] text-[#FF5722] border-white/[0.08] font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] border-transparent'
            }`
          : `px-2.5 h-[34px] justify-between my-0.5 ${
              isActive
                ? 'bg-white/[0.09] text-white font-medium border-white/[0.08]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border-transparent font-medium'
            }`
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`shrink-0 flex items-center justify-center transition-colors ${
            isActive ? 'text-[#FF5722]' : 'text-zinc-500 group-hover:text-zinc-300'
          }`}
        >
          {icon}
        </span>
        {!collapsed && (
          <span className="truncate leading-none">{label}</span>
        )}
      </div>

      {!collapsed && (
        isPending ? (
          <span
            className="shrink-0 ml-2 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--color-primary, #FF5722)' }}
          />
        ) : badge ? (
          <span className="shrink-0 ml-2">{badge}</span>
        ) : null
      )}

      {/* Floating Tooltip (Collapsed Mode) */}
      {collapsed && (
        <div
          className="absolute left-full ml-2.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 transition-opacity duration-150 shadow-2xl bg-[#18181B] text-zinc-100 border border-zinc-700/80 flex items-center gap-2"
        >
          <span>{label}</span>
          {badge && (
            <span className="shrink-0">
              {badge}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

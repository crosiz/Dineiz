'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  const exactOnlyRoutes = ['/dashboard', '/dashboard/settings'];
  
  const isActive = exactOnlyRoutes.includes(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onMouseEnter={onHover}
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

      {!collapsed && badge && (
        <span className="shrink-0 ml-2">{badge}</span>
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





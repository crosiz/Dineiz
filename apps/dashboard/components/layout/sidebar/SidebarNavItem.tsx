'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  badge?: React.ReactNode;
  onHover?: () => void;
}

const BRAND = '#FF5722';

export function SidebarNavItem({ href, icon, label, collapsed, badge, onHover }: NavItemProps) {
  const pathname = usePathname();
  const exactOnlyRoutes = ['/dashboard', '/dashboard/settings'];
  
  const isActive = exactOnlyRoutes.includes(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isActive && linkRef.current) {
      linkRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isActive]);

  return (
    <Link
      ref={linkRef}
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center transition-all duration-200 rounded-lg text-[13px] mb-0.5 focus:outline-none ${
        collapsed ? 'justify-center w-10 h-10 mx-auto p-0' : 'px-3 py-2.5 justify-between'
      }`}
      style={
        isActive
          ? {
              background: 'rgba(255,87,34,0.12)',
              color: '#FFFFFF',
              fontWeight: 500,
              borderLeft: collapsed ? 'none' : `2px solid ${BRAND}`,
              paddingLeft: collapsed ? undefined : '10px',
            }
          : {
              color: '#64748B',
              borderLeft: collapsed ? 'none' : '2px solid transparent',
              paddingLeft: collapsed ? undefined : '10px',
            }
      }
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.color = '#CBD5E1';
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
        }
        if (onHover) onHover();
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.color = '#64748B';
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
        }
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 flex items-center justify-center w-[18px] h-[18px]"
          style={{ color: isActive ? BRAND : 'inherit' }}
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

      {/* Tooltip (collapsed mode) */}
      {collapsed && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 transition-opacity duration-150 shadow-xl"
          style={{
            background: '#1E2538',
            color: '#E2E8F0',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {label}
          {badge && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: BRAND }}
            >
              {badge}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

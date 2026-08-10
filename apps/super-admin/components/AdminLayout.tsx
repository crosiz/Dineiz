'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  UserPlus,
  Clock,
  UserMinus,
  CreditCard,
  DollarSign,
  FileText,
  AlertTriangle,
  Send,
  History,
  Mail,
  ToggleLeft,
  Activity,
  FileCode,
  ShieldCheck,
  Shield,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Package,
} from 'lucide-react';

interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'SUPPORT' | 'SALES';
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    ownerOnly?: boolean;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Analytics', href: '/analytics', icon: TrendingUp },
    ],
  },
  {
    title: 'CLIENTS',
    items: [
      { label: 'All Clients', href: '/clients', icon: Users },
      { label: 'Add New Client', href: '/clients/new', icon: UserPlus },
      { label: 'Trials', href: '/clients/trials', icon: Clock },
      { label: 'Churned', href: '/clients/churned', icon: UserMinus },
    ],
  },
  {
    title: 'BILLING',
    items: [
      { label: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
      { label: 'Payments', href: '/subscriptions/payments', icon: DollarSign },
      { label: 'Invoices', href: '/subscriptions/invoices', icon: FileText },
      { label: 'Dunning', href: '/subscriptions/dunning', icon: AlertTriangle },
    ],
  },
  {
    title: 'COMMUNICATIONS',
    items: [
      { label: 'Send Alert', href: '/communications/send', icon: Send },
      { label: 'Message History', href: '/communications/history', icon: History },
      { label: 'Email Templates', href: '/communications/templates', icon: Mail },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Plans & Pricing', href: '/plans', icon: Package, ownerOnly: true },
      { label: 'Feature Flags', href: '/system/feature-flags', icon: ToggleLeft },
      { label: 'API Health', href: '/system/api-health', icon: Activity },
      { label: 'Error Logs', href: '/system/error-logs', icon: FileCode },
      { label: 'Audit Trail', href: '/system/audit-trail', icon: ShieldCheck },
      { label: 'Super Admins', href: '/system/super-admins', icon: Shield, ownerOnly: true },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((data) => {
        if (data?.superAdmin) setUser(data.superAdmin);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // If on login page, render children without sidebar layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-slate-900 text-slate-100">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[240px] bg-[#0F172A] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">Dineiz</span>
              <span className="text-xs font-semibold text-amber-500 block -mt-1 uppercase tracking-wider">Admin</span>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  if (item.ownerOnly && user?.role !== 'OWNER') return null;

                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);

                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Role Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{user?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-amber-500 font-semibold tracking-wider uppercase">
                {user?.role || 'OWNER'}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
        {/* Top Bar */}
        <header className="h-16 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">Dineiz Admin</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                INTERNAL OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Production Live</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="block text-xs font-semibold text-white">{user?.name || 'Super Admin'}</span>
                <span className="block text-[10px] text-slate-400">{user?.email}</span>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 border border-slate-700/80 text-xs font-semibold transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

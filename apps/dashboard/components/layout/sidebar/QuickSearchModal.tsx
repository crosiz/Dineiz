'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, X, CornerDownLeft, 
  LayoutDashboard, Zap, ClipboardList, UtensilsCrossed, 
  LayoutTemplate, Monitor, Building2, Users, Package, 
  Clock, Tag, UserCheck, Star, BarChart3, FileText, 
  TrendingUp, Globe, Truck, QrCode, Webhook,
  CreditCard, Settings, MessageCircle, ArrowRight
} from 'lucide-react';
import { TENANT_ADMIN_NAV, BRANCH_MANAGER_NAV, NavItem } from './nav-config';
import { useUser } from '@/contexts/user-context';

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Zap: <Zap size={16} />,
  ClipboardList: <ClipboardList size={16} />,
  UtensilsCrossed: <UtensilsCrossed size={16} />,
  LayoutTemplate: <LayoutTemplate size={16} />,
  Monitor: <Monitor size={16} />,
  Building2: <Building2 size={16} />,
  Users: <Users size={16} />,
  Package: <Package size={16} />,
  Clock: <Clock size={16} />,
  Tag: <Tag size={16} />,
  UserCheck: <UserCheck size={16} />,
  Star: <Star size={16} />,
  BarChart3: <BarChart3 size={16} />,
  FileText: <FileText size={16} />,
  AlertTriangle: <Star size={16} />,
  TrendingUp: <TrendingUp size={16} />,
  Globe: <Globe size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Truck: <Truck size={16} />,
  QrCode: <QrCode size={16} />,
  Webhook: <Webhook size={16} />,
  CreditCard: <CreditCard size={16} />,
  Settings: <Settings size={16} />,
};

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { role, branch } = useUser();

  const isBranchManager = role === 'BRANCH_MANAGER';
  const navSections = isBranchManager ? BRANCH_MANAGER_NAV(branch?.name || 'Main Branch') : TENANT_ADMIN_NAV;

  // Flatten all items with section context and icon
  const allItems: { label: string; href: string; section: string; icon: string }[] = [];
  navSections.forEach(sec => {
    sec.items.forEach(item => {
      allItems.push({
        label: item.label,
        href: item.href,
        section: sec.section,
        icon: item.icon,
      });
    });
  });

  const filtered = query.trim() === ''
    ? allItems
    : allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.section.toLowerCase().includes(query.toLowerCase()) ||
        item.href.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex].href);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Command Palette Modal */}
      <div 
        className="relative w-full max-w-lg bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 text-zinc-100"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
          <Search size={18} className="text-[#FF5722] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, operations, settings..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none font-medium"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[340px] overflow-y-auto p-2 divide-y divide-zinc-800/40">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.href}
                  onClick={() => handleSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                    isSelected
                      ? 'bg-white/[0.08] text-white border border-white/[0.06] shadow-xs'
                      : 'text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 ${isSelected ? 'text-[#FF5722]' : 'text-zinc-500'}`}>
                      {iconMap[item.icon] || <LayoutDashboard size={16} />}
                    </span>
                    <span className="font-medium text-zinc-100 truncate text-[13px]">
                      {item.label}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 shrink-0">
                      {item.section}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[11px] text-[#FF5722] font-mono shrink-0 font-medium">
                      <span>Jump</span>
                      <CornerDownLeft size={12} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500 font-medium">
              No matching pages found for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono border border-zinc-700 text-zinc-300">↑</kbd><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono border border-zinc-700 text-zinc-300">↓</kbd> Navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] font-mono border border-zinc-700 text-zinc-300">↵</kbd> Select</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">Dineiz Command</span>
        </div>
      </div>
    </div>
  );
}


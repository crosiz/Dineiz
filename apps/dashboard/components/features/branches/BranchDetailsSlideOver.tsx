import { formatPKR } from '@/lib/formatters';
import React from 'react';
import { X, MapPin, Phone, Mail, Clock, Activity, Store } from 'lucide-react';
import { Branch } from './hooks/useBranches';

interface BranchDetailsSlideOverProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BranchDetailsSlideOver({ branch, isOpen, onClose }: BranchDetailsSlideOverProps) {
  if (!isOpen || !branch) return null;

  const isActive = branch.isActive;
  const initialLetter = branch.initial || branch.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header - Colored based on branch theme */}
        <div 
          className="relative h-40 shrink-0 flex items-end p-6"
          style={{ backgroundColor: isActive ? (branch.colorHex || '#ff5722') : '#94a3b8' }}
        >
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded px-2 py-0.5 tracking-wider">
            {isActive ? 'ACTIVE' : 'INACTIVE'}
          </div>

          <div className="flex items-center gap-4 text-white">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-black shadow-inner">
              {initialLetter}
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight drop-shadow-sm">{branch.name}</h2>
              <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                <MapPin size={14} />
                <span className="line-clamp-1">{branch.city || 'No City Set'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Store size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Today's Revenue</span>
              </div>
              <p className="text-lg font-black text-slate-900">
                {formatPKR(branch.stats.todayRevenue)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Activity size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Today's Orders</span>
              </div>
              <p className="text-lg font-black text-slate-900">
                {branch.stats.todayOrders}
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contact & Location</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{branch.address || 'Address not set'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{branch.city}, {branch.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <p className="text-sm font-medium text-slate-900">{branch.phone || 'Phone not set'}</p>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <p className="text-sm font-medium text-slate-900">{branch.email || 'Email not set'}</p>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Operating Hours</h3>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-slate-400 shrink-0" />
                <p className="text-sm font-medium text-slate-900">
                  {branch.openingTime && branch.closingTime 
                    ? `${branch.openingTime} - ${branch.closingTime}` 
                    : 'Not configured'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${branch.stats.isCurrentlyOpen ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className={`text-xs font-bold ${branch.stats.isCurrentlyOpen ? 'text-green-600' : 'text-slate-500'}`}>
                  {branch.stats.isCurrentlyOpen ? 'OPEN NOW' : 'CLOSED'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

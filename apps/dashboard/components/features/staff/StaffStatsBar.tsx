'use client';

import React from 'react';
import { Users, UserCheck, Shield, Mail } from 'lucide-react';

interface StaffStatsBarProps {
  stats: {
    total: number;
    activeNow: number;
    managers: number;
    pendingInvites: number;
  };
}

export function StaffStatsBar({ stats }: StaffStatsBarProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {/* Total Staff */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Users className="text-blue-600" size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Staff</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.total}</h3>
          </div>
        </div>
      </div>

      {/* Active Now */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
          <UserCheck className="text-green-600" size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active Now</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.activeNow}</h3>
            <span className="text-[11px] font-medium text-slate-400">On shift</span>
          </div>
        </div>
      </div>

      {/* Managers */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
          <Shield className="text-purple-600" size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Managers</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.managers}</h3>
          </div>
        </div>
      </div>

      {/* Pending Invite */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
          <Mail className="text-[#ff5722]" size={18} />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending Invite</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-lg font-bold text-slate-900">{stats.pendingInvites}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}

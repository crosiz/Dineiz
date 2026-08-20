'use client';
import { formatPKR } from '@/lib/formatters';

import React, { useState } from 'react';
import { MoreHorizontal, MapPin, Phone, Clock, Eye, Pencil, Trash, Power, Terminal, LayoutTemplate, PauseCircle, PlayCircle } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Branch, useBranches } from './hooks/useBranches';

interface BranchCardProps {
  branch: Branch;
  onViewDetails: () => void;
  onEdit: () => void;
  onViewPlan: () => void;
}

export function BranchCard({ branch, onViewDetails, onEdit, onViewPlan }: BranchCardProps) {
  const { toggleStatusMutation, deleteBranchMutation } = useBranches();
  const [isDeleting, setIsDeleting] = useState(false);
  const isActive = branch.isActive;

  const initialLetter = branch.initial || branch.name.charAt(0).toUpperCase();

  const handleToggleStatus = () => {
    if (confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'activate'} this branch?`)) {
      toggleStatusMutation.mutate({ id: branch.id });
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${branch.name}? This action cannot be undone.`)) {
      setIsDeleting(true);
      deleteBranchMutation.mutate(branch.id, {
        onError: (err: any) => {
          setIsDeleting(false);
          alert(err?.message || 'Failed to delete branch');
        }
      });
    }
  };



  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full group hover:shadow-md transition-all">
      {/* HEADER */}
      <div
        className="h-24 relative flex items-end p-4"
        style={{ backgroundColor: isActive ? (branch.colorHex || '#ff5722') : '#94a3b8' }}
      >
        {/* Status Badge */}
        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase rounded px-2 py-0.5 tracking-wider">
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </div>

        {/* Actions Menu */}
        <div className="absolute top-3 right-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-[160px] bg-white rounded-md p-1 shadow-md border border-slate-200 z-50">
                <DropdownMenu.Item 
                  onClick={onEdit}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer outline-none"
                >
                  <Pencil size={14} />
                  Edit Branch
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={onViewPlan}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer outline-none"
                >
                  <LayoutTemplate size={14} />
                  Edit Floor Plan
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                <DropdownMenu.Item 
                  onClick={handleToggleStatus}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer outline-none"
                >
                  {isActive ? <PauseCircle size={14} className="text-orange-500" /> : <PlayCircle size={14} className="text-green-500" />}
                  {isActive ? 'Mark Inactive' : 'Mark Active'}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                <DropdownMenu.Item 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded cursor-pointer outline-none disabled:opacity-50"
                >
                  <Trash size={14} />
                  Delete Branch
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Logo / Initial + Name */}
        <div className="flex items-center gap-3 text-white min-w-0">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {branch.imageUrl ? (
              <img src={branch.imageUrl} alt={branch.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-black text-white/90 select-none">{initialLetter}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight line-clamp-1 drop-shadow-sm">{branch.name}</h3>
            {!isActive && <span className="text-[11px] text-white/75">Temporarily Closed</span>}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className={`p-4 flex-1 flex flex-col ${!isActive ? 'opacity-70' : ''}`}>
        <div className="space-y-1.5 mb-4 flex-1">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <span className="text-xs text-slate-500 line-clamp-2">{branch.address || 'No address set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{branch.phone || 'No phone set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">
              {branch.openingTime && branch.closingTime 
                ? `${branch.openingTime} - ${branch.closingTime}` 
                : 'Hours not set'}
            </span>
            <div className={`w-2 h-2 rounded-full ${branch.stats.isCurrentlyOpen ? 'bg-green-500' : 'bg-slate-300'}`} title={branch.stats.isCurrentlyOpen ? 'Currently Open' : 'Closed'} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 mb-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">POS Code:</span>
            <code className="text-xs font-mono font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
              {branch.branchCode || 'N/A'}
            </code>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-end">
          <div>
            <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Today's Revenue</p>
            <p className="text-sm font-black text-slate-900">
              {formatPKR(branch.stats.todayRevenue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Orders</p>
            <p className="text-sm font-black text-slate-900">{branch.stats.todayOrders}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">Active Now</p>
            <p className={`text-sm font-black ${branch.stats.activeOrders > 0 ? 'text-orange-500' : 'text-slate-900'}`}>
              {branch.stats.activeOrders || 0}
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors" title="View Details" onClick={onViewDetails}>
              <Eye size={16} />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors" onClick={onEdit} title="Edit Branch">
              <Pencil size={16} />
            </button>
          </div>
          
          {isActive ? (
            <button 
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={onViewPlan}
            >
              Floor Plan
            </button>
          ) : (
            <span className="bg-slate-100 text-slate-500 rounded-lg px-3 py-1.5 text-xs font-bold border border-slate-200/50">
              Under Reno
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Info, Clock } from 'lucide-react';
import { AddBranchFormData } from '../hooks/useAddBranch';

export function Step2OperatingHours() {
  const { register, formState: { errors } } = useFormContext<AddBranchFormData>();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <p className="text-xs text-slate-500 -mt-2">Step 2 of 4: Operating Hours</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Opening Time</label>
          <div className="relative">
            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="time"
              {...register('openingTime')}
              className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all ${errors.openingTime ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-orange-400'}`}
            />
          </div>
          {errors.openingTime && <p className="text-red-500 text-xs mt-1">{errors.openingTime.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Closing Time</label>
          <div className="relative">
            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="time"
              {...register('closingTime')}
              className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all ${errors.closingTime ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-orange-400'}`}
            />
          </div>
          {errors.closingTime && <p className="text-red-500 text-xs mt-1">{errors.closingTime.message}</p>}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2 items-start">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          These hours apply every day the branch is open. Per-day scheduling isn't supported yet — you can adjust this later from Branch Settings.
        </p>
      </div>
    </div>
  );
}

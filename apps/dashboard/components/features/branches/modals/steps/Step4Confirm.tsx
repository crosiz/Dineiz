'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { AddBranchFormData } from '../hooks/useAddBranch';
import { Check } from 'lucide-react';

export function Step4Confirm() {
  const { watch, setFocus } = useFormContext<AddBranchFormData>();
  const data = watch();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-[#ff5722] font-semibold">Step 4 of 4</span>
          <div className="flex gap-1 ml-3">
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Confirm Branch Setup</h2>
        <p className="text-sm text-slate-500">Review your configuration before creating the branch.</p>
      </div>

      {/* Card 1 - Basic Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs uppercase font-bold text-slate-400">Basic Information</h3>
          {/* Typically would jump back to step 1, here just a visual link */}
          <span className="text-xs font-semibold text-[#ff5722] cursor-pointer">Edit</span>
        </div>
        <div>
          <h4 className="text-lg font-bold text-slate-900 leading-tight">{data.name || 'Unnamed Branch'}</h4>
          <p className="text-sm text-slate-600 mt-1">{data.address}{data.city ? `, ${data.city}` : ''}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-slate-500">{data.phone}</span>
            <span className="text-xs text-slate-500">{data.email}</span>
          </div>
        </div>
      </div>

      {/* Card 2 - Operating Hours */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs uppercase font-bold text-slate-400">Operating Hours</h3>
          <span className="text-xs font-semibold text-[#ff5722] cursor-pointer">Edit</span>
        </div>
        <div className="space-y-1.5">
          {data.operatingDays?.map(day => (
            <div key={day} className="flex text-xs">
              <span className="w-12 font-medium text-slate-700">{day}</span>
              <span className="text-slate-500">
                {data.hours?.[day]?.open} - {data.hours?.[day]?.close} <span className="text-slate-300 mx-1">|</span> Last Order: {data.hours?.[day]?.lastOrder}
              </span>
            </div>
          ))}
          {(!data.operatingDays || data.operatingDays.length === 0) && (
            <span className="text-xs text-slate-400">No operating days selected.</span>
          )}
        </div>
      </div>

      {/* Card 3 - Settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs uppercase font-bold text-slate-400">Branch Settings</h3>
          <span className="text-xs font-semibold text-[#ff5722] cursor-pointer">Edit</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Currency</p>
            <p className="text-sm font-semibold text-slate-700">{data.currency}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Timezone</p>
            <p className="text-sm font-semibold text-slate-700 truncate" title={data.timezone}>{data.timezone}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.kdsEnabled && <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-md"><Check size={12}/> KDS</span>}
          {data.kotAutoPrint && <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-md"><Check size={12}/> KOT Auto-print</span>}
          {data.acceptOnlineOrders && <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-md"><Check size={12}/> Online Orders</span>}
          {data.deliveryAvailable && <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-md"><Check size={12}/> Delivery</span>}
        </div>
      </div>

      {/* Terms Note */}
      <label className="flex items-start gap-2 cursor-pointer mt-4">
        <input type="checkbox" required className="mt-0.5 w-4 h-4 accent-[#ff5722] shrink-0" />
        <span className="text-xs text-slate-600 leading-relaxed">
          I confirm this information is accurate and ready for deployment. I understand that billing will automatically adjust to accommodate this new location based on my active subscription plan.
        </span>
      </label>

    </div>
  );
}

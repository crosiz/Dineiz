'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { MapPinIcon, Lightbulb } from 'lucide-react';
import { AddBranchFormData } from '../hooks/useAddBranch';

export function Step1BasicInfo() {
  const { register, formState: { errors } } = useFormContext<AddBranchFormData>();

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Banner */}
      <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 flex gap-3 items-start">
        <Lightbulb size={20} className="text-[#ff5722] shrink-0" />
        <p className="text-sm text-slate-700 leading-relaxed">
          Setup your primary location details first. These will be visible on your digital receipts and customer communications.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Branch Name <span className="text-red-500">*</span></label>
        <input 
          {...register('name')}
          className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.name ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
          placeholder="e.g. South End Waterfront"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Address Line <span className="text-red-500">*</span></label>
        <div className="relative">
          <MapPinIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            {...register('address')}
            className={`w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.address ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
            placeholder="123 Gastronomy Lane, Suite 10"
          />
        </div>
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">City <span className="text-red-500">*</span></label>
          <input 
            {...register('city')}
            className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.city ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
            placeholder="New York"
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
          <input 
            {...register('phone')}
            className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.phone ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
            placeholder="+1 (555) 000-0000"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Branch Contact Email <span className="text-slate-400 font-normal">(Optional)</span></label>
        <input 
          {...register('email')}
          className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.email ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
          placeholder="manager@swiftserv.com"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

    </div>
  );
}

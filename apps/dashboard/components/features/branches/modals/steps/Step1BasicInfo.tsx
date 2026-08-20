'use client';

import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { MapPinIcon, Lightbulb, UploadCloud } from 'lucide-react';
import { AddBranchFormData } from '../hooks/useAddBranch';

export function Step1BasicInfo() {
  const { register, watch, formState: { errors } } = useFormContext<AddBranchFormData>();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const logoFiles = watch('logo') as FileList | undefined;

  useEffect(() => {
    const file = logoFiles?.[0];
    if (!file) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFiles]);

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      
      <div>
        <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
        <p className="text-sm text-slate-500 mt-0.5">Location details shown on receipts and customer communications.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Branch Name <span className="text-red-500">*</span></label>
        <input 
          {...register('name')}
          className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.name ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
          placeholder="e.g. Clifton Branch"
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
            placeholder="e.g. Block 5, Clifton"
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
            placeholder="e.g. Karachi"
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
          <input 
            {...register('phone')}
            className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.phone ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
            placeholder="+92 300 1234567"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Branch Contact Email <span className="text-slate-400 font-normal">(Optional)</span></label>
        <input 
          {...register('email')}
          className={`w-full h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all ${errors.email ? '!border-red-300 !focus:border-red-500 !focus:ring-red-100' : ''}`}
          placeholder="branch@yourrestaurant.com"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Branch Logo <span className="text-slate-400 font-normal">(Optional)</span></label>
        <div className="relative min-h-[120px] border-2 border-dashed border-slate-200 rounded-xl p-8 bg-white hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col items-center justify-center">
          <input
            type="file"
            accept="image/png, image/jpeg, image/svg+xml"
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            {...register('logo')}
          />

          {logoPreview ? (
            <img src={logoPreview} alt="Logo preview" className="w-full h-32 object-contain p-2" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud size={24} className="text-[#ff5722]" />
              </div>
              <span className="text-sm font-medium text-slate-700">Upload Branch Logo</span>
              <span className="text-xs text-slate-400 mt-1">PNG, JPG or SVG up to 5MB</span>
            </>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">Uploaded once the branch is created.</p>
      </div>

    </div>
  );
}

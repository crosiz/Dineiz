'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Monitor, Printer } from 'lucide-react';
import { AddBranchFormData } from '../hooks/useAddBranch';
import Select from 'react-select';

export function Step3BranchSettings() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<AddBranchFormData>();

  const timezones = [
    { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)' },
    { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi, Pakistan' },
    { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai, UAE' }
  ];

  const toggles = [
    { id: 'kdsEnabled', icon: Monitor, title: 'KDS Enabled', desc: 'Route orders to kitchen displays', color: 'orange' },
    { id: 'kotAutoPrint', icon: Printer, title: 'KOT Auto-print', desc: 'Print tickets immediately on order', color: 'orange' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-8">
      
      <div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-[#ff5722] font-semibold">Step 3 of 4</span>
          <div className="flex gap-1 ml-3">
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-[#ff5722]"></span>
            <span className="w-4 h-1.5 rounded-full bg-slate-200"></span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Branch Settings</h2>
        <p className="text-sm text-slate-500">Configure operational behaviors and localization.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Currency</label>
          <select 
            {...register('currency')}
            className={`w-full border rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 bg-white transition-colors ${errors.currency ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-[#ff5722]'}`}
          >
            <option value="PKR">PKR - Pakistani Rupee (Rs)</option>
            <option value="USD">USD - United States Dollar ($)</option>
            <option value="SAR">SAR - Saudi Riyal (SR)</option>
            <option value="AED">AED - UAE Dirham (د.إ)</option>
            <option value="GBP">GBP - British Pound (£)</option>
            <option value="EUR">EUR - Euro (€)</option>
          </select>
          {errors.currency && <p className="text-red-500 text-xs mt-1">{errors.currency.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Timezone</label>
          <Controller
            name="timezone"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                options={timezones}
                value={timezones.find(c => c.value === field.value)}
                onChange={val => field.onChange(val?.value)}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    height: '48px',
                    borderRadius: '0.75rem',
                    borderColor: state.isFocused ? '#ff5722' : '#e2e8f0',
                    boxShadow: state.isFocused ? '0 0 0 2px rgba(255, 87, 34, 0.2)' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#ff5722' : '#cbd5e1' }
                  })
                }}
              />
            )}
          />
          {errors.timezone && <p className="text-red-500 text-xs mt-1">{errors.timezone.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Tax Rate (%)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...register('taxRate')}
            placeholder="0"
            className={`w-full border rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 bg-white transition-colors ${errors.taxRate ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-[#ff5722]'}`}
          />
          {errors.taxRate && <p className="text-red-500 text-xs mt-1">{errors.taxRate.message}</p>}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Operational Toggles</h3>
        <div className="space-y-3">
          {toggles.map(t => {
            const val = watch(t.id as keyof AddBranchFormData);
            return (
              <div key={t.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${val ? 'bg-orange-50 text-[#ff5722]' : 'bg-slate-50 text-slate-400'}`}>
                    <t.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{t.title}</h4>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </div>
                </div>
                
                <button 
                  type="button"
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors relative ${val ? 'bg-[#ff5722]' : 'bg-slate-300'}`}
                  onClick={() => setValue(t.id as keyof AddBranchFormData, !val, { shouldValidate: true })}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

'use client';

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Info, Clock } from 'lucide-react';
import { AddBranchFormData } from '../hooks/useAddBranch';

export function Step2OperatingHours() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<AddBranchFormData>();
  
  const operatingDays = watch('operatingDays') || [];
  const hours = watch('hours') || {};

  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: string) => {
    if (operatingDays.includes(day)) {
      setValue('operatingDays', operatingDays.filter(d => d !== day), { shouldValidate: true });
    } else {
      setValue('operatingDays', [...operatingDays, day], { shouldValidate: true });
    }
  };

  const applyToAll = () => {
    if (operatingDays.length === 0) return;
    const baseDay = operatingDays[0];
    const baseHours = hours[baseDay];
    if (!baseHours) return;

    const newHours = { ...hours };
    operatingDays.forEach(day => {
      newHours[day] = { ...baseHours };
    });
    setValue('hours', newHours, { shouldValidate: true });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <p className="text-xs text-slate-500 -mt-2">Step 2 of 4: Operating Hours</p>

      {/* Select Operating Days */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">Select Operating Days</label>
        <div className="flex gap-2">
          {daysList.map(day => {
            const isActive = operatingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors ${
                  isActive 
                    ? 'bg-[#ff5722] text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                {day.charAt(0)}
              </button>
            );
          })}
        </div>
        {errors.operatingDays && <p className="text-red-500 text-xs mt-1">{errors.operatingDays.message}</p>}
      </div>

      <div className="flex justify-end">
        <button 
          type="button"
          onClick={applyToAll}
          className="text-xs text-[#ff5722] font-semibold hover:underline"
        >
          Apply same hours to all days
        </button>
      </div>

      {/* Schedule Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">DAY</th>
              <th className="px-4 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">OPEN FROM</th>
              <th className="px-4 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">CLOSE AT</th>
              <th className="px-4 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">LAST ORDER</th>
            </tr>
          </thead>
          <tbody>
            {daysList.map(day => {
              if (!operatingDays.includes(day)) return null;
              
              return (
                <tr key={day} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700 w-12">{day}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        {...register(`hours.${day}.open`)}
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#ff5722]"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        {...register(`hours.${day}.close`)}
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#ff5722]"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <input 
                        {...register(`hours.${day}.lastOrder`)}
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#ff5722]"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {operatingDays.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-400">
            Please select operating days to configure hours.
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-4 flex gap-2 items-start">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Last order times are used for online ordering and kitchen pacing. Customers won't be able to place new orders after this time.
        </p>
      </div>
    </div>
  );
}

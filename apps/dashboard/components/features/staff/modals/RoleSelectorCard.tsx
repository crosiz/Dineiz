'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { StaffFormData } from './AddStaffModal';

interface RoleSelectorCardProps {
  value: string;
  title: string;
  description: string;
}

export function RoleSelectorCard({ value, title, description }: RoleSelectorCardProps) {
  const { register, watch, setValue } = useFormContext<StaffFormData>();
  const selectedRole = watch('role');
  const isSelected = selectedRole === value;

  return (
    <div 
      onClick={() => setValue('role', value as any, { shouldValidate: true })}
      className={`border rounded-xl p-4 cursor-pointer flex items-start gap-3 transition-all mb-3 ${
        isSelected 
          ? 'border-[#ff5722] bg-orange-50 border-2' 
          : 'border-slate-200 hover:border-orange-200'
      }`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
        isSelected ? 'border-[#ff5722]' : 'border-slate-300'
      }`}>
        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#ff5722]"></div>}
      </div>
      <div>
        <p className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

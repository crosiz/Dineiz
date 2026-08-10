'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface AddBranchStepperProps {
  currentStep: number;
}

export function AddBranchStepper({ currentStep }: AddBranchStepperProps) {
  const steps = [
    { num: 1, label: 'Basic Info', icon: 'info' },
    { num: 2, label: 'Hours', icon: 'schedule' },
    { num: 3, label: 'Settings', icon: 'tune' },
    { num: 4, label: 'Confirm', icon: 'check_circle' }
  ];

  return (
    <div className="px-6 pt-6 pb-8 flex items-center justify-between relative shrink-0">
      {/* Background track line */}
      <div className="absolute top-11 left-12 right-12 h-[2px] bg-slate-100 -z-10"></div>
      
      {/* Active track line */}
      <div 
        className="absolute top-11 left-12 h-[2px] bg-[#ff5722] -z-10 transition-all duration-300"
        style={{ width: `calc(${((currentStep - 1) / 3) * 100}% - ${((currentStep - 1) / 3) * 48}px)` }}
      ></div>

      {steps.map((step) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        
        let circleStyle = 'bg-slate-100 text-slate-400';
        if (isActive) {
          circleStyle = 'bg-[#ff5722] text-white ring-4 ring-orange-100';
        } else if (isCompleted) {
          circleStyle = 'bg-[#ff5722] text-white';
        }

        let labelStyle = 'text-slate-400 font-medium';
        if (isActive) labelStyle = 'text-slate-900 font-bold';

        return (
          <div key={step.num} className="flex flex-col items-center gap-2 relative bg-white px-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${circleStyle}`}>
              {isCompleted ? (
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
              )}
            </div>
            <span className={`text-[11px] tracking-wide ${labelStyle} absolute -bottom-6 whitespace-nowrap`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

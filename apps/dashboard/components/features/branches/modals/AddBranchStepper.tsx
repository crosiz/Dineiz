'use client';

import React from 'react';
import { Building2, Clock, Sliders, CheckCircle2, Check } from 'lucide-react';

interface AddBranchStepperProps {
  currentStep: number;
}

export function AddBranchStepper({ currentStep }: AddBranchStepperProps) {
  const steps = [
    { num: 1, label: 'Basic Info', icon: Building2 },
    { num: 2, label: 'Hours', icon: Clock },
    { num: 3, label: 'Settings', icon: Sliders },
    { num: 4, label: 'Confirm', icon: CheckCircle2 }
  ];

  return (
    <div className="px-6 pt-6 pb-8 flex items-center justify-between relative shrink-0">
      {/* Background track line */}
      <div className="absolute top-11 left-12 right-12 h-[2px] bg-slate-100 -z-10" />
      
      {/* Active track line */}
      <div 
        className="absolute top-11 left-12 h-[2px] bg-[#FF5722] -z-10 transition-all duration-300"
        style={{ width: `calc(${((currentStep - 1) / 3) * 100}% - ${((currentStep - 1) / 3) * 48}px)` }}
      />

      {steps.map((step) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const IconComponent = step.icon;
        
        let circleStyle = 'bg-slate-100 text-slate-400';
        if (isActive) {
          circleStyle = 'bg-[#FF5722] text-white ring-4 ring-orange-100';
        } else if (isCompleted) {
          circleStyle = 'bg-[#FF5722] text-white';
        }

        let labelStyle = 'text-slate-400 font-medium';
        if (isActive) labelStyle = 'text-slate-900 font-bold';

        return (
          <div key={step.num} className="flex flex-col items-center gap-2 relative bg-white px-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${circleStyle}`}>
              {isCompleted ? (
                <Check size={18} />
              ) : (
                <IconComponent size={18} />
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


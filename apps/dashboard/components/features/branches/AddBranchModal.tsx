'use client';

import React from 'react';
import { X, Loader2, ArrowRight, Check } from 'lucide-react';
import { FormProvider } from 'react-hook-form';
import { useAddBranch } from './modals/hooks/useAddBranch';
import { AddBranchStepper } from './modals/AddBranchStepper';
import { Step1BasicInfo } from './modals/steps/Step1BasicInfo';
import { Step2OperatingHours } from './modals/steps/Step2OperatingHours';
import { Step3BranchSettings } from './modals/steps/Step3BranchSettings';
import { Step4Confirm } from './modals/steps/Step4Confirm';

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBranchModal({ isOpen, onClose }: AddBranchModalProps) {
  const addBranchLogic = useAddBranch(onClose);
  const { methods, currentStep, goNext, goBack, goToStep, onSubmit, isSubmitting } = addBranchLogic;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add New Branch</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure branch details, schedule, and settings</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <AddBranchStepper currentStep={currentStep} />

        {/* Form Container */}
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {currentStep === 1 && <Step1BasicInfo />}
              {currentStep === 2 && <Step2OperatingHours />}
              {currentStep === 3 && <Step3BranchSettings />}
              {currentStep === 4 && <Step4Confirm onEditStep={goToStep} />}
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <button 
                type="button"
                className={`h-9 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs ${currentStep === 1 ? 'opacity-100' : ''}`}
                onClick={currentStep === 1 ? onClose : goBack}
                disabled={isSubmitting}
              >
                {currentStep === 1 ? 'Cancel' : '← Back'}
              </button>
              
              {currentStep < 4 ? (
                <button 
                  type="button"
                  className="h-9 px-5 bg-[#FF5722] hover:bg-[#F4511E] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  onClick={goNext}
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button 
                  type="submit"
                  className="h-9 px-5 bg-[#FF5722] hover:bg-[#F4511E] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>Create Branch <Check size={14} /></>
                  )}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

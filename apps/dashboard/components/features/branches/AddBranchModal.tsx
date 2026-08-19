'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
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
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Panel Card */}
      <div className="relative w-full max-w-[560px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Add New Branch</h2>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <AddBranchStepper currentStep={currentStep} />

        {/* Form Content */}
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 pb-6 flex-1 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {currentStep === 1 && <Step1BasicInfo />}
              {currentStep === 2 && <Step2OperatingHours />}
              {currentStep === 3 && <Step3BranchSettings />}
              {currentStep === 4 && <Step4Confirm onEditStep={goToStep} />}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
              <button 
                type="button"
                className={`px-6 h-10 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors ${currentStep === 1 ? 'opacity-100' : ''}`}
                onClick={currentStep === 1 ? onClose : goBack}
                disabled={isSubmitting}
              >
                {currentStep === 1 ? 'Cancel' : '← Back'}
              </button>
              
              {currentStep < 4 ? (
                <button 
                  type="button"
                  className="px-8 h-10 bg-[#ff5722] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
                  onClick={goNext}
                >
                  Next Step <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ) : (
                <button 
                  type="submit"
                  className="px-8 h-10 bg-[#ff5722] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>Create Branch <span className="material-symbols-outlined text-[18px]">check</span></>
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

'use client';

import React, { useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useStaff } from '../hooks/useStaff';
import { toast } from 'sonner';

interface ResetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
}

export function ResetPinModal({ isOpen, onClose, staffId, staffName }: ResetPinModalProps) {
  const { resetPin } = useStaff();
  const [pin, setPin] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAutogenerate = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString().split('');
    setPin(randomPin);
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    if (!val) return;
    const newPin = [...pin];
    newPin[index] = val;
    setPin(newPin);
    if (index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const newPin = [...pin];
      newPin[index] = '';
      setPin(newPin);
      if (index > 0) inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = pin.join('');
    if (fullPin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    
    resetPin.mutate(
      { id: staffId, newPin: fullPin },
      {
        onSuccess: () => {
          setPin(['', '', '', '']);
          onClose();
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex justify-center items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[400px] bg-white rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Reset POS PIN</h2>
            <p className="text-sm text-slate-500">For {staffName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                NEW POS SECURITY PIN *
              </label>
              <button
                type="button"
                onClick={handleAutogenerate}
                className="text-[#ff5722] text-xs font-bold hover:underline"
              >
                AUTOGENERATE
              </button>
            </div>
            
            <div className="flex items-center gap-3 mt-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  autoComplete="off"
                  value={pin[index] || ''}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-14 h-16 border-2 rounded-xl text-center text-2xl font-bold outline-none transition-colors border-slate-200 focus:border-[#ff5722]"
                />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              This will overwrite the current PIN. They will use this new PIN to log in.
            </p>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              onClick={onClose}
              disabled={resetPin.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetPin.isPending || pin.join('').length !== 4}
              className="px-6 py-2 bg-[#ff5722] text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetPin.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save New PIN'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

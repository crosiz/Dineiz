'use client';

import React, { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { StaffFormData } from './AddStaffModal';

export function PINInput() {
  const { setValue, watch, formState: { errors } } = useFormContext<StaffFormData>();
  const pin = watch('posPin') || '';
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAutogenerate = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setValue('posPin', randomPin, { shouldValidate: true });
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const newPin = pin.split('');
      newPin[index] = '';
      setValue('posPin', newPin.join(''));
      
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(-1);
    
    if (value) {
      const newPin = pin.split('');
      while(newPin.length < 4) newPin.push('');
      newPin[index] = value;
      setValue('posPin', newPin.join('').substring(0, 4), { shouldValidate: true });
      
      if (index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">POS SECURITY PIN</label>
        <button 
          type="button" 
          onClick={handleAutogenerate}
          className="text-[#ff5722] text-xs font-bold hover:underline"
        >
          AUTOGENERATE
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">This PIN will be used to log in at the POS tablet.</p>
      
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((index) => (
          <input
            key={index}
            ref={el => {
              if (inputRefs.current) inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={pin[index] || ''}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={`w-12 h-12 border-2 rounded-xl text-center text-lg font-bold outline-none transition-colors ${
              errors.posPin ? 'border-red-300 focus:border-red-500 bg-red-50' : 'border-slate-200 focus:border-[#ff5722]'
            }`}
          />
        ))}
      </div>
      {errors.posPin && <p className="text-red-500 text-xs mt-2">{errors.posPin.message}</p>}
    </div>
  );
}

import React, { useState } from 'react';

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string, reason: string) => Promise<void>;
}

export function ManagerOverrideModal({ isOpen, onClose, onConfirm }: ManagerOverrideModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) setPin((prev) => prev + key);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for force closing');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(pin, reason);
    } catch (e: any) {
      setError(e.message || 'Invalid PIN or insufficient permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div 
        className="relative z-10 w-full max-w-[420px] min-w-[320px] bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col"
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-5 shadow-md shadow-slate-900/20">
            <span className="material-symbols-outlined text-white text-[32px]">admin_panel_settings</span>
          </div>
          <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight mb-2">Manager Override</h2>
          <p className="text-[15px] text-slate-500 font-medium px-4">Enter your manager PIN and a reason to authorize force closing this shift.</p>
        </div>

        <div className="px-8 pb-4">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 rounded-[16px] border border-rose-100 flex items-start gap-3">
              <span className="material-symbols-outlined text-rose-500 text-[20px] shrink-0">error</span>
              <p className="text-rose-700 text-[14px] font-medium leading-snug">{error}</p>
            </div>
          )}
          
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`w-14 h-16 rounded-[16px] border-[2.5px] flex items-center justify-center text-[28px] transition-all duration-200 ${
                  pin.length > i 
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md' 
                    : pin.length === i 
                      ? 'border-slate-400 bg-white shadow-sm ring-4 ring-slate-100'
                      : 'border-slate-200 bg-slate-50 text-transparent'
                }`}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num.toString())}
                className="h-[60px] rounded-[16px] bg-slate-50 border border-slate-200 text-slate-900 font-bold text-[24px] hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <div className="h-[60px]"></div>
            <button
              onClick={() => handleKeyPress('0')}
              className="h-[60px] rounded-[16px] bg-slate-50 border border-slate-200 text-slate-900 font-bold text-[24px] hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-[60px] rounded-[16px] bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[28px]">backspace</span>
            </button>
          </div>

          <div>
            <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Reason for Force Close</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. System glitch, customer left"
              className="w-full px-5 h-[56px] bg-slate-50 border border-slate-200 rounded-[16px] text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
        </div>

        <div className="p-6 pt-4 mt-2 flex flex-col gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || pin.length !== 4 || !reason.trim()}
            className="w-full h-[56px] rounded-[16px] bg-slate-900 text-white font-bold text-[16px] hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(15,23,42,0.15)] flex items-center justify-center disabled:active:scale-100"
          >
            {isSubmitting ? <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span> : 'Authorize Force Close'}
          </button>
          <button
            onClick={onClose}
            className="w-full h-[56px] rounded-[16px] bg-transparent text-slate-500 font-bold text-[15px] hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
    </div>
  );
}

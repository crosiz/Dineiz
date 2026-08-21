'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPosShift, getToken } from '@/lib/pos-session';
import { 
  Clock, X, CheckCircle2, Printer, Download, 
  AlertCircle, Timer, Receipt, Banknote, Wallet, 
  Check, TrendingUp, TrendingDown, FileEdit, CheckCheck
} from 'lucide-react';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CloseShiftModal({ isOpen, onClose }: CloseShiftModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  
  const [closingCash, setClosingCash] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const shiftObj = getPosShift();
  const shiftId = shiftObj?.shiftId;
  const token = getToken();

  useEffect(() => {
    if (!isOpen || !shiftId) return;
    
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/summary`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch shift summary');
        const data = await res.json();
        setSummary(data);
      } catch (err: any) {
        toast.error(err.message || 'Error fetching shift summary');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSummary();
  }, [isOpen, shiftId, token]);

  if (!isOpen) return null;

  const expectedCash = summary ? (summary.openingFloat + summary.totalCash) : 0;
  const variance = closingCash === '' ? 0 : Number(closingCash) - expectedCash;
  
  // Format duration since openedAt
  const formatDuration = (openedAtStr: string) => {
    const ms = Date.now() - new Date(openedAtStr).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const handleSubmit = async () => {
    if (closingCash === '') {
      toast.error('Please enter the actual cash amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const overridePin = localStorage.getItem('shift_override_pin');
      const overrideReason = localStorage.getItem('shift_override_reason');

      const payload: any = {
        closingCash: Number(closingCash),
        notes: notes.trim() ? notes : undefined
      };

      if (overridePin && overrideReason) {
        payload.overridePin = overridePin;
        payload.overrideReason = overrideReason;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to close shift');
      }

      localStorage.removeItem('shift_override_pin');
      localStorage.removeItem('shift_override_reason');
      
      toast.success('Shift closed successfully');
      localStorage.removeItem('pos_shift');
      localStorage.removeItem('pos_session');
      setIsSuccess(true);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred closing the shift');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 text-slate-900">
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Shift Closed Successfully</h2>
            <p className="text-xs text-slate-500 mb-6">Would you like to generate and download the shift summary report?</p>
            
            <div className="flex flex-col gap-2.5 w-full">
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/report?format=pdf`, '_blank');
                }}
                className="w-full h-11 bg-[#FF5722] text-white rounded-xl font-semibold text-xs hover:bg-orange-600 transition-colors flex justify-center items-center gap-2 shadow-xs"
              >
                <Printer size={15} />
                Print Report
              </button>
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/report?format=pdf`, '_blank');
                }}
                className="w-full h-11 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
              >
                <Download size={15} />
                Download PDF
              </button>
              <button 
                onClick={() => router.push('/login')}
                className="w-full h-10 mt-1 text-slate-500 font-semibold text-xs hover:text-slate-900 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5722]">
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Close Shift</h2>
                  <p className="text-xs text-slate-500 font-medium">Reconcile cash and review totals</p>
                </div>
              </div>
              
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#FF5722] animate-spin"></div>
                  <span className="text-xs font-medium">Calculating totals...</span>
                </div>
              ) : !summary ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-rose-600 font-bold text-xs">Failed to load shift summary.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                        <Timer size={13} className="text-slate-400" />
                        Duration
                      </p>
                      <p className="text-base font-bold text-slate-900 font-mono">{formatDuration(summary.openedAt)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                        <Receipt size={13} className="text-slate-400" />
                        Orders
                      </p>
                      <p className="text-base font-bold text-slate-900 font-mono">{summary.totalOrders}</p>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                        <Banknote size={13} className="text-slate-400" />
                        Net Sales
                      </p>
                      <p className="text-base font-bold text-emerald-600 font-mono">PKR {summary.totalSales.toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                        <Wallet size={13} className="text-amber-600" />
                        Expected Cash
                      </p>
                      <p className="text-base font-bold text-amber-900 font-mono">
                        PKR {expectedCash.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Cash Reconciliation */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Actual Cash In Drawer
                    </label>
                    
                    <div className="relative">
                      <div className="h-12 border border-slate-300 focus-within:border-[#FF5722] rounded-xl bg-white flex items-center px-3.5 transition-colors shadow-xs">
                        <span className="text-xs font-bold text-slate-400 mr-2 font-mono">PKR</span>
                        <div className="w-[1px] h-4 bg-slate-200 mr-2"></div>
                        <input
                          type="number"
                          value={closingCash}
                          onChange={(e) => setClosingCash(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-transparent border-none text-right text-lg font-bold text-slate-900 focus:ring-0 placeholder:text-slate-400 outline-none font-mono"
                          placeholder="0"
                          autoFocus
                        />
                      </div>
                    </div>
                    
                    {/* Variance indicator */}
                    {closingCash !== '' && (
                      <div className={`mt-2.5 flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs font-semibold ${
                        variance === 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : variance > 0 
                            ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {variance === 0 ? <Check size={14} /> : variance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>
                          {variance === 0 
                            ? 'Drawer is perfectly balanced' 
                            : variance > 0 
                              ? `Over by PKR ${Math.abs(variance).toLocaleString()}` 
                              : `Short by PKR ${Math.abs(variance).toLocaleString()}`
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono mb-1.5 flex items-center gap-1.5">
                      <FileEdit size={13} className="text-slate-400" />
                      Shift Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Record any explanations for variance, payouts, or notes..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs outline-none focus:border-[#FF5722] focus:bg-white transition-all resize-none h-20 placeholder:text-slate-400"
                    />
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2.5">
              <button
                onClick={onClose}
                className="w-1/3 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || isSubmitting || closingCash === ''}
                className="w-2/3 h-11 rounded-xl bg-[#FF5722] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <CheckCheck size={16} />
                    <span>Confirm & Close Shift</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


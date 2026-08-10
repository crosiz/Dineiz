'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPosShift, getToken } from '@/lib/pos-session';

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in font-body-md text-[#0F172A]">
      <div className="w-full max-w-[480px] bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[90vh] animate-slide-up">
        
        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h2 className="text-[22px] font-bold text-[#0F172A] clash-display tracking-wide mb-2">Shift Closed Successfully</h2>
            <p className="text-[#64748B] mb-8">Would you like to generate and download the shift report?</p>
            
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/report?format=pdf`, '_blank');
                }}
                className="w-full py-3.5 bg-[var(--pos-primary)] text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex justify-center items-center gap-2 shadow-md shadow-orange-500/20"
              >
                <span className="material-symbols-outlined text-[20px]">print</span>
                Print Report
              </button>
              <button 
                onClick={() => {
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/${shiftId}/report?format=pdf`, '_blank');
                }}
                className="w-full py-3.5 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl font-bold hover:bg-[#F8FAFC] transition-colors flex justify-center items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">download</span>
                Download PDF
              </button>
              <button 
                onClick={() => router.push('/login')}
                className="w-full py-3.5 mt-2 text-[#64748B] font-bold hover:text-[#0F172A] transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] p-6 flex justify-between items-center relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D97706]">schedule</span>
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-[#0F172A] clash-display tracking-wide leading-none">Close Shift</h2>
              <p className="text-[13px] text-[#64748B] font-medium mt-1">Review summary and reconcile cash</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="relative z-10 w-9 h-9 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-[#64748B]">
              <div className="w-12 h-12 rounded-full border-4 border-[#CBD5E1] border-t-[var(--pos-primary,#F59E0B)] animate-spin"></div>
              <span className="text-[14px] font-medium tracking-wide">Calculating totals...</span>
            </div>
          ) : !summary ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">error</span>
              </div>
              <p className="text-rose-600 font-bold">Failed to load shift summary.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-[16px] flex flex-col justify-between">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    Duration
                  </p>
                  <p className="text-[20px] font-bold text-[#0F172A] font-mono">{formatDuration(summary.openedAt)}</p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-[16px] flex flex-col justify-between">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                    Orders
                  </p>
                  <p className="text-[20px] font-bold text-[#0F172A]">{summary.totalOrders}</p>
                </div>
                
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-[16px] flex flex-col justify-between">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    Net Sales
                  </p>
                  <p className="text-[20px] font-bold text-emerald-600">PKR {summary.totalSales.toLocaleString()}</p>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-[16px] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10">
                    <span className="material-symbols-outlined text-[80px] text-amber-700">account_balance_wallet</span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-[0.05em] mb-2 relative z-10">
                    Expected Cash
                  </p>
                  <p className="text-[24px] font-bold text-amber-900 relative z-10 leading-none mt-1">
                    <span className="text-[14px] mr-1">PKR</span>{expectedCash.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Cash Reconciliation */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] p-5 shadow-sm">
                <label className="block text-[12px] font-bold text-[#0F172A] uppercase tracking-[0.05em] mb-3">
                  Actual Cash In Drawer
                </label>
                
                <div className="relative group">
                  <div className="h-[64px] border-2 border-[#CBD5E1] group-focus-within:border-[var(--pos-primary,#F59E0B)] rounded-[14px] bg-white flex items-center px-4 transition-all duration-300 shadow-sm">
                    <div className="flex items-center">
                      <span className="text-[16px] font-bold text-[#D97706] mr-3">PKR</span>
                      <div className="w-[2px] h-6 bg-[#CBD5E1]"></div>
                    </div>
                    <input
                      type="number"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent border-none text-right text-[26px] font-bold text-[#0F172A] focus:ring-0 placeholder:text-[#94A3B8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                </div>
                
                {/* Variance indicator */}
                <div className="mt-4 min-h-[24px]">
                  {closingCash !== '' && (
                    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold ${
                      variance === 0 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : variance > 0 
                          ? 'bg-sky-50 text-sky-700 border border-sky-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {variance === 0 ? 'check_circle' : variance > 0 ? 'trending_up' : 'trending_down'}
                      </span>
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
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[12px] font-bold text-[#0F172A] uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">edit_note</span>
                  Shift Notes <span className="text-[#64748B] font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record any explanations for variance, refunds, payouts..."
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-[14px] p-4 text-[#0F172A] text-[14px] outline-none focus:border-[var(--pos-primary,#F59E0B)] focus:ring-1 focus:ring-[var(--pos-primary,#F59E0B)] transition-all resize-none h-[88px] placeholder:text-[#94A3B8]"
                />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || closingCash === ''}
            className="w-full h-[56px] rounded-[14px] bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
                Close Shift
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

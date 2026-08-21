'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { useTopBar } from '@/hooks/useTopBar';
import { toast } from 'sonner';
import { ChevronLeft, FileText, Download, Clock, CheckCircle2 } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import { downloadShiftReport } from '@/lib/shift-report';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ShiftReportSelectorPage() {
  const router = useRouter();
  const session = useCartStore(s => s.session);
  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useTopBar({
    pageTitle: 'Shift Reports',
    breadcrumb: 'Select a Shift',
    showBackButton: true,
  });

  useEffect(() => {
    if (!session?.branchId) return;
    
    const fetchShifts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/shifts?branchId=${session.branchId}&limit=50`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Filter to today's shifts (or keep all recent 50)
          setShifts(data.data || []);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load shifts');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShifts();
  }, [session?.branchId]);

  const handleDownload = async (shiftId: string, format: 'pdf' | 'excel') => {
    if (downloadingId) return;
    setDownloadingId(shiftId);
    try {
      // downloadShiftReport sends the POS bearer token. The previous version
      // relied on `credentials: 'include'`, which the POS has no session
      // cookie for — every download came back 401 and saved an error blob.
      const { filename } = await downloadShiftReport(shiftId, format);
      toast.success(`Saved ${filename}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to download report');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-[#F8FAFC] p-6 flex justify-center pt-20">
        <div className="w-8 h-8 border-4 border-[var(--pos-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#F8FAFC] text-[#0F172A] pb-24 overflow-y-auto">
      <main className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
        
        {shifts.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-2xl border border-[#E2E8F0]">
            <FileText size={48} className="mx-auto text-[#CBD5E1] mb-4" />
            <p className="font-bold text-[#64748B]">No shifts found for this branch.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map(shift => (
              <div key={shift.id} className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                
                <div className="flex gap-4 items-start">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${shift.status === 'OPEN' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                    {shift.status === 'OPEN' ? <Clock size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px]">{shift.user?.name || 'Unknown Cashier'}</h3>
                    <div className="text-[13px] text-[#64748B] space-y-0.5 mt-1">
                      <p>Opened: {new Date(shift.openedAt).toLocaleString()}</p>
                      {shift.closedAt && <p>Closed: {new Date(shift.closedAt).toLocaleString()}</p>}
                      {shift.status === 'OPEN' && <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded">Interim Report</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => handleDownload(shift.id, 'pdf')}
                    disabled={downloadingId === shift.id}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl hover:bg-[#F8FAFC] transition-colors font-bold text-[14px]"
                  >
                    <Download size={18} />
                    PDF
                  </button>
                  <button
                    onClick={() => handleDownload(shift.id, 'excel')}
                    disabled={downloadingId === shift.id}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-colors font-bold text-[14px] shadow-sm"
                  >
                    <Download size={18} />
                    Excel
                  </button>
                </div>
                
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

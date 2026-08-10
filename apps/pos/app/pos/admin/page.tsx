'use client';

import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTopBar } from '@/hooks/useTopBar';
import { 
  ChevronRight, 
  RefreshCw, 
  ShieldAlert, 
  FileText, 
  Lock, 
  Receipt, 
  Ban, 
  Percent, 
  LayoutGrid, 
  CheckCircle2, 
  XCircle,
  Clock,
  User,
  Printer
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function AdminPage() {
  const router = useRouter();
  const session = useCartStore(s => s.session);

  const [stats, setStats] = useState({ revenue: 0, orders: 0, activeCashiers: 2, openTables: 5 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeShifts, setActiveShifts] = useState<any[]>([
    { id: '1', cashierName: 'Ali Khan', duration: '4h 12m', earned: 45000 },
    { id: '2', cashierName: 'Sara Ahmed', duration: '2h 45m', earned: 21500 }
  ]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  
  const [pdfMode, setPdfMode] = useState(true);

  useEffect(() => {
    try {
      const settings = localStorage.getItem('pos_tenant_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setPdfMode(parsed.printing?.usePDFMode !== false);
      }
    } catch(e) {}
  }, []);

  const togglePdfMode = () => {
    try {
      const settingsStr = localStorage.getItem('pos_tenant_settings') || '{}';
      const parsed = JSON.parse(settingsStr);
      if (!parsed.printing) parsed.printing = {};
      parsed.printing.usePDFMode = !pdfMode;
      localStorage.setItem('pos_tenant_settings', JSON.stringify(parsed));
      setPdfMode(!pdfMode);
      toast.success(`Printing Mode: ${!pdfMode ? 'PDF (Dev)' : 'Hardware Printer'}`);
    } catch(e) {}
  };
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useTopBar({
    pageTitle: 'Manager Panel',
    breadcrumb: session?.branchName ? `Branch: ${session.branchName}` : 'Manager Full Access',
    rightActions: (
      <div className="flex items-center gap-4">
        <button onClick={() => { localStorage.removeItem('pos_session'); router.push('/login'); }} title="Logout">
          <span className="material-symbols-outlined text-red-500 cursor-pointer hover:text-red-600 transition-opacity">power_settings_new</span>
        </button>
      </div>
    )
  });

  const fetchStats = async () => {
    if (!session?.branchId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/analytics/today?branchId=${session.branchId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(prev => ({
          ...prev,
          revenue: data.revenue || 0,
          orders: data.orders || 0
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Visual feedback delay
    }
  };

  useEffect(() => {
    fetchStats();
    let interval: NodeJS.Timeout;
    if (session?.branchId) {
      const fetchVoids = async () => {
        try {
          const res = await fetch(`${API_URL}/api/pos/void-requests?branchId=${session.branchId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
          });
          if (res.ok) {
            const data = await res.json();
            setPendingApprovals(data);
          }
        } catch(e) {}
      };
      fetchVoids();
      interval = setInterval(fetchVoids, 3000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.branchId]);

  // Long Press Logic for Force Close Shift
  const handleTouchStart = (shiftId: string) => {
    longPressTimer.current = setTimeout(() => {
      const reason = prompt('FORCE CLOSE SHIFT: Enter reason for closing this shift remotely:');
      if (reason) {
        toast.success(`Shift force closed with reason: ${reason}`);
        setActiveShifts(prev => prev.filter(s => s.id !== shiftId));
      }
    }, 1000);
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleApprove = async (id: string) => {
    const prev = [...pendingApprovals];
    setPendingApprovals(p => p.filter(x => x.id !== id));
    try {
      const res = await fetch(`${API_URL}/api/pos/void-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
      });
      if (res.ok) {
        toast.success('Void request approved');
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to approve' }));
        toast.error(err.error || 'Failed to approve');
        setPendingApprovals(prev);
      }
    } catch (e: any) {
      toast.error(e.message || 'Error approving');
      setPendingApprovals(prev);
    }
  };

  const handleDeny = async (id: string) => {
    const prev = [...pendingApprovals];
    setPendingApprovals(p => p.filter(x => x.id !== id));
    try {
      const res = await fetch(`${API_URL}/api/pos/void-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
      });
      if (res.ok) toast.success('Void request rejected');
      else {
        toast.error('Failed to reject');
        setPendingApprovals(prev);
      }
    } catch (e) {
      toast.error('Error rejecting');
      setPendingApprovals(prev);
    }
  };

  return (
    <div className="h-full bg-[#F8FAFC] text-[#0F172A] pb-24 font-body-md select-none overflow-y-auto">
      <main className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
        
        {/* Section 1: Today at a Glance */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider">Today at a Glance</h2>
            <button 
              onClick={fetchStats}
              className={`p-1.5 rounded-full text-[#64748B] hover:bg-[#E2E8F0] transition-colors ${isRefreshing ? 'animate-spin text-[var(--pos-primary)]' : ''}`}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5 grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-[12px] text-[#64748B] font-semibold mb-1">Today's Revenue</p>
              <p className="text-[24px] font-bold text-[var(--pos-primary)]">PKR {stats.revenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-semibold mb-1">Total Orders</p>
              <p className="text-[24px] font-bold">{stats.orders}</p>
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-semibold mb-1">Active Cashiers</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[20px] font-bold">{stats.activeCashiers}</p>
              </div>
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-semibold mb-1">Open Tables</p>
              <p className="text-[20px] font-bold">{stats.openTables}</p>
            </div>
          </div>
        </section>

        {/* Section 2: Active Shifts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider">Active Shifts</h2>
            <span className="bg-[#E2E8F0] text-[#475569] text-[11px] font-bold px-2 py-0.5 rounded-full">{activeShifts.length}</span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden divide-y divide-[#E2E8F0]">
            {activeShifts.map(shift => (
              <div 
                key={shift.id}
                onMouseDown={() => handleTouchStart(shift.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={() => handleTouchStart(shift.id)}
                onTouchEnd={handleTouchEnd}
                className="p-4 flex justify-between items-center bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer select-none active:bg-[#F1F5F9]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <p className="font-bold text-[15px]">{shift.cashierName}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-[#64748B] mt-0.5">
                      <Clock size={12} />
                      <span>{shift.duration}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-[#0F172A]">PKR {shift.earned.toLocaleString()}</p>
                </div>
              </div>
            ))}
            <div 
              className="p-4 flex justify-between items-center bg-[#F8FAFC] text-[var(--pos-primary)] hover:bg-[#F1F5F9] transition-colors cursor-pointer font-bold"
              onClick={() => toast.info('Navigating to full shift list...')}
            >
              <span>View All Shifts</span>
              <ChevronRight size={20} />
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2 px-2 text-center">Long-press a shift to force close remotely.</p>
        </section>

        {/* Section 3: Pending Approvals */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider">Pending Approvals</h2>
            {pendingApprovals.length > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">{pendingApprovals.length}</span>
            )}
          </div>
          
          {pendingApprovals.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 text-center text-[#94A3B8]">
              <ShieldAlert size={32} className="mx-auto mb-2 opacity-50" />
              <p className="font-medium text-[14px]">No pending manager approvals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map(req => (
                <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-red-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-red-100 text-red-700`}>
                          VOID ITEM
                        </span>
                        <span className="text-[12px] font-bold text-[#64748B]">Requested by {req.cashier?.name}</span>
                      </div>
                      <p className="text-[14px] font-medium text-[#0F172A]">Order #{req.order?.orderNumber} • Remove {req.quantity}x • Reason: {req.reason}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDeny(req.id)}
                      className="flex-1 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] font-bold text-[13px] hover:bg-[#F8FAFC] transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle size={16} /> Deny
                    </button>
                    <button 
                      onClick={() => handleApprove(req.id)}
                      className="flex-1 py-2 rounded-lg bg-[#10b981] text-white font-bold text-[13px] hover:bg-[#059669] transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 size={16} /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Quick Actions */}
        <section>
          <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden divide-y divide-[#E2E8F0]">
            <ActionRow 
              icon={<Receipt size={20} className="text-blue-500" />} 
              label="Reprint Last Receipt" 
              onClick={() => toast.info('Opening recent orders...')} 
            />
            <ActionRow 
              icon={<Ban size={20} className="text-red-500" />} 
              label="Void an Order" 
              onClick={() => toast.info('Opening void terminal...')} 
            />
            <ActionRow 
              icon={<Percent size={20} className="text-amber-500" />} 
              label="Apply Discount to Order" 
              onClick={() => toast.info('Opening discount terminal...')} 
            />
            <ActionRow 
              icon={<LayoutGrid size={20} className="text-purple-500" />} 
              label="Override Table Status" 
              onClick={() => toast.info('Opening table manager...')} 
            />
            <ActionRow 
              icon={<Lock size={20} className="text-[#64748B]" />} 
              label="Lock This Terminal" 
              onClick={() => { localStorage.clear(); router.push('/login'); }} 
            />
          </div>
        </section>

        {/* Section 5: Shift Report */}
        <section>
          <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Shift Report</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden divide-y divide-[#E2E8F0]">
            <ActionRow 
              icon={<FileText size={20} className="text-indigo-500" />} 
              label="Generate Shift Report" 
              onClick={() => router.push('/pos/admin/reports/shift')} 
            />
            <ActionRow 
              icon={<FileText size={20} className="text-teal-500" />} 
              label="Today's Summary" 
              onClick={() => toast.info('Loading summary...')} 
            />
          </div>
        </section>

        {/* Section 6: Printing Settings */}
        <section>
          <h2 className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Printing Settings</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden divide-y divide-[#E2E8F0]">
            <div className="p-4 flex items-center justify-between bg-white hover:bg-[#F8FAFC] transition-colors">
              <div className="flex items-center gap-3">
                <Printer size={20} className="text-gray-500" />
                <div>
                  <span className="font-bold text-[15px] text-[#0F172A] block">PDF Mode (Development)</span>
                  <span className="text-[12px] text-[#64748B]">Generate PDF instead of sending ESC/POS</span>
                </div>
              </div>
              <button 
                onClick={togglePdfMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pdfMode ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pdfMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {!pdfMode && (
              <ActionRow 
                icon={<Printer size={20} className="text-gray-500" />} 
                label="Connect USB Printer" 
                onClick={async () => {
                   try {
                     const { requestPrinter } = await import('@/lib/printer/webusb');
                     await requestPrinter();
                     toast.success('Printer connected successfully!');
                   } catch(e: any) {
                     toast.error(e.message || 'Failed to connect printer');
                   }
                }} 
              />
            )}
          </div>
        </section>
        
        
      </main>
    </div>
  );
}

function ActionRow({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="p-4 flex items-center justify-between bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition-colors cursor-pointer select-none"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-bold text-[15px] text-[#0F172A]">{label}</span>
      </div>
      <ChevronRight size={20} className="text-[#CBD5E1]" />
    </div>
  );
}

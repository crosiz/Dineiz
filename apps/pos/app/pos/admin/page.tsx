'use client';

import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTopBar } from '@/hooks/useTopBar';
import { clearPosSession } from '@/lib/pos-session';
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

  const [stats, setStats] = useState({ revenue: 0, orders: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeShifts, setActiveShifts] = useState<any[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [openTables, setOpenTables] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  const [forceCloseTarget, setForceCloseTarget] = useState<{ id: string; name: string } | null>(null);
  const [forceCloseReason, setForceCloseReason] = useState('');
  const [isForceClosing, setIsForceClosing] = useState(false);
  
  const [pdfMode, setPdfMode] = useState(true);

  useEffect(() => {
    try {
      const settingsStr = localStorage.getItem('pos_tenant_settings') || '{}';
      const parsed = JSON.parse(settingsStr);
      const resolved = parsed.printing?.usePDFMode !== false;
      setPdfMode(resolved);
      // Persist the resolved default immediately — previously this only
      // ever read the key, so on a fresh terminal the toggle displayed
      // "PDF Mode: ON" while nothing had actually been written to
      // localStorage yet, leaving print.service.ts to resolve the same
      // unset key independently (and, before the fix there, differently).
      if (parsed.printing?.usePDFMode === undefined) {
        if (!parsed.printing) parsed.printing = {};
        parsed.printing.usePDFMode = true;
        localStorage.setItem('pos_tenant_settings', JSON.stringify(parsed));
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

  // No rightActions here on purpose — this used to add its own Logout
  // button (removing only 'pos_session', leaving a stale 'pos_token'
  // behind) duplicating Sign Out, which already lives in POSTopBar's
  // avatar menu on every screen including this one.
  useTopBar({
    pageTitle: 'Manager Panel',
    breadcrumb: session?.branchName ? `Branch: ${session.branchName}` : 'Manager Full Access',
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

  // Real active shifts for this branch — was previously a hardcoded demo
  // array that never reflected who was actually clocked in.
  const fetchActiveShifts = async () => {
    if (!session?.branchId) return;
    try {
      const res = await fetch(`${API_URL}/api/shifts/active`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShifts(Array.isArray(data) ? data.filter((s: any) => s.branchId === session.branchId) : []);
      }
    } catch (e) {
      // Keep showing the last known list on transient failures
    } finally {
      setShiftsLoading(false);
    }
  };

  // Real open-table count — was previously hardcoded to 5 forever.
  const fetchOpenTables = async () => {
    if (!session?.branchId) return;
    try {
      const [tablesRes, statusesRes] = await Promise.all([
        fetch(`${API_URL}/api/floor-plan/${session.branchId}/tables`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
        }).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API_URL}/api/floor-plan/${session.branchId}/table-orders`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` }
        }).then(r => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      const occupiedIds = new Set(Array.isArray(statusesRes) ? statusesRes.map((s: any) => s.tableId) : []);
      const occupied = Array.isArray(tablesRes)
        ? tablesRes.filter((t: any) => occupiedIds.has(t.id) || t.status === 'OCCUPIED').length
        : 0;
      setOpenTables(occupied);
    } catch (e) {}
  };

  useEffect(() => {
    fetchStats();
    fetchActiveShifts();
    fetchOpenTables();
    let interval: NodeJS.Timeout;
    let shiftsInterval: NodeJS.Timeout;
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
      shiftsInterval = setInterval(() => { fetchActiveShifts(); fetchOpenTables(); }, 20000);
    }
    return () => { clearInterval(interval); clearInterval(shiftsInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.branchId]);

  // Long Press Logic for Force Close Shift — opens a real confirm modal that
  // calls the (already-existing, manager-only) force-close endpoint instead
  // of a native prompt() that only ever touched local state.
  const handleTouchStart = (shift: any) => {
    longPressTimer.current = setTimeout(() => {
      setForceCloseReason('');
      setForceCloseTarget({ id: shift.id, name: shift.user?.name || shift.cashierName || 'this cashier' });
    }, 700);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const confirmForceClose = async () => {
    if (!forceCloseTarget) return;
    // The reason is stored as the shift's closedReason and printed on its
    // report, so it is required rather than optional decoration.
    if (forceCloseReason.trim().length < 3) {
      toast.error('Give a reason — it is recorded on the shift.');
      return;
    }
    setIsForceClosing(true);
    try {
      const res = await fetch(`${API_URL}/api/shifts/${forceCloseTarget.id}/force-close`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('pos_token')}`,
        },
        // `reason` is the field the endpoint reads. Sending it as `notes` meant
        // the reason never reached closedReason — and once a reason became
        // mandatory, every force close from here would have been rejected.
        body: JSON.stringify({ reason: forceCloseReason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to force close shift (${res.status})`);
      }
      toast.success(`${forceCloseTarget.name}'s shift was force closed`);
      setActiveShifts(prev => prev.filter(s => s.id !== forceCloseTarget.id));
      setForceCloseTarget(null);
      setForceCloseReason('');
    } catch (e: any) {
      // Surface what the server actually said instead of blaming the network.
      toast.error(e?.message || 'Could not force close this shift.');
    } finally {
      setIsForceClosing(false);
    }
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
                <p className="text-[20px] font-bold">{activeShifts.length}</p>
              </div>
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-semibold mb-1">Open Tables</p>
              <p className="text-[20px] font-bold">{openTables}</p>
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
            {shiftsLoading ? (
              <div className="p-6 text-center text-[#94A3B8] text-[13px] font-medium">Loading active shifts...</div>
            ) : activeShifts.length === 0 ? (
              <div className="p-6 text-center text-[#94A3B8] text-[13px] font-medium">No cashiers are currently clocked in.</div>
            ) : (
              activeShifts.map(shift => {
                const ms = Date.now() - new Date(shift.openedAt).getTime();
                const h = Math.max(0, Math.floor(ms / 3600000));
                const m = Math.max(0, Math.floor((ms % 3600000) / 60000));
                return (
                  <div
                    key={shift.id}
                    onMouseDown={() => handleTouchStart(shift)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    onTouchStart={() => handleTouchStart(shift)}
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
                          <p className="font-bold text-[15px]">{shift.user?.name || 'Cashier'}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] text-[#64748B] mt-0.5">
                          <Clock size={12} />
                          <span>{h}h {m}m</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold text-[#0F172A]">{shift._count?.orders ?? 0} orders</p>
                    </div>
                  </div>
                );
              })
            )}
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
              onClick={() => { sessionStorage.setItem('pos_tickets_initial_mode', 'history'); router.push('/pos/tickets'); }}
            />
            <ActionRow
              icon={<Ban size={20} className="text-red-500" />}
              label="Void an Order"
              onClick={() => router.push('/pos/tickets')}
            />
            <ActionRow
              icon={<Percent size={20} className="text-amber-500" />}
              label="Apply Discount to Order"
              onClick={() => router.push('/pos/tickets')}
            />
            <ActionRow
              icon={<LayoutGrid size={20} className="text-purple-500" />}
              label="Override Table Status"
              onClick={() => router.push('/pos/tables')}
            />
            <ActionRow
              icon={<Lock size={20} className="text-[#64748B]" />}
              label="Lock This Terminal"
              onClick={() => {
                // clearPosSession() ends the login session without wiping
                // pos_branch_id/pos_branding — localStorage.clear() used to
                // nuke everything, including the terminal's link to its
                // branch, so this terminal came back showing "Branch Not
                // Found" and had to be re-paired with a POS code.
                clearPosSession();
                router.push('/login');
              }}
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

      {/* Force Close Shift modal — replaces the old native prompt() that only
          ever touched local state and never called the backend. */}
      {forceCloseTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-[400px] bg-white border border-[#E2E8F0] rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.25)] overflow-hidden animate-slide-up">
            <div className="p-7">
              <div className="w-12 h-12 rounded-full bg-[#FDECEC] text-[#DC2626] flex items-center justify-center mb-4">
                <ShieldAlert size={24} />
              </div>
              <h2 className="text-[19px] font-bold text-[#0F172A] mb-2">Force Close {forceCloseTarget.name}'s Shift?</h2>
              <p className="text-[14px] text-[#64748B] leading-relaxed mb-4">
                This closes their shift remotely with no cash count. Use this only when the terminal is unreachable.
              </p>
              <textarea
                value={forceCloseReason}
                onChange={(e) => setForceCloseReason(e.target.value)}
                placeholder="Reason for force closing this shift (required)..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[var(--pos-primary,#F59E0B)] transition-colors resize-none h-20 mb-6"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setForceCloseTarget(null)}
                  disabled={isForceClosing}
                  className="flex-1 h-[46px] bg-white text-[#475569] font-bold text-[14px] rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmForceClose}
                  disabled={isForceClosing}
                  className="flex-1 h-[46px] bg-[#DC2626] hover:bg-[#C4362E] text-white font-bold text-[14px] rounded-xl active:scale-95 transition-all shadow-lg shadow-[#DC2626]/25 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isForceClosing ? 'Closing...' : 'Force Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

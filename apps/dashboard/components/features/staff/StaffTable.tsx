'use client';

import React from 'react';
import { MoreHorizontal, Fingerprint, CalendarClock, Pencil, Key, UserX, UserCheck, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useStaff } from './hooks/useStaff';
import { useDashboardContext } from '../../../contexts/dashboard-context';
import { ResetPinModal } from './modals/ResetPinModal';
import { EditStaffModal } from './modals/EditStaffModal';
import { Pagination } from '../../ui/Pagination';

interface StaffTableProps {
  staffList: any[];
  pagination: { total: number, page: number, limit: number, totalPages: number };
  filters: any;
  setFilters: any;
}

export function StaffTable({ staffList, pagination, filters, setFilters }: StaffTableProps) {
  const { selectedBranchId } = useDashboardContext();
  const showBranchColumn = selectedBranchId === null;
  const [resetPinStaff, setResetPinStaff] = React.useState<any>(null);
  const [editStaff, setEditStaff] = React.useState<any>(null);
  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'BRANCH_MANAGER': return <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">Branch Manager</span>;
      case 'CASHIER': return <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">Cashier</span>;
      case 'WAITER': return <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">Waiter</span>;
      case 'KITCHEN_STAFF': return <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Kitchen Staff</span>;
      case 'RIDER': return <span className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-semibold">Rider</span>;
      default: return <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold capitalize">{role.replace('_', ' ').toLowerCase()}</span>;
    }
  };

  const getStatusDisplay = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium text-slate-700">Active</span>
        </div>
      );
    }
    if (status === 'PENDING') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <span className="text-sm font-medium text-slate-700">Pending</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
        <span className="text-sm font-medium text-slate-700">Inactive</span>
      </div>
    );
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
            <tr>
              <th className="w-[280px] px-6 py-4">Name</th>
              <th className="w-40 px-6 py-4">Role</th>
              {showBranchColumn && <th className="w-40 px-6 py-4">Branch</th>}
              <th className="w-32 px-6 py-4">Status</th>
              <th className="w-32 px-6 py-4">Last Active</th>
              <th className="w-32 px-6 py-4">Biometric</th>
              <th className="w-20 px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.map((staff) => (
              <StaffRow key={staff.id} staff={staff} showBranchColumn={showBranchColumn} onResetPin={setResetPinStaff} onEditStaff={setEditStaff} />
            ))}
            
            {staffList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
        <div>
          Showing <span className="font-bold text-slate-900">{staffList.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}-{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-slate-900">{pagination.total}</span> staff
        </div>
        <Pagination 
          currentPage={pagination.page} 
          totalPages={Math.max(1, pagination.totalPages)} 
          onPageChange={(page) => setFilters({ ...filters, page })} 
          pageSize={pagination.limit}
          onPageSizeChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
        />
      </div>
      {resetPinStaff && (
        <ResetPinModal
          isOpen={true}
          onClose={() => setResetPinStaff(null)}
          staffId={resetPinStaff.id}
          staffName={resetPinStaff.name}
        />
      )}
      <EditStaffModal
        isOpen={!!editStaff}
        onClose={() => setEditStaff(null)}
        staff={editStaff}
      />
    </div>
  );
}

function StaffRow({ staff, showBranchColumn, onResetPin, onEditStaff }: { staff: any, showBranchColumn: boolean, onResetPin: (staff: any) => void, onEditStaff: (staff: any) => void }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { toggleStatus, deleteStaff, resendInvite } = useStaff();

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'BRANCH_MANAGER': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Branch Manager</span>;
      case 'TENANT_ADMIN': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Tenant Admin</span>;
      case 'CASHIER': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Cashier</span>;
      case 'WAITER': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Waiter</span>;
      case 'KITCHEN_STAFF': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>Kitchen Staff</span>;
      case 'RIDER': return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Rider</span>;
      case 'WORKER': 
      case 'COOK':
      case 'GUARD':
        return (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{role}</span>
          </div>
        );
      default: return <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{role}</span>;
    }
  };

  const getStatusDisplay = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <span className="text-[12px] font-medium text-slate-500">Active</span>
        </div>
      );
    }
    if (status === 'PENDING') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
          <span className="text-[12px] font-medium text-slate-500">Pending</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
        <span className="text-[12px] font-medium text-slate-500">Inactive</span>
      </div>
    );
  };

  const getRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
            style={{ backgroundColor: `${staff.avatarColor}15`, color: staff.avatarColor }}
          >
            {staff.avatarInitials}
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{staff.name}</p>
            <p className="text-[12px] font-medium text-slate-500 mt-0.5">{staff.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {getRoleBadge(staff.role)}
      </td>
      {showBranchColumn && (
        <td className="px-6 py-4">
          {staff.branch ? (
            <span
              className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center"
              title={staff.branch.branchCode}
            >
              {staff.branch.name}
            </span>
          ) : (
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap inline-flex items-center">All Branches</span>
          )}
        </td>
      )}
      <td className="px-6 py-4">
        {getStatusDisplay(staff.status)}
      </td>
      <td className="px-6 py-4">
        {['WORKER', 'COOK', 'GUARD'].includes(staff.role) ? (
          <div className="text-[13px] font-medium text-slate-700">
            <span className="font-bold text-slate-900">{staff.attendanceDaysThisMonth}</span> days this month
          </div>
        ) : (
          <span className="text-[13px] font-medium text-slate-700">
            {staff.lastActiveAt ? getRelativeTime(staff.lastActiveAt) : 'Never'}
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        {staff.zktecoEnrollment ? (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
            <Fingerprint size={14} className="text-teal-600" /> Enrolled
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" title="Enroll on ZKTeco device">
            <Fingerprint size={14} /> Not enrolled
          </div>
        )}
      </td>
      <td className="px-6 py-4 text-right relative">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors inline-flex"
        >
          <MoreHorizontal size={18} />
        </button>
        {isMenuOpen && (
          <div ref={menuRef} className="absolute right-6 top-10 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 text-left">
            <button 
              onClick={() => { setIsMenuOpen(false); onEditStaff(staff); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Pencil size={14} /> Edit Staff
            </button>
            
            {['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER'].includes(staff.role) && (
              <button
                onClick={() => { setIsMenuOpen(false); onResetPin(staff); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Key size={14} /> Reset PIN
              </button>
            )}

            {['BRANCH_MANAGER', 'TENANT_ADMIN'].includes(staff.role) && (
              <button
                onClick={() => { setIsMenuOpen(false); resendInvite.mutate(staff.id); }}
                disabled={resendInvite.isPending}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Mail size={14} /> Resend Invite Email
              </button>
            )}

            <button 
              onClick={() => { setIsMenuOpen(false); toast.info('Biometric enrollment workflow coming soon!'); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Fingerprint size={14} /> 
              {staff.zktecoEnrollment ? 'Manage Fingerprint' : 'Enroll Fingerprint'}
            </button>

            {['WORKER', 'COOK', 'GUARD'].includes(staff.role) && (
              <button 
                onClick={() => { setIsMenuOpen(false); toast.info('Attendance history view coming soon!'); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <CalendarClock size={14} /> View Attendance
              </button>
            )}

            <div className="h-px bg-slate-100 my-1"></div>
            
            <button 
              onClick={() => { toggleStatus.mutate(staff.id); setIsMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              {staff.status === 'ACTIVE'
                ? <><UserX size={14} className="text-orange-500" /> Deactivate</>
                : <><UserCheck size={14} className="text-green-500" /> Activate</>
              }
            </button>

            {/* Currently hiding delete unless superadmin / tenantadmin context is known, or conditionally render it */}
            <div className="h-px bg-slate-100 my-1"></div>
            <button 
              onClick={() => { if(confirm('Are you sure you want to delete this staff member?')) { deleteStaff.mutate(staff.id); setIsMenuOpen(false); } }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

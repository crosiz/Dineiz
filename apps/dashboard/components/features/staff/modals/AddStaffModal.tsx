'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStaff } from '../hooks/useStaff';
import { RoleSelectorCard } from './RoleSelectorCard';
import { useUser } from '@/contexts/user-context';
import { BranchSelect } from '@/components/ui/branch-select';
import { useSearchParams } from 'next/navigation';

// ─── Role buckets ─────────────────────────────────────────────────────────────
const DASHBOARD_LOGIN_ROLES = ['BRANCH_MANAGER'] as const;
const POS_LOGIN_ROLES = ['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────
export const staffSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.enum(['BRANCH_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'RIDER', 'WORKER', 'COOK', 'GUARD']),
  branchId: z.string().min(1, 'Branch assignment is required'),
  // Dashboard password (Branch Manager only)
  password: z.string().optional(),
  // POS PIN (all other roles)
  posPin: z.string().optional(),
}).superRefine((data, ctx) => {
  if ((DASHBOARD_LOGIN_ROLES as readonly string[]).includes(data.role)) {
    if (!data.password || data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must be at least 8 characters',
        path: ['password'],
      });
    }
  }
  
  if ((POS_LOGIN_ROLES as readonly string[]).includes(data.role)) {
    if (!data.posPin || data.posPin.length !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PIN must be exactly 4 digits',
        path: ['posPin'],
      });
    }
  }
});

export type StaffFormData = z.infer<typeof staffSchema>;

// ─── Password strength ────────────────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const getStrength = (pw: string) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-400' };
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-400' };
    if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-400' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? color : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        label === 'Weak' ? 'text-red-500' :
        label === 'Fair' ? 'text-amber-500' :
        label === 'Good' ? 'text-yellow-600' : 'text-green-600'
      }`}>{label}</p>
    </div>
  );
}

// ─── Dashboard password field (Branch Manager) ────────────────────────────────
function DashboardPasswordField() {
  const { register, watch, formState: { errors } } = useFormContext<StaffFormData>();
  const [showPw, setShowPw] = useState(false);
  const password = watch('password') || '';

  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
        DASHBOARD PASSWORD *
      </label>
      <div className="relative">
        <input
          {...register('password')}
          type={showPw ? 'text' : 'password'}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          className={`w-full h-10 px-4 pr-11 rounded-lg border bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all ${
            errors.password ? 'border-red-300' : 'border-slate-200'
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <PasswordStrengthBar password={password} />
      {errors.password && (
        <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
      )}
      <p className="text-xs text-slate-400 mt-1.5">
        Branch managers log in to the dashboard with this password
      </p>
    </div>
  );
}

// ─── POS PIN field (Cashier / Waiter / Kitchen / Rider) ───────────────────────
function POSPINField() {
  const { setValue, watch, formState: { errors } } = useFormContext<StaffFormData>();
  const pin = watch('posPin') || '';
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAutogenerate = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setValue('posPin', randomPin, { shouldValidate: true });
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    if (!val) return;
    const digits = pin.split('');
    while (digits.length < 4) digits.push('');
    digits[index] = val;
    setValue('posPin', digits.join('').substring(0, 4), { shouldValidate: true });
    if (index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const digits = pin.split('');
      digits[index] = '';
      setValue('posPin', digits.join(''));
      if (index > 0) inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
          POS SECURITY PIN *
        </label>
        <button
          type="button"
          onClick={handleAutogenerate}
          className="text-[#ff5722] text-xs font-bold hover:underline"
        >
          AUTOGENERATE
        </button>
      </div>

      <div className="flex items-center gap-3">
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
            className={`w-12 h-14 border-2 rounded-xl text-center text-xl font-bold outline-none transition-colors ${
              errors.posPin
                ? 'border-red-300 focus:border-red-500 bg-red-50'
                : 'border-slate-200 focus:border-[#ff5722]'
            }`}
          />
        ))}
      </div>
      {errors.posPin && (
        <p className="text-red-500 text-xs mt-2">{errors.posPin.message}</p>
      )}
      <p className="text-xs text-slate-400 mt-2">
        Used to log in at the POS terminal / KDS screen / Rider app
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddStaffModal({ isOpen, onClose }: AddStaffModalProps) {
  const { createStaff } = useStaff();
  const [showAllRoles, setShowAllRoles] = useState(false);
  const user = useUser();
  const searchParams = useSearchParams();

  const initialBranchId =
    user.role === 'BRANCH_MANAGER'
      ? user.branchId || ''
      : searchParams.get('branch') || '';

  const methods = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'CASHIER',
      branchId: initialBranchId,
      password: '',
      posPin: '',
    },
  });

  const { register, handleSubmit, watch, formState: { errors } } = methods;
  const selectedRole = watch('role');

  const isDashboardRole = (DASHBOARD_LOGIN_ROLES as readonly string[]).includes(selectedRole);
  const isPOSRole = (POS_LOGIN_ROLES as readonly string[]).includes(selectedRole);

  useEffect(() => {
    if (isOpen && user.role === 'BRANCH_MANAGER' && user.branchId) {
      methods.setValue('branchId', user.branchId, { shouldValidate: true });
    }
  }, [isOpen, user.role, user.branchId, methods]);

  // Reset credential fields when role category changes
  useEffect(() => {
    if (!isDashboardRole) {
      methods.setValue('password', '');
    }
    if (!isPOSRole) {
      methods.setValue('posPin', '');
    }
  }, [isDashboardRole, isPOSRole, methods]);

  const onSubmit = handleSubmit((data) => {
    createStaff.mutate(data);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-[480px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add Staff Member</h2>
            <p className="text-sm text-slate-500">Configure profile and access levels</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 flex-1 overflow-y-auto space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  FULL NAME *
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. John Doe"
                  className={`w-full h-10 px-4 rounded-lg border bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all ${
                    errors.name ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* Email — required for manager, optional label for POS roles */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  EMAIL ADDRESS {isDashboardRole ? '*' : <span className="normal-case font-medium">(optional)</span>}
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="john@example.com"
                  className={`w-full h-10 px-4 rounded-lg border bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all ${
                    errors.email ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  PHONE NUMBER
                </label>
                <input
                  {...register('phone')}
                  placeholder="+1 (555) 000-0000"
                  className={`w-full h-10 px-4 rounded-lg border bg-white text-sm focus:outline-none focus:border-[#ff5722] focus:ring-2 focus:ring-orange-100 transition-all ${
                    errors.phone ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  STAFF ROLE
                </label>

                <RoleSelectorCard
                  value="BRANCH_MANAGER"
                  title="Branch Manager"
                  description="Full control over a specific branch, menu, and staff reports."
                />
                <RoleSelectorCard
                  value="CASHIER"
                  title="Cashier"
                  description="Access to POS terminal, processing orders and payments."
                />
                <RoleSelectorCard
                  value="WAITER"
                  title="Waiter"
                  description="Order taking, table management, and order tracking."
                />

                {!showAllRoles && (
                  <button
                    type="button"
                    onClick={() => setShowAllRoles(true)}
                    className="w-full py-2 text-sm text-[#ff5722] font-semibold hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    Show More Roles <ChevronDown size={16} />
                  </button>
                )}

                {showAllRoles && (
                  <>
                    <RoleSelectorCard
                      value="KITCHEN_STAFF"
                      title="Kitchen Staff"
                      description="KDS access only for managing food preparation."
                    />
                    <RoleSelectorCard
                      value="RIDER"
                      title="Rider"
                      description="Delivery app access for tracking and completing deliveries."
                    />
                    <RoleSelectorCard
                      value="WORKER"
                      title="Worker"
                      description="General worker with attendance tracking only. No POS/App access."
                    />
                    <RoleSelectorCard
                      value="COOK"
                      title="Cook"
                      description="Kitchen worker with attendance tracking only. No POS/App access."
                    />
                    <RoleSelectorCard
                      value="GUARD"
                      title="Guard"
                      description="Security guard with attendance tracking only. No POS/App access."
                    />
                  </>
                )}
              </div>

              {/* Branch */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  ASSIGN TO BRANCH
                </label>
                {user.role === 'BRANCH_MANAGER' ? (
                  <div className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center text-sm text-slate-500">
                    {user.branch?.name || 'Your Branch'} (Locked)
                  </div>
                ) : (
                  <BranchSelect
                    value={methods.watch('branchId')}
                    onChange={(val) => methods.setValue('branchId', val || '', { shouldValidate: true })}
                    placeholder="Select Branch"
                    error={errors.branchId?.message}
                  />
                )}
              </div>

              {/* ── Credential section (role-conditional) ── */}
              <div className="border-t border-slate-100 pt-6">
                {isDashboardRole && <DashboardPasswordField />}
                {isPOSRole && <POSPINField />}
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
              <button
                type="button"
                className="px-6 h-10 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={onClose}
                disabled={createStaff.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createStaff.isPending}
                className="px-6 py-3 bg-[#ff5722] text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-orange-200"
              >
                {createStaff.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Staff Member'
                )}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

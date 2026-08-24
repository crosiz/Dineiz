'use client';

import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStaff, StaffMember } from '../hooks/useStaff';
import { BranchSelect } from '@/components/ui/branch-select';

export const editStaffSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  branchId: z.string().min(1, 'Branch assignment is required'),
});

export type EditStaffFormData = z.infer<typeof editStaffSchema>;

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
}

export function EditStaffModal({ isOpen, onClose, staff }: EditStaffModalProps) {
  const { updateStaff } = useStaff();

  const methods = useForm<EditStaffFormData>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      name: '',
      phone: '',
      branchId: '',
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = methods;

  useEffect(() => {
    if (staff) {
      reset({
        name: staff.name,
        phone: staff.phone || '',
        branchId: staff.branch?.id || 'all',
      });
    }
  }, [staff, reset]);

  if (!isOpen || !staff) return null;

  const onSubmit = (data: EditStaffFormData) => {
    const payload = {
      name: data.name,
      phone: data.phone,
      branchId: data.branchId === 'all' ? null : data.branchId,
    };

    updateStaff.mutate({ id: staff.id, data: payload }, {
      onSuccess: () => {
        reset();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Edit Staff Member</h2>
            <p className="text-sm text-slate-500 mt-1">Update details for {staff.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <FormProvider {...methods}>
            <form id="edit-staff-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    FULL NAME *
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    placeholder="e.g. Ali Khan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    PHONE NUMBER
                  </label>
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="e.g. +92 300 1234567"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    BRANCH ASSIGNMENT *
                  </label>
                  <BranchSelect
                    value={methods.watch('branchId')}
                    onChange={(val) => methods.setValue('branchId', val || '')}
                    error={errors.branchId?.message}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Which branch does this staff member work at?
                  </p>
                </div>
              </div>

            </form>
          </FormProvider>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-staff-form"
            disabled={updateStaff.isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            {updateStaff.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

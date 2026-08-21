'use client';

import React, { useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSuppliers, Supplier } from '../hooks/useSuppliers';
import { DELIVERY_DAYS } from './supplierConstants';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  minOrderValue: z.number().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editSupplier?: Supplier | null;
}

export function SupplierFormModal({ isOpen, onClose, editSupplier }: SupplierFormModalProps) {
  const { createSupplier, updateSupplier } = useSuppliers();
  const isEdit = !!editSupplier;
  const [deliveryDays, setDeliveryDays] = React.useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', contactName: '', phone: '', whatsapp: '', email: '', address: '', paymentTerms: '', notes: '' },
  });

  useEffect(() => {
    if (editSupplier) {
      reset({
        name: editSupplier.name,
        contactName: editSupplier.contactName || '',
        phone: editSupplier.phone || '',
        whatsapp: editSupplier.whatsapp || '',
        email: editSupplier.email || '',
        address: editSupplier.address || '',
        paymentTerms: editSupplier.paymentTerms || '',
        minOrderValue: editSupplier.minOrderValue ?? undefined,
        rating: editSupplier.rating ?? undefined,
        notes: editSupplier.notes || '',
      });
      setDeliveryDays(editSupplier.deliveryDays ?? []);
    } else if (isOpen) {
      reset({ name: '', contactName: '', phone: '', whatsapp: '', email: '', address: '', paymentTerms: '', notes: '' });
      setDeliveryDays([]);
    }
  }, [editSupplier, isOpen, reset]);

  const rating = watch('rating');

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setDeliveryDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleClose = () => {
    reset();
    setDeliveryDays([]);
    onClose();
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name,
      contactName: data.contactName || undefined,
      phone: data.phone || undefined,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      paymentTerms: data.paymentTerms || undefined,
      deliveryDays,
      minOrderValue: data.minOrderValue || undefined,
      rating: data.rating || undefined,
      notes: data.notes || undefined,
    };

    if (isEdit && editSupplier) {
      updateSupplier.mutate({ id: editSupplier.id, data: payload }, { onSuccess: handleClose });
    } else {
      createSupplier.mutate(payload, { onSuccess: handleClose });
    }
  };

  const isPending = createSupplier.isPending || updateSupplier.isPending;
  const error = createSupplier.error || updateSupplier.error;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-[440px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">{isEdit ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <p className="text-[13px] text-slate-500">Manage supplier contact and terms</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{(error as any)?.message ?? 'Something went wrong'}</div>}

          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Basic Info</p>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Name *</label>
              <input {...register('name')} placeholder="e.g. Karachi Fresh Meats" className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Contact Name</label>
              <input {...register('contactName')} placeholder="e.g. Ahmed Khan" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                <input {...register('phone')} placeholder="0300-1234567" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp</label>
                <input {...register('whatsapp')} placeholder="0300-1234567" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input {...register('email')} type="email" placeholder="supplier@example.com" className={`w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-slate-400 transition-colors ${errors.email ? 'border-red-300' : 'border-slate-200'}`} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
              <textarea {...register('address')} rows={2} placeholder="Street, area, city" className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none" />
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">Terms</p>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Payment Terms</label>
                <input {...register('paymentTerms')} placeholder="e.g. COD, 7 days" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Min Order Value (PKR)</label>
                <input {...register('minOrderValue', { valueAsNumber: true })} type="number" min="0" step="1" placeholder="0" className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Delivery Days</label>
              <div className="flex flex-wrap gap-2">
                {DELIVERY_DAYS.map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-11 h-9 rounded-md border text-xs font-semibold transition-colors ${
                      deliveryDays.includes(day) ? 'border-[#ff5722] bg-orange-50 text-[#ff5722]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setValue('rating', n === rating ? undefined : n)} className="p-0.5">
                    <Star size={22} className={n <= (rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                  </button>
                ))}
                {rating && (
                  <button type="button" onClick={() => setValue('rating', undefined)} className="ml-2 text-xs text-slate-400 hover:text-slate-600">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea {...register('notes')} rows={2} placeholder="Anything worth remembering..." className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-slate-400 transition-colors resize-none" />
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors">Cancel</button>
          <button type="submit" form="supplier-form" disabled={isPending} className="px-4 py-2 bg-[#ff5722] text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50">
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

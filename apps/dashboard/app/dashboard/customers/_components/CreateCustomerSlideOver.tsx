'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

type CreateCustomerSlideOverProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  /** Pass an existing customer to edit it in place instead of creating a new one. */
  initialData?: { name?: string; phone?: string; email?: string; birthday?: string } | null;
};

export function CreateCustomerSlideOver({ isOpen, onClose, onSubmit, initialData }: CreateCustomerSlideOverProps) {
  const isEditing = !!initialData;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name ?? '',
    phone: initialData?.phone ?? '',
    email: initialData?.email ?? '',
    birthday: initialData?.birthday ?? '',
    notes: '',
  });

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData?.name ?? '',
        phone: initialData?.phone ?? '',
        email: initialData?.email ?? '',
        birthday: initialData?.birthday ?? '',
        notes: '',
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (e: any) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isEditing ? 'Edit Customer' : 'Add Customer'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{isEditing ? "Update this customer's profile details." : 'Register a new customer profile manually.'}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                placeholder="e.g. Ali Khan"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                placeholder="e.g. +923001234567"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
              <input
                type="email"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                placeholder="e.g. ali@example.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Birthday (Optional)</label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all"
                value={formData.birthday}
                onChange={e => setFormData({ ...formData, birthday: e.target.value })}
              />
            </div>

            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Notes (Optional)</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] transition-all h-24 resize-none"
                  placeholder="Preferences, allergy alerts, VIP notes..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs shadow-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="h-9 px-5 bg-[#FF5722] hover:bg-[#F4511E] text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center min-w-[120px] text-xs disabled:opacity-70 disabled:cursor-not-allowed gap-1.5"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : isEditing ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </>
  );
}


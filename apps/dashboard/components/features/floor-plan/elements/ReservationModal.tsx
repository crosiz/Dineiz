'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface ReservationModalProps {
  tableId: string;
  onClose: () => void;
}

export function ReservationModal({ tableId, onClose }: ReservationModalProps) {
  const { tables, updateTable } = useFloorPlanStore();
  const table = tables.find(t => t.id === tableId);
  
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime]       = useState('');
  const [guests, setGuests]   = useState(table?.capacity || 2);
  const [notes, setNotes]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  if (!table) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Guest name is required';
    if (!time)        e.time = 'Time is required';
    if (!date)        e.date = 'Date is required';
    if (guests < 1)   e.guests = 'Must be at least 1 guest';
    return e;
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true);
    try {
      const reservationDateTime = `${date}T${time}:00`;

      // Optimistic update
      updateTable(tableId, { status: 'reserved', guestCount: guests });

      await apiFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          tableId,
          branchId: useFloorPlanStore.getState().selectedBranchId,
          guestName: name.trim(),
          guestPhone: phone.trim() || undefined,
          reservationTime: reservationDateTime,
          partySize: guests,
          notes: notes.trim() || undefined,
        }),
      });

      toast.success(`Reservation confirmed for ${name} at ${time}`);
      onClose();
    } catch (err: any) {
      // Rollback optimistic update
      updateTable(tableId, { status: 'available', guestCount: undefined });
      toast.error(err.message ?? 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[200]">
      <div className="bg-white rounded-xl shadow-xl w-[420px] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Reservation</h2>
            <p className="text-xs text-slate-500">{table.label} · Up to {table.capacity} guests</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleReserve} className="p-6 flex flex-col gap-4">
          <Field label="Guest Name *" error={errors.name}>
            <input 
              type="text"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              placeholder="e.g. John Doe"
            />
          </Field>

          <Field label="Phone (optional)">
            <input 
              type="tel"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Date *" error={errors.date}>
              <input 
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }}
              />
            </Field>
            <Field label="Time *" error={errors.time}>
              <input 
                type="time"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
                value={time}
                onChange={e => { setTime(e.target.value); setErrors(p => ({ ...p, time: '' })); }}
              />
            </Field>
            <Field label="Guests *" error={errors.guests}>
              <input 
                type="number"
                min="1"
                max={table.capacity * 2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
                value={guests}
                onChange={e => setGuests(Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea 
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special requests, dietary needs..."
            />
          </Field>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Confirm Reservation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

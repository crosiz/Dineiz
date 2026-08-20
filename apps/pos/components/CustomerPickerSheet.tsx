'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Star } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import { toast } from 'sonner';

export interface PickedCustomer {
  id: string;
  name: string;
  phone?: string | null;
  loyaltyPoints?: number;
}

interface CustomerPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: PickedCustomer) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function CustomerPickerSheet({ isOpen, onClose, onSelect }: CustomerPickerSheetProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setResults([]);
      setShowCreate(false);
      setNewName('');
      setNewPhone('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!isOpen || !debouncedSearch.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    fetch(`${API_URL}/api/customers?search=${encodeURIComponent(debouncedSearch.trim())}&limit=20`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => setResults(Array.isArray(data.data) ? data.data : []))
      .catch(() => setResults([]))
      .finally(() => setIsSearching(false));
  }, [debouncedSearch, isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Enter a customer name');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      const customer = await res.json();
      toast.success(`${customer.name} added`);
      onSelect({ id: customer.id, name: customer.name, phone: customer.phone, loyaltyPoints: customer.loyaltyPoints ?? 0 });
      onClose();
    } catch {
      toast.error('Could not create customer. Check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[440px] bg-white rounded-t-2xl sm:rounded-2xl z-[9999] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-[18px] font-bold text-[#0F172A]">{showCreate ? 'New Customer' : 'Attach Customer'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-[#94A3B8] hover:text-[#0F172A] rounded-full hover:bg-[#F1F5F9] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showCreate ? (
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[#0F172A] font-semibold placeholder:text-[#94A3B8] focus:border-[var(--pos-primary,#F59E0B)] focus:bg-white outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 block">Phone (optional)</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="03XXXXXXXXX"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[#0F172A] font-semibold placeholder:text-[#94A3B8] focus:border-[var(--pos-primary,#F59E0B)] focus:bg-white outline-none transition-colors"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 p-3 rounded-xl border border-[#E2E8F0] text-[#475569] font-bold hover:bg-[#F1F5F9] transition-colors">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="flex-1 p-3 rounded-xl bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 disabled:opacity-50 text-white font-bold transition-all"
              >
                {isCreating ? 'Adding…' : 'Add & Attach'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-[#E2E8F0] shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--pos-primary,#F59E0B)]/20 focus:border-[var(--pos-primary,#F59E0B)] transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
              {!search.trim() ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center text-[#94A3B8]">
                  <Search className="w-8 h-8 mb-3" />
                  <p className="text-[13px]">Search for a customer by name or phone number.</p>
                </div>
              ) : isSearching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--pos-primary,#F59E0B)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 px-6 text-center text-[13px] text-[#64748B]">No customers found matching "{search}"</div>
              ) : (
                <div className="space-y-1">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onSelect(c); onClose(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--pos-primary,#F59E0B)]/10 flex items-center justify-center text-[var(--pos-primary,#F59E0B)] font-bold text-[13px] shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-[#0F172A] truncate">{c.name}</p>
                        {c.phone && <p className="text-[12px] text-[#64748B]">{c.phone}</p>}
                      </div>
                      {!!c.loyaltyPoints && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md shrink-0">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {c.loyaltyPoints}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E2E8F0] shrink-0">
              <button
                onClick={() => { setNewName(search); setShowCreate(true); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#CBD5E1] text-[#475569] font-bold text-[13px] hover:bg-[#F8FAFC] hover:border-[var(--pos-primary,#F59E0B)] transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add New Customer
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

'use client';

import { Modal } from '@/components/ui/Modal';
import { cachedRead } from '@/lib/cached-read';
import { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Star } from 'lucide-react';
import { getToken } from '@/lib/pos-session';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';

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


export function CustomerPickerSheet({ isOpen, onClose, onSelect }: CustomerPickerSheetProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [searchError, setSearchError] = useState('');
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
      setSearchError('');
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
    let active = true;
    setIsSearching(true);
    setSearchError('');
    cachedRead<{ data: PickedCustomer[] }>(`/api/customers?search=${encodeURIComponent(debouncedSearch.trim())}&limit=20`)
      .then(({ data, offline }) => { if (active) { setResults(Array.isArray(data.data) ? data.data : []); if (offline) setSearchError('Offline · Showing saved matches. Loyalty balances may have changed.'); } })
      .catch(() => { if (active) { setResults([]); setSearchError('Search is unavailable. Reconnect to find customers not saved on this device.'); } })
      .finally(() => { if (active) setIsSearching(false); });
    return () => { active = false; };
  }, [debouncedSearch, isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Enter a customer name');
      return;
    }
    if (!navigator.onLine) { toast.error('Connect to register a new customer. You can continue this order without an account.'); return; }
    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        signal: AbortSignal.timeout(8000),
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
    <Modal isOpen onClose={isCreating ? undefined : onClose} label={showCreate ? 'New customer' : 'Attach customer'} sheetOnMobile className="max-w-[440px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-[18px] font-bold text-ink">{showCreate ? 'New Customer' : 'Attach Customer'}</h2>
          <button aria-label="Close customer selection" onClick={onClose} className="min-w-11 min-h-11 p-2 -mr-2 text-ink-4 hover:text-ink rounded-full hover:bg-sunken transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showCreate ? (
          <div className="p-5 overflow-y-auto flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
                className="w-full bg-canvas border border-line rounded-xl p-3 text-ink font-semibold placeholder:text-ink-4 focus:border-brand focus:bg-white outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-1.5 block">Phone (optional)</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="03XXXXXXXXX"
                className="w-full bg-canvas border border-line rounded-xl p-3 text-ink font-semibold placeholder:text-ink-4 focus:border-brand focus:bg-white outline-none transition-colors"
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 p-3 rounded-xl border border-line text-ink-2 font-bold hover:bg-sunken transition-colors">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="flex-1 p-3 rounded-xl bg-brand hover:brightness-105 disabled:opacity-50 text-white font-bold transition-all"
              >
                {isCreating ? 'Adding…' : 'Add & Attach'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-line shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-4 py-3 bg-canvas border border-line rounded-xl text-[16px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
                />
              </div>
            </div>

            {searchError && <p role="status" className="px-4 py-3 text-sm text-ink-3">{searchError}</p>}
            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {!search.trim() ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center text-ink-4">
                  <Search className="w-8 h-8 mb-3" />
                  <p className="text-[13px]">Search for a customer by name or phone number.</p>
                </div>
              ) : isSearching ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchError && results.length === 0 ? null : results.length === 0 ? (
                <div className="py-8 px-6 text-center text-[13px] text-ink-3">No customers found matching "{search}"</div>
              ) : (
                <div className="space-y-1">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onSelect(c); onClose(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-canvas border border-transparent hover:border-line transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-[13px] shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-ink truncate">{c.name}</p>
                        {c.phone && <p className="text-[12px] text-ink-3">{c.phone}</p>}
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

            <div className="p-4 border-t border-line shrink-0">
              <button
                onClick={() => { setNewName(search); setShowCreate(true); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-line-strong text-ink-2 font-bold text-[13px] hover:bg-canvas hover:border-brand transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add New Customer
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import type { CachedMenuItem } from '@/lib/db';
import { useCartStore } from '@/lib/store';
import { getToken } from '@/lib/pos-session';

// ─── Variation Picker Bottom Sheet ──────────────────────────────
export function VariationPicker({ item, onClose }: { item: CachedMenuItem; onClose: () => void }) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedVarId, setSelectedVarId] = useState<string | null>(item.variations?.[0]?.id || null);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    const variation = item.variations?.find((v) => v.id === selectedVarId) || { id: 'default', name: 'Regular', price: 0 };
    const selectedAddOns = item.addOns?.filter((a) => selectedAddOnIds.has(a.id)) || [];
    const addOnTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);

    addItem({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      unitPrice: item.basePrice + (variation.price || 0) + addOnTotal,
      selectedVariation: variation,
      selectedAddOns: selectedAddOns,
      image: item.image,
    });
    onClose();
  };

  const currentTotal = item.basePrice
    + (item.variations?.find(v => v.id === selectedVarId)?.price || 0)
    + Array.from(selectedAddOnIds).reduce((sum, id) => sum + (item.addOns?.find(a => a.id === id)?.price || 0), 0);

  return (
    <>
      {/* Scrim Overlay */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={onClose}></div>

      {/* Bottom Sheet Container */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end h-screen pointer-events-none">
        <div className="w-full h-fit max-h-[90vh] bg-white rounded-t-[24px] flex flex-col shadow-[0_-8px_40px_rgba(15,23,42,0.18)] border border-[#E2E8F0] border-b-0 max-w-[900px] mx-auto pointer-events-auto animate-in slide-in-from-bottom duration-300">

          {/* Handle */}
          <div className="w-full flex justify-center py-3 shrink-0 cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full"></div>
          </div>

          {/* Header */}
          <header className="px-8 pb-6 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-[56px] h-[56px] rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
                <img className="w-full h-full object-cover" src={item.image || "https://placehold.co/400x300/F1F5F9/64748B?text=No+Image"} alt={item.name} />
              </div>
              <div>
                <h1 className="text-[22px] font-bold leading-tight text-[#0F172A]">{item.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{item.categoryName || 'Mains'}</span>
                  <span className="w-1 h-1 bg-[#CBD5E1] rounded-full"></span>
                  <span className="text-[12px] font-bold text-[var(--pos-primary,#F59E0B)]">PKR {item.basePrice}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#FFF8EC] px-4 py-2 rounded-xl border border-[var(--pos-primary,#F59E0B)]/30 flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-bold text-[#B4770B] uppercase tracking-wider">Total</span>
              <span className="text-[20px] font-black text-[#7A4A00] tabular-nums">PKR {currentTotal}</span>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto no-scrollbar px-8 py-6 space-y-7">
            {/* 1. Choose Size (Single Select) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">Choose Size</h3>
                <span className="bg-[var(--pos-primary,#F59E0B)]/10 text-[var(--pos-primary,#F59E0B)] text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">Required</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {item.variations.map((v) => (
                  <label
                    key={v.id}
                    className={`relative flex items-center justify-between h-[68px] px-5 rounded-xl cursor-pointer transition-colors ${selectedVarId === v.id ? 'border-2 border-[var(--pos-primary,#F59E0B)] bg-[#FFF8EC]' : 'border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'}`}
                  >
                    <input
                      type="radio"
                      name="size"
                      checked={selectedVarId === v.id}
                      onChange={() => setSelectedVarId(v.id)}
                      className="hidden"
                    />
                    <div className="flex flex-col">
                      <span className="text-[16px] font-semibold text-[#0F172A]">{v.name}</span>
                      {v.price > 0 && <span className="text-[12px] font-bold text-[var(--pos-primary,#F59E0B)]">+ PKR {v.price}</span>}
                    </div>
                    <span className={`material-symbols-outlined ${selectedVarId === v.id ? 'text-[var(--pos-primary,#F59E0B)]' : 'text-[#CBD5E1]'}`} style={selectedVarId === v.id ? { fontVariationSettings: "'FILL' 1" } : {}}>
                      {selectedVarId === v.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* 2. Choose Add-ons (Multi Select) */}
            {item.addOns && item.addOns.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-widest">Add Extras</h3>
                  <span className="bg-[#F1F5F9] text-[#64748B] text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {item.addOns.map((a) => (
                    <label
                      key={a.id}
                      className={`relative flex items-center justify-between h-[68px] px-5 rounded-xl cursor-pointer transition-colors ${selectedAddOnIds.has(a.id) ? 'border-2 border-[var(--pos-primary,#F59E0B)] bg-[#FFF8EC]' : 'border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAddOnIds.has(a.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAddOnIds);
                          if (e.target.checked) newSet.add(a.id);
                          else newSet.delete(a.id);
                          setSelectedAddOnIds(newSet);
                        }}
                        className="hidden"
                      />
                      <div className="flex flex-col">
                        <span className="text-[16px] font-semibold text-[#0F172A]">{a.name}</span>
                        {a.price > 0 && <span className="text-[12px] font-bold text-[var(--pos-primary,#F59E0B)]">+ PKR {a.price}</span>}
                      </div>
                      <span className={`material-symbols-outlined ${selectedAddOnIds.has(a.id) ? 'text-[var(--pos-primary,#F59E0B)]' : 'text-[#CBD5E1]'}`} style={selectedAddOnIds.has(a.id) ? { fontVariationSettings: "'FILL' 1" } : {}}>
                        {selectedAddOnIds.has(a.id) ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </main>

          {/* Bottom Action Bar */}
          <footer className="border-t border-[#E2E8F0] bg-white px-8 py-4 flex items-center justify-between shrink-0 gap-4">
            <button className="px-6 py-4 rounded-xl border border-[#E2E8F0] text-[#475569] font-bold text-[15px] hover:bg-[#F1F5F9] transition-colors" onClick={onClose}>
              Cancel
            </button>
            <button
              className="flex-1 px-8 py-4 bg-[var(--pos-primary,#F59E0B)] text-white rounded-xl font-bold text-[17px] hover:brightness-105 active:scale-[0.99] transition-all shadow-lg shadow-[var(--pos-primary,#F59E0B)]/25"
              onClick={handleAdd}
            >
              Add to Order &middot; PKR {currentTotal}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

// ─── Discount Modal ────────────────────────────────────────────
export function DiscountModal({ onClose }: { onClose: () => void }) {
  const setDiscount = useCartStore((s) => s.setDiscount);
  const session = useCartStore((s) => s.session);
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';
  const needsOverride = type === 'percent' && parseFloat(value || '0') > 10;

  const handleApply = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;

    if (needsOverride) {
      if (!isManager) {
        if (pin.length !== 4) {
          setPinError('Enter the 4-digit manager PIN.');
          return;
        }
        setVerifying(true);
        setPinError('');
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/auth/validate-manager-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ pin, branchId: session?.branchId }),
          });
          if (!res.ok) {
            setPinError('Incorrect manager PIN.');
            setVerifying(false);
            return;
          }
        } catch {
          setPinError('Could not verify PIN — check your connection.');
          setVerifying(false);
          return;
        }
        setVerifying(false);
      } else if (!reason.trim()) {
        setPinError('A reason is required for discounts over 10%.');
        return;
      }
    }

    setDiscount({ type, value: num, label: reason.trim() || 'Manual Discount' });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[24px] border border-[#E2E8F0] p-7 shadow-[0_30px_80px_rgba(15,23,42,0.25)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-[#0F172A]">Apply Discount</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setType('percent')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'percent' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType('fixed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'fixed' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            Fixed Amount
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 block">Discount Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => { setValue(e.target.value); setPinError(''); }}
              placeholder={type === 'percent' ? 'e.g., 10' : 'e.g., 500'}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[#0F172A] font-semibold placeholder:text-[#94A3B8] focus:border-[var(--pos-primary,#F59E0B)] focus:bg-white outline-none transition-colors"
            />
          </div>

          {needsOverride && (
            <div className="animate-in slide-in-from-top-1 duration-200">
              {!isManager ? (
                <>
                  <label className="text-[11px] font-bold text-[#C4362E] uppercase tracking-wider mb-1.5 block">Manager PIN required — discount over 10%</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                    placeholder="Enter 4-digit PIN"
                    className="w-full bg-[#FDECEC] border border-[#F5C6C2] rounded-xl p-3 text-[#0F172A] font-semibold tracking-widest placeholder:text-[#C99] focus:border-[#C4362E] outline-none transition-colors"
                  />
                </>
              ) : (
                <>
                  <label className="text-[11px] font-bold text-[#B4770B] uppercase tracking-wider mb-1.5 block">Reason required — discount over 10%</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setPinError(''); }}
                    placeholder="e.g. Customer complaint, VIP"
                    className="w-full bg-[#FFF8EC] border border-[var(--pos-primary,#F59E0B)]/30 rounded-xl p-3 text-[#0F172A] font-semibold placeholder:text-[#B99] focus:border-[var(--pos-primary,#F59E0B)] outline-none transition-colors"
                  />
                </>
              )}
              {pinError && <p className="text-[12px] font-semibold text-[#C4362E] mt-1.5">{pinError}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-7">
          <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl border border-[#E2E8F0] text-[#475569] font-bold hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleApply}
            disabled={verifying || !value}
            className="flex-1 p-3 rounded-xl bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 text-white font-bold transition-all shadow-lg shadow-[var(--pos-primary,#F59E0B)]/25"
          >
            {verifying ? 'Verifying…' : 'Apply Discount'}
          </button>
        </div>
      </div>
    </div>
  );
}

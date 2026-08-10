'use client';

import { useState } from 'react';
import type { CachedMenuItem } from '@/lib/db';
import { useCartStore } from '@/lib/store';

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

  return (
    <>
      {/* Background Order Entry Screen (Dimmed) */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-40 z-30"></div>
      {/* Scrim Overlay */}
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Bottom Sheet Container */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end h-screen pointer-events-none">
        <div className="w-full h-fit max-h-[95vh] bg-[#111111] rounded-t-[20px] flex flex-col shadow-2xl border-t border-[#534434] max-w-[1280px] mx-auto pointer-events-auto animate-in slide-in-from-bottom duration-300">
          
          {/* Handle */}
          <div className="w-full flex justify-center py-4 shrink-0 cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1 bg-[#534434] rounded-full"></div>
          </div>
          
          {/* Header */}
          <header className="h-[80px] px-8 flex items-center justify-between border-b border-[#534434] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-[56px] h-[56px] rounded-lg overflow-hidden border border-[#534434]">
                <img className="w-full h-full object-cover" src={item.image || "https://placehold.co/400x300/e4e2e4/191c1e?text=No+Image"} alt={item.name} />
              </div>
              <div>
                <h1 className="text-[24px] font-semibold leading-none text-[#f0e0d1]">{item.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] font-semibold text-[#d8c3ad] uppercase tracking-wider">{item.categoryName || 'Mains'}</span>
                  <span className="w-1 h-1 bg-[#534434] rounded-full"></span>
                  <span className="text-[12px] font-semibold text-[var(--pos-primary)]">PKR {item.basePrice}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-[#31281f] px-4 py-2 rounded-lg border border-[#f59e0b]/30 flex items-center gap-3">
              <span className="text-[12px] font-semibold text-[#d8c3ad]">CURRENT TOTAL</span>
              <span className="text-[20px] font-bold text-[#ffc174]">PKR {item.basePrice + (item.variations?.find(v => v.id === selectedVarId)?.price || 0) + Array.from(selectedAddOnIds).reduce((sum, id) => sum + (item.addOns?.find(a => a.id === id)?.price || 0), 0)}</span>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto no-scrollbar px-8 py-6 space-y-8">
            {/* 1. Choose Size (Single Select) */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-[#d8c3ad] uppercase tracking-widest">Choose Size</h3>
                <span className="bg-[var(--pos-primary)]/10 text-[var(--pos-primary)] text-[12px] font-semibold px-2 py-1 rounded">REQUIRED</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {item.variations.map((v) => (
                  <label 
                    key={v.id}
                    className={`relative flex items-center justify-between h-[72px] px-6 rounded-xl cursor-pointer transition-colors ${selectedVarId === v.id ? 'border-2 border-[#ffc174] bg-[#31281f]' : 'border border-[#534434] bg-[#261e15] hover:bg-[#221a12]'}`}
                  >
                    <input
                      type="radio"
                      name="size"
                      checked={selectedVarId === v.id}
                      onChange={() => setSelectedVarId(v.id)}
                      className="hidden"
                    />
                    <div className="flex flex-col">
                      <span className="text-[20px] font-semibold text-[#f0e0d1]">{v.name}</span>
                      {v.price > 0 && <span className="text-[12px] font-semibold text-[var(--pos-primary)]">+ PKR {v.price}</span>}
                    </div>
                    <span className={`material-symbols-outlined ${selectedVarId === v.id ? 'text-[#ffc174]' : 'text-[#d8c3ad]'}`} style={selectedVarId === v.id ? { fontVariationSettings: "'FILL' 1" } : {}}>
                      {selectedVarId === v.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </label>
                ))}
              </div>
            </section>
            
            {/* 2. Choose Add-ons (Multi Select) */}
            {item.addOns && item.addOns.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-[#d8c3ad] uppercase tracking-widest">Add Extras</h3>
                  <span className="bg-[#3c3329] text-[#d8c3ad] text-[12px] font-semibold px-2 py-1 rounded">OPTIONAL</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {item.addOns.map((a) => (
                    <label 
                      key={a.id}
                      className={`relative flex items-center justify-between h-[72px] px-6 rounded-xl cursor-pointer transition-colors ${selectedAddOnIds.has(a.id) ? 'border-2 border-[#ffc174] bg-[#31281f]' : 'border border-[#534434] bg-[#261e15] hover:bg-[#221a12]'}`}
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
                        <span className="text-[20px] font-semibold text-[#f0e0d1]">{a.name}</span>
                        {a.price > 0 && <span className="text-[12px] font-semibold text-[var(--pos-primary)]">+ PKR {a.price}</span>}
                      </div>
                      <span className={`material-symbols-outlined ${selectedAddOnIds.has(a.id) ? 'text-[#ffc174]' : 'text-[#d8c3ad]'}`} style={selectedAddOnIds.has(a.id) ? { fontVariationSettings: "'FILL' 1" } : {}}>
                        {selectedAddOnIds.has(a.id) ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </main>

          {/* Bottom Action Bar */}
          <footer className="h-[96px] border-t border-[#534434] bg-[#19120a] px-8 py-4 flex items-center justify-between shrink-0">
            <button className="px-6 py-4 rounded-xl border border-[#534434] text-[#d8c3ad] font-semibold text-[16px] hover:bg-[#3c3329] transition-colors" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="px-12 py-4 bg-[var(--pos-primary)] text-[#613b00] rounded-xl font-bold text-[20px] hover:brightness-110 active:scale-95 transition-all shadow-xl"
              onClick={handleAdd}
            >
              Add to Order
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}


// ─── Promo Code Modal ──────────────────────────────────────────
export function PromoCodeModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const setPromoCode = useCartStore((s) => s.setPromoCode);
  const fetchEligibleDeals = useCartStore((s) => s.fetchEligibleDeals);

  const handleApply = async () => {
    setPromoCode(code);
    await fetchEligibleDeals();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--pos-bg-card)] w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-white mb-4">Apply Promo Code</h2>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          className="w-full bg-[var(--pos-bg-base)] border border-white/10 rounded-xl p-3 mb-6 uppercase text-center font-bold tracking-widest text-white placeholder:text-slate-650 focus:border-[var(--pos-primary)] outline-none transition-colors"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl border border-white/10 text-slate-300 hover:bg-[var(--pos-bg-card)]/5 hover:text-white transition-colors">Cancel</button>
          <button type="button" onClick={handleApply} className="flex-1 p-3 rounded-xl bg-[var(--pos-primary)] hover:brightness-110 active:scale-[0.98] text-white font-bold transition-all shadow-md shadow-[var(--pos-primary)]/10">Apply</button>
        </div>
      </div>
    </div>
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

  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';

  const handleApply = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;

    // Require manager PIN if discount > 10% and not logged in as manager
    if (type === 'percent' && num > 10) {
      if (!isManager && pin !== '1234') {
        alert('Invalid Manager PIN for discount > 10%');
        return;
      }
      if (isManager && !reason.trim()) {
        alert('A reason is mandatory for large manager discounts.');
        return;
      }
    }

    setDiscount({ type, value: num, label: reason.trim() || 'Manual Discount' });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--pos-bg-card)] w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-white mb-4">Apply Discount</h2>

        <div className="flex gap-2 mb-6 p-1 bg-[var(--pos-bg-base)] rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setType('percent')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${type === 'percent' ? 'bg-[var(--pos-primary)] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType('fixed')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${type === 'fixed' ? 'bg-[var(--pos-primary)] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
          >
            Fixed Amount
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Discount Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'percent' ? "e.g., 10" : "e.g., 500"}
              className="w-full bg-[var(--pos-bg-base)] border border-white/10 rounded-xl p-3 text-white placeholder:text-slate-650 focus:border-[var(--pos-primary)] outline-none transition-colors"
            />
          </div>

          {type === 'percent' && parseFloat(value || '0') > 10 && (
            <div className="animate-in slide-in-from-top-1 duration-200">
              {!isManager ? (
                <>
                  <label className="text-[12px] font-bold text-red-400 uppercase tracking-wider mb-1 block">Manager PIN Required (Discount &gt; 10%)</label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter 4-digit PIN"
                    className="w-full bg-[var(--pos-bg-base)] border border-red-500/30 rounded-xl p-3 text-white placeholder:text-slate-650 focus:border-red-500 outline-none transition-colors"
                  />
                </>
              ) : (
                <>
                  <label className="text-[12px] font-bold text-amber-400 uppercase tracking-wider mb-1 block">Manager Override Reason (Required)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Customer complaint, VIP"
                    className="w-full bg-[var(--pos-bg-base)] border border-amber-500/30 rounded-xl p-3 text-white placeholder:text-slate-650 focus:border-amber-500 outline-none transition-colors"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl border border-white/10 text-slate-300 hover:bg-[var(--pos-bg-card)]/5 hover:text-white transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 p-3 rounded-xl bg-[var(--pos-primary)] hover:brightness-110 active:scale-[0.98] text-white font-bold transition-all shadow-lg shadow-[var(--pos-primary)]/20"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Split Bill Flow (Placeholder) ─────────────────────────────
export function SplitBillFlow({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--pos-bg-card)] w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-[0_32px_64px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Split Bill</h2>
          <button type="button" onClick={onClose} className="p-2 bg-[var(--pos-bg-card)]/5 hover:bg-[var(--pos-bg-card)]/10 rounded-full text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-8 text-center text-slate-400 border border-white/5 bg-[var(--pos-bg-base)] rounded-xl flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[var(--pos-primary)] text-4xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>call_split</span>
          <p className="font-semibold text-sm">Split bill flow will be handled directly through cash payments.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Takeaway Info Bar ──────────────────────────────────────────
export function TakeawayInfoBar() {
  const [pickupMinutes, setPickupMinutes] = useState(15);
  const [orderSource, setOrderSource] = useState<'Walk-in' | 'Called-in' | 'App Order'>('Walk-in');

  // Calculate ready time based on current time + pickupMinutes
  const readyDate = new Date(Date.now() + pickupMinutes * 60000);
  const readyTimeStr = readyDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <section className="h-[80px] bg-[#0F0F0F] border-b border-[#1A1A1A] flex items-center px-lg gap-xl shrink-0">
      {/* Inputs */}
      <div className="flex gap-md flex-1">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">person</span>
          <input
            className="w-full h-11 bg-[#161616] border border-outline-variant/30 rounded-lg pl-10 pr-4 text-on-surface placeholder:text-[#474646] focus:outline-none focus:border-primary transition-colors"
            placeholder="Customer name"
            type="text"
          />
        </div>
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">call</span>
          <input
            className="w-full h-11 bg-[#161616] border border-outline-variant/30 rounded-lg pl-10 pr-4 text-on-surface placeholder:text-[#474646] focus:outline-none focus:border-primary transition-colors"
            placeholder="+92 3XX XXXXXXX"
            type="text"
          />
        </div>
      </div>

      {/* Stepper */}
      <div className="flex flex-col items-center shrink-0">
        <span className="text-on-surface-variant font-label-md text-[11px] uppercase tracking-wider mb-1">Pickup in</span>
        <div className="flex items-center bg-[#161616] rounded-lg h-10 border border-outline-variant">
          <button
            onClick={() => setPickupMinutes(m => Math.max(5, m - 5))}
            className="px-3 hover:bg-surface-container-highest transition-colors h-full rounded-l-lg border-r border-outline-variant active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="px-6 font-semibold text-primary font-body-md min-w-[80px] text-center">{pickupMinutes} min</span>
          <button
            onClick={() => setPickupMinutes(m => Math.min(120, m + 5))}
            className="px-3 hover:bg-surface-container-highest transition-colors h-full rounded-r-lg border-l border-outline-variant active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
        <span className="text-on-surface-variant font-label-md text-[10px] mt-1">Ready at {readyTimeStr}</span>
      </div>

      {/* Selectors */}
      <div className="flex bg-[#161616] p-1 rounded-lg border border-outline-variant shrink-0">
        {(['Walk-in', 'Called-in', 'App Order'] as const).map(source => (
          <button
            key={source}
            onClick={() => setOrderSource(source)}
            className={`px-4 py-1.5 rounded-md font-label-md transition-all ${orderSource === source ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            {source}
          </button>
        ))}
      </div>
    </section>
  );
}
